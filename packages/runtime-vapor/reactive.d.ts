import * as reactiveRuntime from './pkg-vapor/rue_runtime_vapor.js'
declare const runtimeWithJsHooks: {
  watchEffect: typeof reactiveRuntime.watchEffect &
    import('./js-reactive/types.js').WatchEffectFunction
  watchFn<T>(
    getter: () => T,
    handler: (newv: T, oldv: T) => void,
    options?: reactiveRuntime.WatchOptions<T> | null,
  ): reactiveRuntime.EffectHandle
  watchFn(getter: Function, handler: Function, options?: any | null): reactiveRuntime.EffectHandle
  watchSignal(
    src: reactiveRuntime.SignalHandle,
    handler: (newv: any, oldv: any) => void,
    options?: reactiveRuntime.WatchOptions<any> | null,
  ): reactiveRuntime.EffectHandle
  watchSignal(
    src: reactiveRuntime.SignalHandle,
    handler: Function,
    options?: any | null,
  ): reactiveRuntime.EffectHandle
  watchDeepSignal(
    src: reactiveRuntime.SignalHandle,
    handler: (newv: any, oldv: any) => void,
    options?: reactiveRuntime.WatchOptions<any> | null,
  ): reactiveRuntime.EffectHandle
  watchDeepSignal(
    src: reactiveRuntime.SignalHandle,
    handler: Function,
    options?: any | null,
  ): reactiveRuntime.EffectHandle
  watchPath(
    src: reactiveRuntime.SignalHandle,
    path: string | Array<string | number>,
    handler: (newv: any, oldv: any) => void,
    options?: reactiveRuntime.WatchOptions<any> | null,
  ): reactiveRuntime.EffectHandle
  watchPath(
    src: reactiveRuntime.SignalHandle,
    path: any,
    handler: Function,
    options?: any | null,
  ): reactiveRuntime.EffectHandle
  watch: typeof reactiveRuntime.watch & import('./js-reactive/types.js').WatchFunction
  EffectHandle: typeof reactiveRuntime.EffectHandle
  createEffect(
    cb: () => void,
    options?: {
      scheduler?: (run: () => void) => void
      lazy?: boolean
    } | null,
  ): reactiveRuntime.EffectHandle
  createEffect(cb: Function, options?: any | null): reactiveRuntime.EffectHandle
  onCleanup(cb: () => void): void
  onCleanup(cb: Function): void
  onWatcherCleanup: typeof reactiveRuntime.onWatcherCleanup &
    ((cleanup: import('./js-reactive/types.js').EffectCleanup, failSilently?: boolean) => void)
  untrack<T>(cb: () => T): T
  untrack(cb: Function): any
  batch(cb: () => void): void
  batch(cb: Function): void
  createComputed: typeof reactiveRuntime.createComputed &
    import('./js-reactive/types.js').CreateComputedFunction
  SignalHandle: typeof reactiveRuntime.SignalHandle
  createSignal: typeof reactiveRuntime.createSignal &
    import('./js-reactive/types.js').CreateSignalFunction
  createRef<T = any>(initial: T): reactiveRuntime.SignalHandle<T>
  createRef(initial: any, options?: any | null): any
  createCustomRef<T = any>(
    factory: reactiveRuntime.CustomRefFactory<T>,
  ): {
    value: T
  }
  createCustomRef(factory: Function): any
  createReactive: typeof reactiveRuntime.createReactive &
    (<T>(
      initial: T,
      options?: import('./js-reactive/types.js').ReactiveOptions<T>,
    ) => import('./js-reactive/types.js').ReactiveState<T>)
  setReactiveScheduling(mode: 'sync' | 'microtask' | 'frame' | string): void
  setReactiveScheduling(mode: string): void
  nextTick: typeof reactiveRuntime.nextTick &
    (<T = void>(callback?: () => T | Promise<T>) => Promise<T | void>)
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
    src: reactiveRuntime.SignalHandle,
    fetcher: (src: TSrc) => Promise<TData>,
  ): reactiveRuntime.Resource<TData>
  createResource(src: reactiveRuntime.SignalHandle, fetcher: Function): any
  __rueBeginRenderDebugOwner(owner: any): void
  __rueCreateDetachedEffectScope(): number
  __rueCurrentEffectId: typeof reactiveRuntime.__rueCurrentEffectId & (() => number | undefined)
  __rueDisposeEffectScope: typeof reactiveRuntime.__rueDisposeEffectScope &
    ((scopeId: import('./js-reactive/types.js').EffectScopeHandle) => void)
  __rueEndRenderDebugOwner(): void
  __rueGetCurrentEffectScope(): any
  __ruePopEffectScope(): any
  __ruePushEffectScope(id: number): void
  onScopeDispose: typeof reactiveRuntime.onScopeDispose &
    ((cleanup: import('./js-reactive/types.js').EffectCleanup, failSilently?: boolean) => void)
  __rueGetEffectScopeDebugState(): import('./js-reactive/types.js').EffectScopeDebugState
  effectScope(detached?: boolean): import('./reactive.js').EffectScope
  getCurrentScope(): import('./reactive.js').EffectScope | undefined
  onRenderTracked(callback: import('./reactive.js').DebuggerHook): (() => void) | undefined
  shallowRef<T>(
    initial: T,
    options?: import('./reactive.js').UseStateOptions<T> | null,
    forceGlobal?: boolean,
  ): import('./reactive.js').ObjectRef<T>
  signal: import('./js-reactive/types.js').SignalFunction
  toRef: import('./js-reactive/types.js').ValueFacade['toRef']
  toRefs: import('./js-reactive/types.js').ValueFacade['toRefs']
  triggerRef: import('./js-reactive/types.js').ValueFacade['triggerRef']
  watchPostEffect: import('./js-reactive/types.js').WatchFlushEffectFunction
  watchSyncEffect: import('./js-reactive/types.js').WatchFlushEffectFunction
  __rueDisposeHookScopeForInstance(instance: unknown): void
  computed: import('./js-reactive/types.js').ComputedFunction
  customRef: import('./js-reactive/types.js').CustomRefFunction
  getCurrentInstance(): unknown
  setCurrentInstance(instance: unknown): void
  isProxy(value: unknown): boolean
  isReactive(value: unknown): value is import('./js-reactive/types.js').ReactiveProxyMarkers
  isReadonly(value: unknown): boolean
  isRef(value: unknown): value is import('./reactive.js').ObjectRef<unknown>
  propsReactive<T>(
    initial: T,
    forceGlobal?: boolean,
  ): import('./js-reactive/types.js').ReactiveState<T>
  reactive<T>(
    initial: T,
    options?: import('./js-reactive/types.js').ReactiveOptions<T>,
    forceGlobal?: boolean,
  ): import('./js-reactive/types.js').ReactiveState<T>
  readonly<T>(initial: T, forceGlobal?: boolean): import('./js-reactive/types.js').ReactiveState<T>
  ref<T>(initial: T, options?: unknown, forceGlobal?: boolean): import('./reactive.js').ObjectRef<T>
  shallowReactive<T>(
    initial: T,
    options?: import('./js-reactive/types.js').ReactiveOptions<T>,
    forceGlobal?: boolean,
  ): import('./js-reactive/types.js').ReactiveState<T>
  shallowReadonly<T>(
    initial: T,
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
}
export declare const __rueGetEffectScopeDebugState: () => import('./js-reactive/types.js').EffectScopeDebugState,
  watchPostEffect: import('./js-reactive/types.js').WatchFlushEffectFunction,
  watchSyncEffect: import('./js-reactive/types.js').WatchFlushEffectFunction,
  watchEffect: import('./js-reactive/types.js').WatchEffectFunction,
  watch: import('./js-reactive/types.js').WatchFunction,
  onWatcherCleanup: (
    cleanup: import('./js-reactive/types.js').EffectCleanup,
    failSilently?: boolean,
  ) => void,
  onScopeDispose: (
    cleanup: import('./js-reactive/types.js').EffectCleanup,
    failSilently?: boolean,
  ) => void,
  nextTick: <T = void>(callback?: () => T | Promise<T>) => Promise<T | void>,
  __rueCurrentEffectId: () => number | undefined,
  __rueDisposeEffectScope: (scopeId: import('./js-reactive/types.js').EffectScopeHandle) => void,
  __rueGetSignalWrapperRegistryDebugState: () => import('./js-reactive/types.js').SignalWrapperRegistryDebugState,
  createSignal: import('./js-reactive/types.js').CreateSignalFunction,
  signal: import('./js-reactive/types.js').SignalFunction,
  normalizeRenderTriggeredEvent: (event: unknown) => import('./reactive.js').DebuggerEvent,
  isReadonly: (value: unknown) => boolean,
  isRef: (value: unknown) => value is import('./reactive.js').ObjectRef<unknown>,
  onRenderTracked: (callback: import('./reactive.js').DebuggerHook) => (() => void) | undefined,
  getCurrentScope: () => import('./reactive.js').EffectScope | undefined,
  effectScope: (detached?: boolean) => import('./reactive.js').EffectScope,
  createReactive: <T>(
    initial: T,
    options?: import('./js-reactive/types.js').ReactiveOptions<T>,
  ) => import('./js-reactive/types.js').ReactiveState<T>,
  reactive: <T>(
    initial: T,
    options?: import('./js-reactive/types.js').ReactiveOptions<T>,
    forceGlobal?: boolean,
  ) => import('./js-reactive/types.js').ReactiveState<T>,
  readonly: <T>(
    initial: T,
    forceGlobal?: boolean,
  ) => import('./js-reactive/types.js').ReactiveState<T>,
  shallowReadonly: <T>(
    initial: T,
    forceGlobal?: boolean,
  ) => import('./js-reactive/types.js').ReactiveState<T>,
  propsReactive: <T>(
    initial: T,
    forceGlobal?: boolean,
  ) => import('./js-reactive/types.js').ReactiveState<T>,
  computed: import('./js-reactive/types.js').ComputedFunction,
  customRef: import('./js-reactive/types.js').CustomRefFunction,
  createComputed: import('./js-reactive/types.js').CreateComputedFunction,
  shallowRef: <T>(
    initial: T,
    options?: import('./reactive.js').UseStateOptions<T> | null,
    forceGlobal?: boolean,
  ) => import('./reactive.js').ObjectRef<T>,
  triggerRef: (refValue: unknown) => void,
  toRefs: <T extends object>(
    object: T,
  ) => { [K in keyof T]: import('./reactive.js').ObjectRef<T[K]> },
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
export declare const __rueDisposeHookScopeForInstance: (instance: unknown) => void,
  getCurrentInstance: () => unknown,
  setCurrentInstance: (instance: unknown) => void,
  isProxy: (value: unknown) => boolean,
  isReactive: (value: unknown) => value is import('./js-reactive/types.js').ReactiveProxyMarkers,
  ref: <T>(
    initial: T,
    options?: unknown,
    forceGlobal?: boolean,
  ) => import('./reactive.js').ObjectRef<T>,
  shallowReactive: <T>(
    initial: T,
    options?: import('./js-reactive/types.js').ReactiveOptions<T>,
    forceGlobal?: boolean,
  ) => import('./js-reactive/types.js').ReactiveState<T>,
  toRaw: <T>(value: unknown) => T,
  unref: <T>(value: T | import('./reactive.js').ObjectRef<T>) => T,
  useCallback: import('./js-reactive/types.js').UseCallbackFunction,
  useEffect: import('./js-reactive/types.js').UseEffectFunction,
  useMemo: import('./js-reactive/types.js').UseMemoFunction,
  useRef: import('./js-reactive/types.js').UseRefFunction,
  useSetup: <T>(factory: () => T) => T,
  useSignal: import('./js-reactive/types.js').UseSignalFunction,
  useState: import('./js-reactive/types.js').UseStateFunction,
  vaporWithHookId: <T>(id: unknown, runner: () => T) => T,
  withHookSlot: <T>(factory: () => T) => T
export declare const __rueActivateEffectOwnerTracking: () => void,
  __rueActivateRenderTriggered: () => void
export * from './pkg-vapor/rue_runtime_vapor.js'
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
