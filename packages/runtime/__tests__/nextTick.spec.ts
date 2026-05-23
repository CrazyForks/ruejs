import { afterEach, describe, expect, it } from 'vitest'

import { nextTick, setReactiveScheduling, signal, watchEffect } from '../src'

afterEach(() => {
  document.body.innerHTML = ''
  setReactiveScheduling('microtask')
})

describe('nextTick', () => {
  it('waits for merged microtask updates before resolving callbacks', async () => {
    setReactiveScheduling('microtask')

    const count = signal(0, {}, true)
    const container = document.createElement('div')
    document.body.appendChild(container)

    watchEffect(() => {
      container.textContent = String(count.get())
    })

    expect(container.textContent).toBe('0')

    count.set(1)
    count.set(2)

    expect(container.textContent).toBe('0')

    const content = await nextTick(() => container.textContent)

    expect(container.textContent).toBe('2')
    expect(content).toBe('2')
  })

  it('returns a resolved Promise when there is no pending flush', async () => {
    setReactiveScheduling('microtask')

    const order: string[] = []

    order.push('before')
    await nextTick(() => {
      order.push('callback')
      return 'done'
    })
    order.push('after')

    expect(order).toEqual(['before', 'callback', 'after'])
  })
})
