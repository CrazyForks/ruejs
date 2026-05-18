const RUE_JS_ERROR_BRIDGE_KEY = '__rue_js_error_bridge_installed'
const RUE_JS_ERROR_HANDLERS_KEY = '__rue_js_error_handlers'
const RUE_RUNTIME_ENTRY_WRAP_KEY = '__rue_runtime_vapor_entry_wrapped__'
const RUE_WASM_TRAP_ERROR_NAME = 'RueWasmTrapError'

const canTrackRuntime = runtime =>
  (typeof runtime === 'object' || typeof runtime === 'function') && runtime != null

const getErrorShape = error => (error && typeof error === 'object' ? error : null)

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
    if (originalHandleError) {
      try {
        originalHandleError(error, instance)
      } catch {}
    } else if (handlers.size === 0) {
      try {
        console.error?.(error)
      } catch {}
    }

    handlers.forEach(handler => {
      try {
        handler(error, instance)
      } catch {}
    })
  }

  runtime[RUE_JS_ERROR_BRIDGE_KEY] = true
  return runtime
}

const shouldDispatchCaughtError = runtime => {
  const handlers = runtime?.[RUE_JS_ERROR_HANDLERS_KEY]
  return handlers instanceof Set && handlers.size > 0
}

const wrapRuntimeEntryMethod = (runtime, methodName) => {
  const original = runtime[methodName]
  if (typeof original !== 'function') {
    return
  }

  runtime[methodName] = function wrappedRuntimeEntry(...args) {
    try {
      return original.apply(this, args)
    } catch (error) {
      const normalized = normalizeRuntimeVaporFlushError(error)
      if (shouldDispatchCaughtError(runtime)) {
        try {
          runtime.handleError?.(normalized, null)
        } catch {}
      }
      throw normalized
    }
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

  runtime[RUE_RUNTIME_ENTRY_WRAP_KEY] = true
  return runtime
}
