import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import RatingPage from '../../../app/pages/design/Rating'
import { click, mountContainer, waitForContent } from './page-test-utils'
import { findDemo, findTabButton, resetActiveRuntime } from './design-page-test-utils'

vi.mock('../../../app/pages/site/SidebarPlaygroundDesign', () => ({
  default: (props: { children?: unknown }) => (
    <div data-testid="mock-sidebar-design">{props.children}</div>
  ),
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: () => null,
}))

setReactiveScheduling('sync')

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('Rating actual page', () => {
  it('renders rating demos, updates rating state, and restores preview after code toggle', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(<RatingPage />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('Rating 评分')
      expect(container.querySelectorAll('.component-preview').length).toBe(10)
    })

    const semanticDemo = () => findDemo(container, '# Semantic rating') as HTMLElement | null
    const legacyAdvancedDemo = () => findDemo(container, '# Legacy clear and half') as HTMLElement | null

    expect(semanticDemo()).not.toBeNull()
    expect(legacyAdvancedDemo()).not.toBeNull()

    const fourStar = semanticDemo()!.querySelector('button[data-rating-index="3"]') as HTMLButtonElement
    await click(fourStar)

    await waitForContent(() => {
      expect(semanticDemo()!.textContent).toContain('当前评分：4')
    })

    const clear = legacyAdvancedDemo()!.querySelector('input[aria-label="clear"]') as HTMLInputElement
    clear.checked = true
    clear.dispatchEvent(new Event('change', { bubbles: true }))

    await waitForContent(() => {
      const updatedLegacyDemo = legacyAdvancedDemo() as HTMLElement | null
      expect(updatedLegacyDemo!.textContent).toContain('当前评分：clear')
      expect(updatedLegacyDemo!.querySelectorAll('.rating').length).toBe(2)
      expect(updatedLegacyDemo!.querySelectorAll('.rating')[0]?.querySelectorAll('input[type="radio"]').length).toBe(6)
      expect(updatedLegacyDemo!.querySelectorAll('.rating')[1]?.querySelectorAll('input[type="radio"]').length).toBe(11)
      expect(updatedLegacyDemo!.querySelectorAll('.rating')[1]?.className).toContain('rating-half')
      expect(updatedLegacyDemo!.querySelector('input.mask.mask-star-2')?.className).toContain('opacity-[0.35]')
    })

    await click(findTabButton(legacyAdvancedDemo()!, 'JSX代码'))
    const legacyDemoInCode = legacyAdvancedDemo() as HTMLElement | null
    expect(legacyDemoInCode!.querySelectorAll('input[type="radio"]').length).toBe(0)

    await click(findTabButton(legacyDemoInCode!, '预览'))

    await waitForContent(() => {
      const restored = legacyAdvancedDemo() as HTMLElement | null
      expect(restored!.querySelectorAll('.rating').length).toBe(2)
      expect(restored!.querySelectorAll('.rating')[0]?.querySelectorAll('input[type="radio"]').length).toBe(6)
      expect(restored!.querySelectorAll('.rating')[1]?.querySelectorAll('input[type="radio"]').length).toBe(11)
      expect(restored!.querySelectorAll('.rating')[1]?.className).toContain('rating-half')
      expect(restored!.querySelector('input.mask.mask-star-2')?.className).toContain('opacity-[0.35]')
    })
  })
})
