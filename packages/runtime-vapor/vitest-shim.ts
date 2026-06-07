import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const runtimeVapor =
  require('./pkg-node/rue_runtime_vapor.js') as typeof import('./pkg-node/rue_runtime_vapor.js')

export type * from './pkg-node/rue_runtime_vapor.js'

export default runtimeVapor

export const {
  EffectHandle,
  SignalHandle,
  WasmRue,
  batch,
  computed,
  createComputed,
  createEffect,
  createReactive,
  createRef,
  createResource,
  createRue,
  createSignal,
  getCurrentInstance,
  /** 测试环境导出 isProxy，供 runtime 层 API 兼容测试复用。 */
  isProxy,
  isReactive,
  /** 测试环境导出 isReadonly，保持与浏览器/Node runtime 入口一致。 */
  isReadonly,
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
} = runtimeVapor
