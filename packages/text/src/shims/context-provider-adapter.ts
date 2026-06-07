const TEXT_COMPAT_CONTEXT_PROVIDER_KEY = Symbol.for('text.compatContextProvider')
const TEXT_COMPAT_CONTEXT_VALUE_STACK_KEY = Symbol.for('text.compatContextValueStack')

type ContextProviderGlobal = typeof globalThis & {
  [TEXT_COMPAT_CONTEXT_PROVIDER_KEY]?: WeakMap<object, ContextProviderContext>
  [TEXT_COMPAT_CONTEXT_VALUE_STACK_KEY]?: Array<Map<object, unknown>>
}

type ContextProviderContext = object | (() => object | null)

function getContextProviderRegistry(): WeakMap<object, ContextProviderContext> {
  const globalState = globalThis as ContextProviderGlobal
  globalState[TEXT_COMPAT_CONTEXT_PROVIDER_KEY] ??= new WeakMap()
  return globalState[TEXT_COMPAT_CONTEXT_PROVIDER_KEY]
}

export function markTextCompatContextProvider(
  provider: unknown,
  context: ContextProviderContext,
): void {
  if ((typeof provider !== 'object' && typeof provider !== 'function') || provider === null) {
    return
  }
  getContextProviderRegistry().set(provider, context)
}

export function readTextCompatContextProviderContext(provider: unknown): object | null {
  if ((typeof provider !== 'object' && typeof provider !== 'function') || provider === null) {
    return null
  }
  const context = getContextProviderRegistry().get(provider)
  if (!context) return null
  return typeof context === 'function' ? context() : context
}

function getContextValueStack(): Array<Map<object, unknown>> {
  const globalState = globalThis as ContextProviderGlobal
  globalState[TEXT_COMPAT_CONTEXT_VALUE_STACK_KEY] ??= []
  return globalState[TEXT_COMPAT_CONTEXT_VALUE_STACK_KEY]
}

export function readTextCompatContextProviderValue<T>(
  context: unknown,
): { found: true; value: T } | { found: false; value?: never } {
  if (typeof context !== 'object' || context === null) return { found: false }
  const stack = getContextValueStack()
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    const scope = stack[i]
    if (scope.has(context)) {
      return { found: true, value: scope.get(context) as T }
    }
  }
  return { found: false }
}

export function runWithTextCompatContextProviderValue<T>(
  context: object,
  value: unknown,
  callback: () => T,
): T {
  const stack = getContextValueStack()
  const scope = new Map<object, unknown>()
  scope.set(context, value)
  stack.push(scope)
  let popOnReturn = true
  try {
    const result = callback()
    if (isThenable(result)) {
      popOnReturn = false
      return Promise.resolve(result).finally(() => {
        stack.pop()
      }) as T
    }
    return result
  } finally {
    if (popOnReturn) {
      stack.pop()
    }
  }
}

function isThenable<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}
