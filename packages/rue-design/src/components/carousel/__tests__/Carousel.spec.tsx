import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, render, setReactiveScheduling } from '@rue-js/rue'
import { Carousel } from '@rue-js/design'
import { click, mountContainer, waitForContent } from '../../../../../runtime/__tests__/page-test-utils'

setReactiveScheduling('sync')

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Carousel', () => {
  it('renders with base class', async () => {
    const c = mountContainer()
    resetActiveRuntime()

    render(h(Carousel, null, 'hello'), c)

    await waitForContent(() => {
      const el = c.querySelector('.carousel') as HTMLElement
      expect(el).toBeTruthy()
      expect(el.classList.contains('carousel')).toBe(true)
      expect(el.textContent).toContain('hello')
    })
  })

  it('applies align, direction and custom classes, and renders Item subcomponent', async () => {
    const c = mountContainer()
    resetActiveRuntime()

    render(
      h(
        Carousel,
        { align: 'end', direction: 'vertical', className: 'rounded-box w-64' },
        h(Carousel.Item, null, h('img', { src: 'x', alt: 'y' })),
        h(Carousel.Item, null, h('img', { src: 'x2', alt: 'y2' })),
      ),
      c,
    )

    await waitForContent(() => {
      const el = c.querySelector('.carousel') as HTMLElement
      expect(el.classList.contains('carousel-end')).toBe(true)
      expect(el.classList.contains('carousel-vertical')).toBe(true)
      expect(el.classList.contains('rounded-box')).toBe(true)
      expect(el.classList.contains('w-64')).toBe(true)
      const items = c.querySelectorAll('.carousel-item')
      expect(items.length).toBe(2)
    })
  })

  it('supports initial activeIndex prop', async () => {
    const c = mountContainer()
    resetActiveRuntime()

    render(
      <Carousel
        items={[
          { content: h('div', { className: 'h-24 w-full bg-base-200' }, '1') },
          { content: h('div', { className: 'h-24 w-full bg-base-200' }, '2') },
          { content: h('div', { className: 'h-24 w-full bg-base-200' }, '3') },
        ]}
        activeIndex={2}
        dots
        speed={0}
      />,
      c,
    )

    await waitForContent(() => {
      const root = c.querySelector('.carousel') as HTMLElement
      expect(root.getAttribute('data-rue-carousel-current')).toBe('2')
      const activeDot = c.querySelector('[aria-current="true"]') as HTMLElement
      expect(activeDot.getAttribute('aria-label')).toBe('Go to slide 3')
    })
  })

  it('supports arrows and dots in uncontrolled mode', async () => {
    const c = mountContainer()
    resetActiveRuntime()

    const spy = vi.fn()
    const items = [
      { content: h('div', { className: 'h-24 w-full bg-base-200' }, '1') },
      { content: h('div', { className: 'h-24 w-full bg-base-200' }, '2') },
      { content: h('div', { className: 'h-24 w-full bg-base-200' }, '3') },
    ]

    render(h(Carousel, { items, arrows: true, dots: true, speed: 0, onIndexChange: spy }, null), c)

    await waitForContent(() => {
      expect(c.querySelector('.carousel')).toBeTruthy()
      expect(c.querySelectorAll('.carousel-item').length).toBe(3)
      expect(c.querySelector('[aria-current="true"]')).toBeTruthy()
    })

    await click(c.querySelector('[aria-label="Next slide"]'))

    await waitForContent(() => {
      expect(spy).toHaveBeenCalledWith(1)
      const activeDot = c.querySelector('[aria-current="true"]') as HTMLElement
      expect(activeDot).toBeTruthy()
      expect(activeDot.getAttribute('aria-label')).toBe('Go to slide 2')
    })
  })

  it('renders from items array and exposes ref methods', async () => {
    const c = mountContainer()
    resetActiveRuntime()

    const carouselRef: { current?: any } = { current: undefined }
    const items = [
      { content: h('div', { id: 's1' }, '1') },
      { content: h('div', { id: 's2' }, '2'), className: 'w-full' },
      { content: h('img', { src: 'x', alt: 'y' }) },
    ]

    render(
      h(Carousel, { items, align: 'center', direction: 'horizontal', dots: true, speed: 0, apiRef: carouselRef }),
      c,
    )

    await waitForContent(() => {
      const wrapper = c.querySelector('.carousel') as HTMLElement
      expect(wrapper.classList.contains('carousel-center')).toBe(true)
      expect(wrapper.classList.contains('carousel-horizontal')).toBe(true)
      const els = c.querySelectorAll('.carousel-item')
      expect(els.length).toBe(3)
      expect((els[1] as HTMLElement).classList.contains('w-full')).toBe(true)
      expect(typeof carouselRef.current?.goTo).toBe('function')
      expect(typeof carouselRef.current?.next).toBe('function')
      expect(typeof carouselRef.current?.prev).toBe('function')
    })

    carouselRef.current.goTo(2, true)

    await waitForContent(() => {
      const activeDot = c.querySelector('[aria-current="true"]') as HTMLElement
      expect(activeDot.getAttribute('aria-label')).toBe('Go to slide 3')
    })
  })
})
