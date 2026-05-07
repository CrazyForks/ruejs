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

    const eventsDemo = findDemo(container, '# Button events') as HTMLElement | null
    expect(eventsDemo).not.toBeNull()

    await waitForContent(() => {
      expect(normalize(eventsDemo?.textContent)).toContain('count: 0')
      expect(normalize(eventsDemo?.textContent)).toContain('Click Me')
      expect(normalize(eventsDemo?.textContent)).toContain('Loading (disabled)')
    })

    const buttons = Array.from(eventsDemo!.querySelectorAll('.card button')) as HTMLButtonElement[]
    const clickMe = buttons.find(button => normalize(button.textContent) === 'Click Me') ?? null
    const loading = buttons.find(button => normalize(button.textContent).includes('Loading')) ?? null

    expect(clickMe).not.toBeNull()
    expect(loading).not.toBeNull()
    expect(loading?.disabled).toBe(true)

    await click(clickMe)

    await waitForContent(() => {
      expect(normalize(eventsDemo?.textContent)).toContain('count: 1')
    })

    await click(findTabButton(eventsDemo!, 'JSX代码'))
    expect(Array.from(eventsDemo!.querySelectorAll('.card button')).length).toBe(0)

    await click(findTabButton(eventsDemo!, '预览'))

    await waitForContent(() => {
      expect(normalize(eventsDemo?.textContent)).toContain('count: 1')
      expect(normalize(eventsDemo?.textContent)).toContain('Click Me')
    })
  })
})