import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from '@rue-js/rue'
import { render } from '@rue-js/rue'
import Collapse from '..'

const waitCollapseRender = () => new Promise(resolve => setTimeout(resolve, 0))

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Collapse', () => {
  it('renders with base class and children', async () => {
    const c = document.createElement('div')
    render(h(Collapse, { tabIndex: 0 }, 'hello'), c)
    await waitCollapseRender()
    const el = c.querySelector('.collapse') as HTMLElement
    expect(el).toBeTruthy()
    expect(el.classList.contains('collapse')).toBe(true)
    expect(el.getAttribute('tabindex')).toBe('0')
    expect(el.textContent).toContain('hello')
  })

  it('applies modifier classes', async () => {
    const c = document.createElement('div')
    render(h(Collapse, { arrow: true, plus: true, open: true, close: true }, 'x'), c)
    await waitCollapseRender()
    const el = c.querySelector('.collapse') as HTMLElement
    expect(el.classList.contains('collapse-arrow')).toBe(true)
    expect(el.classList.contains('collapse-plus')).toBe(true)
    expect(el.classList.contains('collapse-open')).toBe(true)
    expect(el.classList.contains('collapse-close')).toBe(true)
  })

  it('appends custom className', async () => {
    const c = document.createElement('div')
    render(h(Collapse, { className: 'bg-base-100 border' }, 'x'), c)
    await waitCollapseRender()
    const el = c.querySelector('.collapse') as HTMLElement
    expect(el.classList.contains('bg-base-100')).toBe(true)
    expect(el.classList.contains('border')).toBe(true)
  })

  it('renders details tag with summary title', async () => {
    const c = document.createElement('div')
    render(
      h(Collapse, { tag: 'details', className: 'bg-base-100 border border-base-300' }, [
        h(Collapse.Title, { as: 'summary', className: 'font-semibold' }, 'Title'),
        h(Collapse.Content, { className: 'text-sm' }, 'Content'),
      ]),
      c,
    )
    await waitCollapseRender()
    const details = c.querySelector('details.collapse') as HTMLElement
    expect(details).toBeTruthy()
    const summary = details.querySelector('summary.collapse-title') as HTMLElement
    expect(summary).toBeTruthy()
    const content = details.querySelector('.collapse-content') as HTMLElement
    expect(content).toBeTruthy()
  })

  it('renders items with default active keys and metadata', async () => {
    const c = document.createElement('div')
    render(
      h(Collapse, {
        items: [
          {
            key: 'overview',
            label: 'Overview',
            description: '系统概览',
            extra: 'Beta',
            children: 'Overview content',
            open: true,
          },
          {
            key: 'api',
            label: 'API',
            children: 'API content',
          },
        ],
      }),
      c,
    )
    await waitCollapseRender()

    const items = c.querySelectorAll('.collapse')
    expect(items.length).toBe(2)
    expect(items[0].classList.contains('collapse-open')).toBe(true)
    expect(items[1].classList.contains('collapse-close')).toBe(true)
    expect(c.textContent).toContain('系统概览')
    expect(c.textContent).toContain('Beta')
  })

  it('toggles uncontrolled items opened by defaultActiveKey', async () => {
    const c = document.createElement('div')
    render(
      h(Collapse, {
        arrow: true,
        defaultActiveKey: ['overview'],
        items: [
          { key: 'overview', label: 'Overview', children: 'Overview content' },
          { key: 'release', label: 'Release', children: 'Release content' },
        ],
      }),
      c,
    )
    await waitCollapseRender()

    const items = c.querySelectorAll('.collapse')
    const headers = c.querySelectorAll('.collapse-title')

    expect(items[0].classList.contains('collapse-open')).toBe(true)

    headers[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await waitCollapseRender()
    expect(items[0].classList.contains('collapse-close')).toBe(true)

    headers[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await waitCollapseRender()
    expect(items[0].classList.contains('collapse-open')).toBe(true)
  })

  it('toggles metadata header without triggering from extra area', async () => {
    const c = document.createElement('div')
    render(
      h(Collapse, {
        arrow: true,
        defaultActiveKey: ['ops'],
        items: [
          {
            key: 'ops',
            label: 'Ops Console',
            description: '控制发布节奏、灰度范围与告警阈值。',
            extra: h('span', { className: 'badge badge-soft badge-info' }, 'Beta'),
            children: 'content',
          },
        ],
      }),
      c,
    )
    await waitCollapseRender()

    const item = c.querySelector('.collapse') as HTMLElement
    const header = c.querySelector('.collapse-title') as HTMLElement
    const extra = c.querySelector('.collapse-title .shrink-0') as HTMLElement
    const badge = extra.querySelector('.badge') as HTMLElement

    expect(item.classList.contains('collapse-open')).toBe(true)
    expect(badge).toBeTruthy()
    expect(badge.textContent).toBe('Beta')

    extra.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await waitCollapseRender()
    expect(item.classList.contains('collapse-open')).toBe(true)

    header.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await waitCollapseRender()
    expect(item.classList.contains('collapse-close')).toBe(true)
  })

  it('supports controlled activeKey and onChange in items mode', async () => {
    const c = document.createElement('div')
    const spy = vi.fn()
    render(
      h(Collapse, {
        activeKey: 'release',
        arrow: true,
        items: [
          { key: 'intro', label: 'Intro', children: 'Intro content' },
          { key: 'release', label: 'Release', children: 'Release content' },
        ],
        onChange: spy,
      }),
      c,
    )
    await waitCollapseRender()

    const items = c.querySelectorAll('.collapse')
    expect(items[1].classList.contains('collapse-open')).toBe(true)

    const headers = c.querySelectorAll('.collapse-title')
    headers[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await waitCollapseRender()

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0]).toEqual(['release', 'intro'])
    expect(spy.mock.calls[0][1]).toMatchObject({ key: 'intro', index: 0, open: true })
  })

  it('supports accordion mode', async () => {
    const c = document.createElement('div')
    render(
      h(Collapse, {
        accordion: true,
        defaultActiveKey: 'a',
        items: [
          { key: 'a', label: 'A', children: 'A content' },
          { key: 'b', label: 'B', children: 'B content' },
        ],
      }),
      c,
    )
    await waitCollapseRender()

    const headers = c.querySelectorAll('.collapse-title')
    headers[1].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await waitCollapseRender()

    const items = c.querySelectorAll('.collapse')
    expect(items[0].classList.contains('collapse-close')).toBe(true)
    expect(items[1].classList.contains('collapse-open')).toBe(true)
  })

  it('supports icon-only collapsible trigger and start placement', async () => {
    const c = document.createElement('div')
    render(
      h(Collapse, {
        arrow: true,
        expandIconPlacement: 'start',
        items: [
          {
            key: 'safe',
            label: 'Safe rollout',
            children: 'content',
            collapsible: 'icon',
          },
        ],
      }),
      c,
    )
    await waitCollapseRender()

    const header = c.querySelector('.collapse-title') as HTMLElement
    header.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await waitCollapseRender()
    let item = c.querySelector('.collapse') as HTMLElement
    expect(item.classList.contains('collapse-close')).toBe(true)

    const iconButton = c.querySelector('.collapse-title button') as HTMLButtonElement
    iconButton.click()
    await waitCollapseRender()
    item = c.querySelector('.collapse') as HTMLElement
    expect(item.classList.contains('collapse-open')).toBe(true)
  })

  it('supports title metadata in legacy composition mode', async () => {
    const c = document.createElement('div')
    render(
      h(Collapse, { bordered: true }, [
        h(Collapse.Title, { description: '灰度发布', extra: 'v2' }, '发布策略'),
        h(Collapse.Content, null, 'content'),
      ]),
      c,
    )

    await waitCollapseRender()

    expect(c.textContent).toContain('发布策略')
    expect(c.textContent).toContain('灰度发布')
    expect(c.textContent).toContain('v2')
  })

  it('toggles legacy focus mode by repeatedly clicking the title', async () => {
    const c = document.createElement('div')
    render(
      h(Collapse, { tabIndex: 0 }, [
        h(Collapse.Title, { className: 'font-semibold' }, 'Title'),
        h(Collapse.Content, { className: 'text-sm' }, 'Content'),
      ]),
      c,
    )
    await waitCollapseRender()

    const item = c.querySelector('.collapse') as HTMLElement
    const title = c.querySelector('.collapse-title') as HTMLElement

    expect(item.classList.contains('collapse-open')).toBe(false)

    title.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await waitCollapseRender()
    expect(item.classList.contains('collapse-open')).toBe(true)
    expect(item.classList.contains('collapse-close')).toBe(false)

    title.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await waitCollapseRender()
    expect(item.classList.contains('collapse-open')).toBe(false)
    expect(item.classList.contains('collapse-close')).toBe(true)
  })

  it('toggles legacy checkbox mode by clicking the title', async () => {
    const c = document.createElement('div')
    render(
      h(Collapse, null, [
        h('input', { type: 'checkbox', className: 'peer' }),
        h(Collapse.Title, { className: 'font-semibold' }, 'Title'),
        h(Collapse.Content, { className: 'text-sm' }, 'Content'),
      ]),
      c,
    )
    await waitCollapseRender()

    const item = c.querySelector('.collapse') as HTMLElement
    const title = c.querySelector('.collapse-title') as HTMLElement
    const input = c.querySelector('input[type="checkbox"]') as HTMLInputElement

    expect(input.checked).toBe(false)
    expect(item.classList.contains('collapse-open')).toBe(false)

    title.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await waitCollapseRender()
    expect(input.checked).toBe(true)
    expect(item.classList.contains('collapse-open')).toBe(true)
    expect(item.classList.contains('collapse-close')).toBe(false)

    title.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await waitCollapseRender()
    expect(input.checked).toBe(false)
    expect(item.classList.contains('collapse-open')).toBe(false)
    expect(item.classList.contains('collapse-close')).toBe(true)
  })
})
