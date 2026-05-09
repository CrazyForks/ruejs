import type { ComponentInstance } from './rue'

const runtimeComponentRegistry = new WeakMap<object, Map<string, ComponentInstance<any>>>()
const globalComponentRegistry = new Map<string, ComponentInstance<any>>()

const canTrackRuntime = (runtime: unknown): runtime is object =>
  (typeof runtime === 'object' || typeof runtime === 'function') && runtime != null

const getCurrentRuntime = () => {
  const globalRecord = globalThis as typeof globalThis & {
    __rue_active?: unknown
    __rue?: unknown
    __rue_vapor?: unknown
    __rue_vapor_preferred?: unknown
  }

  return (
    globalRecord.__rue_active ??
    globalRecord.__rue ??
    globalRecord.__rue_vapor_preferred ??
    globalRecord.__rue_vapor
  )
}

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

export const resolveCurrentRuntimeComponent = (name: string) =>
  resolveRuntimeComponent(getCurrentRuntime(), name)
