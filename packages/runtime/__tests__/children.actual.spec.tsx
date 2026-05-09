import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import Children from '../../../app/pages/jsx/Children'
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

describe('Children actual page', () => {
  it('renders nested children in preview mode without leaving the wrapper cards in code mode', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(<Children />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('children 插槽与嵌套')
      expect(container.querySelectorAll('.card.bg-base-100.border')).toHaveLength(0)
    })

    await click(findTab(container, '效果'))

    await waitForContent(() => {
      expect(container.textContent).toContain('外层')
      expect(container.textContent).toContain('内层')
      expect(container.textContent).toContain('嵌套子元素')
      expect(container.querySelectorAll('.card.bg-base-100.border')).toHaveLength(2)
    })

    await click(findTab(container, '代码'))

    expect(container.querySelectorAll('.card.bg-base-100.border')).toHaveLength(0)
  })
})
