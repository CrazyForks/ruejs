import { describe, expect, it, vi } from 'vitest'

import { nextTick, render, setReactiveScheduling, signal, type FC } from '../src'

describe('onRenderTriggered gating', () => {
  it('skips the shared debug bridge when no hook is registered', async () => {
    setReactiveScheduling('sync')
    const count = signal(0)

    const Demo: FC = () => (
      <button type="button" onClick={() => count.set(count.peek() + 1)}>
        {count.get()}
      </button>
    )

    const container = document.createElement('div')
    render(<Demo />, container)

    const button = container.querySelector('button') as HTMLButtonElement
    expect(button.textContent).toBe('0')

    const bridge = (globalThis as any).__rue_compiled_runtime_bridge
    const dispatch = vi.spyOn(bridge, 'dispatchRenderTriggeredForEffect')

    button.click()
    await nextTick()

    expect(button.textContent).toBe('1')
    expect(dispatch).not.toHaveBeenCalled()
  })
})
