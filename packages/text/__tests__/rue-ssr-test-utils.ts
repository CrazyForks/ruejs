import {
  renderToString as renderRueToString,
  runWithServerDOMAdapter,
} from '@rue-js/server-renderer'
import {
  createTextElement,
  type TextElementType,
  type TextNode,
} from '../src/runtime/render-protocol.js'

export function createElement<P = {}>(
  type: TextElementType<P>,
  props: P | null,
  ...children: TextNode[]
): TextNode {
  return createTextElement(type, props as never, ...children)
}

export async function renderToString(element: unknown | (() => unknown)): Promise<string> {
  return runWithServerDOMAdapter(() => {
    const resolvedElement = typeof element === 'function' ? element() : element
    return renderRueToString(resolvedElement as never)
  })
}
