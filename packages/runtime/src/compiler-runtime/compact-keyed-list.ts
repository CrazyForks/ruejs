import {
  createOwner,
  disposeOwner,
  effect,
  runWithOwner,
  signal,
  untrack,
} from '../runtime-core/compiled'
import {
  createDocumentFragment,
  insertBefore,
  removeChild,
  withDOMHostOperations,
} from './dom.browser'

export interface CompactListMemo {
  read: <T>(read: () => T) => T
  refresh: () => void
  dispose: () => void
}

export const _$compiledListMemo = (dependencies: () => readonly unknown[]): CompactListMemo => {
  const snapshot = signal<readonly unknown[]>([], {
    equals: (previous, next) =>
      previous.length === next.length && next.every((value, i) => Object.is(value, previous[i])),
  })
  const refresh = () => snapshot.set(dependencies().slice())
  const watcher = effect(refresh)
  return {
    read: read => {
      snapshot.get()
      return untrack(read)
    },
    refresh: () => untrack(refresh),
    dispose: () => {
      watcher.dispose()
      snapshot.dispose()
    },
  }
}

export interface CompactCompiledKeyedRow<T, K = unknown> {
  key: K
  item: T
  node: Node
  last?: Node
  memo?: CompactListMemo
  patch(item: T, index: number): void
  dispose(): void
}

export type CompactCompiledKeyedMount<T> = (
  item: T,
  index: number,
) => Omit<CompactCompiledKeyedRow<T>, 'key' | 'item'>

const lastNode = (row: Pick<CompactCompiledKeyedRow<unknown>, 'node' | 'last'>) =>
  row.last ?? row.node

const moveRange = (
  parent: Node & ParentNode,
  row: Pick<CompactCompiledKeyedRow<unknown>, 'node' | 'last'>,
  before: Node | null,
): void => {
  const after = lastNode(row).nextSibling
  let cursor: Node | null = row.node
  while (cursor !== after) {
    const next: Node | null = cursor!.nextSibling
    insertBefore(parent, cursor!, before)
    cursor = next
  }
}

const disposeRow = <T, K>(parent: Node & ParentNode, row: CompactCompiledKeyedRow<T, K>) => {
  const last = lastNode(row)
  let cursor: Node | null = row.node
  try {
    row.dispose()
  } finally {
    while (cursor != null) {
      const next: Node | null = cursor.nextSibling
      if (cursor.parentNode === parent) removeChild(parent, cursor)
      if (cursor === last) break
      cursor = next
    }
  }
}

/** Reconcile compiler-created keyed DOM ranges without importing the full runtime facade. */
export const _$reconcileKeyed = <T, K>(
  parent: Node & ParentNode,
  before: Node | null,
  previous: readonly CompactCompiledKeyedRow<T, K>[],
  items: readonly T[],
  getKey: (item: T, index: number) => K,
  mount: CompactCompiledKeyedMount<T>,
): CompactCompiledKeyedRow<T, K>[] => {
  let result: CompactCompiledKeyedRow<T, K>[] = []
  withDOMHostOperations(parent, () => {
    const oldByKey = new Map(previous.map(row => [row.key, row]))
    const seen = new Set<K>()
    result = items.map((item, index) => {
      const key = getKey(item, index)
      if (seen.has(key))
        throw new Error('[rue] duplicate keys are not supported by compiled keyed lists')
      seen.add(key)
      const reused = oldByKey.get(key)
      if (reused) {
        oldByKey.delete(key)
        reused.patch(item, index)
        reused.memo?.refresh()
        reused.item = item
        return reused
      }
      const mounted = mount(item, index)
      return { ...mounted, key, item } as CompactCompiledKeyedRow<T, K>
    })
    for (const row of oldByKey.values()) disposeRow(parent, row)
    let cursor = before
    for (let index = result.length - 1; index >= 0; index -= 1) {
      moveRange(parent, result[index], cursor)
      cursor = result[index].node
    }
  })
  return result
}

export const _$mountCompiledKeyedRow = <T>(
  factory: (
    target: { parent: ParentNode; before: Node | null },
    props: object,
    owner: number,
  ) => {
    first: Node
    last: Node
    dispose(): void
  },
  patch: (item: T, index: number) => void,
  memo?: CompactListMemo,
) => {
  const owner = createOwner()
  const staging = createDocumentFragment()
  try {
    const block = runWithOwner(owner, () => factory({ parent: staging, before: null }, {}, owner))
    if (block == null) throw new Error('[rue] compiled keyed row factory did not return a block')
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
