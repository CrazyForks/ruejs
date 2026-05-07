import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from '@rue-js/rue'
import { render, setReactiveScheduling } from '@rue-js/rue'
import { mountContainer, waitForContent } from '../../../../../runtime/__tests__/page-test-utils'
import Card from '../index'

setReactiveScheduling('sync')

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Card', () => {
  it('renders with base class and legacy class props', async () => {
    const c = mountContainer()
    render(
      h(
        Card,
        {
          size: 'lg',
          border: true,
          bordered: true,
          dash: true,
          side: true,
          imageFull: true,
          className: 'bg-base-100',
        },
        'hello',
      ),
      c,
    )

    await waitForContent(() => {
      const el = c.querySelector('.card') as HTMLElement
      expect(el).toBeTruthy()
      expect(el.classList.contains('card')).toBe(true)
      expect(el.classList.contains('card-lg')).toBe(true)
      expect(el.classList.contains('card-border')).toBe(true)
      expect(el.classList.contains('card-dash')).toBe(true)
      expect(el.classList.contains('card-side')).toBe(true)
      expect(el.classList.contains('image-full')).toBe(true)
      expect(el.classList.contains('bg-base-100')).toBe(true)
      expect(el.textContent).toContain('hello')
    })
  })

  it('supports semantic header, cover, actions and body slots', async () => {
    const c = mountContainer()
    render(
      h(
        Card,
        {
          title: 'Analytics Overview',
          extra: h('button', { className: 'btn btn-ghost btn-sm' }, 'Refresh'),
          cover: h('img', { src: 'cover.png', alt: 'cover' }),
          actions: [h('span', null, 'Share'), h('span', null, 'Inspect')],
          className: 'bg-base-100',
        },
        h('p', { className: 'body-copy' }, 'Revenue increased by 24% this month.'),
      ),
      c,
    )

    await waitForContent(() => {
      const card = c.querySelector('.card') as HTMLElement
      expect(card.classList.contains('bg-base-100')).toBe(true)
      const header = c.querySelector('.rue-card-header') as HTMLElement
      expect(header).toBeTruthy()
      expect(header.textContent).toContain('Analytics Overview')
      expect(header.textContent).toContain('Refresh')

      const cover = c.querySelector('.rue-card-cover img') as HTMLImageElement
      expect(cover).toBeTruthy()
      expect(cover.getAttribute('alt')).toBe('cover')

      const body = c.querySelector('.card-body') as HTMLElement
      expect(body).toBeTruthy()
      expect(body.textContent).toContain('Revenue increased by 24% this month.')

      const actionItems = c.querySelectorAll('.rue-card-actions li')
      expect(actionItems.length).toBe(2)
      expect(actionItems[0].textContent).toContain('Share')
      expect(actionItems[1].textContent).toContain('Inspect')
    })
  })

  it('renders loading placeholders instead of body content', async () => {
    const c = mountContainer()
    render(h(Card, { title: 'Loading card', loading: true }, h('p', null, 'Hidden body')), c)

    await waitForContent(() => {
      const card = c.querySelector('.card') as HTMLElement
      expect(card.textContent).toContain('Loading card')
      expect(card.textContent).not.toContain('Hidden body')
      expect(c.querySelectorAll('.card-body .skeleton').length).toBeGreaterThan(1)
    })
  })

  it('supports uncontrolled tabs and emits tab change', async () => {
    const c = mountContainer()
    const onTabChange = vi.fn()

    render(
      h(Card, {
        title: 'Traffic',
        defaultActiveTabKey: 'metrics',
        onTabChange,
        tabList: [
          { key: 'overview', label: 'Overview' },
          { key: 'metrics', label: 'Metrics' },
        ],
      }),
      c,
    )

    await waitForContent(() => {
      const active = c.querySelector('.tab-active') as HTMLElement
      expect(active).toBeTruthy()
      expect(active.textContent).toBe('Metrics')
    })

    const overviewTab = Array.from(c.querySelectorAll('button.tab')).find(
      item => item.textContent === 'Overview',
    ) as HTMLButtonElement
    overviewTab.click()

    await waitForContent(() => {
      const active = c.querySelector('.tab-active') as HTMLElement
      expect(active.textContent).toBe('Overview')
      expect(onTabChange).toHaveBeenCalledWith('Overview'.toLowerCase())
    })
  })

  it('renders Meta and Grid compounded subcomponents', async () => {
    const c = mountContainer()
    render(
      h(
        Card,
        { title: 'Shortcuts', bodyClassName: '!p-0' },
        h(
          Card.Body,
          { className: 'border-base-300/80 border-b' },
          h(Card.Meta, {
            avatar: h('div', { className: 'avatar placeholder' }, h('div', { className: 'bg-primary text-primary-content rounded-full w-10' }, 'AI')),
            title: 'Workspace AI',
            description: 'Connect docs, demos and design decisions in one place.',
          }),
        ),
        h(
          'div',
          { className: 'grid gap-px bg-base-300/60 sm:grid-cols-2' },
          h(Card.Grid, null, h('div', { className: 'font-semibold' }, 'Design Tokens')),
          h(Card.Grid, { hoverable: false }, h('div', { className: 'font-semibold' }, 'Usage Reports')),
        ),
      ),
      c,
    )

    await waitForContent(() => {
      const meta = c.querySelector('.rue-card-meta') as HTMLElement
      expect(meta).toBeTruthy()
      expect(meta.textContent).toContain('Workspace AI')
      expect(meta.textContent).toContain('Connect docs')

      const grids = c.querySelectorAll('.rue-card-grid')
      expect(grids.length).toBe(2)
      expect(grids[0].textContent).toContain('Design Tokens')
      expect(grids[1].textContent).toContain('Usage Reports')
    })
  })

  it('renders Body, Title, Actions and Figure low-level subcomponents', async () => {
    const c = mountContainer()
    render(
      h(
        Card,
        null,
        h(Card.Figure, null, h('img', { src: 'x', alt: 'y' })),
        h(
          Card.Body,
          null,
          h(Card.Title, null, 'Hello'),
          h('p', null, 'content'),
          h(Card.Actions, null, h('button', { className: 'btn' }, 'Go')),
        ),
      ),
      c,
    )

    await waitForContent(() => {
      const body = c.querySelector('.card-body') as HTMLElement
      const title = c.querySelector('.card-title') as HTMLElement
      const actions = c.querySelector('.card-actions') as HTMLElement
      const figure = c.querySelector('figure') as HTMLElement
      expect(body).toBeTruthy()
      expect(title).toBeTruthy()
      expect(actions).toBeTruthy()
      expect(figure).toBeTruthy()
      expect(title.textContent).toBe('Hello')
    })
  })
})
