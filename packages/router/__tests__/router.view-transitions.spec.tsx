// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { type FC, nextTick, useApp } from '@rue-js/rue'

import { RouterView, createMemoryHistory, createRouter, useAsyncRouteComponent } from '../src'

const Page: FC<{ name?: string }> = ({ name }) => <p data-testid="page">{name}</p>
const routes = [
  { path: '/', component: () => <Page name="home" /> },
  { path: '/next', component: () => <Page name="next" /> },
]

const flush = async () => {
  await nextTick()
  await Promise.resolve()
  await new Promise(resolve => setTimeout(resolve, 0))
}

afterEach(() => {
  document.body.innerHTML = ''
  delete (document as any).startViewTransition
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('router view transitions', () => {
  it('commits inside the transition callback without waiting for finished', async () => {
    let update: (() => void) | undefined
    let resolveFinished: (() => void) | undefined
    const finished = new Promise<void>(resolve => {
      resolveFinished = resolve
    })
    const startViewTransition = vi.fn((callback: () => void) => {
      update = callback
      return {
        ready: Promise.resolve(),
        finished,
        updateCallbackDone: Promise.resolve(),
      }
    })
    ;(document as any).startViewTransition = startViewTransition
    const router = createRouter({
      history: createMemoryHistory('/'),
      routes,
      viewTransitions: true,
    })
    const container = document.createElement('div')
    document.body.appendChild(container)
    useApp(RouterView).use(router).mount(container)
    await flush()

    const navigation = router.push('/next')
    await Promise.resolve()
    expect(startViewTransition).toHaveBeenCalledTimes(1)
    expect(router.currentPath.get()).toBe('/')

    update?.()
    await navigation
    await flush()
    expect(router.currentPath.get()).toBe('/next')
    expect(container.querySelector('[data-testid="page"]')?.textContent).toBe('next')
    resolveFinished?.()
  })

  it('commits directly when disabled or unsupported', async () => {
    const startViewTransition = vi.fn((callback: () => void) => {
      callback()
      return {
        ready: Promise.resolve(),
        finished: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
      }
    })
    ;(document as any).startViewTransition = startViewTransition
    const disabled = createRouter({
      history: createMemoryHistory('/'),
      routes,
      viewTransitions: false,
    })
    await disabled.push('/next')
    expect(disabled.currentPath.get()).toBe('/next')
    expect(startViewTransition).not.toHaveBeenCalled()

    delete (document as any).startViewTransition
    const unsupported = createRouter({
      history: createMemoryHistory('/'),
      routes,
      viewTransitions: true,
    })
    await unsupported.push('/next')
    expect(unsupported.currentPath.get()).toBe('/next')
  })

  it('skips reduced motion by default but allows an explicit override', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    )
    const startViewTransition = vi.fn((callback: () => void) => {
      callback()
      return {
        ready: Promise.resolve(),
        finished: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
      }
    })
    ;(document as any).startViewTransition = startViewTransition

    const skipped = createRouter({
      history: createMemoryHistory('/'),
      routes,
      viewTransitions: true,
    })
    await skipped.push('/next')
    expect(startViewTransition).not.toHaveBeenCalled()

    const forced = createRouter({
      history: createMemoryHistory('/'),
      routes,
      viewTransitions: { skipWhenReducedMotion: false },
    })
    await forced.push('/next')
    expect(startViewTransition).toHaveBeenCalledTimes(1)
  })

  it('never starts a transition for duplicate, aborted, or stale navigation', async () => {
    let resolveSlow: ((value: { default: FC }) => void) | undefined
    const Slow = useAsyncRouteComponent(
      () =>
        new Promise(resolve => {
          resolveSlow = resolve
        }),
    )
    const startViewTransition = vi.fn((callback: () => void) => {
      callback()
      return {
        ready: Promise.resolve(),
        finished: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
      }
    })
    ;(document as any).startViewTransition = startViewTransition
    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [
        { path: '/', component: Page },
        { path: '/blocked', component: Page, beforeEnter: () => false },
        { path: '/slow', component: Slow },
        { path: '/next', component: Page },
      ],
      viewTransitions: true,
    })

    await router.push('/')
    await router.push('/blocked')
    const slowNavigation = router.push('/slow')
    await Promise.resolve()
    await router.push('/next')
    expect(startViewTransition).toHaveBeenCalledTimes(1)
    startViewTransition.mockClear()
    resolveSlow?.({ default: Page })
    await slowNavigation
    expect(startViewTransition).not.toHaveBeenCalled()
  })

  it('falls back to one direct commit when startViewTransition throws', async () => {
    const startViewTransition = vi.fn(() => {
      throw new Error('transition unavailable')
    })
    ;(document as any).startViewTransition = startViewTransition
    const afterEach = vi.fn()
    const router = createRouter({
      history: createMemoryHistory('/'),
      routes,
      viewTransitions: true,
    })
    router.afterEach(afterEach)

    await router.push('/next')

    expect(router.currentPath.get()).toBe('/next')
    expect(afterEach).toHaveBeenCalledTimes(1)
    expect(startViewTransition).toHaveBeenCalledTimes(1)
  })
})
