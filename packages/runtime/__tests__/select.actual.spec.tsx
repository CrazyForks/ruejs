import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, setReactiveScheduling } from '../src'
import SelectPage from '../../../app/pages/design/Select'
import { click, mountContainer, waitForContent } from './page-test-utils'
import { findDemo, findTabButton, normalize, resetActiveRuntime } from './design-page-test-utils'

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

describe('Select actual page', () => {
  it('renders enhanced select demos, updates the basic selection, clears shell mode, and restores preview after toggling code', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(<SelectPage />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('Select 选择器')
      expect(container.querySelectorAll('.component-preview').length).toBe(12)
    })

    const basicDemo = findDemo(container, '# Select') as HTMLElement | null
    const dataDemo = findDemo(container, '# Data source and groups') as HTMLElement | null
    const shellDemo = findDemo(container, '# Prefix, suffix and allowClear') as HTMLElement | null
    const multipleDemo = findDemo(container, '# Multiple selection') as HTMLElement | null
    expect(basicDemo).not.toBeNull()
    expect(dataDemo).not.toBeNull()
    expect(shellDemo).not.toBeNull()
    expect(multipleDemo).not.toBeNull()

    await waitForContent(() => {
      expect(normalize(basicDemo?.textContent)).toContain('当前选择：Amber')
      expect(dataDemo!.querySelectorAll('optgroup').length).toBe(2)
      expect(multipleDemo!.querySelector('select[size="6"]')).not.toBeNull()
    })

    const select = basicDemo!.querySelector('[data-testid="select-basic"]') as HTMLSelectElement
    select.value = 'velvet'
    select.dispatchEvent(new Event('change', { bubbles: true }))

    await waitForContent(() => {
      const currentDemo = findDemo(container, '# Select') as HTMLElement | null
      expect(normalize(currentDemo?.textContent)).toContain('当前选择：Velvet')
    })

    const clearButton = shellDemo!.querySelector('button[aria-label="清空选择"]') as HTMLButtonElement
    expect(clearButton).not.toBeNull()
    await click(clearButton)

    await waitForContent(() => {
      const currentShellDemo = findDemo(container, '# Prefix, suffix and allowClear') as HTMLElement | null
      expect(normalize(currentShellDemo?.textContent)).toContain('当前 owner：未设置')
    })

    await click(findTabButton(basicDemo!, 'JSX代码'))
    const basicDemoInCode = findDemo(container, '# Select') as HTMLElement | null
    expect(basicDemoInCode!.querySelectorAll('select.select').length).toBe(0)

    await click(findTabButton(basicDemoInCode!, '预览'))

    await waitForContent(() => {
      const restoredDemo = findDemo(container, '# Select') as HTMLElement | null
      expect(restoredDemo!.querySelector('[data-testid="select-basic"]')).not.toBeNull()
    })
  })
})