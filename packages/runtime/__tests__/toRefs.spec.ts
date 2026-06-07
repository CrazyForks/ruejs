/**
 * toRefs API 测试。
 *
 * 确认对象和数组属性转换后的 ref 与源响应式结构保持同步。
 */
import { afterEach, describe, expect, it } from 'vitest'

import { reactive, setReactiveScheduling, toRef, toRefs, watchEffect } from '@rue-js/rue'

afterEach(() => {
  setReactiveScheduling('microtask')
})

describe('toRefs api', () => {
  it('creates refs that stay linked with source object properties', () => {
    const state = reactive({ count: 1, name: 'Rue' })
    const refs = toRefs(state)

    expect(refs.count.value).toBe(1)
    expect(refs.name.value).toBe('Rue')

    state.count = 2
    expect(refs.count.value).toBe(2)

    refs.name.value = 'Vapor'
    expect(state.name).toBe('Vapor')
  })

  it('tracks property refs through the original reactive object', () => {
    setReactiveScheduling('sync')

    const state = reactive({ count: 1 })
    const { count } = toRefs(state)
    const seen: number[] = []
    const effect = watchEffect(() => {
      seen.push(count.value)
    })

    state.count = 2
    count.value = 3

    expect(seen).toEqual([1, 2, 3])

    effect.dispose()
  })

  it('preserves array shape for reactive arrays', () => {
    const state = reactive([1, 2])
    const refs = toRefs(state)

    expect(Array.isArray(refs)).toBe(true)
    expect(refs).toHaveLength(2)

    refs[0].value = 5
    expect(state[0]).toBe(5)
  })

  it('creates a single property ref with toRef', () => {
    const state = reactive({ ready: false })
    const ready = toRef(state, 'ready')

    ready.value = true
    expect(state.ready).toBe(true)
  })
})
