import { afterEach, describe, expect, it, vi } from 'vitest'

import { render, setReactiveScheduling } from '../src'
import TransitionMode from '../../../app/pages/examples/TransitionMode'
import { flush, mountContainer } from './page-test-utils'

vi.mock('../../../app/pages/site/SidebarPlaygroundExample', () => ({
  default: (props: { children?: unknown }) => (
    <div data-testid="mock-sidebar-example">{props.children}</div>
  ),
}))

vi.mock('../../../app/pages/site/components/Code', () => ({
  default: () => null,
}))

setReactiveScheduling('sync')

const findButton = (root: ParentNode, label: string) =>
  Array.from(root.querySelectorAll('button')).find(
    button => button.textContent?.trim() === label,
  ) as HTMLButtonElement | undefined

const click = (button: HTMLButtonElement | undefined) => {
  expect(button).toBeTruthy()
  button?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe.each(['default', 'out-in', 'in-out'] as const)('TransitionMode actual page (%s)', mode => {
  it('removes interrupted panels after rapid navigation settles', async () => {
    vi.useFakeTimers()
    const container = mountContainer()
    ;(globalThis as any).__rue_active = (globalThis as any).__rue
    render(<TransitionMode />, container)

    click(findButton(container, mode))
    click(findButton(container, 'Next panel'))
    click(findButton(container, 'Next panel'))
    click(findButton(container, 'Previous'))
    await flush()

    await vi.advanceTimersByTimeAsync(2_000)
    await flush()

    const cards = Array.from(container.querySelectorAll<HTMLElement>('.mode-card'))
    expect(cards).toHaveLength(1)
    expect(cards[0].textContent).toContain('Review')
    expect(cards[0].className).not.toMatch(/mode-(?:enter|leave|appear)-(?:from|active|to)/)
  })
})
