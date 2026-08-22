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

  const retiredRuns = new Map<string, number>()

  for (let round = 0; round < 3; round += 1) {
    const initial = `initial-${round}`
    const replacement = `replacement-${round}`

    render(initial)
    const firstRow = parent.querySelector('div')
    expect(firstRow?.textContent).toBe(`${initial}:${round * 2}`)

    render(replacement)
    const secondRow = parent.querySelector('div')
    expect(parent.querySelectorAll('div')).toHaveLength(1)
    expect(secondRow).not.toBe(firstRow)
    expect(secondRow?.textContent).toBe(`${replacement}:${round * 2}`)

    retiredRuns.set(initial, bindingRuns.get(initial)!)
    tick.set(round * 2 + 1)
    expect(bindingRuns.get(initial)).toBe(retiredRuns.get(initial))
    expect(secondRow?.textContent).toBe(`${replacement}:${round * 2 + 1}`)

    render()
    expect(parent.querySelectorAll('div')).toHaveLength(0)
    retiredRuns.set(replacement, bindingRuns.get(replacement)!)

    tick.set(round * 2 + 2)
    retiredRuns.forEach((runs, label) => {
      expect(bindingRuns.get(label)).toBe(runs)
    })
  }

  render('live')
  const liveRow = parent.querySelector('div')
  const liveRuns = bindingRuns.get('live')!
  tick.set(7)

  retiredRuns.forEach((runs, label) => {
    expect(bindingRuns.get(label)).toBe(runs)
  })
  expect(bindingRuns.get('live')).toBe(liveRuns + 1)
  expect(liveRow?.textContent).toBe('live:7')
}

const exerciseCommonDiffOperations = (vaporKeyedList: ListHelper) => {
  const parent = document.createElement('div')
  const end = document.createComment('rue:list:end')
  let elements = new Map<unknown, DefaultVaporListItemRange | VaporVaporListItemRange>()

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
      directRoot: true,
      renderItem: (item, listParent, anchor) => {
        const row = document.createElement('div')
        row.dataset.id = String(item.id)
        listParent.insertBefore(row, anchor)
        watchEffect(() => {
          row.textContent = item.label
        })
      },
    })
  }

  const first = { id: 1, label: 'Alpha', className: 'idle' }
  const second = { id: 2, label: 'Beta', className: 'ready' }
  const third = { id: 3, label: 'Gamma', className: 'waiting' }
  render([first, second, third])

  const firstRow = parent.querySelector('[data-id="1"]')
  const secondRow = parent.querySelector('[data-id="2"]')
  const thirdRow = parent.querySelector('[data-id="3"]')
  const insertBefore = vi.spyOn(parent, 'insertBefore')
  const appendChild = vi.spyOn(parent, 'appendChild')
  const removeChild = vi.spyOn(parent, 'removeChild')
  const resetOperationCounts = () => {
    insertBefore.mockClear()
    appendChild.mockClear()
    removeChild.mockClear()
  }

  const updatedFirst = { ...first, label: 'Alpha 2' }
  const updatedSecond = { ...second, label: 'Beta 2' }
  const updatedThird = { ...third, label: 'Gamma 2' }
  render([updatedFirst, updatedSecond, updatedThird])

  expect(insertBefore).not.toHaveBeenCalled()
  expect(appendChild).not.toHaveBeenCalled()
  expect(removeChild).not.toHaveBeenCalled()
  expect(parent.querySelector('[data-id="1"]')).toBe(firstRow)
  expect(parent.querySelector('[data-id="2"]')).toBe(secondRow)
  expect(parent.querySelector('[data-id="3"]')).toBe(thirdRow)
  expect(firstRow?.textContent).toBe('Alpha 2')
  expect(secondRow?.textContent).toBe('Beta 2')
  expect(thirdRow?.textContent).toBe('Gamma 2')

  resetOperationCounts()
  const fourth = { id: 4, label: 'Delta', className: 'new' }
  render([updatedFirst, updatedSecond, updatedThird, fourth])

  expect(insertBefore).toHaveBeenCalledTimes(2)
  expect(appendChild).not.toHaveBeenCalled()
  expect(removeChild).not.toHaveBeenCalled()
  expect(Array.from(parent.querySelectorAll('[data-id]')).slice(0, 3)).toEqual([
    firstRow,
    secondRow,
    thirdRow,
  ])

  resetOperationCounts()
  render([updatedFirst, updatedSecond, updatedThird])

  expect(insertBefore).not.toHaveBeenCalled()
  expect(appendChild).not.toHaveBeenCalled()
  expect(removeChild).toHaveBeenCalledTimes(2)
  expect(Array.from(parent.querySelectorAll('[data-id]'))).toEqual([firstRow, secondRow, thirdRow])

  resetOperationCounts()
  render([updatedThird, updatedFirst, updatedSecond])

  expect(insertBefore).toHaveBeenCalledTimes(1)
  expect(appendChild).not.toHaveBeenCalled()
  expect(removeChild).not.toHaveBeenCalled()
  expect(Array.from(parent.querySelectorAll('[data-id]'))).toEqual([thirdRow, firstRow, secondRow])
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

  it('bounds DOM operations for unchanged, append, tail-remove, and small reorder paths', () => {
    exerciseCommonDiffOperations(defaultVaporKeyedList as ListHelper)
    exerciseCommonDiffOperations(vaporVaporKeyedList as ListHelper)
  })
})
