import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import { BasicControlledPreview } from '../../../app/pages/design/TimePicker'
import { click, mountContainer, waitForContent } from './page-test-utils'
import { resetActiveRuntime } from './design-page-test-utils'

setReactiveScheduling('sync')

const mountedContainers: HTMLDivElement[] = []
const slowTestTimeout = 30_000

const mountTestContainer = () => {
  const container = mountContainer()
  mountedContainers.push(container)
  return container
}

afterEach(() => {
  for (const container of mountedContainers) {
    render(null as any, container)
  }
  mountedContainers.length = 0
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.restoreAllMocks()
})

beforeEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const openPicker = async (input: HTMLInputElement) => {
  input.dispatchEvent(new FocusEvent('focus', { bubbles: true }))
  await click(input)
}

const clickPanelOption = async (
  container: HTMLDivElement,
  column: 'hour' | 'minute' | 'second' | 'meridiem',
  option: string,
) => {
  const button = container.querySelector(
    `button[data-rue-time-column="${column}"][data-rue-time-option="${option}"]`,
  ) as HTMLButtonElement
  const pointerDownEvent = new PointerEvent('pointerdown', { bubbles: true, cancelable: true })
  button.dispatchEvent(pointerDownEvent)
  expect(pointerDownEvent.defaultPrevented).toBe(true)
  const mouseDownEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
  button.dispatchEvent(mouseDownEvent)
  expect(mouseDownEvent.defaultPrevented).toBe(true)
  await click(button)
}

describe('TimePicker actual page', () => {
  it(
    'updates the basic live value after selecting a panel option',
    async () => {
      const container = mountTestContainer()
      resetActiveRuntime()
      render(<BasicControlledPreview />, container)

      await waitForContent(() => {
        const input = container.querySelector('input') as HTMLInputElement
        const liveValue = container.querySelector('.text-2xl.font-semibold') as HTMLDivElement
        expect(input.value).toBe('09:30:15')
        expect(liveValue.textContent).toBe('09:30:15')
      })

      const input = container.querySelector('input') as HTMLInputElement
      await openPicker(input)

      await waitForContent(() => {
        const popup = container.querySelector(
          '[data-rue-time-picker-popup="true"]',
        ) as HTMLDivElement
        const minuteButton = container.querySelector(
          'button[data-rue-time-column="minute"][data-rue-time-option="45"]',
        ) as HTMLButtonElement | null
        expect(popup).toBeTruthy()
        expect(minuteButton).toBeTruthy()
      })

      const minuteButton = container.querySelector(
        'button[data-rue-time-column="minute"][data-rue-time-option="45"]',
      ) as HTMLButtonElement
      const mouseDownEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
      minuteButton.dispatchEvent(mouseDownEvent)
      expect(mouseDownEvent.defaultPrevented).toBe(true)
      await click(minuteButton)

      await waitForContent(() => {
        const updatedInput = container.querySelector('input') as HTMLInputElement
        const updatedLiveValue = container.querySelector(
          '.text-2xl.font-semibold',
        ) as HTMLDivElement
        const popups = Array.from(
          container.querySelectorAll('[data-rue-time-picker-popup="true"]'),
        ) as HTMLDivElement[]
        expect(updatedInput.value).toBe('09:45:15')
        expect(updatedLiveValue.textContent).toBe('09:45:15')
        expect(popups.some(popup => !popup.hidden)).toBe(true)
      })
    },
    slowTestTimeout,
  )

  it(
    'keeps the basic controlled preview popup open across sequential hour minute second clicks',
    async () => {
      const container = mountTestContainer()
      resetActiveRuntime()
      render(<BasicControlledPreview />, container)

      const assertPopupOpen = () => {
        const popups = Array.from(
          container.querySelectorAll('[data-rue-time-picker-popup="true"]'),
        ) as HTMLDivElement[]
        expect(popups.some(popup => !popup.hidden)).toBe(true)
      }

      await waitForContent(() => {
        const input = container.querySelector('input') as HTMLInputElement
        const liveValue = container.querySelector('.text-2xl.font-semibold') as HTMLDivElement
        expect(input.value).toBe('09:30:15')
        expect(liveValue.textContent).toBe('09:30:15')
      })

      const input = container.querySelector('input') as HTMLInputElement
      await openPicker(input)

      await waitForContent(() => {
        expect(
          container.querySelector('button[data-rue-time-column="hour"][data-rue-time-option="10"]'),
        ).toBeTruthy()
        expect(
          container.querySelector(
            'button[data-rue-time-column="minute"][data-rue-time-option="45"]',
          ),
        ).toBeTruthy()
        expect(
          container.querySelector(
            'button[data-rue-time-column="second"][data-rue-time-option="30"]',
          ),
        ).toBeTruthy()
      })

      await clickPanelOption(container, 'hour', '10')

      await waitForContent(() => {
        const updatedInput = container.querySelector('input') as HTMLInputElement
        const updatedLiveValue = container.querySelector(
          '.text-2xl.font-semibold',
        ) as HTMLDivElement
        expect(updatedInput.value).toBe('10:30:15')
        expect(updatedLiveValue.textContent).toBe('10:30:15')
        assertPopupOpen()
      })

      await clickPanelOption(container, 'minute', '45')

      await waitForContent(() => {
        const updatedInput = container.querySelector('input') as HTMLInputElement
        const updatedLiveValue = container.querySelector(
          '.text-2xl.font-semibold',
        ) as HTMLDivElement
        expect(updatedInput.value).toBe('10:45:15')
        expect(updatedLiveValue.textContent).toBe('10:45:15')
        assertPopupOpen()
      })

      await clickPanelOption(container, 'second', '30')

      await waitForContent(() => {
        const updatedInput = container.querySelector('input') as HTMLInputElement
        const updatedLiveValue = container.querySelector(
          '.text-2xl.font-semibold',
        ) as HTMLDivElement
        expect(updatedInput.value).toBe('10:45:30')
        expect(updatedLiveValue.textContent).toBe('10:45:30')
        assertPopupOpen()
      })
    },
    slowTestTimeout,
  )
})
