import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from '@rue-js/rue'
import { render } from '@rue-js/rue'
import { Avatar, Button, Stat } from '@rue-js/design'

const waitStatRender = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const renderAndWait = async (node: any, container: HTMLElement) => {
  render(node, container)
  await waitStatRender()
}

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('Stat', () => {
  it('renders stats container with base class', async () => {
    const c = document.createElement('div')
    await renderAndWait(h(Stat, null, 'hello'), c)
    const el = c.querySelector('.stats') as HTMLElement
    expect(el).toBeTruthy()
    expect(el.classList.contains('stats')).toBe(true)
    expect(el.textContent).toContain('hello')
  })

  it('applies direction classes', async () => {
    const c = document.createElement('div')
    await renderAndWait(h(Stat, { direction: 'horizontal' }, 'x'), c)
    let el = c.querySelector('.stats') as HTMLElement
    expect(el.classList.contains('stats-horizontal')).toBe(true)
    await renderAndWait(h(Stat, { direction: 'vertical' }, 'x'), c)
    el = c.querySelector('.stats') as HTMLElement
    expect(el.classList.contains('stats-vertical')).toBe(true)
  })

  it('appends custom className on container', async () => {
    const c = document.createElement('div')
    await renderAndWait(h(Stat, { className: 'shadow' }, 'x'), c)
    const el = c.querySelector('.stats') as HTMLElement
    expect(el.classList.contains('shadow')).toBe(true)
  })

  it('renders Item and subparts correctly', async () => {
    const c = document.createElement('div')
    await renderAndWait(
      h(
        Stat,
        { className: 'shadow' },
        h(
          Stat.Item,
          null,
          h(Stat.Figure, { className: 'text-secondary' }, h('svg', { className: 'w-8 h-8' })),
          h(Stat.Title, null, 'Downloads'),
          h(Stat.Value, null, '31K'),
          h(Stat.Desc, null, 'Jan 1st - Feb 1st'),
        ),
      ),
      c,
    )
    const item = c.querySelector('.stat') as HTMLElement
    expect(item).toBeTruthy()
    expect(c.querySelector('.stat-figure')).toBeTruthy()
    expect(c.querySelector('.stat-title')).toBeTruthy()
    expect(c.querySelector('.stat-value')).toBeTruthy()
    expect(c.querySelector('.stat-desc')).toBeTruthy()
  })

  it('renders Item semantic props without manual children composition', async () => {
    const c = document.createElement('div')
    await renderAndWait(
      h(Stat, null, h(Stat.Item, { title: 'Active Users', value: 112893, prefix: '¥', suffix: '/月' })),
      c,
    )
    const value = c.querySelector('.stat-value') as HTMLElement
    expect(c.querySelector('.stat-title')?.textContent).toBe('Active Users')
    expect(value.textContent).toContain('¥')
    expect(value.textContent).toContain('112,893')
    expect(value.textContent).toContain('/月')
  })

  it('applies center class on Item', async () => {
    const c = document.createElement('div')
    await renderAndWait(h(Stat, null, h(Stat.Item, { center: true }, 'x')), c)
    const el = c.querySelector('.stat') as HTMLElement
    expect(el.classList.contains('place-items-center')).toBe(true)
  })

  it('renders actions and supports nested dynamic components', async () => {
    const c = document.createElement('div')
    await renderAndWait(
      h(
        Stat,
        null,
        h(
          Stat.Item,
          null,
          h(Stat.Title, null, 'Account balance'),
          h(Stat.Value, null, '$89,400'),
            h(Stat.Actions, null, h(Button, { color: 'success', size: 'xs' }, 'Add funds')),
        ),
        h(
          Stat.Item,
          null,
          h(Stat.Title, null, 'User'),
          h(
            Stat.Figure,
            null,
            h(Avatar, { status: 'online' }, h('div', { className: 'w-16 rounded-full' })),
          ),
        ),
      ),
      c,
    )
    const actions = c.querySelector('.stat-actions') as HTMLElement
    expect(actions).toBeTruthy()
    expect(actions.querySelector('.btn')).toBeTruthy()
    expect(c.querySelector('.avatar')).toBeTruthy()
  })

  it('renders from items array with all parts', async () => {
    const c = document.createElement('div')
    const items = [
      {
        title: 'Downloads',
        value: '31K',
        desc: 'Jan 1st - Feb 1st',
        figure: h('svg', { className: 'w-8 h-8' }),
        figureClassName: 'text-secondary',
      },
      {
        center: true,
        title: 'Users',
        value: '4,200',
        desc: '↗︎ 400 (22%)',
        className: 'custom-item',
      },
      {
        title: 'Account balance',
        value: '$89,400',
        actions: h(Button, { size: 'xs', color: 'success' }, 'Add funds'),
      },
    ]
    await renderAndWait(h(Stat, { items, className: 'shadow' }), c)
    const container = c.querySelector('.stats') as HTMLElement
    expect(container).toBeTruthy()
    expect(container.classList.contains('shadow')).toBe(true)
    const statItems = c.querySelectorAll('.stat')
    expect(statItems.length).toBe(3)
    expect(statItems[1].classList.contains('place-items-center')).toBe(true)
    expect(statItems[1].classList.contains('custom-item')).toBe(true)
    expect(c.querySelectorAll('.stat-figure').length).toBe(1)
    expect(c.querySelectorAll('.stat-title').length).toBe(3)
    expect(c.querySelectorAll('.stat-value').length).toBe(3)
    expect(c.querySelectorAll('.stat-desc').length).toBe(2)
    expect(c.querySelectorAll('.stat-actions').length).toBe(1)
  })

  it('supports numeric formatting options and keeps zero values', async () => {
    const c = document.createElement('div')
    await renderAndWait(
      h(Stat, {
        items: [
          {
            title: 'Revenue',
            value: 12345.6,
            precision: 2,
            prefix: '$',
            suffix: 'USD',
          },
          {
            title: 'Pending Tasks',
            value: 0,
            suffix: 'items',
          },
        ],
      }),
      c,
    )
    const values = Array.from(c.querySelectorAll('.stat-value')).map(node => node.textContent ?? '')
    expect(values[0]).toContain('$')
    expect(values[0]).toContain('12,345.60')
    expect(values[0]).toContain('USD')
    expect(values[1]).toContain('0')
    expect(values[1]).toContain('items')
  })

  it('supports custom formatter and valueRender on Stat.Value', async () => {
    const c = document.createElement('div')
    await renderAndWait(
      h(
        Stat,
        null,
        h(
          Stat.Item,
          null,
          h(Stat.Value, {
            value: 1280,
            formatter: value => `${value} req/s`,
            valueRender: node => h('strong', { className: 'value-strong' }, node),
          }),
        ),
      ),
      c,
    )
    const strong = c.querySelector('.value-strong') as HTMLElement
    expect(strong).toBeTruthy()
    expect(strong.textContent).toBe('1280 req/s')
  })

  it('shows loading placeholder in value area', async () => {
    const c = document.createElement('div')
    await renderAndWait(h(Stat, null, h(Stat.Item, { title: 'Loading', loading: true })), c)
    const loadingNode = c.querySelector('[data-stat-loading="true"]') as HTMLElement
    expect(loadingNode).toBeTruthy()
    expect(c.querySelector('.stat-value')).toBeTruthy()
  })

  it('renders countdown timer and fires onFinish once', async () => {
    const onChange = vi.fn()
    const onFinish = vi.fn()
    const c = document.createElement('div')
    render(
      h(
        Stat,
        null,
        h(Stat.Timer, {
          title: 'Launch',
          value: Date.now() + 40,
          format: 's.SSS',
          interval: 10,
          onChange,
          onFinish,
        }),
      ),
      c,
    )
    await waitStatRender()

    let timer = c.querySelector('[data-stat-timer="countdown"]') as HTMLElement
    expect(timer).toBeTruthy()
    await new Promise(resolve => setTimeout(resolve, 90))
    await waitStatRender()

    timer = c.querySelector('[data-stat-timer="countdown"]') as HTMLElement
    expect(timer.textContent).toContain('0.')
    expect(onChange).toHaveBeenCalled()
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('supports countdown alias and literal timer format segments', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-01T00:00:00.000Z'))

    const c = document.createElement('div')
    render(
      h(
        Stat,
        null,
        h(Stat.Countdown, {
          title: 'Campaign',
          value: Date.now() + (2 * 24 * 60 * 60 + 3 * 60 * 60 + 4 * 60 + 5) * 1000,
          format: 'D [days] H [hours] m [minutes] s [seconds]',
        }),
      ),
      c,
    )
    await waitStatRender()

    const timer = c.querySelector('[data-stat-timer="countdown"]') as HTMLElement
    expect(timer.textContent).toBe('2 days 3 hours 4 minutes 5 seconds')
  })
})
