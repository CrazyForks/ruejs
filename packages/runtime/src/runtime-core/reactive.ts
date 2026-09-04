import runtimeWithJsHooks from './reactive.browser.js'

export * from './reactive.browser.js'
export const { __rueActivateEffectOwnerTracking, __rueActivateRenderTriggered } = runtimeWithJsHooks
export type {
  ComputedGetter,
  ComputedHandle,
  ComputedOptions,
  CustomRefFactory,
  DebuggerEvent,
  DebuggerHook,
  EffectHandle,
  EffectScope,
  EqualityOptions as UseStateOptions,
  ReadonlyRefLike as GetterRef,
  RefLike as ObjectRef,
  RefSlot as HookRef,
  StateSetter as ReactiveStateSetter,
  StateSetter as RefStateSetter,
  StateSetter as SignalStateSetter,
  WatchCallback,
  WatchEffectOptions,
  WatchFlush,
  WatchMultiSource,
  WatchOptions,
  WatchSource,
} from './js-reactive/types.js'
export type { RefLike as StateRef } from './js-reactive/types.js'
export type ToRefs<T extends Record<PropertyKey, unknown>> = {
  [K in keyof T]: import('./js-reactive/types.js').RefLike<T[K]>
}
export default runtimeWithJsHooks
