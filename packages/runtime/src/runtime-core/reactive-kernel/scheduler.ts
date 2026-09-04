import type { ReactiveRuntimeState } from './runtime-state.js'

export type SchedulerJobId = number
export type SchedulerJobRunner = () => void

interface SchedulerJob {
  readonly id: SchedulerJobId
  readonly isActive: () => boolean
  readonly run: SchedulerJobRunner
}

const alwaysActive = (): boolean => true

/**
 * Ordered callback scheduler for one reactive runtime instance.
 *
 * Pending jobs are keyed by effect id so a flush round preserves first-in
 * order while deduplicating repeated notifications. A drain takes the current
 * round before running callbacks; jobs created by those callbacks therefore
 * form a follow-up round, and flush waiters resolve only after every round is
 * empty. Frame scheduling prefers the browser clock but retains a short guard
 * and can always be progressed by nextTick.
 */
export class ReactiveScheduler {
  readonly #pending = new Map<SchedulerJobId, SchedulerJob>()
  #drainScheduled = false
  #frameGeneration = 0
  #flushing = false
  #flushWaiters: Array<() => void> = []

  constructor(private readonly state: ReactiveRuntimeState) {}

  get pendingCount(): number {
    return this.#pending.size
  }

  get isFlushPending(): boolean {
    return (
      this.#flushing ||
      this.#drainScheduled ||
      (this.state.batchDepth > 0 && this.#pending.size > 0)
    )
  }

  schedule(
    id: SchedulerJobId,
    run: SchedulerJobRunner,
    isActive: () => boolean = alwaysActive,
  ): boolean {
    if (!isActive()) return false

    if (this.state.batchDepth > 0) return this.#enqueue({ id, isActive, run })

    if (this.state.schedulingMode === 'sync') {
      if (
        this.state.isScheduledJobActive(id) ||
        this.state.isEffectActive(id) ||
        this.state.isErrorCaptureEffect(id)
      ) {
        const inserted = this.#enqueue({ id, isActive, run })
        this.#scheduleMicrotaskDrain()
        return inserted
      }

      this.#runJob({ id, isActive, run })
      return true
    }

    const inserted = this.#enqueue({ id, isActive, run })
    this.#scheduleDefaultDrain()
    return inserted
  }

  cancel(id: SchedulerJobId): boolean {
    return this.#pending.delete(id)
  }

  batch<T>(callback: () => T): T {
    this.state.beginBatch()
    try {
      return callback()
    } finally {
      if (this.state.endBatch()) this.#leaveOutermostBatch()
    }
  }

  nextTick(): Promise<void>
  nextTick<T>(callback: () => T | PromiseLike<T>): Promise<T>
  nextTick<T>(callback?: () => T | PromiseLike<T>): Promise<T | void> {
    let pendingFlush: Promise<void>
    if (this.isFlushPending) {
      pendingFlush = new Promise(resolve => this.#flushWaiters.push(resolve))
      // A stale or throttled frame callback must not make nextTick wait forever.
      Promise.resolve().then(() => this.#drain())
    } else {
      pendingFlush = Promise.resolve()
    }

    return callback === undefined ? pendingFlush : pendingFlush.then(callback)
  }

  #enqueue(job: SchedulerJob): boolean {
    if (this.#pending.has(job.id)) return false
    this.#pending.set(job.id, job)
    return true
  }

  #leaveOutermostBatch(): void {
    if (this.#pending.size === 0) return
    if (this.state.schedulingMode === 'sync') this.#drain()
    else this.#scheduleDefaultDrain()
  }

  #scheduleDefaultDrain(): void {
    if (this.#drainScheduled) return
    if (this.state.schedulingMode === 'frame') this.#scheduleFrameDrain()
    else this.#scheduleMicrotaskDrain()
  }

  #scheduleMicrotaskDrain(): void {
    if (this.#drainScheduled) return
    this.#drainScheduled = true
    Promise.resolve().then(() => this.#drain())
  }

  #scheduleFrameDrain(): void {
    const host = typeof window === 'undefined' ? globalThis : window
    const requestFrame = Reflect.get(host, 'requestAnimationFrame')
    if (typeof requestFrame !== 'function') {
      this.#scheduleMicrotaskDrain()
      return
    }

    this.#drainScheduled = true
    const generation = ++this.#frameGeneration
    let didDrain = false
    const drainOnce = (): void => {
      if (didDrain || generation !== this.#frameGeneration) return
      didDrain = true
      this.#drain()
    }

    Reflect.apply(requestFrame, host, [drainOnce])
    const setTimeout = Reflect.get(host, 'setTimeout')
    if (typeof setTimeout === 'function') Reflect.apply(setTimeout, host, [drainOnce, 34])
  }

  #drain(): void {
    this.#frameGeneration += 1
    this.#drainScheduled = false
    if (this.#pending.size === 0) {
      if (this.#flushing || this.#flushWaiters.length > 0) this.#finishFlush()
      return
    }

    this.#flushing = true
    const jobs = [...this.#pending.values()]
    this.#pending.clear()
    let firstError: unknown
    for (const job of jobs) {
      try {
        this.#runJob(job)
      } catch (error) {
        firstError ??= error
      }
    }

    if (this.#pending.size > 0) this.#scheduleDefaultDrain()
    else this.#finishFlush()

    if (firstError !== undefined) throw firstError
  }

  #runJob(job: SchedulerJob): void {
    if (!job.isActive()) return
    this.state.runScheduledJob(job.id, job.run)
  }

  #finishFlush(): void {
    this.#flushing = false
    const waiters = this.#flushWaiters
    this.#flushWaiters = []
    for (const resolve of waiters) resolve()
  }
}
