import {
  deleteContextRuntime,
  readContextRuntime,
  setContextRuntime,
} from '../shims/context-runtime-global.js'
import {
  createAppServerElement,
  readAppRuntimeExport,
  type AppRuntimeExportKey,
} from './app-element-runtime-protocol.js'

type AppContextRuntime = {
  createContext: <T>(defaultValue: T) => unknown
  createElement: (
    type: unknown,
    props: Record<string, unknown> | null,
    ...children: unknown[]
  ) => unknown
  startTransition: (callback: () => void) => void
  useCallback: <T extends (...args: never[]) => unknown>(callback: T, deps: readonly unknown[]) => T
  useContext: <T>(context: unknown) => T
  useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => void
  useMemo: <T>(factory: () => T, deps: readonly unknown[]) => T
  useRef: <T>(initialValue: T) => { current: T }
  useState: <T>(initialState: T | (() => T)) => [T, (value: T | ((previous: T) => T)) => void]
  use: <T>(thenable: PromiseLike<T>) => T
}

function readRequiredAppRuntimeExport<T>(key: AppRuntimeExportKey): T {
  const value = readAppRuntimeExport<T>(key)
  if (!value) {
    throw new Error(`text: ${key} is unavailable in the App SSR runtime.`)
  }
  return value
}

function createElementCompat(
  type: unknown,
  props: Record<string, unknown> | null,
  ...children: unknown[]
): unknown {
  return createAppServerElement(type, props, ...children)
}

const appContextRuntime: AppContextRuntime = {
  createContext: readRequiredAppRuntimeExport<AppContextRuntime['createContext']>('createContext'),
  createElement: createElementCompat,
  startTransition:
    readRequiredAppRuntimeExport<AppContextRuntime['startTransition']>('startTransition'),
  useCallback: readRequiredAppRuntimeExport<AppContextRuntime['useCallback']>('useCallback'),
  useContext: readRequiredAppRuntimeExport<AppContextRuntime['useContext']>('useContext'),
  useEffect: readRequiredAppRuntimeExport<AppContextRuntime['useEffect']>('useEffect'),
  useMemo: readRequiredAppRuntimeExport<AppContextRuntime['useMemo']>('useMemo'),
  useRef: readRequiredAppRuntimeExport<AppContextRuntime['useRef']>('useRef'),
  useState: readRequiredAppRuntimeExport<AppContextRuntime['useState']>('useState'),
  use: readRequiredAppRuntimeExport<AppContextRuntime['use']>('use'),
}

let activeAppContextRuntimeScopes = 0
let previousAppContextRuntime: AppContextRuntime | undefined

function installAppContextRuntime(): () => void {
  if (activeAppContextRuntimeScopes === 0) {
    previousAppContextRuntime = readContextRuntime<AppContextRuntime>()
    setContextRuntime(appContextRuntime)
  }
  activeAppContextRuntimeScopes += 1
  let restored = false
  return () => {
    if (restored) return
    restored = true
    activeAppContextRuntimeScopes -= 1
    if (activeAppContextRuntimeScopes === 0) {
      if (previousAppContextRuntime) {
        setContextRuntime(previousAppContextRuntime)
      } else {
        deleteContextRuntime()
      }
      previousAppContextRuntime = undefined
    }
  }
}

export function readAppThenableValue<T>(thenable: PromiseLike<T>): T {
  const useThenable =
    readRequiredAppRuntimeExport<<TValue>(thenable: PromiseLike<TValue>) => TValue>('use')
  return useThenable(thenable)
}

export async function runWithAppContextRuntime<T>(callback: () => Promise<T>): Promise<T> {
  const restoreRuntime = installAppContextRuntime()
  try {
    const result = await callback()
    restoreRuntime()
    return result
  } catch (error) {
    restoreRuntime()
    throw error
  }
}

function restoreAppContextRuntimeWhenStreamSettles<
  T extends ReadableStream<Uint8Array> & {
    allReady?: Promise<void>
  },
>(stream: T, restoreRuntime: () => void): T {
  const reader = stream.getReader()
  let restored = false
  const restoreOnce = () => {
    if (restored) return
    restored = true
    restoreRuntime()
  }

  const wrapped = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const result = await reader.read()
        if (result.done) {
          restoreOnce()
          controller.close()
          return
        }
        controller.enqueue(result.value)
      } catch (error) {
        restoreOnce()
        throw error
      }
    },
    async cancel(reason) {
      restoreOnce()
      await reader.cancel(reason)
    },
  }) as T

  if (stream.allReady) {
    Object.defineProperty(wrapped, 'allReady', {
      configurable: true,
      enumerable: false,
      value: stream.allReady,
      writable: false,
    })
  }

  return wrapped
}

export async function runWithAppContextRuntimeStream<
  T extends ReadableStream<Uint8Array> & { allReady?: Promise<void> },
>(callback: () => Promise<T>): Promise<T> {
  const restoreRuntime = installAppContextRuntime()
  try {
    return restoreAppContextRuntimeWhenStreamSettles(await callback(), restoreRuntime)
  } catch (error) {
    restoreRuntime()
    throw error
  }
}

export function runWithAppContextRuntimeSync<T>(callback: () => T): T {
  const restoreRuntime = installAppContextRuntime()
  try {
    return callback()
  } finally {
    restoreRuntime()
  }
}
