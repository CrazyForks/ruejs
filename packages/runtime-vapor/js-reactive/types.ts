import type {
  EffectHandle as KernelEffectHandle,
  ReadonlySignal as KernelReadonlySignal,
  SignalHandle as KernelSignalHandle,
  WritableSignal as KernelWritableSignal,
} from '../pkg-vapor/rue_runtime_vapor.js'

export type ObjectLike = Record<PropertyKey, unknown>

export interface HookHost extends ObjectLike {
  __hooks?: unknown
}

export interface HookContainer extends ObjectLike {
  states: unknown[]
  index: number
  __forcedIndex?: number
  __idMap?: Map<unknown, unknown>
}

export interface HookFrame {
  instance: unknown
  hooks?: HookContainer
}

export interface HookCarrier {
  getCurrentInstance(): unknown
  renderHooks<T>(instance: unknown, render: () => T): T
}

export interface HookContext extends HookCarrier {
  setCurrentInstance(instance: unknown): void
  vaporWithHookId<T>(id: unknown, runner: () => T): T
  withHookSlot<T>(factory: () => T): T
}

export type ComputedGetter<T> = () => T

export interface ComputedOptions<T> {
  get: ComputedGetter<T>
  set?: (value: T) => void
}

export type ComputedInput<T> = ComputedGetter<T> | ComputedOptions<T>

export interface ReadableSignalHandle<T> extends KernelReadonlySignal<T>, ObjectLike {}

export interface ComputedHandle<T> extends KernelWritableSignal<T>, ObjectLike {
  __rueInvalidateComputed?: () => void
}

export interface ComputedHolder<T> {
  arg: ComputedInput<T>
}

export interface ComputedSlot<T> {
  handle: ComputedHandle<T>
  holder: ComputedHolder<T>
}

export type EffectScopeHandle = number

export interface CreateComputedHooksOptions {
  context: HookContext
  reactiveRuntime: unknown
  createComputed: unknown
}

export type EqualityComparator<T> = (previous: T, next: T) => boolean

export interface EqualityOptions<T> {
  equals?: EqualityComparator<T>
}

export interface ReactiveOptions<T> extends EqualityOptions<T> {
  readonly?: boolean
  shallow?: boolean
}

export interface RefLike<T> extends ObjectLike {
  value: T
  __rue_ref__?: true
}

export interface ReadonlyRefLike<T> extends ObjectLike {
  readonly value: T
  __rue_ref__?: true
}

export interface ReactiveProxyMarkers extends ObjectLike {
  __isReactive__?: unknown
  __isReadonly__?: true
  __rue_raw__?: unknown
  __signal__?: unknown
}

export interface TriggerableSignalHandle extends ObjectLike {
  triggerPath(path: readonly PropertyKey[]): void
}

export interface PortableMountHandle extends ObjectLike {
  __rue_mount_id: unknown
}

export interface PortableNodeCollection extends ObjectLike {
  nodes: readonly unknown[]
}

export interface PortableComponentLike extends ObjectLike {
  __rue_component_type: unknown
  props?: unknown
}

export interface PortableBlockInstance extends ObjectLike {
  kind: 'block'
  mount: (...args: unknown[]) => unknown
}

export type PortableBlockFactory = ((...args: unknown[]) => unknown) & {
  kind: 'block-factory'
}

export type PortableRenderable =
  | Node
  | PortableMountHandle
  | PortableNodeCollection
  | PortableComponentLike
  | PortableBlockInstance
  | PortableBlockFactory
  | readonly PortableRenderable[]

export type StateKind = 'reactive' | 'ref' | 'signal'

export interface StateOptions<T> extends EqualityOptions<T> {
  kind?: StateKind
}

export interface ResolvedStateOptions {
  equals?: EqualityComparator<unknown>
  kind: StateKind
}

export interface SignalHandle<T> extends KernelSignalHandle<T>, ObjectLike {}

export interface RefState<T> extends RefLike<T> {}

export type ReactiveState<T> = T extends object ? T : RefState<T>

export type StateInitializer<T> = T | (() => T)

export type StateUpdate<TState, TValue> = TValue | ((state: TState) => TValue | void)

export type StateSetter<TState, TValue> = (update: StateUpdate<TState, TValue>) => void

export type StateTuple<TState, TValue> = [TState, StateSetter<TState, TValue>]

export interface StateSlot {
  created: boolean
  state: unknown
  __wrapped__?: boolean
}

export type HookDependencies = readonly unknown[]

export interface MemoSlot<T> {
  value: T | undefined
  deps: unknown
}

export interface RefSlot<T> {
  current: T
}

export interface StateValueHooks {
  createReactive(initial: unknown, options?: EqualityOptions<unknown>): unknown
  isReactive(value: unknown): boolean
}

export interface CreateStateHooksOptions {
  context: HookContext
  reactiveRuntime: unknown
  values: StateValueHooks
}

export type EffectCleanup = () => void

export type EffectCallback = () => void | EffectCleanup

export type EffectEquals = (previous: unknown, next: unknown) => boolean

export type EffectScheduler = (run: () => void) => void

export interface EffectOptions {
  equals?: EffectEquals
  scheduler?: EffectScheduler
}

export interface EffectHandle extends KernelEffectHandle, ObjectLike {}

export interface EffectSlot {
  type?: symbol
  effect: EffectCallback
  cleanup?: EffectCleanup
  handle?: unknown
  deps?: unknown[]
  equals?: EffectEquals
  scheduler?: EffectScheduler
}

export interface EffectWatchOptions extends EffectOptions {
  immediate: true
}

export interface CreateEffectHooksOptions {
  context: HookContext
  reactiveRuntime: unknown
}

export interface SetupSlot<T> {
  type: symbol
  initialized: boolean
  value: T | undefined
}

export type CustomRefFactory<T> = (
  track: () => void,
  trigger: () => void,
) => {
  get: () => T
  set: (value: T) => void
}

export interface CreateValueHooksOptions {
  reactiveRuntime: unknown
  useSetup<T>(factory: () => T): T
}

export interface ValueFacade extends ObjectLike {
  computed<T>(arg: ComputedInput<T>): ComputedHandle<T>
  customRef<T>(factory: CustomRefFactory<T>, forceGlobal?: boolean): RefLike<T>
  createComputed<T>(arg: ComputedInput<T>): ComputedHandle<T>
  createReactive<T>(initial: T, options?: ReactiveOptions<T>): ReactiveState<T>
  isReadonly(value: unknown): boolean
  isRef(value: unknown): value is RefLike<unknown>
  propsReactive<T>(initial: T, forceGlobal?: boolean): ReactiveState<T>
  reactive<T>(initial: T, options?: ReactiveOptions<T>, forceGlobal?: boolean): ReactiveState<T>
  readonly<T>(initial: T, forceGlobal?: boolean): ReactiveState<T>
  shallowRef<T>(initial: T, options?: EqualityOptions<T>, forceGlobal?: boolean): RefLike<T>
  shallowReadonly<T>(initial: T, forceGlobal?: boolean): ReactiveState<T>
  toRef<T>(source: RefLike<T>): RefLike<T>
  toRef<T>(source: () => T): ReadonlyRefLike<T>
  toRef<T, K extends keyof T>(source: T, key: K, defaultValue?: T[K]): RefLike<T[K]>
  toRef<T>(source: T): RefLike<T>
  toRefs<T extends object>(object: T): { [K in keyof T]: RefLike<T[K]> }
  triggerRef(refValue: unknown): void
}

export interface ValueHooks extends ObjectLike {
  customRef<T>(factory: CustomRefFactory<T>, forceGlobal?: boolean): RefLike<T>
  isProxy(value: unknown): boolean
  isReactive(value: unknown): value is ReactiveProxyMarkers
  isReadonly(value: unknown): boolean
  isRef(value: unknown): value is RefLike<unknown>
  propsReactive<T>(initial: T, forceGlobal?: boolean): ReactiveState<T>
  reactive<T>(initial: T, options?: ReactiveOptions<T>, forceGlobal?: boolean): ReactiveState<T>
  readonly<T>(initial: T, forceGlobal?: boolean): ReactiveState<T>
  ref<T>(initial: T, options?: unknown, forceGlobal?: boolean): RefLike<T>
  shallowReactive<T>(
    initial: T,
    options?: ReactiveOptions<T>,
    forceGlobal?: boolean,
  ): ReactiveState<T>
  shallowReadonly<T>(initial: T, forceGlobal?: boolean): ReactiveState<T>
  toRaw<T>(value: unknown): T
  unref<T>(value: T | RefLike<T>): T
}

export interface ValueHookBundle {
  facade: ValueFacade
  hooks: ValueHooks
}

export type SchedulerRun = () => void

export type WatchFlush = 'pre' | 'post' | 'sync'

export interface WatchEffectOptions {
  scheduler?: (run: SchedulerRun) => void
  debounce?: number
  flush?: WatchFlush
}

export interface WatchOptions<T = unknown> extends WatchEffectOptions {
  immediate?: boolean
  equals?: EqualityComparator<T>
}

export type WatchCallback<T = unknown> = {
  bivarianceHack(newValue: T, oldValue: T): void
}['bivarianceHack']

export type WatchSource<T = unknown> =
  | ReadableSignalHandle<T>
  | RefLike<T>
  | ReadonlyRefLike<T>
  | (() => T)

export type WatchSourceValue<T> = T extends WatchSource<infer TValue> ? TValue : T

export type WatchMultiSource = Array<WatchSource<unknown> | unknown>

export type WatchMultiValues<TSources extends readonly unknown[]> = {
  -readonly [K in keyof TSources]: WatchSourceValue<TSources[K]>
}

export interface WatchFunction {
  <TSources extends readonly unknown[]>(
    source: readonly [...TSources],
    handler: WatchCallback<WatchMultiValues<TSources>>,
    options?: WatchOptions<WatchMultiValues<TSources>> | null,
  ): EffectHandle
  <T>(
    source: WatchSource<T>,
    handler: WatchCallback<T>,
    options?: WatchOptions<T> | null,
  ): EffectHandle
  <T>(source: T, handler: WatchCallback<T>, options?: WatchOptions<T> | null): EffectHandle
}

export interface WatchEffectFunction {
  (callback: () => void, options?: WatchEffectOptions | null): EffectHandle
}

export interface WatchFlushEffectFunction {
  (callback: () => void, options?: Pick<WatchEffectOptions, 'scheduler'> | null): EffectHandle
}

export interface EffectScope {
  readonly active: boolean
  run<T>(fn: () => T): T | undefined
  stop(): void
  dispose(): void
}

export interface EffectScopeDebugState {
  activeScopeHandles: number
  cachedScopeHandles: number
  stoppedScopeIds: number
}

export interface SignalWrapperRegistryDebugState {
  registryKeys: number
  liveWrappers: number
  hasFinalizationRegistry: boolean
}

export interface DebuggerEvent<TType extends PropertyKey = PropertyKey> {
  effect: unknown
  target: unknown
  type: TType
  key: unknown
}

export type DebuggerHook = (event: DebuggerEvent<'get'>) => void

export interface SignalWrapperRegistryEntry<TSignal extends ObjectLike = ObjectLike> {
  ref: TSignal | WeakRef<TSignal>
  token: object
}

export interface SignalHandleConstructorLike {
  prototype?: ObjectLike
}

export interface ReactiveKernelEffectCapabilities {
  createEffect(callback: () => void, options?: WatchEffectOptions | null): EffectHandle
  watchEffect(callback: () => void, options?: WatchEffectOptions | null): EffectHandle
  watch(
    source: unknown,
    handler: WatchCallback<unknown>,
    options?: WatchOptions<unknown> | null,
  ): EffectHandle
  onCleanup(cleanup: EffectCleanup): void
  onWatcherCleanup(cleanup: EffectCleanup, failSilently?: boolean): void
  untrack<T>(callback: () => T): T
}

export interface ReactiveKernelScopeCapabilities {
  __rueCreateDetachedEffectScope(): EffectScopeHandle
  __ruePushEffectScope(scopeId: EffectScopeHandle): void
  __ruePopEffectScope(): void
  __rueDisposeEffectScope(scopeId: EffectScopeHandle): void
  __rueGetCurrentEffectScope(): EffectScopeHandle | undefined
  onScopeDispose(cleanup: EffectCleanup, failSilently?: boolean): void
}

export interface ReactiveKernelSignalCapabilities {
  SignalHandle?: SignalHandleConstructorLike
  createSignal<T>(
    initial: T,
    options?: EqualityOptions<T> | null,
    forceGlobal?: boolean,
  ): SignalHandle<T>
  __rueCurrentEffectId(): number | undefined
}

export interface ReactiveKernelSchedulingCapabilities {
  nextTick<T = void>(callback?: () => T | Promise<T>): Promise<T | void>
}

export type ReactiveKernel = object &
  Partial<
    ReactiveKernelEffectCapabilities &
      ReactiveKernelScopeCapabilities &
      ReactiveKernelSignalCapabilities &
      ReactiveKernelSchedulingCapabilities
  >

export interface ComputedFunction {
  <T>(getter: ComputedGetter<T>, forceGlobal?: boolean): ComputedHandle<T>
  <T>(options: ComputedOptions<T>, forceGlobal?: boolean): ComputedHandle<T>
}

export interface CreateComputedFunction {
  <T>(getter: ComputedGetter<T>): ComputedHandle<T>
  <T>(options: ComputedOptions<T>): ComputedHandle<T>
}

export interface CreateSignalFunction {
  <T>(initial: T, options?: EqualityOptions<T> | null, forceGlobal?: boolean): SignalHandle<T>
}

export interface SignalFunction extends CreateSignalFunction {}

export interface CustomRefFunction {
  <T>(factory: CustomRefFactory<T>, forceGlobal?: boolean): RefLike<T>
}

export interface UseEffectFunction {
  (
    effect: EffectCallback,
    dependencies?: readonly unknown[] | null,
    options?: EffectOptions | null,
  ): void
}

export interface UseMemoFunction {
  <T>(factory: () => T, dependencies?: readonly unknown[]): T
}

export interface UseCallbackFunction {
  <TArgs extends unknown[], TResult>(
    callback: (...args: TArgs) => TResult,
    dependencies?: readonly unknown[],
  ): (...args: TArgs) => TResult
}

export interface UseRefFunction {
  <T = undefined>(initial?: T): RefSlot<T | undefined>
}

export interface UseSignalFunction {
  <T>(initial: StateInitializer<T>, options?: StateOptions<T>): StateTuple<SignalHandle<T>, T>
}

export interface UseStateFunction {
  <T>(
    initial: StateInitializer<T>,
    options: StateOptions<T> & { kind: 'signal' },
  ): StateTuple<SignalHandle<T>, T>
  <T>(
    initial: StateInitializer<T>,
    options: StateOptions<T> & { kind: 'ref' },
  ): StateTuple<RefState<T>, T>
  <T>(
    initial: StateInitializer<T>,
    options?: StateOptions<T> & { kind?: 'reactive' },
  ): StateTuple<ReactiveState<T>, T>
}

export interface ReactiveFacadeRuntime {
  __rueCurrentEffectId(): number | undefined
  __rueGetEffectScopeDebugState(): EffectScopeDebugState
  computed: ComputedFunction
  customRef: CustomRefFunction
  createSignal: CreateSignalFunction
  createComputed: CreateComputedFunction
  createReactive<T>(initial: T, options?: ReactiveOptions<T>): ReactiveState<T>
  effectScope(detached?: boolean): EffectScope
  getCurrentScope(): EffectScope | undefined
  __rueDisposeEffectScope(scopeId: EffectScopeHandle): void
  isRef(value: unknown): value is RefLike<unknown>
  isReadonly(value: unknown): boolean
  nextTick<T = void>(callback?: () => T | Promise<T>): Promise<T | void>
  onWatcherCleanup(cleanup: EffectCleanup, failSilently?: boolean): void
  onRenderTracked(callback: DebuggerHook): (() => void) | undefined
  onScopeDispose(cleanup: EffectCleanup, failSilently?: boolean): void
  propsReactive<T>(initial: T, forceGlobal?: boolean): ReactiveState<T>
  reactive<T>(initial: T, options?: ReactiveOptions<T>, forceGlobal?: boolean): ReactiveState<T>
  readonly<T>(initial: T, forceGlobal?: boolean): ReactiveState<T>
  shallowRef<T>(initial: T, options?: EqualityOptions<T> | null, forceGlobal?: boolean): RefLike<T>
  shallowReadonly<T>(initial: T, forceGlobal?: boolean): ReactiveState<T>
  signal: SignalFunction
  toRef: ValueFacade['toRef']
  toRefs: ValueFacade['toRefs']
  triggerRef: ValueFacade['triggerRef']
  watch: WatchFunction
  watchEffect: WatchEffectFunction
  watchPostEffect: WatchFlushEffectFunction
  watchSyncEffect: WatchFlushEffectFunction
}

export interface ReactiveHookRuntime {
  __rueDisposeHookScopeForInstance(instance: unknown): void
  computed: ComputedFunction
  customRef: CustomRefFunction
  getCurrentInstance(): unknown
  setCurrentInstance(instance: unknown): void
  isProxy(value: unknown): boolean
  isReactive(value: unknown): value is ReactiveProxyMarkers
  isReadonly(value: unknown): boolean
  isRef(value: unknown): value is RefLike<unknown>
  propsReactive<T>(initial: T, forceGlobal?: boolean): ReactiveState<T>
  reactive<T>(initial: T, options?: ReactiveOptions<T>, forceGlobal?: boolean): ReactiveState<T>
  readonly<T>(initial: T, forceGlobal?: boolean): ReactiveState<T>
  ref<T>(initial: T, options?: unknown, forceGlobal?: boolean): RefLike<T>
  shallowReactive<T>(
    initial: T,
    options?: ReactiveOptions<T>,
    forceGlobal?: boolean,
  ): ReactiveState<T>
  shallowReadonly<T>(initial: T, forceGlobal?: boolean): ReactiveState<T>
  toRaw<T>(value: unknown): T
  unref<T>(value: T | RefLike<T>): T
  useCallback: UseCallbackFunction
  useEffect: UseEffectFunction
  useMemo: UseMemoFunction
  useRef: UseRefFunction
  useSetup<T>(factory: () => T): T
  useSignal: UseSignalFunction
  useState: UseStateFunction
  vaporWithHookId<T>(id: unknown, runner: () => T): T
  withHookSlot<T>(factory: () => T): T
}

export interface ReactiveFacade<
  TRuntime extends object = ReactiveKernel,
> extends ReactiveFacadeRuntime {
  hooks: ReactiveHookRuntime
  __rueGetSignalWrapperRegistryDebugState(): SignalWrapperRegistryDebugState
  normalizeRenderTriggeredEvent(event: unknown): DebuggerEvent
  useEffect: UseEffectFunction
  useCallback: UseCallbackFunction
  useMemo: UseMemoFunction
  useRef: UseRefFunction
  useSignal: UseSignalFunction
  useState: UseStateFunction
  default: TRuntime & ReactiveFacadeRuntime
}
