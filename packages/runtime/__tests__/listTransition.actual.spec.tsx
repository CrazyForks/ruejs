import { afterEach, describe, expect, it, vi } from 'vitest'

import { TransitionGroup, render, setReactiveScheduling } from '../src'
import ListTransitionExample from '../../../app/pages/examples/ListTransition'
import { click, flush, mountContainer, waitForContent } from './page-test-utils'

vi.mock('../../../app/pages/site/SidebarPlaygroundExample', () => ({
  default: (props: { children?: unknown }) => (
    <div data-testid="mock-sidebar-example">{props.children}</div>
  ),
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: () => null,
}))

setReactiveScheduling('sync')

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

const findTab = (root: ParentNode, label: string) =>
  Array.from(root.querySelectorAll('button[role="tab"]')).find(
    button => button.textContent?.trim() === label,
  ) ?? null

const listNumbers = (root: ParentNode) =>
  Array.from(root.querySelectorAll('.list-shell ul > li > span')).map(node =>
    node.textContent?.trim(),
  )

const listItemByNumber = (root: ParentNode, label: string) =>
  Array.from(root.querySelectorAll('.list-shell ul > li')).find(
    item => item.querySelector('span')?.textContent?.trim() === label,
  ) as HTMLLIElement | undefined

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('ListTransitionExample actual page', () => {
  it('renders the initial list and inserts a deterministic item in preview mode', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const container = mountContainer()
    resetActiveRuntime()
    render(<ListTransitionExample />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('带过渡动效的列表（移植自 Vue）')
      expect(findTab(container, '效果')?.className).toContain('tab-active')
      expect(listNumbers(container)).toEqual(['1', '2', '3', '4', '5'])
    })
    await flush()

    const insertButton = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent?.trim() === 'Insert at random index',
    )
    await click(insertButton ?? null)

    const insertedItem = listItemByNumber(container, '6')
    expect(insertedItem?.classList.contains('list-enter-active')).toBe(true)
    expect(insertedItem?.classList.contains('list-enter-from')).toBe(true)

    await waitForContent(() => {
      expect(listNumbers(container)).toEqual(['6', '1', '2', '3', '4', '5'])
    })

    await click(findTab(container, '代码'))

    expect(container.querySelector('.list-shell')).toBeNull()
  })

  it('keeps transition behavior when the builtin component function name is minified', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const originalName = Object.getOwnPropertyDescriptor(TransitionGroup, 'name')
    Object.defineProperty(TransitionGroup, 'name', {
      value: 'R',
      configurable: true,
    })

    try {
      const container = mountContainer()
      resetActiveRuntime()
      render(<ListTransitionExample />, container)

      await waitForContent(() => {
        expect(listNumbers(container)).toEqual(['1', '2', '3', '4', '5'])
      })
      await flush()

      const insertButton = Array.from(container.querySelectorAll('button')).find(
        button => button.textContent?.trim() === 'Insert at random index',
      )
      await click(insertButton ?? null)

      const insertedItem = listItemByNumber(container, '6')
      expect(insertedItem?.classList.contains('list-enter-active')).toBe(true)
      expect(insertedItem?.classList.contains('list-enter-from')).toBe(true)
    } finally {
      if (originalName) {
        Object.defineProperty(TransitionGroup, 'name', originalName)
      }
    }
  })

  it('supports delete, reset, and shuffle while a leave transition is active', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const container = mountContainer()
    resetActiveRuntime()
    render(<ListTransitionExample />, container)
    await waitForContent(() => {
      expect(listNumbers(container)).toEqual(['1', '2', '3', '4', '5'])
    })
    await flush()
    vi.useFakeTimers()
    const stableItems = ['1', '3', '4', '5'].map(label => listItemByNumber(container, label)!)

    listItemByNumber(container, '2')?.querySelector<HTMLButtonElement>('button')?.click()
    await Promise.resolve()
    expect(listItemByNumber(container, '2')?.classList.contains('list-leave-active')).toBe(true)

    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
    buttons.find(button => button.textContent?.trim() === 'Reset')?.click()
    buttons.find(button => button.textContent?.trim() === 'Shuffle')?.click()
    await Promise.resolve()

    expect(
      listNumbers(container).filter((value, index, values) => values.indexOf(value) === index),
    ).toEqual(['2', '3', '4', '5', '1'])
    for (const item of stableItems) {
      expect(item.classList.contains('list-enter-active')).toBe(false)
      expect(item.classList.contains('list-leave-active')).toBe(false)
    }
    await vi.advanceTimersByTimeAsync(350)
    expect(listNumbers(container)).toEqual(['2', '3', '4', '5', '1'])
  })

  it('animates keyed moves when shuffling without replaying them during reset', async () => {
    vi.useFakeTimers()
    let layoutOffset = 0
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        const isListItem = this.tagName === 'LI'
        const siblings = Array.from(this.parentElement?.children ?? [])
        const index = isListItem ? Math.max(0, siblings.indexOf(this)) : 0
        return {
          x: 0,
          y: layoutOffset + index * 40,
          top: layoutOffset + index * 40,
          right: 100,
          bottom: layoutOffset + index * 40 + 32,
          left: 0,
          width: 100,
          height: 32,
          toJSON: () => ({}),
        } as DOMRect
      },
    )
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const container = mountContainer()
    resetActiveRuntime()
    render(<ListTransitionExample />, container)
    layoutOffset = 400
    await flush()

    const button = (label: string) =>
      Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
        candidate => candidate.textContent?.trim() === label,
      )

    button('Reset')?.click()
    await flush()
    expect(container.querySelectorAll('.list-shell li.list-move')).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(350)

    button('Shuffle')?.click()
    await flush()

    expect(listNumbers(container)).toEqual(['2', '3', '4', '5', '1'])
    expect(container.querySelectorAll('.list-shell li.list-move')).toHaveLength(5)

    await vi.advanceTimersByTimeAsync(350)
    button('Reset')?.click()
    await flush()

    expect(listNumbers(container)).toEqual(['1', '2', '3', '4', '5'])
    expect(container.querySelector('.list-shell')?.classList.contains('is-resetting')).toBe(true)
  })

  it('keeps an extra item at its previous row while reset animates it out', async () => {
    vi.useFakeTimers()
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        const siblings = Array.from(this.parentElement?.children ?? [])
        const index = this.tagName === 'LI' ? Math.max(0, siblings.indexOf(this)) : 0
        return {
          x: 0,
          y: index * 40,
          top: index * 40,
          right: 100,
          bottom: index * 40 + 32,
          left: 0,
          width: 100,
          height: 32,
          toJSON: () => ({}),
        } as DOMRect
      },
    )
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(
      function (this: HTMLElement) {
        const siblings = Array.from(this.parentElement?.children ?? [])
        return this.tagName === 'LI' ? Math.max(0, siblings.indexOf(this)) * 40 : 0
      },
    )
    vi.spyOn(Math, 'random').mockReturnValue(1)

    const container = mountContainer()
    resetActiveRuntime()
    render(<ListTransitionExample />, container)
    await flush()

    const button = (label: string) =>
      Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
        candidate => candidate.textContent?.trim() === label,
      )

    button('Insert at random index')?.click()
    await flush()
    await vi.advanceTimersByTimeAsync(350)
    expect(listNumbers(container)).toEqual(['1', '2', '3', '4', '5', '6'])

    button('Reset')?.click()
    await flush()

    const leavingItem = listItemByNumber(container, '6')
    expect(leavingItem?.classList.contains('list-leave-active')).toBe(true)
    expect(leavingItem?.style.top).toBe('200px')
  })

  it('does not run a second move wave for stable items during reset', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    const container = mountContainer()
    resetActiveRuntime()
    render(<ListTransitionExample />, container)
    await flush()

    const button = (label: string) =>
      Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
        candidate => candidate.textContent?.trim() === label,
      )

    button('Insert at random index')?.click()
    await flush()
    await vi.advanceTimersByTimeAsync(350)

    button('Reset')?.click()
    await flush()

    expect(listNumbers(container).filter(label => label !== '6')).toEqual(['1', '2', '3', '4', '5'])
    expect(container.querySelector('.list-shell')?.classList.contains('is-resetting')).toBe(true)
    expect(listItemByNumber(container, '6')?.classList.contains('list-leave-active')).toBe(true)
  })
})
