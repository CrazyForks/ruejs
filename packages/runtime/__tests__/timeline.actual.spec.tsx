import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import TimelinePage from '../../../app/pages/design/Timeline'
import { mountContainer, waitForContent } from './page-test-utils'

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

const getDemoTitles = (root: ParentNode) =>
  Array.from(root.querySelectorAll('.component-preview-title')).map(node =>
    normalize(node.textContent),
  )

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('Timeline actual page', () => {
  it('keeps legacy timeline demos alongside enhanced API sections', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(<TimelinePage />, container)

    await waitForContent(() => {
      const titles = getDemoTitles(container)
      const reverseIndex = titles.lastIndexOf('# reverse 与 pending')
      const snapIndex = titles.indexOf('# 图标吸附到起始侧（snap to start）')

      expect(container.textContent).toContain('Timeline 时间线')
      expect(container.textContent).toContain('增强能力')
      expect(container.textContent).toContain('API')

      expect(titles).toContain('# Timeline 通过数据渲染（数组）')
      expect(titles).toContain('# Timeline 通过数据渲染（数组，组件内部）')
      expect(titles).toContain('# 两侧文字与图标')
      expect(titles).toContain('# 仅底部一侧')
      expect(titles).toContain('# 不同侧交替')
      expect(titles).toContain('# 彩色线条')
      expect(titles).toContain('# 无图标')
      expect(titles).toContain('# 纵向：两侧文字与图标')
      expect(titles).toContain('# 纵向：仅右侧')
      expect(titles).toContain('# 纵向：不同侧交替')
      expect(titles).toContain('# 纵向：彩色线条')
      expect(titles).toContain('# 图标吸附到起始侧（snap to start）')
      expect(titles).toContain('# reverse 与 pending')

      expect(reverseIndex).toBeGreaterThan(snapIndex)
      expect(container.querySelectorAll('table.table').length).toBeGreaterThanOrEqual(2)
    })
  })
})
