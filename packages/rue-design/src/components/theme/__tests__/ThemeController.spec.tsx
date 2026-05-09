import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, setReactiveScheduling } from '@rue-js/rue'
import ThemeController from '../index'
import { mountContainer, waitForContent } from '../../../../../runtime/__tests__/page-test-utils'

setReactiveScheduling('sync')

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ThemeController', () => {
  it('renders the base theme controller input and forwards checked/value', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <ThemeController className="toggle" value="synthwave" checked={true} data-testid="theme" />,
      container,
    )

    await waitForContent(() => {
      const input = container.querySelector('[data-testid="theme"]') as HTMLInputElement
      expect(input.type).toBe('checkbox')
      expect(input.value).toBe('synthwave')
      expect(input.checked).toBe(true)
      expect(input.classList.contains('theme-controller')).toBe(true)
      expect(input.classList.contains('toggle')).toBe(true)
    })
  })

  it('supports radio mode and forwards native attrs', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <ThemeController type="radio" name="theme-radios" className="radio radio-sm" value="retro" />,
      container,
    )

    await waitForContent(() => {
      const input = container.querySelector('input.theme-controller') as HTMLInputElement
      expect(input.type).toBe('radio')
      expect(input.name).toBe('theme-radios')
      expect(input.classList.contains('radio')).toBe(true)
      expect(input.classList.contains('radio-sm')).toBe(true)
    })
  })

  it('forwards change events', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    const handleChange = vi.fn()

    render(<ThemeController data-testid="controller" onChange={handleChange} />, container)

    await waitForContent(() => {
      expect(container.querySelector('[data-testid="controller"]')).toBeTruthy()
    })

    const input = container.querySelector('[data-testid="controller"]') as HTMLInputElement
    input.dispatchEvent(new Event('change', { bubbles: true }))
    expect(handleChange).toHaveBeenCalledTimes(1)
  })

  it('computes merged design tokens with preset, algorithm, and override', () => {
    const token = ThemeController.getDesignToken({
      theme: 'garden',
      algorithm: [ThemeController.darkAlgorithm, ThemeController.compactAlgorithm],
      token: {
        colors: {
          primary: '#112233',
        },
      },
    })

    expect(token.themeName).toBe('garden')
    expect(token.resolvedThemeName).toBe('garden')
    expect(token.appearance).toBe('dark')
    expect(token.density).toBe('compact')
    expect(token.colors.primary).toBe('#112233')
    expect(token.radius.box).toBe('1rem')
    expect(token.size.field).toBe('0.21875rem')
  })

  it('renders a scoped provider and exposes runtime token data to render props', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <ThemeController.Provider
        data-testid="theme-scope"
        theme="retro"
        render={runtime => (
          <div data-testid="theme-summary">
            {runtime.theme}|{runtime.token.colors.primary}|{runtime.token.appearance}
          </div>
        )}
        token={{
          colors: {
            primary: '#445566',
          },
        }}
      />,
      container,
    )

    await waitForContent(() => {
      const scope = container.querySelector('[data-testid="theme-scope"]') as HTMLElement
      const summary = container.querySelector('[data-testid="theme-summary"]')

      expect(scope.getAttribute('data-theme')).toBe('retro')
      expect(scope.getAttribute('data-rue-theme')).toBe('retro')
      expect(scope.style.getPropertyValue('--color-primary')).toBe('#445566')
      expect(scope.style.getPropertyValue('--radius-box')).toBe('1.4rem')
      expect(summary?.textContent).toContain('retro|#445566|light')
    })
  })
})
