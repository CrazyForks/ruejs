import {
  RUE_CLEANUP_BUCKET_KEY,
  RUE_MOUNT_ID_KEY,
  RUE_PORTABLE_COMPONENT_TYPE_KEY,
  RUE_PORTABLE_VAPOR_SETUP_KEY,
  RUE_STABLE_COMPONENT_HOST_KEY,
} from '../protocol.js'
import { createElementMountInput, normalizeMountInput } from './mount-input.js'
import type {
  ComponentInstanceManager,
  ComponentMountInput,
  ComponentProps,
  LifecycleController,
  MountInput,
  Mounted,
  ObjectLike,
  PendingComponentLifecycle,
  RuntimeState,
} from './types.js'

/*
组件真实挂载

负责创建组件实例、建立 propsRO、切换当前实例上下文、执行 render 函数，
并把组件返回值继续挂载成子树。最后将子树包成 Patch snapshot，供后续组件 patch 复用。
*/

type ComponentRuntimeState<HostNode> = RuntimeState<HostNode> & {
  components: ComponentInstanceManager<HostNode>
  lifecycle: LifecycleController
}

const RUE_ELEMENT_HEAD_RECORD = Symbol.for('rue.element.head-record')
const TEXT_HEAD_RECORD = Symbol.for('text.head.record')

interface ElementHeadRecord {
  [TEXT_HEAD_RECORD]: true
  props?: Record<string, unknown> | null
  type: string
}

const readNativeElementHeadRecord = (value: unknown): ElementHeadRecord | undefined => {
  if ((typeof value !== 'object' && typeof value !== 'function') || value == null) return undefined
  const head = Reflect.get(value, RUE_ELEMENT_HEAD_RECORD)
  if ((typeof head !== 'object' && typeof head !== 'function') || head == null) return undefined
  if (Reflect.get(head, TEXT_HEAD_RECORD) !== true) return undefined
  const type = Reflect.get(head, 'type')
  // Custom elements still require the high-level Vapor setup to inject their context owner.
  if (typeof type !== 'string' || type === 'fragment' || type.includes('-')) return undefined
  return head as ElementHeadRecord
}

const disposeUnusedMountInput = <HostNode>(
  state: RuntimeState<HostNode>,
  input: MountInput<HostNode> | null,
): void => {
  const bucket = input?.mountCleanupBucket
  if (Array.isArray(bucket)) {
    for (const cleanup of bucket.splice(0)) {
      if (typeof cleanup === 'function') cleanup()
    }
  }
  const scopeId = input?.mountEffectScopeId
  if (scopeId !== undefined) {
    state.kernel.disposeEffectScope(scopeId)
    state.effectScopeIds.delete(scopeId)
  }
}

const disposeUnusedVaporHandle = <HostNode>(
  state: RuntimeState<HostNode>,
  value: unknown,
): void => {
  if ((typeof value !== 'object' && typeof value !== 'function') || value == null) return
  const input = normalizeMountInput(state, value, 'render')
  disposeUnusedMountInput(state, input)
  const bucket = Reflect.get(value, RUE_CLEANUP_BUCKET_KEY)
  if (!Array.isArray(bucket)) return
  for (const cleanup of bucket.splice(0)) {
    if (typeof cleanup === 'function') cleanup()
  }
}

const isStructuredMountChild = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.every(isStructuredMountChild)
  if (
    value == null ||
    typeof value === 'boolean' ||
    typeof value === 'string' ||
    typeof value === 'number'
  ) {
    return true
  }
  if (typeof value !== 'object' && typeof value !== 'function') return false
  return (
    Reflect.has(value, RUE_MOUNT_ID_KEY) ||
    Reflect.has(value, RUE_PORTABLE_COMPONENT_TYPE_KEY) ||
    Reflect.has(value, RUE_PORTABLE_VAPOR_SETUP_KEY)
  )
}

const createStableNativeElementInput = <HostNode>(
  state: RuntimeState<HostNode>,
  value: unknown,
  descendantDepth: number,
): MountInput<HostNode> | undefined => {
  const nativeRoot = readNativeElementHeadRecord(value)
  if (!nativeRoot) return undefined
  // Island descriptors, DOM nodes, and other high-level renderables must be adapted before they
  // reach the strict MountInput protocol, so keep those roots on the established Vapor path.
  if (!isStructuredMountChild(nativeRoot.props?.children)) return undefined
  const props: ComponentProps = {
    ...nativeRoot.props,
    [RUE_STABLE_COMPONENT_HOST_KEY]: true,
  }
  disposeUnusedVaporHandle(state, value)
  const input = createElementMountInput(state, nativeRoot.type, props, props.children, {
    normalizeObjectChild:
      descendantDepth > 0
        ? child =>
            createStableNativeElementInput(state, child, descendantDepth - 1) ??
            normalizeMountInput(state, child, 'render')
        : undefined,
  })
  return input
}

interface LifecycleOrderNode extends ObjectLike {
  contains?: (other: unknown) => boolean
  compareDocumentPosition?: (other: unknown) => number
}

const lifecycleOrderNode = (value: unknown): LifecycleOrderNode | undefined =>
  (typeof value === 'object' || typeof value === 'function') && value != null
    ? (value as LifecycleOrderNode)
    : undefined

const normalizeComponentResult = <HostNode>(
  state: RuntimeState<HostNode>,
  value: unknown,
): MountInput<HostNode> | null => {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number') {
    return {
      type: { kind: 'text', value: String(value) },
      props: {},
      children: [],
      key: undefined,
      mountCleanupBucket: undefined,
      mountEffectScopeId: undefined,
      elHint: undefined,
      strictComponentReturns: false,
    }
  }
  // Preserve the component host and two native descendant levels. This covers wrapper/panel
  // identity boundaries without recursively changing replacement semantics for the full DOM.
  const nativeRoot = createStableNativeElementInput(state, value, 2)
  if (nativeRoot) return nativeRoot
  return normalizeMountInput(state, value, 'render')
}

/** Execute one component render inside its stable Hook carrier and normalize its subtree. */
export const renderComponent = <HostNode>(
  state: ComponentRuntimeState<HostNode>,
  instance: Parameters<ComponentInstanceManager<HostNode>['render']>[0],
  input: ComponentMountInput<HostNode>,
  mountSubtree: (input: MountInput<HostNode> | null) => Mounted<HostNode> | undefined,
): Mounted<HostNode> | undefined =>
  state.components.render(instance, input, props => {
    const updating = instance.isMounted
    if (updating) state.lifecycle.call(instance.host, 'before_update')
    const value = input.type.component(props)
    if (!updating) {
      state.lifecycle.call(instance.host, 'before_create')
      state.lifecycle.call(instance.host, 'created')
      state.lifecycle.call(instance.host, 'before_mount')
    }
    const subtree = mountSubtree(normalizeComponentResult(state, value))
    const pendingLifecycle =
      state.ownedMounts?.currentLifecycleEntries?.() ?? state.pendingComponentLifecycle
    pendingLifecycle.push({
      instance,
      name: updating ? 'updated' : 'mounted',
      subtree,
    })
    return subtree
  })

const lifecycleNode = <HostNode>({
  subtree,
}: PendingComponentLifecycle<HostNode>): LifecycleOrderNode | undefined =>
  lifecycleOrderNode(subtree?.fragmentNodes?.[0] ?? subtree?.host)

const orderPendingLifecycle = <HostNode>(
  pending: PendingComponentLifecycle<HostNode>[],
): PendingComponentLifecycle<HostNode>[] =>
  pending
    .map((entry, index) => ({ entry, index, node: lifecycleNode(entry) }))
    .sort((left, right) => {
      if (left.node === right.node) return left.index - right.index
      if (!left.node || !right.node) return left.index - right.index
      if (typeof left.node.contains === 'function' && left.node.contains(right.node)) return 1
      if (typeof right.node.contains === 'function' && right.node.contains(left.node)) return -1
      if (typeof left.node.compareDocumentPosition !== 'function') return left.index - right.index
      const position = left.node.compareDocumentPosition(right.node)
      if (position & 4) return -1
      if (position & 2) return 1
      return left.index - right.index
    })
    .map(({ entry }) => entry)

export const flushPendingComponentLifecycle = <HostNode>(
  state: ComponentRuntimeState<HostNode>,
): void => {
  while (state.pendingComponentLifecycle.length > 0) {
    const pending = orderPendingLifecycle(state.pendingComponentLifecycle.splice(0))
    for (const { instance, name } of pending) {
      if (!state.components.has(instance)) continue
      state.components.withCurrent(instance, () => {
        state.lifecycle.call(instance.host, name)
      })
    }
  }
}
