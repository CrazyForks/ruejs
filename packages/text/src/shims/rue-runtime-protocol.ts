import {
  Component,
  Suspense,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from '@rue-js/rue'

export type RueCreateElement = (
  type: unknown,
  props: Record<string, unknown> | null,
  ...children: unknown[]
) => unknown

export type RueRuntimeExportKey =
  | 'Component'
  | 'Fragment'
  | 'Suspense'
  | 'createContext'
  | 'createElement'
  | 'startTransition'
  | 'use'
  | 'useContext'
  | 'useEffect'
  | 'useRef'
  | 'useState'
  | 'useSyncExternalStore'
  | 'version'

const RUE_RUNTIME_EXPORTS: Partial<Record<RueRuntimeExportKey, unknown>> = {
  Component,
  Fragment: 'fragment',
  Suspense,
  createContext,
  startTransition(callback: () => void) {
    callback()
  },
  use<T>(thenable: PromiseLike<T>): T {
    throw thenable
  },
  useContext,
  useEffect,
  useRef,
  useState,
  version: 'rue',
}

export function getRueClientInternals(): null {
  return null
}

export function readRueCreateElement(): RueCreateElement | null {
  return null
}

export function readRueRuntimeExport<T>(key: RueRuntimeExportKey): T | undefined {
  return RUE_RUNTIME_EXPORTS[key] as T | undefined
}

export function readRueComponentBase(): new (...args: unknown[]) => unknown {
  return Component as unknown as new (...args: unknown[]) => unknown
}

export function readRueFragment(): unknown {
  return 'fragment'
}

export function readRueSuspense(): unknown {
  return Suspense
}

export function isRueRenderActive(): boolean {
  return false
}

export function isRueServerRenderActive(): boolean {
  return typeof window === 'undefined'
}
