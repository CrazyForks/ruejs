// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from '@rue-js/rue'

import { createMemoryHistory, createRouter } from '../src'

const flushScroll = async () => {
  await nextTick()
  await Promise.resolve()
  await new Promise(resolve => setTimeout(resolve, 0))
}

let scrollX = 0
let scrollY = 0

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  scrollX = 0
  scrollY = 0
})

const mockWindowScroll = () => {
  Object.defineProperty(window, 'scrollX', { configurable: true, get: () => scrollX })
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollY })
  return vi.spyOn(window, 'scrollTo').mockImplementation((options: any) => {
    scrollX = options.left ?? scrollX
    scrollY = options.top ?? scrollY
  })
}

const routes = [
  { path: '/', component: () => null },
  { path: '/a', component: () => null },
  { path: '/b', component: () => null },
  { path: '/guide', component: () => null },
]

describe('router scroll behavior', () => {
  it('normalizes memory history navigation sources', () => {
    const history = createMemoryHistory('/')
    const sources: unknown[] = []
    history.listen(source => sources.push(source))

    history.push('/a')
    history.replace('/b')
    history.back?.()

    expect(sources).toEqual(['push', 'replace', 'pop'])
    expect(history.location()).toBe('/')
  })

  it('scrolls new pushes to the top before page-load', async () => {
    scrollX = 40
    scrollY = 90
    const scrollTo = mockWindowScroll()
    const positionsAtPageLoad: number[] = []
    const onPageLoad = () => positionsAtPageLoad.push(scrollY)
    document.addEventListener('rue:page-load', onPageLoad)
    const router = createRouter({ history: createMemoryHistory('/'), routes })

    await router.push('/a')
    await flushScroll()
    document.removeEventListener('rue:page-load', onPageLoad)

    expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 0 })
    expect(positionsAtPageLoad).toEqual([0])
  })

  it('restores the saved position on pop navigation', async () => {
    scrollY = 120
    const scrollTo = mockWindowScroll()
    const router = createRouter({ history: createMemoryHistory('/'), routes })

    await router.push('/a')
    await flushScroll()
    scrollY = 320
    await router.push('/b')
    await flushScroll()
    scrollTo.mockClear()

    router.back()
    await flushScroll()

    expect(router.currentPath.get()).toBe('/a')
    expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 320 })
  })

  it('prefers a decoded hash target and safely falls back when it is missing', async () => {
    const scrollTo = mockWindowScroll()
    const target = document.createElement('section')
    target.id = 'hello world'
    const scrollIntoView = vi.fn()
    target.scrollIntoView = scrollIntoView
    document.body.appendChild(target)
    const router = createRouter({ history: createMemoryHistory('/'), routes })

    await router.push('/guide#hello%20world')
    await flushScroll()
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollTo).not.toHaveBeenCalled()

    await router.push('/a#missing%ZZ')
    await flushScroll()
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, top: 0 })
  })

  it('supports false, coordinates, and selector results from scrollBehavior', async () => {
    const scrollTo = mockWindowScroll()
    const target = document.createElement('div')
    target.id = 'custom-target'
    const scrollIntoView = vi.fn()
    target.scrollIntoView = scrollIntoView
    document.body.appendChild(target)
    const router = createRouter({
      history: createMemoryHistory('/'),
      routes,
      scrollBehavior(to) {
        if (to?.path === '/a') return false
        if (to?.path === '/b') return { left: 4, top: 8 }
        return '#custom-target'
      },
    })

    await router.push('/a')
    await flushScroll()
    expect(scrollTo).not.toHaveBeenCalled()

    await router.push('/b')
    await flushScroll()
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 4, top: 8 })

    await router.push('/guide')
    await flushScroll()
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('does not scroll for duplicated or aborted navigation', async () => {
    const scrollTo = mockWindowScroll()
    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [...routes, { path: '/blocked', component: () => null, beforeEnter: () => false }],
    })

    await router.push('/')
    await router.push('/blocked')
    await flushScroll()

    expect(scrollTo).not.toHaveBeenCalled()
  })
})
