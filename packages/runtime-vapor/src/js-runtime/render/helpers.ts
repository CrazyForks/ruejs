import { createHost } from '../host.js'
import { isObjectLike } from '../types.js'
import type { DOMHost, Mounted, RangeMountState, RuntimeEntry, RuntimeState } from '../types.js'

type RenderBoundary<HostNode> = readonly [label: string, node: HostNode]

const RUE_KEEP_ALIVE_RANGE_KEY = '__rue_keep_alive_range__'

const renderError = (detail: string): Error => new Error(`Rue runtime: ${detail}`)

export const hostForRender = <HostNode>(
  state: RuntimeState<HostNode>,
): DOMHost<HostNode> | undefined => createHost<HostNode>(state.adapter)

const requireNode = (value: unknown, label: string): void => {
  if ((typeof value !== 'object' && typeof value !== 'function') || value == null) {
    throw renderError(`${label} node is required`)
  }
}

export const resolveBoundaryParent = <HostNode>(
  host: DOMHost<HostNode>,
  parent: HostNode,
  boundaries: readonly [RenderBoundary<HostNode>, ...RenderBoundary<HostNode>[]],
  entry: RuntimeEntry,
): HostNode => {
  requireNode(parent, `${entry} parent`)
  for (const [label, boundary] of boundaries) {
    requireNode(boundary, `${entry} ${label}`)
  }

  const boundaryParents = boundaries.map(([, boundary]) => host.getParentNode(boundary))
  const actualParent = boundaryParents.find(Boolean)
  if (!actualParent) {
    throw renderError(`${entry} boundary is detached`)
  }
  if (boundaryParents.some(boundaryParent => boundaryParent !== actualParent)) {
    throw renderError(`${entry} boundaries do not share a parent`)
  }
  if (parent !== actualParent && !host.contains(parent, boundaries[0][1])) {
    throw renderError(`${entry} boundary moved outside its parent`)
  }
  return actualParent
}

export const mountedNodes = <HostNode>(
  mounted: Mounted<HostNode> | null | undefined,
): HostNode[] => {
  if (!mounted) return []
  if (mounted.kind === 'fragment' || mounted.fragmentNodes?.length) {
    return mounted.fragmentNodes ?? []
  }
  const singleHost = mounted.host ? [mounted.host] : []
  switch (mounted.kind) {
    case 'text':
    case 'element':
    case 'component':
    case 'vapor':
      return singleHost
    default:
      return exhaustiveMounted(mounted, singleHost)
  }
}

const exhaustiveMounted = <Value>(_mounted: never, fallback: Value): Value => fallback

export const removeMounted = <HostNode>(
  host: DOMHost<HostNode>,
  parent: HostNode,
  mounted: Mounted<HostNode> | null | undefined,
): void => {
  mounted?.dispose?.()
  for (const node of mountedNodes(mounted)) {
    if (host.getParentNode(node) === parent && host.contains(parent, node)) {
      host.removeChild(parent, node)
    }
  }
}

export const insertMountedBefore = <HostNode>(
  host: DOMHost<HostNode>,
  parent: HostNode,
  mounted: Mounted<HostNode> | null | undefined,
  before: HostNode,
): void => {
  if (!mounted) return
  if (mounted.kind === 'fragment') {
    for (const node of mounted.fragmentNodes ?? host.collectFragmentChildren(mounted.host)) {
      host.insertBefore(parent, node, before)
    }
    return
  }
  if (mounted.host) host.insertBefore(parent, mounted.host, before)
}

const readHostProperty = <HostNode>(node: HostNode, key: PropertyKey): unknown =>
  isObjectLike(node) ? Reflect.get(node, key) : undefined

const nextHostSibling = <HostNode>(node: HostNode): HostNode | null =>
  (readHostProperty(node, 'nextSibling') as HostNode | null | undefined) ?? null

export const clearBetween = <HostNode>(
  host: DOMHost<HostNode>,
  parent: HostNode,
  start: HostNode,
  end: HostNode,
): void => {
  let current = nextHostSibling(start)
  let reachedEnd = false
  while (current) {
    if (current === end) {
      reachedEnd = true
      break
    }
    const next = nextHostSibling(current)
    if (host.getParentNode(current) === parent && host.contains(parent, current)) {
      host.removeChild(parent, current)
    }
    current = next
  }
  if (!reachedEnd) {
    throw renderError('renderBetween end boundary does not follow start boundary')
  }
}

const entryBelongsTo = <HostNode>(
  host: DOMHost<HostNode>,
  container: HostNode,
  entry: RangeMountState<HostNode>,
  boundaryName: 'start',
): boolean => {
  const boundary = entry[boundaryName]
  return boundary === container || host.contains(container, boundary)
}

export const dropRenderEntriesWithin = <HostNode>(
  state: RuntimeState<HostNode>,
  container: HostNode,
): void => {
  const host = hostForRender(state)
  if (!host) return
  for (const [anchor, entry] of state.anchorMounts) {
    if (anchor === container || host.contains(container, anchor)) {
      state.anchorMounts.delete(anchor)
      const mounted = entry.mounted
      entry.mounted = undefined
      const parent = host.getParentNode(anchor)
      if (parent) removeMounted(host, parent, mounted)
      else mounted?.dispose?.()
    }
  }
  for (const [start, entry] of state.rangeMounts) {
    if (entryBelongsTo(host, container, entry, 'start')) {
      state.rangeMounts.delete(start)
      const mounted = entry.mounted
      entry.mounted = undefined
      const parent = host.getParentNode(entry.end) ?? host.getParentNode(entry.start)
      if (parent) removeMounted(host, parent, mounted)
      else mounted?.dispose?.()
    }
  }
}

/** Drop detached global ranges unless they belong to the detached root currently rendering. */
export const compactRangeMounts = <HostNode>(
  state: RuntimeState<HostNode>,
  host: DOMHost<HostNode>,
  currentParent: HostNode,
): void => {
  if (state.renderDepth > 1) return
  for (const [start, entry] of state.rangeMounts) {
    if (readHostProperty(start, RUE_KEEP_ALIVE_RANGE_KEY) === true) continue
    if (readHostProperty(start, 'isConnected') === true) continue
    const entryParent = host.getParentNode(start)
    const sharesDetachedRoot =
      entryParent &&
      (entryParent === currentParent ||
        host.contains(entryParent, currentParent) ||
        host.contains(currentParent, start) ||
        belongsToSameDetachedRoot(host, entryParent, currentParent))
    if (!sharesDetachedRoot) {
      state.rangeMounts.delete(start)
      entry.mounted = undefined
    }
  }
}

const resolveDetachedRoot = <HostNode>(host: DOMHost<HostNode>, node: HostNode): HostNode => {
  let current = node
  const seen = new Set<HostNode>()
  while (!seen.has(current)) {
    seen.add(current)
    const parent = host.getParentNode(current)
    if (!parent) return current
    current = parent
  }
  return current
}

function belongsToSameDetachedRoot<HostNode>(
  host: DOMHost<HostNode>,
  entryParent: HostNode | null | undefined,
  currentParent: HostNode,
): boolean {
  return (
    !!entryParent &&
    resolveDetachedRoot(host, entryParent) === resolveDetachedRoot(host, currentParent)
  )
}

/** Drop detached global anchors unless they belong to the detached root currently rendering. */
export const compactAnchorMounts = <HostNode>(
  state: RuntimeState<HostNode>,
  host: DOMHost<HostNode>,
  currentParent: HostNode,
): void => {
  if (state.renderDepth > 1) return
  for (const [anchor, entry] of state.anchorMounts) {
    if (readHostProperty(anchor, RUE_KEEP_ALIVE_RANGE_KEY) === true) continue
    if (readHostProperty(anchor, 'isConnected') === true) continue
    const entryParent = host.getParentNode(anchor)
    const sharesDetachedRoot =
      entryParent &&
      (entryParent === currentParent ||
        host.contains(entryParent, currentParent) ||
        host.contains(currentParent, anchor) ||
        belongsToSameDetachedRoot(host, entryParent, currentParent))
    if (!sharesDetachedRoot) {
      state.anchorMounts.delete(anchor)
      entry.mounted = undefined
    }
  }
}

/** Update the public fragment-node ref through a defensive copy. */
export const syncStaticFragmentNodes = <HostNode>(parent: HostNode, nodes: HostNode[]): void => {
  const source = readHostProperty(parent, '__rue_frag_nodes_ref')
  if (!Array.isArray(source)) return
  const copy = Array.from(source)
  copy.splice(0, copy.length, ...nodes)
}
