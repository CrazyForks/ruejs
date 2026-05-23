import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref, render, setReactiveScheduling } from '@rue-js/rue'
import TimePicker from '../index'
import {
  click,
  flush,
  mountContainer,
  waitForContent,
  waitForMacrotask,
} from '../../../../../runtime/__tests__/page-test-utils'

setReactiveScheduling('sync')

const mountedContainers: HTMLDivElement[] = []

const mountTestContainer = () => {
  const container = mountContainer()
  mountedContainers.push(container)
  return container
}

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

const slowTestTimeout = 30_000

afterEach(async () => {
  resetActiveRuntime()
  for (const container of mountedContainers) {
    render(null as any, container)
  }
  mountedContainers.length = 0
  await flush(4)
  await waitForMacrotask()
  await waitForMacrotask()
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.restoreAllMocks()
})

beforeEach(() => {
  setReactiveScheduling('sync')
  resetActiveRuntime()
  document.body.innerHTML = ''
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

describe('TimePicker', () => {
  it('opens only once for a single click that also focuses the input', async () => {
    const container = mountTestContainer()
    resetActiveRuntime()
    const handleOpenChange = vi.fn()

    render(<TimePicker onOpenChange={handleOpenChange} data-testid="open-once-picker" />, container)

    await waitForContent(() => {
      const input = container.querySelector('[data-testid="open-once-picker"]') as HTMLInputElement
      expect(input).toBeTruthy()
    })

    const input = container.querySelector('[data-testid="open-once-picker"]') as HTMLInputElement
    await openPicker(input)

    await waitForContent(() => {
      expect(handleOpenChange).toHaveBeenCalledTimes(1)
      expect(handleOpenChange).toHaveBeenLastCalledWith(true)
    })
  })

  it('renders the default value and updates after clicking a panel option', async () => {
    const container = mountTestContainer()
    resetActiveRuntime()
    const handleChange = vi.fn()

    render(
      <TimePicker
        defaultValue="09:15:20"
        onChange={handleChange}
        data-testid="time-picker-input"
      />,
      container,
    )

    await waitForContent(() => {
      const input = container.querySelector('[data-testid="time-picker-input"]') as HTMLInputElement
      expect(input.value).toBe('09:15:20')
    })

    const input = container.querySelector('[data-testid="time-picker-input"]') as HTMLInputElement
    await openPicker(input)

    await waitForContent(() => {
      const popup = container.querySelector('[data-rue-time-picker-popup="true"]') as HTMLDivElement
      const minuteButton = container.querySelector(
        'button[data-rue-time-column="minute"][data-rue-time-option="30"]',
      ) as HTMLButtonElement | null
      expect(popup).toBeTruthy()
      expect(minuteButton).toBeTruthy()
    })

    const minuteButton = container.querySelector(
      'button[data-rue-time-column="minute"][data-rue-time-option="30"]',
    ) as HTMLButtonElement
    const mouseDownEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    minuteButton.dispatchEvent(mouseDownEvent)
    expect(mouseDownEvent.defaultPrevented).toBe(true)
    minuteButton.click()

    await waitForContent(() => {
      const popups = Array.from(
        container.querySelectorAll('[data-rue-time-picker-popup="true"]'),
      ) as HTMLDivElement[]
      expect(input.value).toBe('09:30:20')
      expect(popups.some(popup => !popup.hidden)).toBe(true)
      expect(handleChange).toHaveBeenCalledTimes(1)
      expect(handleChange.mock.calls[0]?.[0]).toBe('09:30:20')
    })
  })

  it('keeps the draft selection until confirm when needConfirm is enabled', async () => {
    const container = mountTestContainer()
    resetActiveRuntime()
    const handleChange = vi.fn()

    render(
      <TimePicker
        defaultValue="08:00:00"
        needConfirm
        onChange={handleChange}
        data-testid="confirm-picker"
      />,
      container,
    )

    await waitForContent(() => {
      const input = container.querySelector('[data-testid="confirm-picker"]') as HTMLInputElement
      expect(input).toBeTruthy()
    })

    const input = container.querySelector('[data-testid="confirm-picker"]') as HTMLInputElement
    await openPicker(input)

    await waitForContent(() => {
      const popup = container.querySelector('[data-rue-time-picker-popup="true"]') as HTMLDivElement
      const hourButton = container.querySelector(
        'button[data-rue-time-column="hour"][data-rue-time-option="10"]',
      ) as HTMLButtonElement | null
      expect(popup).toBeTruthy()
      expect(hourButton).toBeTruthy()
    })

    const hourButton = container.querySelector(
      'button[data-rue-time-column="hour"][data-rue-time-option="10"]',
    ) as HTMLButtonElement
    hourButton.click()

    await waitForContent(() => {
      expect(input.value).toBe('08:00:00')
      expect(handleChange).toHaveBeenCalledTimes(0)
    })

    const confirmButton = container.querySelector(
      'button[data-rue-time-confirm="true"]',
    ) as HTMLButtonElement
    confirmButton.click()

    await waitForContent(() => {
      expect(input.value).toBe('10:00:00')
      expect(handleChange).toHaveBeenCalledTimes(1)
      expect(handleChange.mock.calls[0]?.[2]).toMatchObject({ source: 'confirm' })
    })
  })

  it('syncs the popup draft when a controlled value changes during needConfirm mode', async () => {
    const container = mountTestContainer()
    resetActiveRuntime()

    const ControlledCase = () => {
      const currentValue = ref('08:00:00')

      return (
        <div>
          <TimePicker
            value={currentValue.value}
            needConfirm
            data-testid="controlled-confirm-picker"
          />
          <button
            type="button"
            data-testid="switch-controlled-value"
            onClick={() => {
              currentValue.value = '10:30:00'
            }}
          >
            切换
          </button>
        </div>
      )
    }

    render(<ControlledCase />, container)

    await waitForContent(() => {
      const input = container.querySelector(
        '[data-testid="controlled-confirm-picker"]',
      ) as HTMLInputElement
      expect(input.value).toBe('08:00:00')
    })

    const input = container.querySelector(
      '[data-testid="controlled-confirm-picker"]',
    ) as HTMLInputElement
    await openPicker(input)

    await waitForContent(() => {
      const hourButton = container.querySelector(
        'button[data-rue-time-column="hour"][data-rue-time-option="8"]',
      ) as HTMLButtonElement
      const minuteButton = container.querySelector(
        'button[data-rue-time-column="minute"][data-rue-time-option="0"]',
      ) as HTMLButtonElement
      expect(hourButton.getAttribute('aria-selected')).toBe('true')
      expect(hourButton.getAttribute('data-rue-time-selected')).toBe('true')
      expect(hourButton.className).toContain('bg-primary')
      expect(minuteButton.getAttribute('data-rue-time-selected')).toBe('true')
    })

    const switchButton = container.querySelector(
      '[data-testid="switch-controlled-value"]',
    ) as HTMLButtonElement
    switchButton.click()

    await waitForContent(() => {
      expect(input.value).toBe('10:30:00')
      const hourButton = container.querySelector(
        'button[data-rue-time-column="hour"][data-rue-time-option="10"]',
      ) as HTMLButtonElement
      const minuteButton = container.querySelector(
        'button[data-rue-time-column="minute"][data-rue-time-option="30"]',
      ) as HTMLButtonElement
      expect(hourButton.getAttribute('aria-selected')).toBe('true')
      expect(hourButton.getAttribute('data-rue-time-selected')).toBe('true')
      expect(hourButton.className).toContain('text-primary-content')
      expect(minuteButton.getAttribute('aria-selected')).toBe('true')
      expect(minuteButton.className).toContain('bg-primary')
    })
  })

  it('hides disabled options and clears the input', async () => {
    const container = mountTestContainer()
    resetActiveRuntime()

    render(
      <TimePicker
        defaultValue="09:20:00"
        allowClear
        hideDisabledOptions
        disabledTime={() => ({
          disabledHours: () => [0, 1, 2, 3, 4, 5, 6, 7, 8, 19, 20, 21, 22, 23],
          disabledMinutes: selectedHour => (selectedHour === 9 ? [0, 15, 30, 45] : []),
        })}
        data-testid="disabled-picker"
      />,
      container,
    )

    await waitForContent(() => {
      const input = container.querySelector('[data-testid="disabled-picker"]') as HTMLInputElement
      expect(input).toBeTruthy()
    })

    const input = container.querySelector('[data-testid="disabled-picker"]') as HTMLInputElement
    await openPicker(input)

    await waitForContent(() => {
      expect(
        container.querySelector('button[data-rue-time-column="hour"][data-rue-time-option="8"]'),
      ).toBeNull()
      expect(
        container.querySelector('button[data-rue-time-column="minute"][data-rue-time-option="15"]'),
      ).toBeNull()
    })

    const clearButton = container.querySelector(
      'button[aria-label="清空时间"]',
    ) as HTMLButtonElement
    clearButton.click()

    await waitForContent(() => {
      expect(input.value).toBe('')
    })
  })

  it(
    'allows manual input for controlled values and restores the last valid value on invalid submit',
    async () => {
      const container = mountTestContainer()
      resetActiveRuntime()
      const handleChange = vi.fn()

      const ControlledCase = () => {
        const currentValue = ref('09:30:15')

        return (
          <TimePicker
            value={currentValue.value}
            onChange={nextValue => {
              currentValue.value = nextValue ?? ''
              handleChange(nextValue)
            }}
            data-testid="controlled-manual-picker"
          />
        )
      }

      render(<ControlledCase />, container)

      await waitForContent(() => {
        const input = container.querySelector(
          '[data-testid="controlled-manual-picker"]',
        ) as HTMLInputElement
        expect(input.value).toBe('09:30:15')
      })

      const input = container.querySelector(
        '[data-testid="controlled-manual-picker"]',
      ) as HTMLInputElement
      await openPicker(input)

      input.value = '10:45:30'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))

      await waitForContent(() => {
        expect(input.value).toBe('10:45:30')
        expect(handleChange).toHaveBeenCalledTimes(1)
        expect(handleChange.mock.calls[0]?.[0]).toBe('10:45:30')
      })

      await openPicker(input)
      input.value = '25:61:61'
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))

      await waitForContent(() => {
        expect(input.value).toBe('10:45:30')
        expect(handleChange).toHaveBeenCalledTimes(1)
      })
    },
    slowTestTimeout,
  )

  it(
    'propagates panel selections to external reactive text in controlled mode',
    async () => {
      const container = mountTestContainer()
      resetActiveRuntime()

      const ControlledCase = () => {
        const currentValue = ref('09:30:15')
        const liveValue = ref('09:30:15')

        return (
          <div>
            <TimePicker
              value={currentValue.value}
              onChange={(nextValue, timeString) => {
                currentValue.value = nextValue ?? ''
                liveValue.value = timeString || '未选择'
              }}
              data-testid="controlled-live-picker"
            />
            <div data-testid="controlled-live-value">{liveValue.value}</div>
          </div>
        )
      }

      render(<ControlledCase />, container)

      await waitForContent(() => {
        const input = container.querySelector(
          '[data-testid="controlled-live-picker"]',
        ) as HTMLInputElement
        const live = container.querySelector(
          '[data-testid="controlled-live-value"]',
        ) as HTMLDivElement
        expect(input.value).toBe('09:30:15')
        expect(live.textContent).toBe('09:30:15')
      })

      const input = container.querySelector(
        '[data-testid="controlled-live-picker"]',
      ) as HTMLInputElement
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
      minuteButton.click()

      await waitForContent(() => {
        const popups = Array.from(
          container.querySelectorAll('[data-rue-time-picker-popup="true"]'),
        ) as HTMLDivElement[]
        const live = container.querySelector(
          '[data-testid="controlled-live-value"]',
        ) as HTMLDivElement
        expect(input.value).toBe('09:45:15')
        expect(live.textContent).toBe('09:45:15')
        expect(popups.some(popup => !popup.hidden)).toBe(true)
      })
    },
    slowTestTimeout,
  )

  it(
    'keeps the popup open while a controlled value is updated across hour minute second clicks',
    async () => {
      const container = mountTestContainer()
      resetActiveRuntime()

      const ControlledCase = () => {
        const currentValue = ref('09:30:15')
        const liveValue = ref('09:30:15')

        return (
          <div>
            <TimePicker
              value={currentValue.value}
              onChange={(nextValue, timeString) => {
                currentValue.value = nextValue ?? ''
                liveValue.value = timeString || '未选择'
              }}
              data-testid="controlled-sequence-picker"
            />
            <div data-testid="controlled-sequence-live-value">{liveValue.value}</div>
          </div>
        )
      }

      render(<ControlledCase />, container)

      const assertPopupOpen = () => {
        const popups = Array.from(
          container.querySelectorAll('[data-rue-time-picker-popup="true"]'),
        ) as HTMLDivElement[]
        expect(popups.some(popup => !popup.hidden)).toBe(true)
      }

      await waitForContent(() => {
        const input = container.querySelector(
          '[data-testid="controlled-sequence-picker"]',
        ) as HTMLInputElement
        expect(input.value).toBe('09:30:15')
      })

      const input = container.querySelector(
        '[data-testid="controlled-sequence-picker"]',
      ) as HTMLInputElement
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
        const updatedInput = container.querySelector(
          '[data-testid="controlled-sequence-picker"]',
        ) as HTMLInputElement
        const live = container.querySelector(
          '[data-testid="controlled-sequence-live-value"]',
        ) as HTMLDivElement
        expect(updatedInput.value).toBe('10:30:15')
        expect(live.textContent).toBe('10:30:15')
        assertPopupOpen()
      })

      await clickPanelOption(container, 'minute', '45')

      await waitForContent(() => {
        const updatedInput = container.querySelector(
          '[data-testid="controlled-sequence-picker"]',
        ) as HTMLInputElement
        const live = container.querySelector(
          '[data-testid="controlled-sequence-live-value"]',
        ) as HTMLDivElement
        expect(updatedInput.value).toBe('10:45:15')
        expect(live.textContent).toBe('10:45:15')
        assertPopupOpen()
      })

      await clickPanelOption(container, 'second', '30')

      await waitForContent(() => {
        const updatedInput = container.querySelector(
          '[data-testid="controlled-sequence-picker"]',
        ) as HTMLInputElement
        const live = container.querySelector(
          '[data-testid="controlled-sequence-live-value"]',
        ) as HTMLDivElement
        expect(updatedInput.value).toBe('10:45:30')
        expect(live.textContent).toBe('10:45:30')
        assertPopupOpen()
      })
    },
    slowTestTimeout,
  )

  it(
    'orders range values after a start time is changed past the end time',
    async () => {
      const container = mountTestContainer()
      resetActiveRuntime()
      const handleChange = vi.fn()

      render(
        <TimePicker.RangePicker defaultValue={['09:00:00', '18:00:00']} onChange={handleChange} />,
        container,
      )

      await waitForContent(() => {
        const inputs = container.querySelectorAll('input') as NodeListOf<HTMLInputElement>
        expect(inputs.length).toBe(2)
      })

      const inputs = container.querySelectorAll('input') as NodeListOf<HTMLInputElement>
      await openPicker(inputs[0])

      await waitForContent(() => {
        const popup = container.querySelector(
          '[data-rue-time-picker-popup="true"]',
        ) as HTMLDivElement
        const hourButton = container.querySelector(
          'button[data-rue-time-column="hour"][data-rue-time-option="20"]',
        ) as HTMLButtonElement | null
        expect(popup).toBeTruthy()
        expect(hourButton).toBeTruthy()
      })

      const hourButton = container.querySelector(
        'button[data-rue-time-column="hour"][data-rue-time-option="20"]',
      ) as HTMLButtonElement
      hourButton.click()

      await waitForContent(() => {
        expect(handleChange).toHaveBeenCalledTimes(1)
        expect(handleChange.mock.calls[0]?.[0]).toEqual(['18:00:00', '20:00:00'])
      })
    },
    slowTestTimeout,
  )
})
