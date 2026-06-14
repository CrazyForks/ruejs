import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, render, setReactiveScheduling } from '@rue-js/rue'
import { Menu } from '@rue-js/design'
import { attachRouter, createRouter } from '@rue-js/router'
import { mountContainer, waitForContent } from '../../../../../runtime/__tests__/page-test-utils'

setReactiveScheduling('sync')

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

const installMockRouter = () => {
  attachRouter(
    createRouter({
      history: {
        location: () => '/',
        push: () => {},
        replace: () => {},
        listen: () => {},
        back: () => {},
      },
      routes: [{ path: '/', component: () => null }],
    }),
  )
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Menu', () => {
  it('renders with base class and ul', async () => {
    const c = mountContainer()
    resetActiveRuntime()
    render(h(Menu, null, h(Menu.Item, null, 'Item 1')), c)

    await waitForContent(() => {
      const el = c.querySelector('.menu') as HTMLElement
      expect(el).toBeTruthy()
      expect(el.tagName.toLowerCase()).toBe('ul')
      expect(el.classList.contains('menu')).toBe(true)
      expect(el.textContent).toContain('Item 1')
    })
  })

  it('applies size classes', async () => {
    const c = mountContainer()
    resetActiveRuntime()
    ;(['xs', 'sm', 'md', 'lg', 'xl'] as const).forEach(s => {
      render(h(Menu, { size: s }, h(Menu.Item, null, 'x')), c)
    })

    await waitForContent(() => {
      const el = c.querySelector('.menu') as HTMLElement
      expect(el.classList.contains('menu-xl')).toBe(true)
    })
  })

  it('applies direction classes', async () => {
    const c = mountContainer()
    resetActiveRuntime()
    render(h(Menu, { direction: 'vertical' }, h(Menu.Item, null, 'x')), c)

    await waitForContent(() => {
      const el = c.querySelector('.menu') as HTMLElement
      expect(el.classList.contains('menu-vertical')).toBe(true)
    })

    render(h(Menu, { direction: 'horizontal' }, h(Menu.Item, null, 'x')), c)

    await waitForContent(() => {
      const el = c.querySelector('.menu') as HTMLElement
      expect(el.classList.contains('menu-horizontal')).toBe(true)
    })
  })

  it('appends custom className', async () => {
    const c = mountContainer()
    resetActiveRuntime()
    render(h(Menu, { className: 'bg-base-200 rounded-box w-56' }, h(Menu.Item, null, 'x')), c)

    await waitForContent(() => {
      const el = c.querySelector('.menu') as HTMLElement
      expect(el.classList.contains('bg-base-200')).toBe(true)
      expect(el.classList.contains('rounded-box')).toBe(true)
      expect(el.classList.contains('w-56')).toBe(true)
    })
  })

  it('renders Item with states and different tags', async () => {
    const c = mountContainer()
    resetActiveRuntime()
    render(
      h(
        Menu,
        null,
        h(Menu.Item, { active: true }, 'A'),
        h(Menu.Item, { disabled: true, as: 'button' }, 'B'),
        h(Menu.Item, { focus: true, as: 'span' }, 'C'),
        h(Menu.Item, { as: 'a', href: '#x' }, 'D'),
      ),
      c,
    )

    await waitForContent(() => {
      const items = c.querySelectorAll('.menu li')
      expect(items.length).toBe(4)
      const a = items[0].querySelector('a') as HTMLElement
      expect(a.classList.contains('menu-active')).toBe(true)
      const b = items[1].querySelector('button') as HTMLElement
      expect(b.classList.contains('menu-disabled')).toBe(true)
      const s = items[2].querySelector('span') as HTMLElement
      expect(s.classList.contains('menu-focus')).toBe(true)
      const d = items[3].querySelector('a') as HTMLAnchorElement
      expect(d.getAttribute('href')).toBe('#x')
    })
  })

  it('supports router to on Item', async () => {
    const c = mountContainer()
    resetActiveRuntime()
    installMockRouter()
    render(h(Menu, null, h(Menu.Item, { to: '/about' }, 'Go')), c)

    await waitForContent(() => {
      const anchor = c.querySelector('.menu li a') as HTMLAnchorElement
      expect(anchor).toBeTruthy()
      expect(anchor.getAttribute('href')).toBe('#/about')
    })
  })

  it('supports href and target on Item', async () => {
    const c = mountContainer()
    resetActiveRuntime()
    render(h(Menu, null, h(Menu.Item, { href: '/x', target: '_blank' }, 'X')), c)

    await waitForContent(() => {
      const a = c.querySelector('.menu li a') as HTMLAnchorElement
      expect(a.getAttribute('href')).toBe('/x')
      expect(a.getAttribute('target')).toBe('_blank')
    })
  })

  it('fires onClick on Item', async () => {
    const c = mountContainer()
    resetActiveRuntime()
    const fn = vi.fn()
    render(h(Menu, null, h(Menu.Item, { onClick: fn }, 'Click')), c)

    await waitForContent(() => {
      expect(c.querySelector('.menu li a')).not.toBeNull()
    })

    const a = c.querySelector('.menu li a') as HTMLAnchorElement
    a.click()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('renders Title as li and h2', async () => {
    const c = mountContainer()
    resetActiveRuntime()
    render(h(Menu, null, h(Menu.Title, null, 'Title'), h(Menu.Title, { as: 'h2' }, 'Title2')), c)

    await waitForContent(() => {
      const liTitle = c.querySelector('.menu li.menu-title') as HTMLElement
      expect(liTitle).toBeTruthy()
      const h2Title = c.querySelector('h2.menu-title') as HTMLElement
      expect(h2Title).toBeTruthy()
    })
  })

  it('renders Dropdown and DropdownToggle with show', async () => {
    const c = mountContainer()
    resetActiveRuntime()
    render(
      h(
        Menu,
        null,
        h(
          Menu.Item,
          null,
          h(Menu.DropdownToggle, null, 'Parent'),
          h(Menu.Dropdown, null, h(Menu.Item, null, 'Sub 1'), h(Menu.Item, null, 'Sub 2')),
        ),
        h(
          Menu.Item,
          null,
          h(Menu.DropdownToggle, { show: true }, 'Parent2'),
          h(
            Menu.Dropdown,
            { show: true },
            h(Menu.Item, null, 'Sub 1'),
            h(Menu.Item, null, 'Sub 2'),
          ),
        ),
      ),
      c,
    )

    await waitForContent(() => {
      const toggles = c.querySelectorAll('.menu .menu-dropdown-toggle')
      expect(toggles.length).toBe(2)
      expect(toggles[1].classList.contains('menu-dropdown-show')).toBe(true)
      const dds = c.querySelectorAll('.menu .menu-dropdown')
      expect(dds.length).toBe(2)
      expect(dds[1].classList.contains('menu-dropdown-show')).toBe(true)
    })
  })

  it('renders Submenu nested ul', async () => {
    const c = mountContainer()
    resetActiveRuntime()
    render(
      h(
        Menu,
        null,
        h(
          Menu.Item,
          null,
          h('a', null, 'Parent'),
          h(Menu.Submenu, null, h(Menu.Item, null, 'Submenu 1'), h(Menu.Item, null, 'Submenu 2')),
        ),
      ),
      c,
    )

    await waitForContent(() => {
      const nested = c.querySelectorAll('.menu li ul')
      expect(nested.length).toBe(1)
      const lis = nested[0].querySelectorAll('li')
      expect(lis.length).toBe(2)
    })
  })

  it('renders from items array with title, dropdown and submenu', async () => {
    const c = mountContainer()
    resetActiveRuntime()
    const items = [
      { kind: 'title', children: 'Main' },
      {
        kind: 'item',
        children: 'Parent',
        dropdownToggle: { children: 'Toggle' },
        dropdown: {
          show: true,
          items: [
            { kind: 'item', children: 'DD 1' },
            { kind: 'item', children: 'DD 2' },
          ],
        },
      },
      {
        kind: 'item',
        children: 'Has Submenu',
        submenu: {
          items: [
            { kind: 'item', children: 'Sub 1' },
            { kind: 'item', children: 'Sub 2' },
          ],
        },
      },
    ] as any
    render(h(Menu, { items }), c)

    await waitForContent(() => {
      const el = c.querySelector('.menu') as HTMLElement
      expect(el).toBeTruthy()
      const title = c.querySelector('.menu-title') as HTMLElement
      expect(title).toBeTruthy()
      const toggles = c.querySelectorAll('.menu-dropdown-toggle')
      expect(toggles.length).toBe(1)
      const dds = c.querySelectorAll('.menu-dropdown')
      expect(dds.length).toBe(1)
      expect(dds[0].classList.contains('menu-dropdown-show')).toBe(true)
      const nested = c.querySelectorAll('.menu li ul')
      expect(nested.length).toBeGreaterThan(0)
    })
  })

  it('toggles legacy dropdown entries from items array', async () => {
    const c = mountContainer()
    resetActiveRuntime()
    const onToggleClick = vi.fn()
    const items = [
      {
        kind: 'item',
        children: 'Enterprise',
        dropdownToggle: { children: 'More', onClick: onToggleClick },
        dropdown: {
          visible: true,
          items: [
            { kind: 'item', children: 'CRM software' },
            { kind: 'item', children: 'Marketing management' },
          ],
        },
      },
    ] as any
    render(h(Menu, { items }), c)

    await waitForContent(() => {
      const toggle = c.querySelector('.menu-dropdown-toggle') as HTMLElement
      const dropdown = c.querySelector('.menu-dropdown') as HTMLElement
      expect(toggle.classList.contains('menu-dropdown-show')).toBe(true)
      expect(toggle.getAttribute('aria-expanded')).toBe('true')
      expect(dropdown.classList.contains('menu-dropdown-show')).toBe(true)
    })

    ;(c.querySelector('.menu-dropdown-toggle') as HTMLElement).click()
    await waitForContent(() => {
      const toggle = c.querySelector('.menu-dropdown-toggle') as HTMLElement
      const dropdown = c.querySelector('.menu-dropdown') as HTMLElement
      expect(toggle.classList.contains('menu-dropdown-show')).toBe(false)
      expect(toggle.getAttribute('aria-expanded')).toBe('false')
      expect(dropdown.classList.contains('menu-dropdown-show')).toBe(false)
      expect(onToggleClick).toHaveBeenCalledTimes(1)
    })

    ;(c.querySelector('.menu-dropdown-toggle') as HTMLElement).click()
    await waitForContent(() => {
      const dropdown = c.querySelector('.menu-dropdown') as HTMLElement
      expect(dropdown.classList.contains('menu-dropdown-show')).toBe(true)
      expect(onToggleClick).toHaveBeenCalledTimes(2)
    })
  })

  it('toggles legacy submenu entries from items array', async () => {
    const c = mountContainer()
    resetActiveRuntime()
    const items = [
      {
        kind: 'item',
        children: 'Parent',
        submenu: {
          items: [
            { kind: 'item', children: 'Sub 1' },
            { kind: 'item', children: 'Sub 2' },
          ],
        },
      },
    ] as any
    render(h(Menu, { items }), c)

    await waitForContent(() => {
      const button = c.querySelector('.menu li button') as HTMLButtonElement
      const submenu = c.querySelector('.menu li ul') as HTMLElement
      expect(button).toBeTruthy()
      expect(button.getAttribute('aria-expanded')).toBe('false')
      expect(submenu.classList.contains('hidden')).toBe(true)
    })

    ;(c.querySelector('.menu li button') as HTMLButtonElement).click()
    await waitForContent(() => {
      const button = c.querySelector('.menu li button') as HTMLButtonElement
      const submenu = c.querySelector('.menu li ul') as HTMLElement
      expect(button.getAttribute('aria-expanded')).toBe('true')
      expect(submenu.classList.contains('hidden')).toBe(false)
    })

    ;(c.querySelector('.menu li button') as HTMLButtonElement).click()
    await waitForContent(() => {
      const button = c.querySelector('.menu li button') as HTMLButtonElement
      const submenu = c.querySelector('.menu li ul') as HTMLElement
      expect(button.getAttribute('aria-expanded')).toBe('false')
      expect(submenu.classList.contains('hidden')).toBe(true)
    })
  })

  it('supports to/href/target in items array', async () => {
    const c = mountContainer()
    resetActiveRuntime()
    installMockRouter()
    const items = [
      { kind: 'item', to: '/about', children: 'About' },
      { kind: 'item', href: '/ext', target: '_blank', children: 'Ext' },
    ] as any
    render(h(Menu, { items }), c)

    await waitForContent(() => {
      const lis = c.querySelectorAll('.menu li')
      expect(lis.length).toBe(2)
      const routerAnchor = lis[0].querySelector('a') as HTMLAnchorElement
      expect(routerAnchor).toBeTruthy()
      expect(routerAnchor.getAttribute('href')).toBe('#/about')
      const a1 = lis[1].querySelector('a') as HTMLAnchorElement
      expect(a1.getAttribute('href')).toBe('/ext')
      expect(a1.getAttribute('target')).toBe('_blank')
    })
  })
})
