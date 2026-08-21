/*
Vapor 运行时辅助概述
- 显隐样式：vaporShowStyle 根据条件生成字符串或对象样式，隐藏时追加或设置 display。
- Keyed 列表渲染：vaporKeyedList 通过注释锚点维护每项 DOM 范围，支持重排、增删和单根优化。
- ref 绑定：vaporBindUseRef 以响应式方式同步函数 ref / 对象 ref，并在卸载时清理。
- Hooks ID：vaporWithHookId 通过 id -> index 映射稳定 hook 槽位，避免重渲染时索引漂移。
*/
import { onBeforeUnmount, renderBetween } from './vapor-runtime'
import {
  effectScope,
  getCurrentInstance,
  signal,
  toRaw,
  untrack,
  watchEffect,
} from '@rue-js/runtime-vapor/reactive'
import {
  addEventListener,
  createComment,
  createDocumentFragment,
  insertBefore,
  appendChild,
  getParentNode,
  removeChild,
  removeEventListener,
  contains,
} from './dom'
import type { DomElementLike, DomNodeLike, DOMEventHandler } from './dom'
import type { BlockFactory, BlockInstance, RenderTarget } from './renderable'

/** 根据条件生成 display 显隐样式，兼容字符串和对象 style。 */
export const vaporShowStyle = (s: any, cond: any) => {
  if (typeof s === 'string') {
    return cond ? s : s + '; display: none'
  }
  if (s && typeof s === 'object') {
    return { ...s, display: cond ? '' : 'none' }
  }
  return { display: cond ? '' : 'none' }
}

/** 为编译产物生成的可挂载值附加稳定 key。 */
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

/** keyed list 中单个条目在 DOM 中的范围和响应式状态。 */
export type VaporListItemRange = {
  /** 多根条目的起始锚点。 */
  start?: DomNodeLike
  /** 条目结束锚点；单根模式下也是尾锚点。 */
  end: DomNodeLike
  /** 停止该条目拥有的响应式 effect。 */
  stop?: () => void
  /** 是否使用单根锚点优化。 */
  singleRoot?: boolean
  /** 当前 item/index 的实时状态。 */
  current?: ReturnType<typeof signal<{ item: any; index: number; rawIdentity: unknown }>>
  /** 驱动结构重渲染的状态。 */
  renderState?: ReturnType<typeof signal<{ item: any; index: number; rawIdentity: unknown }>>
  /** trackIndex=false 时复用的稳定 item proxy。 */
  stableItem?: unknown
  /** primitive 同 key 更新时重建 directRoot 行。 */
  remount?: (item: any, index: number) => void
}

const systemModifierNames = ['ctrl', 'shift', 'alt', 'meta'] as const

const keyModifierAliases: Record<string, string[]> = {
  enter: ['enter'],
  tab: ['tab'],
  delete: ['backspace', 'delete', 'del'],
  esc: ['esc', 'escape'],
  space: [' ', 'space', 'spacebar'],
  up: ['arrowup', 'up'],
  down: ['arrowdown', 'down'],
  left: ['arrowleft', 'left'],
  right: ['arrowright', 'right'],
}

const normalizeEventKey = (value: unknown) => String(value ?? '').toLowerCase()

const isKeyboardEvent = (event: any) =>
  typeof event?.type === 'string' && event.type.startsWith('key')

const matchesMouseButtonModifier = (event: any, modifier: string) => {
  switch (modifier) {
    case 'left':
      return event?.button === 0
    case 'middle':
      return event?.button === 1
    case 'right':
      return event?.button === 2
    default:
      return true
  }
}

const matchesKeyModifier = (event: any, modifier: string) => {
  if (!isKeyboardEvent(event)) {
    return false
  }

  if (/^\d+$/.test(modifier)) {
    const keyCode = Number(modifier)
    return event?.keyCode === keyCode || event?.which === keyCode
  }

  const actual = normalizeEventKey(event?.key)
  const aliases = keyModifierAliases[modifier]
  if (aliases) {
    return aliases.includes(actual)
  }

  return actual === modifier.replace(/_/g, '-').toLowerCase()
}

/** 为事件处理器应用 stop/prevent/self/key/system 等模板修饰符。 */
export const vaporWithEventModifiers = (
  handler: DOMEventHandler,
  modifiers: string[],
): DOMEventHandler => {
  const normalizedModifiers = modifiers.map(modifier => String(modifier).toLowerCase())
  const systemModifiers = new Set(
    normalizedModifiers.filter(modifier => systemModifierNames.includes(modifier as any)),
  )
  const listenerOptions: AddEventListenerOptions = {}

  if (normalizedModifiers.includes('capture')) {
    listenerOptions.capture = true
  }
  if (normalizedModifiers.includes('once')) {
    listenerOptions.once = true
  }
  if (normalizedModifiers.includes('passive')) {
    listenerOptions.passive = true
  }

  const wrapped = ((event: any) => {
    for (const modifier of normalizedModifiers) {
      switch (modifier) {
        case 'stop':
          event?.stopPropagation?.()
          continue
        case 'prevent':
          event?.preventDefault?.()
          continue
        case 'self':
          if (event?.target !== event?.currentTarget) {
            return
          }
          continue
        case 'ctrl':
        case 'shift':
        case 'alt':
        case 'meta':
          if (!event?.[`${modifier}Key`]) {
            return
          }
          continue
        case 'exact':
          if (
            systemModifierNames.some(
              systemKey => !!event?.[`${systemKey}Key`] && !systemModifiers.has(systemKey),
            )
          ) {
            return
          }
          continue
        case 'capture':
        case 'once':
        case 'passive':
        case 'native':
          continue
        case 'left':
        case 'right':
          if (isKeyboardEvent(event)) {
            if (!matchesKeyModifier(event, modifier)) {
              return
            }
            continue
          }
          if (!matchesMouseButtonModifier(event, modifier)) {
            return
          }
          continue
        case 'middle':
          if (!matchesMouseButtonModifier(event, modifier)) {
            return
          }
          continue
        default:
          if (!matchesKeyModifier(event, modifier)) {
            return
          }
      }
    }

    return handler?.(event)
  }) as DOMEventHandler

  if (Object.keys(listenerOptions).length > 0) {
    wrapped.__rue_options = listenerOptions
  }

  return wrapped
}

type VaporNativeEventMap = Record<string, DOMEventHandler>

const isNodeLikeTarget = (value: unknown): value is DomNodeLike =>
  !!value && typeof value === 'object' && 'nodeType' in (value as Record<string, unknown>)

const isTargetInsideRange = (
  parent: DomElementLike,
  start: DomNodeLike,
  end: DomNodeLike,
  target: unknown,
) => {
  if (!isNodeLikeTarget(target) || !contains(parent, target)) {
    return false
  }

  let node = (start as any).nextSibling as DomNodeLike | null
  while (node && node !== end) {
    if (node === target || contains(node, target)) {
      return true
    }
    node = (node as any).nextSibling as DomNodeLike | null
  }

  return false
}

const mountNativeEventRange = (target: RenderTarget) => {
  switch (target.kind) {
    case 'container': {
      const start = createComment('rue:native:start')
      const end = createComment('rue:native:end')
      appendChild(target.container, start)
      appendChild(target.container, end)
      return { parent: target.container, start, end }
    }
    case 'between': {
      const start = createComment('rue:native:start')
      const end = createComment('rue:native:end')
      insertBefore(target.parent, end, target.end)
      insertBefore(target.parent, start, end)
      return { parent: target.parent, start, end }
    }
    case 'anchor':
    case 'static': {
      const start = createComment('rue:native:start')
      const end = createComment('rue:native:end')
      insertBefore(target.parent, end, target.anchor)
      insertBefore(target.parent, start, end)
      return { parent: target.parent, start, end }
    }
  }
}

/** 把 native 事件委托到一段 block 渲染范围上。 */
export const vaporWithNativeEvents = <T>(
  value: T,
  nativeEvents: VaporNativeEventMap,
): BlockFactory => {
  const factory = (() => {
    let parent: DomElementLike | null = null
    let start: DomNodeLike | null = null
    let end: DomNodeLike | null = null
    const delegatedListeners: Array<[string, DOMEventHandler]> = []

    const block: BlockInstance = {
      kind: 'block',
      mount(target) {
        const mounted = mountNativeEventRange(target)
        parent = mounted.parent
        start = mounted.start
        end = mounted.end

        renderBetween(value as any, parent, start, end)

        for (const [eventName, listener] of Object.entries(nativeEvents)) {
          const delegated = ((event: any) => {
            if (!parent || !start || !end) {
              return
            }
            if (!isTargetInsideRange(parent, start, end, event?.target)) {
              return
            }
            return listener(event)
          }) as DOMEventHandler

          delegated.__rue_options = listener.__rue_options
          delegatedListeners.push([eventName, delegated])
          addEventListener(parent, eventName, delegated)
        }
      },
      unmount() {
        if (!parent || !start || !end) {
          return
        }

        for (const [eventName, listener] of delegatedListeners.splice(0)) {
          removeEventListener(parent, eventName, listener)
        }

        if (getParentNode(start) === parent && getParentNode(end) === parent) {
          renderBetween(null, parent, start, end)
          if (contains(parent, start)) {
            removeChild(parent, start)
          }
          if (contains(parent, end)) {
            removeChild(parent, end)
          }
        }

        parent = null
        start = null
        end = null
      },
    }

    return block
  }) as unknown as BlockFactory

  ;(factory as unknown as { kind: 'block-factory' }).kind = 'block-factory'
  return factory
}

/** 基于 key 维护 Vapor 列表 DOM 范围，支持重排、增删和单根优化。 */
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
  /** renderItem 是否直接挂载行根，不注册内层 renderAnchor。 */
  directRoot?: boolean
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
    directRoot = false,
  } = args
  const nextElements = new Map<any, VaporListItemRange>()
  const syncEffectOptions = {
    scheduler: (run: () => void) => run(),
  }
  const oldIndexByKey = new Map<any, number>()
  let oldIndex = 0
  elements.forEach((_range, key) => {
    oldIndexByKey.set(key, oldIndex)
    oldIndex += 1
  })
  const nextKeys = items.map((item, index) => getKey(item, index))
  const reusedEntries: Array<{ key: any; oldIndex: number }> = []
  const seenOldIndexes = new Set<number>()

  nextKeys.forEach(key => {
    const oldIndex = oldIndexByKey.get(key)
    if (oldIndex === undefined || seenOldIndexes.has(oldIndex)) {
      return
    }

    seenOldIndexes.add(oldIndex)
    reusedEntries.push({ key, oldIndex })
  })

  const stableKeys = new Set<any>()
  if (reusedEntries.length <= 1) {
    reusedEntries.forEach(entry => stableKeys.add(entry.key))
  } else {
    const predecessors: Array<number | undefined> = Array.from(
      { length: reusedEntries.length },
      () => undefined,
    )
    const tails: number[] = []

    reusedEntries.forEach((entry, index) => {
      let low = 0
      let high = tails.length
      while (low < high) {
        const mid = Math.floor((low + high) / 2)
        if (reusedEntries[tails[mid]].oldIndex < entry.oldIndex) {
          low = mid + 1
        } else {
          high = mid
        }
      }

      if (low > 0) {
        predecessors[index] = tails[low - 1]
      }

      if (low === tails.length) {
        tails.push(index)
      } else {
        tails[low] = index
      }
    })

    let stableIndex: number | undefined = tails[tails.length - 1]
    while (stableIndex !== undefined) {
      stableKeys.add(reusedEntries[stableIndex].key)
      stableIndex = predecessors[stableIndex]
    }
  }

  const resolveTargetParent = () => {
    if (parent) {
      return parent as DomNodeLike
    }
    const beforeParent = before ? getParentNode(before as DomNodeLike) : null
    if (beforeParent) {
      return beforeParent
    }
    const startParent = listStart ? getParentNode(listStart as DomNodeLike) : null
    if (startParent) {
      return startParent
    }

    for (const range of elements.values()) {
      const rangeParent =
        (range.start ? getParentNode(range.start) : null) ?? getParentNode(range.end)
      if (rangeParent) {
        return rangeParent
      }
    }

    return null
  }

  const targetParent = resolveTargetParent()

  if (!targetParent) {
    return elements
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
      if (!trackIndex && isObjectLike(nextItem)) {
        range.stableItem = createStableItemProxy(range.current)
      }

      if (range.singleRoot && range.stableItem) {
        return undefined
      }

      range.renderState = signal(
        { item: nextItem, index: nextIndex, rawIdentity: nextRawIdentity },
        {},
        true,
      )
      return range.renderState
    }

    const prev = untrack(() => range.current!.get())
    const rawChanged = prev.rawIdentity !== nextRawIdentity
    const indexChanged = prev.index !== nextIndex
    if (rawChanged || indexChanged) {
      range.current.set({ item: nextItem, index: nextIndex, rawIdentity: nextRawIdentity })
    }

    if (range.singleRoot && range.stableItem && isObjectLike(nextItem)) {
      return undefined
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

  const mountDirectRootRange = (
    entry: VaporListItemRange,
    item: T,
    index: number,
    itemParent: DomNodeLike,
    end: DomNodeLike,
  ) => {
    const mount = (nextItem: T, nextIndex: number) => {
      const scope = effectScope()
      scope.run(() => {
        untrack(() => {
          renderItem(
            (entry.stableItem as T | undefined) ?? nextItem,
            itemParent as any,
            end,
            end,
            nextIndex,
          )
        })
      })
      entry.stop = () => scope.stop()
    }

    entry.remount = (nextItem, nextIndex) => {
      entry.stop?.()
      const previousRoot = (end as any).previousSibling as DomNodeLike | null
      if (previousRoot && contains(itemParent, previousRoot) && !isListMarker(previousRoot)) {
        removeChild(itemParent, previousRoot)
      }
      mount(nextItem, nextIndex)
    }
    mount(item, index)
  }

  // 空列表的安全直挂行先在各自的小 Fragment 中 O(1) 组装，
  // 再顺序 append 到一个批量 Fragment。这样既避免在不断增长的
  // child list 中逐行查找尾锚点，又使真实父节点只发生一次插入。
  if (
    elements.size === 0 &&
    items.length > 0 &&
    singleRoot &&
    !trackIndex &&
    directRoot &&
    items.every(isObjectLike)
  ) {
    const batch = createDocumentFragment()

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index]
      const key = nextKeys[index]
      const itemParent = createDocumentFragment()
      const end = createComment('rue:list:item:anchor')
      appendChild(itemParent, end)

      const entry: VaporListItemRange = { end, singleRoot: true }
      syncCurrentItem(entry, item, index)
      const scope = effectScope()
      scope.run(() => {
        untrack(() => {
          renderItem(entry.stableItem as T, itemParent as any, end, end, index)
        })
      })
      entry.stop = () => scope.stop()
      appendChild(batch, itemParent)
      nextElements.set(key, entry)
    }

    if (before && contains(targetParent, before as any)) {
      insertBefore(targetParent, batch, before as any)
    } else {
      appendChild(targetParent, batch)
    }

    elements.clear()
    nextKeys.forEach(key => {
      const range = nextElements.get(key)
      if (range) {
        elements.set(key, range)
      }
    })
    return elements
  }

  const resolveStartNode = (range: VaporListItemRange) => {
    if (!range.singleRoot) {
      return range.start as DomNodeLike
    }
    const head = ((range.end as any).previousSibling as DomNodeLike | null) || null
    return head && contains(targetParent as any, head as any) && !isListMarker(head)
      ? head
      : range.end
  }

  let cursor: DomNodeLike | null = before as any

  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index]
    const key = nextKeys[index]
    let range = elements.get(key)
    const existingRange = range
    let start: DomNodeLike
    let end: DomNodeLike

    if (!range) {
      if (singleRoot) {
        end = createComment('rue:list:item:anchor')
        insertBefore(targetParent, end, cursor as any)
        const entry: VaporListItemRange = { end, singleRoot: true }
        const renderState = syncCurrentItem(entry, item, index)
        if (directRoot) {
          mountDirectRootRange(entry, item, index, targetParent, end)
        } else if (renderState) {
          const stop = watchEffect(() => {
            const next = renderState.get()
            untrack(() => {
              renderItem(
                (entry.stableItem as T | undefined) ?? next.item,
                targetParent as any,
                end,
                end,
                next.index,
              )
            })
          }, syncEffectOptions)
          entry.stop = () => stop.dispose()
        } else {
          const scope = effectScope()
          scope.run(() => {
            untrack(() => {
              renderItem(entry.stableItem as T, targetParent as any, end, end, index)
            })
          })
          entry.stop = () => scope.stop()
        }
        range = entry
      } else {
        start = createComment('rue:list:item:start')
        end = createComment('rue:list:item:end')
        insertBefore(targetParent, end, cursor as any)
        insertBefore(targetParent, start, end)
        const entry: VaporListItemRange = { start, end }
        const renderState = syncCurrentItem(entry, item, index)!
        const stop = watchEffect(() => {
          const next = renderState.get()
          untrack(() => {
            renderItem(
              (entry.stableItem as T | undefined) ?? next.item,
              targetParent as any,
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
      const previous = range.current ? untrack(() => range!.current!.get()) : undefined
      const shouldRemountDirectRoot =
        directRoot &&
        range.singleRoot &&
        !range.stableItem &&
        !!range.remount &&
        !!previous &&
        (previous.rawIdentity !== getRawIdentity(item) || (trackIndex && previous.index !== index))
      syncCurrentItem(range, item, index)
      if (shouldRemountDirectRoot) {
        range.remount!(item, index)
      }
      end = range.end
    }

    const blockStart = resolveStartNode(range)
    const shouldKeepStablePlacement =
      !!existingRange &&
      stableKeys.has(key) &&
      contains(targetParent as any, blockStart as any) &&
      contains(targetParent as any, end as any)
    if (
      !shouldKeepStablePlacement &&
      (end as any).nextSibling !== cursor &&
      cursor !== blockStart
    ) {
      const block = createDocumentFragment()
      let node: DomNodeLike | null = blockStart
      while (node) {
        const next: DomNodeLike | null = (node as any).nextSibling
        appendChild(block, node)
        if (node === end) break
        node = next
      }
      const cursorIsChild = !!cursor && contains(targetParent, cursor as any)
      if (cursorIsChild) insertBefore(targetParent, block, cursor as any)
      else appendChild(targetParent, block)
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
        if (contains(targetParent as any, staleNode as any)) {
          removeChild(targetParent as any, staleNode as any)
        }
      }
    }
  })
  elements.clear()
  nextKeys.forEach(key => {
    const range = nextElements.get(key)
    if (range) {
      elements.set(key, range)
    }
  })
  return elements
}

/** 反应式绑定 useRef 结果，支持函数 ref 和对象 ref。 */
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

/** 以稳定 hook id 执行 runner，避免编译产物重排时 hook 槽位漂移。 */
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
