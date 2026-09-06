import {
  createContext as createNativeTextContext,
  useContext as useNativeTextContext,
  useEffect as useNativeTextEffect,
  useRef as useNativeTextRef,
  useState as useNativeTextState,
} from '@rue-js/rue'
import { createTextElement } from '../runtime/render-protocol.js'
import {
  createSafeTextElement,
  isTextCompatRendererActive,
  readTextCompatRuntimeExport,
} from './rue-element-compat.js'
import { readContextRuntime } from './context-runtime-global.js'
import { getRequestContext, isInsideUnifiedScope } from './unified-request-context.js'

type TextCompatHookRuntime = {
  createContext: <T>(defaultValue: T) => unknown
  createElement: (
    type: unknown,
    props: Record<string, unknown> | null,
    ...children: unknown[]
  ) => unknown
  startTransition: (callback: () => void) => void
  useContext: <T>(context: unknown) => T
  useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => void
  useRef: <T>(initialValue: T) => { current: T }
  useState: <T>(initialState: T | (() => T)) => [T, (value: T | ((previous: T) => T)) => void]
  useSyncExternalStore?: <T>(
    subscribe: (onStoreChange: () => void) => () => void,
    getSnapshot: () => T,
    getServerSnapshot?: () => T,
  ) => T
  use?: <T>(thenable: PromiseLike<T>) => T
}

type TextCompatElementRuntime = Pick<
  TextCompatHookRuntime,
  'createContext' | 'createElement' | 'useContext'
>

type NativeTextContext<T> = {
  Provider: (props: { value: T; children?: unknown }) => unknown
}

type HookCompatContext<T> = {
  Provider: (props: { value: T; children?: unknown }) => unknown
  __textHookCompatContext: true
  defaultValue: T
  compatRuntimeContext?: unknown
  nativeTextContext: NativeTextContext<T>
}

const HOOK_COMPAT_CONTEXT_REGISTRY_KEY = Symbol.for('text.hookCompatContextRegistry')

type CacheNode = {
  objects: WeakMap<object, CacheNode>
  primitives: Map<unknown, CacheNode>
  hasValue: boolean
  value: unknown
}

type HookCompatContextRegistryGlobal = typeof globalThis & {
  [HOOK_COMPAT_CONTEXT_REGISTRY_KEY]?: Map<string, HookCompatContext<unknown>>
}

const globalRueCache = new WeakMap<(...args: never[]) => unknown, CacheNode>()

function createCacheNode(): CacheNode {
  return {
    objects: new WeakMap(),
    primitives: new Map(),
    hasValue: false,
    value: undefined,
  }
}

function getRueCacheRoot(fn: (...args: never[]) => unknown): CacheNode {
  if (isInsideUnifiedScope()) {
    const requestCache = getRequestContext().requestCache
    const cached = requestCache.get(fn) as CacheNode | undefined
    if (cached) return cached
    const root = createCacheNode()
    requestCache.set(fn, root)
    return root
  }

  const cached = globalRueCache.get(fn)
  if (cached) return cached
  const root = createCacheNode()
  globalRueCache.set(fn, root)
  return root
}

function getRueCacheNode(root: CacheNode, args: readonly unknown[]): CacheNode {
  let node = root
  for (const arg of args) {
    const isObjectKey = (typeof arg === 'object' && arg !== null) || typeof arg === 'function'
    const map = isObjectKey ? node.objects : node.primitives
    const key = arg as object
    let text = map.get(key)
    if (!text) {
      text = createCacheNode()
      map.set(key, text)
    }
    node = text
  }
  return node
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
    .find(line => line && !line.includes('/shims/hooks-adapter.'))
  return frame ? normalizeContextRegistryStackFrame(frame) : null
}

function readRegisteredHookCompatContext<T>(key: string | null): HookCompatContext<T> | null {
  if (!key) return null
  return (
    ((globalThis as HookCompatContextRegistryGlobal)[HOOK_COMPAT_CONTEXT_REGISTRY_KEY]?.get(key) as
      | HookCompatContext<T>
      | undefined) ?? null
  )
}

function registerHookCompatContext<T>(key: string | null, context: HookCompatContext<T>): void {
  if (!key) return
  const globalState = globalThis as HookCompatContextRegistryGlobal
  globalState[HOOK_COMPAT_CONTEXT_REGISTRY_KEY] ??= new Map()
  globalState[HOOK_COMPAT_CONTEXT_REGISTRY_KEY].set(key, context as HookCompatContext<unknown>)
}

function isCompleteTextCompatHookRuntime(value: unknown): value is TextCompatHookRuntime {
  if (typeof value !== 'object' || value === null) return false
  const runtime = value as Partial<Record<keyof TextCompatHookRuntime, unknown>>
  return (
    typeof runtime.createContext === 'function' &&
    typeof runtime.createElement === 'function' &&
    typeof runtime.startTransition === 'function' &&
    typeof runtime.useContext === 'function' &&
    typeof runtime.useEffect === 'function' &&
    typeof runtime.useRef === 'function' &&
    typeof runtime.useState === 'function'
  )
}

function getInstalledTextCompatHookRuntime(): TextCompatHookRuntime | null {
  const runtime = readContextRuntime<TextCompatHookRuntime>()
  return isCompleteTextCompatHookRuntime(runtime) ? runtime : null
}

function isTextCompatElementRuntime(value: unknown): value is TextCompatElementRuntime {
  if (typeof value !== 'object' || value === null) return false
  const runtime = value as Partial<Record<keyof TextCompatElementRuntime, unknown>>
  return (
    typeof runtime.createContext === 'function' &&
    typeof runtime.createElement === 'function' &&
    typeof runtime.useContext === 'function'
  )
}

function getInstalledTextCompatElementRuntime(): TextCompatElementRuntime | null {
  const runtime = readContextRuntime<TextCompatElementRuntime>()
  return isTextCompatElementRuntime(runtime) ? runtime : null
}

function getCompatRenderRuntime(): TextCompatHookRuntime | null {
  const createContext =
    readTextCompatRuntimeExport<TextCompatHookRuntime['createContext']>('createContext')
  const createElement =
    readTextCompatRuntimeExport<TextCompatHookRuntime['createElement']>('createElement')
  const startTransition =
    readTextCompatRuntimeExport<TextCompatHookRuntime['startTransition']>('startTransition')
  const useContext = readTextCompatRuntimeExport<TextCompatHookRuntime['useContext']>('useContext')
  const useEffect = readTextCompatRuntimeExport<TextCompatHookRuntime['useEffect']>('useEffect')
  const useRef = readTextCompatRuntimeExport<TextCompatHookRuntime['useRef']>('useRef')
  const useState = readTextCompatRuntimeExport<TextCompatHookRuntime['useState']>('useState')
  if (
    !createContext ||
    !createElement ||
    !startTransition ||
    !useContext ||
    !useEffect ||
    !useRef ||
    !useState
  ) {
    return null
  }
  return {
    createContext,
    createElement,
    startTransition,
    useContext,
    useEffect,
    useRef,
    useState,
    useSyncExternalStore:
      readTextCompatRuntimeExport<TextCompatHookRuntime['useSyncExternalStore']>(
        'useSyncExternalStore',
      ),
    use: readTextCompatRuntimeExport<TextCompatHookRuntime['use']>('use'),
  }
}

function getActiveTextCompatHookRuntime(): TextCompatHookRuntime | null {
  const runtime = getInstalledTextCompatHookRuntime()
  if (runtime) return runtime
  if (isTextCompatRendererActive()) return getCompatRenderRuntime()

  const version = readTextCompatRuntimeExport<string>('version')
  return typeof version === 'string' ? null : getCompatRenderRuntime()
}

function getActiveTextCompatElementRuntime(): TextCompatElementRuntime | null {
  const runtime = getInstalledTextCompatElementRuntime()
  if (runtime) return runtime
  return getActiveTextCompatHookRuntime()
}

function isHookCompatContext<T>(context: unknown): context is HookCompatContext<T> {
  return (
    typeof context === 'object' &&
    context !== null &&
    (context as { __textHookCompatContext?: unknown }).__textHookCompatContext === true
  )
}

function getOrCreateRuntimeContext<T>(context: HookCompatContext<T>): unknown | null {
  const runtime = getActiveTextCompatElementRuntime()
  if (!runtime) return null
  if (!context.compatRuntimeContext) {
    context.compatRuntimeContext = runtime.createContext(context.defaultValue)
  }
  return context.compatRuntimeContext
}

export function createContext<T>(defaultValue: T): HookCompatContext<T> {
  const registryKey = getContextRegistryKey()
  const registeredContext = readRegisteredHookCompatContext<T>(registryKey)
  if (registeredContext) return registeredContext

  const nativeTextContext = createNativeTextContext(defaultValue) as NativeTextContext<T>
  const context: HookCompatContext<T> = {
    __textHookCompatContext: true,
    defaultValue,
    nativeTextContext,
    Provider(props) {
      const elementRuntime = getActiveTextCompatElementRuntime()
      const compatRuntimeContext = elementRuntime ? getOrCreateRuntimeContext(context) : null
      if (elementRuntime && compatRuntimeContext) {
        return createSafeTextElement(
          elementRuntime.createElement,
          (compatRuntimeContext as { Provider?: unknown }).Provider,
          { value: props.value },
          props.children,
        )
      }
      return createSafeTextElement(
        createTextElement as never,
        nativeTextContext.Provider,
        { value: props.value },
        props.children,
      )
    },
  }
  registerHookCompatContext(registryKey, context)
  return context
}

export function createElement(
  type: unknown,
  props: Record<string, unknown> | null,
  ...children: unknown[]
): unknown {
  const runtime = getActiveTextCompatElementRuntime()
  if (runtime) return createSafeTextElement(runtime.createElement, type, props, ...children)
  return createSafeTextElement(createTextElement as never, type, props, ...(children as never[]))
}

export function useContext<T>(context: HookCompatContext<T> | unknown): T {
  if (isHookCompatContext<T>(context)) {
    const runtime = getActiveTextCompatElementRuntime()
    const compatRuntimeContext = runtime ? getOrCreateRuntimeContext(context) : null
    if (runtime && compatRuntimeContext) {
      try {
        return runtime.useContext<T>(compatRuntimeContext)
      } catch {
        // Outside the temporary compat render, fall back to the Rue context.
      }
    }
    return useNativeTextContext(context.nativeTextContext as never) as T
  }
  const runtime = getActiveTextCompatHookRuntime()
  if (runtime) return runtime.useContext<T>(context)
  return useNativeTextContext(context as never) as T
}

export const useEffect = ((effect: () => void | (() => void), deps?: readonly unknown[]) => {
  const runtime = getActiveTextCompatHookRuntime()
  return runtime ? runtime.useEffect(effect, deps) : useNativeTextEffect(effect, deps)
}) as typeof useNativeTextEffect

export const useRef = (<T>(initialValue: T) => {
  const runtime = getActiveTextCompatHookRuntime()
  return runtime ? runtime.useRef(initialValue) : useNativeTextRef(initialValue)
}) as typeof useNativeTextRef

export const useState = (<T>(initialState: T | (() => T)) => {
  const runtime = getActiveTextCompatHookRuntime()
  return runtime ? runtime.useState(initialState) : useNativeTextState(initialState)
}) as typeof useNativeTextState

type TextMemoCache<T> = { deps: readonly unknown[]; value: T }

function haveHookDependenciesChanged(
  previous: readonly unknown[],
  next: readonly unknown[],
): boolean {
  return (
    previous.length !== next.length ||
    previous.some((value, index) => !Object.is(value, next[index]))
  )
}

export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T {
  const cache = useRef<TextMemoCache<T> | null>(null)
  if (cache.current === null || haveHookDependenciesChanged(cache.current.deps, deps)) {
    cache.current = { deps: [...deps], value: factory() }
  }
  return cache.current.value
}

export function useCallback<T extends (...args: never[]) => unknown>(
  callback: T,
  deps: readonly unknown[],
): T {
  return useMemo(() => callback, deps)
}

export const useLayoutEffect = useEffect

export type TextHookDependencyList = readonly unknown[]
export type RueHookDependencyList = TextHookDependencyList

export function startTransition(callback: () => void): void {
  const runtime = getInstalledTextCompatHookRuntime()
  if (runtime) {
    runtime.startTransition(callback)
    return
  }
  const compatStartTransition =
    readTextCompatRuntimeExport<TextCompatHookRuntime['startTransition']>('startTransition')
  if (compatStartTransition) {
    compatStartTransition(callback)
    return
  }
  callback()
}

export function useSyncExternalStore<T>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => T,
  getServerSnapshot?: () => T,
): T {
  const runtime = getActiveTextCompatHookRuntime()
  if (runtime?.useSyncExternalStore) {
    return runtime.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  }

  const readSnapshot =
    typeof window === 'undefined' && getServerSnapshot ? getServerSnapshot : getSnapshot
  const [snapshot, setSnapshot] = useState<T>(() => readSnapshot())

  useEffect(() => {
    const updateSnapshot = () => {
      setSnapshot(getSnapshot())
    }
    updateSnapshot()
    return subscribe(updateSnapshot)
  }, [subscribe, getSnapshot])

  return snapshot
}

export function useActionState(): never {
  throw new Error('useActionState is not available in the Rue-native text runtime yet.')
}

export function useTransition(): never {
  throw new Error('useTransition is not available in the Rue-native text runtime yet.')
}

export function cache<Args extends readonly unknown[], Result>(
  fn: (...args: Args) => Result,
): (...args: Args) => Result {
  return (...args: Args): Result => {
    const cacheNode = getRueCacheNode(getRueCacheRoot(fn as (...args: never[]) => unknown), args)

    if (cacheNode.hasValue) {
      return cacheNode.value as Result
    }

    const value = fn(...args)
    cacheNode.hasValue = true
    cacheNode.value = value

    if (
      (typeof value === 'object' || typeof value === 'function') &&
      value !== null &&
      typeof (value as { then?: unknown }).then === 'function'
    ) {
      Promise.resolve(value).catch(() => {
        if (cacheNode.value === value) {
          cacheNode.hasValue = false
          cacheNode.value = undefined
        }
      })
    }

    return value
  }
}

export function use<T>(thenable: PromiseLike<T>): T {
  const runtime = getActiveTextCompatHookRuntime()
  if (runtime?.use) {
    return runtime.use(thenable)
  }
  throw new Error('Rue use() is not available in the Rue-native text runtime.')
}
