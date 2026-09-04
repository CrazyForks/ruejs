import { batch, effect, getCurrentOwner, onOwnerCleanup, signal } from './internal-reactive'
import {
  createResource as runtimeCreateResource,
  onRenderTracked as runtimeOnRenderTracked,
} from './runtime-core/reactive'

const readonlyValues = new WeakSet<object>()
const reactiveValues = new WeakSet<object>()
const reactiveCache = new WeakMap<object, object>()
const shallowReactiveCache = new WeakMap<object, object>()
const readonlyCache = new WeakMap<object, object>()
const shallowReadonlyCache = new WeakMap<object, object>()
const arrayMutations = new Set<PropertyKey>([
  'copyWithin',
  'fill',
  'pop',
  'push',
  'reverse',
  'shift',
  'sort',
  'splice',
  'unshift',
])

const proxyObject = <T extends object>(value: T, readonly: boolean, shallow = false): T => {
  if (
    ArrayBuffer.isView(value) ||
    value instanceof ArrayBuffer ||
    value instanceof Date ||
    value instanceof RegExp ||
    (typeof Node !== 'undefined' && value instanceof Node)
  ) {
    return value
  }
  const cache = readonly
    ? shallow
      ? shallowReadonlyCache
      : readonlyCache
    : shallow
      ? shallowReactiveCache
      : reactiveCache
  const cached = cache.get(value)
  if (cached) return cached as T
  const slots = new Map<PropertyKey, ReturnType<typeof signal>>()
  const proxy = new Proxy(value, {
    get(target, key, receiver) {
      const collection = target instanceof Map || target instanceof Set
      const current = Reflect.get(target, key, collection ? target : receiver)
      if (typeof current === 'function' && collection) return current.bind(target)
      if (typeof current === 'function' && Array.isArray(target)) {
        if (!readonly && arrayMutations.has(key)) {
          return (...args: unknown[]) => batch(() => Reflect.apply(current, proxy, args))
        }
        return current.bind(proxy)
      }
      if (readonly && reactiveValues.has(target)) {
        return !shallow && current && typeof current === 'object'
          ? proxyObject(current as object, true, false)
          : current
      }
      let slot = slots.get(key)
      if (!slot) {
        slot = signal(current)
        slots.set(key, slot)
      }
      const result = slot.get()
      return !shallow && result && typeof result === 'object' && !isRef(result)
        ? proxyObject(result as object, readonly, false)
        : result
    },
    set(target, key, next, receiver) {
      if (readonly) return true
      const previousLength = Array.isArray(target) ? target.length : undefined
      const changed = Reflect.set(target, key, next, receiver)
      slots.get(key)?.set(next)
      if (Array.isArray(target) && key !== 'length' && target.length !== previousLength) {
        slots.get('length')?.set(target.length)
      }
      return changed
    },
    deleteProperty(target, key) {
      if (readonly) return true
      const changed = Reflect.deleteProperty(target, key)
      slots.get(key)?.set(undefined)
      return changed
    },
  })
  cache.set(value, proxy)
  ;(readonly ? readonlyValues : reactiveValues).add(proxy)
  return proxy
}

export const reactive = <T extends object>(value: T): T => proxyObject(value, false)
export const shallowReactive = <T extends object>(value: T): T => proxyObject(value, false, true)
export const readonly = <T extends object>(value: T): Readonly<T> => proxyObject(value, true)
export const shallowReadonly = <T extends object>(value: T): Readonly<T> =>
  proxyObject(value, true, true)
export const propsReactive = <T extends object>(value: T): Readonly<T> =>
  proxyObject(value, true, true)
export const isReadonly = (value: unknown): boolean =>
  !!value && typeof value === 'object' && readonlyValues.has(value)
export const isReactive = (value: unknown): boolean =>
  !!value && typeof value === 'object' && reactiveValues.has(value)
export const isProxy = (value: unknown): boolean => isReadonly(value) || isReactive(value)
export const isRef = (value: unknown): boolean =>
  !!value &&
  typeof value === 'object' &&
  'get' in value &&
  typeof value.get === 'function' &&
  'set' in value &&
  typeof value.set === 'function'
export const triggerRef = (value: unknown): void => {
  if (
    value &&
    typeof value === 'object' &&
    'trigger' in value &&
    typeof value.trigger === 'function'
  ) {
    value.trigger()
  }
}
export const toRef = <T extends object, K extends keyof T>(object: T, key: K) => ({
  get value(): T[K] {
    return object[key]
  },
  set value(next: T[K]) {
    object[key] = next
  },
  get: () => object[key],
  set: (next: T[K]) => {
    object[key] = next
  },
})
export const toRefs = <T extends object>(
  object: T,
): { [K in keyof T]: ReturnType<typeof toRef<T, K>> } =>
  Object.fromEntries(
    Reflect.ownKeys(object).map(key => [key, toRef(object, key as keyof T)]),
  ) as unknown as { [K in keyof T]: ReturnType<typeof toRef<T, K>> }

export const customRef = <T>(
  factory: (track: () => void, trigger: () => void) => { get(): T; set(value: T): void },
) => {
  const version = signal(0)
  const implementation = factory(
    () => void version.get(),
    () => version.update(value => value + 1),
  )
  return {
    get value() {
      return implementation.get()
    },
    set value(next: T) {
      implementation.set(next)
    },
    get: () => implementation.get(),
    set: (next: T) => implementation.set(next),
    trigger: () => version.update(value => value + 1),
  }
}

export const createResource = <Source, Value>(
  source: { get(): Source },
  loader: (source: Source) => Promise<Value>,
) => runtimeCreateResource(source, loader)

export const onRenderTracked = (callback: (event: unknown) => void): void => {
  const owner = getCurrentOwner() as
    | { __rue_render_tracked_hooks__?: Array<(event: unknown) => void> }
    | undefined
  if (owner != null) {
    const hooks = owner.__rue_render_tracked_hooks__ ?? []
    if (owner.__rue_render_tracked_hooks__ == null) {
      Object.defineProperty(owner, '__rue_render_tracked_hooks__', {
        configurable: true,
        value: hooks,
      })
    }
    hooks.push(callback)
    onOwnerCleanup(() => {
      const index = hooks.indexOf(callback)
      if (index >= 0) hooks.splice(index, 1)
    })
  }
  runtimeOnRenderTracked(callback as never)
}

const readSource = (source: unknown): unknown => {
  if (Array.isArray(source)) return source.map(readSource)
  if (typeof source === 'function') return source()
  if (source && typeof source === 'object') {
    if ('get' in source && typeof source.get === 'function') return source.get()
    if ('value' in source) return source.value
  }
  return source
}

export const toValue = <T>(source: T | (() => T)): T => readSource(source) as T
export const toRaw = <T>(value: T): T => value
export const unref = <T>(value: T | { value: T }): T =>
  value != null && typeof value === 'object' && 'value' in value ? value.value : value

export const watch = (
  source: unknown,
  callback: (value: unknown, previous: unknown) => void,
  options?: { immediate?: boolean },
) => {
  let initialized = false
  let previous: unknown
  return effect(() => {
    const value = readSource(source)
    if (initialized || options?.immediate) callback(value, previous)
    previous = value
    initialized = true
  })
}
