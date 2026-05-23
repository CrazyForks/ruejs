import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import CalendarPage from '../../../app/pages/design/Calendar'
import { mountContainer, waitForContent } from './page-test-utils'
import { findDemo } from './design-page-test-utils'

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
  it('updates the basic calendar preview after selecting a date', async () => {
    ;(globalThis as { __RUE_CALENDAR_EXTERNALS__?: unknown }).__RUE_CALENDAR_EXTERNALS__ = {
      cally: async () => ({}),
      pikaday: async () => fakePikadayModule,
    }

    const container = mountContainer()
    activeContainer = container

    render(<CalendarPage />, container)

    await waitForContent(() => {
      const basicDemo = findDemo(container, '# Basic calendar')
      expect(basicDemo).not.toBeNull()
      const resolvedDemo = basicDemo as HTMLElement
      expect(resolvedDemo.querySelector('[data-rue-calendar-root="true"]')).not.toBeNull()
      expect(resolvedDemo.querySelector('[data-rue-calendar-cell="2026-04-15"]')).not.toBeNull()
    })

    const basicDemo = findDemo(container, '# Basic calendar') as HTMLElement

    const targetDate = basicDemo.querySelector(
      '[data-rue-calendar-cell="2026-04-15"]',
    ) as HTMLButtonElement | null
    targetDate?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    await waitForContent(() => {
      const updatedDemo = findDemo(container, '# Basic calendar') as HTMLElement | null
      expect(updatedDemo).not.toBeNull()
      expect(updatedDemo?.textContent).toContain('2026-04-15')
      expect(updatedDemo?.textContent).toContain('date')
      expect(
        updatedDemo
          ?.querySelector('[data-rue-calendar-cell="2026-04-15"]')
          ?.getAttribute('aria-pressed'),
      ).toBe('true')
    })

    const nextDate = basicDemo.querySelector(
      '[data-rue-calendar-cell="2026-04-16"]',
    ) as HTMLButtonElement | null
    nextDate?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    await waitForContent(() => {
      const updatedDemo = findDemo(container, '# Basic calendar') as HTMLElement | null
      expect(updatedDemo).not.toBeNull()
      expect(updatedDemo?.textContent).toContain('2026-04-16')
      expect(
        updatedDemo
          ?.querySelector('[data-rue-calendar-cell="2026-04-15"]')
          ?.getAttribute('aria-pressed'),
      ).toBe('false')
      expect(
        updatedDemo
          ?.querySelector('[data-rue-calendar-cell="2026-04-16"]')
          ?.getAttribute('aria-pressed'),
      ).toBe('true')
    })
  })

  it('renders native and legacy calendar demos without manual load buttons', async () => {
    ;(globalThis as { __RUE_CALENDAR_EXTERNALS__?: unknown }).__RUE_CALENDAR_EXTERNALS__ = {
      cally: async () => ({}),
      pikaday: async () => fakePikadayModule,
    }

    const container = mountContainer()
    activeContainer = container
    render(<CalendarPage />, container)

    await waitForContent(() => {
      expect(container.querySelectorAll('.component-preview').length).toBe(7)
      expect(container.textContent).toContain('Calendar 日历')
      expect(container.textContent).toContain('Basic calendar')
      expect(container.textContent).toContain('Notice calendar')
      expect(container.textContent).toContain('Card mode')
      expect(container.textContent).toContain('Custom header')
      expect(container.textContent).toContain('Cally calendar example')
      expect(container.textContent).toContain('Cally date picker example')
      expect(container.textContent).toContain('Pikaday input example')
      expect(container.querySelectorAll('calendar-date.cally').length).toBeGreaterThan(0)
      expect(container.querySelectorAll('input.pika-single').length).toBeGreaterThan(0)
      expect(container.textContent).toContain('Loading Cally...')
      expect(container.textContent).toContain('Loading Pikaday...')
      expect(container.textContent).not.toContain('加载预览')
    })

    const noticeDemo = findDemo(container, '# Notice calendar')
    const cardDemo = findDemo(container, '# Card mode')
    const headerDemo = findDemo(container, '# Custom header')
    const callyDemo = findDemo(container, '# Cally calendar example')
    const pickerDemo = findDemo(container, '# Cally date picker example')
    const pikadayDemo = findDemo(container, '# Pikaday input example')

    expect(noticeDemo).not.toBeNull()
    expect(cardDemo).not.toBeNull()
    expect(headerDemo).not.toBeNull()
    expect(callyDemo).not.toBeNull()
    expect(pickerDemo).not.toBeNull()
    expect(pikadayDemo).not.toBeNull()
    expect(callyDemo?.textContent).toContain('当前选择：2026-04-12')
    expect(pickerDemo?.textContent).toContain('Pick a date')
    expect(pikadayDemo?.textContent).toContain('输入框已挂上真实 Pikaday 实例')
  })
})
