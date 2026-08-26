import type {
  ComponentInstance,
  ComponentProps,
  KeepAliveController,
  LifecycleController,
  Mounted,
  RuntimeState,
} from './types.js'

/*
KeepAlive 生命周期触发桥接

JS KeepAlive 负责移动缓存 DOM range；runtime 持有该 range 的 mounted snapshot，
因此由这里按 start anchor 找到子树并递归触发 activated/deactivated hooks。
*/

const visitMounted = <HostNode>(
  mounted: Mounted<HostNode> | undefined,
  visit: (instance: ComponentInstance<ComponentProps, HostNode>) => void,
): void => {
  if (!mounted) return
  if (mounted.kind === 'component') visit(mounted.instance)
  if (mounted.kind === 'component') {
    visitMounted(mounted.subtree, visit)
    return
  }
  if (mounted.kind === 'element' || mounted.kind === 'fragment') {
    for (const child of mounted.children) visitMounted(child, visit)
  }
}

/** Dispatch KeepAlive hooks for the mounted snapshot owned by a range start anchor. */
export const createKeepAliveController = <HostNode>(
  state: RuntimeState<HostNode>,
  lifecycle: LifecycleController,
): KeepAliveController<HostNode> => {
  const findMounted = (start: HostNode): Mounted<HostNode> | undefined =>
    state.rangeMounts.get(start)?.mounted ?? state.ownedMounts?.findRange(start)?.mounted

  const dispatch = (start: HostNode, name: 'activated' | 'deactivated'): void => {
    visitMounted(findMounted(start), instance => lifecycle.call(instance.host, name))
  }

  return {
    activate: start => dispatch(start, 'activated'),
    deactivate: start => dispatch(start, 'deactivated'),
  }
}
