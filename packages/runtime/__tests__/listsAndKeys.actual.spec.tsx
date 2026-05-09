import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import ListsAndKeys from '../../../app/pages/jsx/ListsAndKeys'
import { click, mountContainer, waitForContent } from './page-test-utils'

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

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('ListsAndKeys actual page', () => {
  it('renders keyed list items in source order on the preview tab', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(<ListsAndKeys />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('列表渲染与 key')
      expect(findTab(container, '代码')?.className).toContain('tab-active')
    })

    await click(findTab(container, '效果'))

    await waitForContent(() => {
      const list = container.querySelector('ul.list-disc.pl-6')
      const items = Array.from(container.querySelectorAll('ul.list-disc.pl-6 > li')).map(node =>
        node.textContent?.replace(/\s+/g, ' ').trim(),
      )
      expect(list).not.toBeNull()
      expect(items).toEqual(['1. Apple', '2. Banana', '3. Cherry'])
    })

    await click(findTab(container, '代码'))

    expect(container.querySelector('ul.list-disc.pl-6')).toBeNull()
  })
})
