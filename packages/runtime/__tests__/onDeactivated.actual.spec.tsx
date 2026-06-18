import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import OnDeactivated from '../../../app/pages/examples/OnDeactivated'
import { click, flush, mountContainer, waitForContent } from './page-test-utils'

vi.mock('../../../app/pages/site/SidebarPlaygroundExample', () => ({
  default: (props: { children?: unknown }) => (
    <div data-testid="mock-sidebar-example">{props.children}</div>
  ),
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: () => null,
}))

setReactiveScheduling('sync')

const mountedContainers = new Set<HTMLElement>()

const resetActiveRuntime = () => {
  ;(globalThis as any).__rue_active = (globalThis as any).__rue
}

const findButton = (root: ParentNode, label: string) =>
  Array.from(root.querySelectorAll('button')).find(
    button => button.textContent?.trim() === label,
  ) ?? null

const waitForButton = async (root: ParentNode, label: string) => {
  let button: Element | null = null
  await waitForContent(() => {
    button = findButton(root, label)
    expect(button).not.toBeNull()
  })
  return button
}

const waitForTextarea = async (root: ParentNode): Promise<HTMLTextAreaElement> => {
  let textarea: HTMLTextAreaElement | null = null
  await waitForContent(() => {
    textarea = root.querySelector('textarea.textarea') as HTMLTextAreaElement | null
    expect(textarea).not.toBeNull()
  })
  if (!textarea) {
    throw new Error('Expected editor textarea to exist')
  }
  return textarea
}

afterEach(() => {
  mountedContainers.forEach(container => {
    render(null as any, container)
  })
  mountedContainers.clear()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('OnDeactivated actual page', () => {
  it('keeps cached panel state and writes deactivated logs while switching panels', async () => {
    const container = mountContainer()
    mountedContainers.add(container)
    resetActiveRuntime()
    render(<OnDeactivated />, container)

    await waitForContent(() => {
      expect(container.textContent).toContain('onDeactivated()')
      expect(container.textContent).toContain('EditorPanel')
    })

    const textarea = await waitForTextarea(container)
    textarea.value = 'KeepAlive keeps this draft'
    textarea.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
    await flush()

    await click(await waitForButton(container, '计数器'))

    await waitForContent(() => {
      expect(container.textContent).toContain('CounterPanel')
      expect(container.textContent).toContain('EditorPanel deactivated')
      expect(container.querySelector('textarea.textarea')).toBeNull()
    })

    await click(await waitForButton(container, '增加'))
    await waitForContent(() => {
      expect(container.textContent).toContain('1')
    })

    await click(await waitForButton(container, '编辑器'))

    await waitForContent(() => {
      const restoredTextarea = container.querySelector(
        'textarea.textarea',
      ) as HTMLTextAreaElement | null
      expect(restoredTextarea?.value).toBe('KeepAlive keeps this draft')
      expect(container.textContent).toContain('CounterPanel deactivated: count = 1')
    })

    await click(await waitForButton(container, '计数器'))

    await waitForContent(() => {
      expect(container.textContent).toContain('CounterPanel')
      expect(container.textContent).toContain('1')
    })
  })
})
