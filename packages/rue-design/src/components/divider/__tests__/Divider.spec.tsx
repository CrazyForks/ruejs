import { afterEach, describe, expect, it } from 'vitest'
import { h, render, setReactiveScheduling } from '@rue-js/rue'
import { Divider } from '@rue-js/design'
import { mountContainer, waitForContent } from '../../../../../runtime/__tests__/page-test-utils'

setReactiveScheduling('sync')

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Divider', () => {
  it('renders with base class and children', async () => {
    const c = mountContainer()
    resetActiveRuntime()
    render(h(Divider, null, 'OR'), c)

    await waitForContent(() => {
      const el = c.querySelector('.divider') as HTMLElement
      expect(el).toBeTruthy()
      expect(el.textContent).toContain('OR')
    })
  })

  it('removes the center gap when rendered without content', async () => {
    const c = mountContainer()
    resetActiveRuntime()
    render(h(Divider, null), c)

    await waitForContent(() => {
      const el = c.querySelector('.divider') as HTMLElement
      expect(el.classList.contains('gap-0')).toBe(true)
      expect(el.querySelector('span')).toBeNull()
    })

    render(h(Divider, null, ''), c)

    await waitForContent(() => {
      const el = c.querySelector('.divider') as HTMLElement
      expect(el.classList.contains('gap-0')).toBe(true)
      expect(el.querySelector('span')).toBeNull()
    })
  })

  it('applies direction classes', async () => {
    const c = mountContainer()
    resetActiveRuntime()
    render(h(Divider, { direction: 'vertical' }, 'x'), c)

    await waitForContent(() => {
      const el = c.querySelector('.divider') as HTMLElement
      expect(el.classList.contains('divider-horizontal')).toBe(false)
    })

    render(h(Divider, { direction: 'horizontal' }, 'x'), c)

    await waitForContent(() => {
      const el = c.querySelector('.divider') as HTMLElement
      expect(el.classList.contains('divider-horizontal')).toBe(true)
    })
  })

  it('applies placement classes', async () => {
    const c = mountContainer()
    resetActiveRuntime()
    render(h(Divider, { placement: 'start' }, 'x'), c)

    await waitForContent(() => {
      const el = c.querySelector('.divider') as HTMLElement
      expect(el.classList.contains('divider-start')).toBe(true)
    })

    render(h(Divider, { placement: 'end' }, 'x'), c)

    await waitForContent(() => {
      const el = c.querySelector('.divider') as HTMLElement
      expect(el.classList.contains('divider-end')).toBe(true)
    })
  })

  it('applies variant classes', async () => {
    const c = mountContainer()
    resetActiveRuntime()
    ;(
      ['neutral', 'primary', 'secondary', 'accent', 'success', 'warning', 'info', 'error'] as const
    ).forEach(v => {
      render(h(Divider, { variant: v }, 'x'), c)
    })

    await waitForContent(() => {
      const el = c.querySelector('.divider') as HTMLElement
      expect(el.classList.contains('divider-error')).toBe(true)
    })
  })

  it('appends custom className', async () => {
    const c = mountContainer()
    resetActiveRuntime()
    render(h(Divider, { className: 'w-full' }, 'x'), c)

    await waitForContent(() => {
      const el = c.querySelector('.divider') as HTMLElement
      expect(el.classList.contains('w-full')).toBe(true)
    })
  })
})
