import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import OnRenderTracked from '../../../app/pages/examples/OnRenderTracked'
import { click, mountContainer, waitForContent } from './page-test-utils'

vi.mock('../../../app/pages/site/SidebarPlaygroundExample', () => ({
  default: (props: { children?: unknown }) => (
    <div data-testid="mock-sidebar-example">{props.children}</div>
  ),
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: (props: { code: string }) => <pre data-testid="mock-code">{props.code}</pre>,
}))

setReactiveScheduling('sync')

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

const findButton = (root: ParentNode, label: string) =>
  Array.from(root.querySelectorAll('button')).find(
    button => button.textContent?.trim() === label,
  ) ?? null

const findTab = (root: ParentNode, label: string) =>
  Array.from(root.querySelectorAll('button[role="tab"]')).find(
    button => button.textContent?.trim() === label,
  ) ?? null

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('OnRenderTracked actual page', () => {
  it('switches between preview/code and records signal-tracked render events', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(<OnRenderTracked />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('onRenderTracked 调试示例')
      expect(container.textContent).toContain('Tracked events')
      expect(container.textContent).toContain('Rue Render Debugger')
    })

    await click(findTab(container, '代码'))
    await waitForContent(() => {
      expect(container.querySelector('[data-testid="mock-code"]')?.textContent).toContain(
        'onRenderTracked((event: DebuggerEvent) =>',
      )
    })

    await click(findTab(container, '效果'))
    await waitForContent(() => {
      expect(container.textContent).toContain('Rue Render Debugger')
      expect(findButton(container, 'count +1')).not.toBeNull()
    })

    await click(findButton(container, 'count +1'))
    await waitForContent(() => {
      expect(container.textContent).toContain('count')
      expect(container.textContent).toContain('value: 2')
      expect(container.textContent).toContain('value')
    })
  })
})
