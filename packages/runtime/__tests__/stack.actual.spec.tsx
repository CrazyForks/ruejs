import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, setReactiveScheduling } from '../src'
import StackPage from '../../../app/pages/design/Stack'
import { click, mountContainer, waitForContent } from './page-test-utils'
import { findDemo, findTabButton, resetActiveRuntime } from './design-page-test-utils'

vi.mock('../../../app/pages/site/SidebarPlaygroundDesign', () => ({
  default: (props: { children?: unknown }) => (
    <div data-testid="mock-sidebar-design">{props.children}</div>
  ),
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: () => null,
}))

setReactiveScheduling('sync')

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('Stack actual page', () => {
  it('renders stack demos and restores the alignment preview after toggling code', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(<StackPage />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('Stack 堆叠容器')
      expect(container.querySelectorAll('.component-preview').length).toBe(6)
    })

    const basicDemo = findDemo(container, '# 3 divs in a stack') as HTMLElement | null
    const alignmentDemo = findDemo(container, '# Alignment modifiers') as HTMLElement | null
    expect(basicDemo).not.toBeNull()
    expect(alignmentDemo).not.toBeNull()

    await waitForContent(() => {
      expect(basicDemo!.querySelector('[data-testid="stack-basic"]')?.children.length).toBe(3)
      expect(alignmentDemo!.querySelectorAll('.stack').length).toBe(3)
    })

    await click(findTabButton(alignmentDemo!, 'JSX代码'))
    const alignmentDemoInCode = findDemo(container, '# Alignment modifiers') as HTMLElement | null
    expect(alignmentDemoInCode!.querySelectorAll('.stack').length).toBe(0)

    await click(findTabButton(alignmentDemoInCode!, '预览'))

    await waitForContent(() => {
      const restoredDemo = findDemo(container, '# Alignment modifiers') as HTMLElement | null
      expect(restoredDemo!.querySelectorAll('.stack').length).toBe(3)
    })
  })
})