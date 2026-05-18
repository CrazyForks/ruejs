import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import CalendarPage from '../../../app/pages/design/Calendar'
import { mountContainer, waitForContent } from './page-test-utils'

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

describe('Calendar actual page', () => {
  it.skip('renders the calendar page without eagerly mounting legacy third-party previews', async () => {
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
      expect(container.querySelectorAll('calendar-date.cally').length).toBe(0)
      expect(container.querySelectorAll('input.pika-single').length).toBe(0)
      expect(container.querySelectorAll('[data-pikaday-bound="true"]').length).toBe(0)
      expect(container.textContent).toContain('加载预览')
      expect(
        Array.from(container.querySelectorAll('button')).filter(
          button => button.textContent?.trim() === '加载预览',
        ).length,
      ).toBe(3)
    })
  })
})
