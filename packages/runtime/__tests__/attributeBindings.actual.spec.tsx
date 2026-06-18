import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import AttributeBindings from '../../../app/pages/examples/AttributeBindings'
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

const findParagraph = (root: ParentNode, text: string) =>
  Array.from(root.querySelectorAll('p')).find(node => node.textContent?.includes(text)) ?? null

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('AttributeBindings actual page', () => {
  it('updates title, class, and inline style bindings in preview mode', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(<AttributeBindings />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('Attribute 绑定（移植自 Vue）')
      expect(container.querySelector('span[title="Hello World!"]')).not.toBeNull()
    })

    const redLine = findParagraph(container, 'This should be red, but click me to toggle it.')
    expect(redLine).not.toBeNull()
    expect(redLine!.className).toContain('text-red-600')

    await click(redLine)

    await waitForContent(() => {
      expect(
        findParagraph(container, 'This should be red, but click me to toggle it.')?.className,
      ).not.toContain('text-red-600')
    })

    const colorLine = findParagraph(
      container,
      'This should be green, and should toggle between green and blue on click.',
    ) as HTMLElement | null
    expect(colorLine).not.toBeNull()
    expect(colorLine!.getAttribute('style')).toContain('green')

    await click(colorLine)

    await waitForContent(() => {
      const target = findParagraph(
        container,
        'This should be green, and should toggle between green and blue on click.',
      ) as HTMLElement | null
      expect(target?.getAttribute('style')).toContain('blue')
    })

    await click(findTab(container, '代码'))

    expect(findTab(container, '代码')?.className).toContain('tab-active')
    expect(findParagraph(container, 'This should be red, but click me to toggle it.')).toBeNull()
  })
})
