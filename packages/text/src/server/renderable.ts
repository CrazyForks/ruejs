import type { TextNode as RueRenderableOutput } from '../runtime/render-protocol.js'
import type { TextCompatNode } from '../shims/text-compat-types.js'

export type TextRenderable = TextCompatNode | RueRenderableOutput

export function isRueRenderableHandle(
  value: unknown,
): value is Extract<RueRenderableOutput, object> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (Symbol.for('rue.server.operation') in value ||
      '__rue_mount_id' in value ||
      '__rue_component_type' in value ||
      '__rue_compiled_mount' in value ||
      '__rue_repeatable_mount_factory__' in value)
  )
}

export function isRueRenderable(value: unknown): value is RueRenderableOutput {
  if (Array.isArray(value)) return value.some(isRueRenderable)
  return isRueRenderableHandle(value)
}
