import { insertMountedBefore } from '../render/helpers.js'
import { patchMountedInput } from '../mount.js'
import { patchText } from './text.js'
import type { DOMHost, Mounted, MountInput, RenderRuntimeState } from '../types.js'

/** Patch a text root in place or replace a mounted root at one stable DOM boundary. */
export const replaceMountedBefore = <HostNode>(
  state: RenderRuntimeState<HostNode>,
  host: DOMHost<HostNode>,
  previous: Mounted<HostNode> | undefined,
  input: MountInput<HostNode>,
  parent: HostNode,
  before: HostNode,
): Mounted<HostNode> | undefined => {
  if (previous?.kind === 'text' && input?.type?.kind === 'text') {
    return patchText(host, previous, input)
  }

  const mounted = patchMountedInput(state, host, previous, input, parent)
  insertMountedBefore(host, parent, mounted, before)
  return mounted
}
