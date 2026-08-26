import type {
  ComponentHookHost,
  ComponentInstance,
  LifecycleCallback,
  LifecycleController,
  LifecycleHookMap,
  LifecycleName,
  ObjectLike,
} from './types.js'

const LIFECYCLE_HOOKS_KEY = '__rue_runtime_lifecycle_hooks__'

const LIFECYCLE_CLEANUP_DEPTH_KEY = Symbol.for('rue.lifecycle-cleanup-depth')

type LifecycleHookHost = ObjectLike & {
  __rue_runtime_lifecycle_hooks__?: LifecycleHookMap
}

const toLifecycleHookHost = (value: unknown): LifecycleHookHost | undefined =>
  (typeof value === 'object' || typeof value === 'function') && value != null
    ? (value as LifecycleHookHost)
    : undefined

const ensureHooks = (value: unknown): LifecycleHookMap | undefined => {
  const instance = toLifecycleHookHost(value)
  if (!instance) return undefined
  if (!instance[LIFECYCLE_HOOKS_KEY]) {
    Object.defineProperty(instance, LIFECYCLE_HOOKS_KEY, {
      configurable: true,
      value: new Map(),
    })
  }
  return instance[LIFECYCLE_HOOKS_KEY]
}

const hookList = (hooks: LifecycleHookMap, name: LifecycleName): LifecycleCallback[] => {
  let list = hooks.get(name)
  if (!list) {
    list = []
    hooks.set(name, list)
  }
  return list
}

const invoke = (hooks: LifecycleCallback[] | undefined): void => {
  for (const hook of hooks?.slice() ?? []) {
    if (typeof hook !== 'function') continue
    try {
      hook()
    } catch {
      // Lifecycle callbacks are best-effort notifications.
    }
  }
}

/** Register and dispatch lifecycle callbacks in instance scope and runtime order. */
export const createLifecycleController = (
  getCurrentInstance: () => unknown,
): LifecycleController => {
  const globalHooks: LifecycleHookMap = new Map()
  const lifecycleGlobal = globalThis as typeof globalThis & Record<symbol, unknown>

  const register = (name: LifecycleName, callback: unknown): (() => void) | undefined => {
    if (typeof callback !== 'function') return undefined
    const hook = callback as LifecycleCallback
    const instance = getCurrentInstance()
    const hooks = instance ? ensureHooks(instance) : globalHooks
    if (!hooks) return undefined
    const list = hookList(hooks, name)
    list.push(hook)
    return () => {
      const index = list.indexOf(hook)
      if (index >= 0) list.splice(index, 1)
    }
  }

  const call = (instance: unknown, name: LifecycleName): void => {
    const hooks = toLifecycleHookHost(instance)?.[LIFECYCLE_HOOKS_KEY]
    const cleanup = name === 'before_unmount' || name === 'unmounted'
    if (cleanup) {
      lifecycleGlobal[LIFECYCLE_CLEANUP_DEPTH_KEY] =
        Number(lifecycleGlobal[LIFECYCLE_CLEANUP_DEPTH_KEY] ?? 0) + 1
    }
    try {
      invoke(hooks instanceof Map ? hooks.get(name) : undefined)
    } finally {
      if (cleanup) {
        lifecycleGlobal[LIFECYCLE_CLEANUP_DEPTH_KEY] = Math.max(
          0,
          Number(lifecycleGlobal[LIFECYCLE_CLEANUP_DEPTH_KEY] ?? 1) - 1,
        )
      }
    }
  }

  const callGlobal = (name: LifecycleName): void => invoke(globalHooks.get(name))

  const runServerPrefetch = (instance: unknown): Promise<unknown[]> => {
    const hooks = toLifecycleHookHost(instance)?.[LIFECYCLE_HOOKS_KEY]
    const callbacks =
      hooks instanceof Map ? hooks.get('server_prefetch') : globalHooks.get('server_prefetch')
    const pending: unknown[] = []
    for (const callback of callbacks?.slice() ?? []) {
      if (typeof callback !== 'function') continue
      try {
        pending.push(callback())
      } catch (error) {
        pending.push(Promise.reject(error))
      }
    }
    return Promise.all(pending)
  }

  return {
    call,
    callGlobal,
    clear() {
      globalHooks.clear()
    },
    onActivated: callback => register('activated', callback),
    onBeforeCreate: callback => register('before_create', callback),
    onBeforeMount: callback => register('before_mount', callback),
    onBeforeUnmount: callback => register('before_unmount', callback),
    onBeforeUpdate: callback => register('before_update', callback),
    onCreated: callback => register('created', callback),
    onDeactivated: callback => register('deactivated', callback),
    onMounted: callback => register('mounted', callback),
    onRenderTriggered: callback => register('render_triggered', callback),
    onServerPrefetch: callback => register('server_prefetch', callback),
    onUnmounted: callback => register('unmounted', callback),
    onUpdated: callback => register('updated', callback),
    runServerPrefetch,
  }
}

export const invokeInstanceLifecycle = (
  controller: LifecycleController,
  instance: ComponentInstance | ComponentHookHost | null | undefined,
  name: LifecycleName,
): void => controller.call(instance && 'host' in instance ? instance.host : instance, name)
