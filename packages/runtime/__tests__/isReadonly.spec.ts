/**
 * isReadonly API 测试。
 *
 * 覆盖 readonly/shallowReadonly、propsReactive 与只读 computed 的判定边界。
 */
import { describe, expect, it } from 'vitest'

import {
  computed,
  isReadonly,
  reactive,
  readonly,
  ref,
  shallowReadonly,
  propsReactive,
} from '@rue-js/rue'

describe('isReadonly api', () => {
  it('detects readonly and shallowReadonly proxies', () => {
    const state = reactive({ nested: { count: 1 } })
    const ro = readonly({ nested: { count: 1 } })
    const shallow = shallowReadonly({ nested: { count: 1 } })

    expect(isReadonly(state)).toBe(false)
    expect(isReadonly(ro)).toBe(true)
    expect(isReadonly(ro.nested)).toBe(true)
    expect(isReadonly(shallow)).toBe(true)
    expect(isReadonly(shallow.nested)).toBe(false)
  })

  it('detects readonly props wrappers and computed handles', () => {
    const source = ref(1)
    const derived = computed(() => source.value + 1)
    const writable = computed({
      get: () => source.value,
      set: value => {
        source.value = value
      },
    })

    expect(isReadonly(propsReactive({ value: 1 }, true))).toBe(true)
    expect(isReadonly(derived)).toBe(true)
    expect(isReadonly(writable)).toBe(false)
    expect(isReadonly(source)).toBe(false)
    expect(isReadonly(null)).toBe(false)
    expect(isReadonly(1)).toBe(false)
  })
})
