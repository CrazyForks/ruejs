import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from '@rue-js/rue'
import { render } from '@rue-js/rue'
import { Button } from '@rue-js/design'

const waitButtonRender = () => new Promise(resolve => setTimeout(resolve, 0))

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Button', () => {
  it('renders with base class and children', async () => {
    const c = document.createElement('div')
    render(h(Button, null, 'click'), c)
    await waitButtonRender()
    const el = c.querySelector('button') as HTMLButtonElement
    expect(el).toBeTruthy()
    expect(el.classList.contains('btn')).toBe(true)
    expect(el.textContent).toContain('click')
  })

  it('applies color classes', async () => {
    const c = document.createElement('div')
    for (const color of ['primary', 'secondary', 'accent', 'neutral', 'info', 'success', 'warning', 'error'] as const) {
      render(h(Button, { color }, 'x'), c)
      await waitButtonRender()
      const el = c.querySelector('button') as HTMLButtonElement
      expect(el.classList.contains('btn')).toBe(true)
      expect(el.classList.contains(`btn-${color}`)).toBe(true)
    }
  })

  it('applies size classes', async () => {
    const c = document.createElement('div')
    for (const s of ['xs', 'sm', 'md', 'lg', 'xl'] as const) {
      render(h(Button, { size: s }, 'x'), c)
      await waitButtonRender()
      const el = c.querySelector('button') as HTMLButtonElement
      expect(el.classList.contains(`btn-${s}`)).toBe(true)
    }
  })

  it('applies type, layout and shape classes', async () => {
    const c = document.createElement('div')
    render(
      h(
        Button,
        {
          color: 'secondary',
          type: 'filled',
          active: true,
          block: true,
          wide: true,
          shape: 'circle',
        },
        'x',
      ),
      c,
    )
    await waitButtonRender()
    const el = c.querySelector('button') as HTMLButtonElement
    expect(el.classList.contains('btn-secondary')).toBe(true)
    expect(el.classList.contains('btn-soft')).toBe(true)
    expect(el.classList.contains('btn-active')).toBe(true)
    expect(el.classList.contains('btn-block')).toBe(true)
    expect(el.classList.contains('btn-wide')).toBe(true)
    expect(el.classList.contains('btn-circle')).toBe(true)
  })

  it('applies custom className', async () => {
    const c = document.createElement('div')
    render(h(Button, { className: 'w-full' }, 'x'), c)
    await waitButtonRender()
    const el = c.querySelector('button') as HTMLButtonElement
    expect(el.classList.contains('w-full')).toBe(true)
  })

  it('sets disabled and native type attributes', async () => {
    const c = document.createElement('div')
    render(h(Button, { disabled: true, htmlType: 'submit' }, 'x'), c)
    await waitButtonRender()
    const el = c.querySelector('button') as HTMLButtonElement
    expect(el.disabled).toBe(true)
    expect(el.getAttribute('type')).toBe('submit')
  })

  it('triggers onClick handler', async () => {
    const c = document.createElement('div')
    const spy = vi.fn()
    render(h(Button, { onClick: spy }, 'x'), c)
    await waitButtonRender()
    const el = c.querySelector('button') as HTMLButtonElement
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('disables click when loading is true', async () => {
    const c = document.createElement('div')
    const spy = vi.fn()
    render(h(Button, { loading: true, onClick: spy }, 'loading'), c)
    await waitButtonRender()
    const el = c.querySelector('button') as HTMLButtonElement
    expect(el.disabled).toBe(true)
    el.click()
    expect(spy).toHaveBeenCalledTimes(0)
  })

  it('applies visual type, color and htmlType mapping', async () => {
    const c = document.createElement('div')
    render(h(Button, { type: 'outlined', color: 'secondary', htmlType: 'reset' }, 'save'), c)
    await waitButtonRender()
    const el = c.querySelector('button') as HTMLButtonElement
    expect(el.classList.contains('btn-secondary')).toBe(true)
    expect(el.classList.contains('btn-outline')).toBe(true)
    expect(el.getAttribute('type')).toBe('reset')
  })

  it('renders anchor buttons from href and blocks click when disabled', async () => {
    const c = document.createElement('div')
    const spy = vi.fn()
    render(h(Button, { href: '/docs', color: 'primary', disabled: true, onClick: spy }, 'Docs'), c)
    await waitButtonRender()
    const el = c.querySelector('a') as HTMLAnchorElement
    expect(el).toBeTruthy()
    expect(el.classList.contains('btn')).toBe(true)
    expect(el.classList.contains('btn-primary')).toBe(true)
    expect(el.classList.contains('btn-disabled')).toBe(true)
    expect(el.getAttribute('href')).toBe('')
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(spy).toHaveBeenCalledTimes(0)
  })

  it('supports icon placement and loading object icon', async () => {
    const c = document.createElement('div')
    render(
      h(
        Button,
        {
          icon: h('span', { id: 'tail-icon' }, 'I'),
          iconPlacement: 'end',
        },
        'Next',
      ),
      c,
    )
    await waitButtonRender()
    let el = c.querySelector('button') as HTMLButtonElement
    expect(el.textContent).toBe('NextI')
    expect(el.querySelector('#tail-icon')).toBeTruthy()
    expect(el.classList.contains('gap-2')).toBe(true)

    render(
      h(Button, {
        shape: 'circle',
        icon: h('span', { id: 'icon-only' }, 'H'),
        'aria-label': '收藏',
      }),
      c,
    )
    await waitButtonRender()
    el = c.querySelector('button') as HTMLButtonElement
    expect(el.classList.contains('gap-2')).toBe(false)
    expect(el.children).toHaveLength(1)
    expect(el.querySelector('#icon-only')).toBeTruthy()

    render(
      h(
        Button,
        {
          loading: { icon: h('span', { id: 'loading-icon' }, 'L') },
        },
        'Load',
      ),
      c,
    )
    await waitButtonRender()
    el = c.querySelector('button') as HTMLButtonElement
    expect(el.disabled).toBe(true)
    expect(el.querySelector('#loading-icon')).toBeTruthy()
  })
})
