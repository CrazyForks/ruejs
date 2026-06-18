import { afterEach, describe, expect, it } from 'vitest'
import { h } from '@rue-js/rue'
import { render, setReactiveScheduling } from '@rue-js/rue'
import HoverGallery from '../index'
import { mountContainer, waitForContent } from '../../../../../runtime/__tests__/page-test-utils'

setReactiveScheduling('sync')

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('HoverGallery', () => {
  it('renders figure with base class and images', async () => {
    const c = mountContainer()
    resetActiveRuntime()
    render(
      h(HoverGallery, null, [
        h('img', { src: 'a.webp', alt: 'x' }),
        h('img', { src: 'b.webp', alt: 'y' }),
      ]),
      c,
    )

    await waitForContent(() => {
      const fig = c.querySelector('figure.hover-gallery') as HTMLElement
      expect(fig).toBeTruthy()
      expect(fig.classList.contains('hover-gallery')).toBe(true)
      const imgs = fig.querySelectorAll('img')
      expect(imgs.length).toBe(2)
    })
  })

  it('supports div tag via as prop', async () => {
    const c = mountContainer()
    resetActiveRuntime()
    render(h(HoverGallery, { as: 'div' }, h('img', { src: 'a.webp' })), c)

    await waitForContent(() => {
      const el = c.querySelector('div.hover-gallery') as HTMLElement
      expect(el).toBeTruthy()
    })
  })

  it('appends custom className', async () => {
    const c = mountContainer()
    resetActiveRuntime()
    render(h(HoverGallery, { className: 'max-w-60' }, h('img', { src: 'a.webp' })), c)

    await waitForContent(() => {
      const fig = c.querySelector('.hover-gallery') as HTMLElement
      expect(fig.classList.contains('max-w-60')).toBe(true)
    })
  })

  it('renders images from items array of strings', async () => {
    const c = mountContainer()
    resetActiveRuntime()
    render(h(HoverGallery, { items: ['a.webp', 'b.webp', 'c.webp'] }), c)

    await waitForContent(() => {
      const fig = c.querySelector('figure.hover-gallery') as HTMLElement
      expect(fig).toBeTruthy()
      const imgs = fig.querySelectorAll('img')
      expect(imgs.length).toBe(3)
      expect((imgs[0] as HTMLElement).getAttribute('class')).not.toBe('undefined')
    })
  })

  it('renders items from objects and nodes', async () => {
    const c = mountContainer()
    resetActiveRuntime()
    const node = h('img', { src: 'n.webp', alt: 'n' })
    render(
      h(HoverGallery, {
        items: [{ src: 'a.webp', alt: 'a' }, { src: 'b.webp', className: 'rounded' }, { node }],
      }),
      c,
    )

    await waitForContent(() => {
      const fig = c.querySelector('figure.hover-gallery') as HTMLElement
      const imgs = fig.querySelectorAll('img')
      expect(imgs.length).toBe(3)
      expect((imgs[1] as HTMLElement).classList.contains('rounded')).toBe(true)
    })
  })

  it('supports shared image classes and fit presets', async () => {
    const c = mountContainer()
    resetActiveRuntime()

    render(
      h(HoverGallery, {
        fit: 'contain',
        imageClassName: 'rounded-box',
        items: ['a.webp', { src: 'b.webp', className: 'ring-1' }],
      }),
      c,
    )

    await waitForContent(() => {
      const imgs = c.querySelectorAll('figure.hover-gallery img')
      expect(imgs.length).toBe(2)
      expect((imgs[0] as HTMLElement).classList.contains('object-contain')).toBe(true)
      expect((imgs[0] as HTMLElement).classList.contains('rounded-box')).toBe(true)
      expect((imgs[1] as HTMLElement).classList.contains('ring-1')).toBe(true)
    })
  })

  it('renders optional guide overlay with labels', async () => {
    const c = mountContainer()
    resetActiveRuntime()

    render(
      h(HoverGallery, {
        showGuide: true,
        wrapperClassName: 'rounded-box overflow-hidden',
        guideLabels: ['侧面', '背面'],
        items: ['a.webp', { src: 'b.webp', label: '不应覆盖' }, 'c.webp'],
      }),
      c,
    )

    await waitForContent(() => {
      const wrapper = c.querySelector('.rounded-box.overflow-hidden') as HTMLElement
      expect(wrapper).toBeTruthy()
      expect(wrapper.querySelector('figure.hover-gallery')).toBeTruthy()

      const guide = wrapper.querySelector('[aria-hidden="true"]') as HTMLElement
      expect(guide).toBeTruthy()
      expect(guide.textContent).toContain('侧面')
      expect(guide.textContent).toContain('背面')
      expect(guide.style.gridTemplateColumns).toContain('repeat(2')
    })
  })
})
