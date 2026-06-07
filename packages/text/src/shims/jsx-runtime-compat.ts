import { Fragment as RueFragment, h } from '@rue-js/rue'
import type { RenderableOutput } from '@rue-js/rue'
import {
  createSafeTextElement,
  createTextCompatProtocolElement,
  isTextCompatRendererActive,
  isTextCompatServerRendererActive,
  readTextCompatCreateElement,
  readTextCompatFragment,
} from './rue-element-compat.js'
import { readContextRuntime } from './context-runtime-global.js'

type TextCompatRenderRuntime = {
  createElement: (
    type: unknown,
    props: Record<string, unknown> | null,
    ...children: unknown[]
  ) => unknown
}

function getInstalledTextCompatRuntime(): TextCompatRenderRuntime | null {
  return readContextRuntime<TextCompatRenderRuntime>() ?? null
}

function getActiveTextCompatRuntime(): TextCompatRenderRuntime | null {
  const runtime = getInstalledTextCompatRuntime()
  if (runtime) return runtime
  const createElement = readTextCompatCreateElement()
  return isTextCompatRendererActive() && createElement ? { createElement } : null
}

function normalizeProps(props: any, key?: any): any {
  if (!props && key === undefined) return null

  const out: any = {}
  if (props) {
    for (const propKey in props) {
      const value = props[propKey]
      if (value !== undefined) out[propKey] = value
    }
  }
  if (key !== undefined) out.key = key

  return Object.keys(out).length > 0 ? out : null
}

function normalizeCompatType(type: unknown): unknown {
  return type === RueFragment ? (readTextCompatFragment() ?? type) : type
}

function isRueServerRenderingFlagActive(): boolean {
  return typeof (globalThis as Record<string, unknown>).__rue_is_server_rendering__ === 'number'
}

const RUE_CLIENT_REFERENCE_SYMBOL = Symbol.for('rue.client.reference')

function hasViteRscCallableClientReferenceShape(value: unknown): boolean {
  if (typeof value !== 'function') return false
  try {
    return Function.prototype.toString.call(value).includes('Unexpectedly client reference export')
  } catch {
    return false
  }
}

function isClientReferenceType(value: unknown): boolean {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return false
  if (hasViteRscCallableClientReferenceShape(value)) return true
  return (value as { $$typeof?: unknown }).$$typeof === RUE_CLIENT_REFERENCE_SYMBOL
}

export const Fragment = RueFragment

export function jsx(type: any, props: any, key?: any): RenderableOutput {
  const p = normalizeProps(props, key)
  const c = props ? (props as any).children : undefined
  const children = Array.isArray(c) ? c : c !== undefined ? [c] : []
  if (isClientReferenceType(type)) {
    return createTextCompatProtocolElement(
      normalizeCompatType(type),
      p,
      ...children,
    ) as RenderableOutput
  }
  const runtime = getActiveTextCompatRuntime()
  if (runtime) {
    return createSafeTextElement(
      runtime.createElement,
      normalizeCompatType(type),
      p,
      ...children,
    ) as RenderableOutput
  }
  if (
    typeof document === 'undefined' ||
    isTextCompatServerRendererActive() ||
    isRueServerRenderingFlagActive()
  ) {
    return createTextCompatProtocolElement(
      normalizeCompatType(type),
      p,
      ...children,
    ) as RenderableOutput
  }
  return Array.isArray(c) ? h(type, p, ...c) : c !== undefined ? h(type, p, c) : h(type, p)
}

export const jsxs = jsx
export const jsxDEV = jsx
