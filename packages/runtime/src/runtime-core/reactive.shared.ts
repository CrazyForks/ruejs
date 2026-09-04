import { createReactiveFacade } from './js-reactive/facade.js'
import { createReactiveKernel } from './reactive-kernel/index.js'

export type EffectHandle = import('./js-reactive/types.js').EffectHandle
export type SignalHandle<T> = import('./js-reactive/types.js').SignalHandle<T>

const reactiveKernelKey = Symbol.for('@rue-js/runtime/reactive-kernel')
const reactiveKernelRegistry = globalThis as typeof globalThis & {
  [reactiveKernelKey]?: ReturnType<typeof createReactiveKernel>
}
const reactiveKernel = (reactiveKernelRegistry[reactiveKernelKey] ??= createReactiveKernel({
  onErrorCaptured: (error, owner, info) =>
    globalThis.__rue_compiled_runtime_bridge?.dispatchErrorCaptured?.(error, owner, info) === true,
}))

const facade = createReactiveFacade(reactiveKernel)
const runtimeWithJsHooks = {
  ...facade.default,
  ...facade.hooks,
}

export const {
  __rueGetEffectScopeDebugState,
  watchPostEffect,
  watchSyncEffect,
  watchEffect,
  watch,
  onWatcherCleanup,
  onScopeDispose,
  nextTick,
  __rueCurrentEffectId,
  __rueDisposeEffectScope,
  __rueGetSignalWrapperRegistryDebugState,
  createSignal,
  signal,
  normalizeRenderTriggeredEvent,
  isReadonly,
  isRef,
  onRenderTracked,
  getCurrentScope,
  effectScope,
  createReactive,
  reactive,
  readonly,
  shallowReadonly,
  propsReactive,
  computed,
  customRef,
  createComputed,
  shallowRef,
  triggerRef,
  toRefs,
  toRef,
} = facade

export const {
  __rueDisposeHookScopeForInstance,
  getCurrentInstance,
  setCurrentInstance,
  isProxy,
  isReactive,
  ref,
  shallowReactive,
  toRaw,
  unref,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSetup,
  useSignal,
  useState,
  vaporWithHookId,
  withHookSlot,
} = facade.hooks

export const {
  EffectHandle,
  SignalHandle,
  batch,
  createEffect,
  createRef,
  createResource,
  createCustomRef,
  onCleanup,
  setReactiveScheduling,
  toValue,
  untrack,
  watchDeepSignal,
  watchFn,
  watchPath,
  watchSignal,
  __rueActivateEffectOwnerTracking,
  __rueActivateRenderTriggered,
  __rueBeginRenderDebugOwner,
  __rueCreateDetachedEffectScope,
  __rueEndRenderDebugOwner,
  __rueGetCurrentEffectScope,
  __ruePopEffectScope,
  __ruePushEffectScope,
} = reactiveKernel

export default runtimeWithJsHooks
