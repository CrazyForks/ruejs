/*
Vapor 运行时辅助概述
- 显隐样式：vaporShowStyle 根据条件生成字符串或对象样式，隐藏时追加或设置 display。
- Keyed 列表渲染：vaporKeyedList 通过注释锚点维护每项 DOM 范围，支持重排、增删和单根优化。
- ref 绑定：vaporBindUseRef 以响应式方式同步函数 ref / 对象 ref，并在卸载时清理。
- Hooks ID：vaporWithHookId 通过 id -> index 映射稳定 hook 槽位，避免重渲染时索引漂移。
*/
import {
  disposeExternalRenderableFallback,
  disposeSynchronousOpaqueRenderable,
  getOwnedMountProtocol,
  onBeforeUnmount,
  prepareAsyncExternalOwnedDispose,
  withOwnedMountContinuationContext,
} from './rue'
import {
  effectScope,
  getCurrentScope,
  onScopeDispose,
  signal,
  toRaw,
  untrack,
  watchEffect,
} from './reactivity'
import { getCurrentInstance } from '@rue-js/runtime-vapor/reactive'
import {
  createComment,
  createDocumentFragment,
  insertBefore,
  appendChild,
  getParentNode,
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

/** 列表项拥有的 DOM、响应式作用域和后续挂载资源。 */
export type VaporListItemOwner = {
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
  /** 当前一代行资源所属的 detached scope。 */
  scope?: ReturnType<typeof effectScope>
  /** 通用清理栈，按注册顺序的逆序执行。 */
  cleanups: Array<() => void>
  /** ref 专用清理容器，后续 owned ref 协议填充。 */
  refCleanups: Array<() => void>
  /** owned mount 专用清理容器，后续 mount 协议填充。 */
  ownedMountCleanups: Array<() => void>
  /** 同步不透明 direct renderable 的定向清理容器。 */
  opaqueRenderableCleanups: Array<() => void>
  /** Rust/Wasm owned mount 的不透明 token。 */
  ownedMountToken?: unknown
  /** DOM commit 前暂存的 mounted 工作。 */
  pendingMounted: unknown[]
  /** owner 被销毁时递增，用于拒绝过期工作。 */
  generation: number
  /** owner 是否已经完成幂等销毁。 */
  disposed: boolean
  /** owner 在列表状态 Map 中的实际索引。 */
  mapKey?: any
}

/** @deprecated 列表项现在是完整 owner；保留旧名称兼容既有编译产物与测试。 */
export type VaporListItemRange = VaporListItemOwner

export type VaporListRefCleanupRegistrar = (cleanup: () => void) => void

const stableFunctionSources = new WeakMap<Function, Function>()

/** 单个列表表达式持有的稳定资源边界。 */
export type VaporListState = {
  elements: Map<any, VaporListItemRange>
  readonly disposed: boolean
  dispose(): void
  readonly __debug: {
    cleanupRegistrations: number
    disposedRows: number
  }
}

type VaporListStateSeed = {
  elements: Map<any, VaporListItemRange>
  disposed?: boolean
  dispose?: () => void
  __debug?: {
    cleanupRegistrations: number
    disposedRows: number
  }
}
type InternalVaporListState = VaporListStateSeed & {
  cleanupRegistered?: boolean
  initialized?: boolean
  pendingMountedCommits?: Array<{ token: unknown; index: number; order: number }>
  pendingMountedCommitOrder?: number
}

const drainCleanups = (cleanups: Array<() => void>) => {
  for (let index = cleanups.length - 1; index >= 0; index -= 1) {
    cleanups[index]()
  }
  cleanups.length = 0
}

const releaseVaporListOwner = (owner: VaporListItemOwner, disposeState: boolean) => {
  if (disposeState) {
    if (owner.disposed) {
      return
    }
    owner.disposed = true
    owner.generation += 1
  }

  owner.pendingMounted.length = 0
  drainCleanups(owner.opaqueRenderableCleanups)
  drainCleanups(owner.ownedMountCleanups)
  drainCleanups(owner.refCleanups)
  drainCleanups(owner.cleanups)

  const stop = owner.stop
  if (stop) {
    stop()
    if (owner.stop === stop) {
      owner.stop = undefined
    }
  }
  owner.scope = undefined

  if (!disposeState) {
    return
  }

  owner.current = undefined
  owner.renderState = undefined
  owner.stableItem = undefined
  owner.remount = undefined
}

/** 基于 Key 的列表渲染与重排 */
export const vaporKeyedList = <T>(args: {
  /** 当前列表数据。 */
  items: T[]
  /** 从 item/index 计算稳定 key 的函数。 */
  getKey: (item: T, index: number) => any
  /** 上一次渲染留下的 key -> DOM 范围表，会被原地更新。 */
  elements?: Map<any, VaporListItemRange>
  /** 单个列表表达式跨更新复用的稳定资源状态。 */
  state?: VaporListStateSeed
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
  /** 原生结构行是否启用传递式 owned mount；缺能力或 hydration 时显式 fallback。 */
  ownedMount?: boolean
  /** renderItem 是否渲染一次求值后的同步不透明结果。 */
  opaqueRenderable?: boolean
  /** 需要取消/外部清理的内建组件；缺 owned 能力时显式释放全局 range。 */
  asyncExternalRenderable?: boolean
  /** 渲染单个条目的回调。 */
  renderItem: (
    item: T,
    parent: any,
    start: any,
    end: any,
    idx: number,
    registerRefCleanup: VaporListRefCleanupRegistrar,
  ) => void
}) => {
  const {
    items,
    getKey,
    elements: legacyElements,
    state: providedState,
    parent,
    before,
    start: listStart,
    renderItem,
    singleRoot = false,
    trackIndex = true,
    directRoot = false,
    ownedMount = false,
    opaqueRenderable = false,
    asyncExternalRenderable = false,
  } = args
  const state = (providedState ?? {
    elements: legacyElements ?? new Map<any, VaporListItemRange>(),
  }) as InternalVaporListState
  const elements = state.elements ?? legacyElements ?? new Map<any, VaporListItemRange>()
  state.elements = elements
  if (!state.__debug) {
    state.__debug = { cleanupRegistrations: 0, disposedRows: 0 }
  }
  if (!state.initialized) {
    state.initialized = true
    state.disposed = false
    state.dispose = () => {
      if (state.disposed) {
        return
      }
      state.disposed = true
      state.pendingMountedCommits?.splice(0)
      state.pendingMountedCommitOrder = 0
      const owners = Array.from(state.elements.values())
      state.elements.clear()
      state.__debug!.disposedRows += owners.length
      for (let index = owners.length - 1; index >= 0; index -= 1) {
        releaseVaporListOwner(owners[index], true)
      }
    }
  }
  if (!state.cleanupRegistered) {
    const owner = getCurrentScope()
    if (owner?.active) {
      onScopeDispose(() => state.dispose?.(), true)
      state.cleanupRegistered = true
      state.__debug.cleanupRegistrations += 1
    }
  }
  if (state.disposed) {
    return elements
  }
  const nextElements = new Map<any, VaporListItemRange>()
  const syncEffectOptions = {
    scheduler: (run: () => void) => run(),
  }
  const createOwner = (
    range: Pick<VaporListItemOwner, 'start' | 'end' | 'singleRoot'>,
    mapKey: any,
  ): VaporListItemOwner => {
    const owner: VaporListItemOwner = {
      ...range,
      cleanups: [],
      refCleanups: [],
      ownedMountCleanups: [],
      opaqueRenderableCleanups: [],
      pendingMounted: [],
      generation: 0,
      disposed: false,
      mapKey,
    }
    if (asyncExternalRenderable && ownedProtocol) {
      owner.opaqueRenderableCleanups.push(() =>
        prepareAsyncExternalOwnedDispose(owner.start ?? owner.end),
      )
    } else if (asyncExternalRenderable) {
      owner.opaqueRenderableCleanups.push(() => {
        const start = owner.start ?? owner.end
        const rangeParent = getParentNode(start) ?? parent
        if (rangeParent) {
          disposeExternalRenderableFallback(rangeParent as any, start, owner.end)
        }
      })
    } else if (opaqueRenderable) {
      owner.opaqueRenderableCleanups.push(() =>
        disposeSynchronousOpaqueRenderable(owner.start ?? owner.end),
      )
    }
    return owner
  }
  const createRefCleanupRegistrar =
    (owner: VaporListItemOwner): VaporListRefCleanupRegistrar =>
    cleanup => {
      if (owner.disposed) {
        cleanup()
        return
      }
      owner.refCleanups.push(cleanup)
    }
  const getReactiveLocation = (value: unknown) => {
    if ((typeof value !== 'object' && typeof value !== 'function') || value == null) {
      return undefined
    }
    try {
      const signal = (value as any).__signal__
      const path = (value as any).__rue_path__
      return signal && Array.isArray(path) ? { signal, path } : undefined
    } catch {
      return undefined
    }
  }
  const hasSameReactiveLocation = (previous: unknown, next: unknown) => {
    const previousLocation = getReactiveLocation(previous)
    const nextLocation = getReactiveLocation(next)
    if (!previousLocation || !nextLocation) return previousLocation === nextLocation
    if (previousLocation.signal !== nextLocation.signal) return false
    return (
      previousLocation.path.length === nextLocation.path.length &&
      previousLocation.path.every((segment: unknown, index: number) =>
        Object.is(segment, nextLocation.path[index]),
      )
    )
  }
  const currentStateOptions = {
    equals: (
      previous: { item: T; index: number; rawIdentity: unknown },
      next: { item: T; index: number; rawIdentity: unknown },
    ) =>
      previous.rawIdentity === next.rawIdentity &&
      hasSameReactiveLocation(previous.item, next.item) &&
      (!trackIndex || previous.index === next.index),
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

  const isHydrationFallback = () => {
    let node: any = targetParent
    let depth = 0
    while (node && depth < 64) {
      if (node.__rue_hydrated_adopted || node.__rue_hydrated_adopted_target) return true
      node = node.parentNode
      depth += 1
    }
    return false
  }
  const ownedProtocol = ownedMount && !isHydrationFallback() ? getOwnedMountProtocol() : undefined
  const pendingMountedCommits = (state.pendingMountedCommits ??= [])
  const flushPendingMountedCommits = () => {
    pendingMountedCommits.sort(
      (left, right) => left.index - right.index || left.order - right.order,
    )
    for (const pending of pendingMountedCommits.splice(0)) {
      ownedProtocol?.flushMounted(pending.token)
    }
    state.pendingMountedCommitOrder = 0
  }
  const runWithOwnedMount = (entry: VaporListItemOwner, index: number, run: () => void) => {
    if (!ownedProtocol) {
      run()
      return
    }

    const previousToken = entry.ownedMountToken
    const token = previousToken ?? ownedProtocol.buildOwnedMount()
    const entered = previousToken ? ownedProtocol.updateOwnedMount(token) : token != null
    if (!entered) {
      entry.ownedMountToken = undefined
      run()
      return
    }

    try {
      withOwnedMountContinuationContext(ownedProtocol, token, run)
      if (!ownedProtocol.commitMounted(token, true)) {
        throw new Error('[rue] owned mount commit rejected a stale token')
      }
      const order = state.pendingMountedCommitOrder ?? 0
      state.pendingMountedCommitOrder = order + 1
      pendingMountedCommits.push({ token, index, order })
      if (previousToken == null) {
        entry.ownedMountToken = token
        entry.ownedMountCleanups.push(() => {
          ownedProtocol.disposeOwnedMount(token)
          if (entry.ownedMountToken === token) entry.ownedMountToken = undefined
        })
      }
    } catch (error) {
      ownedProtocol.abortOwnedMount(token)
      if (entry.ownedMountToken === token) entry.ownedMountToken = undefined
      throw error
    }
  }

  const oldEntries = Array.from(elements.entries())

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
            const bound = value.bind(item)
            stableFunctionSources.set(bound, value)
            return bound
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
        currentStateOptions,
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
    if (prev.item !== nextItem || rawChanged || (trackIndex && indexChanged)) {
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
      prevRender.rawIdentity !== nextRawIdentity &&
      (!(range.stableItem && isObjectLike(nextItem)) || !range.singleRoot)

    if (shouldRefreshStructure || (trackIndex && indexChanged)) {
      range.renderState.set({ item: nextItem, index: nextIndex, rawIdentity: nextRawIdentity })
    }

    return range.renderState
  }

  const releaseRange = (range: VaporListItemRange, disposeState: boolean) => {
    releaseVaporListOwner(range, disposeState)
  }

  const runInDetachedScope = (entry: VaporListItemRange, run: () => void) => {
    const scope = effectScope(true)
    const stop = () => scope.stop()
    entry.scope = scope
    entry.stop = stop
    try {
      scope.run(run)
    } catch (error) {
      scope.stop()
      if (entry.scope === scope) entry.scope = undefined
      if (entry.stop === stop) entry.stop = undefined
      throw error
    }
  }

  const mountDirectRootRange = (
    entry: VaporListItemRange,
    item: T,
    index: number,
    itemParent: DomNodeLike,
    end: DomNodeLike,
  ) => {
    const mount = (nextItem: T, nextIndex: number) => {
      runInDetachedScope(entry, () => {
        untrack(() => {
          renderItem(
            (entry.stableItem as T | undefined) ?? nextItem,
            itemParent as any,
            end,
            end,
            nextIndex,
            createRefCleanupRegistrar(entry),
          )
        })
      })
    }

    entry.remount = (nextItem, nextIndex) => {
      releaseRange(entry, false)
      const previousRoot = (end as any).previousSibling as DomNodeLike | null
      if (previousRoot && contains(itemParent, previousRoot) && !isListMarker(previousRoot)) {
        removeChild(itemParent, previousRoot)
      }
      mount(nextItem, nextIndex)
    }
    mount(item, index)
  }

  const nextKeys = items.map((item, index) => getKey(item, index))
  const hasDuplicateNextKeys = new Set(nextKeys).size !== nextKeys.length

  // 空列表的安全单根行先在各自的小 Fragment 中 O(1) 组装，
  // 再顺序 append 到一个批量 Fragment。这样既避免在不断增长的
  // child list 中逐行查找尾锚点，又使真实父节点只发生一次插入。
  if (
    elements.size === 0 &&
    items.length > 0 &&
    singleRoot &&
    !trackIndex &&
    (directRoot || ownedMount) &&
    !hasDuplicateNextKeys &&
    items.every(isObjectLike)
  ) {
    const batch = createDocumentFragment()

    try {
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index]
        const key = nextKeys[index]
        const itemParent = createDocumentFragment()
        const end = createComment('rue:list:item:anchor')
        appendChild(itemParent, end)

        const entry = createOwner({ end, singleRoot: true }, key)
        try {
          syncCurrentItem(entry, item, index)
          runInDetachedScope(entry, () => {
            untrack(() => {
              const mount = () =>
                renderItem(
                  entry.stableItem as T,
                  itemParent as any,
                  end,
                  end,
                  index,
                  createRefCleanupRegistrar(entry),
                )
              if (directRoot) mount()
              else runWithOwnedMount(entry, index, mount)
            })
          })
        } catch (error) {
          releaseRange(entry, true)
          throw error
        }
        appendChild(batch, itemParent)
        nextElements.set(key, entry)
      }
    } catch (error) {
      nextElements.forEach(range => releaseRange(range, true))
      nextElements.clear()
      throw error
    }

    if (before && contains(targetParent, before as any)) {
      insertBefore(targetParent, batch, before as any)
    } else {
      appendChild(targetParent, batch)
    }

    elements.clear()
    nextElements.forEach((range, key) => elements.set(key, range))
    flushPendingMountedCommits()
    return elements
  }

  const resolveStartNode = (range: VaporListItemRange) => {
    if (!range.singleRoot) {
      return range.start as DomNodeLike
    }
    const head = ((range.end as any).previousSibling as DomNodeLike | null) || null
    return head && (head as any).parentNode === (range.end as any).parentNode && !isListMarker(head)
      ? head
      : range.end
  }

  const mountRange = (item: T, index: number, cursor: DomNodeLike | null, mapKey: any) => {
    if (singleRoot) {
      const end = createComment('rue:list:item:anchor')
      insertBefore(targetParent, end, cursor as any)
      const entry = createOwner({ end, singleRoot: true }, mapKey)
      const renderState = syncCurrentItem(entry, item, index)
      try {
        if (directRoot) {
          mountDirectRootRange(entry, item, index, targetParent, end)
        } else if (renderState) {
          runInDetachedScope(entry, () => {
            watchEffect(() => {
              const next = renderState.get()
              const rangeParent = getParentNode(entry.end) ?? targetParent
              untrack(() => {
                runWithOwnedMount(entry, next.index, () =>
                  renderItem(
                    (entry.stableItem as T | undefined) ?? next.item,
                    rangeParent as any,
                    end,
                    end,
                    next.index,
                    createRefCleanupRegistrar(entry),
                  ),
                )
              })
            }, syncEffectOptions)
          })
        } else {
          runInDetachedScope(entry, () => {
            untrack(() => {
              runWithOwnedMount(entry, index, () =>
                renderItem(
                  entry.stableItem as T,
                  targetParent as any,
                  end,
                  end,
                  index,
                  createRefCleanupRegistrar(entry),
                ),
              )
            })
          })
        }
        return entry
      } catch (error) {
        removeRange(entry)
        throw error
      }
    }

    const start = createComment('rue:list:item:start')
    const end = createComment('rue:list:item:end')
    insertBefore(targetParent, end, cursor as any)
    insertBefore(targetParent, start, end)
    const entry = createOwner({ start, end }, mapKey)
    const renderState = syncCurrentItem(entry, item, index)!
    try {
      runInDetachedScope(entry, () => {
        watchEffect(() => {
          const next = renderState.get()
          const rangeParent = getParentNode(entry.start ?? entry.end) ?? targetParent
          untrack(() => {
            runWithOwnedMount(entry, next.index, () =>
              renderItem(
                (entry.stableItem as T | undefined) ?? next.item,
                rangeParent as any,
                start,
                end,
                next.index,
                createRefCleanupRegistrar(entry),
              ),
            )
          })
        }, syncEffectOptions)
      })
      return entry
    } catch (error) {
      removeRange(entry)
      throw error
    }
  }

  const syncRange = (range: VaporListItemRange, item: T, index: number) => {
    const previous = range.current ? untrack(() => range.current!.get()) : undefined
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
  }

  const removeRange = (range: VaporListItemRange) => {
    const nodesToRemove: DomNodeLike[] = []
    let node: DomNodeLike | null = resolveStartNode(range)
    while (node) {
      nodesToRemove.push(node)
      if (node === range.end) break
      node = ((node as any).nextSibling as DomNodeLike | null) || null
    }

    if (elements.get(range.mapKey) === range) elements.delete(range.mapKey)
    if (nextElements.get(range.mapKey) === range) nextElements.delete(range.mapKey)
    releaseRange(range, true)
    for (const staleNode of nodesToRemove) {
      if (contains(targetParent as any, staleNode as any)) {
        removeChild(targetParent as any, staleNode as any)
      }
    }
  }

  const findStableIndexes = (oldIndexes: number[]) => {
    const predecessors = Array.from({ length: oldIndexes.length }, () => -1)
    const tails: number[] = []

    oldIndexes.forEach((oldIndex, index) => {
      if (oldIndex < 0) return
      let low = 0
      let high = tails.length
      while (low < high) {
        const middle = Math.floor((low + high) / 2)
        if (oldIndexes[tails[middle]] < oldIndex) low = middle + 1
        else high = middle
      }
      if (low > 0) predecessors[index] = tails[low - 1]
      if (low === tails.length) tails.push(index)
      else tails[low] = index
    })

    const stableIndexes = new Set<number>()
    let stableIndex: number | undefined = tails[tails.length - 1]
    while (stableIndex !== undefined) {
      stableIndexes.add(stableIndex)
      const predecessor: number = predecessors[stableIndex]
      stableIndex = predecessor >= 0 ? predecessor : undefined
    }
    return stableIndexes
  }

  if (hasDuplicateNextKeys) {
    for (let index = oldEntries.length - 1; index >= 0; index -= 1) {
      removeRange(oldEntries[index][1])
    }

    const fallbackKeys = nextKeys.map((key, index) => ({ key, index }))
    let cursor: DomNodeLike | null = before as any
    try {
      for (let index = items.length - 1; index >= 0; index -= 1) {
        const fallbackKey = fallbackKeys[index]
        const range = mountRange(items[index], index, cursor, fallbackKey)
        nextElements.set(fallbackKey, range)
        cursor = resolveStartNode(range)
      }
    } catch (error) {
      const mountedOwners = Array.from(nextElements.values())
      for (let index = mountedOwners.length - 1; index >= 0; index -= 1) {
        removeRange(mountedOwners[index])
      }
      throw error
    }

    elements.clear()
    nextElements.forEach((range, key) => elements.set(key, range))
    flushPendingMountedCommits()
    return elements
  }

  // 位置列表的中间增删会表现为“同 key 前缀更新 + 尾部增删”。结构性行必须先
  // 离开真实父节点再逐项 patch，否则插入点后的组件替换会在大 child list 上退化。
  const sharedPrefixLength = Math.min(oldEntries.length, nextKeys.length)
  const hasSameKeyPrefix =
    sharedPrefixLength > 0 &&
    Array.from({ length: sharedPrefixLength }, (_, index) => index).every(
      index => oldEntries[index][0] === nextKeys[index],
    )
  if (
    !directRoot &&
    items.length > 0 &&
    oldEntries.length !== items.length &&
    hasSameKeyPrefix &&
    before &&
    (targetParent as any).lastChild === before
  ) {
    const stagedRanges = oldEntries.map(([, range]) => {
      const nodes: DomNodeLike[] = []
      let node: DomNodeLike | null = resolveStartNode(range)
      while (node) {
        nodes.push(node)
        if (node === range.end) break
        node = ((node as any).nextSibling as DomNodeLike | null) || null
      }
      return { range, nodes }
    })
    const firstOwnedNode = listStart ?? resolveStartNode(oldEntries[0][1])
    let actualChildCount = 0
    let child = (targetParent as any).firstChild as DomNodeLike | null
    while (child) {
      actualChildCount += 1
      child = ((child as any).nextSibling as DomNodeLike | null) || null
    }
    const expectedChildCount =
      stagedRanges.reduce((count, current) => count + current.nodes.length, 0) +
      (listStart ? 1 : 0) +
      1
    const ownsCompleteParent =
      (targetParent as any).firstChild === firstOwnedNode &&
      actualChildCount === expectedChildCount &&
      stagedRanges.every(current =>
        current.nodes.every(node => (node as any).parentNode === targetParent),
      )

    if (ownsCompleteParent) {
      const appendCurrentRanges = (batch: DomNodeLike, ranges: VaporListItemRange[]) => {
        for (const range of ranges) {
          let node: DomNodeLike | null = resolveStartNode(range)
          while (node) {
            const next: DomNodeLike | null =
              ((node as any).nextSibling as DomNodeLike | null) || null
            appendChild(batch, node)
            if (node === range.end) break
            node = next
          }
        }
      }
      const reattachOldRanges = () => {
        const batch = createDocumentFragment()
        if (listStart) appendChild(batch, listStart as DomNodeLike)
        appendCurrentRanges(
          batch,
          stagedRanges.map(current => current.range),
        )
        appendChild(batch, before as DomNodeLike)
        insertBefore(targetParent, batch, null as any)
      }

      ;(targetParent as any).textContent = ''
      for (const current of stagedRanges) {
        const itemParent = createDocumentFragment()
        for (const node of current.nodes) appendChild(itemParent, node)
      }

      try {
        for (let index = sharedPrefixLength - 1; index >= 0; index -= 1) {
          syncRange(stagedRanges[index].range, items[index], index)
        }
      } catch (error) {
        pendingMountedCommits.length = 0
        reattachOldRanges()
        throw error
      }

      const nextRanges = stagedRanges.slice(0, sharedPrefixLength).map(current => current.range)
      const newlyMountedRanges: VaporListItemRange[] = []
      try {
        let cursor: DomNodeLike | null = null
        for (let index = items.length - 1; index >= sharedPrefixLength; index -= 1) {
          const range = mountRange(items[index], index, cursor, nextKeys[index])
          newlyMountedRanges.push(range)
          nextRanges[index] = range
          cursor = resolveStartNode(range)
        }
      } catch (error) {
        pendingMountedCommits.length = 0
        for (let index = newlyMountedRanges.length - 1; index >= 0; index -= 1) {
          removeRange(newlyMountedRanges[index])
        }
        reattachOldRanges()
        throw error
      }

      for (let index = stagedRanges.length - 1; index >= items.length; index -= 1) {
        releaseRange(stagedRanges[index].range, true)
      }

      const batch = createDocumentFragment()
      if (listStart) appendChild(batch, listStart as DomNodeLike)
      appendCurrentRanges(batch, nextRanges)
      appendChild(batch, before as DomNodeLike)
      insertBefore(targetParent, batch, null as any)

      elements.clear()
      nextRanges.forEach((range, index) => {
        range.mapKey = nextKeys[index]
        elements.set(nextKeys[index], range)
      })
      flushPendingMountedCommits()
      return elements
    }
  }

  // 同序的结构性行更新会逐行替换子树。先把每个 range 放进独立 Fragment，
  // 让组件/opaque patch 在 O(1) 大小的父节点内完成，再一次提交回真实父节点。
  // 这也避免 jsdom 在大列表父节点上反复维护 child index。
  if (
    !directRoot &&
    items.length > 0 &&
    oldEntries.length === items.length &&
    oldEntries.every(([key], index) => key === nextKeys[index]) &&
    !!before &&
    (targetParent as any).lastChild === before &&
    (targetParent as any).firstChild === (listStart ?? resolveStartNode(oldEntries[0][1])) &&
    typeof (targetParent as any).textContent === 'string'
  ) {
    const stagedRanges = oldEntries.map(([, range]) => {
      const nodes: DomNodeLike[] = []
      let node: DomNodeLike | null = resolveStartNode(range)
      while (node) {
        nodes.push(node)
        if (node === range.end) break
        node = ((node as any).nextSibling as DomNodeLike | null) || null
      }
      return { range, nodes }
    })
    let actualChildCount = 0
    let child = (targetParent as any).firstChild as DomNodeLike | null
    while (child) {
      actualChildCount += 1
      child = ((child as any).nextSibling as DomNodeLike | null) || null
    }
    const expectedChildCount =
      stagedRanges.reduce((count, current) => count + current.nodes.length, 0) +
      (listStart ? 1 : 0) +
      1
    const ownsCompleteParent =
      actualChildCount === expectedChildCount &&
      stagedRanges.every(current =>
        current.nodes.every(node => (node as any).parentNode === targetParent),
      )

    if (ownsCompleteParent) {
      ;(targetParent as any).textContent = ''
      for (const current of stagedRanges) {
        const itemParent = createDocumentFragment()
        for (const node of current.nodes) appendChild(itemParent, node)
      }

      let didFail = false
      let updateError: unknown
      try {
        for (let index = items.length - 1; index >= 0; index -= 1) {
          syncRange(stagedRanges[index].range, items[index], index)
        }
      } catch (error) {
        didFail = true
        updateError = error
      }

      const batch = createDocumentFragment()
      if (listStart) appendChild(batch, listStart as DomNodeLike)
      for (const { range } of stagedRanges) {
        let node: DomNodeLike | null = resolveStartNode(range)
        while (node) {
          const next: DomNodeLike | null = ((node as any).nextSibling as DomNodeLike | null) || null
          appendChild(batch, node)
          if (node === range.end) break
          node = next
        }
      }
      appendChild(batch, before as DomNodeLike)
      insertBefore(targetParent, batch, null as any)

      if (didFail) {
        pendingMountedCommits.length = 0
        throw updateError
      }
      flushPendingMountedCommits()
      return elements
    }
  }

  for (let index = items.length - 1; index >= 0; index -= 1) {
    const range = elements.get(nextKeys[index])
    if (range) syncRange(range, items[index], index)
  }

  const nextRanges: Array<VaporListItemRange | undefined> = Array.from(
    { length: items.length },
    () => undefined,
  )
  const newlyMountedRanges: VaporListItemRange[] = []
  let needsBatchMove = false
  const mountNewRange = (item: T, index: number, cursor: DomNodeLike | null, mapKey: any) => {
    const range = mountRange(item, index, cursor, mapKey)
    newlyMountedRanges.push(range)
    return range
  }
  let oldStart = 0
  let oldEnd = oldEntries.length - 1
  let nextStart = 0
  let nextEnd = items.length - 1

  while (
    oldStart <= oldEnd &&
    nextStart <= nextEnd &&
    oldEntries[oldStart][0] === nextKeys[nextStart]
  ) {
    const range = oldEntries[oldStart][1]
    nextRanges[nextStart] = range
    oldStart += 1
    nextStart += 1
  }
  while (
    oldStart <= oldEnd &&
    nextStart <= nextEnd &&
    oldEntries[oldEnd][0] === nextKeys[nextEnd]
  ) {
    const range = oldEntries[oldEnd][1]
    nextRanges[nextEnd] = range
    oldEnd -= 1
    nextEnd -= 1
  }

  try {
    if (nextStart > nextEnd) {
      for (let index = oldStart; index <= oldEnd; index += 1) removeRange(oldEntries[index][1])
    } else if (oldStart > oldEnd) {
      let cursor = nextRanges[nextEnd + 1]
        ? resolveStartNode(nextRanges[nextEnd + 1]!)
        : (before as DomNodeLike | null)
      for (let index = nextEnd; index >= nextStart; index -= 1) {
        const range = mountNewRange(items[index], index, cursor, nextKeys[index])
        nextRanges[index] = range
        cursor = resolveStartNode(range)
      }
    } else {
      const oldIndexByKey = new Map<any, number>()
      for (let index = oldStart; index <= oldEnd; index += 1) {
        oldIndexByKey.set(oldEntries[index][0], index)
      }

      const middleOldIndexes: number[] = []
      const reusedOldIndexes = new Set<number>()
      for (let index = nextStart; index <= nextEnd; index += 1) {
        const oldIndex = oldIndexByKey.get(nextKeys[index])
        if (oldIndex === undefined) {
          middleOldIndexes.push(-1)
          continue
        }
        const range = oldEntries[oldIndex][1]
        nextRanges[index] = range
        middleOldIndexes.push(oldIndex)
        reusedOldIndexes.add(oldIndex)
      }

      for (let index = oldStart; index <= oldEnd; index += 1) {
        if (!reusedOldIndexes.has(index)) removeRange(oldEntries[index][1])
      }

      const stableIndexes = findStableIndexes(middleOldIndexes)
      let cursor = nextRanges[nextEnd + 1]
        ? resolveStartNode(nextRanges[nextEnd + 1]!)
        : (before as DomNodeLike | null)
      for (let index = nextEnd; index >= nextStart; index -= 1) {
        let range = nextRanges[index]
        const middleIndex = index - nextStart
        if (!range) {
          range = mountNewRange(items[index], index, cursor, nextKeys[index])
          nextRanges[index] = range
        } else {
          const isStable = stableIndexes.has(middleIndex)
          const blockStart = resolveStartNode(range)
          const isConnected =
            contains(targetParent as any, blockStart as any) &&
            contains(targetParent as any, range.end as any)
          if (!isStable || !isConnected) needsBatchMove = true
        }
        cursor = resolveStartNode(range)
      }
    }
  } catch (error) {
    pendingMountedCommits.length = 0
    for (let index = newlyMountedRanges.length - 1; index >= 0; index -= 1) {
      removeRange(newlyMountedRanges[index])
    }
    throw error
  }

  if (needsBatchMove) {
    const orderedNodes: DomNodeLike[] = []
    let ownsCompleteParent = !!before && (targetParent as any).lastChild === before
    const firstOwnedNode =
      listStart ?? (oldEntries.length > 0 ? resolveStartNode(oldEntries[0][1]) : null)
    ownsCompleteParent =
      ownsCompleteParent && !!firstOwnedNode && (targetParent as any).firstChild === firstOwnedNode

    for (const range of nextRanges) {
      if (!range) continue
      let node: DomNodeLike | null = resolveStartNode(range)
      while (node) {
        orderedNodes.push(node)
        if ((node as any).parentNode !== targetParent) ownsCompleteParent = false
        if (node === range.end) break
        node = ((node as any).nextSibling as DomNodeLike | null) || null
      }
    }

    const expectedChildCount = orderedNodes.length + (listStart ? 1 : 0) + 1
    let actualChildCount = 0
    let child = (targetParent as any).firstChild as DomNodeLike | null
    while (child) {
      actualChildCount += 1
      child = ((child as any).nextSibling as DomNodeLike | null) || null
    }
    ownsCompleteParent =
      ownsCompleteParent &&
      typeof (targetParent as any).textContent === 'string' &&
      actualChildCount === expectedChildCount

    const batch = createDocumentFragment()
    if (ownsCompleteParent) {
      // jsdom stores childNodes in an array, so removing a reversed list one node at a
      // time becomes quadratic. When this list owns the complete parent range, detach
      // everything atomically before rebuilding the same nodes in their new order.
      ;(targetParent as any).textContent = ''
      if (listStart) appendChild(batch, listStart as DomNodeLike)
      for (const node of orderedNodes) appendChild(batch, node)
      appendChild(batch, before as DomNodeLike)
      insertBefore(targetParent, batch, null as any)
    } else {
      for (const node of orderedNodes) appendChild(batch, node)
      if (before && contains(targetParent, before as any)) {
        insertBefore(targetParent, batch, before as any)
      } else {
        appendChild(targetParent, batch)
      }
    }
  }

  elements.clear()
  nextKeys.forEach((key, index) => {
    const range = nextRanges[index]
    if (range) {
      range.mapKey = key
      elements.set(key, range)
    }
  })
  flushPendingMountedCommits()
  return elements
}

/** 反应式绑定 ref：支持函数 ref 与对象 ref */
export const vaporBindUseRef = (
  el: any,
  getRef: () => any,
  registerCleanup?: VaporListRefCleanupRegistrar,
) => {
  let prev: any
  let hasPrev = false
  let stop: ReturnType<typeof watchEffect> | undefined
  let disposed = false

  const isSameRef = (previous: any, next: any) => {
    if (Object.is(previous, next)) return true
    if (typeof previous !== 'function' || typeof next !== 'function') return false
    const previousSource = stableFunctionSources.get(previous)
    return previousSource !== undefined && previousSource === stableFunctionSources.get(next)
  }

  const clearRef = (refValue: any) => {
    if (typeof refValue === 'function') {
      refValue(null)
    } else if (refValue && typeof refValue === 'object' && 'current' in refValue) {
      ;(refValue as any).current = undefined
    }
  }
  const cleanup = () => {
    if (disposed) return
    disposed = true
    const stopWatcher = stop
    stop = undefined
    stopWatcher?.dispose()
    if (hasPrev) {
      const prevRef = prev
      hasPrev = false
      prev = undefined
      clearRef(prevRef)
    }
  }

  registerCleanup?.(cleanup)
  try {
    const stopWatcher = watchEffect(() => {
      const refValue = getRef()
      if (hasPrev && isSameRef(prev, refValue)) return
      if (hasPrev) clearRef(prev)
      prev = refValue
      hasPrev = true
      if (typeof refValue === 'function') {
        refValue(el)
      } else if (refValue && typeof refValue === 'object' && 'current' in refValue) {
        ;(refValue as any).current = el
      }
    })
    stop = stopWatcher
    if (disposed) {
      stop = undefined
      stopWatcher.dispose()
    }
  } catch (error) {
    cleanup()
    throw error
  }

  if (!registerCleanup) onBeforeUnmount(cleanup)
  return cleanup
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
