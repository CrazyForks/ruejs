import { afterEach, describe, expect, it } from 'vitest'
import { render, setReactiveScheduling } from '@rue-js/rue'
import { Space } from '@rue-js/design'
import { mountContainer, waitForContent } from '../../../../../runtime/__tests__/page-test-utils'

setReactiveScheduling('sync')

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Space', () => {
  it('renders a horizontal space container with preset gap', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <Space className="custom-space" data-testid="space-root">
        <button className="btn">One</button>
        <button className="btn">Two</button>
      </Space>,
      container,
    )

    await waitForContent(() => {
      const element = container.querySelector('[data-testid="space-root"]') as HTMLElement
      expect(element.classList.contains('rue-space')).toBe(true)
      expect(element.classList.contains('custom-space')).toBe(true)
      expect(element.style.columnGap).toBe('var(--rue-theme-space-sm, 8px)')
      expect(element.style.alignItems).toBe('center')
      expect(element.children.length).toBe(2)
    })
  })

  it('supports vertical orientation, tuple gap and wrapping', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <Space vertical size={[24, 12]} wrap data-testid="space-vertical">
        <span>Alpha</span>
        <span>Beta</span>
      </Space>,
      container,
    )

    await waitForContent(() => {
      const element = container.querySelector('[data-testid="space-vertical"]') as HTMLElement
      expect(element.style.flexDirection).toBe('column')
      expect(element.style.columnGap).toBe('24px')
      expect(element.style.rowGap).toBe('12px')
      expect(element.style.flexWrap).toBe('wrap')
      expect(element.getAttribute('aria-orientation')).toBe('vertical')
    })
  })

  it('renders separators between items', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <Space separator="/" data-testid="space-separator">
        <span>Docs</span>
        <span>API</span>
        <span>Theme</span>
      </Space>,
      container,
    )

    await waitForContent(() => {
      const root = container.querySelector('[data-testid="space-separator"]') as HTMLElement
      expect(root.textContent).toContain('Docs')
      expect(root.textContent).toContain('Theme')
      expect(container.querySelectorAll('.rue-space-separator').length).toBe(2)
    })
  })

  it('supports custom tags and block layout', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(<Space as="section" block id="space-block" data-testid="space-block" />, container)

    await waitForContent(() => {
      const element = container.querySelector('[data-testid="space-block"]') as HTMLElement
      expect(element.tagName.toLowerCase()).toBe('section')
      expect(element.id).toBe('space-block')
      expect(element.style.display).toBe('flex')
      expect(element.style.width).toBe('100%')
    })
  })
})

describe('Space.Compact', () => {
  it('merges adjacent child radii in horizontal groups', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <Space.Compact data-testid="compact-root">
        <button className="btn">Left</button>
        <button className="btn">Middle</button>
        <button className="btn">Right</button>
      </Space.Compact>,
      container,
    )

    await waitForContent(() => {
      const root = container.querySelector('[data-testid="compact-root"]') as HTMLElement
      const items = root.querySelectorAll('[data-rue-space-compact-item]')
      expect(root.getAttribute('aria-orientation')).toBe('horizontal')
      expect(items[0].className).toContain('rounded-r-none')
      expect(items[1].className).toContain('rounded-l-none')
      expect(items[1].className).toContain('rounded-r-none')
      expect(items[2].className).toContain('rounded-l-none')
    })
  })

  it('supports vertical block groups and compact wrappers', async () => {
    const container = mountContainer()
    resetActiveRuntime()

    render(
      <Space.Compact vertical block size="small" data-testid="compact-vertical">
        <input className="input" value="Search" />
        <button className="btn">Run</button>
      </Space.Compact>,
      container,
    )

    await waitForContent(() => {
      const root = container.querySelector('[data-testid="compact-vertical"]') as HTMLElement
      const items = root.querySelectorAll('[data-rue-space-compact-item]')
      expect(root.style.flexDirection).toBe('column')
      expect(root.style.width).toBe('100%')
      expect(items[0].className).toContain('w-full')
      expect(items[1].className).toContain('w-full')
      expect((items[0] as HTMLElement).style.fontSize).toBe('0.875rem')
    })
  })
})
