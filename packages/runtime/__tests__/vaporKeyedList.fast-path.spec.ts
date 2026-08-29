import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  effectScope,
  getCurrentScope,
  onScopeDispose,
  signal,
  setReactiveScheduling,
  watchEffect,
} from '../src'
import type { EffectScope } from '../src'
import { __rueGetEffectScopeDebugState } from '@rue-js/runtime-vapor/reactive'
import {
  vaporKeyedList as defaultVaporKeyedList,
  type VaporListItemRange as DefaultVaporListItemRange,
} from '../src/vapor-helpers'
import {
  vaporKeyedList as vaporVaporKeyedList,
  type VaporListItemRange as VaporVaporListItemRange,
} from '../src/vapor-helpers'

setReactiveScheduling('sync')

afterEach(() => {
  document.body.innerHTML = ''
})

type Row = {
  id: number
  label: string
  className: string
}

type ListHelper = (args: {
  items: Row[]
  getKey: (item: Row, index: number) => unknown
  elements: Map<unknown, DefaultVaporListItemRange | VaporVaporListItemRange>
  parent: HTMLElement
  before: Comment
  singleRoot: boolean
  trackIndex: boolean
  renderItem: (item: Row, parent: HTMLElement, start: Comment, end: Comment, index?: number) => void
  state?: ListState
}) => Map<unknown, DefaultVaporListItemRange | VaporVaporListItemRange>

type ListState = {
  elements: Map<unknown, DefaultVaporListItemRange | VaporVaporListItemRange>
  disposed?: boolean
  dispose?: () => void
  __debug?: {
    cleanupRegistrations: number
    disposedRows: number
  }
}

type InspectableRowOwner = DefaultVaporListItemRange & {
  scope?: EffectScope
  refCleanups?: Array<() => void>
  ownedMountCleanups?: Array<() => void>
  pendingMounted?: unknown[]
  generation?: number
  disposed?: boolean
}

const exerciseStableSingleRoot = (vaporKeyedList: ListHelper) => {
  const parent = document.createElement('div')
  const end = document.createComment('rue:list:end')
  const tick = signal(0, {}, true)
  const renderRuns = new Map<number, number>()
  const bindingRuns = new Map<number, number>()
  let elements = new Map<unknown, DefaultVaporListItemRange | VaporVaporListItemRange>()

  parent.appendChild(end)
  document.body.appendChild(parent)
  const parentInsertBefore = vi.spyOn(parent, 'insertBefore')

  const render = (items: Row[]) => {
    elements = vaporKeyedList({
      items,
      getKey: item => item.id,
      elements,
      parent,
      before: end,
      singleRoot: true,
      trackIndex: false,
      renderItem: (item, listParent, anchor) => {
        const id = item.id
        const row = document.createElement('div')

        renderRuns.set(id, (renderRuns.get(id) ?? 0) + 1)
        row.dataset.id = String(id)
        listParent.insertBefore(row, anchor)

        watchEffect(() => {
          bindingRuns.set(id, (bindingRuns.get(id) ?? 0) + 1)
          row.className = item.className
          row.textContent = `${item.label}:${tick.get()}`
        })
      },
    })
  }

  render([
    { id: 1, label: 'Alpha', className: 'idle' },
    { id: 2, label: 'Beta', className: 'ready' },
  ])

  expect(parentInsertBefore).toHaveBeenCalledTimes(1)
  parentInsertBefore.mockRestore()

  const firstRange = elements.get(1)
  const firstRow = parent.querySelector('[data-id="1"]')
  const secondRow = parent.querySelector('[data-id="2"]')

  expect(firstRange?.current).toBeDefined()
  expect(firstRange?.renderState).toBeUndefined()
  expect(firstRange?.stop).toBeTypeOf('function')
  expect(renderRuns).toEqual(
    new Map([
      [1, 1],
      [2, 1],
    ]),
  )

  const updatedFirst = { id: 1, label: 'Alpha 2', className: 'selected' }
  const updatedSecond = { id: 2, label: 'Beta 2', className: 'waiting' }

  render([updatedFirst, updatedSecond])

  expect(parent.querySelector('[data-id="1"]')).toBe(firstRow)
  expect(parent.querySelector('[data-id="2"]')).toBe(secondRow)
  expect(firstRow?.textContent).toBe('Alpha 2:0')
  expect(firstRow?.className).toBe('selected')
  expect(secondRow?.textContent).toBe('Beta 2:0')
  expect(secondRow?.className).toBe('waiting')
  expect(renderRuns.get(1)).toBe(1)
  expect(renderRuns.get(2)).toBe(1)

  const firstRunsBeforeSwap = bindingRuns.get(1)
  const secondRunsBeforeSwap = bindingRuns.get(2)
  render([updatedSecond, updatedFirst])

  expect(Array.from(parent.querySelectorAll('[data-id]'))).toEqual([secondRow, firstRow])
  expect(bindingRuns.get(1)).toBe(firstRunsBeforeSwap)
  expect(bindingRuns.get(2)).toBe(secondRunsBeforeSwap)

  const firstRunsBeforeDelete = bindingRuns.get(1)
  const secondRunsBeforeDelete = bindingRuns.get(2)
  render([updatedFirst])

  expect(parent.querySelector('[data-id="1"]')).toBe(firstRow)
  expect(parent.querySelector('[data-id="2"]')).toBeNull()
  expect(bindingRuns.get(1)).toBe(firstRunsBeforeDelete)

  tick.set(1)

  expect(bindingRuns.get(2)).toBe(secondRunsBeforeDelete)
  expect(firstRow?.textContent).toBe('Alpha 2:1')

  const firstRunsBeforeClear = bindingRuns.get(1)
  render([])
  tick.set(2)

  expect(parent.querySelectorAll('[data-id]')).toHaveLength(0)
  expect(bindingRuns.get(1)).toBe(firstRunsBeforeClear)
}

describe('vaporKeyedList compatibility owner path', () => {
  it('does not expose compiler-only row flags or owner state', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'packages/runtime/src/vapor-helpers.ts'),
      'utf8',
    )
    const removedNames = ['direct' + 'Root', 'compiled' + 'RowPatch']

    for (const name of removedNames) expect(source).not.toContain(name)
  })

  it('keeps keyed row identity while rebuilding order', () => {
    const exercise = (vaporKeyedList: ListHelper) => {
      const parent = document.createElement('div')
      const end = document.createComment('rue:list:end')
      let elements = new Map<unknown, DefaultVaporListItemRange | VaporVaporListItemRange>()
      const rows = Array.from({ length: 64 }, (_, index) => ({
        id: index + 1,
        label: `row-${index + 1}`,
        className: 'row',
      }))

      parent.appendChild(end)
      document.body.appendChild(parent)
      const render = (items: Row[]) => {
        elements = vaporKeyedList({
          items,
          getKey: item => item.id,
          elements,
          parent,
          before: end,
          singleRoot: true,
          trackIndex: false,
          renderItem: (item, listParent, anchor) => {
            const row = document.createElement('div')
            row.dataset.id = String(item.id)
            listParent.insertBefore(row, anchor)
          },
        })
      }

      render(rows)
      const initialNodes = new Map(
        Array.from(parent.querySelectorAll<HTMLElement>('[data-id]')).map(node => [
          Number(node.dataset.id),
          node,
        ]),
      )
      render(rows.slice().reverse())
      expect(Array.from(parent.querySelectorAll<HTMLElement>('[data-id]'))).toEqual(
        rows
          .slice()
          .reverse()
          .map(row => initialNodes.get(row.id)),
      )
      expect(parent.lastChild).toBe(end)
    }

    exercise(defaultVaporKeyedList as ListHelper)
    exercise(vaporVaporKeyedList as ListHelper)
  })

  it('reuses and disposes one owner per keyed or positional row', () => {
    const exercise = (vaporKeyedList: ListHelper) => {
      const mount = (getKey: (item: Row, index: number) => unknown) => {
        const parent = document.createElement('div')
        const end = document.createComment('rue:list:end')
        const outer = effectScope(true)
        const state: ListState = { elements: new Map() }
        const cleanupCounts = new Map<number, number>()
        const rowScopes = new Map<number, EffectScope>()
        const tick = signal(0, {}, true)
        const activeBeforeRender = getCurrentScope()

        parent.appendChild(end)
        document.body.appendChild(parent)

        const render = (items: Row[]) => {
          outer.run(() => {
            const activeOuter = getCurrentScope()
            state.elements = vaporKeyedList({
              items,
              getKey,
              elements: state.elements,
              state,
              parent,
              before: end,
              singleRoot: true,
              trackIndex: false,
              renderItem: (item, listParent, anchor) => {
                const scope = getCurrentScope()
                expect(scope).toBeDefined()
                expect(scope).not.toBe(activeOuter)
                rowScopes.set(item.id, scope!)
                onScopeDispose(() => {
                  cleanupCounts.set(item.id, (cleanupCounts.get(item.id) ?? 0) + 1)
                })

                const row = document.createElement('div')
                row.dataset.id = String(item.id)
                listParent.insertBefore(row, anchor)
                watchEffect(() => {
                  row.textContent = `${item.label}:${tick.get()}`
                })
              },
            })
            expect(getCurrentScope()).toBe(activeOuter)
          })
          expect(getCurrentScope()).toBe(activeBeforeRender)
        }

        return { parent, outer, state, cleanupCounts, rowScopes, tick, render }
      }

      const keyed = mount(item => item.id)
      const first = { id: 1, label: 'first', className: 'row' }
      const second = { id: 2, label: 'second', className: 'row' }
      keyed.render([first, second])

      const firstOwner = keyed.state.elements.get(1) as InspectableRowOwner
      const secondOwner = keyed.state.elements.get(2) as InspectableRowOwner
      const firstNode = keyed.parent.querySelector('[data-id="1"]')
      const secondNode = keyed.parent.querySelector('[data-id="2"]')
      expect(firstOwner).toMatchObject({ generation: 0, disposed: false })
      expect(firstOwner.scope).toBe(keyed.rowScopes.get(1))
      expect(firstOwner.refCleanups).toEqual([])
      expect(firstOwner.ownedMountCleanups).toEqual([])
      expect(firstOwner.pendingMounted).toEqual([])

      keyed.render([
        { ...first, label: 'first-updated' },
        { ...second, label: 'second-updated' },
      ])
      expect(keyed.state.elements.get(1)).toBe(firstOwner)
      expect(keyed.state.elements.get(2)).toBe(secondOwner)
      expect(keyed.parent.querySelector('[data-id="1"]')).toBe(firstNode)
      expect(keyed.parent.querySelector('[data-id="2"]')).toBe(secondNode)

      keyed.render([
        { ...second, label: 'second-moved' },
        { ...first, label: 'first-moved' },
      ])
      expect(Array.from(keyed.parent.querySelectorAll('[data-id]'))).toEqual([
        secondNode,
        firstNode,
      ])
      expect(keyed.state.elements.get(1)).toBe(firstOwner)
      expect(keyed.state.elements.get(2)).toBe(secondOwner)

      keyed.render([{ ...first, label: 'first-only' }])
      expect(secondOwner).toMatchObject({ generation: 1, disposed: true })
      expect(keyed.cleanupCounts.get(2)).toBe(1)
      const secondText = secondNode?.textContent
      keyed.tick.set(1)
      expect(secondNode?.textContent).toBe(secondText)

      keyed.render([])
      expect(firstOwner).toMatchObject({ generation: 1, disposed: true })
      expect(keyed.cleanupCounts.get(1)).toBe(1)
      keyed.outer.stop()
      keyed.state.dispose?.()
      expect(keyed.cleanupCounts).toEqual(
        new Map([
          [1, 1],
          [2, 1],
        ]),
      )

      const positional = mount((_item, index) => index)
      positional.render([first, second])
      const positionZeroOwner = positional.state.elements.get(0)
      const positionOneOwner = positional.state.elements.get(1)
      const positionZeroNode = positional.parent.querySelector('[data-id="1"]')
      const positionOneNode = positional.parent.querySelector('[data-id="2"]')
      positional.render([
        { ...second, label: 'second-at-zero' },
        { ...first, label: 'first-at-one' },
      ])
      expect(positional.state.elements.get(0)).toBe(positionZeroOwner)
      expect(positional.state.elements.get(1)).toBe(positionOneOwner)
      expect(Array.from(positional.parent.querySelectorAll('[data-id]'))).toEqual([
        positionZeroNode,
        positionOneNode,
      ])
      positional.render([])
      positional.outer.stop()

      const duplicate = mount(item => item.id)
      const duplicateRows = [
        first,
        { ...first, label: 'duplicate-a' },
        { ...first, label: 'duplicate-b' },
      ]
      duplicate.render(duplicateRows)
      const firstDuplicateOwners = Array.from(duplicate.state.elements.values())
      expect(firstDuplicateOwners).toHaveLength(3)
      expect(new Set(firstDuplicateOwners).size).toBe(3)
      expect(duplicate.parent.querySelectorAll('[data-id]')).toHaveLength(3)

      duplicate.render(duplicateRows.map(item => ({ ...item, label: `${item.label}-next` })))
      const secondDuplicateOwners = Array.from(duplicate.state.elements.values())
      expect(secondDuplicateOwners).toHaveLength(3)
      expect(secondDuplicateOwners.every(owner => !firstDuplicateOwners.includes(owner))).toBe(true)
      expect(
        firstDuplicateOwners.every(owner => (owner as InspectableRowOwner).disposed === true),
      ).toBe(true)
      duplicate.render([])
      duplicate.outer.stop()

      const failed = mount(item => item.id)
      failed.outer.run(() => {
        const activeOuter = getCurrentScope()
        expect(() =>
          vaporKeyedList({
            items: [first, second],
            getKey: item => item.id,
            elements: failed.state.elements,
            state: failed.state,
            parent: failed.parent,
            before: failed.parent.lastChild as Comment,
            singleRoot: true,
            trackIndex: false,
            renderItem: item => {
              onScopeDispose(() => {})
              if (item.id === 2) throw new Error('owner-build-failed')
            },
          }),
        ).toThrow('owner-build-failed')
        expect(getCurrentScope()).toBe(activeOuter)
      })
      expect(failed.state.elements.size).toBe(0)
      failed.outer.stop()
    }

    exercise(defaultVaporKeyedList as ListHelper)
    exercise(vaporVaporKeyedList as ListHelper)
  })

  it('releases detached row scopes without historical metadata growth', () => {
    const exercise = (vaporKeyedList: ListHelper) => {
      const parent = document.createElement('div')
      const end = document.createComment('rue:list:end')
      const baseline = __rueGetEffectScopeDebugState()
      const owner = effectScope(true)
      const ownerBaseline = __rueGetEffectScopeDebugState()
      const state: ListState = { elements: new Map() }
      const rowScopes: EffectScope[] = []
      let rowCleanupCount = 0

      parent.appendChild(end)
      document.body.appendChild(parent)

      const render = (items: Row[]) => {
        owner.run(() => {
          state.elements = vaporKeyedList({
            items,
            getKey: item => item.id,
            elements: state.elements,
            state,
            parent,
            before: end,
            singleRoot: true,
            trackIndex: false,
            renderItem: (item, listParent, anchor) => {
              const rowScope = getCurrentScope()
              expect(rowScope).toBeDefined()
              rowScopes.push(rowScope!)
              onScopeDispose(() => {
                rowCleanupCount += 1
              })

              const row = document.createElement('div')
              row.dataset.id = String(item.id)
              listParent.insertBefore(row, anchor)
              watchEffect(() => {
                row.textContent = item.label
              })
            },
          })
        })
      }

      for (let round = 0; round < 100; round += 1) {
        render([{ id: round, label: `row-${round}`, className: 'row' }])
        render([])
      }

      expect(state.elements.size).toBe(0)
      expect(state.__debug?.cleanupRegistrations).toBe(1)
      expect(state.__debug?.disposedRows).toBe(0)
      expect(rowCleanupCount).toBe(100)
      expect(rowScopes.every(scope => scope.active === false)).toBe(true)
      expect(__rueGetEffectScopeDebugState()).toEqual(ownerBaseline)

      render([
        { id: 100, label: 'live-100', className: 'row' },
        { id: 101, label: 'live-101', className: 'row' },
      ])
      const cleanupBeforeOuterStop = rowCleanupCount
      expect(state.elements.size).toBe(2)

      owner.stop()

      expect(state.disposed).toBe(true)
      expect(state.elements.size).toBe(0)
      expect(state.__debug).toEqual({ cleanupRegistrations: 1, disposedRows: 2 })
      expect(rowCleanupCount - cleanupBeforeOuterStop).toBe(2)
      expect(rowScopes.every(scope => scope.active === false)).toBe(true)
      expect(__rueGetEffectScopeDebugState()).toEqual(baseline)

      state.dispose?.()
      expect(rowCleanupCount - cleanupBeforeOuterStop).toBe(2)
    }

    exercise(defaultVaporKeyedList as ListHelper)
    exercise(vaporVaporKeyedList as ListHelper)
  })

  it('registers one owner cleanup for each stable state across multiple lists and updates', () => {
    const baseline = __rueGetEffectScopeDebugState()
    const owner = effectScope(true)
    const firstState: ListState = { elements: new Map() }
    const secondState: ListState = { elements: new Map() }

    const render = (state: ListState, id: number, label: string) => {
      const parent = document.createElement('div')
      const end = document.createComment('rue:list:end')
      parent.appendChild(end)
      document.body.appendChild(parent)
      owner.run(() => {
        state.elements = (defaultVaporKeyedList as ListHelper)({
          items: [{ id, label, className: 'row' }],
          getKey: item => item.id,
          elements: state.elements,
          state,
          parent,
          before: end,
          singleRoot: true,
          trackIndex: false,
          renderItem: (item, listParent, anchor) => {
            const row = document.createElement('div')
            row.textContent = item.label
            listParent.insertBefore(row, anchor)
          },
        })
      })
    }

    render(firstState, 1, 'first')
    render(firstState, 1, 'first-updated')
    render(secondState, 2, 'second')
    render(secondState, 2, 'second-updated')

    expect(firstState.__debug?.cleanupRegistrations).toBe(1)
    expect(secondState.__debug?.cleanupRegistrations).toBe(1)
    owner.stop()
    expect(firstState.__debug).toEqual({ cleanupRegistrations: 1, disposedRows: 1 })
    expect(secondState.__debug).toEqual({ cleanupRegistrations: 1, disposedRows: 1 })
    expect(__rueGetEffectScopeDebugState()).toEqual(baseline)
  })

  it('supports explicit list disposal and rolls back failed detached row builds', () => {
    const exercise = (vaporKeyedList: ListHelper) => {
      const baseline = __rueGetEffectScopeDebugState()
      const parent = document.createElement('div')
      const end = document.createComment('rue:list:end')
      const state: ListState = { elements: new Map() }
      let liveScope: EffectScope | undefined

      parent.appendChild(end)
      document.body.appendChild(parent)
      state.elements = vaporKeyedList({
        items: [{ id: 1, label: 'live', className: 'row' }],
        getKey: item => item.id,
        elements: state.elements,
        state,
        parent,
        before: end,
        singleRoot: true,
        trackIndex: false,
        renderItem: (item, listParent, anchor) => {
          liveScope = getCurrentScope()
          const row = document.createElement('div')
          row.textContent = item.label
          listParent.insertBefore(row, anchor)
        },
      })

      expect(state.__debug?.cleanupRegistrations).toBe(0)
      expect(liveScope?.active).toBe(true)
      state.dispose?.()
      expect(liveScope?.active).toBe(false)
      expect(__rueGetEffectScopeDebugState()).toEqual(baseline)

      const failedState: ListState = { elements: new Map() }
      expect(() =>
        vaporKeyedList({
          items: [
            { id: 2, label: 'built', className: 'row' },
            { id: 3, label: 'throws', className: 'row' },
          ],
          getKey: item => item.id,
          elements: failedState.elements,
          state: failedState,
          parent,
          before: end,
          singleRoot: true,
          trackIndex: false,
          renderItem: item => {
            watchEffect(() => item.label)
            if (item.id === 3) throw new Error('row-build-failed')
          },
        }),
      ).toThrow('row-build-failed')

      expect(failedState.elements.size).toBe(0)
      expect(__rueGetEffectScopeDebugState()).toEqual(baseline)
    }

    exercise(defaultVaporKeyedList as ListHelper)
    exercise(vaporVaporKeyedList as ListHelper)
  })

  it('omits redundant renderState for stable single roots', () => {
    exerciseStableSingleRoot(defaultVaporKeyedList as ListHelper)
  })

  it('keeps the Vapor entry helper semantically aligned', () => {
    exerciseStableSingleRoot(vaporVaporKeyedList as ListHelper)
  })
})
