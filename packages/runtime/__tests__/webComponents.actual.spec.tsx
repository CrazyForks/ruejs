import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import WebComponents from '../../../app/pages/examples/WebComponents'
import { click, mountContainer, waitForContent } from './page-test-utils'

vi.mock('../../../app/pages/site/SidebarPlaygroundExample', () => ({
  default: (props: { children?: unknown }) => (
    <div data-testid="mock-sidebar-example">{props.children}</div>
  ),
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: () => null,
}))

setReactiveScheduling('sync')

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

const findTab = (root: ParentNode, label: string) =>
  Array.from(root.querySelectorAll('button[role="tab"]')).find(
    button => button.textContent?.trim() === label,
  ) ?? null

const normalize = (value: string | null | undefined) => value?.replace(/\s+/g, ' ').trim() ?? ''

const findDefaultSlotNode = (host: HTMLElement | null) =>
  Array.from(host?.children ?? []).find(child => !child.hasAttribute('slot')) ?? null

const findEventLogText = (root: ParentNode) => {
  const heading = Array.from(root.querySelectorAll('h3')).find(
    node => normalize(node.textContent) === '事件桥接日志',
  )
  return normalize(heading?.closest('.card-body')?.textContent)
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('WebComponents actual page', () => {
  it('renders shadow and light custom elements, projects slots, and bridges emitted events', async () => {
    const container = mountContainer()
    resetActiveRuntime()
    render(<WebComponents />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('原生 Web Components')
      expect(findTab(container, '效果')?.className).toContain('tab-active')
      expect(container.querySelector('rue-shadow-console')).not.toBeNull()
      expect(container.querySelector('rue-light-signal')).not.toBeNull()
    })

    const shadowHost = container.querySelector('rue-shadow-console') as HTMLElement | null
    const lightHost = container.querySelector('rue-light-signal') as HTMLElement | null

    await waitForContent(() => {
      const namedSlot = shadowHost?.shadowRoot?.querySelector('slot[name="meta"]') as
        | HTMLSlotElement
        | null
      const defaultSlot = shadowHost?.shadowRoot?.querySelector('slot:not([name])') as
        | HTMLSlotElement
        | null
      const namedNode = shadowHost?.querySelector('[slot="meta"]')
      const defaultNode = findDefaultSlotNode(shadowHost)

      expect(shadowHost?.shadowRoot).not.toBeNull()
      expect(shadowHost?.shadowRoot?.querySelectorAll('style[data-rue-ce-style]')).toHaveLength(2)
      expect(
        shadowHost?.shadowRoot?.querySelector('style[data-rue-ce-style]')?.getAttribute('nonce'),
      ).toBe('rue-demo-nonce')
      expect(lightHost?.querySelectorAll('style[data-rue-ce-style]')).toHaveLength(1)
      expect(normalize(shadowHost?.shadowRoot?.querySelector('.title')?.textContent)).toBe(
        'Ops Console / Native CE',
      )
      expect(normalize(lightHost?.textContent)).toContain('0 events / 4 tags')
      expect(namedSlot).not.toBeNull()
      expect(defaultSlot).not.toBeNull()
      expect(namedSlot?.assignedNodes()).toContain(namedNode)
      expect(defaultSlot?.assignedNodes()).toContain(defaultNode)
    })

    await click(shadowHost?.shadowRoot?.querySelector('button.button.primary'))

    await waitForContent(() => {
      const logText = findEventLogText(container)
      expect(logText).toContain('shadow')
      expect(logText).toContain('save')
      expect(logText).toContain('panelTitle')
      expect(logText).toContain('Ops Console / Native CE')
      expect(logText).toContain('rootMode')
      expect(normalize(lightHost?.textContent)).toContain('1 events / 4 tags')
    })

    await click(lightHost?.querySelector('button.lightButton'))

    await waitForContent(() => {
      const logText = findEventLogText(container)
      expect(logText).toContain('light')
      expect(logText).toContain('light-tap')
      expect(normalize(lightHost?.textContent)).toContain('2 events / 4 tags')
    })

    await click(findTab(container, '代码'))

    expect(container.className).not.toContain('hidden')
    expect(container.querySelector('rue-shadow-console')).not.toBeNull()
  })
})