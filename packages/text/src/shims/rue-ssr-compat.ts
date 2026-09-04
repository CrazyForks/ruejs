import { createContext as createRueContext, useContext as useRueContext } from '@rue-js/runtime'
import { createTextElement } from '../runtime/render-protocol.js'
import {
  createSafeTextElement,
  isTextCompatRendererActive,
  readTextCompatRuntimeExport,
} from './rue-element-compat.js'
import {
  markTextCompatContextProvider,
  readTextCompatContextProviderValue,
} from './context-provider-adapter.js'
import { readContextRuntime } from './context-runtime-global.js'
import { getRequestContext, isInsideUnifiedScope } from './unified-request-context.js'

export * from '@rue-js/runtime'

type StateSetter<T> = (value: T | ((previous: T) => T)) => void
type TextCompatRuntime = {
  createContext: <T>(defaultValue: T) => unknown
  createElement: (
    type: unknown,
    props: Record<string, unknown> | null,
    ...children: unknown[]
  ) => unknown
  useContext: <T>(context: unknown) => T
}
type RueContext<T> = {
  Provider: (props: { value: T; children?: unknown }) => unknown
}
type SsrCompatContext<T> = {
  Provider: (props: { value: T; children?: unknown }) => unknown
  __textSsrCompatContext: true
  compatRuntimeContext?: unknown
  compatRuntimeContexts?: WeakMap<object, unknown>
  defaultValue: T
  rueContext: RueContext<T>
}

const SSR_COMPAT_CONTEXT_REGISTRY_KEY = Symbol.for('text.ssrCompatContextRegistry')
const SSR_COMPAT_RUE_RUNTIME_KEY = Symbol.for('text.ssrCompatRueRuntimeKey')

type SsrCompatContextRegistryGlobal = typeof globalThis & {
  [SSR_COMPAT_CONTEXT_REGISTRY_KEY]?: Map<string, SsrCompatContext<unknown>>
  [SSR_COMPAT_RUE_RUNTIME_KEY]?: object
  __textSsrCompatContextValues?: WeakMap<object, unknown>
}

function ssrCompatContextValueCacheKey(): unknown {
  return null
}

function normalizeContextRegistryStackFrame(frame: string): string {
  let cleanFrame = frame.trim().replace(/^at\s+/, '')
  const wrappedPath = cleanFrame.match(/\((.*)\)$/)?.[1]
  if (wrappedPath) cleanFrame = wrappedPath
  cleanFrame = cleanFrame
    .replace(/\$\$cache=[^:)]+/g, '')
    .replace(/[?#][^:)]+/g, '')
    .replaceAll('\\', '/')
    .replace('/@fs/', '/')
    .replace(/:\d+:\d+$/, '')
    .replace(/:\d+$/, '')
  const fixturePackageIndex = cleanFrame.lastIndexOf('/__test_packages__/')
  if (fixturePackageIndex !== -1) {
    return cleanFrame.slice(fixturePackageIndex + '/__test_packages__/'.length)
  }
  const packageIndex = cleanFrame.lastIndexOf('/node_modules/')
  if (packageIndex !== -1) return cleanFrame.slice(packageIndex + '/node_modules/'.length)
  return cleanFrame
}

function getContextRegistryKey(): string | null {
  const stack = new Error().stack
  if (!stack) return null
  const frame = stack
    .split('\n')
    .map(line => line.trim())
    .find(
      line =>
        line && line !== 'Error' && line !== 'Error:' && !line.includes('/shims/rue-ssr-compat.'),
    )
  return frame ? normalizeContextRegistryStackFrame(frame) : null
}

function readRegisteredSsrCompatContext<T>(key: string | null): SsrCompatContext<T> | null {
  if (!key) return null
  return (
    ((globalThis as SsrCompatContextRegistryGlobal)[SSR_COMPAT_CONTEXT_REGISTRY_KEY]?.get(key) as
      | SsrCompatContext<T>
      | undefined) ?? null
  )
}

function registerSsrCompatContext<T>(key: string | null, context: SsrCompatContext<T>): void {
  if (!key) return
  const globalState = globalThis as SsrCompatContextRegistryGlobal
  globalState[SSR_COMPAT_CONTEXT_REGISTRY_KEY] ??= new Map()
  globalState[SSR_COMPAT_CONTEXT_REGISTRY_KEY].set(key, context as SsrCompatContext<unknown>)
}

function getCompatRenderRuntime(): TextCompatRuntime | null {
  const createContext =
    readTextCompatRuntimeExport<TextCompatRuntime['createContext']>('createContext')
  const createElement =
    readTextCompatRuntimeExport<TextCompatRuntime['createElement']>('createElement')
  const useContext = readTextCompatRuntimeExport<TextCompatRuntime['useContext']>('useContext')
  return createContext && createElement && useContext
    ? { createContext, createElement, useContext }
    : null
}

function isTextCompatRuntime(value: unknown): value is TextCompatRuntime {
  if (typeof value !== 'object' || value === null) return false
  const runtime = value as Partial<Record<keyof TextCompatRuntime, unknown>>
  return (
    typeof runtime.createContext === 'function' &&
    typeof runtime.createElement === 'function' &&
    typeof runtime.useContext === 'function'
  )
}

function getInstalledCompatRuntime(): TextCompatRuntime | null {
  const runtime = readContextRuntime<TextCompatRuntime>()
  return isTextCompatRuntime(runtime) ? runtime : null
}

function getActiveCompatRuntime(): TextCompatRuntime | null {
  const runtime = getInstalledCompatRuntime()
  if (runtime) return runtime
  return isTextCompatRendererActive() ? getCompatRenderRuntime() : null
}

function getSsrCompatContextValues(): WeakMap<object, unknown> {
  if (isInsideUnifiedScope()) {
    const requestCache = getRequestContext().requestCache
    const cached = requestCache.get(ssrCompatContextValueCacheKey as never) as
      | WeakMap<object, unknown>
      | undefined
    if (cached) return cached
    const values = new WeakMap<object, unknown>()
    requestCache.set(ssrCompatContextValueCacheKey as never, values)
    return values
  }
  const globalState = globalThis as SsrCompatContextRegistryGlobal
  globalState.__textSsrCompatContextValues ??= new WeakMap<object, unknown>()
  return globalState.__textSsrCompatContextValues
}

function writeSsrCompatContextValue<T>(context: SsrCompatContext<T>, value: T): void {
  const values = getSsrCompatContextValues()
  values.set(context as object, value)
  values.set(context.rueContext as object, value)
}

export function writeSsrCompatContextProviderValue(context: unknown, value: unknown): void {
  if (isSsrCompatContext(context)) {
    writeSsrCompatContextValue(context, value)
  }
}

function readSsrCompatContextValue<T>(
  context: SsrCompatContext<T>,
): { found: true; value: T } | { found: false } {
  const values = getSsrCompatContextValues()
  if (values.has(context as object)) {
    return { found: true, value: values.get(context as object) as T }
  }
  if (values.has(context.rueContext as object)) {
    return { found: true, value: values.get(context.rueContext as object) as T }
  }
  return { found: false }
}

function getCompatRuntimeKey(runtime: TextCompatRuntime): object {
  const version = readTextCompatRuntimeExport<string>('version')
  if (typeof version === 'string') {
    const globalState = globalThis as SsrCompatContextRegistryGlobal
    globalState[SSR_COMPAT_RUE_RUNTIME_KEY] ??= {}
    return globalState[SSR_COMPAT_RUE_RUNTIME_KEY]
  }
  return runtime.createContext as unknown as object
}

function isSsrCompatContext<T>(context: unknown): context is SsrCompatContext<T> {
  return (
    typeof context === 'object' &&
    context !== null &&
    (context as { __textSsrCompatContext?: unknown }).__textSsrCompatContext === true
  )
}

function getOrCreateCompatRuntimeContext<T>(
  context: SsrCompatContext<T>,
  runtime: TextCompatRuntime,
): unknown {
  const runtimeKey = getCompatRuntimeKey(runtime)
  context.compatRuntimeContexts ??= new WeakMap<object, unknown>()
  let compatRuntimeContext = context.compatRuntimeContexts.get(runtimeKey)
  if (!compatRuntimeContext) {
    compatRuntimeContext = runtime.createContext(context.defaultValue)
    context.compatRuntimeContexts.set(runtimeKey, compatRuntimeContext)
    markTextCompatContextProvider(
      (compatRuntimeContext as { Provider?: unknown }).Provider,
      context as object,
    )
  }
  context.compatRuntimeContext = compatRuntimeContext
  return compatRuntimeContext
}

export function createContext<T>(defaultValue: T): SsrCompatContext<T> {
  const registryKey = getContextRegistryKey()
  const registeredContext = readRegisteredSsrCompatContext<T>(registryKey)
  if (registeredContext) return registeredContext

  const rueContext = createRueContext(defaultValue) as RueContext<T>
  const context: SsrCompatContext<T> = {
    __textSsrCompatContext: true,
    compatRuntimeContexts: new WeakMap<object, unknown>(),
    defaultValue,
    rueContext,
    Provider(props) {
      const runtime = getActiveCompatRuntime()
      writeSsrCompatContextValue(context, props.value)
      if (runtime) {
        const compatRuntimeContext = getOrCreateCompatRuntimeContext(context, runtime)
        return createSafeTextElement(
          runtime.createElement,
          (compatRuntimeContext as { Provider?: unknown }).Provider,
          { value: props.value },
          props.children,
        )
      }
      return createTextElement(rueContext.Provider as never, { value: props.value }, props.children)
    },
  }
  markTextCompatContextProvider(context.Provider, context as object)
  registerSsrCompatContext(registryKey, context)
  return context
}

export function createElement(
  type: unknown,
  props: Record<string, unknown> | null,
  ...children: unknown[]
): unknown {
  const runtime = getActiveCompatRuntime()
  if (runtime) return createSafeTextElement(runtime.createElement, type, props, ...children)
  return createTextElement(type as never, props, ...(children as never[]))
}

export function useContext<T>(context: SsrCompatContext<T> | unknown): T {
  const runtime = getActiveCompatRuntime()
  if (isSsrCompatContext<T>(context)) {
    const ssrProvided = readSsrCompatContextValue(context)
    if (ssrProvided.found) return ssrProvided.value
    const compatProvided = readTextCompatContextProviderValue<T>(context as object)
    if (compatProvided.found) return compatProvided.value
    const rueProvided = readTextCompatContextProviderValue<T>(context.rueContext as object)
    if (rueProvided.found) return rueProvided.value
    if (runtime) {
      try {
        return runtime.useContext<T>(getOrCreateCompatRuntimeContext(context, runtime))
      } catch {
        // Outside a Rue compat render, fall through to the Rue context.
      }
    }
    return useRueContext(context.rueContext as never) as T
  }
  if (runtime) return runtime.useContext<T>(context)
  return useRueContext(context as never) as T
}

function resolveInitialState<T>(initialState: T | (() => T)): T {
  return typeof initialState === 'function' ? (initialState as () => T)() : initialState
}

export function useState<T>(initialState: T | (() => T)): [T, StateSetter<T>] {
  let state = resolveInitialState(initialState)

  const setState: StateSetter<T> = value => {
    state = typeof value === 'function' ? (value as (previous: T) => T)(state) : value
  }

  return [state, setState]
}

export function useRef<T>(initialValue: T): { current: T } {
  return { current: initialValue }
}

export function useEffect(): void {}

export const useLayoutEffect = useEffect

export function useMemo<T>(factory: () => T): T {
  return factory()
}

export function useCallback<T extends (...args: never[]) => unknown>(callback: T): T {
  return callback
}

export function startTransition(callback: () => void): void {
  callback()
}

export function useSyncExternalStore<T>(
  _subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => T,
  getServerSnapshot?: () => T,
): T {
  return getServerSnapshot ? getServerSnapshot() : getSnapshot()
}
