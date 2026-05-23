import { createRequire } from 'node:module'

import { installSharedBridge } from './vapor-bridge.js'

const require = createRequire(import.meta.url)
const reactiveRuntime = require('./pkg-node/rue_runtime_vapor.js')

installSharedBridge(reactiveRuntime)

const normalizeShallowRefOptions = options => {
  if (!options || typeof options !== 'object') {
    return undefined
  }

  const equals = Reflect.get(options, 'equals')
  if (typeof equals !== 'function') {
    return options
  }

  return {
    ...options,
    equals: (prev, next) => equals(prev?.value, next?.value),
  }
}

export const shallowRef = (initial, options, force_global) =>
  reactiveRuntime.shallowReactive(
    { value: initial },
    normalizeShallowRefOptions(options),
    force_global,
  )

export default {
  ...reactiveRuntime,
  shallowRef,
}

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
  nextTick,
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
