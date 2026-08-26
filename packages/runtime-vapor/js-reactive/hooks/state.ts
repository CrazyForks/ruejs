import type {
  CreateStateHooksOptions,
  EqualityComparator,
  EqualityOptions,
  HookDependencies,
  MemoSlot,
  ObjectLike,
  ReactiveState,
  RefSlot,
  RefState,
  ResolvedStateOptions,
  SignalHandle,
  StateInitializer,
  StateKind,
  StateOptions,
  StateSlot,
  StateTuple,
} from '../types.js'

const isObject = (value: unknown): value is ObjectLike =>
  typeof value === 'object' && value !== null

const isReflectTarget = (value: unknown): value is ObjectLike =>
  (typeof value === 'object' || typeof value === 'function') && value !== null

const safeGet = (value: unknown, key: PropertyKey): unknown => {
  if (!isReflectTarget(value)) return undefined
  try {
    const result: unknown = Reflect.get(value, key)
    return result
  } catch {
    return undefined
  }
}

const safeSet = (value: unknown, key: PropertyKey, next: unknown): void => {
  if (!isReflectTarget(value)) return
  try {
    Reflect.set(value, key, next)
  } catch {}
}

const callOrUndefined = (fn: unknown, receiver: unknown, args: readonly unknown[]): unknown => {
  if (typeof fn !== 'function') return undefined
  try {
    const result: unknown = Reflect.apply(fn, receiver, args)
    return result
  } catch {
    return undefined
  }
}

/** Resolve a dependency to the value used in memo snapshots. */
export const toHookDependencyValue = (value: unknown): unknown => {
  if (typeof value === 'function') {
    return callOrUndefined(value, null, [])
  }
  if (!isObject(value)) {
    return value
  }

  const getter = safeGet(value, 'get')
  if (safeGet(value, '__rue_ref__') === true && typeof getter === 'function') {
    return callOrUndefined(getter, value, [])
  }

  const refValue = safeGet(value, 'value')
  if (refValue !== undefined) {
    return refValue
  }
  if (typeof getter === 'function') {
    return callOrUndefined(getter, value, [])
  }
  return value
}

/** Normalize dependency arrays once for memo/callback and later stateful Hooks. */
export const normalizeHookDependencies = (dependencies: unknown): unknown =>
  Array.isArray(dependencies) ? dependencies.map(toHookDependencyValue) : dependencies

/** Compare normalized dependency arrays item by item with `Object.is`. */
export const sameHookDependencies = (previous: unknown, next: unknown): boolean => {
  if (!Array.isArray(next) || previous === undefined) {
    return false
  }

  const previousArray = Array.from(previous as ArrayLike<unknown> | Iterable<unknown>)
  if (previousArray.length !== next.length) {
    return false
  }
  return next.every((value, index) => Object.is(value, previousArray[index]))
}

const isEqualityComparator = (value: unknown): value is EqualityComparator<unknown> =>
  typeof value === 'function'

const isStateKind = (value: unknown): value is StateKind =>
  value === 'reactive' || value === 'ref' || value === 'signal'

/**
 * useState 选项
 */
const stateOptions = (options: unknown): ResolvedStateOptions => {
  // `equals` 控制更新去重，`kind` 决定 reactive/ref/signal 容器类型。
  let equals: EqualityComparator<unknown> | undefined
  let kind: StateKind = 'reactive'
  if (isObject(options)) {
    // 取出 equals 字段并尝试转换为 JS 函数
    const candidateEquals = safeGet(options, 'equals')
    if (isEqualityComparator(candidateEquals)) {
      equals = candidateEquals
    }
    // 取出 kind 字段（字符串），决定后续创建的容器形态
    const candidateKind = safeGet(options, 'kind')
    if (isStateKind(candidateKind)) {
      kind = candidateKind
    } else if (typeof candidateKind === 'string') {
      kind = 'ref'
    }
  }
  return { equals, kind }
}

const equalsOptions = (
  equals: EqualityComparator<unknown> | undefined,
): EqualityOptions<unknown> | undefined => (equals ? { equals } : undefined)

const setSignalValue = (signal: unknown, value: unknown): void => {
  const setter = safeGet(signal, 'set')
  if (typeof setter === 'function') {
    callOrUndefined(setter, signal, [value])
  }
}

const replaceReactiveValue = (state: unknown, value: unknown): void => {
  const signal = safeGet(state, '__signal__')
  const setter = safeGet(signal, 'set')
  if (typeof setter === 'function') {
    // 优先通过隐藏的 __signal__ 句柄整体替换根对象。
    callOrUndefined(setter, signal, [value])
    return
  }
  if (!isObject(value) || !isObject(state)) {
    return
  }

  for (const key of Object.keys(state)) {
    Reflect.deleteProperty(state, key)
  }
  for (const key of Object.keys(value)) {
    safeSet(state, key, safeGet(value, key))
  }
}

const setWrappedReactiveValue = (state: unknown, value: unknown): void => {
  safeSet(state, 'value', isObject(value) ? safeGet(value, 'value') : value)
}

/** Build synchronous state, cache, and callback Hooks over one facade-local slot context. */
export const createStateHooks = ({ context, reactiveRuntime, values }: CreateStateHooksOptions) => {
  const createSignal = <T>(
    initial: T,
    options: EqualityOptions<unknown> | undefined,
  ): SignalHandle<T> => {
    const factory = safeGet(reactiveRuntime, 'createSignal')
    if (typeof factory !== 'function') {
      throw new TypeError('reactiveRuntime.createSignal is not a function')
    }
    const result: unknown = Reflect.apply(factory, reactiveRuntime, [initial, options])
    return result as SignalHandle<T>
  }
  const createReactive = values.createReactive
  const isReactive = values.isReactive

  /**
   * useState 钩子：统一的轻量状态容器（支持 reactive/ref/signal 三种形态）
   *
   * 设计概览：
   * - 默认形态为 `reactive`：当初始值为对象/数组时直接返回其响应式代理；当为原始类型时自动包裹为 `{ value }` 并返回其代理。
   * - 可选 `kind`：
   *   - `'reactive'`：对象/数组的响应式代理；原始类型将自动包裹为 `{ value }`
   *   - `'ref'`：总是返回 `{ value }` 的响应式代理，便于统一读写
   *   - `'signal'`：返回底层 `SignalHandle`，适合需要精细控制 get/set/update/path 的场景
   * - 等值比较：通过 `options.equals(prev, next)` 自定义比较逻辑，返回 `true` 表示值相等，不触发订阅者。
   *
   * 使用示例（JavaScript / TypeScript）：
   * // reactive（默认）
   * const [state, setState] = useState({ user: { name: 'A' }, items: ['x'] })
   * state.user.name = 'B'        // 响应式写入
   * setState({ user: { name: 'C' }, items: ['y'] })  // 整体替换
   * setState(prev => ({ ...prev, user: { ...prev.user, name: 'D' } })) // 基于回调更新
   *
   * // ref（原始类型亦可统一为 { value }）
   * const [count, setCount] = useState(0, { kind: 'ref' })
   * console.log(count.value)     // 0
   * setCount(1)                  // 触发订阅者
   * setCount(ref => { ref.value += 1 }) // 2
   *
   * // signal（底层句柄）
   * const [sig, setSig] = useState({ a: 1 }, { kind: 'signal' })
   * console.log(sig.get())       // { a: 1 }
   * sig.set({ a: 2 })            // 触发订阅者
   * setSig(handle => ({ a: handle.peek().a + 1 })) // { a: 3 }
   * sig.setPath('a', 4)          // 路径写入
   * console.log(sig.get())       // { a: 4 }
   *
   * // 自定义等值比较（默认使用 shallowEqual）
   * const [state2, setState2] = useState({ a: 1, b: 2 }, { kind: 'reactive', equals: (prev, next) => prev.a === next.a })
   * setState2({ a: 1, b: 3 })   // 不触发订阅者，因为 a 未改变
   * setState2({ a: 2, b: 4 })   // 触发订阅者，因为 a 改变
   */
  function useState<T>(
    initial: StateInitializer<T>,
    options: StateOptions<T> & { kind: 'signal' },
  ): StateTuple<SignalHandle<T>, T>
  function useState<T>(
    initial: StateInitializer<T>,
    options: StateOptions<T> & { kind: 'ref' },
  ): StateTuple<RefState<T>, T>
  function useState<T>(
    initial: StateInitializer<T>,
    options?: StateOptions<T> & { kind?: 'reactive' },
  ): StateTuple<ReactiveState<T>, T>
  function useState(initial: unknown, options?: unknown): unknown {
    // 获取当前组件实例的 hooks 槽位（lazy 初始化）
    const { equals, kind } = stateOptions(options)
    const slot = context.withHookSlot<StateSlot>(() => ({
      // 该槽位对象存放两件事：
      // - created: 是否已经创建过状态容器
      // - state:   实际的状态对象/信号句柄
      created: false,
      state: undefined,
    }))

    // 读取是否已经创建过
    if (!slot.created) {
      // 首次创建：
      // - 支持惰性初始值（当 initial 为函数时，调用并取其返回值作为初始状态）
      // - 这样可以避免在组件 setup 阶段做不必要的计算，符合常见 Hook 习惯用法
      const initialValue =
        typeof initial === 'function' ? callOrUndefined(initial, null, []) : initial
      // 标记初始值是否为对象/数组，用于 reactive 模式下的“原始类型包裹”判断
      const initialIsObject = isObject(initialValue)
      // 根据 kind 创建不同形态的状态容器
      let state: unknown
      if (kind === 'signal') {
        // 直接创建基础信号
        state = createSignal(initialValue, equalsOptions(equals))
      } else if (kind === 'reactive') {
        // 创建响应式对象/数组代理
        state =
          initialIsObject && isReactive(initialValue)
            ? initialValue
            : createReactive(initialValue, equalsOptions(equals))
      } else {
        // 默认使用 ref：包裹为 { value } 并创建响应式代理，等值比较针对 value 字段
        const refEquals = equals
          ? (previous: unknown, next: unknown) => {
              // 将用户提供的 equals 包装为针对 {value} 的比较器
              return equals(safeGet(previous, 'value'), safeGet(next, 'value'))
            }
          : undefined
        // 将初始值包裹为 { value } 以统一写入路径
        state = createReactive({ value: initialValue }, equalsOptions(refEquals))
      }

      // 把创建好的状态写入 Hook 槽位，并置 created=true
      slot.state = state
      slot.created = true
      // 标记是否为 reactive 对原始类型的包裹形态（{ value }）
      slot.__wrapped__ = kind === 'reactive' && !initialIsObject
    }

    // 取出已创建的状态对象（可能是代理或信号句柄）
    const state = slot.state
    const isSignal = kind === 'signal'
    const isReactiveKind = kind === 'reactive'
    // reactive_wrapped_flag = true 说明当前 reactive 是对原始类型的 { value } 包裹
    const isWrappedReactive = slot.__wrapped__ === true
    // setter：支持直接赋值与基于回调计算两种形式
    // - signal：委托底层句柄的 set/update
    // - reactive：优先通过隐藏的 __signal__ 整体替换；回退为浅合并
    // - ref：写入 { value } 字段
    const setter = (update: unknown): void => {
      // 情况一：传入 updater 函数（接收当前状态，返回新值或执行就地修改）
      const value = typeof update === 'function' ? callOrUndefined(update, null, [state]) : update
      if (typeof update === 'function' && value === undefined) {
        return
      }

      if (isSignal) {
        // 底层信号：直接调用 set(newValue)
        setSignalValue(state, value)
      } else if (isReactiveKind) {
        if (isWrappedReactive) {
          // reactive 包裹原始类型：统一写入到 .value
          setWrappedReactiveValue(state, value)
        } else {
          replaceReactiveValue(state, value)
        }
      } else {
        // ref：仅更新 .value
        safeSet(state, 'value', value)
      }
      return
    }

    return [state, setter]
  }

  /**
   * useSignal：等价于 `useState(initial, { kind: 'signal', ...options })`
   *
   * 用途：
   * - 以“底层信号句柄”的形式管理状态，适合需要精细控制 `get/set/update/setPath/peek` 的场景
   * - 支持 `equals(prev, next)` 自定义等值比较，返回 `true` 表示不触发订阅者
   *
   * 示例：
   * const [sig, setSig] = useSignal({ a: 1 })
   * console.log(sig.get())       // { a: 1 }
   * setSig({ a: 2 })             // 触发订阅者
   * setSig(h => ({ a: h.peek().a + 1 })) // { a: 3 }
   * sig.setPath('a', 4)
   * console.log(sig.get())       // { a: 4 }
   */
  const useSignal = <T>(
    initial: StateInitializer<T>,
    options?: StateOptions<T>,
  ): StateTuple<SignalHandle<T>, T> => {
    // 将传入的 options 扩展为 { kind: 'signal', ...options }
    // - 若未传 options：创建一个空对象并写入 kind
    // - 若传入的是对象：直接在该对象上写入 kind
    const normalizedOptions: ObjectLike = isObject(options) ? options : {}
    safeSet(normalizedOptions, 'kind', 'signal')
    // 复用 useState 的创建与返回逻辑，得到 [SignalHandle, setter]
    return useState(initial, normalizedOptions as unknown as StateOptions<T> & { kind: 'signal' })
  }

  /**
   * useRef：在 Hook 插槽上持久化 { current } 容器
   */
  const useRef = <T = undefined>(initial?: T): RefSlot<T | undefined> => {
    // 工厂函数：仅在该 Hook 的插槽尚未创建时执行一次
    // 创建一个普通对象，并将初始值写入 `current`
    const factory = (): RefSlot<T | undefined> => ({ current: initial })
    // 使用 Hook 插槽：首次返回工厂创建的对象；后续调用返回同一个对象（保持引用稳定）
    const slot = context.withHookSlot(factory)
    // 返回持久化的 { current } 容器；该容器本身不具备响应式能力，仅用于存放任意值
    return slot
  }

  /**
   * useMemo：根据依赖数组缓存计算结果，等值依赖不重新计算
   */
  function useMemo<T>(factory: () => T, dependencies?: HookDependencies): T
  function useMemo<T>(factory: () => T, dependencies: unknown): T {
    // 在 Hook 插槽上初始化/复用一个对象，保存计算值与依赖快照
    const slot = context.withHookSlot<MemoSlot<T>>(() => ({
      // 初始值为空（未计算）
      value: undefined,
      // 初始依赖为空（未记录）
      deps: undefined,
    }))
    // 规范化依赖：
    // - 若为数组：对每一项执行 `toValue`（函数调用/读取对象 value/get）
    // - 若非数组：保留原值（视为“不稳定依赖”，后续强制重新计算）
    const normalizedDependencies = normalizeHookDependencies(dependencies)
    // 比对是否发生变化：缺失旧依赖、类型不为数组、长度变化、逐项非 Object.is
    if (!sameHookDependencies(slot.deps, normalizedDependencies)) {
      // 发生变化：重新计算并写入 value 与 deps
      const value: unknown = Reflect.apply(factory, null, [])
      slot.value = value as T
      slot.deps = Array.isArray(normalizedDependencies)
        ? (() => {
            // 拷贝当前依赖快照，避免后续被外部修改影响比较
            return normalizedDependencies.slice()
          })()
        : normalizedDependencies
    }
    return slot.value as T
  }

  /**
   * useCallback：根据依赖数组缓存回调函数的引用
   */
  const useCallback = <TArgs extends unknown[], TResult>(
    callback: (...args: TArgs) => TResult,
    dependencies?: HookDependencies,
  ): ((...args: TArgs) => TResult) => {
    // 将传入的函数包装为“工厂函数”，供 useMemo 缓存其返回值（实际上就是函数本身的稳定引用）
    const factory = () => callback
    // useMemo 会根据依赖数组判断是否需要重新计算；这里计算的值是 `func` 的克隆引用
    const stableCallback = useMemo(factory, dependencies)
    // 返回稳定的函数引用，避免子组件或 effect 因引用变化而重跑
    return stableCallback
  }

  return {
    useCallback,
    useMemo,
    useRef,
    useSignal,
    useState,
  }
}
