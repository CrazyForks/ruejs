/**
 * watchPostEffect 测试。
 *
 * 验证 post effect 在普通响应式 effect 更新 DOM 之后运行。
 */
import { afterEach, describe, expect, it } from 'vitest'

import { nextTick, setReactiveScheduling, signal, watchEffect, watchPostEffect } from '../src'

afterEach(() => {
  document.body.innerHTML = ''
  setReactiveScheduling('microtask')
})

describe('watchPostEffect', () => {
  it('runs after regular reactive effects have updated DOM', async () => {
    setReactiveScheduling('microtask')

    const count = signal(0, {}, true)
    const container = document.createElement('div')
    const seen: string[] = []
    document.body.appendChild(container)

    watchPostEffect(() => {
      count.get()
      seen.push(container.textContent ?? '')
    })

    watchEffect(() => {
      container.textContent = String(count.get())
    })

    expect(seen).toEqual([])

    await nextTick()

    expect(seen).toEqual(['0'])

    count.set(1)
    count.set(2)

    expect(container.textContent).toBe('0')

    await nextTick()

    expect(container.textContent).toBe('2')
    expect(seen).toEqual(['0', '2'])
  })
})
