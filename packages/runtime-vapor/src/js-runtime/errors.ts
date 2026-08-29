import type { ErrorController, ErrorHandler, ObjectLike } from './types.js'

/*
错误处理桥接：onError

注册全局错误处理器。组件级错误处理会优先消费，未处理的错误再派发到这里。
*/

const isObjectLike = (value: unknown): value is ObjectLike =>
  (typeof value === 'object' || typeof value === 'function') && value != null

const dispatchErrorCaptured = (error: unknown, instance: unknown, info: string): boolean => {
  const bridge = globalThis.__rue_runtime_vapor_shared_bridge
  if (typeof bridge?.dispatchErrorCaptured === 'function') {
    return bridge.dispatchErrorCaptured(error, instance, info) === true
  }
  const dispatch = globalThis.__rue_dispatch_error_captured
  return typeof dispatch === 'function' && dispatch(error, instance, info) === true
}

/** ErrorCaptured bridge plus Runtime-global handlers, scoped to one JavaScript Runtime. */
export const createErrorController = (): ErrorController => {
  const globalHandlers = new Set<ErrorHandler>()
  const propagating = new WeakSet<ObjectLike>()
  let lastError: unknown

  const onError = (callback: unknown): (() => boolean) | undefined => {
    if (typeof callback !== 'function') return undefined
    const handler = callback as ErrorHandler
    globalHandlers.add(handler)
    return () => globalHandlers.delete(handler)
  }

  const notifyGlobal = (error: unknown, instance: unknown): void => {
    lastError = error
    for (const handler of globalHandlers) {
      try {
        handler(error, instance)
      } catch {}
    }
  }

  return {
    capture: dispatchErrorCaptured,
    clear() {
      globalHandlers.clear()
      lastError = undefined
    },
    getLastError: () => lastError,
    isPropagating: (error: unknown) => isObjectLike(error) && propagating.has(error),
    markPropagating(error: unknown) {
      if (isObjectLike(error)) propagating.add(error)
    },
    notifyGlobal,
    onError,
  }
}
