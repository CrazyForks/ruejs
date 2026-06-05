import {
  getRueClientInternals,
  type RueCreateElement,
  isRueRenderActive as isTextCompatRendererActive,
  isRueServerRenderActive as isTextCompatServerRendererActive,
  readRueComponentBase as readTextCompatComponentBase,
  readRueCreateElement as readTextCompatCreateElement,
  readRueFragment as readTextCompatFragment,
  readRueRuntimeExport as readTextCompatRuntimeExport,
  readRueSuspense as readTextCompatSuspense,
} from './rue-runtime-protocol.js'

export {
  getRueClientInternals,
  isTextCompatRendererActive,
  isTextCompatRendererActive as isRueRenderActive,
  isTextCompatServerRendererActive,
  isTextCompatServerRendererActive as isRueServerRenderActive,
  readTextCompatComponentBase,
  readTextCompatComponentBase as readRueComponentBase,
  readTextCompatCreateElement,
  readTextCompatCreateElement as readRueCreateElement,
  readTextCompatFragment,
  readTextCompatFragment as readRueFragment,
  readTextCompatRuntimeExport,
  readTextCompatRuntimeExport as readRueRuntimeExport,
  readTextCompatSuspense,
  readTextCompatSuspense as readRueSuspense,
}

export type TextCompatCreateElement = RueCreateElement

const RUE_ELEMENT_TYPE = Symbol.for('rue.transitional.element')
const DEFAULT_UNSUPPORTED_OBJECT_INPUT_ERROR =
  'Unsupported object inputs are no longer accepted on the default @rue-js/runtime entry.'

function shouldFallbackToProtocolElement(error: unknown): boolean {
  if (!(error instanceof TypeError)) return false
  const message = String(error.message)
  return message.includes('getOwner') || message.includes(DEFAULT_UNSUPPORTED_OBJECT_INPUT_ERROR)
}

export function canCallTextCompatCreateElement(): boolean {
  const ownerDispatcher = getRueClientInternals()?.A
  return !ownerDispatcher || typeof ownerDispatcher.getOwner === 'function'
}

export function createTextCompatProtocolElement(
  type: unknown,
  props: Record<string, unknown> | null,
  ...children: unknown[]
): unknown {
  const elementProps = props ? { ...props } : {}
  const rawKey = elementProps.key
  const key = rawKey == null ? null : String(rawKey)
  delete elementProps.key

  if (children.length === 1) {
    elementProps.children = children[0]
  } else if (children.length > 1) {
    elementProps.children = children
  }

  return {
    $$typeof: RUE_ELEMENT_TYPE,
    type,
    key,
    props: elementProps,
    _owner: null,
    _store: {},
  }
}

export function isTextCompatProtocolElement(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { $$typeof?: unknown }).$$typeof === RUE_ELEMENT_TYPE
  )
}

export function createSafeTextElement(
  createElement: TextCompatCreateElement,
  type: unknown,
  props: Record<string, unknown> | null,
  ...children: unknown[]
): unknown {
  if (canCallTextCompatCreateElement()) {
    try {
      return createElement(type, props, ...children)
    } catch (error) {
      if (!shouldFallbackToProtocolElement(error)) {
        throw error
      }
    }
  }

  return createTextCompatProtocolElement(type, props, ...children)
}

export const canCallRueCreateElement = canCallTextCompatCreateElement
export const createRueProtocolElement = createTextCompatProtocolElement
export const isRueProtocolElement = isTextCompatProtocolElement
export const createSafeRueElement = createSafeTextElement
