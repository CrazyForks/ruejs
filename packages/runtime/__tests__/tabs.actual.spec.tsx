import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import TabsPage from '../../../app/pages/design/Tabs'
import { click, mountContainer, waitForContent } from './page-test-utils'

vi.mock('../../../app/pages/site/SidebarPlaygroundDesign', () => ({
  default: (props: { children?: unknown }) => (
    <div data-testid="mock-sidebar-design">{props.children}</div>
  ),
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: (props: { code?: string }) => <pre data-testid="mock-code">{props.code}</pre>,
}))

setReactiveScheduling('sync')

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

const findTabButton = (root: ParentNode, label: string) =>
  Array.from(root.querySelectorAll('button[role="tab"]')).find(button =>
    button.textContent?.includes(label),
  ) ?? null

const findPreviewByTitle = (root: ParentNode, title: string) =>
  Array.from(root.querySelectorAll('.component-preview')).find(block =>
    block.querySelector('h2')?.textContent?.includes(title),
  ) ?? null

const findCodeText = (root: ParentNode) =>
  (root.querySelector('[data-testid="mock-code"]') as HTMLElement | null)?.textContent ?? ''

const findVisiblePanelText = (root: ParentNode) =>
  Array.from(root.querySelectorAll<HTMLElement>('[role="tabpanel"]')).find(
    panel => panel.getAttribute('aria-hidden') !== 'true' && !panel.classList.contains('hidden'),
  )?.textContent ?? ''

describe('Tabs actual page', () => {
  it('keeps demo tab state stable across preview and code toggles', async () => {
    const container = mountContainer()
    render(<TabsPage />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('Tabs 选项卡')
      expect(container.querySelector('.component-preview')).not.toBeNull()
      const previewTexts = Array.from(container.querySelectorAll('.component-preview')).map(
        node => node.textContent ?? '',
      )
      expect(previewTexts.some(text => text.includes('[object Object]'))).toBe(false)
    })

    const getPrimaryDemo = () => container.querySelector('.component-preview') as HTMLElement | null
    expect(getPrimaryDemo()).not.toBeNull()

    const tab2 = findTabButton(getPrimaryDemo()!, 'Tab 2')
    expect(tab2?.classList.contains('tab-active')).toBe(true)

    await click(findTabButton(getPrimaryDemo()!, 'Tab 3'))

    const tab3 = findTabButton(getPrimaryDemo()!, 'Tab 3')
    expect(tab3?.classList.contains('tab-active')).toBe(true)

    await click(findTabButton(getPrimaryDemo()!, 'JSX代码'))
    expect(findTabButton(getPrimaryDemo()!, 'Tab 1')).toBeNull()
    expect(findTabButton(getPrimaryDemo()!, 'Tab 3')).toBeNull()

    await click(findTabButton(getPrimaryDemo()!, '预览'))

    await waitForContent(() => {
      expect(findTabButton(getPrimaryDemo()!, 'Tab 3')?.classList.contains('tab-active')).toBe(true)
    })
  })

  it('destroys inactive content-panels demo panels when switching tabs', async () => {
    const container = mountContainer()
    render(<TabsPage />, container)

    const preview = () => findPreviewByTitle(container, 'content-panels') as HTMLElement | null

    await waitForContent(() => {
      expect(preview()).not.toBeNull()
      expect(findVisiblePanelText(preview()!)).toContain('Velocity')
      expect(preview()?.querySelectorAll('[role="tabpanel"]').length).toBe(1)
    })

    await click(findTabButton(preview()!, 'Activity'))

    await waitForContent(() => {
      expect(findVisiblePanelText(preview()!)).not.toContain('Velocity')
      expect(findVisiblePanelText(preview()!)).toContain('设计评审通过，进入开发联调。')
      expect(preview()?.querySelectorAll('[role="tabpanel"]').length).toBe(1)
    })

    await click(findTabButton(preview()!, 'Overview'))

    await waitForContent(() => {
      expect(findVisiblePanelText(preview()!)).toContain('Velocity')
      expect(findVisiblePanelText(preview()!)).toContain('锁定接口字段命名')
      expect(findVisiblePanelText(preview()!)).not.toContain('设计评审通过，进入开发联调。')
      expect(preview()?.querySelectorAll('[role="tabpanel"]').length).toBe(1)
    })

    await click(findTabButton(preview()!, 'Activity'))

    await waitForContent(() => {
      expect(findVisiblePanelText(preview()!)).not.toContain('Velocity')
      expect(findVisiblePanelText(preview()!)).toContain('设计评审通过，进入开发联调。')
      expect(preview()?.querySelectorAll('[role="tabpanel"]').length).toBe(1)
    })
  })

  it('applies custom-indicator override class on the active tab', async () => {
    const container = mountContainer()
    render(<TabsPage />, container)

    const preview = () => findPreviewByTitle(container, 'custom-indicator') as HTMLElement | null

    await waitForContent(() => {
      const metricsTab = findTabButton(preview()!, 'Metrics')
      expect(metricsTab?.classList.contains('rue-tabs-indicator-active')).toBe(true)
    })
  })

  it('switches controlled demo panels for extra content, placement, editable-card, and bottom placement', async () => {
    const container = mountContainer()
    render(<TabsPage />, container)

    const extraPreview = () =>
      findPreviewByTitle(container, 'tab-bar-extra-content') as HTMLElement | null
    const placementPreview = () =>
      findPreviewByTitle(container, 'tab-placement') as HTMLElement | null
    const editablePreview = () =>
      findPreviewByTitle(container, 'editable-card') as HTMLElement | null
    const bottomPreview = () => findPreviewByTitle(container, 'tabs-bottom') as HTMLElement | null

    await waitForContent(() => {
      expect(extraPreview()).not.toBeNull()
      expect(placementPreview()).not.toBeNull()
      expect(editablePreview()).not.toBeNull()
      expect(bottomPreview()).not.toBeNull()
      expect(findVisiblePanelText(extraPreview()!)).toContain(
        '版本计划、优先级排序与协作说明统一放在这里。',
      )
      expect(findVisiblePanelText(placementPreview()!)).toContain(
        '左侧导航布局适合文档、设置页和大段信息浏览。',
      )
      expect(findVisiblePanelText(editablePreview()!)).toContain('设计走查与交互标注已经完成。')
      expect(findVisiblePanelText(bottomPreview()!)).toContain('Tab content 2')
    })

    await click(findTabButton(extraPreview()!, 'Timeline'))
    await click(findTabButton(placementPreview()!, 'Review'))
    await click(findTabButton(editablePreview()!, 'Draft 1'))
    await click(findTabButton(bottomPreview()!, 'Tab 3'))

    await waitForContent(() => {
      expect(findVisiblePanelText(extraPreview()!)).toContain(
        '时间轴、里程碑和负责人信息可以作为右侧扩展操作的搭配内容。',
      )
      expect(findVisiblePanelText(extraPreview()!)).not.toContain(
        '版本计划、优先级排序与协作说明统一放在这里。',
      )

      expect(findVisiblePanelText(placementPreview()!)).toContain(
        '右侧摆放则更适合注释面板或对照式配置区域。',
      )
      expect(findVisiblePanelText(placementPreview()!)).not.toContain(
        '左侧导航布局适合文档、设置页和大段信息浏览。',
      )

      expect(findVisiblePanelText(editablePreview()!)).toContain('需求说明、依赖评估与风险梳理。')
      expect(findVisiblePanelText(editablePreview()!)).not.toContain('设计走查与交互标注已经完成。')

      expect(findVisiblePanelText(bottomPreview()!)).toContain('Tab content 3')
      expect(findVisiblePanelText(bottomPreview()!)).not.toContain('Tab content 2')
    })
  })

  it('renders copy-ready JSX snippets for complex demos', async () => {
    const container = mountContainer()
    render(<TabsPage />, container)

    const contentPanels = () =>
      findPreviewByTitle(container, 'content-panels') as HTMLElement | null
    const tabBarExtra = () =>
      findPreviewByTitle(container, 'tab-bar-extra-content') as HTMLElement | null
    const tabPlacement = () => findPreviewByTitle(container, 'tab-placement') as HTMLElement | null
    const editableCard = () => findPreviewByTitle(container, 'editable-card') as HTMLElement | null

    await waitForContent(() => {
      expect(contentPanels()).not.toBeNull()
      expect(tabBarExtra()).not.toBeNull()
      expect(tabPlacement()).not.toBeNull()
      expect(editableCard()).not.toBeNull()
    })

    await click(findTabButton(contentPanels()!, 'JSX代码'))
    await waitForContent(() => {
      const code = findCodeText(contentPanels()!)
      expect(code).toContain('progress progress-primary')
      expect(code).toContain('锁定接口字段命名')
      expect(code).not.toContain('<OverviewPanel />')
      expect(code).not.toContain('...')
    })

    await click(findTabButton(tabBarExtra()!, 'JSX代码'))
    await waitForContent(() => {
      const code = findCodeText(tabBarExtra()!)
      expect(code).toContain("const activeKey = ref('overview')")
      expect(code).toContain("children: '版本计划、优先级排序与协作说明统一放在这里。'")
      expect(code).not.toContain('items={items}')
    })

    await click(findTabButton(tabPlacement()!, 'JSX代码'))
    await waitForContent(() => {
      const code = findCodeText(tabPlacement()!)
      expect(code).toContain("const placementMode = ref<'start' | 'end'>('start')")
      expect(code).toContain("children: '左侧导航布局适合文档、设置页和大段信息浏览。'")
      expect(code).not.toContain("children: '...'")
    })

    await click(findTabButton(editableCard()!, 'JSX代码'))
    await waitForContent(() => {
      const code = findCodeText(editableCard()!)
      expect(code).toContain('const handleEditableEdit = (eventOrKey: MouseEvent | string, action:')
      expect(code).toContain("children: '需求说明、依赖评估与风险梳理。'")
      expect(code).not.toContain('// append item')
      expect(code).not.toContain("children: '...'")
    })
  })
})
