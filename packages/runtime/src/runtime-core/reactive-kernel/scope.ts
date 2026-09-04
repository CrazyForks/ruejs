import type { ReactiveRuntimeState } from './runtime-state.js'

export type EffectScopeId = number
export type ScopeCleanup = () => void

interface EffectScopeRecord {
  readonly children: Set<EffectScopeId>
  readonly cleanups: ScopeCleanup[]
  readonly effectDisposers: ScopeCleanup[]
  readonly parent: EffectScopeId | undefined
}

type ScopeWarningHandler = (message: string) => void

const warnByDefault: ScopeWarningHandler = message => console.warn(message)

/**
 * Parent-owned effect scopes for one reactive runtime instance.
 *
 * Attached scopes belong to the current scope; detached scopes are roots.
 * Disposal removes ownership first, then recursively stops children, effect
 * disposers, and user cleanups in registration order. Removing records before
 * callbacks makes repeated or re-entrant disposal idempotent.
 */
export class EffectScopeManager {
  readonly #scopes = new Map<EffectScopeId, EffectScopeRecord>()

  constructor(
    private readonly state: ReactiveRuntimeState,
    private readonly warn: ScopeWarningHandler = warnByDefault,
  ) {}

  get current(): EffectScopeId | undefined {
    const current = this.state.currentScopeId
    return current !== undefined && this.#scopes.has(current) ? current : undefined
  }

  create(detached = false): EffectScopeId {
    const id = this.state.allocateScopeId()
    const parent = detached ? undefined : this.current
    this.#scopes.set(id, {
      children: new Set(),
      cleanups: [],
      effectDisposers: [],
      parent,
    })
    if (parent !== undefined) this.#scopes.get(parent)?.children.add(id)
    return id
  }

  isActive(scopeId: EffectScopeId): boolean {
    return this.#scopes.has(scopeId)
  }

  push(scopeId: EffectScopeId): boolean {
    if (!this.#scopes.has(scopeId)) return false
    this.state.pushScope(scopeId)
    return true
  }

  pop(): EffectScopeId | undefined {
    return this.state.popScope()
  }

  run<T>(scopeId: EffectScopeId, callback: () => T): T | undefined {
    if (!this.#scopes.has(scopeId)) return undefined
    return this.state.runWithScope(scopeId, callback)
  }

  bind<TArgs extends unknown[], TResult>(
    scopeId: EffectScopeId,
    runner: (...args: TArgs) => TResult,
  ): (...args: TArgs) => TResult | undefined {
    return (...args) => this.run(scopeId, () => runner(...args))
  }

  registerEffectDisposer(
    disposer: ScopeCleanup,
    scopeId: EffectScopeId | undefined = this.current,
  ): boolean {
    if (scopeId === undefined) return false
    const scope = this.#scopes.get(scopeId)
    if (scope === undefined) return false
    scope.effectDisposers.push(disposer)
    return true
  }

  unregisterEffectDisposer(
    disposer: ScopeCleanup,
    scopeId: EffectScopeId | undefined = this.current,
  ): boolean {
    if (scopeId === undefined) return false
    const disposers = this.#scopes.get(scopeId)?.effectDisposers
    const index = disposers?.indexOf(disposer) ?? -1
    if (disposers === undefined || index < 0) return false
    disposers.splice(index, 1)
    return true
  }

  onScopeDispose(cleanup: ScopeCleanup, failSilently = false): boolean {
    const scopeId = this.current
    if (scopeId === undefined) {
      if (!failSilently) {
        this.warn('onScopeDispose() is called when there is no active effect scope.')
      }
      return false
    }

    const scope = this.#scopes.get(scopeId)
    if (scope === undefined) return false
    scope.cleanups.push(cleanup)
    return true
  }

  dispose(scopeId: EffectScopeId): boolean {
    const scope = this.#scopes.get(scopeId)
    if (scope === undefined) return false

    this.#scopes.delete(scopeId)
    this.state.removeScope(scopeId)
    if (scope.parent !== undefined) this.#scopes.get(scope.parent)?.children.delete(scopeId)

    for (const child of scope.children) this.dispose(child)
    for (const disposer of scope.effectDisposers) this.#callSafely(disposer)
    for (const cleanup of scope.cleanups) this.#callSafely(cleanup)
    return true
  }

  #callSafely(callback: ScopeCleanup): void {
    try {
      callback()
    } catch {
      // Scope disposal mirrors the existing kernel: one failing cleanup must not
      // retain the remaining effects, children, or user cleanup callbacks.
    }
  }
}
