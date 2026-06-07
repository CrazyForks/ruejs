import { createElement, Fragment, Suspense } from '@rue-js/rue'

export type TextNode =
  | string
  | number
  | boolean
  | null
  | undefined
  | TextElement
  | readonly TextNode[]
  | Record<PropertyKey, unknown>
export type TextElement<P = unknown> = Record<PropertyKey, unknown> & {
  props?: P | null
}
export type TextRenderable = TextNode | TextComponentType | readonly TextNode[]
export type TextComponentType<P = {}> = ((props: P) => TextNode) & {
  displayName?: string
}
export type TextClassComponentType<P = {}> = new (props: P) => {
  render: () => TextNode
}
export type TextPropsWithChildren<P = {}> = P & {
  children?: TextNode
}
export type TextElementType<P = {}> = string | TextComponentType<P> | TextClassComponentType<P>
export type TextElementProps = Record<string, unknown> & {
  children?: TextNode
}

export const TextFragment: 'fragment' = Fragment
export const TextSuspense: TextComponentType<{
  children?: TextNode
  fallback?: TextNode
}> = Suspense as never

const TextProtocolElementSymbol = Symbol.for('rue.transitional.element')
const DEFAULT_UNSUPPORTED_OBJECT_INPUT_ERROR =
  'Unsupported object inputs are no longer accepted on the default @rue-js/runtime entry.'

function isUnsupportedObjectInputError(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    String(error.message).includes(DEFAULT_UNSUPPORTED_OBJECT_INPUT_ERROR)
  )
}

function createTextProtocolElement<P>(
  type: unknown,
  props: TextElementProps | null,
  children: TextNode[],
): TextElement<P> {
  const textProps: Record<string, unknown> = {}
  let key: string | null = null

  if (props) {
    for (const [propKey, value] of Object.entries(props)) {
      if (propKey === 'key') {
        if (value !== undefined && value !== null) key = String(value)
        continue
      }
      if (value !== undefined) textProps[propKey] = value
    }
  }

  if (children.length === 1) {
    textProps.children = children[0]
  } else if (children.length > 1) {
    textProps.children = children
  }

  return {
    $$typeof: TextProtocolElementSymbol,
    type,
    key,
    props: textProps,
    _owner: null,
    ref: null,
    _store: {},
  } as TextElement<P>
}

function isTextClassComponentType<P>(type: unknown): type is TextClassComponentType<P> {
  return (
    typeof type === 'function' &&
    !!(type as { prototype?: { render?: unknown } }).prototype &&
    typeof (type as { prototype?: { render?: unknown } }).prototype?.render === 'function'
  )
}

export function createTextElement<P = {}>(
  type: TextElementType<P>,
  props: TextElementProps | null,
  ...children: TextNode[]
): TextElement<P> {
  return createTextProtocolElement<P>(type, props, children)
}

export function createRueTextElement<P = {}>(
  type: TextElementType<P>,
  props: TextElementProps | null,
  ...children: TextNode[]
): TextElement<P> {
  if (isTextClassComponentType<P>(type)) {
    const ClassComponent = type
    const FunctionAdapter = (componentProps: P): TextNode => {
      const instance = new ClassComponent(componentProps)
      return instance.render()
    }
    try {
      return createElement(FunctionAdapter, props, ...children) as TextElement<P>
    } catch (error) {
      if (!isUnsupportedObjectInputError(error)) throw error
      return createTextProtocolElement<P>(ClassComponent, props, children)
    }
  }

  try {
    return createElement(type as never, props, ...children) as TextElement<P>
  } catch (error) {
    if (!isUnsupportedObjectInputError(error)) throw error
    return createTextProtocolElement<P>(type, props, children)
  }
}
