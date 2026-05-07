import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import FileInputPage from '../../../app/pages/design/FileInput'
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

describe('FileInput actual page', () => {
  it('renders file input demos and restores the sizes preview after toggling code', async () => {
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
      expect(sizesDemo!.querySelectorAll('.file-input').length).toBe(5)
      expect((disabledDemo!.querySelector('.file-input') as HTMLInputElement | null)?.disabled).toBe(
        true,
      )
    })

    await click(findTabButton(sizesDemo!, 'JSX代码'))
    expect(sizesDemo!.querySelectorAll('.file-input').length).toBe(0)

    await click(findTabButton(sizesDemo!, '预览'))

    await waitForContent(() => {
      expect(sizesDemo!.querySelectorAll('.file-input').length).toBe(5)
    })
  })
})