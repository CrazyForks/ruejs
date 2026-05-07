import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import Expressions from '../../../app/pages/jsx/Expressions'
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

const previewLines = (root: ParentNode) =>
  Array.from(root.querySelectorAll('.card-body.grid.gap-2 > div')).map(node => node.textContent?.trim())

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('Expressions actual page', () => {
  it('evaluates arithmetic, template, ternary, and array expressions on the preview tab', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(<Expressions />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('表达式与插值')
      expect(findTab(container, '代码')?.className).toContain('tab-active')
    })

    await click(findTab(container, '效果'))

    await waitForContent(() => {
      expect(previewLines(container)).toEqual(['3', 'hello Alice', '大于5', 'A,B'])
    })

    await click(findTab(container, '代码'))

    expect(container.querySelectorAll('.card-body.grid.gap-2 > div')).toHaveLength(0)
  })
})