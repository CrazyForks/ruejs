import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import SpreadProps from '../../../app/pages/jsx/SpreadProps'
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

describe('SpreadProps actual page', () => {
  it('spreads object props into the preview button', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(<SpreadProps />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('对象展开属性（spread props）')
      expect(findTab(container, '代码')?.className).toContain('tab-active')
    })

    await click(findTab(container, '效果'))

    await waitForContent(() => {
      const button = container.querySelector(
        '.card-body.grid.gap-4 > button',
      ) as HTMLButtonElement | null
      expect(button).not.toBeNull()
      expect(button!.textContent?.trim()).toBe('确定按钮')
      expect(button!.className).toContain('btn')
      expect(button!.className).toContain('btn-primary')
    })

    await click(findTab(container, '代码'))

    expect(container.querySelector('.card-body.grid.gap-4 > button')).toBeNull()
  })
})
