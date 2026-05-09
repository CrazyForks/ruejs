import { afterEach, describe, expect, it } from 'vitest'
import { h, render, setReactiveScheduling } from '@rue-js/rue'
import Kbd from '../index'

setReactiveScheduling('sync')

const waitKbdRender = () => new Promise(resolve => setTimeout(resolve, 0))

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Kbd', () => {
  it('renders with base class and children', async () => {
    const c = document.createElement('div')
    render(h(Kbd, null, 'K'), c)
    await waitKbdRender()
    const el = c.querySelector('kbd.kbd') as HTMLElement
    expect(el).toBeTruthy()
    expect(el.classList.contains('kbd')).toBe(true)
    expect(el.textContent).toBe('K')
  })

  it('applies size classes', async () => {
    for (const s of ['xs', 'sm', 'md', 'lg', 'xl'] as const) {
      const c = document.createElement('div')
      render(h(Kbd, { size: s }, 'x'), c)
      await waitKbdRender()
      const el = c.querySelector('kbd.kbd') as HTMLElement
      expect(el.classList.contains(`kbd-${s}`)).toBe(true)
    }
  })

  it('supports semantic size aliases', async () => {
    const c = document.createElement('div')
    render(h(Kbd, { size: 'large' }, 'Enter'), c)
    await waitKbdRender()
    const el = c.querySelector('kbd.kbd') as HTMLElement
    expect(el.classList.contains('kbd-lg')).toBe(true)
  })

  it('appends custom className', async () => {
    const c = document.createElement('div')
    render(h(Kbd, { className: 'kbd-sm text-accent' }, 'A'), c)
    await waitKbdRender()
    const el = c.querySelector('kbd.kbd') as HTMLElement
    expect(el.classList.contains('kbd-sm')).toBe(true)
    expect(el.classList.contains('text-accent')).toBe(true)
  })

  it('renders combo items with separator', async () => {
    const c = document.createElement('div')
    render(
      h(Kbd, {
        items: ['ctrl', 'shift', 'p'],
        separator: '/',
        size: 'small',
      }),
      c,
    )

    await waitKbdRender()

    const keys = Array.from(c.querySelectorAll('kbd.kbd')) as HTMLElement[]
    const separators = Array.from(c.querySelectorAll('span')) as HTMLElement[]

    expect(keys).toHaveLength(3)
    expect(keys.every(key => key.classList.contains('kbd-sm'))).toBe(true)
    expect(separators.map(node => node.textContent?.trim())).toContain('/')
  })

  it('renders combo items when JSX passes an empty children array', async () => {
    const c = document.createElement('div')

    render(
      h(
        Kbd,
        {
          items: ['⌘', 'K'],
        },
        [],
      ),
      c,
    )

    await waitKbdRender()

    const keys = Array.from(c.querySelectorAll('kbd.kbd')) as HTMLElement[]

    expect(keys).toHaveLength(2)
    expect(keys.map(node => node.textContent)).toEqual(['⌘', 'K'])
  })

  it('supports combo and group compound helpers', async () => {
    const c = document.createElement('div')
    render(
      h(Kbd.Group, { wrap: true, gap: 'lg' }, [
        h(Kbd.Combo, { items: ['cmd', 'k'] }),
        h(Kbd.Separator, null, '|'),
        h(Kbd, null, '/'),
      ]),
      c,
    )

    await waitKbdRender()

    const group = c.querySelector('span.inline-flex') as HTMLElement
    const keys = Array.from(c.querySelectorAll('kbd.kbd'))

    expect(group.classList.contains('flex-wrap')).toBe(true)
    expect(group.classList.contains('gap-4')).toBe(true)
    expect(keys).toHaveLength(3)
    expect(c.textContent).toContain('|')
  })
})
