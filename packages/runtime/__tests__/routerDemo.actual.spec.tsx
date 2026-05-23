import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  attachRouter,
  createRouter,
  RouterView,
  type HistoryLike,
  type RouteRecordRaw,
} from '@rue-js/router'

import { render, setReactiveScheduling } from '../src'
import RouterDemo from '../../../app/pages/examples/RouterDemo'
import {
  RouterDemoGuideShell,
  RouterDemoLabPage,
  RouterDemoTopicPage,
} from '../../../app/pages/examples/router-demo/RouterDemoScene'
import { routerDemoLabEnabled } from '../../../app/pages/examples/router-demo/state'
import { click, flush, mountContainer, waitForContent } from './page-test-utils'

vi.mock('../../../app/pages/site/SidebarPlaygroundExample', () => ({
  default: (props: { children?: unknown }) => (
    <div data-testid="mock-sidebar-playground">{props.children}</div>
  ),
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: () => null,
}))

setReactiveScheduling('sync')

const normalizeText = (value: string | null | undefined) => value?.replace(/\s+/g, ' ').trim() ?? ''

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

const normalizePath = (path: string) => {
  const next = String(path || '')
  if (!next) return '/'
  if (next.startsWith('/')) return next
  if (next.startsWith('#/')) return next.slice(1)
  if (next.startsWith('#')) return '/' + next.slice(1)
  return '/' + next
}

const createTrackedMemoryHistory = (
  initialPath: string,
): HistoryLike & { pushes: string[]; replaces: string[] } => {
  let currentPath = normalizePath(initialPath)
  const listeners = new Set<() => void>()

  const history = {
    pushes: [] as string[],
    replaces: [] as string[],
    location: () => currentPath,
    push: (path: string) => {
      currentPath = normalizePath(path)
      history.pushes.push(currentPath)
      listeners.forEach(listener => listener())
    },
    replace: (path: string) => {
      currentPath = normalizePath(path)
      history.replaces.push(currentPath)
      listeners.forEach(listener => listener())
    },
    listen: (cb: () => void) => {
      listeners.add(cb)
    },
    back: () => {},
  }

  return history as HistoryLike & { pushes: string[]; replaces: string[] }
}

const createRouterDemoRoutes = (): RouteRecordRaw[] => [
  {
    path: '/examples/router-demo',
    component: RouterDemo as any,
    meta: { demo: 'router', surface: 'examples' },
    children: [
      {
        path: '',
        redirect: { name: 'router-demo-topic', params: { section: 'router', topic: 'overview' } },
      },
      {
        path: 'guide/:section(router|data)',
        component: RouterDemoGuideShell as any,
        meta: { layer: 'guide-shell' },
        children: [
          {
            path: '',
            redirect: to => ({
              name: 'router-demo-topic',
              params: {
                section: to?.params.section || 'router',
                topic: 'overview',
              },
            }),
          },
          {
            path: ':topic',
            name: 'router-demo-topic',
            component: RouterDemoTopicPage as any,
            meta: { layer: 'topic-leaf' },
          },
        ],
      },
      {
        path: 'lab',
        name: 'router-demo-lab',
        component: RouterDemoLabPage as any,
        meta: { layer: 'lab-leaf', gated: true },
        beforeEnter: () => {
          if (routerDemoLabEnabled.value) {
            return
          }

          return { name: 'router-demo-topic', params: { section: 'router', topic: 'guards' } }
        },
      },
    ],
  },
]

const clickLinkByText = async (root: ParentNode, label: string) => {
  const link = Array.from(root.querySelectorAll('a')).find(current => {
    return current.textContent?.trim() === label
  })

  if (!link) {
    throw new Error(`Unable to find link with text: ${label}`)
  }

  await click(link)
}

const setLabToggle = async (root: ParentNode, checked: boolean) => {
  const checkbox = root.querySelector('input[type="checkbox"]') as HTMLInputElement | null

  expect(checkbox).toBeTruthy()
  checkbox!.checked = checked
  checkbox!.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }))
  await flush()
}

afterEach(() => {
  document.body.innerHTML = ''
  routerDemoLabEnabled.value = false
  resetActiveRuntime()
  vi.restoreAllMocks()
})

describe('RouterDemo actual page', () => {
  it('redirects the demo parent route to the default nested overview page', async () => {
    resetActiveRuntime()
    const history = createTrackedMemoryHistory('/examples/router-demo')
    const router = createRouter({ history, routes: createRouterDemoRoutes() })
    attachRouter(router)

    const container = mountContainer()
    render(<RouterView />, container)

    await waitForContent(() => {
      expect(router.route.get()?.path).toBe('/examples/router-demo/guide/router/overview')
      expect(router.route.get()?.name).toBe('router-demo-topic')
      expect(normalizeText(container.textContent)).toContain('嵌套路由总览')
      expect(normalizeText(container.textContent)).toContain('RouterView Depth 1')
    })

    expect(history.replaces).toEqual(['/examples/router-demo/guide/router/overview'])
    expect(history.pushes).toEqual([])
  })

  it('redirects blocked lab navigation to guards and allows it after enabling the toggle', async () => {
    resetActiveRuntime()
    const history = createTrackedMemoryHistory('/examples/router-demo')
    const router = createRouter({ history, routes: createRouterDemoRoutes() })
    attachRouter(router)

    const container = mountContainer()
    render(<RouterView />, container)

    await waitForContent(() => {
      expect(router.route.get()?.path).toBe('/examples/router-demo/guide/router/overview')
    })

    await clickLinkByText(container, '实验页')

    await waitForContent(() => {
      expect(router.route.get()?.path).toBe('/examples/router-demo/guide/router/guards')
      expect(router.route.get()?.name).toBe('router-demo-topic')
      expect(normalizeText(container.textContent)).toContain('守卫与重定向')
      expect(normalizeText(container.textContent)).toContain('实验页被 beforeEnter 保护')
    })

    expect(history.pushes).toEqual(['/examples/router-demo/guide/router/guards'])

    await setLabToggle(container, true)
    await clickLinkByText(container, '实验页')

    await waitForContent(() => {
      expect(router.route.get()?.path).toBe('/examples/router-demo/lab')
      expect(router.route.get()?.name).toBe('router-demo-lab')
      expect(normalizeText(container.textContent)).toContain('beforeEnter 已放行')
      expect(normalizeText(container.textContent)).toContain(
        '这个页面只有在守卫开关打开时才会被真正渲染。',
      )
    })

    expect(history.pushes).toEqual([
      '/examples/router-demo/guide/router/guards',
      '/examples/router-demo/lab',
    ])
  })
})
