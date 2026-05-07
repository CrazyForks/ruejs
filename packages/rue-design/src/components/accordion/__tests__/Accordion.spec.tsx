import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from '@rue-js/rue'
import { render } from '@rue-js/rue'
import { Accordion } from '@rue-js/design'

const waitAccordionRender = () => new Promise(resolve => setTimeout(resolve, 0))

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Accordion', () => {
  it('renders with base class and children', async () => {
    const c = document.createElement('div')
    render(
      h(
        Accordion,
        { name: 'acc' },
        h(Accordion.Title, null, 'Title'),
        h(Accordion.Content, null, 'Content'),
      ),
      c,
    )
    await waitAccordionRender()
    const el = c.querySelector('.collapse') as HTMLElement
    expect(el).toBeTruthy()
    expect(el.classList.contains('collapse')).toBe(true)
    expect(c.textContent).toContain('Title')
    expect(c.textContent).toContain('Content')
  })

  it('applies icon classes', async () => {
    const c = document.createElement('div')
    render(h(Accordion, { icon: 'arrow' }, h(Accordion.Title, null, 'x')), c)
    await waitAccordionRender()
    let el = c.querySelector('.collapse') as HTMLElement
    expect(el.classList.contains('collapse-arrow')).toBe(true)

    render(h(Accordion, { icon: 'plus' }, h(Accordion.Title, null, 'x')), c)
    await waitAccordionRender()
    el = c.querySelector('.collapse') as HTMLElement
    expect(el.classList.contains('collapse-plus')).toBe(true)
  })

  it('applies force classes', async () => {
    const c = document.createElement('div')
    render(h(Accordion, { force: 'open' }, h(Accordion.Title, null, 'x')), c)
    await waitAccordionRender()
    let el = c.querySelector('.collapse') as HTMLElement
    expect(el.classList.contains('collapse-open')).toBe(true)

    render(h(Accordion, { force: 'close' }, h(Accordion.Title, null, 'x')), c)
    await waitAccordionRender()
    el = c.querySelector('.collapse') as HTMLElement
    expect(el.classList.contains('collapse-close')).toBe(true)
  })

  it('renders radio input with name and checked when open', async () => {
    const c = document.createElement('div')
    render(h(Accordion, { name: 'group1', open: true }, h(Accordion.Title, null, 'x')), c)
    await waitAccordionRender()
    const input = c.querySelector('input[type="radio"]') as HTMLInputElement
    expect(input).toBeTruthy()
    expect(input.name).toBe('group1')
    expect(input.checked).toBe(true)
  })

  it('renders details variant with open attribute', async () => {
    const c = document.createElement('div')
    render(
      h(
        Accordion,
        { use: 'details', name: 'group2', open: true },
        h('summary', { className: 'collapse-title' }, 'Title'),
        h('div', { className: 'collapse-content' }, 'Content'),
      ),
      c,
    )
    await waitAccordionRender()
    const details = c.querySelector('details.collapse') as HTMLDetailsElement
    expect(details).toBeTruthy()
    expect(details.hasAttribute('open')).toBe(true)
  })

  it('appends custom className', async () => {
    const c = document.createElement('div')
    render(h(Accordion, { className: 'border' }, h(Accordion.Title, null, 'x')), c)
    await waitAccordionRender()
    const el = c.querySelector('.collapse') as HTMLElement
    expect(el.classList.contains('border')).toBe(true)
  })

  it('renders from items array (radio)', async () => {
    const c = document.createElement('div')
    render(
      h(Accordion, {
        name: 'group3',
        items: [
          { title: 'A', content: 'a', open: true },
          { title: 'B', content: 'b' },
        ],
      }),
      c,
    )
    await waitAccordionRender()
    const items = c.querySelectorAll('.collapse')
    expect(items.length).toBe(2)
    const inputs = c.querySelectorAll('input[type="radio"]')
    expect(inputs.length).toBe(2)
    expect((inputs[0] as HTMLInputElement).checked).toBe(true)
  })

  it('renders from items array (details)', async () => {
    const c = document.createElement('div')
    render(
      h(Accordion, {
        use: 'details',
        name: 'group4',
        items: [
          { title: 'A', content: 'a', open: true },
          { title: 'B', content: 'b' },
        ],
      }),
      c,
    )
    await waitAccordionRender()
    const details = c.querySelectorAll('details.collapse')
    expect(details.length).toBe(2)
    expect((details[0] as HTMLDetailsElement).hasAttribute('open')).toBe(true)
    const titles = c.querySelectorAll('summary.collapse-title')
    expect(titles.length).toBe(2)
  })

  it('supports controlled activeKey and onChange in items mode', async () => {
    const c = document.createElement('div')
    const spy = vi.fn()
    render(
      h(Accordion, {
        activeKey: 'roadmap',
        onChange: spy,
        items: [
          { key: 'intro', title: 'Intro', content: 'Intro content' },
          { key: 'roadmap', title: 'Roadmap', content: 'Roadmap content' },
        ],
      }),
      c,
    )
    await waitAccordionRender()
    const inputs = c.querySelectorAll('input[type="radio"]')
    expect((inputs[1] as HTMLInputElement).checked).toBe(true)

    ;(inputs[0] as HTMLInputElement).checked = true
    inputs[0].dispatchEvent(new Event('change', { bubbles: true }))
    await waitAccordionRender()

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0]).toBe('intro')
    expect(spy.mock.calls[0][1]).toMatchObject({ key: 'intro', index: 0, open: true })
  })

  it('syncs visual state for uncontrolled children radio groups', async () => {
    const c = document.createElement('div')
    render(
      h(
        'div',
        null,
        h(
          Accordion,
          { name: 'faq-group', defaultOpen: true },
          h(Accordion.Title, null, 'A'),
          h(Accordion.Content, null, 'a'),
        ),
        h(
          Accordion,
          { name: 'faq-group' },
          h(Accordion.Title, null, 'B'),
          h(Accordion.Content, null, 'b'),
        ),
      ),
      c,
    )
    await waitAccordionRender()

    const panels = c.querySelectorAll('.collapse')
    const inputs = c.querySelectorAll('input[type="radio"]')

    ;(inputs[1] as HTMLInputElement).checked = true
    inputs[1].dispatchEvent(new Event('change', { bubbles: true }))
    await waitAccordionRender()

    expect((panels[0] as HTMLElement).classList.contains('collapse-close')).toBe(true)
    expect((panels[1] as HTMLElement).classList.contains('collapse-open')).toBe(true)
  })

  it('syncs visual state for uncontrolled items radio groups', async () => {
    const c = document.createElement('div')
    render(
      h(Accordion, {
        items: [
          { key: 'a', title: 'A', content: 'a', open: true },
          { key: 'b', title: 'B', content: 'b' },
        ],
      }),
      c,
    )
    await waitAccordionRender()

    const panels = c.querySelectorAll('.collapse')
    const inputs = c.querySelectorAll('input[type="radio"]')

    ;(inputs[1] as HTMLInputElement).checked = true
    inputs[1].dispatchEvent(new Event('change', { bubbles: true }))
    await waitAccordionRender()

    expect((panels[0] as HTMLElement).classList.contains('collapse-close')).toBe(true)
    expect((panels[1] as HTMLElement).classList.contains('collapse-open')).toBe(true)
  })

  it('supports multiple open panels with checkbox inputs', async () => {
    const c = document.createElement('div')
    render(
      h(Accordion, {
        multiple: true,
        defaultOpenKeys: ['a', 'c'],
        items: [
          { key: 'a', title: 'A', content: 'a' },
          { key: 'b', title: 'B', content: 'b' },
          { key: 'c', title: 'C', content: 'c' },
        ],
      }),
      c,
    )
    await waitAccordionRender()
    const inputs = c.querySelectorAll('input[type="checkbox"]')
    expect(inputs.length).toBe(3)
    expect((inputs[0] as HTMLInputElement).checked).toBe(true)
    expect((inputs[1] as HTMLInputElement).checked).toBe(false)
    expect((inputs[2] as HTMLInputElement).checked).toBe(true)
  })

  it('supports collapsible children radio groups without breaking mutual exclusion', async () => {
    const c = document.createElement('div')
    render(
      h(
        'div',
        null,
        h(
          Accordion,
          { name: 'children-collapsible', defaultOpen: true, collapsible: true },
          h(Accordion.Title, null, 'A'),
          h(Accordion.Content, null, 'a'),
        ),
        h(
          Accordion,
          { name: 'children-collapsible', collapsible: true },
          h(Accordion.Title, null, 'B'),
          h(Accordion.Content, null, 'b'),
        ),
      ),
      c,
    )
    await waitAccordionRender()

    const panels = c.querySelectorAll('.collapse')
    const inputs = c.querySelectorAll('input[type="radio"]')
    expect(inputs.length).toBe(2)

    inputs[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await waitAccordionRender()
    expect((panels[0] as HTMLElement).classList.contains('collapse-close')).toBe(true)
    expect((inputs[0] as HTMLInputElement).checked).toBe(false)

    ;(inputs[1] as HTMLInputElement).checked = true
    inputs[1].dispatchEvent(new Event('change', { bubbles: true }))
    await waitAccordionRender()
    expect((panels[0] as HTMLElement).classList.contains('collapse-close')).toBe(true)
    expect((panels[1] as HTMLElement).classList.contains('collapse-open')).toBe(true)
  })

  it('supports collapsible items radio groups without switching to checkbox inputs', async () => {
    const c = document.createElement('div')
    render(
      h(Accordion, {
        collapsible: true,
        items: [
          { key: 'a', title: 'A', content: 'a', open: true },
          { key: 'b', title: 'B', content: 'b' },
        ],
      }),
      c,
    )
    await waitAccordionRender()

    const panels = c.querySelectorAll('.collapse')
    const inputs = c.querySelectorAll('input[type="radio"]')
    expect(inputs.length).toBe(2)

    inputs[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await waitAccordionRender()
    expect((panels[0] as HTMLElement).classList.contains('collapse-close')).toBe(true)
    expect((inputs[0] as HTMLInputElement).checked).toBe(false)

    ;(inputs[1] as HTMLInputElement).checked = true
    inputs[1].dispatchEvent(new Event('change', { bubbles: true }))
    await waitAccordionRender()
    expect((panels[1] as HTMLElement).classList.contains('collapse-open')).toBe(true)
    expect((inputs[0] as HTMLInputElement).checked).toBe(false)
  })

  it('syncs visual state for uncontrolled multiple items groups', async () => {
    const c = document.createElement('div')
    render(
      h(Accordion, {
        multiple: true,
        defaultOpenKeys: ['a'],
        items: [
          { key: 'a', title: 'A', content: 'a' },
          { key: 'b', title: 'B', content: 'b' },
          { key: 'c', title: 'C', content: 'c' },
        ],
      }),
      c,
    )
    await waitAccordionRender()

    const panels = c.querySelectorAll('.collapse')
    const inputs = c.querySelectorAll('input[type="checkbox"]')

    ;(inputs[2] as HTMLInputElement).checked = true
    inputs[2].dispatchEvent(new Event('change', { bubbles: true }))
    await waitAccordionRender()

    expect((panels[0] as HTMLElement).classList.contains('collapse-open')).toBe(true)
    expect((panels[2] as HTMLElement).classList.contains('collapse-open')).toBe(true)
  })

  it('renders description, extra and disabled item metadata', async () => {
    const c = document.createElement('div')
    render(
      h(Accordion, {
        items: [
          {
            key: 'ops',
            title: 'Ops Console',
            description: '仅限管理员查看',
            extra: 'Beta',
            disabled: true,
            content: 'content',
          },
        ],
      }),
      c,
    )
    await waitAccordionRender()

    const item = c.querySelector('.collapse') as HTMLElement
    const input = c.querySelector('input') as HTMLInputElement
    expect(item.textContent).toContain('Ops Console')
    expect(item.textContent).toContain('仅限管理员查看')
    expect(item.textContent).toContain('Beta')
    expect(item.classList.contains('opacity-70')).toBe(true)
    expect(input.disabled).toBe(true)
  })

  it('adjusts arrow icon alignment for metadata headers', async () => {
    const c = document.createElement('div')
    render(
      h(Accordion, {
        icon: 'arrow',
        items: [
          {
            key: 'meta',
            title: 'Metadata title',
            description: 'Description',
            extra: 'Badge',
            content: 'content',
          },
        ],
      }),
      c,
    )
    await waitAccordionRender()

    const title = c.querySelector('.collapse-title') as HTMLElement
    expect(title.className).toContain('after:top-6')
  })
})
