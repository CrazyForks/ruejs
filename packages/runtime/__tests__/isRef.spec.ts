/**
 * isRef API 测试。
 *
 * 验证 ref/shallowRef/computed/toRef 被识别为 ref，普通对象和 reactive 对象不会误判。
 */
import { describe, expect, it } from 'vitest'

import { computed, isRef, reactive, ref, shallowRef, toRef } from '@rue-js/rue'

describe('isRef api', () => {
  it('detects Rue ref-style values', () => {
    const count = ref(1)
    const shallow = shallowRef({ count: 1 })
    const doubled = computed(() => count.value * 2)
    const state = reactive({ count: 1 })
    const stateCount = toRef(state, 'count')

    expect(isRef(count)).toBe(true)
    expect(isRef(shallow)).toBe(true)
    expect(isRef(doubled)).toBe(true)
    expect(isRef(stateCount)).toBe(true)
  })

  it('does not treat plain values or reactive objects as refs', () => {
    expect(isRef(1)).toBe(false)
    expect(isRef(null)).toBe(false)
    expect(isRef({ value: 1 })).toBe(false)
    expect(isRef(reactive({ value: 1 }))).toBe(false)
  })
})
