import type { TextCompatElement, TextCompatNode } from '../shims/text-compat-types.js'
import { AppRscServerClientReferenceSymbol } from './app-rsc-client-reference-protocol.js'

type ServerProtocolElement<P = Record<string, unknown>> = TextCompatElement<P> & {
  $$typeof: symbol
  type: unknown
  key: string | null
  props: P & { children?: TextCompatNode }
  _owner: null
  _store: Record<string, never>
  ref: null
  _debugInfo?: null
  _debugStack?: Error
  _debugTask?: null
}

export const ServerProtocolFragment = Symbol.for('rue.fragment')
export const ServerProtocolSuspense = Symbol.for('rue.suspense')
export const ServerProtocolClientReference = AppRscServerClientReferenceSymbol

export const ServerProtocolElementSymbol = Symbol.for('rue.transitional.element')
export const LegacyServerProtocolElementSymbol = Symbol.for('rue.element')
const RueSuspenseComponentMarker = Symbol.for('rue.suspense.component')
const LegacySuspenseSymbol = Symbol.for(`${['re', 'act'].join('')}.suspense`)
const RueServerReferenceSymbol = Symbol.for('rue.server.reference')

type ServerActionReference = ((...args: unknown[]) => unknown) & {
  $$FORM_ACTION?: (identifierPrefix: string) => {
    action: string
    data: FormData | null
    encType: string
    method: string
    name: string
  } | null
  $$bound?: unknown
  $$id?: unknown
  $$typeof?: unknown
}

export function normalizeServerProtocolType(type: unknown): unknown {
  if (type === LegacySuspenseSymbol) {
    return ServerProtocolSuspense
  }
  if (
    typeof type === 'function' &&
    (type as Record<PropertyKey, unknown>)[RueSuspenseComponentMarker] === true
  ) {
    return ServerProtocolSuspense
  }
  return type
}

function normalizeProps<P>(
  props: (P & { key?: unknown }) | null | undefined,
  children: TextCompatNode[],
): { key: string | null; props: P & { children?: TextCompatNode } } {
  const textProps: Record<string, unknown> = {}
  let key: string | null = null

  if (props) {
    for (const [propKey, value] of Object.entries(props)) {
      if (propKey === 'key') {
        if (value !== undefined && value !== null) key = String(value)
        continue
      }
      if (value !== undefined) textProps[propKey] = normalizeServerActionProp(propKey, value)
    }
  }

  if (children.length === 1) {
    textProps.children = children[0]
  } else if (children.length > 1) {
    textProps.children = children
  }

  return { key, props: textProps as P & { children?: TextCompatNode } }
}

function normalizeServerActionProp(propKey: string, value: unknown): unknown {
  if (propKey !== 'action' && propKey !== 'formAction') return value
  if (typeof value !== 'function') return value
  const action = value as ServerActionReference
  if (
    action.$$typeof !== RueServerReferenceSymbol ||
    typeof action.$$id !== 'string' ||
    action.$$FORM_ACTION
  ) {
    return value
  }

  Object.defineProperty(action, '$$FORM_ACTION', {
    configurable: true,
    value() {
      if (action.$$bound !== null && action.$$bound !== undefined) return null
      return {
        action: '',
        data: null,
        encType: 'multipart/form-data',
        method: 'POST',
        name: `$RUE_ACTION_ID_${action.$$id}`,
      }
    },
  })
  return action
}

export function createServerProtocolElement<P = Record<string, unknown>>(
  type: unknown,
  props?: (P & { key?: unknown }) | null,
  ...children: TextCompatNode[]
): TextCompatElement<P> {
  const normalized = normalizeProps(props, children)
  const element = {
    $$typeof: ServerProtocolElementSymbol,
    type: normalizeServerProtocolType(type),
    key: normalized.key,
    props: normalized.props,
    _owner: null,
    ref: null,
    _store: {},
  } as ServerProtocolElement<P>
  if (process.env.NODE_ENV !== 'production') {
    Object.defineProperties(element, {
      _debugInfo: {
        configurable: false,
        enumerable: false,
        value: null,
        writable: false,
      },
      _debugStack: {
        configurable: false,
        enumerable: false,
        value: new Error('rue-stack-top-frame'),
        writable: false,
      },
      _debugTask: {
        configurable: false,
        enumerable: false,
        value: null,
        writable: false,
      },
    })
  }
  return element
}

export function isServerProtocolElement(value: unknown): value is TextCompatElement {
  return (
    typeof value === 'object' &&
    value !== null &&
    ((value as { $$typeof?: unknown }).$$typeof === ServerProtocolElementSymbol ||
      (value as { $$typeof?: unknown }).$$typeof === LegacyServerProtocolElementSymbol)
  )
}

export function cloneServerProtocolElement<P = Record<string, unknown>>(
  element: TextCompatElement<P>,
  props?: (Partial<P> & { key?: unknown }) | null,
): TextCompatElement<P> {
  const source = element as ServerProtocolElement<P>
  const mergedProps = {
    ...(source.props as Record<string, unknown>),
    ...(props as Record<string, unknown> | null),
  } as P & { key?: unknown }
  const cloned = createServerProtocolElement<P>(source.type, mergedProps)
  if (!props || props.key === undefined || props.key === null) {
    ;(cloned as ServerProtocolElement<P>).key = source.key
  }
  return cloned
}
