import {
  computed,
  createComputed,
  createReactive,
  createSignal,
  effectScope,
  getCurrentScope,
  isRef,
  isReadonly,
  nextTick,
  onRenderTracked,
  onWatcherCleanup,
  propsReactive,
  reactive,
  readonly,
  shallowRef,
  shallowReadonly,
  signal,
  toRef,
  toRefs,
  triggerRef,
  watch,
  watchEffect,
  watchPostEffect,
  watchSyncEffect,
} from './reactive.js'
declare const createRue: (adapter: unknown) => import('./index.js').RueRuntime<unknown>
declare const EffectHandle: typeof import('./pkg-vapor/rue_runtime_vapor.js').EffectHandle,
  SignalHandle: typeof import('./reactive.js').SignalHandle,
  batch: typeof import('./reactive.js').batch,
  createEffect: typeof import('./reactive.js').createEffect,
  createRef: typeof import('./reactive.js').createRef,
  createResource: typeof import('./reactive.js').createResource,
  createCustomRef: typeof import('./reactive.js').createCustomRef,
  customRef: import('./js-reactive/types.js').CustomRefFunction,
  getCurrentInstance: () => unknown,
  isProxy: (value: unknown) => boolean,
  isReactive: (value: unknown) => value is import('./js-reactive/types.js').ReactiveProxyMarkers,
  onCleanup: typeof import('./reactive.js').onCleanup,
  onScopeDispose: typeof import('./pkg-vapor/rue_runtime_vapor.js').onScopeDispose &
    ((cleanup: import('./js-reactive/types.js').EffectCleanup, failSilently?: boolean) => void),
  ref: <T>(
    initial: T,
    options?: unknown,
    forceGlobal?: boolean,
  ) => import('./reactive.js').ObjectRef<T>,
  setCurrentInstance: (instance: unknown) => void,
  setReactiveScheduling: typeof import('./reactive.js').setReactiveScheduling,
  shallowReactive: <T>(
    initial: T,
    options?: import('./js-reactive/types.js').ReactiveOptions<T>,
    forceGlobal?: boolean,
  ) => import('./js-reactive/types.js').ReactiveState<T>,
  toRaw: <T>(value: unknown) => T,
  toValue: typeof import('./reactive.js').toValue,
  unref: <T>(value: T | import('./reactive.js').ObjectRef<T>) => T,
  untrack: typeof import('./reactive.js').untrack,
  useCallback: import('./js-reactive/types.js').UseCallbackFunction,
  useEffect: import('./js-reactive/types.js').UseEffectFunction,
  useMemo: import('./js-reactive/types.js').UseMemoFunction,
  useRef: import('./js-reactive/types.js').UseRefFunction,
  useSetup: <T>(factory: () => T) => T,
  useSignal: import('./js-reactive/types.js').UseSignalFunction,
  useState: import('./js-reactive/types.js').UseStateFunction,
  vaporWithHookId: <T>(id: unknown, runner: () => T) => T,
  watchDeepSignal: typeof import('./reactive.js').watchDeepSignal,
  watchFn: typeof import('./reactive.js').watchFn,
  watchPath: typeof import('./reactive.js').watchPath,
  watchSignal: typeof import('./reactive.js').watchSignal,
  withHookSlot: <T>(factory: () => T) => T
export * from './pkg-vapor/rue_runtime_vapor.js'
export type { RueRuntime } from './js-runtime/types.js'
export type {
  ComputedHandle,
  DebuggerEvent,
  DebuggerHook,
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
  WatchOptions,
  WatchSource,
} from './js-reactive/types.js'
declare const _default: {
  watchFn<T>(
    getter: () => T,
    handler: (newv: T, oldv: T) => void,
    options?: import('./pkg-vapor/rue_runtime_vapor.js').WatchOptions<T> | null,
  ): import('./pkg-vapor/rue_runtime_vapor.js').EffectHandle
  watchFn(
    getter: Function,
    handler: Function,
    options?: any | null,
  ): import('./pkg-vapor/rue_runtime_vapor.js').EffectHandle
  watchSignal(
    src: import('./reactive.js').SignalHandle,
    handler: (newv: any, oldv: any) => void,
    options?: import('./pkg-vapor/rue_runtime_vapor.js').WatchOptions<any> | null,
  ): import('./pkg-vapor/rue_runtime_vapor.js').EffectHandle
  watchSignal(
    src: import('./reactive.js').SignalHandle,
    handler: Function,
    options?: any | null,
  ): import('./pkg-vapor/rue_runtime_vapor.js').EffectHandle
  watchDeepSignal(
    src: import('./reactive.js').SignalHandle,
    handler: (newv: any, oldv: any) => void,
    options?: import('./pkg-vapor/rue_runtime_vapor.js').WatchOptions<any> | null,
  ): import('./pkg-vapor/rue_runtime_vapor.js').EffectHandle
  watchDeepSignal(
    src: import('./reactive.js').SignalHandle,
    handler: Function,
    options?: any | null,
  ): import('./pkg-vapor/rue_runtime_vapor.js').EffectHandle
  watchPath(
    src: import('./reactive.js').SignalHandle,
    path: string | Array<string | number>,
    handler: (newv: any, oldv: any) => void,
    options?: import('./pkg-vapor/rue_runtime_vapor.js').WatchOptions<any> | null,
  ): import('./pkg-vapor/rue_runtime_vapor.js').EffectHandle
  watchPath(
    src: import('./reactive.js').SignalHandle,
    path: any,
    handler: Function,
    options?: any | null,
  ): import('./pkg-vapor/rue_runtime_vapor.js').EffectHandle
  EffectHandle: typeof import('./pkg-vapor/rue_runtime_vapor.js').EffectHandle
  createEffect(
    cb: () => void,
    options?: {
      scheduler?: (run: () => void) => void
      lazy?: boolean
    } | null,
  ): import('./pkg-vapor/rue_runtime_vapor.js').EffectHandle
  createEffect(
    cb: Function,
    options?: any | null,
  ): import('./pkg-vapor/rue_runtime_vapor.js').EffectHandle
  onCleanup(cb: () => void): void
  onCleanup(cb: Function): void
  onWatcherCleanup: typeof import('./pkg-vapor/rue_runtime_vapor.js').onWatcherCleanup &
    ((cleanup: import('./js-reactive/types.js').EffectCleanup, failSilently?: boolean) => void)
  untrack<T>(cb: () => T): T
  untrack(cb: Function): any
  batch(cb: () => void): void
  batch(cb: Function): void
  SignalHandle: typeof import('./reactive.js').SignalHandle
  createRef<T = any>(initial: T): import('./reactive.js').SignalHandle<T>
  createRef(initial: any, options?: any | null): any
  createCustomRef<T = any>(
    factory: import('./index.js').CustomRefFactory<T>,
  ): {
    value: T
  }
  createCustomRef(factory: Function): any
  setReactiveScheduling(mode: 'sync' | 'microtask' | 'frame' | string): void
  setReactiveScheduling(mode: string): void
  toValue<T>(
    x:
      | T
      | (() => T)
      | {
          value?: T
          get?: () => T
        },
  ): T
  toValue(x: any): any
  createResource<TSrc, TData>(
    src: import('./reactive.js').SignalHandle,
    fetcher: (src: TSrc) => Promise<TData>,
  ): import('./reactive.js').Resource<TData>
  createResource(src: import('./reactive.js').SignalHandle, fetcher: Function): any
  __rueBeginRenderDebugOwner(owner: any): void
  __rueCreateDetachedEffectScope(): number
  __rueCurrentEffectId: typeof import('./index.js').__rueCurrentEffectId &
    (() => number | undefined)
  __rueDisposeEffectScope: typeof import('./index.js').__rueDisposeEffectScope &
    ((scopeId: import('./js-reactive/types.js').EffectScopeHandle) => void)
  __rueEndRenderDebugOwner(): void
  __rueGetCurrentEffectScope(): any
  __ruePopEffectScope(): any
  __ruePushEffectScope(id: number): void
  onScopeDispose: typeof import('./pkg-vapor/rue_runtime_vapor.js').onScopeDispose &
    ((cleanup: import('./js-reactive/types.js').EffectCleanup, failSilently?: boolean) => void)
  __rueGetEffectScopeDebugState(): import('./js-reactive/types.js').EffectScopeDebugState
  __rueDisposeHookScopeForInstance(instance: unknown): void
  customRef: import('./js-reactive/types.js').CustomRefFunction
  getCurrentInstance(): unknown
  setCurrentInstance(instance: unknown): void
  isProxy(value: unknown): boolean
  isReactive(value: unknown): value is import('./js-reactive/types.js').ReactiveProxyMarkers
  ref<T>(initial: T, options?: unknown, forceGlobal?: boolean): import('./reactive.js').ObjectRef<T>
  shallowReactive<T>(
    initial: T,
    options?: import('./js-reactive/types.js').ReactiveOptions<T>,
    forceGlobal?: boolean,
  ): import('./js-reactive/types.js').ReactiveState<T>
  toRaw<T>(value: unknown): T
  unref<T>(value: T | import('./reactive.js').ObjectRef<T>): T
  useCallback: import('./js-reactive/types.js').UseCallbackFunction
  useEffect: import('./js-reactive/types.js').UseEffectFunction
  useMemo: import('./js-reactive/types.js').UseMemoFunction
  useRef: import('./js-reactive/types.js').UseRefFunction
  useSetup<T>(factory: () => T): T
  useSignal: import('./js-reactive/types.js').UseSignalFunction
  useState: import('./js-reactive/types.js').UseStateFunction
  vaporWithHookId<T>(id: unknown, runner: () => T): T
  withHookSlot<T>(factory: () => T): T
  __rueActivateEffectOwnerTracking(): void
  __rueActivateRenderTriggered(): void
  computed: import('./js-reactive/types.js').ComputedFunction
  createComputed: import('./js-reactive/types.js').CreateComputedFunction
  createReactive: <T>(
    initial: T,
    options?: import('./js-reactive/types.js').ReactiveOptions<T>,
  ) => import('./js-reactive/types.js').ReactiveState<T>
  createSignal: import('./js-reactive/types.js').CreateSignalFunction
  createRue: (adapter: unknown) => import('./index.js').RueRuntime<unknown>
  effectScope: (detached?: boolean) => import('./reactive.js').EffectScope
  getCurrentScope: () => import('./reactive.js').EffectScope | undefined
  isRef: (value: unknown) => value is import('./reactive.js').ObjectRef<unknown>
  isReadonly: (value: unknown) => boolean
  nextTick: <T = void>(callback?: () => T | Promise<T>) => Promise<T | void>
  onRenderTracked: (callback: import('./reactive.js').DebuggerHook) => (() => void) | undefined
  propsReactive: <T>(
    initial: T,
    forceGlobal?: boolean,
  ) => import('./js-reactive/types.js').ReactiveState<T>
  reactive: <T>(
    initial: T,
    options?: import('./js-reactive/types.js').ReactiveOptions<T>,
    forceGlobal?: boolean,
  ) => import('./js-reactive/types.js').ReactiveState<T>
  readonly: <T>(
    initial: T,
    forceGlobal?: boolean,
  ) => import('./js-reactive/types.js').ReactiveState<T>
  shallowRef: <T>(
    initial: T,
    options?: import('./reactive.js').UseStateOptions<T> | null,
    forceGlobal?: boolean,
  ) => import('./reactive.js').ObjectRef<T>
  shallowReadonly: <T>(
    initial: T,
    forceGlobal?: boolean,
  ) => import('./js-reactive/types.js').ReactiveState<T>
  signal: import('./js-reactive/types.js').SignalFunction
  toRef: {
    <T>(source: import('./reactive.js').ObjectRef<T>): import('./reactive.js').ObjectRef<T>
    <T>(source: () => T): import('./reactive.js').GetterRef<T>
    <T, K extends keyof T>(
      source: T,
      key: K,
      defaultValue?: T[K],
    ): import('./reactive.js').ObjectRef<T[K]>
    <T>(source: T): import('./reactive.js').ObjectRef<T>
  }
  toRefs: <T extends object>(
    object: T,
  ) => { [K in keyof T]: import('./reactive.js').ObjectRef<T[K]> }
  triggerRef: (refValue: unknown) => void
  watch: import('./js-reactive/types.js').WatchFunction
  watchEffect: import('./js-reactive/types.js').WatchEffectFunction
  watchPostEffect: import('./js-reactive/types.js').WatchFlushEffectFunction
  watchSyncEffect: import('./js-reactive/types.js').WatchFlushEffectFunction
}
export default _default
export {
  EffectHandle,
  SignalHandle,
  batch,
  computed,
  createComputed,
  createEffect,
  createReactive,
  createRef,
  createResource,
  createCustomRef,
  createRue,
  createSignal,
  customRef,
  effectScope,
  getCurrentScope,
  getCurrentInstance,
  isRef,
  isReadonly,
  isProxy,
  isReactive,
  nextTick,
  onCleanup,
  onWatcherCleanup,
  onRenderTracked,
  onScopeDispose,
  propsReactive,
  reactive,
  readonly,
  ref,
  setCurrentInstance,
  setReactiveScheduling,
  shallowRef,
  toRef,
  toRefs,
  triggerRef,
  watch,
  watchEffect,
  watchPostEffect,
  watchSyncEffect,
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
  watchDeepSignal,
  watchFn,
  watchPath,
  watchSignal,
  withHookSlot,
}
