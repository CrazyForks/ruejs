import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import CalendarPage from '../../../app/pages/design/Calendar'
import { click, mountContainer, waitForContent } from './page-test-utils'

const fakePikadayModule = {
  default: class FakePikaday {
    constructor(options: { field?: HTMLInputElement; onSelect?: (date: Date) => void }) {
      if (options.field) {
        options.field.value = options.field.value || '2026-04-12'
        options.field.setAttribute('data-pikaday-bound', 'true')
      }
      options.onSelect?.(new Date('2026-04-12T00:00:00'))
    }

    destroy() {}
  },
}

vi.mock('../../../app/pages/site/SidebarPlaygroundDesign', () => ({
  default: (props: { children?: unknown }) => (
    <div data-testid="mock-sidebar-design">{props.children}</div>
  ),
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: () => null,
}))

setReactiveScheduling('sync')

let activeContainer: HTMLElement | null = null

afterEach(() => {
  if (activeContainer) {
    render(null, activeContainer)
    activeContainer = null
  }
  document.body.innerHTML = ''
  delete (globalThis as { __RUE_CALENDAR_EXTERNALS__?: unknown }).__RUE_CALENDAR_EXTERNALS__
  vi.restoreAllMocks()
})

const findTabButton = (root: ParentNode, label: string) =>
  Array.from(root.querySelectorAll('button[role="tab"]')).find(
    button => button.textContent?.trim() === label,
  ) ?? null

const findPreviewBlock = (root: ParentNode, title: string) =>
  Array.from(root.querySelectorAll('.component-preview')).find(block =>
    block.querySelector('.component-preview-title')?.textContent?.includes(title),
  ) ?? null

describe('Calendar actual page', () => {
  it('renders the enhanced calendar demos and preserves legacy third-party examples', async () => {
    ;(globalThis as { __RUE_CALENDAR_EXTERNALS__?: unknown }).__RUE_CALENDAR_EXTERNALS__ = {
      cally: async () => ({}),
      pikaday: async () => fakePikadayModule,
    }

    const container = mountContainer()
    activeContainer = container
    render(<CalendarPage />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('Calendar 日历')
      expect(container.querySelectorAll('.component-preview').length).toBe(7)
      expect(container.textContent).toContain('Basic calendar')
      expect(container.textContent).toContain('Notice calendar')
      expect(container.textContent).toContain('Card mode')
      expect(container.textContent).toContain('Custom header')
      expect(container.textContent).toContain('Cally calendar example')
      expect(container.textContent).toContain('Cally date picker example')
      expect(container.textContent).toContain('Pikaday input example')
      expect(container.querySelectorAll('[data-rue-calendar-root]').length).toBe(4)
      expect(container.querySelectorAll('calendar-date.cally').length).toBe(2)
      expect(container.querySelectorAll('input.pika-single').length).toBe(1)
      expect(container.querySelectorAll('[data-pikaday-bound="true"]').length).toBe(1)
    })

    const basicPreview = findPreviewBlock(container, 'Basic calendar')
    const customHeaderPreview = findPreviewBlock(container, 'Custom header')
    const callyPreview = findPreviewBlock(container, 'Cally calendar example')
    const callyPickerPreview = findPreviewBlock(container, 'Cally date picker example')
    expect(basicPreview).not.toBeNull()
    expect(customHeaderPreview).not.toBeNull()
    expect(callyPreview).not.toBeNull()
    expect(callyPickerPreview).not.toBeNull()

    await click(basicPreview!.querySelector('[data-rue-calendar-cell="2026-04-22"]'))

    await waitForContent(() => {
      expect(basicPreview?.textContent).toContain('2026-04-22')
      expect(basicPreview?.textContent).toContain('date')
    })

    await click(
      Array.from(customHeaderPreview!.querySelectorAll('button')).find(
        button => button.textContent?.trim() === '年视图',
      ) ?? null,
    )

    await waitForContent(() => {
      const headerCalendar = customHeaderPreview!.querySelector(
        '[data-testid="custom-header-calendar"]',
      ) as HTMLElement
      expect(headerCalendar.getAttribute('data-rue-calendar-mode')).toBe('year')
      expect(customHeaderPreview?.textContent).toContain('year')
    })

    const calendarHost = callyPreview!.querySelector('[data-testid="cally-calendar"]') as any
    calendarHost.value = '2026-04-18'
    calendarHost.dispatchEvent(new Event('change', { bubbles: true }))

    await waitForContent(() => {
      expect(callyPreview?.textContent).toContain('2026-04-18')
    })

    await click(callyPickerPreview!.querySelector('[data-testid="cally-picker-button"]'))

    await waitForContent(() => {
      expect(
        callyPickerPreview!.querySelector('[data-testid="cally-picker-panel"]')?.className,
      ).not.toContain('hidden')
    })

    const pickerCalendar = callyPickerPreview!.querySelector(
      '[data-testid="cally-picker-calendar"]',
    ) as any
    pickerCalendar.value = '2026-04-24'
    pickerCalendar.dispatchEvent(new Event('change', { bubbles: true }))

    await waitForContent(() => {
      expect(callyPickerPreview?.textContent).toContain('2026-04-24')
      expect(
        callyPickerPreview!.querySelector('[data-testid="cally-picker-panel"]')?.className,
      ).toContain('hidden')
    })

    await click(findTabButton(basicPreview!, 'JSX代码'))

    await waitForContent(() => {
      const basicPreviewInCode = findPreviewBlock(container, 'Basic calendar')
      expect(basicPreviewInCode!.querySelector('[data-testid="basic-calendar"]')).toBeNull()
    })

    await click(findTabButton(findPreviewBlock(container, 'Basic calendar')!, '预览'))

    await waitForContent(() => {
      const restoredBasicPreview = findPreviewBlock(container, 'Basic calendar')
      expect(restoredBasicPreview!.querySelector('[data-testid="basic-calendar"]')).not.toBeNull()
    })
  })
})
