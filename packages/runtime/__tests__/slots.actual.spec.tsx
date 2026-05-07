import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import { click, mountContainer, waitForContent } from './page-test-utils'

vi.mock('../../../app/pages/site/SidebarPlaygroundExample', () => ({
  default: (props: { children?: unknown }) => (
    <div data-testid="mock-sidebar-playground">{props.children}</div>
  ),
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: () => null,
}))

setReactiveScheduling('sync')

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

afterEach(() => {
  document.body.innerHTML = ''
})

const findButton = (root: ParentNode, label: string) =>
  Array.from(root.querySelectorAll('button')).find(button => button.textContent?.trim() === label) ?? null

const findDemoSection = (root: ParentNode, heading: string) =>
  Array.from(root.querySelectorAll('h3')).find(node => node.textContent?.trim() === heading)?.closest('div.space-y-3')

const countText = (root: ParentNode, needle: string) => {
  const text = root.textContent ?? ''
  return text.split(needle).length - 1
}

describe('Slots actual page', () => {
  it('switches the full slot demo between provided slot content and fallback content', async () => {
    const { default: SlotsPage } = await import('../../../app/pages/examples/Slots')
    const container = mountContainer()

    resetActiveRuntime()
    render(<SlotsPage />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('插槽 Slots（default / named / scoped）')
      expect(container.textContent).toContain('支付面板')
      expect(container.textContent).toContain('刷新')
      expect(container.textContent).toContain('99.98%')
    })

    const providedDemo = findDemoSection(container, '传入 slot 之后')
    const fallbackDemo = findDemoSection(container, '省略 slot 之后')
    expect(providedDemo).not.toBeNull()
    expect(fallbackDemo).not.toBeNull()
    expect(providedDemo?.textContent).toContain('支付面板')
    expect(providedDemo?.textContent).toContain('刷新')
    expect(providedDemo?.textContent).toContain('99.98%')
    expect(countText(providedDemo!, '来自 scoped slot props')).toBe(3)
    expect(fallbackDemo?.textContent).toContain('默认标题')
    expect(fallbackDemo?.textContent).toContain('fallback action')
    expect(fallbackDemo?.textContent).toContain('默认插槽为空时，这里显示主体内容的 fallback。')

    await click(findButton(container, 'title slot'))
    await click(findButton(container, 'actions slot'))
    await click(findButton(container, 'default slot'))
    await click(findButton(container, 'scoped row'))

    await waitForContent(() => {
      expect(providedDemo?.textContent).not.toContain('支付面板')
      expect(providedDemo?.textContent).not.toContain('刷新')
      expect(providedDemo?.textContent).not.toContain('99.98%')
      expect(providedDemo?.textContent).toContain('默认标题')
      expect(providedDemo?.textContent).toContain('fallback action')
      expect(countText(providedDemo!, '来自 scoped slot props')).toBe(0)
      expect(fallbackDemo?.textContent).toContain('默认插槽为空时，这里显示主体内容的 fallback。')
    })
  })
})