import { afterEach, describe, expect, it, vi } from 'vitest'

import { attachRouter, createRouter, RouterView } from '@rue-js/router'

import { h, render, setReactiveScheduling, useComponent } from '../src'
import { createStaticHistory, flush, mountContainer, waitForContent } from './page-test-utils'

vi.mock('../../../app/pages/site/SidebarPlaygroundExample', () => ({
  default: (props: { children?: unknown }) => (
    <div data-testid="mock-sidebar-playground">{props.children}</div>
  ),
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: () => null,
}))

setReactiveScheduling('sync')

const normalizeText = (value: string | null | undefined) => value?.replace(/\s+/g, ' ').trim() ?? ''

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

const expectVisibleTexts = (container: HTMLElement, texts: string[]) => {
  const content = normalizeText(container.textContent)

  for (const text of texts) {
    expect(content).toContain(text)
  }
}

const expectMissingTexts = (container: HTMLElement, texts: string[]) => {
  const content = normalizeText(container.textContent)

  for (const text of texts) {
    expect(content).not.toContain(text)
  }
}

afterEach(() => {
  document.body.innerHTML = ''
  if (typeof localStorage?.clear === 'function') {
    localStorage.clear()
  }
  resetActiveRuntime()
})

export const clickByText = async (root: ParentNode, label: string) => {
  const button = Array.from(root.querySelectorAll('button')).find(
    current => current.textContent?.trim() === label,
  ) as HTMLButtonElement | undefined

  expect(button).toBeTruthy()
  button?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  await flush()
}

export const inputValueAt = async (root: ParentNode, index: number, value: string) => {
  const fields = Array.from(
    root.querySelectorAll('input:not([type="checkbox"]), textarea'),
  ) as Array<HTMLInputElement | HTMLTextAreaElement>
  const field = fields[index]

  expect(field).toBeTruthy()
  field.value = value
  field.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
  await flush()
}

export const setCheckboxAt = async (root: ParentNode, index: number, checked: boolean) => {
  const checkboxes = Array.from(
    root.querySelectorAll('input[type="checkbox"]'),
  ) as HTMLInputElement[]
  const checkbox = checkboxes[index]

  expect(checkbox).toBeTruthy()
  checkbox.checked = checked
  checkbox.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }))
  await flush()
}

type SplitHomeExampleSpecOptions = {
  name: string
  route: string
  importPage: () => Promise<{ default: any }>
  expectedTexts: string[]
  interaction?: (container: HTMLElement) => Promise<void> | void
  interactionExpectedTexts?: string[]
  absentAfterInteraction?: string[]
}

export const defineSplitHomeExampleActualSpec = (options: SplitHomeExampleSpecOptions) => {
  describe(`${options.name} actual page`, () => {
    it('renders directly', async () => {
      resetActiveRuntime()
      const { default: Page } = await options.importPage()
      const container = mountContainer()

      render(h(Page as any, null), container)

      await waitForContent(() => {
        expectVisibleTexts(container, options.expectedTexts)
      })
    })

    it('renders through RouterView when lazy-loaded', async () => {
      resetActiveRuntime()
      const Empty = () => null
      const AsyncPage = useComponent(options.importPage as any)
      const router = createRouter({
        history: createStaticHistory(options.route),
        routes: [
          { path: '/', component: Empty as any },
          { path: options.route, component: AsyncPage as any },
        ],
      })
      attachRouter(router)

      const container = mountContainer()

      render(<RouterView />, container)
      await waitForContent(() => {
        expectVisibleTexts(container, options.expectedTexts)
      })
    })

    const interaction = options.interaction

    if (interaction) {
      it('handles the primary demo interaction', async () => {
        resetActiveRuntime()
        const { default: Page } = await options.importPage()
        const container = mountContainer()

        render(h(Page as any, null), container)
        await waitForContent(() => {
          expectVisibleTexts(container, options.expectedTexts)
        })

        await interaction(container)

        await waitForContent(() => {
          expectVisibleTexts(container, options.interactionExpectedTexts ?? options.expectedTexts)
          expectMissingTexts(container, options.absentAfterInteraction ?? [])
        })
      })
    }
  })
}
