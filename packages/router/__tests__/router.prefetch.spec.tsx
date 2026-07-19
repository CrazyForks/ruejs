// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { type FC, nextTick, useApp } from '@rue-js/rue'

import { RouterLink, createMemoryHistory, createRouter, useAsyncRouteComponent } from '../src'

const EmptyPage: FC = () => null

const flush = async () => {
  await nextTick()
  await Promise.resolve()
  await Promise.resolve()
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  Object.defineProperty(navigator, 'connection', { configurable: true, value: undefined })
})

const createLazy = (calls: string[], name: string) =>
  useAsyncRouteComponent(async () => {
    calls.push(name)
    return { default: EmptyPage }
  })

describe('router prefetch', () => {
  it('loads matched lazy components once without guards, history, or route commits', async () => {
    const calls: string[] = []
    const beforeEach = vi.fn()
    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [
        { path: '/', component: EmptyPage },
        { path: '/lazy', component: createLazy(calls, 'lazy') },
      ],
    })
    router.beforeEach(beforeEach)

    await Promise.all([router.prefetch('/lazy'), router.prefetch('/lazy')])

    expect(calls).toEqual(['lazy'])
    expect(beforeEach).not.toHaveBeenCalled()
    expect(router.currentPath.get()).toBe('/')
    expect(router.route.get()?.path).toBe('/')
    expect(router.history.location()).toBe('/')

    await router.push('/lazy')
    expect(calls).toEqual(['lazy'])
  })

  it('prefetches RouterLink with hover, tap, viewport, and load strategies', async () => {
    const calls: string[] = []
    let intersectionCallback: IntersectionObserverCallback | undefined
    const observe = vi.fn()
    const disconnect = vi.fn()
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          intersectionCallback = callback
        }
        observe = observe
        unobserve = vi.fn()
        disconnect = disconnect
      },
    )

    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [
        { path: '/', component: EmptyPage },
        { path: '/hover', component: createLazy(calls, 'hover') },
        { path: '/tap', component: createLazy(calls, 'tap') },
        { path: '/viewport', component: createLazy(calls, 'viewport') },
        { path: '/load', component: createLazy(calls, 'load') },
      ],
    })
    const App: FC = () => (
      <nav>
        <RouterLink data-testid="hover" to="/hover">
          Hover
        </RouterLink>
        <RouterLink data-testid="tap" to="/tap" prefetch="tap">
          Tap
        </RouterLink>
        <RouterLink data-testid="viewport" to="/viewport" prefetch="viewport">
          View
        </RouterLink>
        <RouterLink data-testid="load" to="/load" prefetch="load">
          Load
        </RouterLink>
      </nav>
    )
    const container = document.createElement('div')
    document.body.appendChild(container)
    useApp(App).use(router).mount(container)
    await flush()

    container
      .querySelector('[data-testid="hover"]')
      ?.dispatchEvent(new PointerEvent('pointerenter'))
    container.querySelector('[data-testid="hover"]')?.dispatchEvent(new FocusEvent('focus'))
    container.querySelector('[data-testid="tap"]')?.dispatchEvent(new PointerEvent('pointerdown'))
    const viewportLink = container.querySelector('[data-testid="viewport"]')!
    expect(observe).toHaveBeenCalledWith(viewportLink)
    intersectionCallback?.(
      [{ isIntersecting: true, target: viewportLink } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )
    window.dispatchEvent(new Event('load'))
    await flush()

    expect(calls.sort()).toEqual(['hover', 'load', 'tap', 'viewport'])
    expect(router.currentPath.get()).toBe('/')
    expect(router.history.location()).toBe('/')
  })

  it('degrades hover, viewport, and load to tap on data saver or 2g', async () => {
    const calls: string[] = []
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: { effectiveType: '2g', saveData: true },
    })
    const observe = vi.fn()
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe = observe
        unobserve = vi.fn()
        disconnect = vi.fn()
      },
    )
    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [
        { path: '/', component: EmptyPage },
        { path: '/slow', component: createLazy(calls, 'slow') },
      ],
    })
    const App: FC = () => (
      <RouterLink data-testid="slow" to="/slow">
        Slow
      </RouterLink>
    )
    const container = document.createElement('div')
    document.body.appendChild(container)
    useApp(App).use(router).mount(container)
    await flush()
    const link = container.querySelector('[data-testid="slow"]')!

    link.dispatchEvent(new PointerEvent('pointerenter'))
    await flush()
    expect(calls).toEqual([])

    link.dispatchEvent(new PointerEvent('pointerdown'))
    await flush()
    expect(calls).toEqual(['slow'])
    expect(observe).not.toHaveBeenCalled()
  })

  it('does not prefetch disabled or unmatched links', async () => {
    const calls: string[] = []
    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [
        { path: '/', component: EmptyPage },
        { path: '/lazy', component: createLazy(calls, 'lazy') },
      ],
    })
    await router.prefetch('/missing')

    const App: FC = () => (
      <nav>
        <RouterLink data-testid="disabled" to="/lazy" prefetch={false}>
          Disabled
        </RouterLink>
        <RouterLink data-testid="missing" to="/missing">
          Missing
        </RouterLink>
      </nav>
    )
    const container = document.createElement('div')
    document.body.appendChild(container)
    useApp(App).use(router).mount(container)
    await flush()
    container
      .querySelector('[data-testid="disabled"]')
      ?.dispatchEvent(new PointerEvent('pointerenter'))
    container
      .querySelector('[data-testid="missing"]')
      ?.dispatchEvent(new PointerEvent('pointerenter'))
    await flush()

    expect(calls).toEqual([])
  })
})
