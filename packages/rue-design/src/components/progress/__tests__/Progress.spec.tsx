import { afterEach, describe, expect, it } from 'vitest'
import { render, setReactiveScheduling } from '@rue-js/rue'
import Progress from '..'
import { mountContainer, waitForContent } from '../../../../../runtime/__tests__/page-test-utils'

setReactiveScheduling('sync')

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Progress', () => {
  it('renders the base progress element and forwards value/max', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(<Progress value={40} max={100} className="w-56" />, container)

    await waitForContent(() => {
      const element = container.querySelector('progress.progress') as HTMLProgressElement
      expect(element).toBeTruthy()
      expect(element.getAttribute('value')).toBe('40')
      expect(element.getAttribute('max')).toBe('100')
      expect(element.classList.contains('w-56')).toBe(true)
    })
  })

  it('applies color modifiers', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(<Progress color="success" />, container)

    await waitForContent(() => {
      const element = container.querySelector('progress.progress') as HTMLProgressElement
      expect(element.classList.contains('progress-success')).toBe(true)
    })
  })

  it('forwards native attributes without forcing value state', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(<Progress data-testid="progress" aria-label="loading" />, container)

    await waitForContent(() => {
      const element = container.querySelector('[data-testid="progress"]') as HTMLProgressElement
      expect(element.getAttribute('aria-label')).toBe('loading')
      expect(element.hasAttribute('value')).toBe(false)
      expect(element.hasAttribute('max')).toBe(false)
    })
  })

  it('renders enhanced line mode with custom info text', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <Progress
        data-testid="enhanced-line"
        percent={72}
        success={{ percent: 30 }}
        format={(percent, successPercent) => `${successPercent}/${percent}`}
      />,
      container,
    )

    await waitForContent(() => {
      const element = container.querySelector('[data-testid="enhanced-line"]') as HTMLElement
      expect(element.getAttribute('role')).toBe('progressbar')
      expect(element.getAttribute('data-progress-type')).toBe('line')
      expect(element.getAttribute('aria-valuenow')).toBe('72')
      expect(element.textContent).toContain('30/72')
    })
  })

  it('renders circle mode without falling back to native progress', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(<Progress data-testid="circle-progress" type="circle" percent={60} />, container)

    await waitForContent(() => {
      const element = container.querySelector('[data-testid="circle-progress"]') as HTMLElement
      expect(element.getAttribute('data-progress-type')).toBe('circle')
      expect(element.querySelector('svg')).toBeTruthy()
      expect(element.querySelector('progress')).toBeFalsy()
      expect(element.textContent).toContain('60%')
    })
  })
})
