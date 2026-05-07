import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, setReactiveScheduling } from '../src'
import SkeletonPage from '../../../app/pages/design/Skeleton'
import { click, mountContainer, waitForContent } from './page-test-utils'
import { findDemo, findTabButton, resetActiveRuntime } from './design-page-test-utils'

const findButton = (root: ParentNode, label: string) =>
  Array.from(root.querySelectorAll('button')).find(button => button.textContent?.trim() === label) ?? null

vi.mock('@rue-js/design', async () => {
  const [skeletonMod, tabsMod] = await Promise.all([
    import('../../../packages/rue-design/src/components/skeleton/index'),
    import('../../../packages/rue-design/src/components/tabs/index'),
  ])
  return {
    Skeleton: skeletonMod.default,
    Tabs: tabsMod.default,
  }
})

vi.mock('../../../app/pages/site/SidebarPlaygroundDesign', () => ({
  default: (props: { children?: unknown }) => (
    <div data-testid="mock-sidebar-design">{props.children}</div>
  ),
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: (props: { code?: string }) => <pre data-testid="mock-code">{props.code ?? ''}</pre>,
}))

setReactiveScheduling('sync')

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('Skeleton actual page', () => {
  it('renders skeleton demos and supports preview/code tab switching', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(<SkeletonPage />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('Skeleton 骨架屏')
      expect(container.textContent).not.toContain('[object Object]')
      expect(container.querySelectorAll('.component-preview').length).toBe(10)
      expect(container.querySelector('[data-testid="skeleton-basic"]')).not.toBeNull()
      expect(container.querySelector('[data-testid="skeleton-list-demo"]')).not.toBeNull()
      expect(container.querySelector('[data-testid="skeleton-semantic-demo"]')).not.toBeNull()
    })

    const loadingDemo = findDemo(container, '# Loading Switch') as HTMLElement | null
    expect(loadingDemo).not.toBeNull()

    await click(findTabButton(loadingDemo!, 'JSX代码'))
    const loadingDemoInCode = findDemo(container, '# Loading Switch') as HTMLElement | null
    expect(loadingDemoInCode!.querySelector('[data-testid="mock-code"]')).not.toBeNull()

    await click(findTabButton(loadingDemoInCode!, '预览'))

    await waitForContent(() => {
      const restoredDemo = findDemo(container, '# Loading Switch') as HTMLElement | null
      expect(restoredDemo!.querySelector('[data-testid="mock-code"]')).toBeNull()
    })
  })

  it('updates the loading, list, and element demos when toggles are clicked', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(<SkeletonPage />, container)

    let loadingDemo: HTMLElement | null = null
    let listDemo: HTMLElement | null = null
    let elementsDemo: HTMLElement | null = null

    await waitForContent(() => {
      loadingDemo = findDemo(container, '# Loading Switch') as HTMLElement | null
      listDemo = findDemo(container, '# List Layout') as HTMLElement | null
      elementsDemo = findDemo(container, '# Element Variants') as HTMLElement | null

      expect(loadingDemo).not.toBeNull()
      expect(listDemo).not.toBeNull()
      expect(elementsDemo).not.toBeNull()

      const image = elementsDemo!.querySelector('[data-testid="skeleton-elements-image"]') as HTMLElement
      const node = elementsDemo!.querySelector('[data-testid="skeleton-elements-node"]') as HTMLElement
      const imageWrap = elementsDemo!.querySelector('[data-testid="skeleton-elements-image-wrap"]') as HTMLElement
      const nodeWrap = elementsDemo!.querySelector('[data-testid="skeleton-elements-node-wrap"]') as HTMLElement

      expect(imageWrap).not.toBeNull()
      expect(nodeWrap).not.toBeNull()
      expect(imageWrap.contains(image)).toBe(true)
      expect(nodeWrap.contains(node)).toBe(true)
      expect(image.classList.contains('animate-pulse')).toBe(true)
      expect(image.classList.contains('aspect-video')).toBe(true)
      expect(node.classList.contains('animate-pulse')).toBe(true)
      expect(node.querySelectorAll('[data-testid="skeleton-elements-node-icon"]').length).toBe(1)
    })

    await click(findButton(loadingDemo!, '显示内容'))
    await waitForContent(() => {
      expect(loadingDemo!.textContent).toContain('重新加载')
      expect(loadingDemo!.textContent).toContain('内容已展示')
      expect(loadingDemo!.textContent).toContain('Rue Design Skeleton')
    })

    await click(findButton(listDemo!, '显示列表'))
    await waitForContent(() => {
      expect(listDemo!.textContent).toContain('重新加载列表')
      expect(listDemo!.textContent).toContain('Ops broadcast draft')
    })

    await click(findButton(elementsDemo!, '开启 block'))
    await click(findButton(elementsDemo!, 'Avatar: circle'))
    await click(findButton(elementsDemo!, 'Image: video'))
    await click(findButton(elementsDemo!, '关闭 active'))
    await waitForContent(() => {
      expect(elementsDemo!.textContent).toContain('关闭 block')
      expect(elementsDemo!.textContent).toContain('Avatar: square')
      expect(elementsDemo!.textContent).toContain('Image: square')
      expect(elementsDemo!.textContent).toContain('开启 active')

      const image = elementsDemo!.querySelector('[data-testid="skeleton-elements-image"]') as HTMLElement
      const node = elementsDemo!.querySelector('[data-testid="skeleton-elements-node"]') as HTMLElement

      expect(image.classList.contains('animate-pulse')).toBe(false)
      expect(image.classList.contains('aspect-square')).toBe(true)
      expect(node.classList.contains('animate-pulse')).toBe(false)
      expect(node.querySelectorAll('[data-testid="skeleton-elements-node-icon"]').length).toBe(1)
      expect(elementsDemo!.querySelectorAll('[data-testid="skeleton-elements-node-icon"]').length).toBe(1)
    })

    await click(findButton(elementsDemo!, '开启 active'))
    await waitForContent(() => {
      const image = elementsDemo!.querySelector('[data-testid="skeleton-elements-image"]') as HTMLElement
      const node = elementsDemo!.querySelector('[data-testid="skeleton-elements-node"]') as HTMLElement

      expect(image.classList.contains('animate-pulse')).toBe(true)
      expect(node.classList.contains('animate-pulse')).toBe(true)
      expect(node.querySelectorAll('[data-testid="skeleton-elements-node-icon"]').length).toBe(1)
    })
  })
})
