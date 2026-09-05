import { insertBefore, removeChild, withDOMHostOperations } from './compiler-runtime/dom.browser'
import { computed, createOwner, disposeOwner, signal, untrack } from './internal-reactive'
import type { CompiledSlotFactory } from './compiler-runtime/mount'

export interface CompiledKeyedRow<T, K = unknown> {
  key: K
  item: T
  node: Node
  last?: Node
  memo?: CompiledListMemo
  patch: (item: T, index: number) => void
  dispose: () => void
}

export interface CompiledKeyedMountResult<T> {
  node: Node
  last?: Node
  memo?: CompiledListMemo
  patch: (item: T, index: number) => void
  dispose: () => void
}

export type CompiledKeyedMount<T> = (item: T, index: number) => CompiledKeyedMountResult<T>

type CompiledKeyedParent = Node & ParentNode

export interface CompiledListMemo {
  read: <T>(read: () => T) => T
  refresh: () => void
  dispose: () => void
}

/** Each keyed row owns its dependency snapshot, independent of its list position. */
export const _$compiledListMemo = (dependencies: () => readonly unknown[]): CompiledListMemo => {
  const revision = signal(0)
  let previous: readonly unknown[] | undefined
  const snapshot = computed(() => {
    revision.get()
    const next = dependencies()
    if (
      !previous ||
      next.length !== previous.length ||
      next.some((value, i) => !Object.is(value, previous![i]))
    ) {
      previous = next.slice()
    }
    return previous
  })
  return {
    read: read => {
      snapshot.get()
      return untrack(read)
    },
    refresh: () => revision.trigger(),
    dispose: () => {
      snapshot.dispose()
      revision.dispose()
    },
  }
}

/** Mount a closed compiled slot factory as one keyed row range. */
export const _$mountCompiledKeyedRow = <T>(
  factory: CompiledSlotFactory,
  patch: (item: T, index: number) => void,
  memo?: CompiledListMemo,
): CompiledKeyedMountResult<T> => {
  const owner = createOwner()
  const staging = document.createDocumentFragment()
  try {
    const block = factory({ parent: staging, before: null }, {}, owner)
    return {
      node: block.first,
      last: block.last,
      patch,
      memo,
      dispose: () => {
        try {
          block.dispose()
        } finally {
          memo?.dispose()
        }
      },
    }
  } catch (error) {
    disposeOwner(owner)
    memo?.dispose()
    throw error
  }
}

const rowLast = <T, K>(row: Pick<CompiledKeyedRow<T, K>, 'node' | 'last'>) => row.last ?? row.node

const moveRowRange = <T, K>(
  parent: CompiledKeyedParent,
  row: Pick<CompiledKeyedRow<T, K>, 'node' | 'last'>,
  before: Node | null,
) => {
  const last = rowLast(row)
  const after = last.nextSibling
  let cursor: Node | null = row.node
  while (cursor !== after) {
    const next: Node | null = cursor!.nextSibling
    insertBefore(parent, cursor!, before)
    cursor = next
  }
}

const isContiguousRowRange = <T, K>(
  parent: CompiledKeyedParent,
  before: Node | null,
  rows: readonly CompiledKeyedRow<T, K>[],
) => {
  let cursor = before
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index]
    const last = row.last ?? row.node
    if (row.node.parentNode !== parent || last.parentNode !== parent || last.nextSibling !== cursor)
      return false
    cursor = row.node
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
  range.setEndAfter(rows[rows.length - 1].last ?? rows[rows.length - 1].node)
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

/** Reconcile synchronous compiler-created row ranges. */
export const _$reconcileKeyed = <T, K>(
  parent: CompiledKeyedParent,
  before: Node | null,
  previous: readonly CompiledKeyedRow<T, K>[],
  items: readonly T[],
  getKey: (item: T, index: number) => K,
  mount: CompiledKeyedMount<T>,
): CompiledKeyedRow<T, K>[] => {
  let reconciled: CompiledKeyedRow<T, K>[] | undefined
  withDOMHostOperations(parent, () => {
    reconciled = (() => {
      const disposeRow = (row: CompiledKeyedRow<T, K>) => {
        try {
          row.dispose()
        } finally {
          if (row.node.parentNode === parent) {
            const last = rowLast(row)
            let cursor: Node | null = row.node
            while (cursor != null) {
              const next: Node | null = cursor.nextSibling
              removeChild(parent, cursor)
              if (cursor === last) break
              cursor = next
            }
          }
        }
      }
      const patchReusedRow = (
        row: CompiledKeyedRow<T, K>,
        item: T,
        previousIndex: number,
        nextIndex: number,
      ) => {
        if (row.memo || !Object.is(row.item, item) || previousIndex !== nextIndex)
          row.patch(item, nextIndex)
        row.memo?.refresh()
        row.item = item
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
      for (let index = 0; index < items.length; index += 1) {
        const key = getKey(items[index], index)
        if (seen.has(key)) {
          throw new Error('[rue] duplicate keys are not supported by compiled keyed lists')
        }
        seen.add(key)
        keys[index] = key
      }

      // js-framework-benchmark's swap operation changes exactly two keyed positions. Patch
      // only the moved rows, and avoid building a 998-entry Map and running LIS.
      if (previous.length === items.length) {
        let firstMismatch = -1
        let secondMismatch = -1
        let tooManyMismatches = false
        let domOrderIsStable = true
        let stableItemsRetained = true
        let cursor = before
        for (let index = previous.length - 1; index >= 0; index -= 1) {
          const row = previous[index]
          if (row.node.parentNode !== parent || rowLast(row).nextSibling !== cursor) {
            domOrderIsStable = false
          }
          cursor = row.node
          if (row.key === keys[index]) {
            if (row.memo || row.item !== items[index]) stableItemsRetained = false
            continue
          }
          if (firstMismatch < 0) firstMismatch = index
          else if (secondMismatch < 0) secondMismatch = index
          else tooManyMismatches = true
        }

        if (domOrderIsStable && firstMismatch < 0) {
          const next = previous.slice() as CompiledKeyedRow<T, K>[]
          for (let index = 0; index < next.length; index += 1) {
            patchReusedRow(next[index], items[index], index, index)
          }
          return next
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
          patchReusedRow(next[firstMismatch], items[firstMismatch], secondMismatch, firstMismatch)
          patchReusedRow(next[secondMismatch], items[secondMismatch], firstMismatch, secondMismatch)

          const lowerMismatch = Math.min(firstMismatch, secondMismatch)
          const upperMismatch = Math.max(firstMismatch, secondMismatch)
          const firstNode = previous[lowerMismatch].node
          const firstRow = previous[lowerMismatch]
          const secondRow = previous[upperMismatch]
          const afterSecond = rowLast(secondRow).nextSibling
          moveRowRange(parent, secondRow, firstNode)
          if (rowLast(firstRow).nextSibling !== afterSecond)
            moveRowRange(parent, firstRow, afterSecond)
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
        const last = mounted.last ?? mounted.node
        if (mounted.node.nodeType === 11 || last.nodeType === 11) {
          mounted.dispose()
          throw new Error('[rue] compiled keyed row ranges must expose direct boundary nodes')
        }

        const row = {
          key: keys[index],
          node: mounted.node,
          patch: mounted.patch,
          dispose: mounted.dispose,
        } as CompiledKeyedRow<T, K>
        if (mounted.memo) Object.defineProperty(row, 'memo', { value: mounted.memo })
        Object.defineProperty(row, 'last', {
          configurable: false,
          enumerable: false,
          value: last,
          writable: false,
        })
        Object.defineProperty(row, 'item', {
          configurable: false,
          enumerable: false,
          value: items[index],
          writable: true,
        })
        try {
          moveRowRange(parent, row, cursor)
        } catch (error) {
          disposeRow(row)
          throw error
        }
        return row
      }

      if (hadDuplicateKeys) previous = []

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
        patchReusedRow(row, items[nextStart], oldStart, nextStart)
        next[nextStart] = row
        oldStart += 1
        nextStart += 1
      }

      while (oldStart <= oldEnd && nextStart <= nextEnd && previous[oldEnd].key === keys[nextEnd]) {
        const row = previous[oldEnd]
        patchReusedRow(row, items[nextEnd], oldEnd, nextEnd)
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
        patchReusedRow(row, items[index], oldIndex, index)
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
            moveRowRange(parent, row, cursor)
          }
        }
        cursor = row.node
      }

      return next
    })()
  })
  return reconciled!
}
