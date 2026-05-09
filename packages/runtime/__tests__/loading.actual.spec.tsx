import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import LoadingPage from '../../../app/pages/design/Loading'
import { click, mountContainer, waitForContent } from './page-test-utils'

vi.mock('../../../app/pages/site/SidebarPlaygroundDesign', () => ({
  default: (props: { children?: unknown }) => (
    <div data-testid="mock-sidebar-design">{props.children}</div>
  ),
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: () => null,
}))

vi.mock('@rue-js/design', async () => {
  const Loading = await import('../../rue-design/src/components/loading')
  const Tabs = await import('../../rue-design/src/components/tabs')
  return {
    Loading: Loading.default,
    Tabs: Tabs.default,
  }
})

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

describe('Loading actual page', () => {
  it('renders loading demos and restores the spinner preview after toggling code', async () => {
    const container = mountContainer()
    render(<LoadingPage />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('Loading 加载指示器')
      expect(container.querySelectorAll('.component-preview').length).toBe(15)
    })

    const basicDemo = findDemo(container, '# Basic spin') as HTMLElement | null
    const nestedDemo = findDemo(container, '# Nested content') as HTMLElement | null
    const percentDemo = findDemo(container, '# Percent') as HTMLElement | null
    const spinnerDemo = findDemo(container, '# Loading spinner') as HTMLElement | null
    const colorsDemo = findDemo(container, '# Loading with colors') as HTMLElement | null

    expect(basicDemo).not.toBeNull()
    expect(nestedDemo).not.toBeNull()
    expect(percentDemo).not.toBeNull()
    expect(spinnerDemo).not.toBeNull()
    expect(colorsDemo).not.toBeNull()

    await waitForContent(() => {
      expect(
        basicDemo?.querySelectorAll('[data-testid="loading-basic-demo"] .loading').length,
      ).toBe(3)
      expect(nestedDemo?.querySelector('[data-rue-loading-section="true"]')?.textContent).toContain(
        '正在拉取洞察',
      )
      expect(percentDemo?.querySelectorAll('[data-rue-loading-percent="true"]').length).toBe(4)
      expect(
        spinnerDemo?.querySelectorAll('[data-testid="loading-spinner-demo"] .loading-spinner')
          .length,
      ).toBe(5)
      expect(
        colorsDemo?.querySelectorAll('[data-testid="loading-colors-demo"] .loading').length,
      ).toBe(8)
    })

    await click(findTabButton(spinnerDemo!, 'JSX代码'))
    expect(
      findDemo(container, '# Loading spinner')?.querySelectorAll('.loading-spinner').length,
    ).toBe(0)
    await click(findTabButton(findDemo(container, '# Loading spinner')!, '预览'))

    await waitForContent(() => {
      expect(
        findDemo(container, '# Loading spinner')?.querySelectorAll('.loading-spinner').length,
      ).toBe(5)
    })
  })
})
