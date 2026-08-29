import type {
  ComputedHandle,
  ComputedHolder,
  ComputedInput,
  ComputedOptions,
  ComputedSlot,
  CreateComputedHooksOptions,
  EffectScopeHandle,
  ObjectLike,
} from '../types.js'

const HOOK_EFFECT_SCOPE_KEY = '__hook_effect_scope_id'

const isObjectLike = (value: unknown): value is ObjectLike =>
  (typeof value === 'object' || typeof value === 'function') && value != null

const safeGet = (value: unknown, key: PropertyKey): unknown => {
  if (!isObjectLike(value)) return undefined
  try {
    return Reflect.get(value, key)
  } catch {
    return undefined
  }
}

const currentComputedGetter = <T>(holder: ComputedHolder<T>): T | undefined => {
  const arg = holder.arg
  const getter = typeof arg === 'function' ? arg : safeGet(arg, 'get')
  if (typeof getter !== 'function') return undefined
  const value: unknown = Reflect.apply(getter, null, [])
  return value as T
}

const currentComputedSetter = <T>(holder: ComputedHolder<T>, value: T): void => {
  const setter = safeGet(holder.arg, 'set')
  if (typeof setter === 'function') Reflect.apply(setter, null, [value])
}

const hasSetter = <T>(
  arg: ComputedInput<T>,
): arg is ComputedOptions<T> & {
  set: (value: T) => void
} => isObjectLike(arg) && typeof safeGet(arg, 'set') === 'function'

const isEffectScopeHandle = (value: unknown): value is EffectScopeHandle =>
  typeof value === 'number' && Number.isInteger(value)

const callOptionalRuntimeMethod = (
  runtime: unknown,
  method: PropertyKey,
  args: unknown[] = [],
): unknown => {
  const callable = safeGet(runtime, method)
  return typeof callable === 'function' ? Reflect.apply(callable, runtime, args) : undefined
}

const createComputedHandle = <T>(factory: unknown, arg: ComputedInput<T>): ComputedHandle<T> => {
  if (typeof factory !== 'function') {
    throw new TypeError('computed() requires a callable reactive graph factory.')
  }
  const handle: unknown = Reflect.apply(factory, undefined, [arg])
  if (
    !isObjectLike(handle) ||
    typeof safeGet(handle, 'get') !== 'function' ||
    typeof safeGet(handle, 'peek') !== 'function'
  ) {
    throw new TypeError('computed() requires an object-like reactive graph handle.')
  }
  return handle as ComputedHandle<T>
}

/** Build the computed Hook from the real Wasm graph factory and one invalidation primitive. */
export const createComputedHooks = ({
  context,
  reactiveRuntime,
  createComputed,
}: CreateComputedHooksOptions) => {
  const currentInstance = () => context.getCurrentInstance()

  const withPersistentHookScope = <T>(instance: ObjectLike, factory: () => T): T => {
    let scopeId = safeGet(instance, HOOK_EFFECT_SCOPE_KEY)
    if (!isEffectScopeHandle(scopeId)) {
      scopeId = callOptionalRuntimeMethod(reactiveRuntime, '__rueCreateDetachedEffectScope')
      if (!isEffectScopeHandle(scopeId)) {
        return factory()
      }
      Reflect.set(instance, HOOK_EFFECT_SCOPE_KEY, scopeId)
    }

    callOptionalRuntimeMethod(reactiveRuntime, '__ruePushEffectScope', [scopeId])
    try {
      return factory()
    } finally {
      callOptionalRuntimeMethod(reactiveRuntime, '__ruePopEffectScope')
    }
  }

  const createSlot = <T>(instance: ObjectLike, arg: ComputedInput<T>): ComputedSlot<T> => {
    const holder: ComputedHolder<T> = { arg }
    const dynamicArg = hasSetter(arg)
      ? {
          get: () => currentComputedGetter(holder) as T,
          set: (value: T) => currentComputedSetter(holder, value),
        }
      : { get: () => currentComputedGetter(holder) as T }
    const handle = withPersistentHookScope(instance, () =>
      createComputedHandle(createComputed, dynamicArg),
    )
    return { handle, holder }
  }

  /**
   * 创建计算属性
   * - 参数：可为函数 `() => any`，或对象 `{ get: () => any }`
   * 返回：一个只读信号句柄（通过 get/peek 读取，内部通过 effect 驱动更新）
   * 示例（JavaScript）：
   * ```javascript
   * const count = signal(1);
   * const double = computed(() => count.get() * 2);
   *
   * createEffect(() => {
   *   console.log('double =', double.get());
   * });
   *
   * count.set(2); // double 将变为 4 并触发订阅者
   * ```
   * 更多用法示例：
   *
   * 1) 对象参数（只读 getter）：
   * ```javascript
   * const first = signal('John');
   * const last = signal('Doe');
   * const fullName = computed({
   *   get: () => first.get() + ' ' + last.get()
   * });
   * createEffect(() => {
   *   console.log('fullName =', fullName.get()); // John Doe
   * });
   * ```
   *
   * 2) 通过更新源信号实现“可写效果”（模拟 Vue3 的 setter 行为）：
   * ```javascript
   * const setFullName = (nv) => {
   *   const [f, l] = nv.split(' ');
   *   first.set(f);
   *   last.set(l);
   * };
   * setFullName('David Smith'); // fullName 将变为 "David Smith"
   * ```
   *
   * 3) 直接使用 `{ get, set }` 创建“可写 computed”，支持 `.set(value)`：
   * ```javascript
   * const fullName = computed({
   *   get: () => first.get() + ' ' + last.get(),
   *   set: (nv) => {
   *     const [f, l] = nv.split(' ');
   *     first.set(f);
   *     last.set(l);
   *   }
   * });
   * fullName.set('David Smith'); // 将调用你的 set 更新源信号，并重算派生值
   * ```
   */
  const computed = <T>(arg: ComputedInput<T>, forceGlobal?: boolean): ComputedHandle<T> => {
    const instance = currentInstance()
    if (forceGlobal === true || !isObjectLike(instance)) {
      // 当没有当前组件实例或明确要求强制全局时，直接创建并返回只读/可写计算属性句柄
      return createComputedHandle(createComputed, arg)
    }

    // 组件内 computed 需要两层复用：
    // 1) hook 槽位复用同一个句柄；
    // 2) 底层 effect 绑定到持久 hook scope，而不是每轮 render scope。
    const factory = () => createSlot(instance, arg)
    const slot = context.getCurrentInstance() != null ? context.withHookSlot(factory) : factory()

    slot.holder.arg = arg
    // getter 在重渲染时可能捕获了新的闭包，显式标脏让下次读取走新 getter。
    const invalidate = safeGet(slot.handle, '__rueInvalidateComputed')
    if (typeof invalidate !== 'function') {
      throw new Error(
        'computed() requires __rueInvalidateComputed support from @rue-js/runtime-vapor.',
      )
    }
    Reflect.apply(invalidate, slot.handle, [])
    return slot.handle
  }

  return { computed }
}
