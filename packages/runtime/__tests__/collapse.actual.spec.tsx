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

const collapsePageSource = readFileSync(`${process.cwd()}/app/pages/design/Collapse.tsx`, 'utf8')

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('Collapse actual page', () => {
  it('keeps legacy collapse demos and API module on the page', async () => {
    expect(collapsePageSource).toContain('Collapse 折叠面板')
    expect(collapsePageSource).toContain('增强能力')
    expect(collapsePageSource).toContain('API')
    expect(collapsePageSource).toContain('title="Collapse with focus"')
    expect(collapsePageSource).toContain('title="Collapse with checkbox"')
    expect(collapsePageSource).toContain('title="Collapse using details and summary tag"')
    expect(collapsePageSource).toContain('title="Without border and background color"')
    expect(collapsePageSource).toContain('title="With arrow icon"')
    expect(collapsePageSource).toContain('title="With plus/minus icon"')
    expect(collapsePageSource).toContain('title="Moving collapse icon to the start"')
    expect(collapsePageSource).toContain('title="Force open"')
    expect(collapsePageSource).toContain('title="Force close"')
    expect(collapsePageSource).toContain('title="Custom colors for collapse that works with focus"')
    expect(collapsePageSource).toContain(
      'title="Custom colors for collapse that works with checkbox"',
    )
    expect(collapsePageSource).toContain('title="Items 基础用法"')
    expect(collapsePageSource).toContain('title="Accordion"')
    expect(collapsePageSource.match(/table table/g)?.length ?? 0).toBeGreaterThanOrEqual(1)
  })
})
