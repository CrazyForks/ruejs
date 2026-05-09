import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import ProgressPage from '../../../app/pages/design/Progress'
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

describe('Progress actual page', () => {
  it('renders progress demos and restores preview after toggling code', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(<ProgressPage />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('Progress 进度条')
      expect(container.querySelectorAll('.component-preview').length).toBeGreaterThan(0)
    })

    const basicDemo = findDemo(container, '# Progress') as HTMLElement | null
    const colorsDemo = findDemo(container, '# Progress colors') as HTMLElement | null
    const indeterminateDemo = findDemo(container, '# Indeterminate') as HTMLElement | null

    expect(basicDemo).not.toBeNull()
    expect(colorsDemo).not.toBeNull()
    expect(indeterminateDemo).not.toBeNull()

    await waitForContent(() => {
      expect(basicDemo!.querySelectorAll('progress.progress').length).toBe(5)
      expect(colorsDemo!.querySelectorAll('progress.progress').length).toBe(8)
      expect(
        indeterminateDemo!.querySelector('[data-testid="progress-indeterminate"]'),
      ).not.toBeNull()
    })

    await click(findTabButton(basicDemo!, 'JSX代码'))
    const basicDemoInCode = findDemo(container, '# Progress') as HTMLElement | null
    expect(basicDemoInCode!.querySelectorAll('progress.progress').length).toBe(0)

    await click(findTabButton(basicDemoInCode!, '预览'))

    await waitForContent(() => {
      const restored = findDemo(container, '# Progress') as HTMLElement | null
      expect(restored!.querySelectorAll('progress.progress').length).toBe(5)
    })
  })
})
