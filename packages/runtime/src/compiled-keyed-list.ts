import { insertBefore, removeChild, withDOMHostOperations } from './compiled-dom'

export interface CompiledKeyedRow<T, K = unknown> {
  key: K
  node: Node
  patch: (item: T, index: number) => void
  dispose: () => void
}

export interface CompiledKeyedMountResult<T> {
  node: Node
  patch: (item: T, index: number) => void
  dispose: () => void
}

export type CompiledKeyedMount<T> = (item: T, index: number) => CompiledKeyedMountResult<T>

type CompiledKeyedParent = Node & ParentNode

const stableIndexes = (oldIndexes: number[]): Set<number> => {
  const predecessors = new Int32Array(oldIndexes.length)
  predecessors.fill(-1)
  const tails: number[] = []

  for (let index = 0; index < oldIndexes.length; index += 1) {
    const oldIndex = oldIndexes[index]
    if (oldIndex < 0) continue

    let low = 0
    let high = tails.length
    while (low < high) {
      const middle = (low + high) >> 1
      if (oldIndexes[tails[middle]] < oldIndex) low = middle + 1
      else high = middle
    }

    if (low > 0) predecessors[index] = tails[low - 1]
    if (low === tails.length) tails.push(index)
    else tails[low] = index
  }

  const result = new Set<number>()
  let current: number | undefined = tails[tails.length - 1]
  while (current !== undefined) {
    result.add(current)
    const predecessor: number = predecessors[current]
    current = predecessor >= 0 ? predecessor : undefined
  }
  return result
}

/** Reconcile synchronous, single-root native rows. */
export const _$reconcileKeyed = <T, K>(
  parent: CompiledKeyedParent,
  before: Node | null,
  previous: readonly CompiledKeyedRow<T, K>[],
  items: readonly T[],
  getKey: (item: T, index: number) => K,
  mount: CompiledKeyedMount<T>,
): CompiledKeyedRow<T, K>[] =>
  withDOMHostOperations(parent, () => {
    const disposeRow = (row: CompiledKeyedRow<T, K>) => {
      try {
        row.dispose()
      } finally {
        if (row.node.parentNode === parent) removeChild(parent, row.node)
      }
    }

    if (items.length === 0) {
      for (let index = previous.length - 1; index >= 0; index -= 1) disposeRow(previous[index])
      return []
    }

    const keys: K[] = []
    keys.length = items.length
    const seen = new Set<K>()
    let hasDuplicateKeys = false
    for (let index = 0; index < items.length; index += 1) {
      const key = getKey(items[index], index)
      if (seen.has(key)) hasDuplicateKeys = true
      seen.add(key)
      keys[index] = key
    }
    const previousKeys = new Set<K>()
    const hadDuplicateKeys = previous.some(row => {
      if (previousKeys.has(row.key)) return true
      previousKeys.add(row.key)
      return false
    })

    const next: CompiledKeyedRow<T, K>[] = []
    next.length = items.length
    const mountRow = (index: number, cursor: Node | null) => {
      const mounted = mount(items[index], index)
      if (
        mounted == null ||
        mounted.node == null ||
        typeof mounted.patch !== 'function' ||
        typeof mounted.dispose !== 'function'
      ) {
        throw new Error('[rue] compiled keyed rows must return node/patch/dispose')
      }
      if (mounted.node.nodeType === 11) {
        mounted.dispose()
        throw new Error('[rue] compiled keyed rows must mount exactly one direct-root node')
      }

      const row: CompiledKeyedRow<T, K> = {
        key: keys[index],
        node: mounted.node,
        patch: mounted.patch,
        dispose: mounted.dispose,
      }
      try {
        insertBefore(parent, row.node, cursor)
      } catch (error) {
        disposeRow(row)
        throw error
      }
      return row
    }

    // 重复 key 没有稳定的 identity 映射。与通用列表保持一致：整批释放并重建，
    // 避免把同一个旧行复用到多个新位置，同时仍允许公开 fallback 数据正常渲染。
    if (hasDuplicateKeys || hadDuplicateKeys) {
      for (let index = previous.length - 1; index >= 0; index -= 1) disposeRow(previous[index])
      let cursor = before
      for (let index = items.length - 1; index >= 0; index -= 1) {
        const row = mountRow(index, cursor)
        next[index] = row
        cursor = row.node
      }
      return next
    }

    let oldStart = 0
    let oldEnd = previous.length - 1
    let nextStart = 0
    let nextEnd = items.length - 1

    while (
      oldStart <= oldEnd &&
      nextStart <= nextEnd &&
      previous[oldStart].key === keys[nextStart]
    ) {
      const row = previous[oldStart]
      row.patch(items[nextStart], nextStart)
      next[nextStart] = row
      oldStart += 1
      nextStart += 1
    }

    while (oldStart <= oldEnd && nextStart <= nextEnd && previous[oldEnd].key === keys[nextEnd]) {
      const row = previous[oldEnd]
      row.patch(items[nextEnd], nextEnd)
      next[nextEnd] = row
      oldEnd -= 1
      nextEnd -= 1
    }

    if (nextStart > nextEnd) {
      for (let index = oldEnd; index >= oldStart; index -= 1) disposeRow(previous[index])
      return next
    }

    if (oldStart > oldEnd) {
      let cursor = next[nextEnd + 1]?.node ?? before
      for (let index = nextEnd; index >= nextStart; index -= 1) {
        const row = mountRow(index, cursor)
        next[index] = row
        cursor = row.node
      }
      return next
    }

    const oldIndexByKey = new Map<K, number>()
    for (let index = oldStart; index <= oldEnd; index += 1) {
      oldIndexByKey.set(previous[index].key, index)
    }

    const middleOldIndexes = Array.from({ length: nextEnd - nextStart + 1 }, () => -1)
    const reusedOldIndexes = new Set<number>()
    for (let index = nextStart; index <= nextEnd; index += 1) {
      const oldIndex = oldIndexByKey.get(keys[index])
      if (oldIndex === undefined) continue
      const row = previous[oldIndex]
      row.patch(items[index], index)
      next[index] = row
      middleOldIndexes[index - nextStart] = oldIndex
      reusedOldIndexes.add(oldIndex)
    }

    for (let index = oldEnd; index >= oldStart; index -= 1) {
      if (!reusedOldIndexes.has(index)) disposeRow(previous[index])
    }

    const stable = stableIndexes(middleOldIndexes)
    let cursor = next[nextEnd + 1]?.node ?? before
    for (let index = nextEnd; index >= nextStart; index -= 1) {
      let row = next[index]
      if (row === undefined) {
        row = mountRow(index, cursor)
        next[index] = row
      } else {
        const detached = row.node.parentNode !== parent
        if (
          (!stable.has(index - nextStart) || detached) &&
          (detached || row.node.nextSibling !== cursor)
        ) {
          insertBefore(parent, row.node, cursor)
        }
      }
      cursor = row.node
    }

    return next
  })
