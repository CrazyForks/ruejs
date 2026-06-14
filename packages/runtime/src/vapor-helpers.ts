/*
Vapor 运行时辅助概述
- 显隐样式：vaporShowStyle 根据条件生成字符串或对象样式，隐藏时追加或设置 display。
- Keyed 列表渲染：vaporKeyedList 通过注释锚点维护每项 DOM 范围，支持重排、增删和单根优化。
- ref 绑定：vaporBindUseRef 以响应式方式同步函数 ref / 对象 ref，并在卸载时清理。
- Hooks ID：vaporWithHookId 通过 id -> index 映射稳定 hook 槽位，避免重渲染时索引漂移。
*/
import { onBeforeUnmount } from './rue'
import { signal, toRaw, untrack, watchEffect } from './reactivity'
import { getCurrentInstance } from '@rue-js/runtime-vapor/reactive'
import {
  createComment,
  createDocumentFragment,
  insertBefore,
  appendChild,
  removeChild,
  contains,
} from './dom'
import type { DomNodeLike } from './dom'

/** 根据条件生成 display 显隐样式
 * 支持字符串 style 与对象 style 的输入。
 */
export const vaporShowStyle = (s: any, cond: any) => {
  if (typeof s === 'string') {
    return cond ? s : s + '; display: none'
  }
  if (s && typeof s === 'object') {
    return { ...s, display: cond ? '' : 'none' }
  }
  return { display: cond ? '' : 'none' }
}

/** 为编译产物生成的可挂载值附加稳定 key，供 TransitionGroup 等读取 */
export const vaporWithKey = <T>(value: T, key: unknown): T => {
  if (key == null) {
    return value
  }
  if ((typeof value !== 'object' && typeof value !== 'function') || value == null) {
    return value
  }
  try {
    ;(value as any).key = key
  } catch {}
  return value
}

/** 列表项在 DOM 中的范围定义 */
export type VaporListItemRange = {
  /** 多根条目的起始锚点。 */
  start?: DomNodeLike
  /** 条目结束锚点；单根模式下也是尾锚点。 */
  end: DomNodeLike
  /** 停止该条目 render effect 的清理函数。 */
  stop?: () => void
  /** 是否使用单根锚点优化。 */
  singleRoot?: boolean
  /** 当前 item/index 的实时状态。 */
  current?: ReturnType<typeof signal<{ item: any; index: number; rawIdentity: unknown }>>
  /** 驱动结构重渲染的状态。 */
  renderState?: ReturnType<typeof signal<{ item: any; index: number; rawIdentity: unknown }>>
  /** trackIndex=false 时复用的稳定 item proxy。 */
  stableItem?: unknown
}

/** 基于 Key 的列表渲染与重排 */
export const vaporKeyedList = <T>(args: {
  /** 当前列表数据。 */
  items: T[]
  /** 从 item/index 计算稳定 key 的函数。 */
  getKey: (item: T, index: number) => any
  /** 上一次渲染留下的 key -> DOM 范围表，会被原地更新。 */
  elements: Map<any, VaporListItemRange>
  /** 列表所在父节点。 */
  parent: any
  /** 整个列表的尾锚点或插入参照节点。 */
  before: any
  /** 列表起始锚点，用于识别范围边界。 */
  start?: any
  /** 是否使用单根条目优化。 */
  singleRoot?: boolean
  /** 是否把 index 变化视为需要刷新结构。 */
  trackIndex?: boolean
  /** 渲染单个条目的回调。 */
  renderItem: (item: T, parent: any, start: any, end: any, idx?: number) => void
}) => {
  const {
    items,
    getKey,
    elements,
    parent,
    before,
    start: listStart,
    renderItem,
    singleRoot = false,
    trackIndex = true,
  } = args
  const nextElements = new Map<any, VaporListItemRange>()
  const syncEffectOptions = {
    scheduler: (run: () => void) => run(),
  }

  const isListMarker = (node: DomNodeLike | null | undefined) => {
    if (!node) {
      return false
    }
    if (listStart && node === listStart) {
      return true
    }
    if ((node as any).nodeType !== 8) {
      return false
    }
    const marker = String((node as any).data ?? (node as any).nodeValue ?? '')
    return marker.startsWith('rue:list:')
  }

  const isObjectLike = (value: unknown) =>
    (typeof value === 'object' || typeof value === 'function') && value != null

  const getRawIdentity = (value: T) => {
    if (!isObjectLike(value)) {
      return value
    }

    const seen = new Set<unknown>()
    let current: unknown = value

    while (isObjectLike(current) && !seen.has(current)) {
      seen.add(current)

      let next = current

      try {
        const raw = untrack(() => toRaw(current as any))
        if (raw !== undefined && raw !== current) {
          next = raw
        }
      } catch {}

      if (next === current) {
        try {
          const raw = (current as any).__rue_raw__
          if (raw !== undefined && raw !== current) {
            next = raw
          }
        } catch {}
      }

      if (next === current) {
        break
      }

      current = next
    }

    return current
  }

  const createStableItemProxy = (
    current: ReturnType<typeof signal<{ item: T; index: number; rawIdentity: unknown }>>,
  ) => {
    const readCurrentItem = () => current.get().item as any
    const readCurrentItemRaw = () => {
      const item = readCurrentItem()
      if (isObjectLike(item)) {
        try {
          const raw = (item as { __rue_raw__?: unknown }).__rue_raw__
          if (raw !== undefined) {
            return raw
          }
        } catch {}
      }
      return item
    }

    return new Proxy(Object.create(null), {
      get(_target, key) {
        const item = readCurrentItem()
        const value = item?.[key as keyof typeof item]
        if (typeof value === 'function') {
          try {
            return value.bind(item)
          } catch {}
        }
        return value
      },
      set(_target, key, value) {
        const item = readCurrentItem()
        if (!isObjectLike(item)) {
          return false
        }
        ;(item as Record<PropertyKey, unknown>)[key] = value
        return true
      },
      has(_target, key) {
        const raw = readCurrentItemRaw()
        return isObjectLike(raw) && key in raw
      },
      ownKeys() {
        const raw = readCurrentItemRaw()
        return isObjectLike(raw) ? Reflect.ownKeys(raw) : []
      },
      getOwnPropertyDescriptor(_target, key) {
        const raw = readCurrentItemRaw()
        if (!isObjectLike(raw)) {
          return undefined
        }
        const descriptor = Reflect.getOwnPropertyDescriptor(raw, key)
        if (descriptor) {
          return {
            ...descriptor,
            configurable: true,
          }
        }
        return {
          configurable: true,
          enumerable: true,
          writable: true,
          value: raw[key as keyof typeof raw],
        }
      },
    })
  }

  const syncCurrentItem = (range: VaporListItemRange, nextItem: T, nextIndex: number) => {
    const nextRawIdentity = getRawIdentity(nextItem)

    if (!range.current) {
      range.current = signal(
        { item: nextItem, index: nextIndex, rawIdentity: nextRawIdentity },
        {},
        true,
      )
      range.renderState = signal(
        { item: nextItem, index: nextIndex, rawIdentity: nextRawIdentity },
        {},
        true,
      )
      if (!trackIndex && isObjectLike(nextItem)) {
        range.stableItem = createStableItemProxy(range.current)
      }
      return range.renderState
    }

    const prev = untrack(() => range.current!.get())
    const rawChanged = prev.rawIdentity !== nextRawIdentity
    const indexChanged = prev.index !== nextIndex
    if (rawChanged || indexChanged) {
      range.current.set({ item: nextItem, index: nextIndex, rawIdentity: nextRawIdentity })
    }

    if (!range.renderState) {
      range.renderState = signal(
        { item: nextItem, index: nextIndex, rawIdentity: nextRawIdentity },
        {},
        true,
      )
    }

    const prevRender = untrack(() => range.renderState!.get())
    const shouldRefreshStructure =
      prevRender.rawIdentity !== nextRawIdentity && !(range.stableItem && isObjectLike(nextItem))

    if (shouldRefreshStructure || (trackIndex && indexChanged)) {
      range.renderState.set({ item: nextItem, index: nextIndex, rawIdentity: nextRawIdentity })
    }

    return range.renderState
  }

  const resolveStartNode = (range: VaporListItemRange) => {
    if (!range.singleRoot) {
      return range.start as DomNodeLike
    }
    const head = ((range.end as any).previousSibling as DomNodeLike | null) || null
    return head && contains(parent as any, head as any) && !isListMarker(head) ? head : range.end
  }

  let cursor: DomNodeLike | null = before as any

  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index]
    const key = getKey(item, index)
    let range = elements.get(key)
    let start: DomNodeLike
    let end: DomNodeLike

    if (!range) {
      if (singleRoot) {
        end = createComment('rue:list:item:anchor')
        insertBefore(parent, end, cursor as any)
        const entry: VaporListItemRange = { end, singleRoot: true }
        const renderState = syncCurrentItem(entry, item, index)
        const stop = watchEffect(() => {
          const next = renderState.get()
          untrack(() => {
            renderItem(
              (entry.stableItem as T | undefined) ?? next.item,
              parent as any,
              end,
              end,
              next.index,
            )
          })
        }, syncEffectOptions)
        entry.stop = () => stop.dispose()
        range = entry
      } else {
        start = createComment('rue:list:item:start')
        end = createComment('rue:list:item:end')
        insertBefore(parent, end, cursor as any)
        insertBefore(parent, start, end)
        const entry: VaporListItemRange = { start, end }
        const renderState = syncCurrentItem(entry, item, index)
        const stop = watchEffect(() => {
          const next = renderState.get()
          untrack(() => {
            renderItem(
              (entry.stableItem as T | undefined) ?? next.item,
              parent as any,
              start,
              end,
              next.index,
            )
          })
        }, syncEffectOptions)
        entry.stop = () => stop.dispose()
        range = entry
      }
    } else {
      syncCurrentItem(range, item, index)
      end = range.end
    }

    const blockStart = resolveStartNode(range)

    if ((end as any).nextSibling !== cursor && cursor !== blockStart) {
      const block = createDocumentFragment()
      let node: DomNodeLike | null = blockStart
      while (node) {
        const next: DomNodeLike | null = (node as any).nextSibling
        appendChild(block, node)
        if (node === end) break
        node = next
      }
      const cursorIsChild = !!cursor && contains(parent, cursor as any)
      if (cursorIsChild) insertBefore(parent, block, cursor as any)
      else appendChild(parent, block)
    }

    nextElements.set(key, range!)
    cursor = blockStart
  }

  elements.forEach((range, key) => {
    if (!nextElements.has(key)) {
      const nodesToRemove: DomNodeLike[] = []
      const removeStart = resolveStartNode(range)
      let node: DomNodeLike | null = removeStart
      while (node) {
        nodesToRemove.push(node)
        if (node === range.end) break
        node = ((node as any).nextSibling as DomNodeLike | null) || null
      }

      if (range.stop) range.stop()

      for (const staleNode of nodesToRemove) {
        if (contains(parent as any, staleNode as any)) {
          removeChild(parent as any, staleNode as any)
        }
      }
    }
  })
  elements.clear()
  nextElements.forEach((range, key) => elements.set(key, range))
  return elements
}

/** 反应式绑定 ref：支持函数 ref 与对象 ref */
export const vaporBindUseRef = (el: any, getRef: () => any) => {
  let prev: any
  const stop = watchEffect(() => {
    const refValue = getRef()
    const prevRef = prev
    if (prevRef && prevRef !== refValue) {
      if (typeof prevRef === 'function') {
        prevRef(null)
      } else if (typeof prevRef === 'object' && 'current' in prevRef) {
        ;(prevRef as any).current = undefined
      }
    }
    if (typeof refValue === 'function') {
      refValue(el)
    } else if (typeof refValue === 'object' && 'current' in refValue) {
      ;(refValue as any).current = el
    }
    prev = refValue
  })
  onBeforeUnmount(() => {
    const prevRef = prev
    if (prevRef) {
      if (typeof prevRef === 'function') {
        prevRef(null)
      } else if (typeof prevRef === 'object' && 'current' in prevRef) {
        ;(prevRef as any).current = undefined
      }
    }
  })
  return stop
}

/** 以给定 Hook ID 强制 hooks 的执行索引 */
export function vaporWithHookId<T>(id: string, runner: () => T): T {
  const instance = getCurrentInstance() as any
  if (!instance) return runner()
  const hooks = instance.__hooks || (instance.__hooks = { states: [], index: 0 })
  const hookIndex = typeof hooks.index === 'number' ? hooks.index : 0
  const lastHookIndex = (hooks as any).__lastVaporHookIndex as number | undefined
  if (lastHookIndex === undefined || hookIndex < lastHookIndex) {
    ;(hooks as any).__idCursor = new Map<string, number>()
  }

  const map: Map<string, number[]> =
    (hooks as any).__idMap || ((hooks as any).__idMap = new Map<string, number[]>())
  const cursor: Map<string, number> =
    (hooks as any).__idCursor || ((hooks as any).__idCursor = new Map<string, number>())
  const seen = cursor.get(id) ?? 0
  const slots = map.get(id) ?? []

  let index = slots[seen]
  if (index === undefined) {
    index = (hooks.states?.length as number) ?? 0
    slots.push(index)
    map.set(id, slots)
  }

  cursor.set(id, seen + 1)
  ;(hooks as any).__lastVaporHookIndex = hookIndex
  ;(hooks as any).__forcedIndex = index
  try {
    return runner()
  } finally {
    ;(hooks as any).__forcedIndex = undefined
    ;(hooks as any).__lastVaporHookIndex = typeof hooks.index === 'number' ? hooks.index : hookIndex
  }
}
