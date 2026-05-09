import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import CollapsePage from '../../../app/pages/design/Collapse'
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

describe('Collapse actual page', () => {
  it('keeps legacy collapse demos and API module on the page', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(<CollapsePage />, container)

    await waitForContent(() => {
      const titles = getDemoTitles(container)

      expect(container.textContent).toContain('Collapse 折叠面板')
      expect(container.textContent).toContain('增强能力')
      expect(container.textContent).toContain('API')

      expect(titles).toContain('# Collapse with focus')
      expect(titles).toContain('# Collapse with checkbox')
      expect(titles).toContain('# Collapse using details and summary tag')
      expect(titles).toContain('# Without border and background color')
      expect(titles).toContain('# With arrow icon')
      expect(titles).toContain('# With plus/minus icon')
      expect(titles).toContain('# Moving collapse icon to the start')
      expect(titles).toContain('# Force open')
      expect(titles).toContain('# Force close')
      expect(titles).toContain('# Custom colors for collapse that works with focus')
      expect(titles).toContain('# Custom colors for collapse that works with checkbox')
      expect(titles).toContain('# Items 基础用法')
      expect(titles).toContain('# Accordion')

      expect(container.querySelectorAll('table.table').length).toBeGreaterThanOrEqual(1)
    })
  })
})
