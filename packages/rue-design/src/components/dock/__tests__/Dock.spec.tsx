import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from '@rue-js/rue'
import { render, setReactiveScheduling } from '@rue-js/rue'
import Dock from '../index'

setReactiveScheduling('sync')

const flushDock = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Dock', () => {
  it('renders with base class', async () => {
    const c = document.createElement('div')
    render(h(Dock, null, 'x'), c)
    await flushDock()
    const el = c.querySelector('.dock') as HTMLElement
    expect(el).toBeTruthy()
    expect(el.classList.contains('dock')).toBe(true)
  })

  it('applies size classes', async () => {
    for (const s of ['xs', 'sm', 'md', 'lg', 'xl'] as const) {
      const c = document.createElement('div')
      render(h(Dock, { size: s }, 'x'), c)
      await flushDock()
      const el = c.querySelector('.dock') as HTMLElement
      expect(el.classList.contains('dock')).toBe(true)
      expect(el.classList.contains(`dock-${s}`)).toBe(true)
    }
  })

  it('appends custom className', async () => {
    const c = document.createElement('div')
    render(h(Dock, { className: 'relative border' }, 'x'), c)
    await flushDock()
    const el = c.querySelector('.dock') as HTMLElement
    expect(el.classList.contains('relative')).toBe(true)
    expect(el.classList.contains('border')).toBe(true)
  })

  it('renders Item and Label subcomponents', async () => {
    const c = document.createElement('div')
    render(
      h(
        Dock,
        null,
        h(
          Dock.Item,
          { active: true },
          h('svg', { className: 'size-[1.2em]' }),
          h(Dock.Label, null, 'Home'),
        ),
      ),
      c,
    )
    await flushDock()
    const el = c.querySelector('.dock') as HTMLElement
    const btn = el.querySelector('button') as HTMLElement
    const label = el.querySelector('.dock-label') as HTMLElement
    expect(btn).toBeTruthy()
    expect(btn.classList.contains('dock-active')).toBe(true)
    expect(label).toBeTruthy()
    expect(label.textContent).toContain('Home')
  })

  it('supports activeIndex and onChange callback', async () => {
    const c = document.createElement('div')
    let changedIndex = -1
    const items = [
      { icon: h('svg', { className: 'size-[1.2em]' }), label: 'Home' },
      { icon: h('svg', { className: 'size-[1.2em]' }), label: 'Inbox' },
      { icon: h('svg', { className: 'size-[1.2em]' }), label: 'Settings' },
    ]
    render(h(Dock, { items, activeIndex: 1, onChange: (i: number) => (changedIndex = i) }), c)
    await flushDock()
    const el = c.querySelector('.dock') as HTMLElement
    const btns = el.querySelectorAll('button')
    expect(btns.length).toBe(3)
    expect(btns[1].classList.contains('dock-active')).toBe(true)
    ;(btns[2] as HTMLButtonElement).click()
    expect(changedIndex).toBe(2)
  })

  it('supports semantic nav root and activeKey selection', async () => {
    const c = document.createElement('div')
    let selectedKey: string | number | null = null
    const items = [
      { key: 'home', icon: h('span', null, 'H'), label: 'Home' },
      { key: 'inbox', icon: h('span', null, 'I'), label: 'Inbox' },
      { key: 'settings', icon: h('span', null, 'S'), label: 'Settings' },
    ]
    render(
      h(Dock, {
        as: 'nav',
        items,
        activeKey: 'inbox',
        onSelect: (key: string | number | null) => (selectedKey = key),
      }),
      c,
    )
    await flushDock()
    const nav = c.querySelector('nav.dock') as HTMLElement
    const buttons = nav.querySelectorAll('button')
    expect(nav).toBeTruthy()
    expect(buttons[1].classList.contains('dock-active')).toBe(true)
    ;(buttons[2] as HTMLButtonElement).click()
    expect(selectedKey).toBe('settings')
  })

  it('supports defaultActiveKey in uncontrolled items mode', async () => {
    const c = document.createElement('div')
    resetActiveRuntime()
    const items = [
      { key: 'home', icon: h('span', null, 'H'), label: 'Home' },
      { key: 'inbox', icon: h('span', null, 'I'), label: 'Inbox' },
    ]
    render(h(Dock, { items, defaultActiveKey: 'home' }), c)
    await flushDock()
    let buttons = c.querySelectorAll('button')
    expect(buttons[0].classList.contains('dock-active')).toBe(true)
    ;(buttons[1] as HTMLButtonElement).click()
    await flushDock()
    buttons = c.querySelectorAll('button')
    expect(buttons[0].classList.contains('dock-active')).toBe(false)
    expect(buttons[1].classList.contains('dock-active')).toBe(true)
  })

  it('supports defaultActiveIndex in uncontrolled items mode', async () => {
    const c = document.createElement('div')
    resetActiveRuntime()
    const items = [
      { icon: h('span', null, 'H'), label: 'Home' },
      { icon: h('span', null, 'I'), label: 'Inbox' },
      { icon: h('span', null, 'S'), label: 'Settings' },
    ]
    render(h(Dock, { items, defaultActiveIndex: 1 }), c)
    await flushDock()
    let buttons = c.querySelectorAll('button')
    expect(buttons[1].classList.contains('dock-active')).toBe(true)
    ;(buttons[2] as HTMLButtonElement).click()
    await flushDock()
    buttons = c.querySelectorAll('button')
    expect(buttons[1].classList.contains('dock-active')).toBe(false)
    expect(buttons[2].classList.contains('dock-active')).toBe(true)
  })

  it('renders anchors from item href and blocks disabled interaction', async () => {
    const c = document.createElement('div')
    const itemClick = vi.fn()
    resetActiveRuntime()
    render(
      h(Dock, {
        items: [
          { key: 'docs', href: '/docs', icon: h('span', null, 'D'), label: 'Docs' },
          {
            key: 'locked',
            href: '/locked',
            disabled: true,
            icon: h('span', null, 'L'),
            label: 'Locked',
            onClick: itemClick,
          },
        ],
      }),
      c,
    )
    await flushDock()
    const anchors = c.querySelectorAll('a')
    expect(anchors.length).toBe(2)
    expect(anchors[0].getAttribute('href')).toBe('/docs')
    expect(anchors[1].getAttribute('href')).not.toBe('/locked')
    ;(anchors[1] as HTMLAnchorElement).click()
    expect(itemClick).not.toHaveBeenCalled()
    expect(anchors[1].getAttribute('aria-disabled')).toBe('true')
  })

  it('maps size aliases to dock size classes', async () => {
    const c = document.createElement('div')
    render(h(Dock, { size: 'large' }, 'x'), c)
    await flushDock()
    const el = c.querySelector('.dock') as HTMLElement
    expect(el.classList.contains('dock-lg')).toBe(true)
  })

  it('auto renders items when items prop is provided', async () => {
    const c = document.createElement('div')
    const items = [
      { icon: h('span', null, 'I1'), label: 'L1' },
      { icon: h('span', null, 'I2'), label: 'L2' },
    ]
    render(h(Dock, { items, activeIndex: 0 }), c)
    await flushDock()
    const el = c.querySelector('.dock') as HTMLElement
    const labels = el.querySelectorAll('.dock-label')
    expect(labels.length).toBe(2)
    const btns = el.querySelectorAll('button')
    expect(btns[0].classList.contains('dock-active')).toBe(true)
  })
})
