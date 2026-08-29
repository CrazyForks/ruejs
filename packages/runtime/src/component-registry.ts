import type { ComponentInstance } from './rue'
import { getClientRuntime } from './client-runtime'
import { resolveActiveRuntime } from './runtime-context'

/*
运行时组件注册表概述
- useApp().component() 会把名称注册到当前 runtime 的局部表，同时写入全局兜底表。
- <Component is="Foo" /> 解析时优先读取当前激活 runtime，再回退到全局注册。
- WeakMap 按 runtime 隔离，避免多个 Rue 实例之间的组件名互相覆盖。
*/

const runtimeComponentRegistry = new WeakMap<object, Map<string, ComponentInstance<any>>>()
const globalComponentRegistry = new Map<string, ComponentInstance<any>>()

const canTrackRuntime = (runtime: unknown): runtime is object =>
  (typeof runtime === 'object' || typeof runtime === 'function') && runtime != null

const getCurrentRuntime = () => resolveActiveRuntime(getClientRuntime)

/** 给指定 runtime 注册一个可按名称解析的组件。 */
export const registerRuntimeComponent = (
  runtime: unknown,
  name: string,
  component: ComponentInstance<any>,
) => {
  if (!name) {
    return
  }

  globalComponentRegistry.set(name, component)

  if (!canTrackRuntime(runtime)) {
    return
  }

  const registry =
    runtimeComponentRegistry.get(runtime) ?? new Map<string, ComponentInstance<any>>()
  registry.set(name, component)
  runtimeComponentRegistry.set(runtime, registry)
}

/** 从指定 runtime 的组件表中解析组件，未命中时回退到全局表。 */
export const resolveRuntimeComponent = (runtime: unknown, name: string) => {
  if (!name) {
    return undefined
  }

  if (canTrackRuntime(runtime)) {
    const registered = runtimeComponentRegistry.get(runtime)?.get(name)
    if (registered) {
      return registered
    }
  }

  return globalComponentRegistry.get(name)
}

/** 从当前激活 runtime 中解析组件名。 */
export const resolveCurrentRuntimeComponent = (name: string) =>
  resolveRuntimeComponent(getCurrentRuntime(), name)
