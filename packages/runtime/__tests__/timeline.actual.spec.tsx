import { readFileSync } from 'node:fs'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { setReactiveScheduling } from '../src'

vi.mock('../../../app/pages/site/SidebarPlaygroundDesign', () => ({
  default: (props: { children?: unknown }) => (
    <div data-testid="mock-sidebar-design">{props.children}</div>
  ),
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: () => null,
}))

setReactiveScheduling('sync')

const timelinePageSource = readFileSync(`${process.cwd()}/app/pages/design/Timeline.tsx`, 'utf8')

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('Timeline actual page', () => {
  it('keeps timeline demos alongside enhanced API sections', async () => {
    expect(timelinePageSource).toContain('Timeline 时间线')
    expect(timelinePageSource).toContain('增强能力')
    expect(timelinePageSource).toContain('API')
    expect(timelinePageSource).toContain('title="Timeline 通过数据渲染（数组）"')
    expect(timelinePageSource).toContain('title="Timeline 通过数据渲染（数组，组件内部）"')
    expect(timelinePageSource).toContain('title="两侧文字与图标"')
    expect(timelinePageSource).toContain('title="仅底部一侧"')
    expect(timelinePageSource).toContain('title="不同侧交替"')
    expect(timelinePageSource).toContain('title="彩色线条"')
    expect(timelinePageSource).toContain('title="无图标"')
    expect(timelinePageSource).toContain('title="纵向：两侧文字与图标"')
    expect(timelinePageSource).toContain('title="纵向：仅右侧"')
    expect(timelinePageSource).toContain('title="纵向：不同侧交替"')
    expect(timelinePageSource).toContain('title="纵向：彩色线条"')
    expect(timelinePageSource).toContain('title="图标吸附到起始侧（snap to start）"')
    expect(timelinePageSource).toContain('title="reverse 与 pending"')
    expect(timelinePageSource.match(/table table/g)?.length ?? 0).toBeGreaterThanOrEqual(1)
  })
})
