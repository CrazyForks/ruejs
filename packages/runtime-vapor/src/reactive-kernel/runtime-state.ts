/**
 * Instance-owned execution state shared by the TypeScript reactive kernel.
 *
 * Runtime context is stack-shaped: nested effects, untracked handlers, scopes,
 * and scheduler jobs must always restore their caller, including when user code
 * throws. Queues and ownership records live in their respective instance
 * modules; this object only coordinates context that crosses those modules.
 */

export type ReactiveSchedulingMode = 'sync' | 'microtask' | 'frame'

export class ReactiveRuntimeState {
  #schedulingMode: ReactiveSchedulingMode = 'frame'
  #batchDepth = 0
  #nextEffectId = 1
  #nextSignalId = 1
  #nextScopeId = 1
  #currentEffectId: number | undefined
  #activeEffectIds: number[] = []
  #activeJobIds: number[] = []
  #errorCaptureEffectIds: number[] = []
  #renderDebugOwnerStack: unknown[] = []
  #scopeStack: number[] = []

  get schedulingMode(): ReactiveSchedulingMode {
    return this.#schedulingMode
  }

  set schedulingMode(mode: ReactiveSchedulingMode) {
    this.#schedulingMode = mode
  }

  get batchDepth(): number {
    return this.#batchDepth
  }

  get currentEffectId(): number | undefined {
    return this.#currentEffectId
  }

  get currentScopeId(): number | undefined {
    return this.#scopeStack[this.#scopeStack.length - 1]
  }

  get currentRenderDebugOwner(): unknown {
    return this.#renderDebugOwnerStack[this.#renderDebugOwnerStack.length - 1]
  }

  beginBatch(): void {
    this.#batchDepth += 1
  }

  endBatch(): boolean {
    if (this.#batchDepth === 0) throw new Error('reactive batch stack underflow')
    this.#batchDepth -= 1
    return this.#batchDepth === 0
  }

  allocateScopeId(): number {
    const id = this.#nextScopeId
    this.#nextScopeId += 1
    return id
  }

  allocateEffectId(): number {
    const id = this.#nextEffectId
    this.#nextEffectId += 1
    return id
  }

  allocateSignalId(): number {
    const id = this.#nextSignalId
    this.#nextSignalId += 1
    return id
  }

  isEffectActive(effectId: number): boolean {
    return this.#activeEffectIds.includes(effectId)
  }

  isScheduledJobActive(jobId: number): boolean {
    return this.#activeJobIds.includes(jobId)
  }

  isErrorCaptureEffect(effectId: number): boolean {
    return this.#errorCaptureEffectIds.includes(effectId)
  }

  runWithEffect<T>(effectId: number, callback: () => T): T {
    const previous = this.#currentEffectId
    const stackIndex = this.#activeEffectIds.length
    this.#currentEffectId = effectId
    this.#activeEffectIds.push(effectId)
    try {
      return callback()
    } finally {
      this.#activeEffectIds.splice(stackIndex, 1)
      this.#currentEffectId = previous
    }
  }

  runUntracked<T>(callback: () => T): T {
    const previous = this.#currentEffectId
    this.#currentEffectId = undefined
    try {
      return callback()
    } finally {
      this.#currentEffectId = previous
    }
  }

  runWithErrorCaptureEffect<T>(effectId: number, callback: () => T): T {
    const stackIndex = this.#errorCaptureEffectIds.length
    this.#errorCaptureEffectIds.push(effectId)
    try {
      return callback()
    } finally {
      this.#errorCaptureEffectIds.splice(stackIndex, 1)
    }
  }

  runScheduledJob<T>(jobId: number, callback: () => T): T {
    const stackIndex = this.#activeJobIds.length
    this.#activeJobIds.push(jobId)
    try {
      return callback()
    } finally {
      this.#activeJobIds.splice(stackIndex, 1)
    }
  }

  pushScope(scopeId: number): void {
    this.#scopeStack.push(scopeId)
  }

  popScope(): number | undefined {
    return this.#scopeStack.pop()
  }

  removeScope(scopeId: number): void {
    this.#scopeStack = this.#scopeStack.filter(activeId => activeId !== scopeId)
  }

  pushRenderDebugOwner(owner: unknown): void {
    this.#renderDebugOwnerStack.push(owner)
  }

  popRenderDebugOwner(): unknown {
    return this.#renderDebugOwnerStack.pop()
  }

  runWithScope<T>(scopeId: number, callback: () => T): T {
    const stackIndex = this.#scopeStack.length
    this.#scopeStack.push(scopeId)
    try {
      return callback()
    } finally {
      if (this.#scopeStack[stackIndex] === scopeId) this.#scopeStack.splice(stackIndex, 1)
    }
  }
}
