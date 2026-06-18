import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
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
})
