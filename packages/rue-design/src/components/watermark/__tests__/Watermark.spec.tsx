import { afterEach, describe, expect, it } from 'vitest'
import { render, setReactiveScheduling } from '@rue-js/rue'
import { mountContainer, waitForContent } from '../../../../../runtime/__tests__/page-test-utils'
import Watermark from '../index'

setReactiveScheduling('sync')

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Watermark', () => {
  it('renders root, overlay and children with local text watermark', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <Watermark content="Rue Design" className="rounded-box" data-testid="watermark-root">
        <div className="content-shell">content</div>
      </Watermark>,
      container,
    )

    await waitForContent(() => {
      const root = container.querySelector('[data-testid="watermark-root"]') as HTMLElement
      const overlay = root.querySelector('[data-rue-watermark-overlay="true"]') as HTMLElement
      const content = root.querySelector('.content-shell') as HTMLElement

      expect(root.classList.contains('rue-watermark')).toBe(true)
      expect(root.classList.contains('rounded-box')).toBe(true)
      expect(root.style.position).toBe('relative')
      expect(root.style.overflow).toBe('hidden')
      expect(overlay).toBeTruthy()
      expect(overlay.style.backgroundImage).toContain('data:image/svg+xml')
      expect(content.textContent).toContain('content')
    })
  })

  it('maps gap, offset and zIndex into repeat overlay styles', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <Watermark
        content={['Top Secret', 'Rue Lab']}
        width={100}
        height={40}
        gap={[120, 80]}
        offset={[90, 60]}
        zIndex={15}
        data-testid="watermark-root"
      >
        <div>panel</div>
      </Watermark>,
      container,
    )

    await waitForContent(() => {
      const root = container.querySelector('[data-testid="watermark-root"]') as HTMLElement
      const overlay = root.querySelector('[data-rue-watermark-overlay="true"]') as HTMLElement

      expect(root.style.getPropertyValue('--rue-watermark-size')).toBe('220px 120px')
      expect(root.style.getPropertyValue('--rue-watermark-left')).toBe('30px')
      expect(root.style.getPropertyValue('--rue-watermark-top')).toBe('20px')
      expect(root.style.getPropertyValue('--rue-watermark-z-index')).toBe('15')
      expect(overlay.style.left).toBe('30px')
      expect(overlay.style.top).toBe('20px')
      expect(overlay.style.width).toBe('calc(100% - 30px)')
      expect(overlay.style.height).toBe('calc(100% - 20px)')
      expect(overlay.style.backgroundPosition).toBe('0px 0px')
      expect(overlay.style.zIndex).toBe('15')
    })
  })

  it('uses a light fallback text color on dark backgrounds when font.color is omitted', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <Watermark
        content="Rue Design"
        style={{ backgroundColor: '#0f172a' }}
        data-testid="watermark-root"
      >
        <div>panel</div>
      </Watermark>,
      container,
    )

    await waitForContent(() => {
      const root = container.querySelector('[data-testid="watermark-root"]') as HTMLElement
      const overlay = root.querySelector('[data-rue-watermark-overlay="true"]') as HTMLElement

      expect(root.style.backgroundColor).toBe('rgb(15, 23, 42)')
      expect(overlay.style.backgroundImage).toContain(
        encodeURIComponent('rgba(248, 250, 252, 0.28)'),
      )
    })
  })

  it('detects dark DaisyUI-style oklch backgrounds for the fallback text color', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <Watermark
        content="Rue Design"
        style={{ backgroundColor: 'oklch(22% 0.04 265)' }}
        data-testid="watermark-root"
      >
        <div>panel</div>
      </Watermark>,
      container,
    )

    await waitForContent(() => {
      const root = container.querySelector('[data-testid="watermark-root"]') as HTMLElement
      const overlay = root.querySelector('[data-rue-watermark-overlay="true"]') as HTMLElement

      expect(root.style.backgroundColor).toBe('oklch(0.22 0.04 265)')
      expect(overlay.style.backgroundImage).toContain(
        encodeURIComponent('rgba(248, 250, 252, 0.28)'),
      )
    })
  })

  it('supports image watermark source and inherited nested watermark', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <Watermark
        image="https://example.com/watermark.svg"
        width={96}
        height={36}
        data-testid="parent-watermark"
      >
        <Watermark data-testid="child-watermark">
          <div>nested</div>
        </Watermark>
      </Watermark>,
      container,
    )

    await waitForContent(() => {
      const parent = container.querySelector('[data-testid="parent-watermark"]') as HTMLElement
      const child = container.querySelector('[data-testid="child-watermark"]') as HTMLElement
      const childOverlay = child.querySelector('[data-rue-watermark-overlay="true"]') as HTMLElement

      expect(parent.style.getPropertyValue('--rue-watermark-image')).toContain('data:image/svg+xml')
      expect(parent.style.getPropertyValue('--rue-watermark-size')).toBe('196px 136px')
      expect(childOverlay.style.backgroundImage).toBe('var(--rue-watermark-image, none)')
      expect(childOverlay.style.backgroundSize).toBe('var(--rue-watermark-size, auto)')
    })
  })

  it('can stop inheriting parent watermark variables', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <Watermark content="Rue Parent" data-testid="parent-watermark">
        <Watermark inherit={false} data-testid="child-watermark">
          <div>child</div>
        </Watermark>
      </Watermark>,
      container,
    )

    await waitForContent(() => {
      const child = container.querySelector('[data-testid="child-watermark"]') as HTMLElement
      const childOverlay = child.querySelector('[data-rue-watermark-overlay="true"]') as HTMLElement

      expect(child.style.getPropertyValue('--rue-watermark-image')).toBe('none')
      expect(childOverlay.style.backgroundImage).toBe('none')
      expect(childOverlay.style.zIndex).toBe('0')
    })
  })
})
