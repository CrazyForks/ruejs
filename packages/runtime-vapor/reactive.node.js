import { createRequire } from 'node:module'

import { installSharedBridge } from './vapor-bridge.js'

const require = createRequire(import.meta.url)
const reactiveRuntime = require('./pkg-node/rue_runtime_vapor.js')

installSharedBridge(reactiveRuntime)

export default reactiveRuntime

export const {
  EffectHandle,
  SignalHandle,
  batch,
  computed,
  createComputed,
  createEffect,
  createReactive,
  createRef,
  createResource,
  createSignal,
  getCurrentInstance,
  isReactive,
  onCleanup,
  propsReactive,
  reactive,
  readonly,
  ref,
  setCurrentInstance,
  setReactiveScheduling,
  shallowReactive,
  shallowReadonly,
  signal,
  toRaw,
  toValue,
  unref,
  untrack,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSetup,
  useSignal,
  useState,
  vaporWithHookId,
  watch,
  watchDeepSignal,
  watchEffect,
  watchFn,
  watchPath,
  watchSignal,
  withHookSlot,
  __rueCreateDetachedEffectScope,
  __rueDisposeEffectScope,
  __rueDisposeHookScopeForInstance,
  __ruePopEffectScope,
  __ruePushEffectScope,
} = reactiveRuntime
