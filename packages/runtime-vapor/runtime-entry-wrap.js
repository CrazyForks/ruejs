const RUE_JS_ERROR_BRIDGE_KEY = '__rue_js_error_bridge_installed'
const RUE_JS_ERROR_HANDLERS_KEY = '__rue_js_error_handlers'
const RUE_RUNTIME_ENTRY_WRAP_KEY = '__rue_runtime_vapor_entry_wrapped__'
const RUE_WASM_TRAP_ERROR_NAME = 'RueWasmTrapError'
const RUE_SIGNAL_WRAPPER_REGISTRY_KEY = Symbol.for('rue.signal.wrapperRegistry')
const RUE_SIGNAL_ID_KEY = '__rue_signal_id__'
const RUE_RENDER_TRIGGERED_HOOKS_KEY = '__rue_render_triggered_hooks'
const RUE_PENDING_ENTRY_ERROR_KEY = '__rue_pending_entry_error__'
const RUE_ACTIVE_ENTRY_DEPTH_KEY = '__rue_active_entry_depth__'

const canTrackRuntime = runtime =>
  (typeof runtime === 'object' || typeof runtime === 'function') && runtime != null

const signalWrapperRegistry = (() => {
  const existing = globalThis[RUE_SIGNAL_WRAPPER_REGISTRY_KEY]
  if (existing instanceof Map) {
    return existing
  }
  const registry = new Map()
  Object.defineProperty(globalThis, RUE_SIGNAL_WRAPPER_REGISTRY_KEY, {
    value: registry,
    enumerable: false,
    configurable: true,
  })
  return registry
})()

const getErrorShape = error => (error && typeof error === 'object' ? error : null)

const resolveSignalWrapperRef = ref =>
  typeof WeakRef === 'function' && ref instanceof WeakRef ? ref.deref() : ref

const normalizeRenderTriggeredEvent = event => {
  if (!event || typeof event !== 'object') {
    return event
  }

  let signalId
  try {
    signalId = Reflect.get(Reflect.get(event, 'target'), RUE_SIGNAL_ID_KEY)
  } catch {
    signalId = undefined
  }

  if (!Number.isInteger(signalId)) {
    return event
  }

  const canonicalTarget = resolveSignalWrapperRef(signalWrapperRegistry.get(signalId))
  if (!canonicalTarget) {
    signalWrapperRegistry.delete(signalId)
    return event
  }
  if (Reflect.get(event, 'target') === canonicalTarget) {
    return event
  }

  try {
    Reflect.set(event, 'target', canonicalTarget)
  } catch {}
  return event
}

const isObjectLike = value =>
  (typeof value === 'object' || typeof value === 'function') && value != null

const currentSharedRenderOwner = () => {
  const bridge = globalThis.__rue_runtime_vapor_shared_bridge
  if (!bridge || typeof bridge.getCurrentRenderOwner !== 'function') {
    return undefined
  }
  return bridge.getCurrentRenderOwner()
}

const ensureRenderTriggeredHooks = owner => {
  if (!isObjectLike(owner)) {
    return undefined
  }
  const existing = owner[RUE_RENDER_TRIGGERED_HOOKS_KEY]
  if (Array.isArray(existing)) {
    return existing
  }
  const hooks = []
  Object.defineProperty(owner, RUE_RENDER_TRIGGERED_HOOKS_KEY, {
    value: hooks,
    enumerable: false,
    configurable: true,
  })
  return hooks
}

const registerSharedRenderTriggeredHook = callback => {
  const owner = currentSharedRenderOwner()
  const hooks = ensureRenderTriggeredHooks(owner)
  if (!hooks) {
    return undefined
  }
  hooks.push(callback)
  const bridge = globalThis.__rue_runtime_vapor_shared_bridge
  if (bridge && isObjectLike(owner)) {
    bridge.__rue_render_triggered_owner = owner
  }
  return () => {
    const index = hooks.indexOf(callback)
    if (index >= 0) {
      hooks.splice(index, 1)
    }
    if (bridge?.__rue_render_triggered_owner === owner && hooks.length === 0) {
      bridge.__rue_render_triggered_owner = undefined
    }
  }
}

const getErrorName = error => {
  if (error instanceof Error && typeof error.name === 'string' && error.name) {
    return error.name
  }

  const shape = getErrorShape(error)
  return typeof shape?.name === 'string' ? shape.name : ''
}

const getErrorStack = error => {
  if (error instanceof Error && typeof error.stack === 'string') {
    return error.stack
  }

  const shape = getErrorShape(error)
  return typeof shape?.stack === 'string' ? shape.stack : ''
}

const getErrorStackHead = error =>
  getErrorStack(error)
    .split('\n')
    .map(line => line.trim())
    .find(Boolean) ?? ''

const getErrorMessage = error => {
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

const buildOriginalTrap = error => {
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

const isProbablyWasmUnreachableTrap = error => {
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

export const normalizeRuntimeVaporFlushError = error => {
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
  diagnostic.cause = error

  if (originalStack) {
    diagnostic.stack = `${diagnostic.stack ?? `${diagnostic.name}: ${diagnostic.message}`}\nCaused by: ${originalStack}`
  }

  return diagnostic
}

const installRuntimeErrorBridge = runtime => {
  if (!canTrackRuntime(runtime)) {
    return runtime
  }

  if (runtime[RUE_JS_ERROR_BRIDGE_KEY]) {
    return runtime
  }

  const handlers = new Set()
  const originalHandleError =
    typeof runtime.handleError === 'function' ? runtime.handleError.bind(runtime) : null
  const originalOnError =
    typeof runtime.onError === 'function' ? runtime.onError.bind(runtime) : null
  let handlingExplicitError = false

  const forwardError = (error, instance) => {
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

  originalOnError?.((error, instance) => {
    forwardError(error, instance)
  })

  runtime[RUE_JS_ERROR_HANDLERS_KEY] = handlers
  runtime.onError = fn => {
    if (typeof fn !== 'function') {
      return undefined
    }

    handlers.add(fn)
    return () => {
      handlers.delete(fn)
    }
  }

  runtime.handleError = (error, instance) => {
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

  runtime[RUE_JS_ERROR_BRIDGE_KEY] = true
  return runtime
}

const shouldDispatchCaughtError = runtime => {
  const handlers = runtime?.[RUE_JS_ERROR_HANDLERS_KEY]
  return handlers instanceof Set && handlers.size > 0
}

const dispatchCaughtError = (runtime, error, instance = null) => {
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

const wrapRuntimeEntryMethod = (runtime, methodName) => {
  const original = runtime[methodName]
  if (typeof original !== 'function') {
    return
  }

  runtime[methodName] = function wrappedRuntimeEntry(...args) {
    runtime[RUE_PENDING_ENTRY_ERROR_KEY] = undefined
    runtime[RUE_ACTIVE_ENTRY_DEPTH_KEY] = (runtime[RUE_ACTIVE_ENTRY_DEPTH_KEY] ?? 0) + 1
    let rethrowingPendingEntryError = false
    try {
      const result = original.apply(this, args)
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
}

const wrapRenderTriggeredHook = runtime => {
  const original = runtime.onRenderTriggered
  if (typeof original !== 'function') {
    return
  }

  runtime.onRenderTriggered = function wrappedOnRenderTriggered(callback) {
    if (typeof callback !== 'function') {
      return original.call(this, callback)
    }
    const normalizedCallback = event => callback(normalizeRenderTriggeredEvent(event))
    const currentInstance = runtime.getCurrentInstance?.()
    if (!isObjectLike(currentInstance)) {
      const dispose = registerSharedRenderTriggeredHook(normalizedCallback)
      if (dispose) {
        return dispose
      }
    }
    return original.call(this, normalizedCallback)
  }
}

export const wrapCreateRue = rawCreateRue => adapter => {
  const runtime = installRuntimeErrorBridge(rawCreateRue(adapter))
  if (!canTrackRuntime(runtime) || runtime[RUE_RUNTIME_ENTRY_WRAP_KEY]) {
    return runtime
  }

  for (const methodName of ['mount', 'render', 'renderAnchor', 'renderBetween', 'renderStatic']) {
    wrapRuntimeEntryMethod(runtime, methodName)
  }
  wrapRenderTriggeredHook(runtime)

  runtime[RUE_RUNTIME_ENTRY_WRAP_KEY] = true
  return runtime
}
