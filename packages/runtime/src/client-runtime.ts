/*
Client runtime ownership
- Default and Vapor entries resolve the same runtime for the active DOM bridge.
- Explicit createRue() calls still create independent runtime instances.
- Runtime DOM binding and error-bridge installation happen on one path.
*/

import { createRue as createRueRuntime } from './runtime-core/index'
import { BrowserDOMAdapter, registerDOMBridgeConsumer, setDOMAdapter } from './dom'
import { dispatchErrorCaptured, wasErrorCapturedDispatched } from './error-capture'
import { runWithRuntime } from './runtime-context'
import type { Rue } from './runtime-types'

const RUE_CLIENT_RUNTIME_CACHE_KEY = '__rue_client_runtime_by_dom_bridge__'
const RUE_JS_ERROR_BRIDGE_KEY = '__rue_js_error_bridge_installed'

type ClientRuntimeGlobal = typeof globalThis & {
  __rue?: Rue
  __rue_client_error_handlers__?: Set<(error: any, instance?: any) => void>
  __rue_dom?: unknown
  __rue_compiled_runtime_bridge?: {
    popCurrentContainer?(): void
    pushCurrentContainer?(container: unknown): void
  }
  __rue_root_mount_error_rethrow_depth__?: number
  [RUE_CLIENT_RUNTIME_CACHE_KEY]?: WeakMap<object, Rue>
}

const clientRuntimeGlobal = globalThis as ClientRuntimeGlobal
const runtimeDOMBridgeByInstance = new WeakMap<object, unknown>()
const registeredDOMBridgeConsumers = new WeakSet<object>()
const runtimeErrorHandlers = new WeakMap<object, Set<(error: any, instance?: any) => void>>()

const getClientErrorHandlers = () =>
  (clientRuntimeGlobal.__rue_client_error_handlers__ ??= new Set())

export const installClientErrorBridge = (): void => {
  const target = clientRuntimeGlobal as ClientRuntimeGlobal & {
    __rue_report_client_error__?: (error: any, instance?: any) => boolean
  }
  if (typeof target.__rue_report_client_error__ === 'function') return

  target.__rue_report_client_error__ = (error, instance) => {
    const handlers = getClientErrorHandlers()
    for (const handler of handlers) handler(error, instance)
    return handlers.size > 0
  }
}

export const registerClientErrorHandler = (
  handler: (error: any, instance?: any) => void,
): (() => void) => {
  installClientErrorBridge()
  const clientErrorHandlers = getClientErrorHandlers()
  clientErrorHandlers.add(handler)
  return () => clientErrorHandlers.delete(handler)
}

/** 根挂载入口要求未消费错误同步返回给应用控制器，以便执行完整回滚。 */
export const runWithRootMountErrorRethrow = <T>(runner: () => T): T => {
  clientRuntimeGlobal.__rue_root_mount_error_rethrow_depth__ =
    (clientRuntimeGlobal.__rue_root_mount_error_rethrow_depth__ ?? 0) + 1
  try {
    return runner()
  } finally {
    const depth = (clientRuntimeGlobal.__rue_root_mount_error_rethrow_depth__ ?? 1) - 1
    if (depth === 0) delete clientRuntimeGlobal.__rue_root_mount_error_rethrow_depth__
    else clientRuntimeGlobal.__rue_root_mount_error_rethrow_depth__ = depth
  }
}

const canTrackRuntime = (runtime: unknown): runtime is object =>
  (typeof runtime === 'object' || typeof runtime === 'function') && runtime != null

const getRuntimeCache = () =>
  (clientRuntimeGlobal[RUE_CLIENT_RUNTIME_CACHE_KEY] ??= new WeakMap<object, Rue>())

const getClientDOMBridge = (): object => {
  if (!canTrackRuntime(clientRuntimeGlobal.__rue_dom)) {
    setDOMAdapter(new BrowserDOMAdapter())
  }
  return clientRuntimeGlobal.__rue_dom as object
}

const installRuntimeErrorBridge = <T>(runtime: T): T => {
  if (!canTrackRuntime(runtime)) {
    return runtime
  }

  installClientErrorBridge()

  ;(
    globalThis as typeof globalThis & {
      __rue_dispatch_error_captured?: (error: any, instance?: any, info?: string) => boolean
    }
  ).__rue_dispatch_error_captured = (error, instance, info) =>
    wasErrorCapturedDispatched(error) ? false : dispatchErrorCaptured(error, instance, info)

  if ((runtime as Record<string, unknown>)[RUE_JS_ERROR_BRIDGE_KEY]) {
    return runtime
  }

  const handlers = new Set<(error: any, instance?: any) => void>()
  const clientErrorHandlers = getClientErrorHandlers()
  runtimeErrorHandlers.set(runtime, handlers)

  const runtimeWithErrorHandler = runtime as { handleError?: (error: any, instance?: any) => void }
  const originalHandleError =
    typeof runtimeWithErrorHandler.handleError === 'function'
      ? runtimeWithErrorHandler.handleError.bind(runtime)
      : null

  ;(runtime as { onError?: unknown }).onError = (fn: (error: any, instance?: any) => void) => {
    if (typeof fn !== 'function') {
      return undefined
    }

    handlers.add(fn)
    clientErrorHandlers.add(fn)
    return () => {
      handlers.delete(fn)
      clientErrorHandlers.delete(fn)
    }
  }

  ;(runtime as { handleError?: unknown }).handleError = (error: any, instance?: any) => {
    if (!wasErrorCapturedDispatched(error) && dispatchErrorCaptured(error, instance)) {
      return false
    }

    if (originalHandleError) {
      try {
        originalHandleError(error, instance)
      } catch {}
    } else if (handlers.size === 0) {
      try {
        ;(console as any).error?.(error)
      } catch {}
    }

    handlers.forEach(handler => {
      try {
        handler(error, instance)
      } catch {}
    })

    return true
  }

  ;(runtime as Record<string, unknown>)[RUE_JS_ERROR_BRIDGE_KEY] = true
  return runtime
}

/** Read the DOM bridge currently bound to a runtime. */
export const getMarkedRuntimeDOMBridge = (runtime: unknown) => {
  if (!canTrackRuntime(runtime)) {
    return undefined
  }
  return runtimeDOMBridgeByInstance.get(runtime)
}

/** Mark a runtime as synchronized with a DOM bridge and subscribe it to bridge updates. */
export const markRuntimeDOMBridge = (runtime: unknown, bridge: unknown) => {
  if (!canTrackRuntime(runtime)) {
    return
  }
  runtimeDOMBridgeByInstance.set(runtime, bridge)
  if (!registeredDOMBridgeConsumers.has(runtime)) {
    registeredDOMBridgeConsumers.add(runtime)
    registerDOMBridgeConsumer(runtime)
  }
}

/** Ensure an explicit or shared runtime is bound to the current DOM bridge. */
export const ensureRuntimeDOMBridge = (runtime: unknown) => {
  const runtimeWithDOM = runtime as { setDOMAdapter?: (bridge: unknown) => void } | null | undefined
  if (typeof runtimeWithDOM?.setDOMAdapter !== 'function') {
    return
  }
  const bridge = getClientDOMBridge()
  if (getMarkedRuntimeDOMBridge(runtime) === bridge) {
    return
  }
  runtimeWithDOM.setDOMAdapter(bridge)
  markRuntimeDOMBridge(runtime, bridge)
}

/** Create an independent client runtime without adding it to the default bridge cache. */
export const createClientRuntime = (): Rue => {
  const bridge = getClientDOMBridge()
  const runtime = installRuntimeErrorBridge(createRueRuntime(bridge) as Rue)
  markRuntimeDOMBridge(runtime, bridge)
  return runtime
}

/** Get the one default client runtime associated with the current DOM bridge. */
export const getClientRuntime = (): Rue => {
  const bridge = getClientDOMBridge()
  const cache = getRuntimeCache()
  let runtime = cache.get(bridge)

  if (!runtime && canTrackRuntime(clientRuntimeGlobal.__rue)) {
    runtime = clientRuntimeGlobal.__rue as Rue
  }
  if (!runtime) {
    runtime = createClientRuntime()
  } else {
    installRuntimeErrorBridge(runtime)
    ensureRuntimeDOMBridge(runtime)
  }

  cache.set(bridge, runtime)
  clientRuntimeGlobal.__rue = runtime
  return runtime
}

/** Activate a client runtime/container pair and restore both outer contexts afterward. */
export const runWithClientRuntime = <T>(runtime: Rue, runner: () => T, container?: unknown): T => {
  ensureRuntimeDOMBridge(runtime)
  return runWithRuntime(runtime, () => {
    const bridge = clientRuntimeGlobal.__rue_compiled_runtime_bridge
    const didPush = container != null && typeof bridge?.pushCurrentContainer === 'function'
    if (didPush) {
      bridge.pushCurrentContainer!(container)
    }
    try {
      return runner()
    } finally {
      if (didPush) {
        bridge?.popCurrentContainer?.()
      }
    }
  })
}
