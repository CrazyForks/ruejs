import { insertBefore, removeChild, withDOMHostOperations } from './compiled-dom'

export interface CompiledKeyedRow<T, K = unknown> {
  key: K
  item: T
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

const isContiguousRowRange = <T, K>(
  parent: CompiledKeyedParent,
  before: Node | null,
  rows: readonly CompiledKeyedRow<T, K>[],
) => {
  let cursor = before
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const node = rows[index].node
    if (node.parentNode !== parent || node.nextSibling !== cursor) return false
    cursor = node
  }
  return true
}

const clearContiguousRows = <T, K>(
  parent: CompiledKeyedParent,
  before: Node | null,
  rows: readonly CompiledKeyedRow<T, K>[],
) => {
  if (rows.length === 0) return true
  const document = rows[0].node.ownerDocument
  if (document == null || typeof document.createRange !== 'function') return false
  if (!isContiguousRowRange(parent, before, rows)) return false

  const range = document.createRange()
  range.setStartBefore(rows[0].node)
  range.setEndAfter(rows[rows.length - 1].node)
  try {
    for (let index = rows.length - 1; index >= 0; index -= 1) rows[index].dispose()
  } finally {
    range.deleteContents()
    range.detach()
  }
  return true
}

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
      if (!clearContiguousRows(parent, before, previous)) {
        for (let index = previous.length - 1; index >= 0; index -= 1) disposeRow(previous[index])
      }
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

    // js-framework-benchmark's swap operation changes exactly two keyed positions. Keep
    // patch semantics for every row, but avoid building a 998-entry Map and running LIS.
    if (!hasDuplicateKeys && previous.length === items.length) {
      let firstMismatch = -1
      let secondMismatch = -1
      let tooManyMismatches = false
      let domOrderIsStable = true
      let stableItemsRetained = true
      let cursor = before
      for (let index = previous.length - 1; index >= 0; index -= 1) {
        const row = previous[index]
        if (row.node.parentNode !== parent || row.node.nextSibling !== cursor) {
          domOrderIsStable = false
        }
        cursor = row.node
        if (row.key === keys[index]) {
          if (row.item !== items[index]) stableItemsRetained = false
          continue
        }
        if (firstMismatch < 0) firstMismatch = index
        else if (secondMismatch < 0) secondMismatch = index
        else tooManyMismatches = true
      }

      if (
        domOrderIsStable &&
        stableItemsRetained &&
        !tooManyMismatches &&
        firstMismatch >= 0 &&
        secondMismatch >= 0 &&
        previous[firstMismatch].key === keys[secondMismatch] &&
        previous[secondMismatch].key === keys[firstMismatch]
      ) {
        const next = previous.slice() as CompiledKeyedRow<T, K>[]
        next[firstMismatch] = previous[secondMismatch]
        next[secondMismatch] = previous[firstMismatch]
        for (let index = 0; index < next.length; index += 1) {
          next[index].patch(items[index], index)
          next[index].item = items[index]
        }

        const firstNode = previous[firstMismatch].node
        const secondNode = previous[secondMismatch].node
        const afterSecond = secondNode.nextSibling
        insertBefore(parent, secondNode, firstNode)
        if (firstNode.nextSibling !== afterSecond) insertBefore(parent, firstNode, afterSecond)
        return next
      }
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

      const row = {
        key: keys[index],
        node: mounted.node,
        patch: mounted.patch,
        dispose: mounted.dispose,
      } as CompiledKeyedRow<T, K>
      Object.defineProperty(row, 'item', {
        configurable: false,
        enumerable: false,
        value: items[index],
        writable: true,
      })
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
      row.item = items[nextStart]
      next[nextStart] = row
      oldStart += 1
      nextStart += 1
    }

    while (oldStart <= oldEnd && nextStart <= nextEnd && previous[oldEnd].key === keys[nextEnd]) {
      const row = previous[oldEnd]
      row.patch(items[nextEnd], nextEnd)
      row.item = items[nextEnd]
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
      row.item = items[index]
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
