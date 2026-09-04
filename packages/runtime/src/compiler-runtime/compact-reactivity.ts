import {
  effect,
  getCurrentOwner,
  registerOwnerLifecycle,
  signal,
  type CompiledSignalHandle,
} from '../runtime-core/compiled'

export type CompactRef<T> = CompiledSignalHandle<T>

export const ref = <T>(value: T): CompactRef<T> => signal(value)

export const computed = <T>(read: () => T): CompactRef<T> => {
  const value = signal(read())
  effect(() => value.set(read()))
  return value
}

export const watchEffect = (callback: () => void | (() => void)) => effect(callback)

export const onMounted = (callback: () => void): void => {
  if (getCurrentOwner() === undefined) queueMicrotask(callback)
  else registerOwnerLifecycle('mounted', callback)
}

export const onUnmounted = (callback: () => void): void => {
  if (getCurrentOwner() !== undefined) registerOwnerLifecycle('unmounted', callback)
}
