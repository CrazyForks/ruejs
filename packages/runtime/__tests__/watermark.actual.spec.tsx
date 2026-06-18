import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import WatermarkPage from '../../../app/pages/design/Watermark'
import { click, mountContainer, waitForContent } from './page-test-utils'
import { findDemo, resetActiveRuntime } from './design-page-test-utils'

vi.mock('../../../app/pages/site/SidebarPlaygroundDesign', () => ({
  default: (props: { children?: unknown }) => (
    <div data-testid="mock-sidebar-design">{props.children}</div>
  ),
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: () => null,
}))

setReactiveScheduling('sync')

const setEnabledPreviews = (...titles: string[]) => {
  ;(
    globalThis as { __RUE_TEST_ENABLED_DESIGN_PREVIEWS__?: Set<string> }
  ).__RUE_TEST_ENABLED_DESIGN_PREVIEWS__ = new Set(titles)
}

afterEach(() => {
  delete (globalThis as { __RUE_TEST_ENABLED_DESIGN_PREVIEWS__?: Set<string> })
    .__RUE_TEST_ENABLED_DESIGN_PREVIEWS__
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('Watermark actual page', () => {
  it('keeps custom control buttons and range commits responsive', async () => {
    setEnabledPreviews('Custom controls')

    const container = mountContainer()
    resetActiveRuntime()
    render(<WatermarkPage />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('Watermark 水印')
      expect(findDemo(container, '# Custom controls')).not.toBeNull()
    })

    const customDemo = findDemo(container, '# Custom controls') as HTMLElement
    const sparseButton = Array.from(customDemo.querySelectorAll('button')).find(
      button => button.textContent?.trim() === '切换到稀疏模式',
    )

    await click(sparseButton ?? null)

    await waitForContent(() => {
      const updatedDemo = findDemo(container, '# Custom controls') as HTMLElement

      expect(updatedDemo.textContent).toContain('Shared with Partner')
      expect(updatedDemo.textContent).toContain('Rotate -8')
      expect(updatedDemo.textContent).toContain('z-index 10')
    })

    const controlsAfterClick = findDemo(container, '# Custom controls') as HTMLElement
    const rotateInput = controlsAfterClick.querySelector('input[type="range"]') as HTMLInputElement
    rotateInput.value = '35'
    rotateInput.dispatchEvent(new Event('change', { bubbles: true }))

    await waitForContent(() => {
      const updatedDemo = findDemo(container, '# Custom controls') as HTMLElement
      const watermarkRoot = updatedDemo.querySelector(
        '[data-rue-watermark-root="true"]',
      ) as HTMLElement

      expect(updatedDemo.textContent).toContain('Rotate 35')
      expect(watermarkRoot.style.getPropertyValue('--rue-watermark-image')).toContain(
        encodeURIComponent('rotate(35'),
      )
    })
  })
})
