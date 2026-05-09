import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, setReactiveScheduling } from '@rue-js/rue'
import Range from '..'
import { mountContainer, waitForContent } from '../../../../../runtime/__tests__/page-test-utils'

setReactiveScheduling('sync')

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Range', () => {
  it('renders range input and forwards min/max/value/step', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(<Range min={0} max={100} value={40} step={5} className="w-xs" />, container)

    await waitForContent(() => {
      const input = container.querySelector('input.range') as HTMLInputElement
      expect(input).toBeTruthy()
      expect(input.type).toBe('range')
      expect(input.getAttribute('min')).toBe('0')
      expect(input.getAttribute('max')).toBe('100')
      expect(input.getAttribute('step')).toBe('5')
      expect(input.value).toBe('40')
      expect(input.classList.contains('w-xs')).toBe(true)
    })
  })

  it('applies color and size modifiers', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(<Range color="secondary" size="large" />, container)

    await waitForContent(() => {
      const input = container.querySelector('input.range') as HTMLInputElement
      expect(input.classList.contains('range-secondary')).toBe(true)
      expect(input.classList.contains('range-lg')).toBe(true)
    })
  })

  it('forwards disabled state and input handlers', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    const handleInput = vi.fn()

    render(<Range disabled={true} data-testid="range" onInput={handleInput} />, container)

    await waitForContent(() => {
      const input = container.querySelector('[data-testid="range"]') as HTMLInputElement
      expect(input.disabled).toBe(true)
    })

    const input = container.querySelector('[data-testid="range"]') as HTMLInputElement
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(handleInput).toHaveBeenCalledTimes(1)
  })

  it('renders enhanced layout with label, helper, marks and value output', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <Range
        min={0}
        max={100}
        value={50}
        label="Storage"
        hint="Sync cache size"
        helper="Larger cache uses more memory"
        showValue={{ formatter: value => `${value} GB` }}
        marks={[0, { value: 50, label: 'Balanced' }, { value: 100, label: 'Max' }]}
      />,
      container,
    )

    await waitForContent(() => {
      const root = container.querySelector('[data-rue-range-root="true"]') as HTMLDivElement
      const output = container.querySelector('[data-rue-range-output="true"]') as HTMLOutputElement
      const marks = container.querySelectorAll('[data-rue-range-mark]')

      expect(root).toBeTruthy()
      expect(root.textContent).toContain('Storage')
      expect(root.textContent).toContain('Sync cache size')
      expect(root.textContent).toContain('Larger cache uses more memory')
      expect(output.textContent).toContain('50 GB')
      expect(marks).toHaveLength(3)
    })
  })

  it('supports uncontrolled updates and semantic value callbacks', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    const handleValueChange = vi.fn()
    const handleValueCommit = vi.fn()

    render(
      <Range
        min={0}
        max={100}
        defaultValue={20}
        showValue={true}
        onValueChange={handleValueChange}
        onValueCommit={handleValueCommit}
      />,
      container,
    )

    await waitForContent(() => {
      const output = container.querySelector('[data-rue-range-output="true"]') as HTMLOutputElement
      expect(output.textContent).toContain('20')
    })

    const input = container.querySelector('input.range') as HTMLInputElement
    input.value = '70'
    input.dispatchEvent(new Event('input', { bubbles: true }))

    await waitForContent(() => {
      const output = container.querySelector('[data-rue-range-output="true"]') as HTMLOutputElement
      expect(output.textContent).toContain('70')
    })

    input.dispatchEvent(new Event('change', { bubbles: true }))

    expect(handleValueChange).toHaveBeenCalledTimes(1)
    expect(handleValueChange.mock.calls[0][0]).toBe(70)
    expect(handleValueCommit).toHaveBeenCalledTimes(1)
    expect(handleValueCommit.mock.calls[0][0]).toBe(70)
  })
})
