import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, setReactiveScheduling } from '@rue-js/rue'
import Masonry from '..'
import { mountContainer, waitForContent } from '../../../../../runtime/__tests__/page-test-utils'

setReactiveScheduling('sync')

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

const initialViewportWidth = window.innerWidth

const setViewportWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  })
  window.dispatchEvent(new Event('resize'))
}

class ResizeObserverMock {
  callback: ResizeObserverCallback
  element?: Element
  static instances: ResizeObserverMock[] = []

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    ResizeObserverMock.instances.push(this)
  }

  observe = vi.fn((element: Element) => {
    this.element = element
  })

  disconnect = vi.fn()

  trigger() {
    this.callback(
      [
        {
          target: this.element!,
          contentRect:
            (this.element as HTMLElement)?.getBoundingClientRect?.() ?? DOMRect.fromRect(),
        } as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver,
    )
  }
}

afterEach(() => {
  document.body.innerHTML = ''
  setViewportWidth(initialViewportWidth)
  vi.restoreAllMocks()
  ResizeObserverMock.instances = []
})

describe('Masonry', () => {
  it('renders the base masonry container and wraps children with item shells', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <Masonry
        columns={3}
        columnGap={20}
        rowGap={12}
        className="rounded-box"
        data-testid="masonry-root"
      >
        <div>A</div>
        <div>B</div>
      </Masonry>,
      container,
    )

    await waitForContent(() => {
      const root = container.querySelector('[data-testid="masonry-root"]') as HTMLElement
      const items = container.querySelectorAll('[data-rue-masonry-item]')

      expect(root.classList.contains('rue-masonry')).toBe(true)
      expect(root.classList.contains('rounded-box')).toBe(true)
      expect(root.getAttribute('data-rue-masonry-columns')).toBe('3')
      expect(root.getAttribute('style')).toContain('column-count:3')
      expect(root.getAttribute('style')).toContain('column-gap:20px')
      expect(root.style.getPropertyValue('--rue-masonry-row-gap')).toBe('12px')
      expect(items).toHaveLength(2)
      expect((items[0] as HTMLElement).style.width).toBe('100%')
      expect(container.textContent).toContain('A')
      expect(container.textContent).toContain('B')
    })
  })

  it('supports items and renderItem data mode', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <Masonry
        items={[
          { id: 'a', title: 'North star', description: 'Fast path' },
          { id: 'b', title: 'Queue depth', description: 'Background sync' },
        ]}
        itemKey="id"
        renderItem={item => (
          <article className="card border border-base-300 bg-base-100 p-4">
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </article>
        )}
      />,
      container,
    )

    await waitForContent(() => {
      const items = container.querySelectorAll('[data-rue-masonry-item]')
      expect(items).toHaveLength(2)
      expect(container.textContent).toContain('North star')
      expect(container.textContent).toContain('Queue depth')
    })
  })

  it('derives column count from minColumnWidth and updates after resize observer notifications', async () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock as unknown as typeof ResizeObserver)

    const container = mountContainer()
    resetActiveRuntime()

    render(
      <Masonry minColumnWidth={220} maxColumns={4} gap={20} data-testid="masonry-auto">
        <div>Alpha</div>
        <div>Beta</div>
        <div>Gamma</div>
      </Masonry>,
      container,
    )

    await waitForContent(() => {
      const root = container.querySelector('[data-testid="masonry-auto"]') as HTMLElement
      expect(root).toBeTruthy()
    })

    const root = container.querySelector('[data-testid="masonry-auto"]') as HTMLElement
    Object.defineProperty(root, 'clientWidth', {
      configurable: true,
      value: 720,
    })
    ResizeObserverMock.instances[0]?.trigger()

    await waitForContent(() => {
      expect(root.getAttribute('data-rue-masonry-columns')).toBe('3')
    })

    Object.defineProperty(root, 'clientWidth', {
      configurable: true,
      value: 1100,
    })
    ResizeObserverMock.instances[0]?.trigger()

    await waitForContent(() => {
      expect(root.getAttribute('data-rue-masonry-columns')).toBe('4')
    })
  })

  it('updates responsive columns after viewport resize', async () => {
    setViewportWidth(480)

    const container = mountContainer()
    resetActiveRuntime()

    render(
      <Masonry columns={{ xs: 1, md: 3 }} data-testid="masonry-responsive">
        <div>One</div>
        <div>Two</div>
      </Masonry>,
      container,
    )

    await waitForContent(() => {
      const root = container.querySelector('[data-testid="masonry-responsive"]') as HTMLElement
      expect(root.getAttribute('data-rue-masonry-columns')).toBe('1')
    })

    setViewportWidth(960)

    await waitForContent(() => {
      const root = container.querySelector('[data-testid="masonry-responsive"]') as HTMLElement
      expect(root.getAttribute('data-rue-masonry-columns')).toBe('3')
    })
  })
})
