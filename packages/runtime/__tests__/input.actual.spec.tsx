import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import InputPage from '../../../app/pages/design/Input'
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

describe('Input actual page', () => {
  it('renders input demos, updates the basic value, and restores the shell preview after toggling code', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(<InputPage />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('Input 输入框')
      expect(container.querySelectorAll('.component-preview').length).toBe(8)
    })

    const basicDemo = findDemo(container, '# Text input') as HTMLElement | null
    const shellDemo = findDemo(container, '# Text input with text label inside') as HTMLElement | null
    expect(basicDemo).not.toBeNull()
    expect(shellDemo).not.toBeNull()

    const basicInput = basicDemo!.querySelector('[data-testid="input-basic"]') as HTMLInputElement
    basicInput.value = 'Rue'
    basicInput.dispatchEvent(new Event('input', { bubbles: true }))
    expect(basicInput.value).toBe('Rue')

    await waitForContent(() => {
      expect(shellDemo!.querySelectorAll('.input').length).toBe(2)
      expect(shellDemo!.querySelector('input[type="search"]')).not.toBeNull()
    })

    await click(findTabButton(shellDemo!, 'JSX代码'))
    const shellDemoInCode = findDemo(container, '# Text input with text label inside') as HTMLElement | null
    expect(shellDemoInCode!.querySelectorAll('.input').length).toBe(0)

    await click(findTabButton(shellDemoInCode!, '预览'))

    await waitForContent(() => {
      const restoredDemo = findDemo(container, '# Text input with text label inside') as HTMLElement | null
      expect(restoredDemo!.querySelectorAll('.input').length).toBe(2)
    })
  })
})