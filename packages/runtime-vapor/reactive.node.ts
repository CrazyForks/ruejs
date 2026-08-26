import { createRequire } from 'node:module'

import { createReactiveFacade } from './js-reactive/facade.js'
import { installSharedBridge } from './vapor-bridge.js'
import type { ReactiveKernel } from './js-reactive/types.js'

const require = createRequire(import.meta.url)
interface RuntimeKernelActivationExports {
  __rueActivateEffectOwnerTracking(): void
  __rueActivateRenderTriggered(): void
}

const reactiveRuntime =
  require('./pkg-node/rue_runtime_vapor.js') as typeof import('./pkg-node/rue_runtime_vapor.js') &
    RuntimeKernelActivationExports
installSharedBridge(reactiveRuntime)
const facade = createReactiveFacade<typeof reactiveRuntime>(
  reactiveRuntime as unknown as typeof reactiveRuntime & ReactiveKernel,
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

if (typeof reactiveRuntime.__rueDisposeEffectScope === 'function') {
  reactiveRuntime.__rueDisposeEffectScope = __rueDisposeEffectScope
}
installSharedBridge(runtimeWithJsHooks)

export default runtimeWithJsHooks

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
  __rueBeginRenderDebugOwner,
  __rueCreateDetachedEffectScope,
  __rueEndRenderDebugOwner,
  __rueGetCurrentEffectScope,
  __ruePopEffectScope,
  __ruePushEffectScope,
} = reactiveRuntime
