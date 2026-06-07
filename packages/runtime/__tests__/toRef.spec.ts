/**
 * toRef API 测试。
 *
 * 覆盖对象属性 ref、缺省值、getter 规范化、普通值规范化和 toRefs 批量转换。
 */
import { afterEach, describe, expect, it } from 'vitest'

import {
  isRef,
  reactive,
  ref,
  setReactiveScheduling,
  toRef,
  toRefs,
  watchEffect,
} from '@rue-js/rue'

afterEach(() => {
  document.body.innerHTML = ''
  setReactiveScheduling('microtask')
})

describe('toRef api', () => {
  it('creates a ref synced with a reactive object property', () => {
    setReactiveScheduling('sync')

    const state = reactive({ count: 1 })
    const count = toRef(state, 'count')
    const seen: number[] = []
    const effect = watchEffect(() => {
      seen.push(count.value)
    })

    expect(isRef(count)).toBe(true)
    expect(count.value).toBe(1)
    expect(seen).toEqual([1])

    state.count = 2
    expect(count.value).toBe(2)
    expect(seen).toEqual([1, 2])

    count.value = 3
    expect(state.count).toBe(3)
    expect(seen).toEqual([1, 2, 3])

    effect.dispose()
  })

  it('uses a default value for missing properties and writes through', () => {
    const state = reactive<{ label?: string }>({})
    const label = toRef(state, 'label', 'draft')

    expect(label.value).toBe('draft')

    label.value = 'ready'

    expect(state.label).toBe('ready')
    expect(label.value).toBe('ready')
  })

  it('returns an existing ref stored on the source object', () => {
    const existing = ref(1)
    const state = reactive({ existing })

    expect(toRef(state, 'existing')).toBe(existing)
    expect(toRef(existing)).toBe(existing)
  })

  it('normalizes a getter to a readonly reactive ref', () => {
    setReactiveScheduling('sync')

    const source = ref(2)
    const doubled = toRef(() => source.value * 2)
    const seen: number[] = []
    const effect = watchEffect(() => {
      seen.push(doubled.value)
    })

    expect(isRef(doubled)).toBe(true)
    expect(seen).toEqual([4])

    source.value = 3

    expect(doubled.value).toBe(6)
    expect(seen).toEqual([4, 6])

    effect.dispose()
  })

  it('normalizes a plain value to an independent ref', () => {
    const count = toRef(1)

    expect(isRef(count)).toBe(true)
    expect(count.value).toBe(1)

    count.value = 2

    expect(count.value).toBe(2)
  })

  it('converts enumerable object properties with toRefs', () => {
    const state = reactive({ count: 1, name: 'Rue' })
    const refs = toRefs(state)

    refs.count.value = 2
    state.name = 'Vapor'

    expect(state.count).toBe(2)
    expect(refs.name.value).toBe('Vapor')
  })
})
