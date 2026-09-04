import type {
  CreateEffectHooksOptions,
  EffectCallback,
  EffectCleanup,
  EffectEquals,
  EffectHandle,
  EffectOptions,
  EffectScheduler,
  EffectSlot,
  EffectWatchOptions,
  ObjectLike,
} from '../types.js'

/*
useEffect 钩子（仿 React）设计说明

- 目标：提供与 React `useEffect` 等价的行为，但以 Vapor 的响应式底层实现（`watch([...])`）。
- 依赖收集：将 `deps` 归一化为 `watch` 的“来源数组”：
  - 函数：直接作为 getter 使用；
  - 含 `get` 方法的对象：视为信号句柄/只读信号，调用其 `get()`；
  - 含 `value` 字段的对象（Ref 形态）：包装为 `() => obj.value` 的 getter；
  - 其他常量：直接作为数组元素（常量不会触发变化）。
- 首次行为：设置 `immediate: true`，创建后立即运行一次（旧值为 `undefined`），与 React 初次执行一致。
- 清理机制：若 effect 返回函数，则通过 `onCleanup()` 注册，确保在下一次重跑前或 dispose/unmount 时执行。
- 等值与调度：支持 `options.equals(prev, next)` 覆盖默认逐项浅比较；支持 `options.scheduler(run)` 自定义调度时机。
*/

const isObjectLike = (value: unknown): value is ObjectLike =>
  (typeof value === 'object' || typeof value === 'function') && value !== null

const safeGet = (value: unknown, key: PropertyKey): unknown => {
  if (!isObjectLike(value)) return undefined
  try {
    const result: unknown = Reflect.get(value, key)
    return result
  } catch {
    return undefined
  }
}

const callIgnoringError = (
  fn: unknown,
  receiver: unknown,
  args: readonly unknown[] = [],
): unknown => {
  if (typeof fn !== 'function') return undefined
  try {
    const result: unknown = Reflect.apply(fn, receiver, args)
    return result
  } catch {
    return undefined
  }
}

const rawDependencies = (dependencies: unknown): unknown[] =>
  Array.isArray(dependencies) ? dependencies : []

// 依赖项归一化：将任意 `deps` 元素转换为 `watch` 可理解的来源
// - Function：直接返回；
// - 对象且含 `get`：视为信号句柄，直接返回；
// - 对象且含 `value`：视为 Ref，包装为 `() => obj.value`；
// - 其他：常量值，直接返回。
const normalizeDependencySource = (dependency: unknown): unknown => {
  if (typeof dependency === 'function') {
    return dependency
  }
  if (!isObjectLike(dependency)) {
    return dependency
  }

  if (typeof safeGet(dependency, 'get') === 'function') {
    return dependency
  }
  if (safeGet(dependency, 'value') !== undefined) {
    // 将 { value } 转换为 getter 函数，供 watch 统一侦听
    return () => safeGet(dependency, 'value')
  }
  return dependency
}

const isDynamicDependency = (dependency: unknown): boolean => {
  if (typeof dependency === 'function') {
    return true
  }
  return (
    isObjectLike(dependency) &&
    (typeof safeGet(dependency, 'get') === 'function' || safeGet(dependency, 'value') !== undefined)
  )
}

const sameDependencySources = (previous: unknown, next: readonly unknown[]): boolean => {
  if (!Array.isArray(previous) || previous.length !== next.length) {
    return false
  }
  return next.every((dependency, index) => {
    const previousDependency: unknown = previous[index]
    if (isDynamicDependency(previousDependency) && isDynamicDependency(dependency)) {
      // 这类 deps 自身已经是“动态源”（getter/signal/ref），watch 会在内部追踪它们。
      // 对组件重渲染来说，按槽位位置稳定即可，避免每次 render 因 wrapper/闭包对象变化而重建 watch。
      return true
    }
    return Object.is(previousDependency, dependency)
  })
}

interface EffectOptionFunctions {
  equals: EffectEquals
  scheduler: EffectScheduler
}

const optionFunction = <K extends keyof EffectOptionFunctions>(
  options: unknown,
  key: K,
): EffectOptionFunctions[K] | undefined => {
  if (!isObjectLike(options)) {
    return undefined
  }
  const candidate = safeGet(options, key)
  return typeof candidate === 'function' ? (candidate as EffectOptionFunctions[K]) : undefined
}

const sameOptionalFunction = (previous: unknown, next: unknown): boolean =>
  typeof next === 'function' ? Object.is(previous, next) : previous == null

const isEffectHandle = (handle: unknown): handle is EffectHandle => isObjectLike(handle)

const disposeHandle = (handle: unknown): void => {
  if (!isEffectHandle(handle)) return
  const dispose = safeGet(handle, 'dispose')
  if (typeof dispose === 'function') {
    callIgnoringError(dispose, handle)
  }
}

const runCleanup = (slot: EffectSlot): void => {
  const cleanup = slot.cleanup
  slot.cleanup = undefined
  if (typeof cleanup === 'function') {
    callIgnoringError(cleanup, null)
  }
}

const disposeSlot = (slot: EffectSlot): void => {
  const handle = slot.handle
  slot.handle = undefined
  disposeHandle(handle)
  runCleanup(slot)
}

/** Build `useEffect` scheduling and cleanup over the real reactive watch kernel. */
export const createEffectHooks = ({ context, reactiveRuntime }: CreateEffectHooksOptions) => {
  const effectSlot = Symbol('rue.effectSlot')

  const createEffectWatch = (
    slot: EffectSlot,
    dependencies: readonly unknown[],
    equals: EffectEquals | undefined,
    scheduler: EffectScheduler | undefined,
  ): unknown => {
    const options: EffectWatchOptions = { immediate: true }
    if (equals) options.equals = equals
    if (scheduler) options.scheduler = scheduler

    const watch = safeGet(reactiveRuntime, 'watch')
    if (typeof watch !== 'function') {
      throw new TypeError('reactiveRuntime.watch is not a function')
    }
    const handle: unknown = Reflect.apply(watch, reactiveRuntime, [
      dependencies.map(normalizeDependencySource),
      () => {
        runCleanup(slot)
        const effect = slot.effect
        if (typeof effect !== 'function') {
          return
        }
        const cleanup = callIgnoringError(effect, null)
        if (typeof cleanup === 'function') {
          slot.cleanup = cleanup as EffectCleanup
        }
      },
      options,
    ])
    return handle
  }

  /**
   * useEffect：模拟 React 的效果钩子
   *
   * - 依赖数组采用 `watch([...])` 的统一侦听底层实现
   * - 逐项浅比较（`Object.is`）；可通过 `options.equals(prev, next)` 自定义比较
   * - 返回清理函数将通过 `onCleanup()` 注册，在下一次依赖变化重跑前或侦听被处置时执行
   *
   * 示例：
   * ```ts
   * useEffect(() => {
   *   const timer = setInterval(() => {}, 1000)
   *   return () => clearInterval(timer)
   * }, [])
   *
   * useEffect(() => {
   *   console.log('count =', count.value)
   * }, [() => count.value])
   * ```
   */
  const useEffect = (
    effect: EffectCallback,
    dependencies?: readonly unknown[] | null,
    options?: EffectOptions | null,
  ): void => {
    const nextDependencies = rawDependencies(dependencies)
    // 解析可选项：equals 与 scheduler（与 watch.ts 的选项保持一致）
    const equals = optionFunction(options, 'equals')
    const scheduler = optionFunction(options, 'scheduler')

    if (context.getCurrentInstance() == null) {
      const slot: EffectSlot = { effect, cleanup: undefined }
      createEffectWatch(slot, nextDependencies, equals, scheduler)
      return
    }

    const slot = context.withHookSlot<EffectSlot>(() => ({
      type: effectSlot,
      effect,
      cleanup: undefined,
      handle: undefined,
      deps: undefined,
      equals: undefined,
      scheduler: undefined,
    }))
    slot.type = effectSlot
    slot.effect = effect

    const shouldRecreate =
      !sameDependencySources(slot.deps, nextDependencies) ||
      !sameOptionalFunction(slot.equals, equals) ||
      !sameOptionalFunction(slot.scheduler, scheduler)

    if (shouldRecreate) {
      disposeSlot(slot)
      slot.handle = createEffectWatch(slot, nextDependencies, equals, scheduler)
      slot.deps = nextDependencies.slice()
      slot.equals = equals
      slot.scheduler = scheduler
    }
  }

  const isEffectSlot = (slot: unknown): slot is EffectSlot =>
    isObjectLike(slot) && safeGet(slot, 'type') === effectSlot

  const disposeHookHost = (instance: unknown): void => {
    const states = safeGet(safeGet(instance, '__hooks'), 'states')
    if (!Array.isArray(states)) {
      return
    }
    for (const slot of states) {
      if (isEffectSlot(slot)) {
        disposeSlot(slot)
      }
    }
  }

  return {
    disposeHookHost,
    useEffect,
  }
}
