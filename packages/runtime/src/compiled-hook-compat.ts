/** Compiled components execute setup once, so hook IDs do not need render-time slot recovery. */
let currentCompiledHookId: string | undefined

export const getCurrentCompiledHookId = (): string | undefined => currentCompiledHookId

export const _$compiledWithHookId = <T>(id: string, runner: () => T): T => {
  const previous = currentCompiledHookId
  currentCompiledHookId = id
  try {
    return runner()
  } finally {
    currentCompiledHookId = previous
  }
}

/** Compiled factories already carry their reactive owner; preserve the factory identity. */
export function _$compiledMarkComponentRenderReactive<T extends (...args: any[]) => any>(
  component: T,
): T
export function _$compiledMarkComponentRenderReactive(): void
export function _$compiledMarkComponentRenderReactive<T extends (...args: any[]) => any>(
  component?: T,
): T | void {
  if (component == null) return
  Object.defineProperty(component, '__rue_component_render_reactive_factory__', {
    configurable: true,
    value: true,
  })
  return component
}

export const getCurrentInstance = () => getCurrentOwner()
import { getCurrentOwner } from './runtime-core/compiled'
