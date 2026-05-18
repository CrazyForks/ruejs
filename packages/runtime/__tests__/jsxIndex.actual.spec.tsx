import { afterEach, describe, expect, it, vi } from 'vitest'

import { attachRouter, createRouter } from '@rue-js/router'

import { render, setReactiveScheduling } from '../src'
import IndexPage from '../../../app/pages/jsx/Index'
import { click, createMemoryHistory, mountContainer, waitForContent } from './page-test-utils'

vi.mock('../../../app/pages/site/SidebarPlaygroundExample', () => ({
  default: (props: { children?: unknown }) => (
    <div data-testid="mock-sidebar-example">{props.children}</div>
  ),
}))

setReactiveScheduling('sync')

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

const normalize = (value: string | null | undefined) => value?.replace(/\s+/g, ' ').trim() ?? ''

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('JSX index actual page', () => {
  it('renders the JSX case directory and navigates through RouterLink items', async () => {
    const Empty = () => null
    const history = createMemoryHistory('/jsx')
    const router = createRouter({
      history,
      routes: [
        { path: '/jsx', component: IndexPage as any },
        { path: '/jsx/basic-elements', component: Empty as any },
      ],
    })
    attachRouter(router)

    const container = mountContainer()
    resetActiveRuntime()
    render(<IndexPage />, container)

    await waitForContent(() => {
      const links = Array.from(container.querySelectorAll('a')) as HTMLAnchorElement[]
      expect(container.textContent).toContain('React JSX 语法目录')
      expect(links).toHaveLength(26)
      expect(normalize(links[0]?.textContent)).toBe('基础元素与自闭合标签')
      expect(links[0]?.getAttribute('href')).toBe('/jsx/basic-elements')
      expect(normalize(links[15]?.textContent)).toBe('v-for / r-for 指令')
      expect(links[15]?.getAttribute('href')).toBe('/jsx/v-for-r-for')
      expect(normalize(links[25]?.textContent)).toBe('Refs 基础')
      expect(links[25]?.getAttribute('href')).toBe('/jsx/refs')
    })

    const firstLink = container.querySelector('a[href="/jsx/basic-elements"]')
    await click(firstLink)

    await waitForContent(() => {
      expect(history.location()).toBe('/jsx/basic-elements')
    })
  })
})
