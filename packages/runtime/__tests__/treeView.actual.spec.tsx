import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import TreeView from '../../../app/pages/examples/TreeView'
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

describe('TreeView actual page', () => {
  it('expands the root folder and adds a child from the preview tree', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(<TreeView />, container)

    await waitForContent(() => {
      const rootLabel = container.querySelector('[data-testid="label-root"]')
      expect(container.textContent).toContain('树状视图（移植自 Vue）')
      expect(findTab(container, '效果')?.className).toContain('tab-active')
      expect(rootLabel?.textContent?.replace(/\s+/g, ' ').trim()).toContain('My Tree')
      expect(rootLabel?.textContent).toContain('[+]')
    })

    await click(container.querySelector('[data-testid="label-root"]'))

    await waitForContent(() => {
      const rootLabel = container.querySelector('[data-testid="label-root"]')
      expect(rootLabel?.textContent).toContain('[-]')
      expect(container.querySelector('[data-testid="add-root"]')).not.toBeNull()
      expect(container.textContent).toContain('hello')
      expect(container.textContent).toContain('world')
      expect(container.textContent).toContain('child folder')
    })

    await click(container.querySelector('[data-testid="add-root"]'))

    await waitForContent(() => {
      const treeText = container.textContent?.replace(/\s+/g, ' ').trim() ?? ''
      expect(treeText).toContain('new stuff')
    })

    await click(findTab(container, '代码'))

    expect(container.querySelector('[data-testid="label-root"]')).toBeNull()
  })
})
