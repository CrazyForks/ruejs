import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import ButtonPage from '../../../app/pages/design/Button'
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

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

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

describe('Button actual page', () => {
  it('updates the events demo counter and preserves it across code toggles', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(<ButtonPage />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('Button 按钮')
      expect(container.querySelector('.component-preview')).not.toBeNull()
    })

    const formDemoTitle = '# 根节点与表单行为'
    const formDemo = findDemo(container, formDemoTitle) as HTMLElement | null
    expect(formDemo).not.toBeNull()

    await waitForContent(() => {
      expect(normalize(formDemo?.textContent)).toContain('submit count: 0')
      expect(normalize(formDemo?.textContent)).toContain('Submit form')
      expect(normalize(formDemo?.textContent)).toContain('Reset form')
    })

    const buttons = Array.from(formDemo!.querySelectorAll('.card button')) as HTMLButtonElement[]
    const submitButton =
      buttons.find(button => normalize(button.textContent) === 'Submit form') ?? null
    const resetButton =
      buttons.find(button => normalize(button.textContent) === 'Reset form') ?? null

    expect(submitButton).not.toBeNull()
    expect(resetButton).not.toBeNull()

    await click(submitButton)

    await waitForContent(() => {
      expect(normalize(formDemo?.textContent)).toContain('submit count: 1')
    })

    await click(findTabButton(formDemo!, 'JSX代码'))
    expect(Array.from(formDemo!.querySelectorAll('.card button')).length).toBe(0)

    await click(findTabButton(findDemo(container, formDemoTitle)!, '预览'))

    await waitForContent(() => {
      const restoredDemo = findDemo(container, formDemoTitle) as HTMLElement | null
      expect(normalize(restoredDemo?.textContent)).toContain('submit count: 1')
      expect(normalize(restoredDemo?.textContent)).toContain('Submit form')
    })
  })
})
