import { afterEach, describe, expect, it } from 'vitest'
import { h } from '@rue-js/rue'
import { render, setReactiveScheduling } from '@rue-js/rue'
import { Breadcrumbs } from '@rue-js/design'
import { mountContainer, waitForContent } from '../../../../../runtime/__tests__/page-test-utils'

setReactiveScheduling('sync')

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Breadcrumbs', () => {
  it('renders with base class and ul', async () => {
    const c = mountContainer()
    render(h(Breadcrumbs, null, h('li', null, 'Home')), c)
    await waitForContent(() => {
      const el = c.querySelector('.breadcrumbs') as HTMLElement
      expect(el).toBeTruthy()
      expect(el.classList.contains('breadcrumbs')).toBe(true)
      const ul = el.querySelector('ul') as HTMLElement
      expect(ul).toBeTruthy()
      expect(ul.textContent).toContain('Home')
    })
  })

  it('appends custom className', async () => {
    const c = mountContainer()
    render(h(Breadcrumbs, { className: 'text-sm' }, h('li', null, 'x')), c)
    await waitForContent(() => {
      const el = c.querySelector('.breadcrumbs') as HTMLElement
      expect(el.classList.contains('text-sm')).toBe(true)
    })
  })

  it('renders children li items', async () => {
    const c = mountContainer()
    render(
      h(
        Breadcrumbs,
        null,
        h('li', null, h('a', null, 'Home')),
        h('li', null, h('a', null, 'Documents')),
        h('li', null, 'Add Document'),
      ),
      c,
    )
    await waitForContent(() => {
      const lis = c.querySelectorAll('.breadcrumbs ul li')
      expect(lis.length).toBe(3)
    })
  })

  it('renders Item subcomponent', async () => {
    const c = mountContainer()
    render(
      h(Breadcrumbs, { className: 'text-sm' }, h(Breadcrumbs.Item, null, h('span', null, 'Home'))),
      c,
    )
    await waitForContent(() => {
      const el = c.querySelector('.breadcrumbs') as HTMLElement
      const li = el.querySelector('li') as HTMLElement
      expect(li).toBeTruthy()
      expect(li.textContent).toContain('Home')
    })
  })

  it('renders Item subcomponent with href, icon and current state', async () => {
    const c = mountContainer()
    render(
      h(
        Breadcrumbs,
        { className: 'text-sm' },
        h(
          Breadcrumbs.Item,
          {
            href: '/home',
            icon: h('span', { className: 'crumb-icon' }, 'H'),
          },
          'Home',
        ),
        h(Breadcrumbs.Item, { current: true }, 'Library'),
      ),
      c,
    )

    await waitForContent(() => {
      const homeLink = c.querySelector('li a[href="/home"]') as HTMLAnchorElement
      expect(homeLink).toBeTruthy()
      expect(homeLink.querySelector('.crumb-icon')?.textContent).toBe('H')

      const current = c.querySelector('li span[aria-current="page"]') as HTMLElement
      expect(current).toBeTruthy()
      expect(current.textContent).toContain('Library')
    })
  })

  it('renders from items array with icons and href', async () => {
    const c = mountContainer()
    const items = [
      {
        label: 'Home',
        href: '/home',
        linkClassName: 'hover:underline cursor-pointer inline-flex gap-2 items-center',
        icon: h(
          'svg',
          {
            xmlns: 'http://www.w3.org/2000/svg',
            fill: 'none',
            viewBox: '0 0 24 24',
            className: 'w-4 h-4 stroke-current',
          },
          h('path', {
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            'stroke-width': '2',
            d: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
          }),
        ),
      },
      {
        label: 'Documents',
        href: '/docs',
        linkClassName: 'hover:underline cursor-pointer inline-flex gap-2 items-center',
      },
      {
        label: 'Add Document',
        className: 'last',
        icon: h(
          'svg',
          {
            xmlns: 'http://www.w3.org/2000/svg',
            fill: 'none',
            viewBox: '0 0 24 24',
            className: 'w-4 h-4 stroke-current',
          },
          h('path', {
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
            'stroke-width': '2',
            d: 'M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
          }),
        ),
      },
    ]
    render(h(Breadcrumbs, { className: 'text-sm', items }), c)
    await waitForContent(() => {
      const el = c.querySelector('.breadcrumbs') as HTMLElement
      expect(el.classList.contains('text-sm')).toBe(true)
      const lis = el.querySelectorAll(':scope > ul > li')
      expect(lis.length).toBe(3)
      const firstLink = lis[0].querySelector('a') as HTMLAnchorElement
      expect(firstLink).toBeTruthy()
      expect(firstLink.getAttribute('href')).toBe('/home')
      expect(firstLink.classList.contains('hover:underline')).toBe(true)
      const icon = lis[2].querySelector('svg') as SVGElement
      expect(icon).toBeTruthy()
    })
  })

  it('supports title alias, params and itemRender in items mode', async () => {
    const c = mountContainer()
    const items = [
      { path: 'workspace', title: 'Workspace' },
      { path: ':projectId', title: 'Project' },
      { title: 'Button' },
    ]

    render(
      h(Breadcrumbs, {
        items,
        params: { projectId: 42 },
        itemRender: (item: any, params: any, routes: any[], paths: string[], href?: string) => {
          const title = item.title ?? item.label
          const content = `${title}|${params.projectId}|${routes.length}|${paths.join('/')}`
          if (href) {
            return h('a', { href, 'data-testid': title }, content)
          }
          return h('span', { 'data-testid': title }, content)
        },
      }),
      c,
    )

    await waitForContent(() => {
      const workspace = c.querySelector('[data-testid="Workspace"]') as HTMLAnchorElement
      expect(workspace.getAttribute('href')).toBe('/workspace')
      expect(workspace.textContent).toBe('Workspace|42|3|workspace')

      const project = c.querySelector('[data-testid="Project"]') as HTMLAnchorElement
      expect(project.getAttribute('href')).toBe('/workspace/42')
      expect(project.textContent).toBe('Project|42|3|workspace/42')

      const button = c.querySelector('[data-testid="Button"]') as HTMLElement
      expect(button.tagName.toLowerCase()).toBe('span')
      expect(button.textContent).toBe('Button|42|3|workspace/42')
    })
  })

  it('supports custom separators and menu items in items mode', async () => {
    const c = mountContainer()

    render(
      h(Breadcrumbs, {
        separator: '/',
        dropdownIcon: h('span', { className: 'custom-dropdown-icon' }, 'v'),
        items: [
          { title: 'Home', href: '/home' },
          { type: 'separator', separator: '•' },
          {
            title: 'Library',
            menu: {
              items: [
                { key: 'all', title: 'All Posts', href: '/posts' },
                { key: 'draft', title: 'Drafts' },
              ],
            },
          },
          { title: 'Button' },
        ],
      }),
      c,
    )

    await waitForContent(() => {
      const listItems = c.querySelectorAll('.breadcrumbs > ul > li')
      expect(listItems.length).toBe(3)

      const librarySeparator = listItems[1].firstElementChild as HTMLElement
      expect(librarySeparator).toBeTruthy()
      expect(librarySeparator.textContent).toBe('•')

      const menu = c.querySelector('.dropdown-content.menu') as HTMLElement
      expect(menu).toBeTruthy()
      expect(menu.querySelectorAll('li').length).toBe(2)
      expect(c.querySelector('.custom-dropdown-icon')?.textContent).toBe('v')

      const buttonSeparator = listItems[2].firstElementChild as HTMLElement
      expect(buttonSeparator.textContent).toBe('/')
    })
  })
})
