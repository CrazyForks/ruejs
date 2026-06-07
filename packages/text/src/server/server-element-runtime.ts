import {
  deleteContextRuntime,
  readContextRuntime,
  setContextRuntime,
} from '../shims/context-runtime-global.js'
import {
  markTextCompatContextProvider,
  readTextCompatContextProviderValue,
} from '../shims/context-provider-adapter.js'
import {
  readAppRuntimeDispatcherCarrier,
  readAppRuntimeExport,
  type AppRuntimeDispatcherCarrier,
} from './app-element-runtime-protocol.js'
import { createServerProtocolElement } from './element-protocol.js'

type ServerElementContext<T> = {
  defaultValue: T
  Provider: (props: { value: T; children?: unknown }) => unknown
}

type ThenableRecord<T> =
  | { status: 'pending'; value: PromiseLike<T> }
  | { status: 'fulfilled'; value: T }
  | { reason: unknown; status: 'rejected' }

const thenableRecords = new WeakMap<PromiseLike<unknown>, ThenableRecord<unknown>>()
let serverElementId = 0

function createServerElementContext<T>(defaultValue: T): ServerElementContext<T> {
  const context = {
    defaultValue,
    Provider(props) {
      return props.children ?? null
    },
  }
  markTextCompatContextProvider(context.Provider, context)
  return context
}

function readServerElementThenable<T>(thenable: PromiseLike<T>): T {
  const existing = thenableRecords.get(thenable as PromiseLike<unknown>) as
    | ThenableRecord<T>
    | undefined
  if (existing) {
    if (existing.status === 'fulfilled') return existing.value
    if (existing.status === 'rejected') throw existing.reason
    throw existing.value
  }

  const record: ThenableRecord<T> = {
    status: 'pending',
    value: thenable,
  }
  thenableRecords.set(thenable as PromiseLike<unknown>, record as ThenableRecord<unknown>)

  Promise.resolve(thenable).then(
    value => {
      thenableRecords.set(
        thenable as PromiseLike<unknown>,
        {
          status: 'fulfilled',
          value,
        } as ThenableRecord<unknown>,
      )
    },
    reason => {
      thenableRecords.set(thenable as PromiseLike<unknown>, {
        reason,
        status: 'rejected',
      })
    },
  )

  throw thenable
}

const serverElementRuntime = {
  createContext<T>(defaultValue: T): unknown {
    const createContext =
      readAppRuntimeExport<<TValue>(defaultContextValue: TValue) => unknown>('createContext')
    const context = createContext
      ? createContext(defaultValue)
      : createServerElementContext(defaultValue)
    const provider = (context as { Provider?: unknown } | null)?.Provider
    markTextCompatContextProvider(provider, context as object)
    return context
  },
  createElement(type: unknown, props: Record<string, unknown> | null, ...children: unknown[]) {
    return createServerProtocolElement(type, props, ...children)
  },
  startTransition(callback: () => void): void {
    callback()
  },
  useCallback<T extends (...args: never[]) => unknown>(callback: T): T {
    return callback
  },
  useContext<T>(context: unknown): T {
    const compatValue = readTextCompatContextProviderValue<T>(context)
    if (compatValue.found) return compatValue.value
    const value = readServerElementContextValue<T>(context)
    if (value.found) return value.value
    if (typeof context === 'object' && context !== null && '_currentValue' in context) {
      return (context as { _currentValue: T })._currentValue
    }
    return (context as ServerElementContext<T>).defaultValue
  },
  useEffect(): void {},
  useId(): string {
    serverElementId += 1
    return `:R${serverElementId.toString(36)}:`
  },
  useImperativeHandle(): void {},
  useInsertionEffect(): void {},
  useLayoutEffect(): void {},
  useMemo<T>(factory: () => T): T {
    return factory()
  },
  useOptimistic<TState, TAction>(
    passthrough: TState,
    _reducer?: (state: TState, action: TAction) => TState,
  ): [TState, (action: TAction) => void] {
    return [passthrough, () => {}]
  },
  useReducer<TState, TAction>(
    reducer: (state: TState, action: TAction) => TState,
    initialArg: TState,
    init?: (arg: TState) => TState,
  ): [TState, (action: TAction) => void] {
    const value = init ? init(initialArg) : initialArg
    return [value, () => {}]
  },
  useRef<T>(initialValue: T): { current: T } {
    return { current: initialValue }
  },
  useState<T>(initialState: T | (() => T)): [T, (value: T | ((previous: T) => T)) => void] {
    const value = typeof initialState === 'function' ? (initialState as () => T)() : initialState
    return [value, () => {}]
  },
  useTransition(): [boolean, (callback: () => void) => void] {
    return [false, callback => callback()]
  },
  useDeferredValue<T>(value: T): T {
    return value
  },
  use<T>(thenable: PromiseLike<T>): T {
    return readServerElementThenable(thenable)
  },
  useSyncExternalStore<T>(
    _subscribe: (onStoreChange: () => void) => () => void,
    getSnapshot: () => T,
    getServerSnapshot?: () => T,
  ): T {
    return getServerSnapshot ? getServerSnapshot() : getSnapshot()
  },
}

type ServerElementRuntime = typeof serverElementRuntime

const TEXT_SERVER_ELEMENT_RUNTIME_KEY = Symbol.for('text.serverElementRuntime')
let activeServerElementRuntimeScopes = 0
let previousServerElementRuntime: ServerElementRuntime | undefined
let activeRueDispatcherCarrier: AppRuntimeDispatcherCarrier | null = null
let previousRueHookDispatcher: unknown
const serverElementContextStack: Array<Map<object, unknown>> = []

function isThenable<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}

export function installServerElementRuntime(): () => void {
  const globalState = globalThis as Record<symbol, unknown>
  if (activeServerElementRuntimeScopes === 0) {
    previousServerElementRuntime = readContextRuntime<ServerElementRuntime>()
    setContextRuntime(serverElementRuntime)
    const rueInternals = readAppRuntimeDispatcherCarrier()
    activeRueDispatcherCarrier = rueInternals
    previousRueHookDispatcher = rueInternals?.H
    if (rueInternals) {
      rueInternals.H = serverElementRuntime
    }
  }
  const previousServerElementRuntimeFlag = globalState[TEXT_SERVER_ELEMENT_RUNTIME_KEY]
  const previousServerElementRuntimeCount =
    typeof previousServerElementRuntimeFlag === 'number' ? previousServerElementRuntimeFlag : 0
  globalState[TEXT_SERVER_ELEMENT_RUNTIME_KEY] = previousServerElementRuntimeCount + 1
  activeServerElementRuntimeScopes += 1

  let restored = false
  return () => {
    if (restored) return
    restored = true
    activeServerElementRuntimeScopes -= 1
    if (previousServerElementRuntimeFlag === undefined) {
      delete globalState[TEXT_SERVER_ELEMENT_RUNTIME_KEY]
    } else {
      globalState[TEXT_SERVER_ELEMENT_RUNTIME_KEY] = previousServerElementRuntimeFlag
    }
    if (activeServerElementRuntimeScopes === 0) {
      if (previousServerElementRuntime) {
        setContextRuntime(previousServerElementRuntime)
      } else {
        deleteContextRuntime()
      }
      if (activeRueDispatcherCarrier) {
        activeRueDispatcherCarrier.H = previousRueHookDispatcher
      }
      activeRueDispatcherCarrier = null
      previousRueHookDispatcher = undefined
      previousServerElementRuntime = undefined
    }
  }
}

export function restoreServerElementRuntimeWhenStreamSettles(
  stream: ReadableStream<Uint8Array>,
  restoreRuntime: () => void,
): ReadableStream<Uint8Array> {
  const reader = stream.getReader()

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const result = await reader.read()
        if (result.done) {
          restoreRuntime()
          controller.close()
          return
        }
        controller.enqueue(result.value)
      } catch (error) {
        restoreRuntime()
        throw error
      }
    },
    async cancel(reason) {
      restoreRuntime()
      await reader.cancel(reason)
    },
  })
}

export function runWithServerElementRuntime<T>(callback: () => T): T {
  const restoreRuntime = installServerElementRuntime()
  let restoreOnReturn = true
  try {
    const result = callback()
    if (isThenable(result)) {
      restoreOnReturn = false
      return Promise.resolve(result).finally(restoreRuntime) as T
    }
    return result
  } finally {
    if (restoreOnReturn) {
      restoreRuntime()
    }
  }
}

function readServerElementContextValue<T>(
  context: unknown,
): { found: true; value: T } | { found: false; value?: never } {
  if (typeof context !== 'object' || context === null) return { found: false }
  for (let i = serverElementContextStack.length - 1; i >= 0; i -= 1) {
    const scope = serverElementContextStack[i]
    if (scope.has(context)) {
      return { found: true, value: scope.get(context) as T }
    }
  }
  return { found: false }
}

export function runWithServerElementContextValue<T>(
  context: object,
  value: unknown,
  callback: () => T,
): T {
  const scope = new Map<object, unknown>()
  scope.set(context, value)
  serverElementContextStack.push(scope)
  let popOnReturn = true
  try {
    const result = callback()
    if (isThenable(result)) {
      popOnReturn = false
      return Promise.resolve(result).finally(() => {
        serverElementContextStack.pop()
      }) as T
    }
    return result
  } finally {
    if (popOnReturn) {
      serverElementContextStack.pop()
    }
  }
}

export function runWithServerElementRuntimeStream(
  renderStream: () => ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const restoreRuntime = installServerElementRuntime()
  try {
    return restoreServerElementRuntimeWhenStreamSettles(renderStream(), restoreRuntime)
  } catch (error) {
    restoreRuntime()
    throw error
  }
}
