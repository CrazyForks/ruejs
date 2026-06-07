import { afterEach, describe, expect, it } from 'vitest'

import { nextTick, setReactiveScheduling, signal, watchEffect, watchPostEffect } from '../src'

/** 等待 nextTick 与 post effect 队列完全清空，避免断言抢在二级 microtask 前执行。 */
const flushPostEffects = async () => {
  await nextTick()
  await Promise.resolve()
  await Promise.resolve()
}

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

  it('runs watchPostEffect after normal effects and coalesces updates', async () => {
    setReactiveScheduling('microtask')

    const count = signal(0, {}, true)
    const order: string[] = []

    watchEffect(() => {
      order.push(`render:${count.get()}`)
    })

    watchPostEffect(() => {
      order.push(`post:${count.get()}`)
    })

    expect(order).toEqual(['render:0'])

    await flushPostEffects()

    expect(order).toEqual(['render:0', 'post:0'])

    count.set(1)
    count.set(2)

    expect(order).toEqual(['render:0', 'post:0'])

    await flushPostEffects()

    expect(order).toEqual(['render:0', 'post:0', 'render:2', 'post:2'])
  })

  it('defers watchPostEffect even when reactive scheduling is sync', async () => {
    setReactiveScheduling('sync')

    const count = signal(0, {}, true)
    const order: string[] = []

    watchEffect(() => {
      order.push(`render:${count.get()}`)
    })

    watchPostEffect(() => {
      order.push(`post:${count.get()}`)
    })

    expect(order).toEqual(['render:0'])

    await flushPostEffects()

    count.set(1)

    expect(order).toEqual(['render:0', 'post:0', 'render:1'])

    await flushPostEffects()

    expect(order).toEqual(['render:0', 'post:0', 'render:1', 'post:1'])
  })
})
