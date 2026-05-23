import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import FileInputPage from '../../../app/pages/design/FileInput'
import { click, mountContainer, waitForContent } from './page-test-utils'

const previewState = vi.hoisted(() => ({
  enabledTitles: new Set<string>(),
}))

vi.mock('../../../app/pages/site/SidebarPlaygroundDesign', () => ({
  default: (props: { children?: unknown }) => (
    <div data-testid="mock-sidebar-design">{props.children}</div>
  ),
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: () => null,
}))

vi.mock('../../../app/pages/design/PreviewBlock', () => ({
  __esModule: true,
  default: (props: {
    title: string
    summary?: string
    tab: { value: 'preview' | 'code' }
    preview: (() => any) | any
  }) => {
    let previewContent: any = null

    if (props.tab.value === 'preview' && previewState.enabledTitles.has(props.title)) {
      if (typeof props.preview === 'function') {
        const PreviewComponent = props.preview as any
        previewContent = <PreviewComponent />
      } else {
        previewContent = props.preview ?? null
      }
    }

    return (
      <div className="component-preview not-prose text-base-content my-6 lg:my-12">
        <h2 className="component-preview-title mt-2 mb-1 text-lg font-semibold"># {props.title}</h2>
        {props.summary ? <p className="m-0 text-sm opacity-70">{props.summary}</p> : null}
        <div role="tablist" className="tabs tabs-box mb-3">
          <button
            role="tab"
            className={`tab ${props.tab.value === 'preview' ? 'tab-active' : ''}`}
            onClick={() => {
              props.tab.value = 'preview'
            }}
          >
            预览
          </button>
          <button
            role="tab"
            className={`tab ${props.tab.value === 'code' ? 'tab-active' : ''}`}
            onClick={() => {
              props.tab.value = 'code'
            }}
          >
            JSX代码
          </button>
        </div>
        {previewContent}
      </div>
    )
  },
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
  previewState.enabledTitles.clear()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('FileInput actual page', () => {
  it('renders file input demos and restores the sizes preview after toggling code', async () => {
    previewState.enabledTitles.add('File input sizes')
    previewState.enabledTitles.add('Disabled')

    const container = mountContainer()
    resetActiveRuntime()
    render(<FileInputPage />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('File Input 文件选择')
      expect(container.querySelector('.component-preview')).not.toBeNull()
    })

    const sizesDemo = findDemo(container, '# File input sizes') as HTMLElement | null
    const disabledDemo = findDemo(container, '# Disabled') as HTMLElement | null
    expect(sizesDemo).not.toBeNull()
    expect(disabledDemo).not.toBeNull()

    await waitForContent(() => {
      const currentSizesDemo = findDemo(container, '# File input sizes') as HTMLElement | null
      const currentDisabledDemo = findDemo(container, '# Disabled') as HTMLElement | null

      expect(currentSizesDemo!.querySelectorAll('input[type="file"]').length).toBe(5)
      expect(
        (currentDisabledDemo!.querySelector('input[type="file"]') as HTMLInputElement | null)
          ?.disabled,
      ).toBe(true)
    })

    await click(findTabButton(sizesDemo!, 'JSX代码'))
    expect(
      findDemo(container, '# File input sizes')?.querySelectorAll('input[type="file"]').length,
    ).toBe(0)

    await click(findTabButton(findDemo(container, '# File input sizes')!, '预览'))

    await waitForContent(() => {
      expect(
        findDemo(container, '# File input sizes')?.querySelectorAll('input[type="file"]').length,
      ).toBe(5)
    })
  })
})
