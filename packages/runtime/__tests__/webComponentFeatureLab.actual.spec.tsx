import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import WebComponentFeatureLab from '../../../app/pages/examples/WebComponentFeatureLab'
import { click, mountContainer, waitForContent } from './page-test-utils'

vi.mock('../../../app/pages/site/SidebarPlaygroundExample', () => ({
  default: (props: { children?: unknown }) => (
    <div data-testid="mock-sidebar-example">{props.children}</div>
  ),
}))

setReactiveScheduling('sync')

const normalize = (value: string | null | undefined) => value?.replace(/\s+/g, ' ').trim() ?? ''

const findButton = (root: ParentNode, label: string) =>
  Array.from(root.querySelectorAll('button')).find(button =>
    normalize(button.textContent).includes(label),
  ) ?? null

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('WebComponentFeatureLab actual page', () => {
  it('runs each custom element feature in its own panel', async () => {
    const container = mountContainer()
    render(<WebComponentFeatureLab />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('Web Components 分项测试')
      expect(container.querySelector('[data-testid="lab-panel-shadow"]')).not.toBeNull()
    })

    await click(findButton(container, '代码'))

    await waitForContent(() => {
      expect(container.textContent).toContain('完整可复制示例')
      expect(container.textContent).toContain('useCustomElement')
      expect(container.textContent).toContain('rue-lab-context-probe')
    })

    await click(findButton(container, '效果'))

    await waitForContent(() => {
      expect(container.querySelector('[data-testid="lab-panel-shadow"]')).not.toBeNull()
    })

    const shadowHost = container.querySelector('rue-lab-shadow-probe') as HTMLElement | null
    await waitForContent(() => {
      expect(shadowHost?.shadowRoot).not.toBeNull()
      expect(
        normalize(
          shadowHost?.shadowRoot?.querySelector('[data-testid="lab-shadow-mode"]')?.textContent,
        ),
      ).toBe('rue-lab-shadow-probe / shadow')
      expect(
        shadowHost?.shadowRoot?.querySelector('style[data-rue-ce-style]')?.getAttribute('nonce'),
      ).toBe('rue-lab-nonce')
    })

    await click(findButton(container, 'Light DOM Props'))

    await waitForContent(() => {
      const lightHost = container.querySelector('rue-lab-light-probe') as HTMLElement | null
      expect(container.querySelector('[data-testid="lab-panel-light"]')).not.toBeNull()
      expect(findButton(container, 'Light DOM Props')?.className).toContain('btn-primary')
      expect(findButton(container, 'Shadow Root')?.className).toContain('btn-ghost')
      expect(lightHost?.shadowRoot).toBeNull()
      expect(lightHost?.querySelector('[data-testid="lab-light-count"]')?.textContent).toBe('3')
    })

    await click(findButton(container, 'Native Slots'))

    await waitForContent(() => {
      const slotHost = container.querySelector('rue-lab-slot-probe') as HTMLElement | null
      const headerNode = slotHost?.querySelector('[data-testid="lab-native-header"]')
      const bodyNode = slotHost?.querySelector('[data-testid="lab-native-body"]')
      const headerSlot = slotHost?.shadowRoot?.querySelector(
        'slot[name="header"]',
      ) as HTMLSlotElement | null
      const defaultSlot = slotHost?.shadowRoot?.querySelector(
        'slot:not([name])',
      ) as HTMLSlotElement | null

      expect(findButton(container, 'Native Slots')?.className).toContain('btn-primary')
      expect(findButton(container, 'Light DOM Props')?.className).toContain('btn-ghost')
      expect(headerSlot?.assignedNodes()).toContain(headerNode)
      expect(defaultSlot?.assignedNodes()).toContain(bodyNode)
    })

    await click(findButton(container, 'Event Bridge'))

    await waitForContent(() => {
      expect(container.querySelector('[data-testid="lab-panel-events"]')).not.toBeNull()
    })

    const eventHost = container.querySelector('rue-lab-event-probe') as HTMLElement | null
    await click(eventHost?.shadowRoot?.querySelector('[data-testid="lab-event-button"]') ?? null)

    await waitForContent(() => {
      expect(
        normalize(container.querySelector('[data-testid="lab-event-log"]')?.textContent),
      ).toContain('confirm')
      expect(
        normalize(container.querySelector('[data-testid="lab-event-log"]')?.textContent),
      ).toContain('custom-element')
    })

    await click(findButton(container, 'Context + Scoped Slot'))

    await waitForContent(() => {
      expect(container.querySelector('[data-testid="lab-context-value"]')?.textContent).toBe(
        'outer:lab',
      )
      expect(container.querySelector('[data-testid="lab-scoped-badge"]')?.textContent).toBe(
        'outer:lab / 3',
      )
    })

    await click(findButton(container, 'channel'))

    await waitForContent(() => {
      expect(container.querySelector('[data-testid="lab-context-value"]')?.textContent).toBe(
        'outer:updated',
      )
      expect(container.querySelector('[data-testid="lab-scoped-badge"]')?.textContent).toBe(
        'outer:updated / 3',
      )
    })
  })
})
