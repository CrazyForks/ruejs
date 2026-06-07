import * as reactiveRuntime from './pkg/rue_runtime_vapor.js'

import { installSharedBridge } from './vapor-bridge.js'

installSharedBridge(reactiveRuntime)

const currentEffectIdExport = Reflect.get(reactiveRuntime, '__rueCurrentEffectId')
const getCurrentEffectScopeExport = Reflect.get(reactiveRuntime, '__rueGetCurrentEffectScope')
const RUE_RENDER_TRACKED_HOOKS_KEY = '__rue_render_tracked_hooks__'
const RUE_CONTEXT_OWNER_PARENT_KEY = '__rue_context_owner_parent__'
const RUE_REF_FLAG = '__rue_ref__'
const RUE_SIGNAL_RENDER_TRACKING_PATCHED = Symbol.for('rue.signal.renderTrackingPatched')

const effectRenderOwnerById = new Map()
const scopeHandleCache = new Map()
const stoppedScopeIds = new Set()
const postFlushQueue = new Set()
let isDispatchingRenderTracked = false
let postFlushPending = false

// post flush 队列优先复用原生 queueMicrotask，兼容旧环境时退回 Promise microtask。
const queueTask =
  typeof queueMicrotask === 'function' ? queueMicrotask : fn => Promise.resolve().then(fn)

/** 清空 watchPostEffect 队列，保证同一轮 flush 内重复调度只运行最新 runner。 */
const flushPostFlushQueue = () => {
  if (!postFlushQueue.size) {
    postFlushPending = false
    return
  }

  const queue = Array.from(postFlushQueue)
  postFlushQueue.clear()
  postFlushPending = false
  for (const run of queue) {
    run()
  }
}

/** 安排 post flush 执行；若 runtime 提供 nextTick，则排在响应式 DOM 更新之后。 */
const queuePostFlush = run => {
  postFlushQueue.add(run)
  if (postFlushPending) {
    return
  }

  postFlushPending = true
  queueTask(() => {
    if (typeof reactiveRuntime.nextTick === 'function') {
      reactiveRuntime.nextTick(flushPostFlushQueue)
      return
    }

    queueTask(flushPostFlushQueue)
  })
}

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

/** 创建 watchPostEffect 的调度器，支持用户自定义 scheduler 包裹最终 runner。 */
const createPostEffectScheduler = options => {
  const userScheduler =
    options && typeof options === 'object' && typeof options.scheduler === 'function'
      ? options.scheduler
      : undefined
  let queued = false
  let latestRun

  return run => {
    latestRun = run
    if (queued) {
      return
    }

    queued = true
    queuePostFlush(() => {
      const runEffect = () => {
        queued = false
        const runner = latestRun
        latestRun = undefined
        runner?.()
      }

      if (userScheduler) {
        userScheduler(runEffect)
        return
      }

      runEffect()
    })
  }
}

/** 将传入 options 复制一份并替换为 post flush scheduler。 */
const withPostEffectScheduler = options => {
  const normalized = options && typeof options === 'object' ? { ...options } : {}
  normalized.scheduler = createPostEffectScheduler(options)
  return normalized
}

/** watchEffect 的 post flush 变体，用于 DOM 更新完成后读取布局/文本。 */
export const watchPostEffect = (cb, options) =>
  reactiveRuntime.createEffect(cb, withPostEffectScheduler(options))

/** 在当前 watcher 上注册失效清理函数，旧 runtime 下退回 onCleanup。 */
export const onWatcherCleanup = (cleanupFn, failSilently) => {
  if (typeof reactiveRuntime.onWatcherCleanup === 'function') {
    return reactiveRuntime.onWatcherCleanup(cleanupFn, failSilently)
  }
  if (typeof reactiveRuntime.onCleanup === 'function') {
    return reactiveRuntime.onCleanup(cleanupFn)
  }
  if (!failSilently) {
    globalThis.console?.warn?.('onWatcherCleanup() is called when there is no active watcher.')
  }
}

/** 等待响应式 flush 与 post flush 队列完成，可选执行回调。 */
export const nextTick = callback => {
  const promise =
    typeof reactiveRuntime.nextTick === 'function'
      ? reactiveRuntime.nextTick(flushPostFlushQueue)
      : Promise.resolve().then(flushPostFlushQueue)
  return typeof callback === 'function' ? promise.then(callback) : promise
}

export const __rueCurrentEffectId =
  typeof currentEffectIdExport === 'function' ? currentEffectIdExport : () => undefined

const getCurrentEffectScopeId =
  typeof getCurrentEffectScopeExport === 'function' ? getCurrentEffectScopeExport : () => undefined

const disposeEffectScope =
  typeof reactiveRuntime.__rueDisposeEffectScope === 'function'
    ? reactiveRuntime.__rueDisposeEffectScope.bind(reactiveRuntime)
    : undefined

const isObjectLike = value =>
  (typeof value === 'object' || typeof value === 'function') && value != null

const readonlyProxyFallbacks = new WeakSet()
const runtimeIsReadonly =
  typeof reactiveRuntime.isReadonly === 'function'
    ? reactiveRuntime.isReadonly.bind(reactiveRuntime)
    : undefined

/** 标记 JS 包装层创建的 readonly 结果，补齐旧 Wasm 标记不可见的场景。 */
const markReadonlyResult = value => {
  if (isObjectLike(value)) {
    readonlyProxyFallbacks.add(value)
  }
  return value
}

const hasReadonlyOption = options =>
  isObjectLike(options) && Reflect.get(options, 'readonly') === true

const hasWritableComputedOptions = options =>
  isObjectLike(options) && typeof Reflect.get(options, 'set') === 'function'

/** 判断值是否为 readonly/shallowReadonly 代理或只读 computed。 */
export const isReadonly = value => {
  if (runtimeIsReadonly?.(value)) {
    return true
  }
  if (!isObjectLike(value)) {
    return false
  }
  if (readonlyProxyFallbacks.has(value)) {
    return true
  }
  try {
    return Reflect.get(value, '__isReadonly__') === true
  } catch {
    return false
  }
}

/** 宽松识别 Rue ref/computed/object property ref。 */
const isRefLike = value => {
  if (!isObjectLike(value)) {
    return false
  }
  if (Reflect.get(value, '__rue_ref__') === true) {
    return true
  }
  return Reflect.get(value, '__signal__') != null && Reflect.has(value, 'value')
}

/** 在 JS 包装对象上写入不可枚举 ref 标记。 */
const markRefLike = target => {
  Object.defineProperty(target, '__rue_ref__', {
    value: true,
    enumerable: false,
    configurable: true,
  })
  return target
}

/** 创建只读 getter ref。 */
const createGetterRef = getter => {
  const result = markRefLike({})
  Object.defineProperty(result, 'value', {
    enumerable: true,
    configurable: true,
    get: getter,
  })
  return result
}

/** 创建与源对象属性保持双向同步的 ref。 */
const createObjectPropertyRef = (source, key, defaultValue) => {
  const result = markRefLike({})
  Object.defineProperty(result, 'value', {
    enumerable: true,
    configurable: true,
    get() {
      const value = Reflect.get(source, key)
      return value === undefined ? defaultValue : value
    },
    set(value) {
      Reflect.set(source, key, value)
    },
  })
  return result
}

/** 给 runtime ref/computed 结果补 ref 标记，供 isRef 与 isProxy 区分。 */
const markRefValue = value => {
  if (!isObjectLike(value)) {
    return value
  }

  try {
    Object.defineProperty(value, RUE_REF_FLAG, {
      value: true,
      enumerable: false,
      configurable: false,
    })
  } catch {}

  return value
}

/** ref 判定优先检查 raw target，兼容响应式代理包裹的 ref。 */
const refFlagTarget = value => {
  if (!isObjectLike(value)) {
    return undefined
  }

  try {
    const raw = Reflect.get(value, '__rue_raw__')
    if (isObjectLike(raw)) {
      return raw
    }
  } catch {}

  return value
}

/** 判断值是否为 Rue ref 或 computed ref。 */
export const isRef = value => {
  const target = refFlagTarget(value)
  if (!target) {
    return false
  }

  try {
    return Reflect.get(target, RUE_REF_FLAG) === true
  } catch {
    return false
  }
}

/** 从 shared bridge 读取当前组件 render owner。 */
const currentRenderOwner = () => {
  const bridge = globalThis.__rue_runtime_vapor_shared_bridge
  if (!bridge || typeof bridge.getCurrentRenderOwner !== 'function') {
    return undefined
  }
  return bridge.getCurrentRenderOwner()
}

/** 确保组件实例上有 renderTracked hooks 列表。 */
const ensureRenderTrackedHooks = instance => {
  if (!isObjectLike(instance)) {
    return undefined
  }
  const existing = instance[RUE_RENDER_TRACKED_HOOKS_KEY]
  if (Array.isArray(existing)) {
    return existing
  }
  const hooks = []
  Object.defineProperty(instance, RUE_RENDER_TRACKED_HOOKS_KEY, {
    value: hooks,
    enumerable: false,
    configurable: true,
  })
  return hooks
}

/** 沿 Context owner 父链派发 renderTracked 调试事件。 */
const dispatchRenderTracked = (owner, event) => {
  if (!isObjectLike(owner) || isDispatchingRenderTracked) {
    return
  }
  const visited = new Set()
  let current = owner
  isDispatchingRenderTracked = true
  try {
    while (isObjectLike(current) && !visited.has(current)) {
      visited.add(current)
      const hooks = current[RUE_RENDER_TRACKED_HOOKS_KEY]
      if (Array.isArray(hooks)) {
        for (const hook of hooks.slice()) {
          if (typeof hook !== 'function') {
            continue
          }
          try {
            if (typeof reactiveRuntime.untrack === 'function') {
              reactiveRuntime.untrack(() => hook(event))
            } else {
              hook(event)
            }
          } catch (error) {
            globalThis.console?.error?.(error)
          }
        }
      }
      current = current[RUE_CONTEXT_OWNER_PARENT_KEY]
    }
  } finally {
    isDispatchingRenderTracked = false
  }
}

/** 在 signal get/getPath 时记录 DebuggerEvent 并派发到当前组件。 */
const notifyRenderTracked = (target, type, key) => {
  const effect = __rueCurrentEffectId()
  if (effect == null) {
    return
  }
  const activeOwner = currentRenderOwner()
  if (isObjectLike(activeOwner)) {
    effectRenderOwnerById.set(effect, activeOwner)
  }
  const owner = isObjectLike(activeOwner) ? activeOwner : effectRenderOwnerById.get(effect)
  if (!isObjectLike(owner)) {
    return
  }
  dispatchRenderTracked(owner, { effect, target, type, key })
}

/** Monkey patch SignalHandle 读取方法，以便 JS 侧实现 onRenderTracked。 */
const patchSignalRenderTracking = runtime => {
  const proto = runtime.SignalHandle?.prototype
  if (!proto || proto[RUE_SIGNAL_RENDER_TRACKING_PATCHED]) {
    return
  }

  const originalGet = proto.get
  if (typeof originalGet === 'function') {
    proto.get = function (...args) {
      const value = originalGet.apply(this, args)
      notifyRenderTracked(this, 'get', 'value')
      return value
    }
  }

  const originalGetPath = proto.getPath
  if (typeof originalGetPath === 'function') {
    proto.getPath = function (path, ...args) {
      const value = originalGetPath.call(this, path, ...args)
      notifyRenderTracked(this, 'get', path)
      return value
    }
  }

  Object.defineProperty(proto, RUE_SIGNAL_RENDER_TRACKING_PATCHED, {
    value: true,
    configurable: true,
  })
}

patchSignalRenderTracking(reactiveRuntime)

/** 注册当前组件的 renderTracked 调试钩子，返回取消注册函数。 */
export const onRenderTracked = callback => {
  if (typeof callback !== 'function') {
    return undefined
  }
  const hooks = ensureRenderTrackedHooks(reactiveRuntime.getCurrentInstance?.())
  if (!hooks) {
    return undefined
  }
  hooks.push(callback)
  return () => {
    const index = hooks.indexOf(callback)
    if (index >= 0) {
      hooks.splice(index, 1)
    }
  }
}

/** 创建 JS EffectScope 句柄，委托 Wasm scope push/pop/dispose。 */
const createScopeHandle = id => ({
  get active() {
    return !stoppedScopeIds.has(id)
  },
  run(fn) {
    if (typeof fn !== 'function' || stoppedScopeIds.has(id)) {
      return undefined
    }

    reactiveRuntime.__ruePushEffectScope(id)
    try {
      return fn()
    } finally {
      reactiveRuntime.__ruePopEffectScope()
    }
  },
  stop() {
    if (stoppedScopeIds.has(id)) {
      return
    }

    stoppedScopeIds.add(id)
    disposeEffectScope?.(id)
    scopeHandleCache.delete(id)
  },
  dispose() {
    this.stop()
  },
})

/** 复用 scope id 对应的 JS 句柄，保持 getCurrentScope 多次读取的引用稳定。 */
const getScopeHandle = id => {
  if (!Number.isInteger(id) || id <= 0) {
    return undefined
  }

  const cached = scopeHandleCache.get(id)
  if (cached) {
    return cached
  }

  const handle = createScopeHandle(id)
  scopeHandleCache.set(id, handle)
  return handle
}

/** 读取当前活动 effect scope。 */
export const getCurrentScope = () => getScopeHandle(getCurrentEffectScopeId())

/** createReactive 包装：保留 runtime 行为并记录 readonly fallback 标记。 */
export const createReactive = (initial, options) => {
  const value = reactiveRuntime.createReactive(initial, options)
  return hasReadonlyOption(options) ? markReadonlyResult(value) : value
}

/** reactive 包装：支持 readonly option 的 JS fallback 标记。 */
export const reactive = (initial, options, forceGlobal) => {
  const value = reactiveRuntime.reactive(initial, options, forceGlobal)
  return hasReadonlyOption(options) ? markReadonlyResult(value) : value
}

/** readonly 包装：记录只读代理 fallback 标记。 */
export const readonly = (initial, forceGlobal) =>
  markReadonlyResult(reactiveRuntime.readonly(initial, forceGlobal))

/** shallowReadonly 包装：记录只读代理 fallback 标记。 */
export const shallowReadonly = (initial, forceGlobal) =>
  markReadonlyResult(reactiveRuntime.shallowReadonly(initial, forceGlobal))

/** propsReactive 默认视为只读 props 包装。 */
export const propsReactive = (initial, forceGlobal) =>
  markReadonlyResult(reactiveRuntime.propsReactive(initial, forceGlobal))

/** computed 包装：补 ref 标记，并区分只读/可写 computed。 */
export const computed = (...args) => {
  const value = markRefValue(reactiveRuntime.computed(...args))
  return hasWritableComputedOptions(args[0]) ? value : markReadonlyResult(value)
}

/** createComputed 包装：补 ref 标记，并区分只读/可写 computed。 */
export const createComputed = (...args) => {
  const value = markRefValue(reactiveRuntime.createComputed(...args))
  return hasWritableComputedOptions(args[0]) ? value : markReadonlyResult(value)
}

/** 创建 shallowRef，并让 equals 比较接收 value 层的前后值。 */
export const shallowRef = (initial, options, force_global) => {
  const root = markRefValue({ value: initial })
  return reactiveRuntime.shallowReactive(root, normalizeShallowRefOptions(options), force_global)
}

/** 手动触发 ref/shallowRef 的 value 订阅者。 */
export const triggerRef = ref => {
  if (!ref || typeof ref !== 'object') {
    return
  }

  const signal = Reflect.get(ref, '__signal__')
  if (signal && typeof signal.triggerPath === 'function') {
    signal.triggerPath(['value'])
  }
}

/** 将对象属性、getter、已有 ref 或普通值规范化为 ref。 */
export function toRef(source, key, defaultValue) {
  if (arguments.length > 1) {
    const rawSource = isObjectLike(source) ? Reflect.get(source, '__rue_raw__') : undefined
    const rawExisting = isObjectLike(rawSource) ? Reflect.get(rawSource, key) : undefined
    if (isRefLike(rawExisting)) {
      return rawExisting
    }

    const existing = isObjectLike(source) ? Reflect.get(source, key) : undefined
    return isRefLike(existing)
      ? existing
      : createObjectPropertyRef(source ?? Object.create(null), key, defaultValue)
  }

  if (isRefLike(source)) {
    return source
  }
  if (typeof source === 'function') {
    return createGetterRef(source)
  }
  return reactiveRuntime.ref(source)
}

/** 将对象可枚举属性批量转换为与源对象保持同步的 ref。 */
export const toRefs = object => {
  if (!isObjectLike(object)) {
    return {}
  }

  const refs = Array.isArray(object) ? Array.from({ length: object.length }) : {}
  for (const key of Reflect.ownKeys(object)) {
    const descriptor = Reflect.getOwnPropertyDescriptor(object, key)
    if (!descriptor?.enumerable) {
      continue
    }
    refs[key] = toRef(object, key)
  }
  return refs
}

const runtimeWithShallowRef = {
  ...reactiveRuntime,
  __rueCurrentEffectId,
  computed,
  createComputed,
  createReactive,
  getCurrentScope,
  isRef,
  isReadonly,
  nextTick,
  onWatcherCleanup,
  onRenderTracked,
  propsReactive,
  reactive,
  readonly,
  shallowRef,
  shallowReadonly,
  toRef,
  toRefs,
  triggerRef,
  watchPostEffect,
}

export * from './pkg/rue_runtime_vapor.js'
export default runtimeWithShallowRef
