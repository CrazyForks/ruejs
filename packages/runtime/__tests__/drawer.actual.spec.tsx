import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import DrawerPage from '../../../app/pages/design/Drawer'
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

describe('Drawer actual page', () => {
  it('renders drawer demos and toggles the basic checkbox before restoring preview', async () => {
    const container = mountContainer()
    const basicDemoTitle = '# Drawer sidebar'
    const endDemoTitle = '# Drawer sidebar that opens from right side'

    resetActiveRuntime()
    render(<DrawerPage />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('Drawer')
      expect(container.querySelectorAll('.component-preview').length).toBe(5)
    })

    await waitForContent(() => {
      const currentBasicDemo = findDemo(container, basicDemoTitle) as HTMLElement | null
      const currentEndDemo = findDemo(container, endDemoTitle) as HTMLElement | null
      expect(currentBasicDemo).not.toBeNull()
      expect(currentEndDemo).not.toBeNull()
      expect(currentBasicDemo!.querySelector('[data-testid="drawer-basic-toggle"]')).not.toBeNull()
      expect(currentEndDemo!.querySelector('.drawer-end')).not.toBeNull()
    })

    const basicDemo = findDemo(container, basicDemoTitle) as HTMLElement | null
    expect(basicDemo).not.toBeNull()

    const toggle = basicDemo!.querySelector('[data-testid="drawer-basic-toggle"]') as HTMLInputElement
    expect(toggle.checked).toBe(false)

    await click(basicDemo!.querySelector('[data-testid="drawer-basic-open"]'))

    await waitForContent(() => {
      const currentBasicDemo = findDemo(container, basicDemoTitle) as HTMLElement | null
      const currentToggle = currentBasicDemo!.querySelector(
        '[data-testid="drawer-basic-toggle"]',
      ) as HTMLInputElement
      expect(currentToggle.checked).toBe(true)
    })

    await click(findTabButton(basicDemo!, 'JSX代码'))
    const basicDemoInCode = findDemo(container, basicDemoTitle) as HTMLElement | null
    expect(basicDemoInCode!.querySelector('.drawer')).toBeNull()

    await click(findTabButton(basicDemoInCode!, '预览'))

    await waitForContent(() => {
      const restoredDemo = findDemo(container, basicDemoTitle) as HTMLElement | null
      expect(restoredDemo!.querySelector('.drawer')).not.toBeNull()
    })
  })
})
