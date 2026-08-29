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

interface DisposableRenderEffect {
  dispose(): void
  rerender(): void
}

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
  renderEffect?: DisposableRenderEffect,
): MountedComponent<HostNode> => ({
  kind: 'component',
  type: input.type.component,
  key: input.key,
  instance,
  subtree,
  host: subtree?.host,
  fragmentNodes: subtree?.fragmentNodes ?? [],
  disposed: false,
  renderEffect,
  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.renderEffect?.dispose()
    delete instance.host.__rue_component_render_invalidate__
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

const runComponentRenderEntry = <HostNode, T>(
  state: RenderRuntimeState<HostNode>,
  render: () => T,
): T => {
  state.renderDepth += 1
  try {
    return render()
  } finally {
    state.renderDepth -= 1
    if (state.renderDepth === 0) state.flushPendingComponentLifecycle?.()
  }
}

const createComponentRenderEffect = <HostNode>(
  state: RenderRuntimeState<HostNode>,
  render: () => void,
): DisposableRenderEffect => {
  const reactive = state.kernel.reactive
  const watchEffect = Reflect.get(reactive, 'watchEffect')
  if (typeof watchEffect !== 'function') {
    render()
    return { dispose() {}, rerender: render }
  }

  const handle: unknown = Reflect.apply(watchEffect, reactive, [render])

  let disposed = false
  return {
    rerender: render,
    dispose() {
      if (disposed) return
      disposed = true
      const dispose =
        (typeof handle === 'object' || typeof handle === 'function') && handle != null
          ? Reflect.get(handle, 'dispose')
          : undefined
      if (typeof dispose === 'function') Reflect.apply(dispose, handle, [])
    },
  }
}

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
  patchSubtree: (
    mounted: Mounted<HostNode> | undefined,
    input: import('../types.js').MountInput<HostNode> | null,
    parent: HostNode,
  ) => Mounted<HostNode> | undefined,
): MountedComponent<HostNode> => {
  const instance = state.components.create(input)
  let record: MountedComponent<HostNode> | undefined
  let subtree: Mounted<HostNode> | undefined
  let initialRender = true
  try {
    const renderSubtree = () =>
      runComponentRenderEntry(state, () => {
        const currentInput = instance.input
        const focusSnapshot = initialRender ? undefined : captureFocusSnapshot(subtree?.host)
        const boundaryNode = subtree?.fragmentNodes?.[0] ?? subtree?.host
        const previousNodes = subtree?.fragmentNodes?.length
          ? subtree.fragmentNodes
          : subtree?.host
            ? [subtree.host]
            : []
        const previousLast = previousNodes[previousNodes.length - 1]
        const before =
          (typeof previousLast === 'object' || typeof previousLast === 'function') &&
          previousLast != null
            ? (Reflect.get(previousLast, 'nextSibling') as HostNode | null | undefined)
            : undefined
        const patchParent = boundaryNode
          ? (host.getParentNode(boundaryNode) ?? parentContext)
          : parentContext
        subtree = renderComponent(state, instance, currentInput, next =>
          initialRender
            ? mountInput(state, host, next, parentContext)
            : patchSubtree(subtree, next, patchParent),
        )
        if (!initialRender && subtree) {
          const nextNodes = subtree.fragmentNodes?.length
            ? subtree.fragmentNodes
            : subtree.host
              ? [subtree.host]
              : []
          for (const node of nextNodes) {
            if (before && host.getParentNode(before) === patchParent) {
              host.insertBefore(patchParent, node, before)
            } else if (host.getParentNode(node) !== patchParent) {
              host.appendChild(patchParent, node)
            }
          }
        }
        if (!initialRender) restoreFocusSnapshot(focusSnapshot, subtree?.host)
        initialRender = false
        if (record) {
          record.subtree = subtree
          record.host = subtree?.host
          record.fragmentNodes = subtree?.fragmentNodes ?? []
        }
      })
    instance.host.__rue_component_render_invalidate__ = renderSubtree
    const renderReactiveFactory =
      (
        input.type.component as typeof input.type.component & {
          __rue_component_render_reactive_factory__?: boolean
        }
      ).__rue_component_render_reactive_factory__ === true
    let renderEffect: DisposableRenderEffect | undefined
    if (renderReactiveFactory) {
      renderEffect = createComponentRenderEffect(state, renderSubtree)
    } else {
      renderSubtree()
      if (instance.host.__rue_component_render_reactive__ === true) {
        renderEffect = createComponentRenderEffect(state, renderSubtree)
      }
    }
    instance.isMounted = true
    record = componentRecord(state, input, instance, subtree, renderEffect)
    return record
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
  const preserveUncontrolledTextControl = (() => {
    const containsActiveControl = state.adapter
      ? Reflect.get(state.adapter, 'hasActiveUncontrolledTextControlWithin')
      : undefined
    if (typeof containsActiveControl !== 'function') return false
    const roots = mounted.fragmentNodes.length
      ? mounted.fragmentNodes
      : mounted.host
        ? [mounted.host]
        : []
    return roots.some(root => Reflect.apply(containsActiveControl, state.adapter, [root]) === true)
  })()

  if (preserveUncontrolledTextControl) {
    state.components.update(mounted.instance, input)
    mounted.type = input.type.component
    mounted.key = input.key
    return mounted
  }

  if (mounted.renderEffect) {
    state.components.update(mounted.instance, input)
    mounted.renderEffect?.rerender()
    mounted.type = input.type.component
    mounted.key = input.key
    return mounted
  }

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
