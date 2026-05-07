import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import JoinPage from '../../../app/pages/design/Join'
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

describe('Join actual page', () => {
  it('renders join demos and restores preview after toggling code', async () => {
    const container = mountContainer()
    render(<JoinPage />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('Join 组合容器')
      expect(container.querySelectorAll('.component-preview').length).toBe(6)
    })

    const basicDemo = findDemo(container, '# Join') as HTMLElement | null
    const extraDemo = findDemo(container, '# With extra elements in the group') as HTMLElement | null

    expect(basicDemo).not.toBeNull()
    expect(extraDemo).not.toBeNull()

    await waitForContent(() => {
      expect(container.querySelectorAll('[data-testid="join-basic-preview"] .join-item').length).toBe(3)
      expect(container.querySelector('[data-testid="join-search-input"]')).toBeTruthy()
      expect(container.querySelector('[data-testid="join-search-button"]')).toBeTruthy()
    })

    await click(findTabButton(basicDemo!, 'JSX代码'))

    expect(container.querySelectorAll('[data-testid="join-basic-preview"] .join-item').length).toBe(0)

    await click(findTabButton(basicDemo!, '预览'))

    await waitForContent(() => {
      expect(container.querySelectorAll('[data-testid="join-basic-preview"] .join-item').length).toBe(3)
    })
  })
})