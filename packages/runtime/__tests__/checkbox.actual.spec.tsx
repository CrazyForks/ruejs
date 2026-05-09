import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import CheckboxPage from '../../../app/pages/design/Checkbox'
import { click, mountContainer, waitForContent } from './page-test-utils'

vi.mock('../../../app/pages/site/SidebarPlaygroundDesign', () => ({
  default: (props: { children?: unknown }) => (
    <div data-testid="mock-sidebar-design">{props.children}</div>
  ),
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: () => null,
}))

setReactiveScheduling('sync')

const normalize = (value: string | null | undefined) => value?.replace(/\s+/g, ' ').trim() ?? ''

const findTabButton = (root: ParentNode, label: string) =>
  Array.from(root.querySelectorAll('button[role="tab"]')).find(
    button => button.textContent?.trim() === label,
  ) ?? null

const findDemo = (root: ParentNode, title: string) =>
  Array.from(root.querySelectorAll('.component-preview')).find(
    node => normalize(node.querySelector('h2')?.textContent) === title,
  ) ?? null

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('Checkbox actual page', () => {
  it('renders checkbox demos and restores the basic preview after toggling code', async () => {
    const container = mountContainer()
    render(<CheckboxPage />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('Checkbox 复选框')
      expect(container.querySelectorAll('.component-preview').length).toBe(11)
    })

    const basicDemo = findDemo(container, '# Checkbox') as HTMLElement | null
    const sizesDemo = findDemo(container, '# Sizes') as HTMLElement | null
    const indeterminateDemo = findDemo(container, '# Indeterminate') as HTMLElement | null

    expect(basicDemo).not.toBeNull()
    expect(sizesDemo).not.toBeNull()
    expect(indeterminateDemo).not.toBeNull()

    await waitForContent(() => {
      expect(normalize(basicDemo?.textContent)).toContain('当前状态：已选中')
      expect(sizesDemo?.querySelectorAll('input.checkbox').length).toBe(5)
      expect(indeterminateDemo?.querySelector('input.checkbox')).not.toBeNull()
    })

    await click(basicDemo!.querySelector('[data-testid="checkbox-basic"]'))

    await waitForContent(() => {
      expect(normalize(basicDemo?.textContent)).toContain('当前状态：未选中')
    })

    await click(findTabButton(basicDemo!, 'JSX代码'))

    const basicDemoInCode = findDemo(container, '# Checkbox') as HTMLElement | null
    expect(basicDemoInCode!.querySelectorAll('input.checkbox').length).toBe(0)

    await click(findTabButton(basicDemoInCode!, '预览'))

    await waitForContent(() => {
      const restoredBasicDemo = findDemo(container, '# Checkbox') as HTMLElement | null
      expect(restoredBasicDemo!.querySelectorAll('input.checkbox').length).toBe(1)
    })
  })

  it('keeps the controlled demo content stable across repeated clicks', async () => {
    const container = mountContainer()
    render(<CheckboxPage />, container)

    const controlledDemo = () => findDemo(container, '# Controlled checkbox') as HTMLElement | null

    await waitForContent(() => {
      expect(controlledDemo()).not.toBeNull()
      expect(normalize(controlledDemo()?.textContent)).toContain('checked=false')
      expect(controlledDemo()?.querySelectorAll('.font-medium').length).toBe(1)
    })

    await click(controlledDemo()!.querySelector('[data-testid="checkbox-controlled-card"]'))

    await waitForContent(() => {
      expect(normalize(controlledDemo()?.textContent)).toContain('checked=true')
      expect(controlledDemo()?.querySelectorAll('.font-medium').length).toBe(1)
      expect(controlledDemo()?.querySelectorAll('[data-rue-checkbox-content="true"]').length).toBe(
        1,
      )
    })

    await click(controlledDemo()!.querySelector('[data-testid="checkbox-controlled-card"]'))

    await waitForContent(() => {
      expect(normalize(controlledDemo()?.textContent)).toContain('checked=false')
      expect(controlledDemo()?.querySelectorAll('.font-medium').length).toBe(1)
      expect(controlledDemo()?.querySelectorAll('[data-rue-checkbox-content="true"]').length).toBe(
        1,
      )
    })
  })

  it('keeps group labels visible and applies single-line alignment helpers', async () => {
    const container = mountContainer()
    render(<CheckboxPage />, container)

    const indeterminateDemo = () => findDemo(container, '# Indeterminate') as HTMLElement | null
    const groupDemo = () => findDemo(container, '# Checkbox Group') as HTMLElement | null
    const checkAllDemo = () => findDemo(container, '# Check all') as HTMLElement | null

    await waitForContent(() => {
      expect(indeterminateDemo()).not.toBeNull()
      expect(groupDemo()).not.toBeNull()
      expect(checkAllDemo()).not.toBeNull()
      expect(
        indeterminateDemo()!.querySelector('[data-rue-checkbox-root="true"]')?.className,
      ).toContain('items-center')
      expect(
        indeterminateDemo()!.querySelector('[data-rue-checkbox-root="true"]')?.className,
      ).toContain('[&>span:last-child]:pt-1')
      expect(checkAllDemo()!.querySelector('[data-rue-checkbox-root="true"]')?.className).toContain(
        'items-center',
      )
      expect(groupDemo()!.querySelectorAll('[data-rue-checkbox-content="true"]').length).toBe(4)
      expect(
        groupDemo()!.querySelectorAll('[data-rue-checkbox-content="true"]')[1].textContent,
      ).toContain('版本发布公告')
    })

    const secondInput = groupDemo()!.querySelectorAll('input.checkbox')[1] as HTMLInputElement
    secondInput.checked = true
    secondInput.dispatchEvent(new Event('change', { bubbles: true }))

    await waitForContent(() => {
      expect(groupDemo()!.querySelectorAll('[data-rue-checkbox-content="true"]').length).toBe(4)
      expect(
        groupDemo()!.querySelectorAll('[data-rue-checkbox-content="true"]')[1].textContent,
      ).toContain('版本发布公告')
      expect(normalize(groupDemo()!.textContent)).toContain('当前订阅：design-system / release')
      expect(
        checkAllDemo()!.querySelectorAll('[data-rue-checkbox-root="true"]')[1]?.className,
      ).toContain('items-center')
    })
  })

  it('applies children-mode defaultValue before the first grid interaction', async () => {
    const container = mountContainer()
    render(<CheckboxPage />, container)

    const gridDemo = () => findDemo(container, '# Use with Grid') as HTMLElement | null

    await waitForContent(() => {
      expect(gridDemo()).not.toBeNull()
      const inputs = Array.from(
        gridDemo()!.querySelectorAll('input.checkbox'),
      ) as HTMLInputElement[]
      expect(inputs.map(input => input.checked)).toEqual([true, true, false, false])
    })

    await click(gridDemo()!.querySelectorAll('[data-rue-checkbox-root="true"]')[2])

    await waitForContent(() => {
      const inputs = Array.from(
        gridDemo()!.querySelectorAll('input.checkbox'),
      ) as HTMLInputElement[]
      expect(inputs.map(input => input.checked)).toEqual([true, true, true, false])
    })
  })
})
