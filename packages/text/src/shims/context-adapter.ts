import { createContext, useContext } from '@rue-js/rue'
import {
  createTextElement,
  type TextElement,
  type TextComponentType,
  type TextNode,
} from '../runtime/render-protocol.js'
import {
  createSafeTextElement,
  isTextCompatRendererActive,
  readTextCompatRuntimeExport,
} from './rue-element-compat.js'
import { readContextRuntime } from './context-runtime-global.js'
import {
  markTextCompatContextProvider,
  readTextCompatContextProviderValue,
} from './context-provider-adapter.js'

export type TextCompatContext<T> = {
  Provider: TextComponentType<{
    value: T
    children?: TextNode
  }>
  defaultValue: T
  compatRuntimeContext?: unknown
  compatRuntimeContexts?: WeakMap<object, unknown>
  compatRuntimeProviders?: WeakMap<object, unknown>
  nativeTextContext: NativeTextContext<T>
}

type TextContextGlobal<T> = typeof globalThis & {
  [key: symbol]: TextCompatContext<T> | null | undefined
}

const TEXT_COMPAT_RUNTIME_KEY = Symbol.for('text.compatRuntimeKey')

type TextCompatRuntimeGlobal = typeof globalThis & {
  [TEXT_COMPAT_RUNTIME_KEY]?: object
}

type NativeTextContext<T> = {
  Provider: TextComponentType<{
    value: T
    children?: TextNode
  }>
  defaultValue: T
}

type TextCompatContextRuntime = {
  createContext: <T>(defaultValue: T) => unknown
  createElement: (
    type: unknown,
    props: Record<string, unknown> | null,
    ...children: unknown[]
  ) => unknown
  useContext: <T>(context: unknown) => T
}

const SERVER_PROTOCOL_ELEMENT = Symbol.for('rue.transitional.element')
const LEGACY_SERVER_PROTOCOL_ELEMENT = Symbol.for('rue.element')

function isCompleteTextCompatContextRuntime(value: unknown): value is TextCompatContextRuntime {
  if (typeof value !== 'object' || value === null) return false
  const runtime = value as Partial<Record<keyof TextCompatContextRuntime, unknown>>
  return (
    typeof runtime.createContext === 'function' &&
    typeof runtime.createElement === 'function' &&
    typeof runtime.useContext === 'function'
  )
}

export type TextCompatElement = TextElement
export type TextCompatNode = TextNode

function getInstalledTextCompatContextRuntime(): TextCompatContextRuntime | null {
  const runtime = readContextRuntime<TextCompatContextRuntime>()
  return isCompleteTextCompatContextRuntime(runtime) ? runtime : null
}

function isTextCompatContextRuntime(
  value: TextCompatContextRuntime | null,
): value is TextCompatContextRuntime {
  return (
    typeof value?.createContext === 'function' &&
    typeof value.createElement === 'function' &&
    typeof value.useContext === 'function'
  )
}

function getCompatRenderRuntime(): TextCompatContextRuntime | null {
  const createContext =
    readTextCompatRuntimeExport<TextCompatContextRuntime['createContext']>('createContext')
  const createElement =
    readTextCompatRuntimeExport<TextCompatContextRuntime['createElement']>('createElement')
  const useContext =
    readTextCompatRuntimeExport<TextCompatContextRuntime['useContext']>('useContext')
  return createContext && createElement && useContext
    ? { createContext, createElement, useContext }
    : null
}

function getActiveTextCompatContextRuntime(): TextCompatContextRuntime | null {
  const runtime = getInstalledTextCompatContextRuntime()
  if (isTextCompatContextRuntime(runtime)) return runtime
  if (isTextCompatRendererActive()) return getCompatRenderRuntime()

  // Vitest partial compatibility mocks do not expose the normal runtime version
  // marker. Treat those as an explicit mock runtime so mocked useContext() can
  // be exercised outside an actual compat render.
  const version = readTextCompatRuntimeExport<string>('version')
  return typeof version === 'string' ? null : getCompatRenderRuntime()
}

function getTextCompatRuntimeKey(runtime: TextCompatContextRuntime): object {
  const installedRuntime = getInstalledTextCompatContextRuntime()
  if (installedRuntime === runtime) {
    return runtime.createContext as unknown as object
  }

  const version = readTextCompatRuntimeExport<string>('version')
  if (typeof version === 'string') {
    const globalState = globalThis as TextCompatRuntimeGlobal
    globalState[TEXT_COMPAT_RUNTIME_KEY] ??= {}
    return globalState[TEXT_COMPAT_RUNTIME_KEY]
  }
  return runtime.createContext as unknown as object
}

function isCompatProtocolNode(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(isCompatProtocolNode)
  return (
    typeof value === 'object' &&
    value !== null &&
    ((value as { $$typeof?: unknown }).$$typeof === SERVER_PROTOCOL_ELEMENT ||
      (value as { $$typeof?: unknown }).$$typeof === LEGACY_SERVER_PROTOCOL_ELEMENT)
  )
}

function getOrCreateRuntimeTextContext<T>(context: TextCompatContext<T>): unknown | null {
  const runtime = getActiveTextCompatContextRuntime()
  if (!runtime) return null
  const runtimeKey = getTextCompatRuntimeKey(runtime)
  if (!context.compatRuntimeContexts) {
    context.compatRuntimeContexts = new WeakMap<object, unknown>()
  }
  let compatRuntimeContext = context.compatRuntimeContexts.get(runtimeKey)
  if (!compatRuntimeContext) {
    compatRuntimeContext = runtime.createContext(context.defaultValue)
    context.compatRuntimeContexts.set(runtimeKey, compatRuntimeContext)
    if (!context.compatRuntimeProviders) {
      context.compatRuntimeProviders = new WeakMap<object, unknown>()
    }
    const compatProvider = (compatRuntimeContext as { Provider?: unknown }).Provider
    context.compatRuntimeProviders.set(runtimeKey, compatProvider)
    markTextCompatContextProvider(compatProvider, context as object)
  }
  context.compatRuntimeContext = compatRuntimeContext
  return compatRuntimeContext
}

export function getOrCreateTextCompatContext<T>(
  key: symbol,
  defaultValue: T,
): TextCompatContext<T> | null {
  if (typeof createContext !== 'function') return null

  const globalState = globalThis as TextContextGlobal<T>
  if (!globalState[key]) {
    const createCompatRuntimeContext =
      readTextCompatRuntimeExport<TextCompatContextRuntime['createContext']>('createContext')
    const nativeTextContext = createContext(defaultValue) as NativeTextContext<T>
    const compatRuntimeContexts = new WeakMap<object, unknown>()
    const compatRuntimeProviders = new WeakMap<object, unknown>()
    const compatRuntimeContext =
      typeof createCompatRuntimeContext === 'function'
        ? createCompatRuntimeContext(defaultValue)
        : null

    if (compatRuntimeContext && typeof compatRuntimeContext === 'object') {
      const initialCompatRuntime = getCompatRenderRuntime()
      const initialRuntimeKey = initialCompatRuntime
        ? getTextCompatRuntimeKey(initialCompatRuntime)
        : (createCompatRuntimeContext as unknown as object)
      compatRuntimeContexts.set(initialRuntimeKey, compatRuntimeContext)
      const initialCompatProvider = (compatRuntimeContext as { Provider?: unknown }).Provider
      compatRuntimeProviders.set(initialRuntimeKey, initialCompatProvider)
    }

    const compatContext = (
      compatRuntimeContext && typeof compatRuntimeContext === 'object' ? compatRuntimeContext : {}
    ) as TextCompatContext<T>
    compatContext.defaultValue = defaultValue
    compatContext.compatRuntimeContext = compatRuntimeContext
    compatContext.compatRuntimeContexts = compatRuntimeContexts
    compatContext.compatRuntimeProviders = compatRuntimeProviders
    compatContext.nativeTextContext = nativeTextContext
    if (compatRuntimeContext && typeof compatRuntimeContext === 'object') {
      const initialRuntime = getCompatRenderRuntime()
      const initialRuntimeKey = initialRuntime
        ? getTextCompatRuntimeKey(initialRuntime)
        : (createCompatRuntimeContext as unknown as object)
      const initialCompatProvider = compatRuntimeProviders.get(initialRuntimeKey)
      markTextCompatContextProvider(initialCompatProvider, compatContext as object)
    }
    compatContext.Provider = function TextCompatProvider(props: {
      value: T
      children?: TextNode
    }): TextElement {
      const runtime = getActiveTextCompatContextRuntime() ?? getCompatRenderRuntime()
      const compatRuntimeContext = runtime ? getOrCreateRuntimeTextContext(compatContext) : null
      if (runtime && compatRuntimeContext) {
        const runtimeKey = getTextCompatRuntimeKey(runtime)
        const compatProvider =
          compatContext.compatRuntimeProviders?.get(runtimeKey) ??
          (compatRuntimeContext as { Provider?: unknown }).Provider
        return createSafeTextElement(
          runtime.createElement,
          compatProvider,
          { value: props.value },
          props.children,
        ) as TextElement
      }
      const createElement =
        readTextCompatRuntimeExport<TextCompatContextRuntime['createElement']>('createElement')
      if (createElement && isCompatProtocolNode(props.children)) {
        const fallbackRuntime = getCompatRenderRuntime()
        if (fallbackRuntime) {
          const fallbackRuntimeKey = getTextCompatRuntimeKey(fallbackRuntime)
          const compatProvider = compatContext.compatRuntimeProviders?.get(fallbackRuntimeKey)
          if (compatProvider) {
            return createSafeTextElement(
              createElement,
              compatProvider,
              { value: props.value },
              props.children,
            ) as TextElement
          }
        } else if (typeof createCompatRuntimeContext === 'function') {
          const compatProvider = compatContext.compatRuntimeProviders?.get(
            createCompatRuntimeContext as unknown as object,
          )
          if (compatProvider) {
            return createSafeTextElement(
              createElement,
              compatProvider,
              { value: props.value },
              props.children,
            ) as TextElement
          }
        }
      }
      if (isCompatProtocolNode(props.children)) {
        return props.children as TextElement
      }
      return createTextElement(nativeTextContext.Provider, { value: props.value }, props.children)
    }
    markTextCompatContextProvider(compatContext.Provider, () => {
      getOrCreateRuntimeTextContext(compatContext)
      return compatContext as object
    })
    globalState[key] = compatContext
  }
  return globalState[key] ?? null
}

export function createRequiredTextCompatContext<T>(
  key: symbol,
  defaultValue: T,
): TextCompatContext<T> {
  const context = getOrCreateTextCompatContext(key, defaultValue)
  if (!context) {
    throw new Error('Rue context is unavailable in this runtime condition.')
  }
  return context
}

export function useTextCompatContext<T>(context: TextCompatContext<T>): T {
  const directProvided = readTextCompatContextProviderValue<T>(context as object)
  if (directProvided.found) return directProvided.value

  const runtime = getActiveTextCompatContextRuntime() ?? getCompatRenderRuntime()
  if (runtime) {
    const compatRuntimeContext = getOrCreateRuntimeTextContext(context)
    if (compatRuntimeContext) {
      const provided = readTextCompatContextProviderValue<T>(compatRuntimeContext)
      if (provided.found) return provided.value
      try {
        return runtime.useContext<T>(compatRuntimeContext)
      } catch {
        // Fall through to Rue context when this hook is evaluated outside the
        // temporary compat render boundary.
      }
    }
  }
  return useContext(context.nativeTextContext as never)
}

export function useOptionalTextCompatContext<T>(
  context: TextCompatContext<T> | null,
  fallback: T,
): T {
  if (!context || typeof useContext !== 'function') return fallback
  try {
    return useTextCompatContext(context)
  } catch {
    return fallback
  }
}

export function createTextCompatElement(
  type: Parameters<typeof createTextElement>[0],
  props: Parameters<typeof createTextElement>[1],
  ...children: TextNode[]
): TextElement {
  const cleanedProps = props ? cleanElementProps(props) : null
  const runtime = getActiveTextCompatContextRuntime()
  if (runtime) {
    return createSafeTextElement(
      runtime.createElement,
      type,
      cleanedProps,
      ...(children as unknown[]),
    ) as TextElement
  }
  const createElement =
    readTextCompatRuntimeExport<TextCompatContextRuntime['createElement']>('createElement')
  if (createElement && isCompatProtocolNode(children)) {
    return createSafeTextElement(
      createElement,
      type,
      cleanedProps,
      ...(children as unknown[]),
    ) as TextElement
  }
  return createTextElement(type, cleanedProps, ...children)
}

function cleanElementProps(
  props: NonNullable<Parameters<typeof createTextElement>[1]>,
): Record<string, unknown> {
  const cleanedProps: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined) cleanedProps[key] = value
  }
  return cleanedProps
}

export {
  createTextCompatElement as createRueCompatElement,
  createRequiredTextCompatContext as createRequiredRueCompatContext,
  getOrCreateTextCompatContext as getOrCreateRueCompatContext,
  useOptionalTextCompatContext as useOptionalRueCompatContext,
  useTextCompatContext as useRueCompatContext,
}
export type {
  TextCompatContext as RueCompatContext,
  TextCompatElement as RueCompatElement,
  TextCompatNode as RueCompatNode,
}
