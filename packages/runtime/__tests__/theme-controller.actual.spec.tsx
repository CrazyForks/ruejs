import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import ThemeControllerPage from '../../../app/pages/design/ThemeController'
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

describe('ThemeController actual page', () => {
  it('renders theme controller demos, updates the toggle label, and restores the checkbox preview after toggling code', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(<ThemeControllerPage />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('Theme Controller 主题控制器')
      expect(container.querySelectorAll('.component-preview').length).toBe(4)
    })

    const toggleDemo = findDemo(container, '# Theme Controller using a toggle') as HTMLElement | null
    const checkboxDemo = findDemo(container, '# Theme Controller using a checkbox') as HTMLElement | null
    const radioDemo = findDemo(container, '# Theme Controller using radio inputs') as HTMLElement | null
    expect(toggleDemo).not.toBeNull()
    expect(checkboxDemo).not.toBeNull()
    expect(radioDemo).not.toBeNull()

    await waitForContent(() => {
      expect(toggleDemo!.textContent).toContain('当前值：default')
      expect(radioDemo!.querySelectorAll('input.theme-controller').length).toBe(3)
    })

    const toggleInput = toggleDemo!.querySelector('[data-testid="theme-toggle"]') as HTMLInputElement
    toggleInput.checked = true
    toggleInput.dispatchEvent(new Event('change', { bubbles: true }))

    await waitForContent(() => {
      const updatedToggleDemo = findDemo(container, '# Theme Controller using a toggle') as HTMLElement | null
      expect(updatedToggleDemo!.textContent).toContain('当前值：synthwave')
    })

    await click(findTabButton(checkboxDemo!, 'JSX代码'))
    const checkboxDemoInCode = findDemo(container, '# Theme Controller using a checkbox') as HTMLElement | null
    expect(checkboxDemoInCode!.querySelectorAll('input.theme-controller').length).toBe(0)

    await click(findTabButton(checkboxDemoInCode!, '预览'))

    await waitForContent(() => {
      const restoredCheckboxDemo = findDemo(container, '# Theme Controller using a checkbox') as HTMLElement | null
      expect(restoredCheckboxDemo!.querySelectorAll('input.theme-controller').length).toBe(1)
    })
  })
})
