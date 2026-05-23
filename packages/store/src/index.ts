/*
Store 架构概述
- 根实例：createStore 创建应用级 store root，并像 Router 一样按容器绑定，支持 install/useStoreRoot。
- 定义方式：defineStore 同时支持 options 风格与 setup 风格，兼顾 Pinia 的集中式 API 与组合式写法。
- 响应式：底层直接复用 Rue 现有 reactive/ref/computed/watchEffect，避免重复造轮子。
- 变更入口：提供 $patch/$set/$reset/$subscribe，既保留集中管理体验，也补上细粒度路径更新能力。
*/
import { computed, getCurrentContainer, reactive, watchEffect } from '@rue-js/rue'

export type StateTree = Record<string, any>
export type StorePath = string | number | Array<string | number>

export type StoreSubscription = (mutation: { storeId: string }, state: StateTree) => void

export type StorePlugin = (context: {
  store: StoreInstance
  root: StoreRoot
  id: string
}) => void | Record<string, unknown>

export type StoreInstance = {
  $id: string
  $state: StateTree
  $patch: (patch: Partial<StateTree> | ((state: StateTree) => void)) => void
  $set: (path: StorePath, value: unknown | ((prev: unknown) => unknown)) => void
  $reset: () => void
  $subscribe: (callback: StoreSubscription, options?: { immediate?: boolean }) => () => void
  $dispose: () => void
  [key: string]: any
}

export type StoreRoot = {
  install: (app: unknown, options: unknown[]) => void
  use: (plugin: StorePlugin) => StoreRoot
  dispose: () => void
  _s: Map<string, StoreInstance>
  _p: StorePlugin[]
}

export type DefineStoreOptions = {
  state?: () => StateTree
  getters?: Record<string, (state: StateTree) => unknown>
  actions?: Record<string, (...args: any[]) => unknown>
}

export type QueryHistoryMode = 'replace' | 'push'
export type QueryRateLimitMode = 'debounce' | 'throttle'
export type QueryRateLimit = {
  mode: QueryRateLimitMode
  wait: number
}
export type QueryParser<T> = {
  parse: (value: string | null) => T | null | undefined
  serialize: (value: T) => string | null | undefined
  equals?: (left: T, right: T) => boolean
  defaultValue?: T
  withDefault: (defaultValue: T) => QueryParser<T>
}
export type QueryFieldConfig<T = unknown> =
  | QueryParser<T>
  | {
      path?: StorePath
      parser?: QueryParser<T>
      history?: QueryHistoryMode
      writeDefault?: boolean
      limitUrlUpdates?: QueryRateLimit
    }
export type QuerySyncStoreConfig = Record<string, QueryFieldConfig<any>>
export type QuerySyncPluginOptions = {
  history?: QueryHistoryMode
  writeDefaults?: boolean
  limitUrlUpdates?: QueryRateLimit
  stores: Record<string, QuerySyncStoreConfig>
}

type RefLike<T = unknown> = { value: T }
type StateAccessor = {
  get: () => unknown
  set?: (value: unknown) => void
}
type SetupStoreFactory = () => Record<string, unknown>
type GetterLike<T = unknown> = { get?: () => T; value?: T }
type EffectHandle = { dispose: () => void }
type NormalizedStorePath = Array<string | number>
type QueryParserDefinition<T> = {
  parse: (value: string | null) => T | null | undefined
  serialize: (value: T) => string | null | undefined
  equals?: (left: T, right: T) => boolean
  defaultValue?: T
}
type QueryFieldScheduleState = {
  dueAt: number | null
  lastFlushedAt: number
}
type CompiledQueryField = {
  queryKey: string
  path: NormalizedStorePath
  parser: QueryParser<any>
  history: QueryHistoryMode
  writeDefault: boolean
  limitUrlUpdates: QueryRateLimit | null
}
type QueryStoreBinding = {
  store: StoreInstance
  fields: CompiledQueryField[]
  unsubscribe: (() => void) | null
  lastSerializedByKey: Map<string, string | null>
  observedSerializedByKey: Map<string, string | null>
  scheduleStateByKey: Map<string, QueryFieldScheduleState>
  skipNextSubscription: boolean
}

const __storeRootByContainer = new WeakMap<HTMLElement, StoreRoot>()
let __activeStoreRoot: StoreRoot | null = null

const isObjectLike = (value: unknown): value is Record<PropertyKey, unknown> =>
  (typeof value === 'object' || typeof value === 'function') && value != null

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!isObjectLike(value) || Array.isArray(value)) {
    return false
  }
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

const isRefLike = (value: unknown): value is RefLike => isObjectLike(value) && 'value' in value

const readReactiveValue = <T>(value: GetterLike<T>): T =>
  typeof value.get === 'function' ? value.get() : (value.value as T)

const createQueryParser = <T>(definition: QueryParserDefinition<T>): QueryParser<T> => {
  const parser = {
    parse: definition.parse,
    serialize: definition.serialize,
    equals: definition.equals,
    defaultValue: definition.defaultValue,
    withDefault(defaultValue: T) {
      return createQueryParser({
        ...definition,
        defaultValue,
      })
    },
  } satisfies QueryParser<T>

  return parser
}

export const createParser = createQueryParser

export const debounce = (wait: number): QueryRateLimit => ({
  mode: 'debounce',
  wait,
})

export const throttle = (wait: number): QueryRateLimit => ({
  mode: 'throttle',
  wait,
})

export const parseAsString = createQueryParser<string>({
  parse: value => (value == null ? null : String(value)),
  serialize: value => String(value),
})

export const parseAsInteger = createQueryParser<number>({
  parse: value => {
    if (value == null || !/^-?\d+$/.test(value)) {
      return null
    }
    const next = Number.parseInt(value, 10)
    return Number.isFinite(next) ? next : null
  },
  serialize: value => (Number.isFinite(value) ? String(Math.trunc(value)) : null),
})

export const parseAsFloat = createQueryParser<number>({
  parse: value => {
    if (value == null || value.trim() === '') {
      return null
    }
    const next = Number(value)
    return Number.isFinite(next) ? next : null
  },
  serialize: value => (Number.isFinite(value) ? String(value) : null),
})

export const parseAsBoolean = createQueryParser<boolean>({
  parse: value => {
    if (value == null) {
      return null
    }
    const normalized = value.trim().toLowerCase()
    if (normalized === '1' || normalized === 'true' || normalized === 'yes') {
      return true
    }
    if (normalized === '0' || normalized === 'false' || normalized === 'no') {
      return false
    }
    return null
  },
  serialize: value => (value ? '1' : '0'),
  equals: (left, right) => left === right,
})

export const parseAsJson = <T>() =>
  createQueryParser<T>({
    parse: value => {
      if (value == null) {
        return null
      }

      try {
        return JSON.parse(value) as T
      } catch {
        return null
      }
    },
    serialize: value => {
      try {
        return JSON.stringify(value)
      } catch {
        return null
      }
    },
  })

const getPropertyDescriptor = (value: object, key: PropertyKey): PropertyDescriptor | undefined => {
  let current: object | null = value
  while (current) {
    const descriptor = Object.getOwnPropertyDescriptor(current, key)
    if (descriptor) {
      return descriptor
    }
    current = Object.getPrototypeOf(current)
  }
  return undefined
}

const isWritableRefLike = (value: RefLike): boolean => {
  const descriptor = getPropertyDescriptor(value as object, 'value')
  return !!descriptor && (typeof descriptor.set === 'function' || descriptor.writable === true)
}

const cloneValue = <T>(value: T, seen = new WeakMap<object, unknown>()): T => {
  if (!isObjectLike(value)) {
    return value
  }

  if (seen.has(value as object)) {
    return seen.get(value as object) as T
  }

  if (Array.isArray(value)) {
    const next: unknown[] = []
    seen.set(value as object, next)
    value.forEach(item => {
      next.push(cloneValue(item, seen))
    })
    return next as T
  }

  if (value instanceof Date) {
    return new Date(value.getTime()) as T
  }

  if (!isPlainObject(value)) {
    return value
  }

  const next = Object.create(Object.getPrototypeOf(value)) as Record<string, unknown>
  seen.set(value as object, next)
  Object.keys(value).forEach(key => {
    next[key] = cloneValue((value as Record<string, unknown>)[key], seen)
  })
  return next as T
}

const applyObjectPatch = (target: Record<string, any>, patch: Record<string, unknown>) => {
  Object.keys(patch).forEach(key => {
    const nextValue = patch[key]
    const prevValue = target[key]

    if (isPlainObject(prevValue) && isPlainObject(nextValue)) {
      applyObjectPatch(prevValue, nextValue)
      return
    }

    target[key] = cloneValue(nextValue)
  })
}

const normalizePath = (path: StorePath): Array<string | number> =>
  Array.isArray(path) ? path.slice() : [path]

const normalizeQueryRateLimit = (value?: QueryRateLimit | null) => {
  if (!value) {
    return null
  }

  const wait = Number.isFinite(value.wait) ? Math.max(0, Math.trunc(value.wait)) : 0
  if (wait <= 0) {
    return null
  }

  return {
    mode: value.mode,
    wait,
  } satisfies QueryRateLimit
}

const getByPath = (target: Record<string, any>, path: Array<string | number>) => {
  let current: unknown = target
  for (let index = 0; index < path.length; index += 1) {
    if (!isObjectLike(current)) {
      return undefined
    }
    current = (current as Record<string | number, unknown>)[path[index]]
  }
  return current
}

const isQueryParser = (value: unknown): value is QueryParser<any> =>
  isObjectLike(value) &&
  typeof (value as QueryParser<any>).parse === 'function' &&
  typeof (value as QueryParser<any>).serialize === 'function' &&
  typeof (value as QueryParser<any>).withDefault === 'function'

const safelySerializeQueryValue = (parser: QueryParser<any>, value: unknown) => {
  try {
    const serialized = parser.serialize(value)
    return serialized == null ? null : String(serialized)
  } catch {
    return null
  }
}

const areQueryValuesEqual = (parser: QueryParser<any>, left: unknown, right: unknown): boolean => {
  if (left === right) {
    return true
  }

  if (typeof parser.equals === 'function') {
    try {
      return parser.equals(left, right)
    } catch {
      return false
    }
  }

  return safelySerializeQueryValue(parser, left) === safelySerializeQueryValue(parser, right)
}

const getQueryDefaultValue = (parser: QueryParser<any>) => {
  if (parser.defaultValue === undefined) {
    return undefined
  }
  return cloneValue(parser.defaultValue)
}

const readQueryValue = (parser: QueryParser<any>, rawValue: string | null) => {
  if (rawValue == null) {
    const fallback = getQueryDefaultValue(parser)
    return fallback === undefined ? { hasValue: false } : { hasValue: true, value: fallback }
  }

  try {
    const parsed = parser.parse(rawValue)
    if (parsed !== undefined && parsed !== null) {
      return { hasValue: true, value: parsed }
    }
  } catch {}

  const fallback = getQueryDefaultValue(parser)
  return fallback === undefined ? { hasValue: false } : { hasValue: true, value: fallback }
}

const resolveQueryFieldSerializedValue = (field: CompiledQueryField, value: unknown) => {
  if (!field.writeDefault && field.parser.defaultValue !== undefined) {
    if (areQueryValuesEqual(field.parser, value, field.parser.defaultValue)) {
      return null
    }
  }

  return safelySerializeQueryValue(field.parser, value)
}

const compileQuerySyncFields = (
  config: QuerySyncStoreConfig,
  defaults: QuerySyncPluginOptions,
): CompiledQueryField[] => {
  return Object.keys(config).map(queryKey => {
    const rawField = config[queryKey]
    const normalized = isQueryParser(rawField) ? { parser: rawField } : rawField
    const parser = normalized.parser || parseAsString

    return {
      queryKey,
      path: normalizePath(normalized.path ?? queryKey),
      parser,
      history: normalized.history || defaults.history || 'replace',
      writeDefault: normalized.writeDefault ?? defaults.writeDefaults ?? false,
      limitUrlUpdates: normalizeQueryRateLimit(
        normalized.limitUrlUpdates ?? defaults.limitUrlUpdates ?? null,
      ),
    }
  })
}

const computeQueryFieldDueAt = (
  field: CompiledQueryField,
  scheduleState: QueryFieldScheduleState,
  now: number,
) => {
  const rateLimit = field.limitUrlUpdates
  if (!rateLimit) {
    return now
  }

  if (rateLimit.mode === 'debounce') {
    return now + rateLimit.wait
  }

  if (scheduleState.lastFlushedAt <= 0 || now - scheduleState.lastFlushedAt >= rateLimit.wait) {
    return now
  }

  return scheduleState.lastFlushedAt + rateLimit.wait
}

/** Query 同步插件：
 * - stores：按 store id 声明需要映射到 URL query 的字段集合。
 * - query key：配置对象的键名即最终写入 URL 的参数名。
 * - path：默认与 query key 同名；若 store 字段名不同，可显式指定 path。
 * - parser：借鉴 nuqs 的 parser 思路，负责字符串与状态值之间的双向转换。
 * - history：默认 replace；需要保留后退栈时可切到 push。
 * - limitUrlUpdates：借鉴 nuqs，支持 debounce/throttle 控制 URL 写入频率，不影响本地 state 的即时更新。
 */
export const createQuerySync = (options: QuerySyncPluginOptions): StorePlugin => {
  const activeBindings = new Map<StoreInstance, QueryStoreBinding>()
  const browser = globalThis as typeof globalThis & {
    addEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void
    removeEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void
    location?: Location
    history?: History
  }
  let listening = false
  let flushQueued = false
  let flushTimer: ReturnType<typeof setTimeout> | null = null
  let flushTimerDueAt: number | null = null

  const canUseBrowser = () =>
    !!browser.location &&
    !!browser.history &&
    typeof URLSearchParams !== 'undefined' &&
    typeof browser.addEventListener === 'function' &&
    typeof browser.removeEventListener === 'function'

  const readCurrentUrl = () => {
    if (!browser.location) {
      return null
    }
    return new URL(browser.location.href)
  }

  const buildRelativeUrl = (url: URL) => `${url.pathname}${url.search}${url.hash}`

  const clearScheduledFlush = () => {
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
    flushTimerDueAt = null
  }

  const queueImmediateFlush = () => {
    if (flushQueued) {
      return
    }
    flushQueued = true
    queueMicrotask(() => {
      flushQueued = false
      flushBindingsToUrl()
    })
  }

  const resetPendingWrites = (binding: QueryStoreBinding) => {
    binding.scheduleStateByKey.forEach(scheduleState => {
      scheduleState.dueAt = null
    })
  }

  const applyLocationToStore = (binding: QueryStoreBinding) => {
    const currentUrl = readCurrentUrl()
    if (!currentUrl) {
      return
    }

    const params = new URLSearchParams(currentUrl.search)
    const updates: Array<{ path: NormalizedStorePath; value: unknown }> = []

    binding.fields.forEach(field => {
      const next = readQueryValue(field.parser, params.get(field.queryKey))
      if (!next.hasValue) {
        return
      }

      const currentValue = getByPath(binding.store.$state, field.path)
      if (areQueryValuesEqual(field.parser, currentValue, next.value)) {
        binding.lastSerializedByKey.set(
          field.queryKey,
          resolveQueryFieldSerializedValue(field, currentValue),
        )
        return
      }

      updates.push({
        path: field.path,
        value: cloneValue(next.value),
      })
      binding.lastSerializedByKey.set(
        field.queryKey,
        resolveQueryFieldSerializedValue(field, next.value),
      )
    })

    if (updates.length === 0) {
      binding.fields.forEach(field => {
        const currentValue = getByPath(binding.store.$state, field.path)
        const serialized = resolveQueryFieldSerializedValue(field, currentValue)
        binding.lastSerializedByKey.set(field.queryKey, serialized)
        binding.observedSerializedByKey.set(field.queryKey, serialized)
      })
      return
    }

    if (binding.unsubscribe) {
      binding.skipNextSubscription = true
    }
    binding.store.$patch(state => {
      updates.forEach(update => {
        setByPath(state, update.path, update.value)
      })
    })

    binding.fields.forEach(field => {
      const currentValue = getByPath(binding.store.$state, field.path)
      const serialized = resolveQueryFieldSerializedValue(field, currentValue)
      binding.lastSerializedByKey.set(field.queryKey, serialized)
      binding.observedSerializedByKey.set(field.queryKey, serialized)
      binding.scheduleStateByKey.get(field.queryKey)!.dueAt = null
    })
  }

  const getNextFlushDueAt = () => {
    let nextDueAt: number | null = null

    activeBindings.forEach(binding => {
      binding.fields.forEach(field => {
        const scheduleState = binding.scheduleStateByKey.get(field.queryKey)
        if (!scheduleState || scheduleState.dueAt == null) {
          return
        }

        const nextValue = getByPath(binding.store.$state, field.path)
        const nextSerialized = resolveQueryFieldSerializedValue(field, nextValue)
        const committed = binding.lastSerializedByKey.get(field.queryKey) ?? null
        if (nextSerialized === committed) {
          scheduleState.dueAt = null
          return
        }

        nextDueAt =
          nextDueAt == null ? scheduleState.dueAt : Math.min(nextDueAt, scheduleState.dueAt)
      })
    })

    return nextDueAt
  }

  const scheduleFlush = () => {
    if (!canUseBrowser()) {
      return
    }

    const nextDueAt = getNextFlushDueAt()
    if (nextDueAt == null) {
      clearScheduledFlush()
      return
    }

    const now = Date.now()
    if (nextDueAt <= now) {
      clearScheduledFlush()
      queueImmediateFlush()
      return
    }

    if (flushTimer && flushTimerDueAt === nextDueAt) {
      return
    }

    clearScheduledFlush()
    flushTimerDueAt = nextDueAt
    flushTimer = setTimeout(
      () => {
        flushTimer = null
        flushTimerDueAt = null
        flushBindingsToUrl()
      },
      Math.max(0, nextDueAt - now),
    )
  }

  const flushBindingsToUrl = () => {
    clearScheduledFlush()
    const currentUrl = readCurrentUrl()
    if (!currentUrl || !browser.history) {
      return
    }

    const params = new URLSearchParams(currentUrl.search)
    let shouldPush = false
    let changed = false
    const now = Date.now()

    activeBindings.forEach(binding => {
      binding.fields.forEach(field => {
        const scheduleState = binding.scheduleStateByKey.get(field.queryKey)
        if (!scheduleState) {
          return
        }

        const nextValue = getByPath(binding.store.$state, field.path)
        const nextSerialized = resolveQueryFieldSerializedValue(field, nextValue)
        const previousSerialized = binding.lastSerializedByKey.get(field.queryKey) ?? null
        if (nextSerialized === previousSerialized) {
          scheduleState.dueAt = null
          binding.observedSerializedByKey.set(field.queryKey, nextSerialized)
          return
        }

        if (scheduleState.dueAt != null && scheduleState.dueAt > now) {
          return
        }

        const currentSerialized = params.get(field.queryKey)

        if (nextSerialized === null) {
          if (currentSerialized !== null) {
            params.delete(field.queryKey)
            changed = true
          }
        } else if (currentSerialized !== nextSerialized) {
          params.set(field.queryKey, nextSerialized)
          changed = true
        }

        if (previousSerialized !== nextSerialized && field.history === 'push') {
          shouldPush = true
        }

        binding.lastSerializedByKey.set(field.queryKey, nextSerialized)
        binding.observedSerializedByKey.set(field.queryKey, nextSerialized)
        scheduleState.dueAt = null
        scheduleState.lastFlushedAt = now
      })
    })

    if (changed) {
      currentUrl.search = params.toString() ? `?${params.toString()}` : ''
      const nextHref = buildRelativeUrl(currentUrl)

      if (shouldPush) {
        browser.history.pushState(browser.history.state, '', nextHref)
      } else {
        browser.history.replaceState(browser.history.state, '', nextHref)
      }
    }

    scheduleFlush()

    if (!changed) {
      return
    }
  }

  const handlePopState = () => {
    clearScheduledFlush()
    activeBindings.forEach(binding => {
      resetPendingWrites(binding)
      applyLocationToStore(binding)
    })
  }

  const ensureListener = () => {
    if (!canUseBrowser() || listening) {
      return
    }
    browser.addEventListener?.('popstate', handlePopState)
    listening = true
  }

  const cleanupListener = () => {
    if (!listening || activeBindings.size > 0) {
      return
    }
    browser.removeEventListener?.('popstate', handlePopState)
    listening = false
    clearScheduledFlush()
  }

  return ({ store, id }) => {
    const config = options.stores[id]
    if (!config) {
      return undefined
    }

    const fields = compileQuerySyncFields(config, options)
    if (fields.length === 0) {
      return undefined
    }

    const binding: QueryStoreBinding = {
      store,
      fields,
      unsubscribe: null,
      lastSerializedByKey: new Map(),
      observedSerializedByKey: new Map(),
      scheduleStateByKey: new Map(),
      skipNextSubscription: false,
    }

    fields.forEach(field => {
      binding.scheduleStateByKey.set(field.queryKey, {
        dueAt: null,
        lastFlushedAt: 0,
      })
    })

    activeBindings.set(store, binding)
    ensureListener()

    applyLocationToStore(binding)

    fields.forEach(field => {
      const serialized = resolveQueryFieldSerializedValue(
        field,
        getByPath(store.$state, field.path),
      )
      binding.lastSerializedByKey.set(field.queryKey, serialized)
      binding.observedSerializedByKey.set(field.queryKey, serialized)
    })

    binding.unsubscribe = store.$subscribe(() => {
      if (binding.skipNextSubscription) {
        binding.skipNextSubscription = false
        binding.fields.forEach(field => {
          const serialized = resolveQueryFieldSerializedValue(
            field,
            getByPath(store.$state, field.path),
          )
          binding.observedSerializedByKey.set(field.queryKey, serialized)
          binding.scheduleStateByKey.get(field.queryKey)!.dueAt = null
        })
        return
      }

      const now = Date.now()
      let sawDirtyField = false

      binding.fields.forEach(field => {
        const nextSerialized = resolveQueryFieldSerializedValue(
          field,
          getByPath(store.$state, field.path),
        )
        const observed = binding.observedSerializedByKey.get(field.queryKey) ?? null
        if (observed === nextSerialized) {
          return
        }

        binding.observedSerializedByKey.set(field.queryKey, nextSerialized)

        const committed = binding.lastSerializedByKey.get(field.queryKey) ?? null
        const scheduleState = binding.scheduleStateByKey.get(field.queryKey)!
        if (committed === nextSerialized) {
          scheduleState.dueAt = null
          return
        }

        scheduleState.dueAt = computeQueryFieldDueAt(field, scheduleState, now)
        sawDirtyField = true
      })

      if (!sawDirtyField) {
        return
      }

      scheduleFlush()
    })

    const originalDispose = store.$dispose
    const extension = Object.create(null)
    Object.defineProperty(extension, '$dispose', {
      enumerable: false,
      configurable: true,
      value: () => {
        binding.unsubscribe?.()
        activeBindings.delete(store)
        resetPendingWrites(binding)
        if (activeBindings.size === 0) {
          cleanupListener()
        } else {
          scheduleFlush()
        }
        originalDispose.call(store)
      },
    })

    return extension
  }
}

const setByPath = (
  target: Record<string, any>,
  path: Array<string | number>,
  value: unknown | ((prev: unknown) => unknown),
) => {
  if (path.length === 0) {
    return
  }

  let current: Record<string | number, unknown> = target
  for (let index = 0; index < path.length - 1; index += 1) {
    const segment = path[index]
    const nextSegment = path[index + 1]
    const existing = current[segment]
    if (!isObjectLike(existing)) {
      current[segment] = typeof nextSegment === 'number' ? [] : {}
    }
    current = current[segment] as Record<string | number, unknown>
  }

  const lastSegment = path[path.length - 1]
  const prevValue = current[lastSegment]
  current[lastSegment] =
    typeof value === 'function' ? (value as (prev: unknown) => unknown)(prevValue) : value
}

const applyStorePlugin = (
  root: StoreRoot,
  store: StoreInstance,
  id: string,
  plugin: StorePlugin,
) => {
  const extension = plugin({ store, root, id })
  if (!isObjectLike(extension)) {
    return
  }

  Reflect.ownKeys(extension).forEach(key => {
    const descriptor = Object.getOwnPropertyDescriptor(extension, key)
    if (!descriptor) {
      return
    }
    Object.defineProperty(store, key, {
      ...descriptor,
      configurable: true,
    })
  })
}

export const attachStoreRoot = (root: StoreRoot) => {
  const container = getCurrentContainer() as HTMLElement | null
  if (container) {
    __storeRootByContainer.set(container, root)
  }
  __activeStoreRoot = root
}

export const useStoreRoot = (): StoreRoot => {
  const container = getCurrentContainer() as HTMLElement | null
  const root =
    (container ? __storeRootByContainer.get(container) || null : null) || __activeStoreRoot
  if (!root) {
    throw new Error('Store root not installed for current application/container')
  }
  return root
}

export const createStore = (): StoreRoot => {
  const stores = new Map<string, StoreInstance>()
  const plugins: StorePlugin[] = []

  const root: StoreRoot = {
    _s: stores,
    _p: plugins,
    install: (_app: unknown, _options: unknown[]) => {
      attachStoreRoot(root)
    },
    use: (plugin: StorePlugin) => {
      if (typeof plugin !== 'function') {
        return root
      }
      plugins.push(plugin)
      Array.from(stores.entries()).forEach(([id, store]) => {
        applyStorePlugin(root, store, id, plugin)
      })
      return root
    },
    dispose: () => {
      Array.from(stores.values()).forEach(store => {
        store.$dispose()
      })
      if (__activeStoreRoot === root) {
        __activeStoreRoot = null
      }
    },
  }

  return root
}

const createStoreInstance = (
  root: StoreRoot,
  id: string,
  input: DefineStoreOptions | SetupStoreFactory,
): StoreInstance => {
  const store = Object.create(null) as StoreInstance
  const stateAccessors = new Map<string, StateAccessor>()
  const stops = new Set<EffectHandle>()
  let dynamicStateTarget: StateTree | null = null

  const defineStateProperty = (key: string, accessor: StateAccessor) => {
    stateAccessors.set(key, accessor)
    const descriptor: PropertyDescriptor = {
      enumerable: true,
      configurable: true,
      get: accessor.get,
    }
    if (accessor.set) {
      descriptor.set = accessor.set
    }
    Object.defineProperty(store, key, descriptor)
  }

  const ensureDynamicStateKey = (key: string) => {
    if (!dynamicStateTarget || stateAccessors.has(key)) {
      return
    }
    defineStateProperty(key, {
      get: () => dynamicStateTarget![key],
      set: value => {
        dynamicStateTarget![key] = value
      },
    })
  }

  const listStateKeys = () => {
    if (dynamicStateTarget) {
      Object.keys(dynamicStateTarget).forEach(ensureDynamicStateKey)
    }
    return Array.from(stateAccessors.keys())
  }

  const stateFacade = new Proxy(Object.create(null) as StateTree, {
    ownKeys: () => listStateKeys(),
    getOwnPropertyDescriptor: (_target, prop) => {
      if (typeof prop !== 'string') {
        return undefined
      }
      ensureDynamicStateKey(prop)
      if (!stateAccessors.has(prop)) {
        return undefined
      }
      return {
        enumerable: true,
        configurable: true,
      }
    },
    get: (_target, prop) => {
      if (typeof prop !== 'string') {
        return undefined
      }
      ensureDynamicStateKey(prop)
      return stateAccessors.get(prop)?.get()
    },
    set: (_target, prop, value) => {
      if (typeof prop !== 'string') {
        return false
      }
      ensureDynamicStateKey(prop)
      const accessor = stateAccessors.get(prop)
      if (!accessor?.set) {
        return false
      }
      accessor.set(value)
      return true
    },
    has: (_target, prop) => {
      if (typeof prop !== 'string') {
        return false
      }
      ensureDynamicStateKey(prop)
      return stateAccessors.has(prop)
    },
  }) as StateTree

  if (typeof input === 'function') {
    const setupStore = input()
    Object.keys(setupStore).forEach(key => {
      const value = setupStore[key]
      if (typeof value === 'function') {
        Object.defineProperty(store, key, {
          enumerable: true,
          configurable: true,
          value: (...args: any[]) => value.apply(store, args),
        })
        return
      }

      if (isRefLike(value)) {
        const writable = isWritableRefLike(value)
        const descriptor: PropertyDescriptor = {
          enumerable: true,
          configurable: true,
          get: () => readReactiveValue(value),
        }
        if (writable) {
          descriptor.set = nextValue => {
            value.value = nextValue
          }
          stateAccessors.set(key, {
            get: () => readReactiveValue(value),
            set: nextValue => {
              value.value = nextValue
            },
          })
        }
        Object.defineProperty(store, key, descriptor)
        return
      }

      defineStateProperty(key, {
        get: () => setupStore[key],
        set: nextValue => {
          setupStore[key] = nextValue
        },
      })
    })
  } else {
    const options = input
    const sourceState = (options.state ? options.state() : {}) as StateTree
    dynamicStateTarget = reactive(sourceState) as StateTree
    Object.keys(sourceState).forEach(ensureDynamicStateKey)

    Object.keys(options.getters || {}).forEach(key => {
      const getter = options.getters?.[key]
      if (!getter) {
        return
      }
      const value = computed(() => getter.call(store, stateFacade))
      Object.defineProperty(store, key, {
        enumerable: true,
        configurable: true,
        get: () => readReactiveValue(value),
      })
    })

    Object.keys(options.actions || {}).forEach(key => {
      const action = options.actions?.[key]
      if (!action) {
        return
      }
      Object.defineProperty(store, key, {
        enumerable: true,
        configurable: true,
        value: (...args: any[]) => action.apply(store, args),
      })
    })
  }

  const initialState = cloneValue(stateFacade)

  Object.defineProperty(store, '$id', {
    enumerable: true,
    configurable: true,
    get: () => id,
  })

  Object.defineProperty(store, '$state', {
    enumerable: true,
    configurable: true,
    get: () => stateFacade,
    set: nextState => {
      if (isPlainObject(nextState)) {
        applyObjectPatch(stateFacade, nextState)
      }
    },
  })

  Object.defineProperty(store, '$patch', {
    enumerable: false,
    configurable: true,
    value: (patch: Partial<StateTree> | ((state: StateTree) => void)) => {
      if (typeof patch === 'function') {
        patch(stateFacade)
        return
      }
      if (isPlainObject(patch)) {
        applyObjectPatch(stateFacade, patch)
      }
    },
  })

  Object.defineProperty(store, '$set', {
    enumerable: false,
    configurable: true,
    value: (path: StorePath, value: unknown | ((prev: unknown) => unknown)) => {
      setByPath(stateFacade, normalizePath(path), value)
    },
  })

  Object.defineProperty(store, '$reset', {
    enumerable: false,
    configurable: true,
    value: () => {
      if (dynamicStateTarget) {
        Object.keys(dynamicStateTarget).forEach(key => {
          if (!(key in initialState)) {
            delete dynamicStateTarget![key]
            stateAccessors.delete(key)
            delete store[key]
          }
        })
      }
      applyObjectPatch(stateFacade, cloneValue(initialState))
    },
  })

  Object.defineProperty(store, '$subscribe', {
    enumerable: false,
    configurable: true,
    value: (callback: StoreSubscription, options?: { immediate?: boolean }) => {
      let initialized = false
      const stop = watchEffect(() => {
        const snapshot = cloneValue(stateFacade)
        if (initialized || options?.immediate) {
          callback({ storeId: id }, snapshot)
        }
        initialized = true
      }) as EffectHandle
      stops.add(stop)
      return () => {
        stops.delete(stop)
        stop.dispose()
      }
    },
  })

  Object.defineProperty(store, '$dispose', {
    enumerable: false,
    configurable: true,
    value: () => {
      Array.from(stops).forEach(stop => {
        stop.dispose()
        stops.delete(stop)
      })
      root._s.delete(id)
    },
  })

  root._p.forEach(plugin => {
    applyStorePlugin(root, store, id, plugin)
  })

  return store
}

export function defineStore<TStore extends StoreInstance = StoreInstance>(
  id: string,
  setup: SetupStoreFactory,
): (root?: StoreRoot) => TStore
export function defineStore<TStore extends StoreInstance = StoreInstance>(
  id: string,
  options: DefineStoreOptions,
): (root?: StoreRoot) => TStore
export function defineStore<TStore extends StoreInstance = StoreInstance>(
  id: string,
  input: DefineStoreOptions | SetupStoreFactory,
) {
  const useDefinedStore = (root?: StoreRoot): TStore => {
    const targetRoot = root || useStoreRoot()
    const existing = targetRoot._s.get(id)
    if (existing) {
      return existing as TStore
    }

    const store = createStoreInstance(targetRoot, id, input)
    targetRoot._s.set(id, store)
    return store as TStore
  }

  Object.defineProperty(useDefinedStore, '$id', {
    enumerable: false,
    configurable: true,
    value: id,
  })

  return useDefinedStore
}

export const storeToRefs = <TStore extends StoreInstance>(store: TStore) => {
  const refs = Object.create(null) as Record<string, RefLike>
  Object.keys(store).forEach(key => {
    if (key.startsWith('$')) {
      return
    }

    const descriptor = Object.getOwnPropertyDescriptor(store, key)
    if (!descriptor) {
      return
    }

    if ('value' in descriptor && typeof descriptor.value === 'function') {
      return
    }

    const refValue = Object.create(null) as RefLike
    Object.defineProperty(refValue, 'value', {
      enumerable: true,
      configurable: true,
      get: () => store[key],
      set:
        typeof descriptor.set === 'function'
          ? nextValue => {
              ;(store as Record<string, unknown>)[key] = nextValue
            }
          : undefined,
    })
    refs[key] = refValue
  })
  return refs as {
    [K in keyof TStore as K extends `$${string}`
      ? never
      : TStore[K] extends (...args: any[]) => any
        ? never
        : K]: RefLike<TStore[K]>
  }
}
