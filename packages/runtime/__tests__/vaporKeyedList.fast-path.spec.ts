import { afterEach, describe, expect, it, vi } from 'vitest'

import { signal, setReactiveScheduling, watchEffect } from '../src'
import {
  vaporKeyedList as defaultVaporKeyedList,
  type VaporListItemRange as DefaultVaporListItemRange,
} from '../src/vapor-helpers'
import {
  vaporKeyedList as vaporVaporKeyedList,
  type VaporListItemRange as VaporVaporListItemRange,
} from '../src/vapor-helpers-vapor'

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
  directRoot: boolean
  renderItem: (item: Row, parent: HTMLElement, start: Comment, end: Comment, index?: number) => void
}) => Map<unknown, DefaultVaporListItemRange | VaporVaporListItemRange>

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
      directRoot: true,
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

  render([
    { id: 1, label: 'Alpha 2', className: 'selected' },
    { id: 2, label: 'Beta 2', className: 'waiting' },
  ])

  expect(parent.querySelector('[data-id="1"]')).toBe(firstRow)
  expect(parent.querySelector('[data-id="2"]')).toBe(secondRow)
  expect(firstRow?.textContent).toBe('Alpha 2:0')
  expect(firstRow?.className).toBe('selected')
  expect(secondRow?.textContent).toBe('Beta 2:0')
  expect(secondRow?.className).toBe('waiting')
  expect(renderRuns.get(1)).toBe(1)
  expect(renderRuns.get(2)).toBe(1)

  render([
    { id: 2, label: 'Beta 2', className: 'waiting' },
    { id: 1, label: 'Alpha 2', className: 'selected' },
  ])

  expect(Array.from(parent.querySelectorAll('[data-id]'))).toEqual([secondRow, firstRow])

  const firstRunsBeforeDelete = bindingRuns.get(1)
  render([{ id: 2, label: 'Beta 2', className: 'waiting' }])
  tick.set(1)

  expect(parent.querySelector('[data-id="1"]')).toBeNull()
  expect(bindingRuns.get(1)).toBe(firstRunsBeforeDelete)
  expect(secondRow?.textContent).toBe('Beta 2:1')

  const secondRunsBeforeClear = bindingRuns.get(2)
  render([])
  tick.set(2)

  expect(parent.querySelectorAll('[data-id]')).toHaveLength(0)
  expect(bindingRuns.get(2)).toBe(secondRunsBeforeClear)
}

const exercisePrimitiveDirectRoot = (vaporKeyedList: ListHelper) => {
  const parent = document.createElement('div')
  const end = document.createComment('rue:list:end')
  const tick = signal(0, {}, true)
  const bindingRuns = new Map<string, number>()
  let elements = new Map<unknown, DefaultVaporListItemRange | VaporVaporListItemRange>()

  parent.appendChild(end)
  document.body.appendChild(parent)

  const render = (value?: string) => {
    elements = vaporKeyedList({
      items: value === undefined ? [] : ([value] as unknown as Row[]),
      getKey: () => 'stable-key',
      elements,
      parent,
      before: end,
      singleRoot: true,
      trackIndex: false,
      directRoot: true,
      renderItem: (item, listParent, anchor) => {
        const primitive = item as unknown as string
        const row = document.createElement('div')
        listParent.insertBefore(row, anchor)
        watchEffect(() => {
          bindingRuns.set(primitive, (bindingRuns.get(primitive) ?? 0) + 1)
          row.textContent = `${primitive}:${tick.get()}`
        })
      },
    })
  }

  render('alpha')
  const firstRow = parent.querySelector('div')
  expect(firstRow?.textContent).toBe('alpha:0')

  render('beta')
  const secondRow = parent.querySelector('div')
  expect(parent.querySelectorAll('div')).toHaveLength(1)
  expect(secondRow).not.toBe(firstRow)
  expect(secondRow?.textContent).toBe('beta:0')

  const alphaRuns = bindingRuns.get('alpha')
  tick.set(1)
  expect(bindingRuns.get('alpha')).toBe(alphaRuns)
  expect(secondRow?.textContent).toBe('beta:1')

  render()
  expect(parent.querySelectorAll('div')).toHaveLength(0)
}

describe('vaporKeyedList stable single-root fast path', () => {
  it('omits redundant renderState for stable single roots', () => {
    exerciseStableSingleRoot(defaultVaporKeyedList as ListHelper)
  })

  it('keeps the Vapor entry helper semantically aligned', () => {
    exerciseStableSingleRoot(vaporVaporKeyedList as ListHelper)
  })

  it('remounts primitive direct roots when a stable key points to a new value', () => {
    exercisePrimitiveDirectRoot(defaultVaporKeyedList as ListHelper)
    exercisePrimitiveDirectRoot(vaporVaporKeyedList as ListHelper)
  })
})
