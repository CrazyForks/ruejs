import {
  __rueCurrentEffectId,
  batch as runtimeBatch,
  computed as runtimeComputed,
  createEffect,
  effectScope,
  onCleanup as registerEffectCleanup,
  onScopeDispose,
  setReactiveScheduling as setRuntimeScheduling,
  signal as runtimeSignal,
  untrack as runtimeUntrack,
  watchEffect as runtimeWatchEffect,
  type EffectScope,
} from '../runtime-core/reactive'
import {
  isCompiledEffectFrozen,
  resolveCompiledHookId,
  withCompiledHookRun,
} from '../runtime-context'

export type ReactiveSchedulingMode = 'sync' | 'microtask' | 'frame' | 'async'
export type EffectCleanup = () => void
export type EffectCallback = () => unknown
export type EffectScheduler = (runner: () => void) => void

export interface EffectOptions {
  readonly lazy?: boolean
  readonly scheduler?: EffectScheduler
}

export interface SignalOptions<T> {
  readonly equals?: (previous: T, next: T) => boolean
}

export interface CompiledSignalHandle<T> {
  readonly __rue_signal_id__?: number
  value: T
  get(): T
  peek(): T
  set(next: T): void
  update(updater: (current: T) => T): void
  trigger(): void
  dispose(): void
  free(): void
  [Symbol.dispose](): void
}

export interface EffectHandle {
  readonly id?: number
  dispose(): void
  free(): void
  [Symbol.dispose](): void
}

export type CompiledLifecyclePhase =
  | 'beforeMount'
  | 'mounted'
  | 'beforeUpdate'
  | 'updated'
  | 'activated'
  | 'deactivated'
  | 'beforeUnmount'
  | 'unmounted'

type OwnerRecord = {
  scope: EffectScope
  parent: CompiledOwner | undefined
  children: Set<CompiledOwner>
  setupValues: Map<string, unknown>
  values: Map<PropertyKey, unknown>
  lifecycle: Record<CompiledLifecyclePhase, EffectCleanup[]>
  disposed: boolean
}

export type CompiledOwner = object

let currentOwner: CompiledOwner | undefined
let ownerDisposalDepth = 0
const effectCleanupCollectors: EffectCleanup[][] = []
const owners = new WeakMap<CompiledOwner, OwnerRecord>()
const pendingRootLifecycle: Record<CompiledLifecyclePhase, EffectCleanup[]> = {
  beforeMount: [],
  mounted: [],
  beforeUpdate: [],
  updated: [],
  activated: [],
  deactivated: [],
  beforeUnmount: [],
  unmounted: [],
}

const lifecycleRecord = (): Record<CompiledLifecyclePhase, EffectCleanup[]> =>
  Object.fromEntries(
    Object.entries(pendingRootLifecycle).map(([phase, callbacks]) => {
      const claimed = [...callbacks]
      callbacks.length = 0
      return [phase, claimed]
    }),
  ) as Record<CompiledLifecyclePhase, EffectCleanup[]>

export const setReactiveScheduling = (mode: ReactiveSchedulingMode): void => {
  setRuntimeScheduling(mode)
}

export const batch = <T>(callback: () => T): T => runtimeBatch(callback)

export const signal = <T>(initial: T, options?: SignalOptions<T> | null): CompiledSignalHandle<T> =>
  runtimeSignal(initial, options ?? undefined) as CompiledSignalHandle<T>

export const untrack = <T>(callback: () => T): T => runtimeUntrack(callback)

const runEffectCallback = (owner: CompiledOwner | undefined, callback: EffectCallback): void => {
  const collected: EffectCleanup[] = []
  effectCleanupCollectors.push(collected)
  try {
    const cleanup = withCompiledHookRun(
      () => (owner === undefined ? callback() : runWithOwner(owner, callback)),
      callback,
    )
    if (typeof cleanup === 'function') collected.push(cleanup as EffectCleanup)
  } catch (error) {
    const consumed =
      owner !== undefined &&
      globalThis.__rue_compiled_runtime_bridge?.dispatchErrorCaptured?.(
        error,
        owner,
        'compiled effect',
      ) === true
    if (!consumed) throw error
  } finally {
    effectCleanupCollectors.pop()
    for (const cleanup of collected) registerEffectCleanup(cleanup)
  }
}

const inertEffectHandle = (): EffectHandle => ({
  dispose() {},
  free() {},
  [Symbol.dispose]() {},
})

const runFrozenEffect = (
  owner: CompiledOwner | undefined,
  callback: EffectCallback,
): EffectHandle => {
  const cleanup = withCompiledHookRun(
    () => (owner === undefined ? callback() : runWithOwner(owner, callback)),
    callback,
  )
  if (typeof cleanup === 'function' && owner !== undefined) {
    runWithOwner(owner, () => onScopeDispose(cleanup as EffectCleanup, true))
  }
  return inertEffectHandle()
}

export const watchEffect = (
  callback: EffectCallback,
  options?: EffectOptions | null,
): EffectHandle => {
  const owner = currentOwner
  if (isCompiledEffectFrozen()) return runFrozenEffect(owner, callback)
  return runtimeWatchEffect(
    () => runEffectCallback(owner, callback),
    options ?? undefined,
  ) as EffectHandle
}

export const effect = (callback: EffectCallback, options?: EffectOptions | null): EffectHandle => {
  const owner = currentOwner
  if (isCompiledEffectFrozen()) return runFrozenEffect(owner, callback)
  return createEffect(
    () => runEffectCallback(owner, callback),
    options ?? undefined,
  ) as EffectHandle
}

export type CompiledComputedInput<T> = (() => T) | { get: () => T; set?: (value: T) => void }

export const computed = <T>(input: CompiledComputedInput<T>): CompiledSignalHandle<T> =>
  runtimeComputed(input as never) as unknown as CompiledSignalHandle<T>

type CompiledTextTarget = { textContent: string | null }

export const _$compiledText = (node: CompiledTextTarget, read: () => unknown): EffectHandle => {
  let previous: string | undefined
  return effect(() => {
    const raw = read()
    if ((typeof raw === 'object' && raw !== null) || typeof raw === 'function') {
      const renderValue = (
        globalThis as typeof globalThis & {
          __rue_render_compiled_text_value__?: (node: CompiledTextTarget, value: unknown) => void
        }
      ).__rue_render_compiled_text_value__
      if (typeof renderValue === 'function') {
        renderValue(node, raw)
        previous = undefined
        return
      }
    }
    const next = raw == null || typeof raw === 'boolean' ? '' : String(raw)
    if (Object.is(previous, next)) return
    previous = next
    node.textContent = next
  })
}

export const createOwner = (): CompiledOwner => {
  const parent = currentOwner
  const owner = {}
  const scope = effectScope(parent === undefined)
  owners.set(owner, {
    scope,
    parent,
    children: new Set(),
    setupValues: new Map(),
    values: new Map(),
    lifecycle: lifecycleRecord(),
    disposed: false,
  })
  if (parent !== undefined) owners.get(parent)?.children.add(owner)
  return owner
}

export const getCurrentOwner = (): CompiledOwner | undefined => currentOwner

export const getOwnerParent = (owner: CompiledOwner): CompiledOwner | undefined =>
  owners.get(owner)?.parent

export const isDisposingOwnerTree = (): boolean => ownerDisposalDepth > 0

export const adoptOwner = (owner: CompiledOwner, parent: CompiledOwner | undefined): void => {
  if (owner === parent) return
  const record = owners.get(owner)
  if (record === undefined || record.disposed || record.parent === parent) return
  if (record.parent !== undefined) owners.get(record.parent)?.children.delete(owner)
  record.parent = parent
  if (parent !== undefined) owners.get(parent)?.children.add(owner)
}

export const getOwnerValue = <T>(owner: CompiledOwner, key: PropertyKey): T | undefined =>
  owners.get(owner)?.values.get(key) as T | undefined

export const setOwnerValue = <T>(owner: CompiledOwner, key: PropertyKey, value: T): boolean => {
  const record = owners.get(owner)
  if (record === undefined || record.disposed) return false
  record.values.set(key, value)
  return true
}

export const runWithOwner = <T>(owner: CompiledOwner, callback: () => T): T | undefined => {
  const record = owners.get(owner)
  if (record === undefined || record.disposed) return undefined
  const previous = currentOwner
  currentOwner = owner
  try {
    return record.scope.run(callback)
  } finally {
    currentOwner = previous
  }
}

export const registerOwnerLifecycle = (
  phase: CompiledLifecyclePhase,
  callback: EffectCleanup,
): boolean => {
  if (currentOwner === undefined) {
    pendingRootLifecycle[phase].push(callback)
    return true
  }
  const record = owners.get(currentOwner)
  if (record === undefined || record.disposed) return false
  record.lifecycle[phase].push(callback)
  return true
}

export const runOwnerLifecycle = (
  owner: CompiledOwner,
  phase: Exclude<CompiledLifecyclePhase, 'beforeUnmount' | 'unmounted'>,
): void => {
  const callbacks = owners.get(owner)?.lifecycle[phase]
  if (callbacks === undefined) return
  runWithOwner(owner, () => callbacks.slice().forEach(callback => callback()))
}

export const runOwnerLifecycleTree = (
  owner: CompiledOwner,
  phase: 'activated' | 'deactivated',
): void => {
  const pending = [owner]
  const visited = new Set<CompiledOwner>()
  while (pending.length > 0) {
    const current = pending.shift()!
    if (visited.has(current)) continue
    visited.add(current)
    const record = owners.get(current)
    if (record === undefined || record.disposed) continue
    runOwnerLifecycle(current, phase)
    pending.push(...record.children)
  }
}

export const onCleanup = (cleanup: EffectCleanup): void => {
  if (__rueCurrentEffectId() !== undefined) {
    registerEffectCleanup(cleanup)
    return
  }
  if (currentOwner !== undefined) onScopeDispose(cleanup, true)
}

export const onEffectCleanup = (cleanup: EffectCleanup): void => {
  const collector = effectCleanupCollectors[effectCleanupCollectors.length - 1]
  if (collector !== undefined) {
    collector.push(cleanup)
    return
  }
  if (__rueCurrentEffectId() !== undefined) {
    registerEffectCleanup(cleanup)
    return
  }
  if (currentOwner !== undefined) onScopeDispose(cleanup, true)
}

export const onOwnerCleanup = (cleanup: EffectCleanup): void => {
  if (currentOwner !== undefined) onScopeDispose(cleanup, true)
}

export const _$compiledSetup = <T>(id: string, factory: () => T): T => {
  if (currentOwner === undefined) return factory()
  const values = owners.get(currentOwner)?.setupValues
  if (values === undefined) return factory()
  const resolvedId = resolveCompiledHookId(id)
  if (values.has(resolvedId)) return values.get(resolvedId) as T
  // Setup initializes owner-scoped state, but it can run while a component render effect is
  // active. Reads used only to construct that state must not become render dependencies.
  const value = untrack(factory)
  values.set(resolvedId, value)
  return value
}

export const disposeOwner = (owner: CompiledOwner): boolean => {
  const record = owners.get(owner)
  if (record === undefined || record.disposed) return false
  ownerDisposalDepth++
  try {
    runWithOwner(owner, () =>
      record.lifecycle.beforeUnmount.slice().forEach(callback => callback()),
    )
    record.disposed = true
    for (const child of [...record.children]) disposeOwner(child)
    record.scope.stop()
    const previous = currentOwner
    currentOwner = owner
    try {
      record.lifecycle.unmounted.slice().forEach(callback => callback())
    } finally {
      currentOwner = previous
    }
    if (record.parent !== undefined) owners.get(record.parent)?.children.delete(owner)
    return true
  } finally {
    ownerDisposalDepth--
  }
}

export type Selector<T> = (key: T) => boolean

export const createSelector = <T>(source: () => T): Selector<T> => {
  const flags = new Map<T, CompiledSignalHandle<boolean>>()
  let initialized = false
  let selected!: T
  effect(() => {
    const next = source()
    if (!initialized) {
      initialized = true
      selected = next
      return
    }
    if (Object.is(selected, next)) return
    const previous = selected
    selected = next
    batch(() => {
      flags.get(previous)?.set(false)
      flags.get(next)?.set(true)
    })
  })
  onOwnerCleanup(() => {
    for (const flag of flags.values()) flag.dispose()
    flags.clear()
  })
  return key => {
    let flag = flags.get(key)
    if (flag === undefined) {
      flag = signal(Object.is(key, selected))
      flags.set(key, flag)
    }
    return flag.get()
  }
}
