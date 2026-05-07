import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import StatPage from '../../../app/pages/design/Stat'
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
  Array.from(root.querySelectorAll('.component-preview h2')).map(node => normalize(node.textContent))

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('Stat actual page', () => {
  it('keeps legacy demos and API module together on the page', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(<StatPage />, container)

    await waitForContent(() => {
      const titles = getDemoTitles(container)

      expect(container.textContent).toContain('Stat 统计')
      expect(container.textContent).toContain('经典效果')
      expect(container.textContent).toContain('增强能力')
      expect(container.textContent).toContain('API 模块')

      expect(titles.filter(title => title === '# Stat').length).toBe(2)
      expect(titles).toContain('# Stat 通过数据渲染（数组，组件内部）')
      expect(titles).toContain('# Stat with icons or image')
      expect(titles).toContain('# Centered items')
      expect(titles).toContain('# Vertical')
      expect(titles).toContain('# Responsive')
      expect(titles).toContain('# With custom colors and button')
      expect(titles).toContain('# 数值格式化')
      expect(titles).toContain('# Timer / Countdown')

      expect(container.textContent).toContain('Stat.Timer / Stat.Countdown')
      expect(container.querySelectorAll('table.table').length).toBeGreaterThanOrEqual(4)
    })
  })
})