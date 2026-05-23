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

const setEnabledPreviews = (...titles: string[]) => {
  ;(
    globalThis as { __RUE_TEST_ENABLED_DESIGN_PREVIEWS__?: Set<string> }
  ).__RUE_TEST_ENABLED_DESIGN_PREVIEWS__ = new Set(titles)
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
  delete (globalThis as { __RUE_TEST_ENABLED_DESIGN_PREVIEWS__?: Set<string> })
    .__RUE_TEST_ENABLED_DESIGN_PREVIEWS__
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('Loading actual page', () => {
  it('renders loading demos and restores the spinner preview after toggling code', async () => {
    setEnabledPreviews('Loading spinner')

    const container = mountContainer()
    render(<LoadingPage />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('Loading 加载指示器')
      expect(container.querySelectorAll('.component-preview').length).toBe(15)
    })

    const spinnerDemo = findDemo(container, '# Loading spinner') as HTMLElement | null

    expect(spinnerDemo).not.toBeNull()

    await waitForContent(() => {
      expect(
        spinnerDemo?.querySelectorAll('[data-testid="loading-spinner-demo"] .loading-spinner')
          .length,
      ).toBe(5)
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
