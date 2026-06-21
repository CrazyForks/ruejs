import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  h,
  hydrateOnIdle,
  hydrateOnInteraction,
  hydrateOnMediaQuery,
  hydrateOnVisible,
  render,
  setReactiveScheduling,
  useComponent,
  type FC,
  type HydrationStrategy,
} from '../src'

type LoadedModule = { default: FC<any> }

setReactiveScheduling('sync')

const flushAsyncComponent = async (turns = 8) => {
  for (let turn = 0; turn < turns; turn += 1) {
    await Promise.resolve()
  }
}

const mountContainer = () => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return container
}

afterEach(() => {
  render(null as any, document.body as any)
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.unstubAllGlobals()
  delete (window as any).IntersectionObserver
  delete (window as any).matchMedia
})

describe('useComponent lazy hydration strategies', () => {
  it('defers the loader until the idle strategy fires', async () => {
    vi.useFakeTimers()
    const loader = vi.fn(async () => ({
      default: () => h('p', { id: 'idle-ready' }, 'idle ready'),
    }))
    const Async = useComponent({
      loader,
      hydrate: hydrateOnIdle(),
    })
    const container = mountContainer()

    render(h(Async, null), container)
    await flushAsyncComponent()

    expect(loader).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    await flushAsyncComponent()

    expect(loader).toHaveBeenCalledTimes(1)
    expect(container.querySelector('#idle-ready')?.textContent).toBe('idle ready')
  })

  it('starts loading when the visible strategy observes an intersecting root', async () => {
    type ObserverEntry = { isIntersecting: boolean; target?: Element }
    const observers: Array<{
      observe: ReturnType<typeof vi.fn>
      disconnect: ReturnType<typeof vi.fn>
      trigger: (entries: ObserverEntry[]) => void
    }> = []
    class MockIntersectionObserver {
      observe = vi.fn()
      disconnect = vi.fn()

      constructor(private callback: (entries: ObserverEntry[]) => void) {
        observers.push(this)
      }

      trigger(entries: ObserverEntry[]) {
        this.callback(entries)
      }
    }
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
    ;(window as any).IntersectionObserver = MockIntersectionObserver

    const loader = vi.fn(async () => ({
      default: () => h('p', { id: 'visible-ready' }, 'visible ready'),
    }))
    const Async = useComponent({
      loader,
      hydrate: hydrateOnVisible({ rootMargin: '80px' }),
    })
    const container = mountContainer()

    render(h(Async, null), container)
    await flushAsyncComponent()

    expect(loader).not.toHaveBeenCalled()
    expect(observers).toHaveLength(1)
    expect(observers[0].observe).toHaveBeenCalledTimes(1)

    observers[0].trigger([{ isIntersecting: false }])
    await flushAsyncComponent()
    expect(loader).not.toHaveBeenCalled()

    observers[0].trigger([{ isIntersecting: true }])
    await flushAsyncComponent()

    expect(loader).toHaveBeenCalledTimes(1)
    expect(observers[0].disconnect).toHaveBeenCalled()
    expect(container.querySelector('#visible-ready')?.textContent).toBe('visible ready')
  })

  it('uses a scroll fallback when an observed target enters the root margin', async () => {
    const observer = {
      observe: vi.fn(),
      disconnect: vi.fn(),
    }
    class MockIntersectionObserver {
      observe = observer.observe
      disconnect = observer.disconnect
    }
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
    ;(window as any).IntersectionObserver = MockIntersectionObserver

    let rectTop = window.innerHeight + 200
    const target = document.createElement('section')
    target.getBoundingClientRect = () =>
      ({
        top: rectTop,
        bottom: rectTop + 100,
        left: 0,
        right: 100,
        width: 100,
        height: 100,
        x: 0,
        y: rectTop,
        toJSON: () => ({}),
      }) as DOMRect
    const hydrate = vi.fn()
    const cleanup = hydrateOnVisible({ rootMargin: '120px' })(hydrate, cb => {
      cb(target)
    })

    expect(observer.observe).toHaveBeenCalledWith(target)
    expect(hydrate).not.toHaveBeenCalled()

    rectTop = window.innerHeight + 60
    window.dispatchEvent(new Event('scroll'))

    expect(hydrate).toHaveBeenCalledTimes(1)
    expect(observer.disconnect).toHaveBeenCalled()

    cleanup?.()
  })

  it('starts loading when the media query strategy matches', async () => {
    let mediaListener: (() => void) | undefined
    const mediaQueryList = {
      matches: false,
      addEventListener: vi.fn((_event: string, listener: () => void) => {
        mediaListener = listener
      }),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }
    const matchMedia = vi.fn(() => mediaQueryList)
    vi.stubGlobal('matchMedia', matchMedia)
    ;(window as any).matchMedia = matchMedia

    const loader = vi.fn(async () => ({
      default: () => h('p', { id: 'media-ready' }, 'media ready'),
    }))
    const Async = useComponent({
      loader,
      hydrate: hydrateOnMediaQuery('(min-width: 900px)'),
    })
    const container = mountContainer()

    render(h(Async, null), container)
    await flushAsyncComponent()

    expect(loader).not.toHaveBeenCalled()
    expect(matchMedia).toHaveBeenCalledWith('(min-width: 900px)')

    mediaQueryList.matches = true
    mediaListener?.()
    await flushAsyncComponent()

    expect(loader).toHaveBeenCalledTimes(1)
    expect(mediaQueryList.removeEventListener).toHaveBeenCalled()
    expect(container.querySelector('#media-ready')?.textContent).toBe('media ready')
  })

  it('starts loading on interaction and replays the triggering event after resolve', async () => {
    const deferred: { resolve?: (module: LoadedModule) => void } = {}
    const loader = vi.fn(
      () =>
        new Promise<LoadedModule>(resolve => {
          deferred.resolve = resolve
        }),
    )
    const Async = useComponent({
      loader,
      hydrate: hydrateOnInteraction('click'),
    })
    const container = mountContainer()

    render(h(Async, null), container)
    await flushAsyncComponent()

    const wrapper = container.firstElementChild as HTMLElement
    const replayProbe = vi.fn()
    wrapper.addEventListener('click', replayProbe)

    wrapper.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(replayProbe).toHaveBeenCalledTimes(1)
    expect(loader).toHaveBeenCalledTimes(1)

    deferred.resolve?.({
      default: () => h('button', { id: 'interaction-ready' }, 'interaction ready'),
    })
    await flushAsyncComponent()

    expect(container.querySelector('#interaction-ready')?.textContent).toBe('interaction ready')
    expect(replayProbe).toHaveBeenCalledTimes(2)
  })

  it('runs custom strategy cleanup when hydration starts', async () => {
    const cleanup = vi.fn()
    let activate: (() => void | Promise<unknown> | null | undefined) | undefined
    const strategy: HydrationStrategy = (hydrate, forEachElement) => {
      const roots: Element[] = []
      forEachElement(el => {
        roots.push(el)
      })
      expect(roots[0]).toBeInstanceOf(HTMLElement)
      activate = hydrate
      return cleanup
    }
    const loader = vi.fn(async () => ({
      default: () => h('p', { id: 'custom-ready' }, 'custom ready'),
    }))
    const Async = useComponent({
      loader,
      hydrate: strategy,
    })
    const container = mountContainer()

    render(h(Async, null), container)
    await flushAsyncComponent()

    expect(loader).not.toHaveBeenCalled()
    expect(cleanup).not.toHaveBeenCalled()

    activate?.()
    await flushAsyncComponent()

    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(loader).toHaveBeenCalledTimes(1)
    expect(container.querySelector('#custom-ready')?.textContent).toBe('custom ready')
  })

  it('runs custom strategy cleanup when an unhydrated component unmounts', async () => {
    const cleanup = vi.fn()
    const strategy: HydrationStrategy = () => cleanup
    const loader = vi.fn(async () => ({
      default: () => h('p', null, 'should not load'),
    }))
    const Async = useComponent({
      loader,
      hydrate: strategy,
    })
    const container = mountContainer()

    render(h(Async, null), container)
    await flushAsyncComponent()
    render(null as any, container)
    await flushAsyncComponent()

    expect(loader).not.toHaveBeenCalled()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })
})
