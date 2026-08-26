import { mountInput } from '../mount.js'
import type { MountInput, RenderRuntimeState } from '../types.js'
import {
  hostForRender,
  insertMountedBefore,
  mountedNodes,
  resolveBoundaryParent,
  syncStaticFragmentNodes,
} from './helpers.js'

/** Mount static nodes once before a temporary anchor, then consume the anchor. */
export const renderStatic = <HostNode>(
  state: RenderRuntimeState<HostNode>,
  input: MountInput<HostNode> | null | undefined,
  parent: HostNode,
  anchor: HostNode,
): void => {
  const host = hostForRender(state)
  if (!host) return
  const destParent = resolveBoundaryParent(host, parent, [['anchor', anchor]], 'renderStatic')
  if (!input) {
    if (host.contains(destParent, anchor)) host.removeChild(destParent, anchor)
    syncStaticFragmentNodes(parent, [])
    return
  }

  const mounted = mountInput(state, host, input, parent)
  if (!mounted) return
  const nodes = mountedNodes(mounted)
  insertMountedBefore(host, destParent, mounted, anchor)
  if (host.contains(destParent, anchor)) host.removeChild(destParent, anchor)
  syncStaticFragmentNodes(parent, nodes)
}
