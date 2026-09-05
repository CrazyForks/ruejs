import {
  _$compiledSetup,
  createOwner,
  disposeOwner,
  effect,
  getCurrentOwner,
  getOwnerValue,
  onCleanup,
  registerOwnerLifecycle,
  runOwnerLifecycle,
  runWithOwner,
  setOwnerValue,
  signal,
  type CompiledOwner,
  type CompiledSignalHandle,
  untrack,
} from '../reactive-core'
import type { CompiledRootHandle } from '../compiled-root'
import { isReactive, isRef, reactive } from '../compiled-reactive-compat'
import { getCurrentCompiledHookId } from '../compiled-hook-compat'
import { hasCompiledHookRun } from '../runtime-context'

void onCleanup

const COMPILED_OWNER = Symbol('rue.compiledOwner')
const COMPILED_MOUNTED = Symbol('rue.compiledMounted')

type OwnedCompiledRootHandle = CompiledRootHandle & { [COMPILED_OWNER]?: CompiledOwner }
type StateOptions<T> = {
  equals?: (previous: T, next: T) => boolean
  kind?: 'reactive' | 'ref' | 'signal'
}

const initialValue = <T>(initial: T | (() => T)): T =>
  typeof initial === 'function' ? (initial as () => T)() : initial

const setSignalState = <T>(
  state: CompiledSignalHandle<T>,
  next: T | ((state: CompiledSignalHandle<T>) => T | void),
): void => {
  if (typeof next !== 'function') return state.set(next)
  const result = (next as (state: CompiledSignalHandle<T>) => T | void)(state)
  if (result !== undefined) state.set(result)
}

const createRefState = <T>(
  state: CompiledSignalHandle<T>,
  normalize: (value: T) => T = value => value,
): CompiledSignalHandle<T> => ({
  get __rue_signal_id__() {
    return state.__rue_signal_id__
  },
  get value() {
    return state.get()
  },
  set value(next: T) {
    state.set(normalize(next))
  },
  get: () => state.get(),
  peek: () => state.peek(),
  set: next => state.set(normalize(next)),
  update: updater => state.update(current => normalize(updater(current))),
  trigger: () => state.trigger(),
  dispose: () => state.dispose(),
  free: () => state.free(),
  [Symbol.dispose]: () => state[Symbol.dispose](),
})

const createObjectState = <T extends object>(state: CompiledSignalHandle<T>): T =>
  new Proxy({} as T, {
    deleteProperty(_target, key) {
      const current = state.peek()
      const next = Array.isArray(current) ? [...current] : { ...current }
      const deleted = Reflect.deleteProperty(next, key)
      state.set(next as T)
      return deleted
    },
    get(_target, key) {
      return Reflect.get(state.get(), key)
    },
    has(_target, key) {
      return Reflect.has(state.get(), key)
    },
    ownKeys() {
      return Reflect.ownKeys(state.get())
    },
    getOwnPropertyDescriptor(_target, key) {
      const descriptor = Reflect.getOwnPropertyDescriptor(state.get(), key)
      return descriptor == null ? undefined : { ...descriptor, configurable: true }
    },
    set(_target, key, value) {
      const current = state.peek()
      const next = Array.isArray(current) ? [...current] : { ...current }
      Reflect.set(next, key, value)
      state.set(next as T)
      return true
    },
  })

void createObjectState

const cloneStateValue = <T extends object>(value: T): T =>
  (Array.isArray(value) ? [...value] : { ...value }) as T

const replaceReactiveState = (target: any, next: any): void => {
  if (Array.isArray(target) && Array.isArray(next)) {
    target.splice(0, target.length, ...next)
    return
  }
  for (const key of Reflect.ownKeys(target)) {
    if (!Reflect.has(next, key)) Reflect.deleteProperty(target, key)
  }
  Object.assign(target, next)
}

export const _$compiledUseSetup = <T>(slot: string, factory: () => T): T =>
  _$compiledSetup(slot, factory)

export const _$compiledUseRef = <T>(slot: string, value: T): { current: T } =>
  _$compiledSetup(slot, () => ({ current: value }))

export const _$compiledUseMemo = <T>(
  slot: string,
  factory: () => T,
  _dependencies?: readonly unknown[],
): T => _$compiledSetup(slot, factory)

export const _$compiledUseCallback = <T extends (...args: never[]) => unknown>(
  slot: string,
  callback: T,
  _dependencies?: readonly unknown[],
): T => _$compiledSetup(slot, () => callback)

export const _$compiledUseSignal = <T>(
  slot: string,
  initial: T | (() => T),
  options?: StateOptions<T>,
): [CompiledSignalHandle<T>, (next: T | ((state: CompiledSignalHandle<T>) => T | void)) => void] =>
  _$compiledSetup(slot, () => {
    const state = signal(initialValue(initial), options)
    return [state, next => setSignalState(state, next)]
  })

const createState = <T>(initial: T | (() => T), options?: StateOptions<T>) => {
  const value = initialValue(initial)
  if (isRef(value)) {
    const refState = value as CompiledSignalHandle<T>
    return [
      refState,
      (next: T | ((state: CompiledSignalHandle<T>) => T | void)) => setSignalState(refState, next),
    ] as const
  }
  const state = signal(value, options)
  if (options?.kind === 'signal') {
    return [
      state,
      (next: T | ((state: CompiledSignalHandle<T>) => T | void)) => setSignalState(state, next),
    ] as const
  }
  if (
    options?.kind === 'reactive' ||
    (options?.kind == null && typeof value === 'object' && value)
  ) {
    const reactiveState = isReactive(value)
      ? (value as object)
      : reactive(cloneStateValue(value as object))
    return [
      reactiveState,
      (next: T | ((state: unknown) => T | void)) => {
        if (typeof next === 'function') {
          const result = (next as (state: unknown) => T | void)(reactiveState)
          if (result !== undefined && result && typeof result === 'object') {
            replaceReactiveState(reactiveState, result)
          }
        } else if (next && typeof next === 'object') replaceReactiveState(reactiveState, next)
      },
    ] as const
  }
  const refState = createRefState(state)
  return [
    refState,
    (next: T | ((state: unknown) => T | void)) => {
      if (typeof next === 'function') {
        const result = (next as (state: unknown) => T | void)(refState)
        if (result !== undefined) state.set(result)
      } else state.set(next)
    },
  ] as const
}

export const _$compiledUseState = <T>(
  slot: string,
  initial: T | (() => T),
  options?: StateOptions<T>,
): [unknown, (next: T | ((state: unknown) => T | void)) => void] =>
  _$compiledSetup(slot, () => createState(initial, options)) as [
    unknown,
    (next: T | ((state: unknown) => T | void)) => void,
  ]

const startCompiledEffect = (callback: () => void | (() => void)): void => {
  effect(callback)
}

const registerLifecycle = (
  phase: Parameters<typeof registerOwnerLifecycle>[0],
  callback: () => void,
): void => {
  if (!hasCompiledHookRun()) {
    registerOwnerLifecycle(phase, callback)
    return
  }
  const slot = _$compiledSetup(`lifecycle:${phase}`, () => {
    const current = { callback }
    registerOwnerLifecycle(phase, () => current.callback())
    return current
  })
  slot.callback = callback
}

export const _$compiledUseEffect = (
  slot: string,
  callback: () => void | (() => void),
  _dependencies?: readonly unknown[],
): void => {
  _$compiledSetup(slot, () => {
    const owner = getCurrentOwner()
    if (owner === undefined) startCompiledEffect(callback)
    else if (getOwnerValue(owner, COMPILED_MOUNTED) === true) startCompiledEffect(callback)
    else registerOwnerLifecycle('mounted', () => startCompiledEffect(callback))
    return true
  })
}

export const onBeforeMount = (callback: () => void): void => {
  registerLifecycle('beforeMount', callback)
}
export const onMounted = (callback: () => void): void => {
  const owner = getCurrentOwner()
  if (owner === undefined) queueMicrotask(callback)
  else registerLifecycle('mounted', callback)
}
export const onBeforeUpdate = (callback: () => void): void => {
  registerLifecycle('beforeUpdate', callback)
}
export const onUpdated = (callback: () => void): void => {
  registerLifecycle('updated', callback)
}
export const onBeforeUnmount = (callback: () => void): void => {
  registerLifecycle('beforeUnmount', callback)
}
export const onUnmounted = (callback: () => void): void => {
  registerLifecycle('unmounted', callback)
}
export const onActivated = (callback: () => void): void => {
  registerLifecycle('activated', callback)
}
export const onDeactivated = (callback: () => void): void => {
  registerLifecycle('deactivated', callback)
}
export const onBeforeCreate = onBeforeMount
export const onCreated = onMounted
export const onScopeDispose = (callback: () => void): void => {
  registerLifecycle('unmounted', callback)
}

export const getCompiledHandleOwner = (handle: CompiledRootHandle): CompiledOwner | undefined =>
  (handle as OwnedCompiledRootHandle)[COMPILED_OWNER]

export const _$withCompiledHookScope = <T extends CompiledRootHandle>(factory: () => T): T => {
  const owner = createOwner()
  let handle: T | undefined
  try {
    handle = runWithOwner(owner, factory)
  } catch (error) {
    disposeOwner(owner)
    throw error
  }
  if (handle === undefined) {
    disposeOwner(owner)
    throw new Error('[rue] compiled component factory did not return a mount handle')
  }

  ;(handle as T & OwnedCompiledRootHandle)[COMPILED_OWNER] = owner
  const mount = handle.__rue_compiled_mount
  const disposeHandle = handle.dispose
  let disposed = false
  handle.__rue_compiled_mount = parent => {
    runOwnerLifecycle(owner, 'beforeMount')
    try {
      const result = runWithOwner(owner, () => mount.call(handle, parent))
      setOwnerValue(owner, COMPILED_MOUNTED, true)
      runOwnerLifecycle(owner, 'mounted')
      return result
    } catch (error) {
      handle!.dispose()
      throw error
    }
  }
  handle.dispose = () => {
    if (disposed) return
    disposed = true
    try {
      disposeHandle.call(handle)
    } finally {
      disposeOwner(owner)
    }
  }
  handle.__rue_cleanup_bucket.push(handle.dispose)
  return handle
}

// The compiler may keep the public useSetup call inside a component render effect so its Hook
// slot remains stable. Setup initialization is still non-render work: isolate its incidental
// reads while allowing effects created by the factory to establish their own dependencies.
export const useSetup = <T>(factory: () => T): T => untrack(factory)
export function useRef<T>(value: T): { current: T }
export function useRef<T = undefined>(): { current: T | undefined }
export function useRef<T>(value?: T): { current: T | undefined } {
  return { current: value }
}
export const useMemo = <T>(factory: () => T, dependencies?: readonly unknown[]): T => {
  const hookId = getCurrentCompiledHookId()
  if (hookId === undefined) return factory()
  const record = _$compiledSetup(`useMemo:${hookId}`, () => ({
    initialized: false,
    dependencies: undefined as readonly unknown[] | undefined,
    value: undefined as T | undefined,
  }))
  const changed =
    !record.initialized ||
    dependencies === undefined ||
    record.dependencies === undefined ||
    dependencies.length !== record.dependencies.length ||
    dependencies.some((value, index) => !Object.is(value, record.dependencies![index]))
  if (changed) {
    record.value = untrack(factory)
    if (
      record.value != null &&
      typeof record.value === 'object' &&
      '__rue_compiled_freeze_effects' in record.value &&
      typeof record.value.__rue_compiled_freeze_effects === 'function'
    ) {
      record.value.__rue_compiled_freeze_effects()
    }
    record.dependencies = dependencies == null ? undefined : [...dependencies]
    record.initialized = true
  }
  return record.value as T
}
export const useCallback = <T extends (...args: any[]) => unknown>(
  callback: T,
  _dependencies?: readonly unknown[],
): T => callback
export const useSignal = <T>(initial: T | (() => T), options?: StateOptions<T>) =>
  (() => {
    const state = signal(initialValue(initial), options)
    return [
      state,
      (next: T | ((state: CompiledSignalHandle<T>) => T | void)) => setSignalState(state, next),
    ] as const
  })()
export const useState = <T>(initial: T | (() => T), options?: StateOptions<T>) =>
  createState(initial, options)
export const useEffect = (callback: () => void | (() => void)): void =>
  startCompiledEffect(callback)

const normalizeRefValue = <T>(value: T): T =>
  value != null && typeof value === 'object' && !isReactive(value) ? (reactive(value) as T) : value

export const ref = <T>(value: T) => {
  const state = signal(normalizeRefValue(value))
  return createRefState(state, normalizeRefValue)
}
export const shallowRef = <T>(value: T) => createRefState(signal(value))
