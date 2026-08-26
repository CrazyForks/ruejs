import * as reactiveRuntime from './pkg-vapor/rue_runtime_vapor.js'

import { createReactiveFacade } from './js-reactive/facade.js'
import { installSharedBridge } from './vapor-bridge.js'
import type { ReactiveKernel } from './js-reactive/types.js'

interface RuntimeKernelActivationExports {
  __rueActivateEffectOwnerTracking(): void
  __rueActivateRenderTriggered(): void
}

const runtimeKernel = reactiveRuntime as typeof reactiveRuntime & RuntimeKernelActivationExports
installSharedBridge(runtimeKernel)
const facade = createReactiveFacade<typeof runtimeKernel>(
  runtimeKernel as unknown as typeof runtimeKernel & ReactiveKernel,
)
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

installSharedBridge(runtimeWithJsHooks)

export * from './pkg-vapor/rue_runtime_vapor.js'
export type {
  ComputedHandle,
  DebuggerEvent,
  DebuggerHook,
  EffectHandle,
  EffectScope,
  WatchCallback,
  WatchEffectOptions,
  WatchFlush,
  WatchMultiSource,
  WatchOptions,
  WatchSource,
} from './js-reactive/types.js'
export default runtimeWithJsHooks
