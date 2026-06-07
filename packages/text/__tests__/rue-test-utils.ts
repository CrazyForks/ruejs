import type { RenderableOutput } from '@rue-js/rue'
import { isRueRenderableHandle, type TextRenderable } from '../src/server/renderable.js'

let rueTestElementId = 0

export { isRueRenderableHandle }
export type { RenderableOutput }
export type { TextRenderable }

export function createElement(
  _type: unknown,
  props: Record<string, unknown> | null,
  ...children: unknown[]
): RenderableOutput {
  const element: Record<string, unknown> = {
    __rue_mount_id: rueTestElementId++,
  }
  Object.defineProperty(element, '__rue_test_element_type__', {
    value: _type,
  })
  if (props || children.length > 0) {
    element.props = {
      ...props,
      ...(children.length > 0 ? { children: children.length === 1 ? children[0] : children } : {}),
    }
  }
  Object.defineProperty(element, '__rue_repeatable_mount_factory__', {
    value: () => createElement(_type, props, ...children),
  })
  if (!isRueRenderableHandle(element)) {
    throw new Error(
      '[text:test] Expected Rue test element to satisfy the shared renderable handle contract',
    )
  }
  return element as RenderableOutput
}
