import { insertMountedBefore } from '../render/helpers.js'
import { patchText } from './text.js'
import type { DOMHost, MountController, Mounted, MountInput, RenderRuntimeState } from '../types.js'

/** Patch a text root in place or replace a mounted root at one stable DOM boundary. */
export const replaceMountedBefore = <HostNode>(
  state: RenderRuntimeState<HostNode>,
  host: DOMHost<HostNode>,
  controller: MountController<HostNode>,
  previous: Mounted<HostNode> | undefined,
  input: MountInput<HostNode>,
  parent: HostNode,
  before: HostNode,
): Mounted<HostNode> | undefined => {
  if (previous?.kind === 'text' && input?.type?.kind === 'text') {
    return patchText(host, previous, input)
  }

  const mounted = controller.patchMountedInput(state, host, previous, input, parent)
  insertMountedBefore(host, parent, mounted, before)
  return mounted
}
