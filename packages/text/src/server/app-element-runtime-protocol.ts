import {
  createSafeTextElement,
  getRueClientInternals,
  readTextCompatCreateElement,
  readTextCompatRuntimeExport,
} from '../shims/rue-element-compat.js'
import { createServerProtocolElement } from './element-protocol.js'

export type AppRuntimeCreateElement = (
  type: unknown,
  props: Record<string, unknown> | null,
  ...children: unknown[]
) => unknown

export type AppRuntimeExportKey =
  | 'createContext'
  | 'createElement'
  | 'startTransition'
  | 'use'
  | 'useCallback'
  | 'useContext'
  | 'useEffect'
  | 'useMemo'
  | 'useRef'
  | 'useState'
  | 'useSyncExternalStore'
  | 'version'

export type AppRuntimeDispatcherCarrier = {
  H?: unknown
}

export function readAppRuntimeExport<T>(key: AppRuntimeExportKey): T | undefined {
  return readTextCompatRuntimeExport<T>(key)
}

export function readAppRuntimeDispatcherCarrier(): AppRuntimeDispatcherCarrier | null {
  return getRueClientInternals() as AppRuntimeDispatcherCarrier | null
}

export function readAppRuntimeCreateElement(): AppRuntimeCreateElement | null {
  return readTextCompatCreateElement()
}

export function createAppRuntimeElement(
  createElement: AppRuntimeCreateElement,
  type: unknown,
  props: Record<string, unknown> | null,
  ...children: unknown[]
): unknown {
  return createSafeTextElement(createElement, type, props, ...children)
}

export function createAppServerElement(
  type: unknown,
  props: Record<string, unknown> | null,
  ...children: unknown[]
): unknown {
  const createElement = readAppRuntimeCreateElement()
  if (!createElement) {
    return createServerProtocolElement(type, props, ...children)
  }
  return createAppRuntimeElement(createElement, type, props, ...children)
}
