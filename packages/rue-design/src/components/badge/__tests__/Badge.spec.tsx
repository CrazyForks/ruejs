import { afterEach, describe, expect, it } from 'vitest'
import { h } from '@rue-js/rue'
import { render } from '@rue-js/rue'
import { Badge } from '@rue-js/design'

const waitBadgeRender = () => new Promise(resolve => setTimeout(resolve, 0))

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Badge', () => {
  it('renders legacy badge classes and children', async () => {
    const c = document.createElement('div')
    render(h(Badge, null, 'Badge'), c)
    await waitBadgeRender()
    const el = c.querySelector('.badge') as HTMLElement
    expect(el).toBeTruthy()
    expect(el.classList.contains('badge')).toBe(true)
    expect(el.textContent).toContain('Badge')
  })

  it('applies size classes', async () => {
    const c = document.createElement('div')
    for (const s of ['xs', 'sm', 'md', 'lg', 'xl'] as const) {
      render(h(Badge, { size: s }, 'x'), c)
      await waitBadgeRender()
      const el = c.querySelector('.badge') as HTMLElement
      expect(el.classList.contains(`badge-${s}`)).toBe(true)
    }
  })

  it('applies outline, dash, soft, ghost classes', async () => {
    const c = document.createElement('div')
    render(h(Badge, { outline: true, dash: true, soft: true, ghost: true }, 'x'), c)
    await waitBadgeRender()
    const el = c.querySelector('.badge') as HTMLElement
    expect(el.classList.contains('badge-outline')).toBe(true)
    expect(el.classList.contains('badge-dash')).toBe(true)
    expect(el.classList.contains('badge-soft')).toBe(true)
    expect(el.classList.contains('badge-ghost')).toBe(true)
  })

  it('appends custom className', async () => {
    const c = document.createElement('div')
    render(h(Badge, { className: 'w-full' }, 'x'), c)
    await waitBadgeRender()
    const el = c.querySelector('.badge') as HTMLElement
    expect(el.classList.contains('w-full')).toBe(true)
  })

  it('applies variant classes', async () => {
    const c = document.createElement('div')
    for (const v of ['neutral', 'primary', 'secondary', 'accent', 'info', 'success', 'warning', 'error'] as const) {
      render(h(Badge, { variant: v }, 'x'), c)
      await waitBadgeRender()
      const el = c.querySelector('.badge') as HTMLElement
      expect(el.classList.contains('badge')).toBe(true)
      expect(el.classList.contains(`badge-${v}`)).toBe(true)
    }
  })

  it('renders count with overflow and showZero support', async () => {
    const c = document.createElement('div')
    render(h(Badge, { count: 128, overflowCount: 99 }), c)
    await waitBadgeRender()
    const overflow = c.querySelector('.badge') as HTMLElement
    expect(overflow.textContent).toBe('99+')
    expect(overflow.classList.contains('badge-error')).toBe(true)

    c.innerHTML = ''
    render(h(Badge, { count: 0, showZero: true }), c)
    await waitBadgeRender()
    const zero = c.querySelector('.badge') as HTMLElement
    expect(zero.textContent).toBe('0')
  })

  it('renders wrapped indicator badge and offset styles', async () => {
    const c = document.createElement('div')
    render(
      h(Badge, { count: 8, offset: [10, 12] }, h('span', { className: 'anchor' }, 'Inbox')),
      c,
    )
    await waitBadgeRender()

    const wrapper = c.querySelector('.indicator') as HTMLElement
    const indicator = c.querySelector('.indicator-item.badge') as HTMLElement
    expect(wrapper).toBeTruthy()
    expect(indicator.textContent).toBe('8')
    expect(indicator.style.insetInlineEnd).toBe('-10px')
    expect(indicator.style.marginTop).toBe('12px')
  })

  it('renders standalone count text in right-top indicator mode', async () => {
    const c = document.createElement('div')
    render(h(Badge, { count: 7, text: '待审核', color: '#f97316' }), c)
    await waitBadgeRender()

    const wrapper = c.querySelector('.indicator') as HTMLElement
    const indicator = c.querySelector('.indicator-item.badge') as HTMLElement
    const content = wrapper.querySelector('.pe-6') as HTMLElement
    expect(wrapper).toBeTruthy()
    expect(indicator).toBeTruthy()
    expect(content).toBeTruthy()
    expect(indicator.textContent).toBe('7')
    expect(content.textContent).toBe('待审核')
    expect(c.textContent).toContain('待审核')
  })

  it('renders status dot with text and processing animation', async () => {
    const c = document.createElement('div')
    render(h(Badge, { status: 'processing', text: 'Live' }), c)
    await waitBadgeRender()
    const status = c.querySelector('.status') as HTMLElement
    expect(status).toBeTruthy()
    expect(status.classList.contains('status-info')).toBe(true)
    expect(status.classList.contains('animate-pulse')).toBe(true)
    expect(c.textContent).toContain('Live')
  })

  it('supports custom color and dot mode', async () => {
    const c = document.createElement('div')
    render(h(Badge, { dot: true, color: '#0ea5e9' }, h('span', null, 'Inbox')), c)
    await waitBadgeRender()
    const dot = c.querySelector('.indicator-item.status') as HTMLElement
    expect(dot).toBeTruthy()
    expect(dot.style.backgroundColor).toBe('rgb(14, 165, 233)')
  })

  it('hides zero count indicator without falling back to label mode', async () => {
    const c = document.createElement('div')
    render(h(Badge, { count: 0 }, h('span', { className: 'anchor' }, 'Inbox')), c)
    await waitBadgeRender()
    expect(c.querySelector('.indicator')).toBeTruthy()
    expect(c.querySelector('.indicator-item')).toBeFalsy()
    expect(c.querySelector('.anchor')?.textContent).toBe('Inbox')
    expect(c.querySelector('.badge .anchor')).toBeFalsy()
  })

  it('exposes Ribbon as compounded component', async () => {
    const c = document.createElement('div')
    render(
      h(
        Badge.Ribbon,
        { text: 'Beta', placement: 'start', color: 'secondary' },
        h('div', { className: 'panel' }, 'Content'),
      ),
      c,
    )
    await waitBadgeRender()

    const ribbon = c.querySelector('.badge-secondary') as HTMLElement
    expect(ribbon).toBeTruthy()
    expect(ribbon.textContent).toContain('Beta')
    expect(c.textContent).toContain('Content')
  })

  it('uses primary ribbon styling by default when color is omitted', async () => {
    const c = document.createElement('div')
    render(
      h(
        Badge.Ribbon,
        { text: 'Beta' },
        h('div', { className: 'panel' }, 'Content'),
      ),
      c,
    )
    await waitBadgeRender()

    const ribbon = c.querySelector('.badge-primary') as HTMLElement
    expect(ribbon).toBeTruthy()
    expect(ribbon.textContent).toContain('Beta')
  })
})
