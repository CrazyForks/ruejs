import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import ColorPickerPage from '../../../app/pages/design/ColorPicker'
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

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('ColorPicker actual page', () => {
  it('opens the basic picker popup from the design page', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(<ColorPickerPage />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('ColorPicker 颜色选择器')
      expect(findDemo(container, '# 基础受控模式')).not.toBeNull()
    })

    const basicDemo = findDemo(container, '# 基础受控模式') as HTMLElement | null
    expect(basicDemo).not.toBeNull()

    let triggerTarget: HTMLElement | null = null
    let popupHostId = ''

    await waitForContent(() => {
      const previewHost = basicDemo!.querySelector('.space-y-4.not-prose') as HTMLElement | null
      const picker = previewHost?.firstElementChild as HTMLElement | null

      expect(previewHost).not.toBeNull()
      expect(picker).not.toBeNull()

      triggerTarget = (picker?.querySelector('*') as HTMLElement | null) ?? picker
      expect(triggerTarget).not.toBeNull()
      popupHostId = triggerTarget?.getAttribute('aria-controls') || ''
      expect(popupHostId).not.toBe('')
      const popupHost = document.body.querySelector(`#${popupHostId}`) as HTMLElement | null
      expect(popupHost).not.toBeNull()
      expect(popupHost?.hidden).toBe(true)
      expect(popupHost?.getAttribute('aria-hidden')).toBe('true')
      expect(popupHost?.querySelectorAll('input[type="text"]').length ?? 0).toBeGreaterThan(0)
    })

    await click(triggerTarget)

    await waitForContent(() => {
      const popupHost = document.body.querySelector(`#${popupHostId}`) as HTMLElement | null
      const popupInput = popupHost?.querySelector('input[type="text"]') as HTMLInputElement | null

      expect(popupHost).not.toBeNull()
      expect(popupHost?.hidden).toBe(false)
      expect(popupHost?.getAttribute('aria-hidden')).toBe('false')
      expect(popupInput).not.toBeNull()
      expect(popupInput?.value).toContain('#1677ff')
    })
  })
})
