import { normalizeMountInput } from './mount-input.js'
import type {
  ComponentInstanceManager,
  ComponentMountInput,
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
