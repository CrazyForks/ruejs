// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { type FC, nextTick, useApp } from '@rue-js/rue'

import {
  NavigationFailureType,
  RouterView,
  createMemoryHistory,
  createRouter,
  useAsyncRouteComponent,
} from '../src'

const listeners: Array<() => void> = []

const listen = (name: string, callback: (event: CustomEvent<any>) => void) => {
  const listener = callback as EventListener
  document.addEventListener(name, listener)
  listeners.push(() => document.removeEventListener(name, listener))
}

const flushPageLoad = async () => {
  await nextTick()
  await Promise.resolve()
  await new Promise(resolve => setTimeout(resolve, 0))
}

afterEach(() => {
  listeners.splice(0).forEach(dispose => dispose())
  document.body.innerHTML = ''
  document.title = ''
})

describe('router navigation lifecycle', () => {
  it('emits success events around DOM flush and announces and focuses the new page', async () => {
    const events: string[] = []
    const Home: FC = () => <main data-testid="page">Home</main>
    const Guide: FC = () => <main data-testid="page">Guide DOM</main>
    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [
        { path: '/', component: Home, meta: { title: 'Home title' } },
        { path: '/guide', component: Guide, meta: { title: 'Guide title' } },
      ],
    })
    const container = document.createElement('div')
    document.body.appendChild(container)
    useApp(RouterView).use(router).mount(container)
    await flushPageLoad()

    listen('rue:before-navigation', event => {
      events.push(
        `before:${event.detail.from?.path}->${event.detail.to?.path}:${event.detail.type}`,
      )
    })
    listen('rue:after-navigation', event => {
      events.push(
        `after:${event.detail.from?.path}->${event.detail.to?.path}:${event.detail.failure ? 'failed' : 'ok'}`,
      )
    })
    listen('rue:page-load', event => {
      events.push(
        `load:${event.detail.to?.path}:${container.querySelector('[data-testid="page"]')?.textContent}`,
      )
    })

    await router.push('/guide')
    expect(events).toEqual(['before:/->/guide:push', 'after:/->/guide:ok'])
    await flushPageLoad()

    expect(events).toEqual(['before:/->/guide:push', 'after:/->/guide:ok', 'load:/guide:Guide DOM'])
    const announcer = document.querySelector('[data-rue-route-announcer]')
    expect(announcer?.getAttribute('aria-live')).toBe('assertive')
    expect(announcer?.textContent).toBe('Guide title')
    expect(document.activeElement).toBe(container.querySelector('[data-testid="page"]'))
  })

  it('prefers document.title for announcements and preserves an existing focus target', async () => {
    const Page: FC = ({ children }: any) => <main data-testid="page">{children}</main>
    const App: FC = () => (
      <div>
        <input data-testid="search" />
        <RouterView />
      </div>
    )
    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [
        { path: '/', component: () => <Page>Home</Page> },
        { path: '/next', component: () => <Page>Next</Page>, meta: { title: 'Meta title' } },
      ],
    })
    const container = document.createElement('div')
    document.body.appendChild(container)
    useApp(App).use(router).mount(container)
    await flushPageLoad()
    const search = container.querySelector('[data-testid="search"]') as HTMLInputElement
    search.focus()
    document.title = 'Document title'

    await router.push('/next')
    await flushPageLoad()

    expect(document.querySelector('[data-rue-route-announcer]')?.textContent).toBe('Document title')
    expect(document.activeElement).toBe(search)
  })

  it('emits failure after events without page-load for duplicate and aborted navigation', async () => {
    const events: string[] = []
    const Page: FC = () => null
    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [
        { path: '/', component: Page },
        { path: '/blocked', component: Page, beforeEnter: () => false },
      ],
    })
    for (const name of ['rue:before-navigation', 'rue:after-navigation', 'rue:page-load']) {
      listen(name, event => {
        events.push(
          `${name}:${event.detail.failure?.type ?? 'ok'}:${event.detail.to?.path ?? 'missing'}`,
        )
      })
    }

    const duplicated = await router.push('/')
    const aborted = await router.push('/blocked')
    await flushPageLoad()

    expect(duplicated?.type).toBe(NavigationFailureType.duplicated)
    expect(aborted?.type).toBe(NavigationFailureType.aborted)
    expect(events).toEqual([
      'rue:before-navigation:ok:/',
      'rue:after-navigation:duplicated:/',
      'rue:before-navigation:ok:/blocked',
      'rue:after-navigation:aborted:/blocked',
    ])
  })

  it('reports a stale lazy navigation as cancelled without loading its page', async () => {
    const events: string[] = []
    let resolveSlow: ((value: { default: FC }) => void) | undefined
    const Slow = useAsyncRouteComponent(
      () =>
        new Promise(resolve => {
          resolveSlow = resolve
        }),
    )
    const Page: FC = () => null
    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [
        { path: '/', component: Page },
        { path: '/slow', component: Slow },
        { path: '/fast', component: Page },
      ],
    })
    listen('rue:before-navigation', event => events.push(`before:${event.detail.to?.path}`))
    listen('rue:after-navigation', event =>
      events.push(`after:${event.detail.to?.path}:${event.detail.failure?.type ?? 'ok'}`),
    )
    listen('rue:page-load', event => events.push(`load:${event.detail.to?.path}`))

    const slowNavigation = router.push('/slow')
    await Promise.resolve()
    await router.push('/fast')
    await flushPageLoad()
    resolveSlow?.({ default: Page })
    await slowNavigation
    await flushPageLoad()

    expect(events).toEqual([
      'before:/slow',
      'before:/fast',
      'after:/fast:ok',
      'load:/fast',
      'after:/slow:cancelled',
    ])
  })
})
