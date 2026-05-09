import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import Fragments from '../../../app/pages/jsx/Fragments'
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

describe('Fragments actual page', () => {
  it('renders sibling fragment children without an extra wrapper on the preview tab', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(<Fragments />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('Fragments')
      expect(findTab(container, '代码')?.className).toContain('tab-active')
    })

    await click(findTab(container, '效果'))

    await waitForContent(() => {
      const spans = Array.from(container.querySelectorAll('.card-body.grid.gap-2 > span')).map(
        node => node.textContent?.trim(),
      )
      expect(spans).toEqual(['片段 1', '片段 2'])
      expect(container.querySelectorAll('.card-body.grid.gap-2 > span')).toHaveLength(2)
      expect(container.querySelector('.card-body.grid.gap-2 > div')).toBeNull()
    })

    await click(findTab(container, '代码'))

    expect(container.querySelectorAll('.card-body.grid.gap-2 > span')).toHaveLength(0)
  })
})
