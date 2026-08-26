/// <reference path="./global.d.ts" />

const RUE_JS_ERROR_BRIDGE_KEY = '__rue_js_error_bridge_installed'
const RUE_JS_ERROR_HANDLERS_KEY = '__rue_js_error_handlers'
const RUE_RUNTIME_ENTRY_WRAP_KEY = '__rue_runtime_vapor_entry_wrapped__'
const RUE_WASM_TRAP_ERROR_NAME = 'RueWasmTrapError'
const RUE_RENDER_TRIGGERED_HOOKS_KEY = '__rue_render_triggered_hooks'
const RUE_PENDING_ENTRY_ERROR_KEY = '__rue_pending_entry_error__'
const RUE_ACTIVE_ENTRY_DEPTH_KEY = '__rue_active_entry_depth__'

interface ErrorShape {
  cause?: unknown
  message?: unknown
  name?: unknown
  stack?: unknown
}

interface RuntimeEntryMethodMap {
  mount(app: unknown, container: unknown): unknown
  render(value: unknown, container: unknown): unknown
  renderAnchor(value: unknown, parent: unknown, anchor: unknown): unknown
  renderBetween(value: unknown, parent: unknown, start: unknown, end: unknown): unknown
  renderStatic(value: unknown, parent: unknown, anchor: unknown): unknown
}

type RuntimeEntryMethodKey = keyof RuntimeEntryMethodMap

type RuntimeEntryTarget = RuntimeVaporEntryPrivateFields &
  Partial<RuntimeEntryMethodMap> & {
    handleError?: (error: unknown, instance?: unknown) => unknown
    onError?: (callback: unknown) => unknown
    onRenderTriggered?: (callback: unknown) => unknown
  }

type NormalizeRenderTriggeredEvent = (event: unknown) => unknown

const canTrackRuntime = (runtime: unknown): runtime is RuntimeEntryTarget =>
  (typeof runtime === 'object' || typeof runtime === 'function') && runtime != null

const isErrorShape = (error: unknown): error is ErrorShape =>
  error != null && (typeof error === 'object' || typeof error === 'function')

const getErrorShape = (error: unknown): ErrorShape | null => (isErrorShape(error) ? error : null)

const isObjectLike = (value: unknown): value is RuntimeVaporRenderOwner =>
  (typeof value === 'object' || typeof value === 'function') && value != null

const registerSharedRenderTriggeredHook = (
  callback: RuntimeVaporRenderTriggeredHook,
): (() => void) | undefined => {
  const bridge = globalThis.__rue_runtime_vapor_shared_bridge
  const owner = bridge?.getCurrentRenderOwner?.()
  if (!bridge || !isObjectLike(owner)) {
    return undefined
  }
  let hooks = owner[RUE_RENDER_TRIGGERED_HOOKS_KEY]
  if (!Array.isArray(hooks)) {
    hooks = []
    Object.defineProperty(owner, RUE_RENDER_TRIGGERED_HOOKS_KEY, {
      value: hooks,
      enumerable: false,
      configurable: true,
    })
  }
  hooks.push(callback)
  bridge.__rue_render_triggered_owner = owner
  return () => {
    const index = hooks.indexOf(callback)
    if (index >= 0) {
      hooks.splice(index, 1)
    }
    if (bridge?.__rue_render_triggered_owner === owner && !hooks.length) {
      bridge.__rue_render_triggered_owner = undefined
    }
  }
}

const getErrorName = (error: unknown): string => {
  if (error instanceof Error && typeof error.name === 'string' && error.name) {
    return error.name
  }

  const shape = getErrorShape(error)
  return typeof shape?.name === 'string' ? shape.name : ''
}

const getErrorStack = (error: unknown): string => {
  if (error instanceof Error && typeof error.stack === 'string') {
    return error.stack
  }

  const shape = getErrorShape(error)
  return typeof shape?.stack === 'string' ? shape.stack : ''
}

const getErrorStackHead = (error: unknown): string =>
  getErrorStack(error)
    .split('\n')
    .map(line => line.trim())
    .find(Boolean) ?? ''

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && typeof error.message === 'string' && error.message) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  const shape = getErrorShape(error)
  if (typeof shape?.message === 'string' && shape.message) {
    return shape.message
  }

  const stackHead = getErrorStackHead(error)
  if (stackHead) {
    return stackHead
  }

  const name = getErrorName(error)
  if (name) {
    return name
  }

  return String(error)
}

const buildOriginalTrap = (error: unknown): string => {
  const name = getErrorName(error)
  const message = getErrorMessage(error)
  const stackHead = getErrorStackHead(error)

  if (name && message && message !== name) {
    return `${name}: ${message}`
  }
  if (stackHead) {
    return stackHead
  }
  if (name) {
    return name
  }
  return message
}

const isProbablyWasmUnreachableTrap = (error: unknown): boolean => {
  if (getErrorName(error) === RUE_WASM_TRAP_ERROR_NAME) {
    return false
  }

  const name = getErrorName(error)
  const message = getErrorMessage(error).toLowerCase()
  const stack = getErrorStack(error).toLowerCase()
  if (!message.includes('unreachable') && !stack.includes('unreachable')) {
    return false
  }

  return (
    name === 'RuntimeError' ||
    name === 'WebAssembly.RuntimeError' ||
    message.includes('runtimeerror: unreachable') ||
    stack.includes('runtimeerror: unreachable') ||
    message.trim() === 'unreachable' ||
    stack.trimStart().startsWith('runtimeerror: unreachable')
  )
}

/*
入口 trap 规范化

只把符合 WebAssembly RuntimeError/unreachable 形态的异常改写为 RueWasmTrapError；
原始 name、message、stack 与 cause 均通过 unknown type guard 读取，并保留原异常作为 cause。
*/
export const normalizeRuntimeVaporFlushError = (error: unknown): unknown => {
  if (!isProbablyWasmUnreachableTrap(error)) {
    return error
  }

  const originalTrap = buildOriginalTrap(error)
  const originalStack = getErrorStack(error)
  const diagnostic = new Error(
    'Rue Vapor/Wasm trapped with "unreachable". This usually means compiled render code mutated a props-derived or computed object during render. Fix the component by assembling a fresh object instead of deleting or rewriting fields on an object built from props + ...rest. If this came from pretransformed rue-design source, add /* RUE_VAPOR_TRANSFORMED */ at the top of the component file so Vite does not Vapor-transform it again.' +
      (originalTrap ? ` Original trap: ${originalTrap}.` : ''),
  )

  diagnostic.name = RUE_WASM_TRAP_ERROR_NAME
  ;(diagnostic as ErrorShape).cause = error

  if (originalStack) {
    diagnostic.stack = `${diagnostic.stack ?? `${diagnostic.name}: ${diagnostic.message}`}\nCaused by: ${originalStack}`
  }

  return diagnostic
}

/*
错误处理桥接：onError

组件级 errorCaptured 优先消费；未处理错误在入口退出前只派发一次，pending entry error
必须等当前入口完成后再规范化并抛出，避免 Wasm trap 与显式错误重复广播。
*/
const installRuntimeErrorBridge = <Runtime>(runtime: Runtime): Runtime => {
  if (!canTrackRuntime(runtime)) {
    return runtime
  }

  if (runtime[RUE_JS_ERROR_BRIDGE_KEY]) {
    return runtime
  }

  const handlers = new Set<RuntimeVaporErrorHandler>()
  const originalHandleError =
    typeof runtime.handleError === 'function' ? runtime.handleError.bind(runtime) : null
  const originalOnError =
    typeof runtime.onError === 'function' ? runtime.onError.bind(runtime) : null
  let handlingExplicitError = false

  const forwardError = (error: unknown, instance?: unknown): void => {
    if (handlingExplicitError) {
      return
    }
    if ((runtime[RUE_ACTIVE_ENTRY_DEPTH_KEY] ?? 0) > 0) {
      if (runtime[RUE_PENDING_ENTRY_ERROR_KEY] !== undefined) {
        return
      }
      runtime[RUE_PENDING_ENTRY_ERROR_KEY] = error
      return
    }
    handlers.forEach(handler => {
      try {
        handler(error, instance)
      } catch {}
    })
  }

  originalOnError?.(forwardError)

  runtime[RUE_JS_ERROR_HANDLERS_KEY] = handlers
  runtime.onError = (fn: unknown): (() => void) | undefined => {
    if (typeof fn !== 'function') {
      return undefined
    }

    const handler = fn as RuntimeVaporErrorHandler
    handlers.add(handler)
    return () => {
      handlers.delete(handler)
    }
  }

  runtime.handleError = (error: unknown, instance?: unknown): boolean => {
    const dispatchErrorCaptured = globalThis.__rue_dispatch_error_captured
    if (
      typeof dispatchErrorCaptured === 'function' &&
      dispatchErrorCaptured(error, instance, 'component render') === true
    ) {
      return false
    }

    if (originalHandleError) {
      handlingExplicitError = true
      try {
        originalHandleError(error, instance)
      } catch {
      } finally {
        handlingExplicitError = false
      }
    } else {
      forwardError(error, instance)
      return true
    }

    dispatchCaughtError(runtime, error, instance)

    if (handlers.size === 0) {
      try {
        console.error?.(error)
      } catch {}
    }

    return true
  }

  // 组件 render 失败已在 JS Runtime 中走过 errorCaptured；这里抛给最外层入口统一派发，
  // 保持底层入口语义，同时避免嵌套组件帧重复派发。
  runtime.__rueHandleComponentError = (error: unknown): never => {
    throw error
  }

  runtime[RUE_JS_ERROR_BRIDGE_KEY] = true
  return runtime
}

const shouldDispatchCaughtError = (runtime: RuntimeEntryTarget): boolean => {
  const handlers = runtime?.[RUE_JS_ERROR_HANDLERS_KEY]
  return handlers instanceof Set && handlers.size > 0
}

const dispatchCaughtError = (
  runtime: RuntimeEntryTarget,
  error: unknown,
  instance: unknown = null,
): void => {
  const handlers = runtime?.[RUE_JS_ERROR_HANDLERS_KEY]
  if (!(handlers instanceof Set)) {
    return
  }
  handlers.forEach(handler => {
    try {
      handler(error, instance)
    } catch {}
  })
}

const wrapRuntimeEntryMethod = <Key extends RuntimeEntryMethodKey>(
  runtime: RuntimeEntryTarget,
  methodName: Key,
): void => {
  const original = runtime[methodName] as RuntimeEntryMethodMap[Key] | undefined
  if (typeof original !== 'function') {
    return
  }

  const wrappedRuntimeEntry = function wrappedRuntimeEntry(
    this: ThisParameterType<RuntimeEntryMethodMap[Key]>,
    ...args: Parameters<RuntimeEntryMethodMap[Key]>
  ): ReturnType<RuntimeEntryMethodMap[Key]> {
    runtime[RUE_PENDING_ENTRY_ERROR_KEY] = undefined
    runtime[RUE_ACTIVE_ENTRY_DEPTH_KEY] = (runtime[RUE_ACTIVE_ENTRY_DEPTH_KEY] ?? 0) + 1
    let rethrowingPendingEntryError = false
    try {
      const result = Reflect.apply(original, this, args) as ReturnType<RuntimeEntryMethodMap[Key]>
      const pending = runtime[RUE_PENDING_ENTRY_ERROR_KEY]
      runtime[RUE_PENDING_ENTRY_ERROR_KEY] = undefined
      if (pending !== undefined && pending !== null) {
        const normalizedPending = normalizeRuntimeVaporFlushError(pending)
        dispatchCaughtError(runtime, normalizedPending)
        rethrowingPendingEntryError = true
        throw normalizedPending
      }
      return result
    } catch (error) {
      runtime[RUE_PENDING_ENTRY_ERROR_KEY] = undefined
      const normalized = normalizeRuntimeVaporFlushError(error)
      if (!rethrowingPendingEntryError && shouldDispatchCaughtError(runtime)) {
        dispatchCaughtError(runtime, normalized)
      }
      throw normalized
    } finally {
      runtime[RUE_ACTIVE_ENTRY_DEPTH_KEY] = Math.max(
        0,
        (runtime[RUE_ACTIVE_ENTRY_DEPTH_KEY] ?? 1) - 1,
      )
    }
  }
  if (!Reflect.set(runtime, methodName, wrappedRuntimeEntry)) {
    throw new TypeError(`Cannot wrap runtime entry method: ${methodName}`)
  }
}

const wrapRenderTriggeredHook = (
  runtime: RuntimeEntryTarget,
  normalizeRenderTriggeredEvent?: NormalizeRenderTriggeredEvent,
): void => {
  const original = runtime.onRenderTriggered
  if (typeof original !== 'function') {
    return
  }

  runtime.onRenderTriggered = function wrappedOnRenderTriggered(
    this: unknown,
    callback: unknown,
  ): unknown {
    if (typeof callback !== 'function') {
      return Reflect.apply(original, this, [callback])
    }
    const hook = callback as RuntimeVaporRenderTriggeredHook
    const normalizedCallback = (event: unknown): unknown =>
      hook(normalizeRenderTriggeredEvent ? normalizeRenderTriggeredEvent(event) : event)
    const dispose = registerSharedRenderTriggeredHook(normalizedCallback)
    if (dispose) {
      globalThis.__rue_runtime_vapor_shared_bridge?.activateRenderTriggered?.()
      return dispose
    }
    return Reflect.apply(original, this, [normalizedCallback])
  }
}

export const wrapCreateRue =
  <Adapter, Runtime>(
    rawCreateRue: (adapter: Adapter) => Runtime,
    normalizeRenderTriggeredEvent?: NormalizeRenderTriggeredEvent,
  ) =>
  (adapter: Adapter): Runtime => {
    const runtime = installRuntimeErrorBridge(rawCreateRue(adapter))
    if (!canTrackRuntime(runtime) || runtime[RUE_RUNTIME_ENTRY_WRAP_KEY]) {
      return runtime
    }

    for (const methodName of [
      'mount',
      'render',
      'renderAnchor',
      'renderBetween',
      'renderStatic',
    ] as const) {
      wrapRuntimeEntryMethod(runtime, methodName)
    }
    wrapRenderTriggeredHook(runtime, normalizeRenderTriggeredEvent)

    runtime[RUE_RUNTIME_ENTRY_WRAP_KEY] = true
    return runtime
  }
