import type { ComponentInstance, ComponentProps, RenderOutput } from './runtime-types'
import { _$createComponent } from './compiled-component-call'
import { _$compiledValue } from './compiled-render-anchor'

/** Compiler-only dynamic target protocol. Children are carried by props; there is no rest-children API. */
export type CompiledDynamicType<P = {}> = string | ComponentInstance<P> | null | undefined

/** Mount a runtime-selected native tag or component through the compiled handle protocol. */
export const createCompiledDynamic = <P = {}>(
  type: CompiledDynamicType<P>,
  props: ComponentProps | null,
): RenderOutput | null => {
  if (type == null) return null
  if (typeof type !== 'string' && typeof type !== 'function') {
    throw new TypeError('[rue] compiled dynamic targets must be a tag string or component function')
  }
  return _$createComponent(type, (props ?? {}) as P & { children?: any })
}

/** Mount an explicit compiler-produced children list as one repeatable Fragment handle. */
export const createCompiledFragment = (children: readonly unknown[]): RenderOutput => {
  if (!Array.isArray(children)) {
    throw new TypeError('[rue] compiled fragments require a children array')
  }
  return _$compiledValue(children)
}
