import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, setReactiveScheduling } from '@rue-js/rue'
import ColorPicker, { COLOR_PICKER_MODE_GRADIENT, COLOR_PICKER_MODE_SINGLE } from '../index'
import { mountContainer, waitForContent } from '../../../../../runtime/__tests__/page-test-utils'

setReactiveScheduling('sync')

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ColorPicker', () => {
  it('uses theme token surfaces and a compact square trigger by default', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(<ColorPicker defaultOpen={true} defaultValue="#1677ff" />, container)

    const trigger = container.querySelector(
      '[data-rue-color-picker-trigger="true"]',
    ) as HTMLDivElement
    const popup = document.body.querySelector(
      '[data-rue-color-picker-popup="true"]',
    ) as HTMLDivElement

    await waitForContent(() => {
      expect(trigger).toBeTruthy()
      expect(popup).toBeTruthy()
      expect(trigger.className).toContain('bg-base-100')
      expect(trigger.className).toContain('border-base-300')
      expect(trigger.className).toContain('h-8')
      expect(trigger.className).toContain('w-8')
      expect(popup.className).toContain('bg-base-100')
      expect(popup.className).toContain('border-base-300')
    })
  })

  it('renders custom showText content without stringifying JSX', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <ColorPicker
        defaultValue="#1677ff"
        showText={color => (
          <span data-rue-color-picker-show-text="true">
            {'toHexString' in color ? `Custom Text (${color.toHexString()})` : color.toCssString()}
          </span>
        )}
      />,
      container,
    )

    const trigger = container.querySelector(
      '[data-rue-color-picker-trigger="true"]',
    ) as HTMLDivElement

    await waitForContent(() => {
      const customText = trigger.querySelector(
        '[data-rue-color-picker-show-text="true"]',
      ) as HTMLSpanElement
      expect(customText).toBeTruthy()
      expect(trigger.textContent).toContain('Custom Text (#1677ff)')
      expect(trigger.textContent).not.toContain('[object Object]')
      expect(trigger.querySelector('svg')).toBeNull()
    })
  })

  it('mounts popup in a custom container and destroys it when destroyTooltipOnHide is enabled', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    const popupContainer = document.createElement('div')
    popupContainer.setAttribute('data-rue-color-picker-custom-container', 'true')
    document.body.appendChild(popupContainer)

    render(
      <ColorPicker
        defaultOpen={true}
        defaultValue="#1677ff"
        getPopupContainer={() => popupContainer}
        destroyTooltipOnHide
      />,
      container,
    )

    await waitForContent(() => {
      expect(popupContainer.querySelector('[data-rue-color-picker-popup-host="true"]')).toBeTruthy()
    })

    const trigger = container.querySelector(
      '[data-rue-color-picker-trigger="true"]',
    ) as HTMLDivElement
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    await waitForContent(() => {
      expect(popupContainer.querySelector('[data-rue-color-picker-popup-host="true"]')).toBeNull()
    })
  })

  it('respects preset defaultOpen when choosing the initial visible group', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <ColorPicker
        defaultOpen={true}
        presets={[
          {
            label: 'Warm',
            colors: ['#ff6b57'],
          },
          {
            label: 'Cool',
            defaultOpen: true,
            colors: ['#22c55e'],
          },
        ]}
      />,
      container,
    )

    const popup = document.body.querySelector(
      '[data-rue-color-picker-popup="true"]',
    ) as HTMLDivElement

    await waitForContent(() => {
      const sections = Array.from(popup.querySelectorAll('section')) as HTMLElement[]
      const coolButton = Array.from(popup.querySelectorAll('button')).find(
        node => node.textContent === 'Cool',
      ) as HTMLButtonElement
      expect(sections).toHaveLength(2)
      expect(sections[0].className.includes('hidden')).toBe(true)
      expect(sections[1].className.includes('hidden')).toBe(false)
      expect(coolButton.className).toContain('border-primary')
    })
  })

  it.skip('switches to gradient mode when selecting a gradient preset', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <ColorPicker
        mode={[COLOR_PICKER_MODE_SINGLE, COLOR_PICKER_MODE_GRADIENT]}
        presets={[
          {
            label: 'Gradient Presets',
            defaultOpen: true,
            colors: [
              [
                { color: '#1677ff', percent: 0 },
                { color: '#22c55e', percent: 100 },
              ],
            ],
          },
        ]}
      />,
      container,
    )

    const trigger = container.querySelector(
      '[data-rue-color-picker-trigger="true"]',
    ) as HTMLDivElement
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    await waitForContent(() => {
      const popup = document.body.querySelector(
        '[data-rue-color-picker-popup="true"]',
      ) as HTMLDivElement
      const gradientPreset = Array.from(popup.querySelectorAll('button[title]')).find(node =>
        (node as HTMLButtonElement).title.includes('linear-gradient'),
      ) as HTMLButtonElement | undefined
      expect(gradientPreset).toBeTruthy()
      expect(popup.textContent).not.toContain('色标 1/2')
    })

    const popup = document.body.querySelector(
      '[data-rue-color-picker-popup="true"]',
    ) as HTMLDivElement

    const gradientPreset = Array.from(popup.querySelectorAll('button[title]')).find(node =>
      (node as HTMLButtonElement).title.includes('linear-gradient'),
    ) as HTMLButtonElement
    gradientPreset.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    await waitForContent(() => {
      const activeGradientPreset = Array.from(popup.querySelectorAll('button[title]')).find(node =>
        (node as HTMLButtonElement).title.includes('linear-gradient'),
      ) as HTMLButtonElement
      expect(popup.textContent).toContain('色标 1/2')
      expect(activeGradientPreset.className).toContain('border-primary')
    })

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })

  it('commits manual popup text edits', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    const handleChange = vi.fn()

    render(
      <ColorPicker
        defaultOpen={true}
        defaultFormat="hex"
        defaultValue="#1677ff"
        onChange={handleChange}
      />,
      container,
    )

    const popup = document.body.querySelector(
      '[data-rue-color-picker-popup="true"]',
    ) as HTMLDivElement

    await waitForContent(() => {
      const input = popup.querySelector('input[type="text"]') as HTMLInputElement
      expect(input).toBeTruthy()
      expect(input.value).toBe('#1677ff')
    })

    const input = popup.querySelector('input[type="text"]') as HTMLInputElement
    input.value = '#22c55e'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    )

    await waitForContent(() => {
      expect(input.value).toBe('#22c55e')
      expect(handleChange).toHaveBeenCalled()
      expect(handleChange.mock.calls[handleChange.mock.calls.length - 1]?.[1]).toBe(
        'rgb(34, 197, 94)',
      )
    })
  })

  it('updates popup format fields after changing the format select', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    const handleFormatChange = vi.fn()

    render(
      <ColorPicker
        defaultOpen={true}
        defaultFormat="rgb"
        defaultValue="rgba(56, 189, 248, 0.72)"
        onFormatChange={handleFormatChange}
      />,
      container,
    )

    await waitForContent(() => {
      const popup = document.body.querySelector(
        '[data-rue-color-picker-popup="true"]',
      ) as HTMLDivElement
      const select = popup.querySelector('select') as HTMLSelectElement
      const labels = Array.from(popup.querySelectorAll('label > span')).map(
        node => node.textContent,
      )
      expect(select).toBeTruthy()
      expect(labels).toContain('R')
      expect(labels).toContain('G')
      expect(labels).toContain('B')
    })

    const popup = document.body.querySelector(
      '[data-rue-color-picker-popup="true"]',
    ) as HTMLDivElement
    const select = popup.querySelector('select') as HTMLSelectElement
    select.value = 'hsb'
    select.dispatchEvent(new Event('input', { bubbles: true }))
    select.dispatchEvent(new Event('change', { bubbles: true }))

    await waitForContent(() => {
      const labels = Array.from(popup.querySelectorAll('label > span')).map(
        node => node.textContent,
      )
      expect(labels).toContain('H')
      expect(labels).toContain('S')
      expect(labels).toContain('B')
      expect(handleFormatChange).toHaveBeenCalled()
    })
  })

  it('updates popup preview and presets after hue and preset interactions', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    const handleChange = vi.fn()

    render(
      <ColorPicker
        defaultOpen={true}
        defaultFormat="rgb"
        defaultValue="#1677ff"
        presets={[
          {
            label: 'Brand',
            colors: ['#ff6b57', '#22c55e'],
          },
        ]}
        onChange={handleChange}
      />,
      container,
    )

    await waitForContent(() => {
      const popup = document.body.querySelector(
        '[data-rue-color-picker-popup="true"]',
      ) as HTMLDivElement
      expect(popup.querySelectorAll('input[type="range"]').length).toBeGreaterThan(0)
      expect(popup.querySelectorAll('button[title]').length).toBe(2)
    })

    const popup = document.body.querySelector(
      '[data-rue-color-picker-popup="true"]',
    ) as HTMLDivElement
    const ranges = popup.querySelectorAll('input[type="range"]')
    const hue = ranges[0] as HTMLInputElement
    hue.value = '120'
    hue.dispatchEvent(new Event('input', { bubbles: true }))

    await waitForContent(() => {
      const saturation = Array.from(popup.querySelectorAll('div')).find(node =>
        node.getAttribute('style')?.includes('background-color:'),
      ) as HTMLDivElement | undefined
      expect(saturation?.getAttribute('style')).toContain('background-color: rgb(0, 255, 0)')
      expect(handleChange).toHaveBeenCalled()
    })

    const presetButtons = Array.from(popup.querySelectorAll('button[title]')) as HTMLButtonElement[]
    presetButtons[1].dispatchEvent(new MouseEvent('click', { bubbles: true }))

    await waitForContent(() => {
      const textInputs = Array.from(popup.querySelectorAll('input[type="text"]')).map(
        node => (node as HTMLInputElement).value,
      )
      expect(textInputs.slice(0, 3)).toEqual(['34', '197', '94'])
      expect(handleChange).toHaveBeenCalledTimes(2)
    })
  })

  it('switches visible preset groups and applies colors from the active group', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <ColorPicker
        defaultOpen={true}
        presets={[
          {
            label: 'Warm',
            colors: ['#ff6b57', '#f97316'],
          },
          {
            label: 'Cool',
            colors: ['#0ea5e9', '#22c55e'],
          },
        ]}
      />,
      container,
    )

    const popup = document.body.querySelector(
      '[data-rue-color-picker-popup="true"]',
    ) as HTMLDivElement

    await waitForContent(() => {
      const sections = Array.from(popup.querySelectorAll('section')) as HTMLElement[]
      expect(sections).toHaveLength(2)
      expect(sections[0].className.includes('hidden')).toBe(false)
      expect(sections[1].className.includes('hidden')).toBe(true)
    })

    const groupButtons = Array.from(popup.querySelectorAll('button')).filter(
      node => node.textContent === 'Cool',
    ) as HTMLButtonElement[]
    groupButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))

    await waitForContent(() => {
      const sections = Array.from(popup.querySelectorAll('section')) as HTMLElement[]
      expect(sections[0].className.includes('hidden')).toBe(true)
      expect(sections[1].className.includes('hidden')).toBe(false)
    })

    const activeSection = Array.from(popup.querySelectorAll('section')).find(
      section => !section.className.includes('hidden'),
    ) as HTMLElement
    const coolPresetButton = activeSection.querySelector(
      'button[title="#22c55e"]',
    ) as HTMLButtonElement
    coolPresetButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    await waitForContent(() => {
      const textInputs = Array.from(popup.querySelectorAll('input[type="text"]')).map(
        node => (node as HTMLInputElement).value,
      )
      expect(textInputs[0]).toBe('#22c55e')
    })
  })

  it('clears the current color from the popup when allowClear is enabled', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    const handleChange = vi.fn()
    const handleClear = vi.fn()

    render(
      <ColorPicker
        defaultOpen={true}
        defaultValue="#1677ff"
        allowClear
        showText
        onChange={handleChange}
        onClear={handleClear}
      />,
      container,
    )

    const popup = document.body.querySelector(
      '[data-rue-color-picker-popup="true"]',
    ) as HTMLDivElement

    await waitForContent(() => {
      const clearButton = popup.querySelector(
        '[data-rue-color-picker-popup-clear="true"]',
      ) as HTMLButtonElement
      expect(clearButton).toBeTruthy()
    })

    const clearButton = popup.querySelector(
      '[data-rue-color-picker-popup-clear="true"]',
    ) as HTMLButtonElement
    clearButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    await waitForContent(() => {
      const popupHost = document.body.querySelector(
        '[data-rue-color-picker-popup-host="true"]',
      ) as HTMLDivElement
      expect(popupHost.getAttribute('aria-hidden')).toBe('true')
      expect(handleClear).toHaveBeenCalledTimes(1)
      expect(handleChange.mock.calls[handleChange.mock.calls.length - 1]?.[0]).toBeNull()
      expect(handleChange.mock.calls[handleChange.mock.calls.length - 1]?.[1]).toBe('')
    })
  })
})
