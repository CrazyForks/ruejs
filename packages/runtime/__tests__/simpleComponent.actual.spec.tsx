import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import SimpleComponent from '../../../app/pages/examples/SimpleComponent'
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

describe('SimpleComponent actual page', () => {
  it('renders the grocery list in preview and switches cleanly to the code tab', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(<SimpleComponent />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('简单组件（移植自 Vue）')
      const items = Array.from(container.querySelectorAll('li')).map(item =>
        item.textContent?.trim(),
      )
      expect(items).toEqual(['Vegetables', 'Cheese', 'Whatever else humans are supposed to eat'])
      expect(findTab(container, '效果')?.className).toContain('tab-active')
    })

    await click(findTab(container, '代码'))

    expect(findTab(container, '代码')?.className).toContain('tab-active')
    expect(container.querySelectorAll('li')).toHaveLength(0)
  })
})
