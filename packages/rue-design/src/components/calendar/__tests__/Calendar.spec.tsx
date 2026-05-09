import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref, render, setReactiveScheduling } from '@rue-js/rue'
import Calendar from '../index'
import {
  click,
  mountContainer,
  waitForContent,
} from '../../../../../runtime/__tests__/page-test-utils'

setReactiveScheduling('sync')

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

const formatIsoDate = (date: Date) => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Calendar', () => {
  it('renders the enhanced calendar panel by default and supports date selection', async () => {
    const c = mountContainer()
    const onChange = vi.fn()
    const ControlledCalendar = () => {
      const value = ref('2026-04-12')

      return (
        <Calendar
          data-testid="calendar-root"
          locale="en-US"
          value={value.value}
          onChange={date => {
            value.value = formatIsoDate(date)
            onChange(date)
          }}
        />
      )
    }

    resetActiveRuntime()
    render(<ControlledCalendar />, c)

    await waitForContent(() => {
      const root = c.querySelector('[data-testid="calendar-root"]') as HTMLElement
      expect(root).toBeTruthy()
      expect(root.getAttribute('data-rue-calendar-mode')).toBe('month')
      expect(c.querySelectorAll('[data-rue-calendar-cell]').length).toBe(42)
      expect(root.textContent).toContain('April')
      expect(
        c.querySelector('[data-rue-calendar-cell="2026-04-12"]')?.getAttribute('aria-pressed'),
      ).toBe('true')
    })

    await click(c.querySelector('[data-rue-calendar-cell="2026-04-18"]'))

    await waitForContent(() => {
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(formatIsoDate(onChange.mock.calls[0]?.[0] as Date)).toBe('2026-04-18')
    })
  })

  it('supports year mode and custom month cell rendering', async () => {
    const c = mountContainer()
    resetActiveRuntime()
    render(
      <Calendar
        data-testid="year-calendar"
        locale="en-US"
        mode="year"
        defaultValue={new Date('2026-09-01T00:00:00')}
        validRange={[new Date('2026-03-01T00:00:00'), new Date('2026-10-31T00:00:00')]}
        cellRender={(date, info) =>
          info.type === 'month' && date.getMonth() === 8 ? (
            <span data-testid="month-backlog">43</span>
          ) : null
        }
      />,
      c,
    )

    await waitForContent(() => {
      const root = c.querySelector('[data-testid="year-calendar"]') as HTMLElement
      expect(root.getAttribute('data-rue-calendar-mode')).toBe('year')
      expect(c.querySelectorAll('[data-rue-calendar-month]').length).toBe(12)
      expect(c.querySelector('[data-testid="month-backlog"]')?.textContent).toBe('43')

      const january = c.querySelector('[data-rue-calendar-month="2026-01"]') as HTMLButtonElement
      const september = c.querySelector('[data-rue-calendar-month="2026-09"]') as HTMLButtonElement
      expect(january.disabled).toBe(true)
      expect(september.disabled).toBe(false)
    })
  })

  it('preserves Cally and Pikaday wrapper subcomponents', async () => {
    const c = mountContainer()
    resetActiveRuntime()
    render(
      <div>
        <Calendar.Cally data-testid="cally-host">
          <Calendar.Month className="rounded-box" data-testid="month-host" />
        </Calendar.Cally>
        <Calendar.PikaSingle id="picker" className="input input-bordered" value="Pick a day" />
      </div>,
      c,
    )

    await waitForContent(() => {
      const cally = c.querySelector('[data-testid="cally-host"]') as HTMLElement
      const month = c.querySelector('[data-testid="month-host"]') as HTMLElement
      const el = c.querySelector('input.pika-single') as HTMLInputElement
      expect(cally.tagName.toLowerCase()).toBe('calendar-date')
      expect(cally.classList.contains('cally')).toBe(true)
      expect(month.tagName.toLowerCase()).toBe('calendar-month')
      expect(month.classList.contains('rounded-box')).toBe(true)
      expect(el).toBeTruthy()
      expect(el.type).toBe('text')
      expect(el.id).toBe('picker')
      expect(el.classList.contains('input')).toBe(true)
      expect(el.classList.contains('input-bordered')).toBe(true)
      expect(el.value).toBe('Pick a day')
    })
  })
})
