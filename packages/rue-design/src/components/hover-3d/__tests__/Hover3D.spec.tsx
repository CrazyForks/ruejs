import { afterEach, describe, expect, it } from 'vitest'
import { h } from '@rue-js/rue'
import { render } from '@rue-js/rue'
import Hover3D from '..'

const waitHover3DRender = () => new Promise(resolve => setTimeout(resolve, 0))

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Hover3D', () => {
  it('renders with base class and overlays', async () => {
    const c = document.createElement('div')
    render(h(Hover3D, null, h('figure', null, h('img', { src: 'x', alt: 'y' }))), c)
    await waitHover3DRender()
    const el = c.querySelector('.hover-3d') as HTMLElement
    expect(el).toBeTruthy()
    expect(el.classList.contains('hover-3d')).toBe(true)
    const overlayDivs = el.querySelectorAll(':scope > [data-hover3d-overlay]')
    expect(overlayDivs.length).toBe(8)
  })

  it('renders anchor root from href and fills safe rel defaults', async () => {
    const c = document.createElement('div')
    render(h(Hover3D, { href: '/docs', target: '_blank', className: 'cursor-pointer' }, 'content'), c)
    await waitHover3DRender()
    const el = c.querySelector('a.hover-3d') as HTMLAnchorElement
    expect(el).toBeTruthy()
    expect(el.getAttribute('href')).toBe('/docs')
    expect(el.getAttribute('target')).toBe('_blank')
    expect(el.getAttribute('rel')).toBe('noreferrer')
    expect(el.classList.contains('cursor-pointer')).toBe(true)
  })

  it('supports surface wrapper and root prop passthrough', async () => {
    const c = document.createElement('div')
    render(
      h(
        Hover3D,
        {
          id: 'hover-root',
          'data-tone': 'tilt',
          surfaceAs: 'figure',
          surfaceClassName: 'rounded-2xl',
          surfaceProps: {
            id: 'hover-surface',
            'data-role': 'surface',
          },
        },
        h('img', { src: 'x', alt: 'wrapped surface' }),
      ),
      c,
    )
    await waitHover3DRender()
    const root = c.querySelector('#hover-root.hover-3d') as HTMLElement
    expect(root).toBeTruthy()
    expect(root.getAttribute('data-tone')).toBe('tilt')
    expect(root.children.length).toBe(9)

    const surface = root.querySelector(':scope > figure[data-hover3d-surface]') as HTMLElement
    expect(surface).toBeTruthy()
    expect(surface.id).toBe('hover-surface')
    expect(surface.getAttribute('data-role')).toBe('surface')
    expect(surface.classList.contains('rounded-2xl')).toBe(true)
  })

  it('applies overlay class names to generated hover zones', async () => {
    const c = document.createElement('div')
    render(h(Hover3D, { overlayClassName: 'overlay-zone' }, 'content'), c)
    await waitHover3DRender()
    const el = c.querySelector('.hover-3d') as HTMLElement
    const overlayDivs = Array.from(el.querySelectorAll(':scope > [data-hover3d-overlay]')) as HTMLElement[]
    expect(overlayDivs.length).toBe(8)
    overlayDivs.forEach(overlay => {
      expect(overlay.classList.contains('overlay-zone')).toBe(true)
    })
  })

  it('can disable overlays', async () => {
    const c = document.createElement('div')
    render(h(Hover3D, { overlays: false }, 'content'), c)
    await waitHover3DRender()
    const el = c.querySelector('.hover-3d') as HTMLElement
    const overlayDivs = el.querySelectorAll(':scope > [data-hover3d-overlay]')
    expect(overlayDivs.length).toBe(0)
  })
})
