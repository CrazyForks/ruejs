/**
 * watchPostEffect 测试。
 *
 * 验证 post effect 在普通响应式 effect 更新 DOM 之后运行。
 */
import { afterEach, describe, expect, it } from 'vitest'

import {
  computed,
  nextTick,
  setReactiveScheduling,
  signal,
  watch,
  watchEffect,
  watchPostEffect,
  watchSyncEffect,
} from '../src'

afterEach(() => {
  document.body.innerHTML = ''
  setReactiveScheduling('microtask')
})

describe('watchPostEffect', () => {
  it('tracks computed refs through the public watch wrapper', () => {
    setReactiveScheduling('sync')
    const source = signal(1, {}, true)
    const doubled = computed(() => source.get() * 2)
    const seen: number[] = []

    watch(
      doubled,
      value => {
        seen.push(value)
      },
      { immediate: true },
    )

    source.set(2)

    expect(seen).toEqual([2, 4])
  })

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

  it('supports watchEffect flush post', async () => {
    setReactiveScheduling('microtask')

    const count = signal(0, {}, true)
    const container = document.createElement('div')
    const seen: string[] = []
    document.body.appendChild(container)

    watchEffect(
      () => {
        count.get()
        seen.push(container.textContent ?? '')
      },
      { flush: 'post' },
    )

    watchEffect(() => {
      container.textContent = String(count.get())
    })

    expect(seen).toEqual([])

    await nextTick()

    expect(seen).toEqual(['0'])

    count.set(1)
    count.set(2)

    expect(container.textContent).toBe('0')
    expect(seen).toEqual(['0'])

    await nextTick()

    expect(container.textContent).toBe('2')
    expect(seen).toEqual(['0', '2'])
  })

  it('supports watch flush post', async () => {
    setReactiveScheduling('microtask')

    const count = signal(0, {}, true)
    const container = document.createElement('div')
    const seen: string[] = []
    document.body.appendChild(container)

    watchEffect(() => {
      container.textContent = String(count.get())
    })

    watch(
      count,
      value => {
        seen.push(`${value}:${container.textContent ?? ''}`)
      },
      { flush: 'post' },
    )

    count.set(1)
    count.set(2)

    expect(container.textContent).toBe('0')
    expect(seen).toEqual([])

    await nextTick()

    expect(container.textContent).toBe('2')
    expect(seen).toEqual(['2:2'])
  })

  it('supports watchEffect flush sync and watchSyncEffect alias', async () => {
    setReactiveScheduling('microtask')

    const count = signal(0, {}, true)
    const effectSeen: number[] = []
    const aliasSeen: number[] = []

    watchEffect(
      () => {
        effectSeen.push(count.get())
      },
      { flush: 'sync' },
    )

    watchSyncEffect(() => {
      aliasSeen.push(count.get())
    })

    expect(effectSeen).toEqual([0])
    expect(aliasSeen).toEqual([0])

    count.set(1)
    count.set(2)

    expect(effectSeen).toEqual([0, 1, 2])
    expect(aliasSeen).toEqual([0, 1, 2])

    await nextTick()

    expect(effectSeen).toEqual([0, 1, 2])
    expect(aliasSeen).toEqual([0, 1, 2])
  })

  it('supports watch flush sync', async () => {
    setReactiveScheduling('microtask')

    const count = signal(0, {}, true)
    const seen: number[] = []

    watch(
      count,
      value => {
        seen.push(value)
      },
      { flush: 'sync' },
    )

    count.set(1)
    count.set(2)

    expect(seen).toEqual([1, 2])

    await nextTick()

    expect(seen).toEqual([1, 2])
  })
})
