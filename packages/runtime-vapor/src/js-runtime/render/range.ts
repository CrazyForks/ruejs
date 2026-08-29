import { mountInput } from '../mount.js'
import { replaceMountedBefore } from '../patch/replace.js'
import { isObjectLike } from '../types.js'
import type { DOMHost, Mounted, MountInput, RenderRuntimeState } from '../types.js'
import {
  clearBetween,
  compactRangeMounts,
  hostForRender,
  insertMountedBefore,
  removeMounted,
  resolveBoundaryParent,
} from './helpers.js'

/** Render one tracked mount between a start/end boundary pair. */
export const renderBetween = <HostNode>(
  state: RenderRuntimeState<HostNode>,
  input: MountInput<HostNode> | null | undefined,
  parent: HostNode,
  start: HostNode,
  end: HostNode,
): void => {
  const host = hostForRender(state)
  if (!host) return
  const destParent = resolveBoundaryParent(
    host,
    parent,
    [
      ['start', start],
      ['end', end],
    ],
    'renderBetween',
  )
  const ownedEntries = state.ownedMounts?.currentRangeEntries()
  if (!ownedEntries) compactRangeMounts(state, host, destParent)
  const entry = ownedEntries
    ? ownedEntries.find(candidate => candidate.start === start)
    : state.rangeMounts.get(start)

  if (!input) {
    if (entry) {
      removeMounted(host, destParent, entry.mounted)
      entry.end = end
      entry.mounted = undefined
    }
    clearBetween(host, destParent, start, end)
    return
  }

  if (entry) {
    entry.end = end
    entry.mounted = replaceMountedBefore(state, host, entry.mounted, input, destParent, end)
    clearBetweenExceptMounted(host, destParent, start, end, entry.mounted)
    return
  }

  const mounted = mountInput(state, host, input, parent)
  if (!mounted) return
  clearBetween(host, destParent, start, end)
  insertMountedBefore(host, destParent, mounted, end)
  const nextEntry = { start, end, mounted }
  if (ownedEntries) ownedEntries.push(nextEntry)
  else state.rangeMounts.set(start, nextEntry)
}

const nextHostSibling = <HostNode>(node: HostNode): HostNode | null =>
  isObjectLike(node)
    ? ((Reflect.get(node, 'nextSibling') as HostNode | null | undefined) ?? null)
    : null

const clearBetweenExceptMounted = <HostNode>(
  host: DOMHost<HostNode>,
  parent: HostNode,
  start: HostNode,
  end: HostNode,
  mounted: Mounted<HostNode> | undefined,
): void => {
  const retainedNodes = !mounted
    ? []
    : mounted.kind === 'fragment' || mounted.fragmentNodes?.length
      ? (mounted.fragmentNodes ?? [])
      : mounted.host
        ? [mounted.host]
        : []
  const retained = new Set<HostNode>(retainedNodes)
  let current = nextHostSibling(start)
  let reachedEnd = false
  while (current) {
    if (current === end) {
      reachedEnd = true
      break
    }
    const next = nextHostSibling(current)
    if (!retained.has(current) && host.getParentNode(current) === parent) {
      host.removeChild(parent, current)
    }
    current = next
  }
  if (!reachedEnd) {
    throw new Error('Rue runtime: renderBetween end boundary does not follow start boundary')
  }
}
