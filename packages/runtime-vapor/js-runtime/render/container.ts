import { createHost } from '../host.js'
import { mountInput, patchMountedInput } from '../mount.js'
import type { DOMHost, Mounted, MountInput, RenderRuntimeState, RuntimeState } from '../types.js'

const clearContainer = <HostNode>(
  host: DOMHost<HostNode>,
  state: RuntimeState<HostNode>,
  container: HostNode,
): void => {
  state.containerMounts.get(container)?.dispose?.()
  host.setInnerHTML(container, '')
  state.containerMounts.delete(container)
}

const commitMountedContainer = <HostNode>(
  host: DOMHost<HostNode>,
  container: HostNode,
  mounted: Mounted<HostNode> | null | undefined,
): void => {
  if (!mounted?.host) {
    host.setInnerHTML(container, '')
    return
  }
  const fragment = host.isFragment(mounted.host)
  host.setInnerHTML(container, '')
  if (fragment) {
    for (const child of mounted.fragmentNodes ?? host.collectFragmentChildren(mounted.host)) {
      host.appendChild(container, child)
    }
  } else {
    host.appendChild(container, mounted.host)
  }
}

/** Render one normalized basic MountInput into a tracked host container. */
export const renderContainer = <HostNode>(
  state: RenderRuntimeState<HostNode>,
  input: MountInput<HostNode> | null | undefined,
  container: HostNode,
): void => {
  const host = createHost<HostNode>(state.adapter)
  if (!host) return

  if (!input) {
    clearContainer(host, state, container)
    return
  }

  const previous = state.containerMounts.get(container)
  if (previous) {
    const mounted = patchMountedInput(state, host, previous, input, container)
    if (mounted) commitMountedContainer(host, container, mounted)
    if (mounted) state.containerMounts.set(container, mounted)
    return
  }

  const mounted = mountInput(state, host, input, container)
  if (!mounted) return

  commitMountedContainer(host, container, mounted)
  state.containerMounts.set(container, mounted)
}

/** Clear a mounted container through the injected adapter. */
export const unmountContainer = <HostNode>(
  state: RuntimeState<HostNode>,
  container: HostNode,
): void => {
  const host = createHost<HostNode>(state.adapter)
  if (host) clearContainer(host, state, container)
  else state.containerMounts.delete(container)
}
