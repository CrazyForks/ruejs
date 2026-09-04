/**
 * Rue's incremental reactive dependency graph.
 *
 * The topology algorithm is based in part on alien-signals-rs, distributed
 * under the MIT license. Rue keeps the shared dependency/subscriber link idea,
 * ordered link reuse, propagation flags, and lazy computed validation while
 * adapting them to garbage-collected TypeScript data structures.
 *
 * Each link belongs to two ordered lists: the dependencies read by one
 * subscriber and the subscribers attached to one dependency. A tracking pass
 * reuses the unchanged prefix and removes the unread tail. Nodes and links use
 * generational handles so a released slot can be reused without making an old
 * handle point at the replacement.
 */

const MUTABLE = 1 << 0
const WATCHING = 1 << 1
const RECURSED_CHECK = 1 << 2
const RECURSED = 1 << 3
const DIRTY = 1 << 4
const PENDING = 1 << 5

type Flags = number

export interface ReactiveNodeId {
  readonly index: number
  readonly generation: number
}

interface LinkId {
  readonly index: number
  readonly generation: number
}

export interface TrackingState {
  readonly previous: ReactiveNodeId | undefined
}

type NodeKind =
  | { readonly type: 'dependency' }
  | { readonly type: 'computed'; effectId: number | undefined }
  | { readonly type: 'effect'; readonly effectId: number }

interface GraphNode {
  kind: NodeKind
  flags: Flags
  valueVersion: number
  dependenciesHead: LinkId | undefined
  dependenciesTail: LinkId | undefined
  subscribersHead: LinkId | undefined
  subscribersTail: LinkId | undefined
}

interface Link {
  cycle: number
  observedVersion: number
  dependency: ReactiveNodeId
  subscriber: ReactiveNodeId
  previousDependency: LinkId | undefined
  nextDependency: LinkId | undefined
  previousSubscriber: LinkId | undefined
  nextSubscriber: LinkId | undefined
}

interface GenerationalId {
  readonly index: number
  readonly generation: number
}

interface ArenaSlot<T> {
  generation: number
  value: T | undefined
}

class Arena<T, TId extends GenerationalId> {
  readonly #slots: ArenaSlot<T>[] = []
  readonly #freeIndices: number[] = []
  #size = 0

  constructor(private readonly makeId: (index: number, generation: number) => TId) {}

  get size(): number {
    return this.#size
  }

  insert(value: T): TId {
    const freeIndex = this.#freeIndices.pop()
    if (freeIndex !== undefined) {
      const slot = this.#slots[freeIndex]
      if (slot === undefined) throw new Error('reactive graph arena free list is corrupt')
      slot.value = value
      this.#size += 1
      return this.makeId(freeIndex, slot.generation)
    }

    const index = this.#slots.length
    this.#slots.push({ generation: 0, value })
    this.#size += 1
    return this.makeId(index, 0)
  }

  get(id: TId): T | undefined {
    const slot = this.#slots[id.index]
    if (slot === undefined || slot.generation !== id.generation) return undefined
    return slot.value
  }

  remove(id: TId): T | undefined {
    const slot = this.#slots[id.index]
    if (slot === undefined || slot.generation !== id.generation || slot.value === undefined) {
      return undefined
    }

    const value = slot.value
    slot.value = undefined
    slot.generation = nextGeneration(slot.generation)
    this.#freeIndices.push(id.index)
    this.#size -= 1
    return value
  }
}

const nextGeneration = (generation: number): number => (generation + 1) >>> 0

const nextCycle = (cycle: number): number => (cycle >= Number.MAX_SAFE_INTEGER ? 0 : cycle + 1)

const hasFlags = (flags: Flags, expected: Flags): boolean => (flags & expected) !== 0

const removeFlags = (flags: Flags, removed: Flags): Flags => flags & ~removed

const sameId = (left: GenerationalId, right: GenerationalId): boolean =>
  left.index === right.index && left.generation === right.generation

const initialFlags = (kind: NodeKind): Flags => {
  switch (kind.type) {
    case 'dependency':
      return MUTABLE
    case 'computed':
      return MUTABLE | DIRTY
    case 'effect':
      return WATCHING
  }
}

export type PendingComputedEffect = readonly [node: ReactiveNodeId, effectId: number]

/**
 * A topology-only graph. Values, user callbacks, scopes, and scheduling queues
 * belong to higher runtime layers; this class only returns stable effect ids.
 */
export class ReactiveGraph {
  readonly #nodes = new Arena<GraphNode, ReactiveNodeId>((index, generation) => ({
    index,
    generation,
  }))

  readonly #links = new Arena<Link, LinkId>((index, generation) => ({ index, generation }))

  #cycle = 0
  #activeSubscriber: ReactiveNodeId | undefined

  get linkCount(): number {
    return this.#links.size
  }

  createDependencyNode(): ReactiveNodeId {
    return this.#addNode({ type: 'dependency' })
  }

  createComputedNode(effectId?: number): ReactiveNodeId {
    return this.#addNode({ type: 'computed', effectId })
  }

  createEffectNode(effectId: number): ReactiveNodeId {
    return this.#addNode({ type: 'effect', effectId })
  }

  contains(id: ReactiveNodeId): boolean {
    return this.#node(id) !== undefined
  }

  beginTracking(subscriber: ReactiveNodeId): TrackingState | undefined {
    const node = this.#node(subscriber)
    if (node === undefined) return undefined

    this.#cycle = nextCycle(this.#cycle)
    const previous = this.#activeSubscriber
    node.dependenciesTail = undefined
    node.flags |= RECURSED_CHECK
    if (node.kind.type === 'effect') node.flags |= WATCHING
    this.#activeSubscriber = subscriber
    return { previous }
  }

  endTracking(subscriber: ReactiveNodeId, state: TrackingState): void {
    const node = this.#node(subscriber)
    if (node !== undefined) {
      this.#purgeStaleDependencies(subscriber)
      node.flags = removeFlags(node.flags, RECURSED_CHECK | RECURSED | PENDING)
      if (node.kind.type === 'effect') node.flags |= WATCHING
    }

    this.#activeSubscriber =
      state.previous !== undefined && this.contains(state.previous) ? state.previous : undefined
  }

  trackDependency(dependency: ReactiveNodeId): boolean {
    const subscriber = this.#activeSubscriber
    if (
      subscriber === undefined ||
      sameId(dependency, subscriber) ||
      !this.contains(dependency) ||
      !this.contains(subscriber)
    ) {
      return false
    }

    this.#link(dependency, subscriber, this.#cycle)
    return true
  }

  /** Connects nodes without changing the active tracking context. */
  connect(dependency: ReactiveNodeId, subscriber: ReactiveNodeId): boolean {
    if (
      sameId(dependency, subscriber) ||
      !this.contains(dependency) ||
      !this.contains(subscriber)
    ) {
      return false
    }

    this.#cycle = nextCycle(this.#cycle)
    this.#link(dependency, subscriber, this.#cycle)
    return true
  }

  /**
   * Iteratively marks downstream nodes pending. PENDING and WATCHING provide
   * diamond and repeated-root deduplication without coupling the graph to a
   * scheduler implementation.
   */
  propagate(dependency: ReactiveNodeId): number[] {
    if (!this.contains(dependency)) return []

    const queue: ReactiveNodeId[] = [dependency]
    const effects: number[] = []
    let queueIndex = 0

    while (queueIndex < queue.length) {
      const currentDependency = queue[queueIndex]
      queueIndex += 1
      if (currentDependency === undefined) break

      let linkId = this.#node(currentDependency)?.subscribersHead
      while (linkId !== undefined) {
        const edge = this.#linkById(linkId)
        if (edge === undefined) break
        linkId = edge.nextSubscriber

        const subscriber = this.#node(edge.subscriber)
        if (subscriber === undefined || hasFlags(subscriber.flags, DIRTY | PENDING)) continue

        subscriber.flags |= PENDING
        switch (subscriber.kind.type) {
          case 'dependency':
            break
          case 'computed':
            queue.push(edge.subscriber)
            break
          case 'effect':
            if (hasFlags(subscriber.flags, WATCHING)) {
              subscriber.flags = removeFlags(subscriber.flags, WATCHING)
              effects.push(subscriber.kind.effectId)
            }
            break
        }
      }
    }

    return effects
  }

  triggerDependency(id: ReactiveNodeId): number[] {
    const node = this.#node(id)
    if (node === undefined) return []
    node.valueVersion = nextCycle(node.valueVersion)
    return this.propagate(id)
  }

  bindComputedNode(id: ReactiveNodeId, effectId: number): boolean {
    const node = this.#node(id)
    if (node === undefined) return false
    node.kind = { type: 'computed', effectId }
    node.flags |= MUTABLE | DIRTY
    return true
  }

  invalidateComputed(id: ReactiveNodeId): number[] {
    const node = this.#node(id)
    if (node === undefined) return []
    node.flags |= DIRTY
    return this.propagate(id)
  }

  nodeNeedsUpdate(id: ReactiveNodeId): boolean {
    const node = this.#node(id)
    return node !== undefined && hasFlags(node.flags, DIRTY | PENDING)
  }

  commitComputed(id: ReactiveNodeId, changed: boolean): void {
    const node = this.#node(id)
    if (node !== undefined && changed) node.valueVersion = nextCycle(node.valueVersion)
    this.markNodeClean(id)
  }

  markNodeClean(id: ReactiveNodeId): void {
    const node = this.#node(id)
    if (node === undefined) return
    node.flags = removeFlags(node.flags, DIRTY | PENDING | RECURSED)
    if (node.kind.type === 'effect') node.flags |= WATCHING
  }

  /**
   * Returns dirty computed dependencies in upstream-first postorder. The
   * explicit stack keeps long chains off the JavaScript call stack; RECURSED
   * remains set for the whole walk so shared diamond branches appear once.
   */
  pendingComputedEffects(subscriber: ReactiveNodeId): PendingComputedEffect[] {
    const output: PendingComputedEffect[] = []
    const visited: ReactiveNodeId[] = []
    const stack: Array<readonly [ReactiveNodeId, boolean]> = []

    let linkId = this.#node(subscriber)?.dependenciesTail
    while (linkId !== undefined) {
      const edge = this.#linkById(linkId)
      if (edge === undefined) break
      stack.push([edge.dependency, false])
      linkId = edge.previousDependency
    }

    while (stack.length > 0) {
      const entry = stack.pop()
      if (entry === undefined) break
      const [nodeId, expanded] = entry
      const node = this.#node(nodeId)
      if (
        node === undefined ||
        node.kind.type !== 'computed' ||
        !hasFlags(node.flags, DIRTY | PENDING)
      ) {
        continue
      }

      if (expanded) {
        if (node.kind.effectId !== undefined) output.push([nodeId, node.kind.effectId])
        continue
      }
      if (hasFlags(node.flags, RECURSED)) continue

      node.flags |= RECURSED
      visited.push(nodeId)
      stack.push([nodeId, true])

      let dependencyLinkId = node.dependenciesTail
      while (dependencyLinkId !== undefined) {
        const edge = this.#linkById(dependencyLinkId)
        if (edge === undefined) break
        stack.push([edge.dependency, false])
        dependencyLinkId = edge.previousDependency
      }
    }

    for (const nodeId of visited) {
      const node = this.#node(nodeId)
      if (node !== undefined) node.flags = removeFlags(node.flags, RECURSED)
    }
    return output
  }

  /**
   * PENDING means an upstream computed may have changed. Comparing each link's
   * observed version after computed validation avoids running a consumer when
   * every cached output stayed equal.
   */
  subscriberNeedsRun(subscriber: ReactiveNodeId): boolean {
    const node = this.#node(subscriber)
    if (node === undefined) return false
    if (!hasFlags(node.flags, DIRTY | PENDING)) return true

    let linkId = node.dependenciesHead
    while (linkId !== undefined) {
      const edge = this.#linkById(linkId)
      if (edge === undefined) break
      const dependency = this.#node(edge.dependency)
      if (dependency !== undefined && dependency.valueVersion !== edge.observedVersion) return true
      linkId = edge.nextDependency
    }
    return false
  }

  removeNode(id: ReactiveNodeId): boolean {
    if (!this.contains(id)) return false

    let node = this.#node(id)
    while (node?.dependenciesHead !== undefined) {
      this.#unlink(node.dependenciesHead)
      node = this.#node(id)
    }
    while (node?.subscribersHead !== undefined) {
      this.#unlink(node.subscribersHead)
      node = this.#node(id)
    }

    if (this.#activeSubscriber !== undefined && sameId(this.#activeSubscriber, id)) {
      this.#activeSubscriber = undefined
    }
    return this.#nodes.remove(id) !== undefined
  }

  dependenciesOf(subscriber: ReactiveNodeId): ReactiveNodeId[] {
    const dependencies: ReactiveNodeId[] = []
    let linkId = this.#node(subscriber)?.dependenciesHead
    while (linkId !== undefined) {
      const edge = this.#linkById(linkId)
      if (edge === undefined) break
      dependencies.push(edge.dependency)
      linkId = edge.nextDependency
    }
    return dependencies
  }

  subscriberCount(dependency: ReactiveNodeId): number {
    let count = 0
    let linkId = this.#node(dependency)?.subscribersHead
    while (linkId !== undefined) {
      const edge = this.#linkById(linkId)
      if (edge === undefined) break
      count += 1
      linkId = edge.nextSubscriber
    }
    return count
  }

  valueVersionOf(id: ReactiveNodeId): number | undefined {
    return this.#node(id)?.valueVersion
  }

  #addNode(kind: NodeKind): ReactiveNodeId {
    return this.#nodes.insert({
      kind,
      flags: initialFlags(kind),
      valueVersion: 0,
      dependenciesHead: undefined,
      dependenciesTail: undefined,
      subscribersHead: undefined,
      subscribersTail: undefined,
    })
  }

  #node(id: ReactiveNodeId): GraphNode | undefined {
    return this.#nodes.get(id)
  }

  #linkById(id: LinkId): Link | undefined {
    return this.#links.get(id)
  }

  #link(dependency: ReactiveNodeId, subscriber: ReactiveNodeId, cycle: number): void {
    const subscriberNode = this.#node(subscriber)
    const dependencyNode = this.#node(dependency)
    if (subscriberNode === undefined || dependencyNode === undefined) return

    // dependenciesTail is the current tracking cursor. Consecutive reads and
    // repeated non-consecutive reads in one pass never allocate duplicate links.
    const previousDependency = subscriberNode.dependenciesTail
    const previousEdge =
      previousDependency === undefined ? undefined : this.#linkById(previousDependency)
    if (previousEdge !== undefined && sameId(previousEdge.dependency, dependency)) return
    if (this.#wasTrackedInCycle(subscriberNode, dependency, cycle)) return

    const nextDependency =
      previousEdge === undefined ? subscriberNode.dependenciesHead : previousEdge.nextDependency
    const nextEdge = nextDependency === undefined ? undefined : this.#linkById(nextDependency)

    // The common path preserves the existing read order and only refreshes the
    // observed value version for this collection pass.
    if (nextEdge !== undefined && sameId(nextEdge.dependency, dependency)) {
      nextEdge.cycle = cycle
      nextEdge.observedVersion = dependencyNode.valueVersion
      subscriberNode.dependenciesTail = nextDependency
      return
    }

    const previousSubscriber = dependencyNode.subscribersTail
    const linkId = this.#links.insert({
      cycle,
      observedVersion: dependencyNode.valueVersion,
      dependency,
      subscriber,
      previousDependency,
      nextDependency,
      previousSubscriber,
      nextSubscriber: undefined,
    })

    dependencyNode.subscribersTail = linkId
    if (dependencyNode.subscribersHead === undefined) dependencyNode.subscribersHead = linkId
    subscriberNode.dependenciesTail = linkId
    if (previousDependency === undefined) subscriberNode.dependenciesHead = linkId

    if (previousEdge !== undefined) previousEdge.nextDependency = linkId
    if (nextEdge !== undefined) nextEdge.previousDependency = linkId
    if (previousSubscriber !== undefined) {
      const previousSubscriberEdge = this.#linkById(previousSubscriber)
      if (previousSubscriberEdge !== undefined) previousSubscriberEdge.nextSubscriber = linkId
    }
  }

  #wasTrackedInCycle(node: GraphNode, dependency: ReactiveNodeId, cycle: number): boolean {
    let linkId = node.dependenciesHead
    while (linkId !== undefined) {
      const edge = this.#linkById(linkId)
      if (edge === undefined) break
      if (edge.cycle === cycle && sameId(edge.dependency, dependency)) return true
      linkId = edge.nextDependency
    }
    return false
  }

  #purgeStaleDependencies(subscriber: ReactiveNodeId): void {
    const node = this.#node(subscriber)
    if (node === undefined) return

    let linkId =
      node.dependenciesTail === undefined
        ? node.dependenciesHead
        : this.#linkById(node.dependenciesTail)?.nextDependency
    const staleLinks: LinkId[] = []
    while (linkId !== undefined) {
      staleLinks.push(linkId)
      linkId = this.#linkById(linkId)?.nextDependency
    }
    for (let index = staleLinks.length - 1; index >= 0; index -= 1) {
      const staleLink = staleLinks[index]
      if (staleLink !== undefined) this.#unlink(staleLink)
    }
  }

  #unlink(linkId: LinkId): void {
    const edge = this.#linkById(linkId)
    if (edge === undefined) return

    const previousDependency =
      edge.previousDependency === undefined ? undefined : this.#linkById(edge.previousDependency)
    const nextDependency =
      edge.nextDependency === undefined ? undefined : this.#linkById(edge.nextDependency)
    const subscriber = this.#node(edge.subscriber)

    if (previousDependency !== undefined) previousDependency.nextDependency = edge.nextDependency
    else if (subscriber !== undefined) subscriber.dependenciesHead = edge.nextDependency
    if (nextDependency !== undefined) nextDependency.previousDependency = edge.previousDependency
    else if (subscriber !== undefined) subscriber.dependenciesTail = edge.previousDependency

    const previousSubscriber =
      edge.previousSubscriber === undefined ? undefined : this.#linkById(edge.previousSubscriber)
    const nextSubscriber =
      edge.nextSubscriber === undefined ? undefined : this.#linkById(edge.nextSubscriber)
    const dependency = this.#node(edge.dependency)

    if (previousSubscriber !== undefined) previousSubscriber.nextSubscriber = edge.nextSubscriber
    else if (dependency !== undefined) dependency.subscribersHead = edge.nextSubscriber
    if (nextSubscriber !== undefined) nextSubscriber.previousSubscriber = edge.previousSubscriber
    else if (dependency !== undefined) dependency.subscribersTail = edge.previousSubscriber

    this.#links.remove(linkId)
  }
}
