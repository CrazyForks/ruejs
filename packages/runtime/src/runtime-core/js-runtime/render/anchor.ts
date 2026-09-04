import { replaceMountedBefore } from '../patch/replace.js'
import type { MountController, MountInput, RenderRuntimeState } from '../types.js'
import {
  compactAnchorMounts,
  hostForRender,
  insertMountedBefore,
  removeMounted,
  resolveBoundaryParent,
} from './helpers.js'

/** Render one tracked mount immediately before a stable anchor node. */
export const renderAnchor = <HostNode>(
  state: RenderRuntimeState<HostNode>,
  controller: MountController<HostNode>,
  input: MountInput<HostNode> | null | undefined,
  parent: HostNode,
  anchor: HostNode,
): void => {
  const host = hostForRender(state)
  if (!host) return
  const destParent = resolveBoundaryParent(host, parent, [['anchor', anchor]], 'renderAnchor')
  const ownedMounts = state.ownedMounts
  const ownedEntries = ownedMounts?.currentAnchorEntries()
  if (!ownedEntries) compactAnchorMounts(state, host, destParent)
  let entry = ownedEntries
    ? ownedEntries.find(candidate => candidate.anchor === anchor)
    : state.anchorMounts.get(anchor)

  if (!input) {
    if (entry) {
      removeMounted(host, destParent, entry.mounted)
      entry.mounted = undefined
    }
    return
  }

  if (entry) {
    if (ownedEntries && ownedMounts) {
      ownedMounts.prepareAnchorUpdate(anchor)
      entry = ownedEntries[0]!
    }
    entry.mounted = replaceMountedBefore(
      state,
      host,
      controller,
      entry.mounted,
      input,
      destParent,
      anchor,
    )
    return
  }

  const mounted = controller.mountInput(state, host, input, parent)
  if (!mounted) return
  insertMountedBefore(host, destParent, mounted, anchor)
  const nextEntry = { anchor, mounted }
  if (ownedEntries) ownedEntries.push(nextEntry)
  else state.anchorMounts.set(anchor, nextEntry)
}
