import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import MarkdownEditor from '../../../app/pages/examples/MarkdownEditor'
import { click, flush, mountContainer } from './page-test-utils'

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

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

const findTab = (root: ParentNode, label: string) =>
  Array.from(root.querySelectorAll('button[role="tab"]')).find(
    button => button.textContent?.trim() === label,
  ) ?? null

describe('MarkdownEditor actual page', () => {
  it('updates the markdown preview after debounced input and hides it on the code tab', async () => {
    vi.useFakeTimers()

    const container = mountContainer()
    resetActiveRuntime()
    render(<MarkdownEditor />, container)
    await flush()

    expect(container.textContent).toContain('Markdown 编辑器（移植自 Vue）')
    expect(container.querySelector('textarea')).not.toBeNull()
    expect(container.querySelectorAll('h1')).toHaveLength(2)

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement | null
    expect(textarea).not.toBeNull()

    textarea!.value = '# Rue\n\n- alpha'
    textarea!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))

    await vi.advanceTimersByTimeAsync(100)
    await flush()

    expect(container.querySelector('ul li')?.textContent).toContain('alpha')
    expect(
      Array.from(container.querySelectorAll('h1')).some(node => node.textContent === 'Rue'),
    ).toBe(true)

    await click(findTab(container, '代码'))

    expect(container.querySelector('textarea')).toBeNull()
  })
})
