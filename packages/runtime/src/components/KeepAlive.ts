/*
KeepAlive 组件概述
- 使用场景：缓存动态切换的直接子组件，切走时移动 DOM range 到离线片段而不是卸载。
- 身份策略：优先使用直接子节点的 key 作为缓存 key；当前 mount-handle 协议只稳定暴露 key。
- 缓存策略：支持 include/exclude 匹配名称（当前等同显式 key 字符串）和 max LRU 淘汰。
- 容器策略：使用 display: contents 容器与每个缓存项独立的起止注释锚点，不额外产生布局盒。
*/

import {
  type FC,
  onBeforeUnmount,
  onMounted,
  type PropsWithChildren,
  renderBetween,
  vapor,
} from '../rue'
import {
  appendChild,
  createComment,
  createDocumentFragment,
  createElement,
  getParentNode,
  insertBefore,
  removeChild,
  setStyle,
} from '../dom'
import type { DomElementLike, DomNodeLike } from '../dom'
import { signal, watchEffect } from '../reactivity'
import { useSetup } from '@rue-js/runtime-vapor/reactive'

export type KeepAliveMatchPattern = string | RegExp | Array<string | RegExp>

export interface KeepAliveProps extends PropsWithChildren<Record<string, unknown>> {
  include?: KeepAliveMatchPattern
  exclude?: KeepAliveMatchPattern
  max?: number | string
}

type KeepAliveChildInput = Parameters<typeof renderBetween>[0]

type CacheEntry = {
  key: unknown
  name?: string
  start: DomNodeLike
  end: DomNodeLike
  cacheable: boolean
  disposed: boolean
  justActivated: boolean
}

type ChildDescriptor = {
  child: KeepAliveChildInput
  key: unknown
  name?: string
}

const DEFAULT_CACHE_KEY = Symbol('rue-keep-alive-default')
const RUE_MOUNT_ID_KEY = '__rue_mount_id'

const cloneRenderable = (value: unknown): unknown =>
  Array.isArray(value) ? value.map(cloneRenderable) : value

const snapshotKeepAliveProps = (props: KeepAliveProps): KeepAliveProps => ({
  ...(props as Record<string, unknown>),
  children: cloneRenderable(props.children) as KeepAliveProps['children'],
})

const pushFlattenedChildren = (value: unknown, target: unknown[]) => {
  if (Array.isArray(value)) {
    for (const child of value) {
      pushFlattenedChildren(child, target)
    }
    return
  }

  if (value == null || typeof value === 'boolean') {
    return
  }

  target.push(value)
}

const getSingleChild = (children: KeepAliveProps['children']): KeepAliveChildInput | null => {
  const flattened: unknown[] = []
  pushFlattenedChildren(children, flattened)
  return (flattened[0] ?? null) as KeepAliveChildInput | null
}

const readObjectValue = (value: unknown, key: string): unknown => {
  if ((typeof value !== 'object' && typeof value !== 'function') || value == null) {
    return undefined
  }

  try {
    return (value as Record<string, unknown>)[key]
  } catch {
    return undefined
  }
}

const normalizeName = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.length > 0) {
    return value
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return undefined
}

const getExplicitKey = (child: unknown): unknown => {
  const directKey = readObjectValue(child, 'key')
  if (directKey != null) {
    return directKey
  }

  const propsKey = readObjectValue(readObjectValue(child, 'props'), 'key')
  return propsKey == null ? undefined : propsKey
}

const resolveChildDescriptor = (child: KeepAliveChildInput): ChildDescriptor => {
  const explicitKey = getExplicitKey(child)
  const key = explicitKey ?? DEFAULT_CACHE_KEY
  const name =
    normalizeName(explicitKey) ??
    normalizeName(readObjectValue(child, 'name')) ??
    normalizeName(readObjectValue(child, RUE_MOUNT_ID_KEY))

  return {
    child,
    key,
    name,
  }
}

const matchesPattern = (
  pattern: KeepAliveMatchPattern | undefined,
  name: string | undefined,
): boolean => {
  if (pattern == null || !name) {
    return false
  }

  if (Array.isArray(pattern)) {
    return pattern.some(item => matchesPattern(item, name))
  }

  if (typeof pattern === 'string') {
    return pattern
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
      .includes(name)
  }

  pattern.lastIndex = 0
  return pattern.test(name)
}

const normalizeMax = (max: KeepAliveProps['max']) => {
  if (max == null || max === '') {
    return Infinity
  }

  const value = Number(max)
  if (!Number.isFinite(value)) {
    return Infinity
  }

  return Math.max(0, Math.floor(value))
}

const shouldCache = (descriptor: ChildDescriptor, props: KeepAliveProps) => {
  if (normalizeMax(props.max) === 0) {
    return false
  }
  if (props.include != null && !matchesPattern(props.include, descriptor.name)) {
    return false
  }
  if (matchesPattern(props.exclude, descriptor.name)) {
    return false
  }
  return true
}

const isSameKey = (left: unknown, right: unknown) => Object.is(left, right)

const createKeepAliveContainer = () => {
  const container = createElement('span') as DomElementLike
  setStyle(container, { display: 'contents' })
  return container
}

const removeEntryAnchors = (entry: CacheEntry) => {
  const startParent = getParentNode(entry.start)
  if (startParent) {
    removeChild(startParent, entry.start)
  }

  const endParent = getParentNode(entry.end)
  if (endParent) {
    removeChild(endParent, entry.end)
  }
}

export const KeepAlive: FC<KeepAliveProps> = props => {
  const ctx = useSetup(() => {
    const container = createKeepAliveContainer()

    const start = createComment('rue-keep-alive-start')
    const end = createComment('rue-keep-alive-end')

    appendChild(container, start)
    appendChild(container, end)

    return {
      container,
      start,
      end,
      storage: createDocumentFragment() as DomElementLike,
      propsSig: signal(snapshotKeepAliveProps(props), {}, true),
      cache: new Map<unknown, CacheEntry>(),
      activeEntry: null as CacheEntry | null,
      effect: null as ReturnType<typeof watchEffect> | null,
    }
  })

  const getActiveParent = () => (getParentNode(ctx.end) as DomElementLike | null) ?? ctx.container

  const moveRange = (entry: CacheEntry, target: DomNodeLike, before: DomNodeLike | null) => {
    if (entry.disposed) {
      return
    }

    const currentParent = getParentNode(entry.start)
    if (!currentParent) {
      return
    }

    const block = createDocumentFragment()
    let node: DomNodeLike | null = entry.start

    while (node) {
      const next: DomNodeLike | null = node.nextSibling ?? null
      appendChild(block, node)
      if (node === entry.end) {
        break
      }
      node = next
    }

    insertBefore(target, block, before)
  }

  const prepareContainerForRender = () => {
    const nextContainer = createKeepAliveContainer()

    appendChild(nextContainer, ctx.start)
    if (
      ctx.activeEntry &&
      !ctx.activeEntry.disposed &&
      getParentNode(ctx.activeEntry.start) !== ctx.storage
    ) {
      moveRange(ctx.activeEntry, nextContainer, null)
    }
    appendChild(nextContainer, ctx.end)

    ctx.container = nextContainer
  }

  const moveEntryToStorage = (entry: CacheEntry) => {
    if (getParentNode(entry.start) !== ctx.storage) {
      moveRange(entry, ctx.storage, null)
    }
  }

  const createEntry = (descriptor: ChildDescriptor, cacheable: boolean): CacheEntry => {
    const parent = getActiveParent()
    const start = createComment(`rue-keep-alive-item:${descriptor.name ?? 'anonymous'}:start`)
    const end = createComment(`rue-keep-alive-item:${descriptor.name ?? 'anonymous'}:end`)

    insertBefore(parent, start, ctx.end)
    insertBefore(parent, end, ctx.end)

    return {
      key: descriptor.key,
      name: descriptor.name,
      start,
      end,
      cacheable,
      disposed: false,
      justActivated: false,
    }
  }

  const renderEntry = (entry: CacheEntry, child: KeepAliveChildInput) => {
    const parent = (getParentNode(entry.start) as DomElementLike | null) ?? getActiveParent()
    renderBetween(child, parent, entry.start, entry.end)
  }

  const unmountEntry = (entry: CacheEntry) => {
    if (entry.disposed) {
      return
    }

    moveEntryToStorage(entry)
    entry.disposed = true

    const parent = getParentNode(entry.start) as DomElementLike | null
    if (parent && getParentNode(entry.end) === parent) {
      renderBetween(null as any, parent, entry.start, entry.end)
      queueMicrotask(() => {
        queueMicrotask(() => {
          removeEntryAnchors(entry)
        })
      })
    }
  }

  const deactivateEntry = (entry: CacheEntry) => {
    if (entry.cacheable && !entry.disposed) {
      moveEntryToStorage(entry)
      return
    }

    unmountEntry(entry)
  }

  const activateEntry = (entry: CacheEntry) => {
    if (entry.disposed) {
      return
    }

    moveRange(entry, getActiveParent(), ctx.end)
    entry.justActivated = true
  }

  const touchEntry = (entry: CacheEntry) => {
    if (!entry.cacheable || !ctx.cache.has(entry.key)) {
      return
    }

    ctx.cache.delete(entry.key)
    ctx.cache.set(entry.key, entry)
  }

  const pruneOldestEntries = (max: number) => {
    while (ctx.cache.size > max) {
      const oldest = ctx.cache.keys().next().value
      const entry = ctx.cache.get(oldest)
      if (!entry) {
        ctx.cache.delete(oldest)
        continue
      }

      if (ctx.activeEntry === entry && ctx.cache.size === 1) {
        entry.cacheable = false
        ctx.cache.delete(oldest)
        break
      }

      if (ctx.activeEntry === entry) {
        touchEntry(entry)
        continue
      }

      ctx.cache.delete(oldest)
      unmountEntry(entry)
    }
  }

  const pruneByPattern = (curProps: KeepAliveProps) => {
    for (const [key, entry] of Array.from(ctx.cache.entries())) {
      const descriptor = {
        child: null as any,
        key: entry.key,
        name: entry.name,
      }

      if (shouldCache(descriptor, curProps)) {
        continue
      }

      ctx.cache.delete(key)
      entry.cacheable = false
      if (ctx.activeEntry !== entry) {
        unmountEntry(entry)
      }
    }
  }

  const reconcile = (curProps: KeepAliveProps) => {
    pruneByPattern(curProps)

    const child = getSingleChild(curProps.children)
    if (!child) {
      if (ctx.activeEntry) {
        deactivateEntry(ctx.activeEntry)
        ctx.activeEntry = null
      }
      return
    }

    const descriptor = resolveChildDescriptor(child)
    const cacheable = shouldCache(descriptor, curProps)
    const max = normalizeMax(curProps.max)

    if (ctx.activeEntry && isSameKey(ctx.activeEntry.key, descriptor.key)) {
      const entry = ctx.activeEntry
      entry.name = descriptor.name
      entry.cacheable = cacheable

      if (cacheable) {
        ctx.cache.set(entry.key, entry)
        touchEntry(entry)
      } else {
        ctx.cache.delete(entry.key)
      }

      activateEntry(entry)
      if (entry.justActivated) {
        entry.justActivated = false
      } else {
        renderEntry(entry, descriptor.child)
      }
      pruneOldestEntries(max)
      return
    }

    if (ctx.activeEntry) {
      deactivateEntry(ctx.activeEntry)
      ctx.activeEntry = null
    }

    let nextEntry = cacheable ? ctx.cache.get(descriptor.key) : undefined

    if (nextEntry?.disposed) {
      ctx.cache.delete(descriptor.key)
      nextEntry = undefined
    }

    const reusedCachedEntry = !!nextEntry

    if (nextEntry) {
      nextEntry.name = descriptor.name
      nextEntry.cacheable = true
      activateEntry(nextEntry)
      touchEntry(nextEntry)
    } else {
      nextEntry = createEntry(descriptor, cacheable)
      if (cacheable) {
        ctx.cache.set(descriptor.key, nextEntry)
        touchEntry(nextEntry)
      }
    }

    ctx.activeEntry = nextEntry
    if (!reusedCachedEntry) {
      renderEntry(nextEntry, descriptor.child)
    }
    pruneOldestEntries(max)
  }

  onMounted(() => {
    if (ctx.effect) {
      return
    }

    ctx.effect = watchEffect(() => {
      reconcile(ctx.propsSig.get())
    })
  })

  onBeforeUnmount(() => {
    ctx.effect?.dispose()
    ctx.effect = null

    const entries = new Set<CacheEntry>(ctx.cache.values())
    if (ctx.activeEntry) {
      entries.add(ctx.activeEntry)
      ctx.activeEntry = null
    }

    ctx.cache.clear()
    for (const entry of entries) {
      unmountEntry(entry)
    }
  })

  return vapor(() => {
    prepareContainerForRender()
    ctx.propsSig.set(snapshotKeepAliveProps(props))
    return ctx.container as any
  })
}
