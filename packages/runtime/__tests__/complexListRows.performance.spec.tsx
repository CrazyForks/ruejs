// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { _$reconcileKeyed, type CompiledKeyedRow } from '../src/compiled-keyed-list'

type Row = { id: number; label: string }

const ids = (parent: ParentNode): number[] =>
  Array.from(parent.querySelectorAll<HTMLElement>(':scope > div')).map(node =>
    Number(node.dataset.id),
  )

describe('compiled complex list row performance', () => {
  it('reorders 5,000 keyed rows with two moves and two patches', () => {
    const parent = document.createElement('section')
    const before = document.createComment('list:end')
    parent.appendChild(before)
    const insertBefore = vi.spyOn(parent, 'insertBefore')
    let patchCount = 0

    const mount = (item: Row, index: number) => {
      const node = document.createElement('div')
      const patch = (next: Row, nextIndex: number) => {
        patchCount += 1
        node.dataset.id = String(next.id)
        node.dataset.index = String(nextIndex)
        node.textContent = next.label
      }
      patch(item, index)
      return { node, patch, dispose: vi.fn() }
    }

    const rows = Array.from({ length: 5_000 }, (_, index) => ({
      id: index + 1,
      label: `row ${index + 1}`,
    }))
    let state = _$reconcileKeyed(parent, before, [], rows, row => row.id, mount)
    patchCount = 0
    insertBefore.mockClear()
    const firstMovedNode = state[1].node
    const secondMovedNode = state[4_998].node

    const next = rows.slice()
    ;[next[1], next[4_998]] = [
      { ...next[4_998], label: 'moved high' },
      { ...next[1], label: 'moved low' },
    ]
    const startedAt = performance.now()
    state = _$reconcileKeyed(parent, before, state, next, row => row.id, mount)
    const durationMs = performance.now() - startedAt

    expect(insertBefore).toHaveBeenCalledTimes(2)
    expect(patchCount).toBe(2)
    expect(state[1].node).toBe(secondMovedNode)
    expect(state[4_998].node).toBe(firstMovedNode)
    expect(ids(parent)).toEqual(next.map(row => row.id))
    expect(durationMs).toBeLessThan(250)
    console.info(
      `[compiled-list-perf] rows=5000 moves=2 patches=2 durationMs=${durationMs.toFixed(2)}`,
    )
  })

  it('updates indexes and disposes removed ranges without rebuilding retained rows', () => {
    const parent = document.createElement('section')
    const before = document.createComment('list:end')
    parent.appendChild(before)
    const mounted = new Map<number, HTMLElement>()
    const disposed: number[] = []

    const mount = (item: Row, index: number) => {
      const node = document.createElement('div')
      const patch = (next: Row, nextIndex: number) => {
        node.dataset.id = String(next.id)
        node.dataset.index = String(nextIndex)
        node.textContent = next.label
      }
      patch(item, index)
      mounted.set(item.id, node)
      return { node, patch, dispose: () => disposed.push(item.id) }
    }

    let state: CompiledKeyedRow<Row, number>[] = _$reconcileKeyed(
      parent,
      before,
      [],
      [
        { id: 1, label: 'one' },
        { id: 2, label: 'two' },
        { id: 3, label: 'three' },
      ],
      row => row.id,
      mount,
    )
    const retained = mounted.get(3)
    state = _$reconcileKeyed(
      parent,
      before,
      state,
      [
        { id: 3, label: 'THREE' },
        { id: 4, label: 'four' },
      ],
      row => row.id,
      mount,
    )

    expect(state[0].node).toBe(retained)
    expect((state[0].node as HTMLElement).dataset.index).toBe('0')
    expect(state[0].node.textContent).toBe('THREE')
    expect(disposed.sort((left, right) => left - right)).toEqual([1, 2])
    expect(ids(parent)).toEqual([3, 4])
  })
})
