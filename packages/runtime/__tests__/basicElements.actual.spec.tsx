import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import BasicElements from '../../../app/pages/jsx/BasicElements'
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

describe('BasicElements actual page', () => {
  it('renders basic elements and self-closing tags on the preview tab', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(<BasicElements />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('基础元素与自闭合标签')
      expect(findTab(container, '代码')?.className).toContain('tab-active')
    })

    await click(findTab(container, '效果'))

    await waitForContent(() => {
      expect(container.textContent).toContain('div 元素')
      expect(container.textContent).toContain('span 元素')
      expect(container.textContent).toContain('支持文本、嵌套与自闭合形式')
      expect(container.querySelector('img[alt="占位图"]')).not.toBeNull()
      expect(container.querySelector('input[placeholder="自闭合 input"]')).not.toBeNull()
      expect(container.querySelectorAll('.card.bg-base-100.shadow')).toHaveLength(1)
    })

    await click(findTab(container, '代码'))

    expect(container.querySelector('img[alt="占位图"]')).toBeNull()
    expect(container.querySelector('input[placeholder="自闭合 input"]')).toBeNull()
  })
})
