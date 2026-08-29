import { ReactiveGraph, type ReactiveNodeId } from './graph.js'
import { ReactiveRuntimeState, type ReactiveSchedulingMode } from './runtime-state.js'
import { ReactiveScheduler } from './scheduler.js'
import { EffectScopeManager, type EffectScopeId } from './scope.js'

export type EffectCleanup = () => void
export type EffectCallback = () => unknown
export type EffectScheduler = (runner: () => void) => void

export interface EffectOptions {
  readonly lazy?: boolean
  readonly scheduler?: EffectScheduler
  readonly watcher?: boolean
}

export interface ReactiveEffectRuntimeOptions {
  readonly onErrorCaptured?: (error: unknown, owner: unknown, info: string) => boolean
  readonly onRenderTriggered?: (
    effectId: number,
    event: ReactiveTriggerEvent,
    owner: unknown,
  ) => void
  readonly warn?: (message: string) => void
}

export interface ReactiveTriggerEvent {
  readonly effect?: number
  readonly key: unknown
  readonly newValue: unknown
  readonly oldValue: unknown
  readonly path: readonly PropertyKey[]
  readonly target: unknown
  readonly type: 'set'
}

export interface ComputedEffectBinding {
  beginEvaluation(): boolean
  commit(value: unknown): boolean
  abort(): void
}

interface EffectRecord {
  readonly callback: EffectCallback
  readonly computed: ComputedEffectBinding | undefined
  readonly id: number
  readonly node: ReactiveNodeId
  readonly runner: () => void
  readonly scheduler: EffectScheduler | undefined
  readonly scopeDisposer: EffectCleanup
  readonly scopeId: EffectScopeId | undefined
  readonly watcher: boolean
  cleanups: EffectCleanup[]
  owner: unknown
}

const warnByDefault = (message: string): void => console.warn(message)

/**
 * Public lifetime handle backed by an instance-owned effect record.
 *
 * A scheduled runner only retains the numeric id. Disposing first removes that
 * record and its graph node, so delayed custom/default scheduler callbacks are
 * harmless and repeated disposal stays idempotent.
 */
export class EffectHandle {
  constructor(
    private readonly runtime: ReactiveEffectRuntime,
    readonly id: number,
  ) {}

  dispose(): void {
    this.runtime.disposeEffect(this.id)
  }

  free(): void {
    this.dispose()
  }

  [Symbol.dispose](): void {
    this.dispose()
  }
}

/**
 * Effect execution layer shared by Signal and Computed instances.
 *
 * The graph remains topology-only. This runtime owns callbacks and lifetimes,
 * validates dirty computed dependencies before consumers, and hands runnable
 * ids to the scheduler. Cleanup and tracking contexts are restored in finally
 * blocks so nested effects and thrown callbacks cannot corrupt their parent.
 * Each rerun first executes the previous cleanup; disposal removes queued work
 * and performs the final cleanup exactly once. Custom schedulers receive an
 * idempotent runner rather than ownership of the effect record.
 */
export class ReactiveEffectRuntime {
  readonly state: ReactiveRuntimeState
  readonly graph: ReactiveGraph
  readonly scheduler: ReactiveScheduler
  readonly scopes: EffectScopeManager

  readonly #effects = new Map<number, EffectRecord>()
  readonly #onErrorCaptured: ReactiveEffectRuntimeOptions['onErrorCaptured']
  readonly #onRenderTriggered: ReactiveEffectRuntimeOptions['onRenderTriggered']
  readonly #warn: (message: string) => void
  readonly #watcherHandlerEffectIds: number[] = []

  constructor(options: ReactiveEffectRuntimeOptions = {}) {
    this.state = new ReactiveRuntimeState()
    this.graph = new ReactiveGraph()
    this.scheduler = new ReactiveScheduler(this.state)
    this.#onErrorCaptured = options.onErrorCaptured
    this.#onRenderTriggered = options.onRenderTriggered
    this.#warn = options.warn ?? warnByDefault
    this.scopes = new EffectScopeManager(this.state, this.#warn)
  }

  get currentEffectId(): number | undefined {
    return this.state.currentEffectId
  }

  setScheduling(mode: ReactiveSchedulingMode): void {
    this.state.schedulingMode = mode
  }

  beginRenderDebugOwner(owner: unknown): void {
    this.state.pushRenderDebugOwner(owner)
  }

  endRenderDebugOwner(): unknown {
    return this.state.popRenderDebugOwner()
  }

  createEffect(callback: EffectCallback, options: EffectOptions = {}): EffectHandle {
    const id = this.state.allocateEffectId()
    const node = this.graph.createEffectNode(id)
    const handle = this.#insertEffect(id, node, callback, options, undefined)

    if (!options.lazy) {
      const record = this.#effects.get(id)
      if (record?.scheduler !== undefined) record.scheduler(record.runner)
      else this.runEffect(id)
    }
    return handle
  }

  createComputedEffect(
    node: ReactiveNodeId,
    callback: EffectCallback,
    binding: ComputedEffectBinding,
  ): EffectHandle {
    const id = this.state.allocateEffectId()
    this.graph.bindComputedNode(node, id)
    return this.#insertEffect(id, node, callback, { lazy: true }, binding)
  }

  runEffect(id: number): void {
    const record = this.#effects.get(id)
    if (record === undefined) return

    if (record.computed !== undefined) {
      if (this.graph.nodeNeedsUpdate(record.node)) this.#runComputed(record)
      return
    }

    for (const [computedNode, computedId] of this.graph.pendingComputedEffects(record.node)) {
      const computedRecord = this.#effects.get(computedId)
      if (computedRecord?.computed !== undefined) this.#runComputed(computedRecord)
      else this.graph.markNodeClean(computedNode)
    }

    if (!this.graph.subscriberNeedsRun(record.node)) {
      this.graph.markNodeClean(record.node)
      return
    }

    try {
      this.#runEffectBody(record)
    } catch (error) {
      if (!this.#captureError(record, error)) throw error
    }
  }

  disposeEffect(id: number): boolean {
    const record = this.#effects.get(id)
    if (record === undefined) return false

    this.#effects.delete(id)
    this.scheduler.cancel(id)
    this.scopes.unregisterEffectDisposer(record.scopeDisposer, record.scopeId)
    this.graph.removeNode(record.node)
    const cleanups = record.cleanups
    record.cleanups = []
    this.#runCleanups(cleanups)
    return true
  }

  isEffectActive(id: number): boolean {
    return this.#effects.has(id)
  }

  onCleanup(cleanup: EffectCleanup): boolean {
    const id = this.state.currentEffectId
    if (id === undefined) return false
    const record = this.#effects.get(id)
    if (record === undefined) return false
    record.cleanups.push(cleanup)
    return true
  }

  onWatcherCleanup(cleanup: EffectCleanup, failSilently = false): boolean {
    // Watch handlers run untracked, but their synchronous cleanup registrations
    // still belong to the watcher that invoked them.
    const id =
      this.state.currentEffectId ??
      this.#watcherHandlerEffectIds[this.#watcherHandlerEffectIds.length - 1]
    const record = id === undefined ? undefined : this.#effects.get(id)
    if (record?.watcher) {
      record.cleanups.push(cleanup)
      return true
    }

    if (!failSilently) {
      this.#warn('onWatcherCleanup() is called when there is no active watcher.')
    }
    return false
  }

  runWatcherHandler<T>(id: number, callback: () => T): T {
    if (!this.#effects.get(id)?.watcher) return this.untrack(callback)
    const stackIndex = this.#watcherHandlerEffectIds.length
    this.#watcherHandlerEffectIds.push(id)
    try {
      return this.untrack(callback)
    } finally {
      this.#watcherHandlerEffectIds.splice(stackIndex, 1)
    }
  }

  untrack<T>(callback: () => T): T {
    return this.state.runUntracked(callback)
  }

  batch<T>(callback: () => T): T {
    return this.scheduler.batch(callback)
  }

  nextTick(): Promise<void>
  nextTick<T>(callback: () => T | PromiseLike<T>): Promise<T>
  nextTick<T>(callback?: () => T | PromiseLike<T>): Promise<T | void> {
    return callback === undefined ? this.scheduler.nextTick() : this.scheduler.nextTick(callback)
  }

  trackDependency(node: ReactiveNodeId): boolean {
    const effectId = this.state.currentEffectId
    if (effectId === undefined || !this.#effects.has(effectId)) return false
    const owner = this.state.currentRenderDebugOwner
    const record = this.#effects.get(effectId)
    if (record !== undefined && owner !== undefined) record.owner = owner
    return this.graph.trackDependency(node)
  }

  triggerDependency(node: ReactiveNodeId, event?: ReactiveTriggerEvent): void {
    this.#scheduleEffects(this.graph.triggerDependency(node), event)
  }

  triggerDependencies(nodes: Iterable<ReactiveNodeId>, event?: ReactiveTriggerEvent): void {
    const effectIds = new Set<number>()
    for (const node of nodes) {
      for (const effectId of this.graph.triggerDependency(node)) effectIds.add(effectId)
    }
    this.#scheduleEffects([...effectIds], event)
  }

  invalidateComputed(node: ReactiveNodeId, event?: ReactiveTriggerEvent): void {
    this.#scheduleEffects(this.graph.invalidateComputed(node), event)
  }

  removeReactiveNode(node: ReactiveNodeId): boolean {
    return this.graph.removeNode(node)
  }

  allocateSignalId(): number {
    return this.state.allocateSignalId()
  }

  #insertEffect(
    id: number,
    node: ReactiveNodeId,
    callback: EffectCallback,
    options: EffectOptions,
    computed: ComputedEffectBinding | undefined,
  ): EffectHandle {
    const scopeId = this.scopes.current
    const runner = (): void => this.runEffect(id)
    const scopeDisposer = (): void => {
      this.disposeEffect(id)
    }
    const record: EffectRecord = {
      callback,
      cleanups: [],
      computed,
      id,
      node,
      owner: this.state.currentRenderDebugOwner,
      runner,
      scheduler: options.scheduler,
      scopeDisposer,
      scopeId,
      watcher: options.watcher === true,
    }
    this.#effects.set(id, record)
    this.scopes.registerEffectDisposer(scopeDisposer, scopeId)
    return new EffectHandle(this, id)
  }

  #runComputed(record: EffectRecord): void {
    const binding = record.computed
    if (binding === undefined || !binding.beginEvaluation()) return

    try {
      const value = this.#runEffectBody(record)
      this.graph.commitComputed(record.node, binding.commit(value))
    } catch (error) {
      binding.abort()
      this.#captureError(record, error)
      this.graph.commitComputed(record.node, binding.commit(undefined))
    }
  }

  #runEffectBody(record: EffectRecord): unknown {
    const cleanups = record.cleanups
    record.cleanups = []
    this.#runCleanups(cleanups)

    const tracking = this.graph.beginTracking(record.node)
    if (tracking === undefined) return undefined
    try {
      return this.state.runWithEffect(record.id, () => {
        if (record.scopeId === undefined) return record.callback()
        return this.scopes.run(record.scopeId, record.callback)
      })
    } finally {
      this.graph.endTracking(record.node, tracking)
    }
  }

  #scheduleEffects(effectIds: readonly number[], event?: ReactiveTriggerEvent): void {
    for (const id of effectIds) {
      const record = this.#effects.get(id)
      if (record === undefined) continue

      if (record.computed !== undefined) {
        this.invalidateComputed(record.node, event)
        continue
      }

      if (event !== undefined) {
        this.#onRenderTriggered?.(
          id,
          {
            ...event,
            effect: id,
          },
          record.owner,
        )
      }

      if (record.scheduler !== undefined) {
        this.scheduler.cancel(id)
        record.scheduler(record.runner)
        // A custom scheduler is a notification boundary and may omit its runner.
        // Re-arm the graph so a later source change can notify it again.
        this.graph.markNodeClean(record.node)
      } else {
        this.scheduler.schedule(id, record.runner, () => this.#effects.has(id))
      }
    }
  }

  #captureError(record: EffectRecord, error: unknown): boolean {
    if (this.#onErrorCaptured === undefined) return false
    return this.state.runWithErrorCaptureEffect(
      record.id,
      () => this.#onErrorCaptured?.(error, record.owner, 'reactive effect') === true,
    )
  }

  #runCleanups(cleanups: readonly EffectCleanup[]): void {
    for (const cleanup of cleanups) {
      try {
        cleanup()
      } catch {
        // A failed cleanup must not retain later cleanup callbacks or the effect.
      }
    }
  }
}

export const createEffect = (
  runtime: ReactiveEffectRuntime,
  callback: EffectCallback,
  options?: EffectOptions | null,
): EffectHandle => runtime.createEffect(callback, options ?? {})

export const onCleanup = (runtime: ReactiveEffectRuntime, cleanup: EffectCleanup): void => {
  runtime.onCleanup(cleanup)
}

export const onWatcherCleanup = (
  runtime: ReactiveEffectRuntime,
  cleanup: EffectCleanup,
  failSilently = false,
): void => {
  runtime.onWatcherCleanup(cleanup, failSilently)
}

export const untrack = <T>(runtime: ReactiveEffectRuntime, callback: () => T): T =>
  runtime.untrack(callback)

export const batch = <T>(runtime: ReactiveEffectRuntime, callback: () => T): T =>
  runtime.batch(callback)
