import { renderComponent } from '../component.js'
import { isObjectLike } from '../types.js'
import type {
  ComponentInstance,
  ComponentMountInput,
  ComponentProps,
  MountFunction,
  Mounted,
  MountedComponent,
  ObjectLike,
  PatchSubtree,
  RenderRuntimeState,
} from '../types.js'

/*
组件 patch

同一组件类型更新时复用组件实例、propsRO 和 hook 状态，同时为本轮 render 重新建立 effect scope。
这能避免组件函数重跑后旧 watch/useEffect 残留，也保留 useState/useRef 等 Hook 插槽的稳定性。
*/

const ADOPTED_TARGET_KEY = '__rue_hydrated_adopted_target' as const

interface FocusDocument {
  activeElement?: unknown
}

interface FocusNode extends ObjectLike {
  [ADOPTED_TARGET_KEY]?: unknown
  childNodes?: ArrayLike<unknown>
  focus?: () => void
  ownerDocument?: FocusDocument
  selectionDirection?: string | null
  selectionEnd?: number | null
  selectionStart?: number | null
  tagName?: unknown
  type?: unknown
}

interface FocusSnapshot {
  path: number[]
  tag: string | undefined
  inputType: string | undefined
  selectionStart: number | undefined
  selectionEnd: number | undefined
  selectionDirection: string | undefined
}

const focusNode = (value: unknown): FocusNode | undefined =>
  isObjectLike(value) ? (value as FocusNode) : undefined

const resolveAdoptedTarget = (node: unknown): FocusNode | undefined => {
  let current = focusNode(node)
  let depth = 0
  while (current?.[ADOPTED_TARGET_KEY] && depth < 20) {
    current = focusNode(current[ADOPTED_TARGET_KEY])
    depth += 1
  }
  return current
}

const findDescendantPath = (
  root: unknown,
  target: unknown,
  path: number[] = [],
): number[] | undefined => {
  if (!root || !target) return undefined
  if (root === target) return path
  const children = Array.from(focusNode(root)?.childNodes ?? [])
  for (let index = 0; index < children.length; index += 1) {
    const found = findDescendantPath(children[index], target, [...path, index])
    if (found) return found
  }
  return undefined
}

const descendantByPath = (root: unknown, path: readonly number[]): FocusNode | undefined => {
  let current: unknown = root
  for (const index of path) {
    current = focusNode(current)?.childNodes?.[index]
    if (!current) return undefined
  }
  return focusNode(current)
}

const normalizedTag = (node: unknown): string | undefined => {
  const tagName = focusNode(node)?.tagName
  return typeof tagName === 'string' ? tagName.toUpperCase() : undefined
}

const normalizedInputType = (node: unknown): string | undefined => {
  if (normalizedTag(node) !== 'INPUT') return undefined
  return String(focusNode(node)?.type ?? '').toLowerCase()
}

const captureFocusSnapshot = (root: unknown): FocusSnapshot | undefined => {
  const actualRoot = resolveAdoptedTarget(root)
  const active = actualRoot?.ownerDocument?.activeElement
  const activeNode = focusNode(active)
  const path = findDescendantPath(actualRoot, activeNode)
  if (!path || !activeNode) return undefined
  // 记录旧焦点位置，patch 后尝试在新子树中按路径恢复焦点和选区。
  return {
    path,
    tag: normalizedTag(activeNode),
    inputType: normalizedInputType(activeNode),
    selectionStart:
      typeof activeNode.selectionStart === 'number' ? activeNode.selectionStart : undefined,
    selectionEnd: typeof activeNode.selectionEnd === 'number' ? activeNode.selectionEnd : undefined,
    selectionDirection:
      typeof activeNode.selectionDirection === 'string' ? activeNode.selectionDirection : undefined,
  }
}

const restoreFocusSnapshot = (snapshot: FocusSnapshot | undefined, root: unknown): void => {
  if (!snapshot || !root) return
  const target = descendantByPath(root, snapshot.path)
  if (!target || normalizedTag(target) !== snapshot.tag) return
  if (snapshot.inputType !== undefined && normalizedInputType(target) !== snapshot.inputType) return

  Promise.resolve().then(() => {
    const actualTarget = resolveAdoptedTarget(target)
    if (actualTarget?.ownerDocument?.activeElement !== actualTarget) actualTarget?.focus?.()
    try {
      if (snapshot.selectionStart !== undefined && actualTarget) {
        actualTarget.selectionStart = snapshot.selectionStart
      }
      if (snapshot.selectionEnd !== undefined && actualTarget) {
        actualTarget.selectionEnd = snapshot.selectionEnd
      }
      if (snapshot.selectionDirection !== undefined && actualTarget) {
        actualTarget.selectionDirection = snapshot.selectionDirection
      }
    } catch {
      // Selection properties are intentionally best-effort for non-text form controls.
    }
  })
}

const componentRecord = <HostNode>(
  state: RenderRuntimeState<HostNode>,
  input: ComponentMountInput<HostNode>,
  instance: ComponentInstance<ComponentProps, HostNode>,
  subtree: Mounted<HostNode> | undefined,
): MountedComponent<HostNode> => ({
  kind: 'component',
  type: input.type.component,
  key: input.key,
  instance,
  subtree,
  host: subtree?.host,
  fragmentNodes: subtree?.fragmentNodes ?? [],
  disposed: false,
  dispose() {
    if (this.disposed) return
    this.disposed = true
    state.components.withCurrent(instance, () => {
      state.lifecycle.call(instance.host, 'before_unmount')
    })
    state.components.disposeScope(instance)
    this.subtree?.dispose?.()
    state.components.withCurrent(instance, () => {
      state.lifecycle.call(instance.host, 'unmounted')
    })
    state.components.release(instance)
  },
})

export const isSameComponent = <HostNode>(
  mounted: Mounted<HostNode> | undefined,
  input: ComponentMountInput<HostNode>,
): mounted is MountedComponent<HostNode> =>
  mounted?.kind === 'component' &&
  mounted.type === input.type.component &&
  mounted.key === input.key

/** Mount a component function and retain its instance even when it renders an empty subtree. */
export const mountComponent = <HostNode>(
  state: RenderRuntimeState<HostNode>,
  host: import('../types.js').DOMHost<HostNode>,
  input: ComponentMountInput<HostNode>,
  parentContext: HostNode,
  mountInput: MountFunction<HostNode>,
): MountedComponent<HostNode> => {
  const instance = state.components.create(input)
  try {
    const subtree = renderComponent(state, instance, input, next =>
      mountInput(state, host, next, parentContext),
    )
    instance.isMounted = true
    return componentRecord(state, input, instance, subtree)
  } catch (error) {
    state.components.dispose(instance)
    throw error
  }
}

/** Re-render a same-identity component while preserving its instance, props proxy, and Hook slots. */
export const patchComponent = <HostNode>(
  state: RenderRuntimeState<HostNode>,
  mounted: MountedComponent<HostNode>,
  input: ComponentMountInput<HostNode>,
  patchSubtree: PatchSubtree<HostNode>,
): MountedComponent<HostNode> => {
  const focusSnapshot = captureFocusSnapshot(mounted.host)
  const subtree = renderComponent(state, mounted.instance, input, patchSubtree)
  restoreFocusSnapshot(focusSnapshot, subtree?.host)
  mounted.instance.isMounted = true
  mounted.type = input.type.component
  mounted.key = input.key
  mounted.subtree = subtree
  mounted.host = subtree?.host
  mounted.fragmentNodes = subtree?.fragmentNodes ?? []
  return mounted
}
