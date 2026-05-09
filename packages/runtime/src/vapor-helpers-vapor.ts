/*
Vapor 运行时辅助概述
- 显隐样式：vaporShowStyle 根据条件生成字符串或对象样式，隐藏时追加或设置 display。
- Keyed 列表渲染：vaporKeyedList 通过注释锚点维护每项 DOM 范围，支持重排、增删和单根优化。
- ref 绑定：vaporBindUseRef 以响应式方式同步函数 ref / 对象 ref，并在卸载时清理。
- Hooks ID：vaporWithHookId 通过 id -> index 映射稳定 hook 槽位，避免重渲染时索引漂移。
*/
import { onBeforeUnmount, renderBetween } from './vapor-runtime'
import { getCurrentInstance, signal, untrack, watchEffect } from '@rue-js/runtime-vapor/reactive'
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

export const vaporShowStyle = (s: any, cond: any) => {
  if (typeof s === 'string') {
    return cond ? s : s + '; display: none'
  }
  if (s && typeof s === 'object') {
    return { ...s, display: cond ? '' : 'none' }
  }
  return { display: cond ? '' : 'none' }
}

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

export type VaporListItemRange = {
  start?: DomNodeLike
  end: DomNodeLike
  stop?: () => void
  singleRoot?: boolean
  current?: ReturnType<typeof signal<{ item: any; index: number }>>
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

export const vaporKeyedList = <T>(args: {
  items: T[]
  getKey: (item: T, index: number) => any
  elements: Map<any, VaporListItemRange>
  parent: any
  before: any
  singleRoot?: boolean
  renderItem: (item: T, parent: any, start: any, end: any, idx?: number) => void
}) => {
  const { items, getKey, elements, parent, before, renderItem, singleRoot = false } = args
  const nextElements = new Map<any, VaporListItemRange>()
  const syncEffectOptions = {
    scheduler: (run: () => void) => run(),
  }

  const getRawIdentity = (value: T) => {
    if (value && typeof value === 'object') {
      try {
        const raw = (value as any).__rue_raw__
        if (raw !== undefined) return raw
      } catch {}
    }
    return value
  }

  const syncCurrentItem = (range: VaporListItemRange, nextItem: T, nextIndex: number) => {
    if (!range.current) {
      range.current = signal({ item: nextItem, index: nextIndex }, {}, true)
      return range.current
    }

    const prev = untrack(() => range.current!.get())
    if (getRawIdentity(prev.item) !== getRawIdentity(nextItem) || prev.index !== nextIndex) {
      range.current.set({ item: nextItem, index: nextIndex })
    }
    return range.current
  }

  const resolveStartNode = (range: VaporListItemRange) => {
    if (!range.singleRoot) {
      return range.start as DomNodeLike
    }
    const head = ((range.end as any).previousSibling as DomNodeLike | null) || null
    return head && contains(parent as any, head as any) ? head : range.end
  }

  let cursor: DomNodeLike | null = before as any

  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index]
    const key = getKey(item, index)
    let range = elements.get(key)
    const isNewRange = !range
    let start: DomNodeLike
    let end: DomNodeLike

    if (!range) {
      if (singleRoot) {
        end = createComment('rue:list:item:anchor')
        insertBefore(parent, end, cursor as any)
        const entry: VaporListItemRange = { end, singleRoot: true }
        const current = syncCurrentItem(entry, item, index)
        const stop = watchEffect(() => {
          const next = current.get()
          renderItem(next.item, parent as any, end, end, next.index)
        }, syncEffectOptions)
        entry.stop = () => stop.dispose()
        range = entry
      } else {
        start = createComment('rue:list:item:start')
        end = createComment('rue:list:item:end')
        insertBefore(parent, end, cursor as any)
        insertBefore(parent, start, end)
        const entry: VaporListItemRange = { start, end }
        const current = syncCurrentItem(entry, item, index)
        const stop = watchEffect(() => {
          const next = current.get()
          renderItem(next.item, parent as any, start, end, next.index)
        }, syncEffectOptions)
        entry.stop = () => stop.dispose()
        range = entry
      }
    } else {
      syncCurrentItem(range, item, index)
      start = resolveStartNode(range)
      end = range.end
    }

    // New single-root entries mount through renderAnchor after this loop turn, so their
    // tail anchor is the only stable cursor until the DOM child lands.
    const blockStart = isNewRange && range.singleRoot ? range.end : resolveStartNode(range)

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
      if (range.stop) range.stop()

      let node: DomNodeLike | null = resolveStartNode(range)
      while (node) {
        const next: DomNodeLike | null = (node as any).nextSibling || null
        if (contains(parent as any, node as any)) removeChild(parent as any, node as any)
        if (node === range.end) break
        node = next
      }
    }
  })
  elements.clear()
  nextElements.forEach((range, key) => elements.set(key, range))
  return elements
}

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

export function vaporWithHookId<T>(id: string, runner: () => T): T {
  const instance = getCurrentInstance() as any
  if (!instance) return runner()
  const hooks = instance.__hooks || (instance.__hooks = { states: [], index: 0 })
  const map: Map<string, number> =
    (hooks as any).__idMap || ((hooks as any).__idMap = new Map<string, number>())
  let index = map.get(id)
  if (index === undefined) {
    index = (hooks.states?.length as number) ?? 0
    map.set(id, index)
  }
  ;(hooks as any).__forcedIndex = index
  try {
    return runner()
  } finally {
    ;(hooks as any).__forcedIndex = undefined
  }
}
