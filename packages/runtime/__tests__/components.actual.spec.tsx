import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import Components from '../../../app/pages/jsx/Components'
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

describe('Components actual page', () => {
  it('renders child components with props on the preview tab', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(<Components />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('组件与 Props 传递')
      expect(findTab(container, '代码')?.className).toContain('tab-active')
    })

    await click(findTab(container, '效果'))

    await waitForContent(() => {
      const lines = Array.from(container.querySelectorAll('.card-body.grid.gap-4 > div')).map(node =>
        node.textContent?.trim(),
      )
      expect(lines).toEqual(['你好，Rue', '你好，World'])
    })

    await click(findTab(container, '代码'))

    expect(container.querySelectorAll('.card-body.grid.gap-4 > div')).toHaveLength(0)
  })
})