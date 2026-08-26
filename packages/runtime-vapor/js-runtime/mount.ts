import { postPatchElement, patchProps } from './props.js'
import { isSameComponent, mountComponent, patchComponent } from './patch/component.js'
import { dropRenderEntriesWithin } from './render/helpers.js'
import { isObjectLike } from './types.js'
import type {
  DOMHost,
  EffectScopeId,
  ElementMountInput,
  FragmentMountInput,
  MountChild,
  MountCleanupBucket,
  MountInput,
  Mounted,
  MountedElement,
  MountedFragment,
  MountedText,
  MountedVapor,
  RenderRuntimeState,
  TextMountInput,
  VaporMountInput,
} from './types.js'

/*
默认 Element / Fragment 挂载

兼容包移除后，createElement 仍需要把基础 JSX/TSX 元素落到默认 MountInput
路径。这里只负责初始创建与插入；后续更新沿用当前 Vapor/host-node 的整体替换策略。
*/

const appendMountedHost = <HostNode>(
  host: DOMHost<HostNode>,
  parent: HostNode,
  mounted: Mounted<HostNode> | undefined,
): void => {
  if (!mounted?.host) return
  if (mounted.kind === 'fragment' || mounted.fragmentNodes?.length) {
    for (const child of mounted.fragmentNodes ?? host.collectFragmentChildren(mounted.host)) {
      host.appendChild(parent, child)
    }
  } else {
    host.appendChild(parent, mounted.host)
  }
}

/*
文本节点挂载

把 text MountInput 转成宿主文本节点，并记录 mounted text snapshot。
文本是 patch 中最简单且最常见的分支。
*/

const mountChild = <HostNode>(
  state: RenderRuntimeState<HostNode>,
  host: DOMHost<HostNode>,
  child: MountChild<HostNode>,
  parent: HostNode,
): Mounted<HostNode> | undefined => {
  if (child.kind === 'text') {
    const text = host.createTextNode(child.value)
    host.appendChild(parent, text)
    return { kind: 'text', host: text, value: child.value }
  }
  const mounted = mountInput(state, host, child.value, parent)
  appendMountedHost(host, parent, mounted)
  return mounted
}

const mountChildren = <HostNode>(
  state: RenderRuntimeState<HostNode>,
  host: DOMHost<HostNode>,
  input: ElementMountInput<HostNode> | FragmentMountInput<HostNode>,
  parent: HostNode,
): Mounted<HostNode>[] => {
  const mounted: Mounted<HostNode>[] = []
  for (const child of input.children) {
    const childMount = mountChild(state, host, child, parent)
    if (childMount) mounted.push(childMount)
  }
  return mounted
}

const mountElement = <HostNode>(
  state: RenderRuntimeState<HostNode>,
  host: DOMHost<HostNode>,
  input: ElementMountInput<HostNode>,
  parentContext: HostNode,
): MountedElement<HostNode> => {
  const element = host.createElement(input.type.tag, parentContext)
  patchProps(host, element, {}, input.props)
  const children = Object.prototype.hasOwnProperty.call(input.props, 'dangerouslySetInnerHTML')
    ? []
    : mountChildren(state, host, input, element)
  postPatchElement(host, element, input.props)
  return {
    kind: 'element',
    host: element,
    tag: input.type.tag,
    props: input.props,
    children,
    dispose() {
      for (const child of children) child.dispose?.()
    },
  }
}

const mountFragment = <HostNode>(
  state: RenderRuntimeState<HostNode>,
  host: DOMHost<HostNode>,
  input: FragmentMountInput<HostNode>,
): MountedFragment<HostNode> => {
  const fragment = host.createDocumentFragment()
  const children = mountChildren(state, host, input, fragment)
  // Fragment 的 host 只是临时容器，真实插入/删除需要追踪其展开后的子节点。
  const fragmentNodes = host.collectFragmentChildren(fragment)
  return {
    kind: 'fragment',
    host: fragment,
    fragmentNodes,
    props: input.props,
    children,
    dispose() {
      for (const child of children) child.dispose?.()
    },
  }
}

const isComponentMountInput = <HostNode>(
  input: MountInput<HostNode>,
): input is import('./types.js').ComponentMountInput<HostNode> => input.type.kind === 'component'

const isElementMountInput = <HostNode>(
  input: MountInput<HostNode>,
): input is ElementMountInput<HostNode> => input.type.kind === 'element'

const isFragmentMountInput = <HostNode>(
  input: MountInput<HostNode>,
): input is FragmentMountInput<HostNode> => input.type.kind === 'fragment'

const isVaporMountInput = <HostNode>(
  input: MountInput<HostNode>,
): input is VaporMountInput<HostNode> => input.type.kind === 'vapor'

const isTextMountInput = <HostNode>(
  input: MountInput<HostNode>,
): input is TextMountInput<HostNode> => input.type.kind === 'text'

const unreachableMountInput = (input: never): never => {
  throw new TypeError(`Unsupported mount input: ${String(input)}`)
}

const invalidMountInput = (input: { type: { kind: string } }): never => {
  throw new TypeError(`Invalid mount input discriminant: ${String(input.type.kind)}`)
}

const isMountableVaporHost = (value: unknown): boolean => {
  if (!isObjectLike(value)) return value == null
  const nodeType = Reflect.get(value, 'nodeType')
  return [1, 3, 11].includes(nodeType as number) || typeof Reflect.get(value, 'tag') === 'string'
}

const invokeCleanupBucket = (bucket: MountCleanupBucket | undefined): void => {
  if (!Array.isArray(bucket)) return
  for (const cleanup of bucket.splice(0)) {
    if (typeof cleanup !== 'function') continue
    try {
      cleanup()
    } catch {}
  }
}

const disposeVaporResources = <HostNode>(
  state: RenderRuntimeState<HostNode>,
  cleanupBucket: MountCleanupBucket | undefined,
  scopeId: EffectScopeId | undefined,
): void => {
  invokeCleanupBucket(cleanupBucket)
  if (scopeId === undefined) return
  state.kernel.disposeEffectScope(scopeId)
  state.effectScopeIds.delete(scopeId)
}

/*
Vapor 子树挂载

处理默认主路径中的 Vapor：
- 直接复用已由 JS/Vapor 侧创建的宿主节点或片段节点
- 若存在 setup，则在专属 effect scope 中执行，确保卸载时可统一清理
- 将 cleanup bucket 与 scope id 写入 mounted snapshot，交给生命周期层释放
*/

interface VaporSetupResult<HostNode> {
  host: HostNode | null | undefined
  scopeId: EffectScopeId | undefined
}

const runVaporSetup = <HostNode>(
  state: RenderRuntimeState<HostNode>,
  input: VaporMountInput<HostNode>,
  parentContext: HostNode,
): VaporSetupResult<HostNode> | undefined => {
  const setup = input.type.setup
  if (typeof setup !== 'function') {
    return undefined
  }

  const scopeId = input.mountEffectScopeId ?? state.kernel.createEffectScope()
  if (scopeId !== undefined) {
    state.effectScopeIds.add(scopeId)
  }
  const reactive = state.kernel.reactive
  if (scopeId !== undefined) {
    // setup 执行期间创建的 watch/effect/computed 都应归属于该 Vapor 子树。
    // 后续卸载时，生命周期控制器会根据 scope id 统一 dispose。
    reactive.__ruePushEffectScope?.(scopeId)
  }
  try {
    // 编译产物直接返回可挂载的宿主节点或片段节点。
    return { host: setup(parentContext), scopeId }
  } catch (error) {
    disposeVaporResources(state, input.mountCleanupBucket, scopeId)
    throw error
  } finally {
    // 无论 setup 成功还是失败，当前容器与 effect scope 都必须恢复，避免污染外层渲染。
    if (scopeId !== undefined) {
      reactive.__ruePopEffectScope?.()
    }
  }
}

/** Mount a compiled Vapor setup result while retaining its scope and cleanup ownership. */
const mountVapor = <HostNode>(
  state: RenderRuntimeState<HostNode>,
  host: DOMHost<HostNode>,
  input: VaporMountInput<HostNode>,
  parentContext: HostNode,
): MountedVapor<HostNode> => {
  const result = runVaporSetup(state, input, parentContext)
  const effectScopeId = result?.scopeId ?? input.mountEffectScopeId
  const vaporHost = result?.host ?? input.elHint
  const cleanupBucket = input.mountCleanupBucket

  // 复用 setup 或 bridge 已提供的 host，避免重复执行 setup 和注册副作用。
  if (!isMountableVaporHost(vaporHost)) {
    disposeVaporResources(state, cleanupBucket, effectScopeId)
    throw new TypeError('Unsupported object returns are no longer accepted for vapor setup')
  }

  if (isObjectLike(vaporHost) && effectScopeId !== undefined) {
    try {
      // 把 scope id 写回宿主节点，供 JS 侧调试/桥接路径识别该节点的 owner scope。
      Object.defineProperty(vaporHost, '__rue_effect_scope_id', {
        configurable: true,
        value: effectScopeId,
      })
    } catch {}
  }

  // 编译器生成的 Vapor setup 默认直接 `return _root`，这里继续接受该块根节点。
  const fragmentNodes =
    vaporHost && host.isFragment(vaporHost) ? host.collectFragmentChildren(vaporHost) : []
  const renderEntryRoots = fragmentNodes.length > 0 ? fragmentNodes : vaporHost ? [vaporHost] : []
  let disposed = false
  return {
    kind: 'vapor',
    host: vaporHost,
    fragmentNodes,
    props: input.props,
    cleanupBucket,
    effectScopeId,
    key: input.key,
    dispose() {
      if (disposed) return
      disposed = true
      for (const root of renderEntryRoots) dropRenderEntriesWithin(state, root)
      disposeVaporResources(state, cleanupBucket, effectScopeId)
    },
  }
}

/** Mount a normalized input, including component instances backed by the JS Hook carrier. */
export const mountInput = <HostNode>(
  state: RenderRuntimeState<HostNode>,
  host: DOMHost<HostNode>,
  input: MountInput<HostNode> | null | undefined,
  parentContext: HostNode,
): Mounted<HostNode> | undefined => {
  if (!input) return undefined
  switch (input.type.kind) {
    case 'component': {
      if (!isComponentMountInput(input)) return invalidMountInput(input)
      return mountComponent(state, host, input, parentContext, mountInput)
    }
    case 'element': {
      if (!isElementMountInput(input)) return invalidMountInput(input)
      return mountElement(state, host, input, parentContext)
    }
    case 'fragment': {
      if (!isFragmentMountInput(input)) return invalidMountInput(input)
      return mountFragment(state, host, input)
    }
    case 'vapor': {
      if (!isVaporMountInput(input)) return invalidMountInput(input)
      return mountVapor(state, host, input, parentContext)
    }
    case 'text': {
      if (!isTextMountInput(input)) return invalidMountInput(input)
      // text mount 测试，覆盖无 DOM adapter 时的 fallback mounted metadata。
      const text = host.createTextNode(input.type.value)
      return { kind: 'text', host: text, value: input.type.value } satisfies MountedText<HostNode>
    }
    default:
      return unreachableMountInput(input.type)
  }
}

const resetMountedProps = <HostNode>(
  host: DOMHost<HostNode>,
  mounted: Mounted<HostNode> | undefined,
): void => {
  if (mounted?.kind === 'element') patchProps(host, mounted.host, mounted.props, {})
}

const removeMountedHost = <HostNode>(
  host: DOMHost<HostNode>,
  mounted: Mounted<HostNode> | undefined,
  parent: HostNode,
): void => {
  const nodes =
    mounted?.kind === 'fragment' || mounted?.fragmentNodes?.length
      ? mounted.fragmentNodes
      : [mounted?.host]
  for (const node of nodes ?? []) {
    if (node && host.contains(parent, node)) host.removeChild(parent, node)
  }
}

/** Replace the current basic mount in stable container order. */
export const patchMountedInput = <HostNode>(
  state: RenderRuntimeState<HostNode>,
  host: DOMHost<HostNode>,
  mounted: Mounted<HostNode> | undefined,
  input: MountInput<HostNode> | null,
  parentContext: HostNode,
): Mounted<HostNode> | undefined => {
  if (input && isComponentMountInput(input) && isSameComponent(mounted, input)) {
    // Patch 节点只保留 Component 分支，继续交给组件更新路径。
    return patchComponent(state, mounted, input, next =>
      patchMountedInput(state, host, mounted.subtree, next, parentContext),
    )
  }
  // 非同一组件身份时，释放旧 mount 并按新输入重新挂载。
  resetMountedProps(host, mounted)
  mounted?.dispose?.()
  removeMountedHost(host, mounted, parentContext)
  return mountInput(state, host, input, parentContext)
}

export const appendMounted = appendMountedHost
