/**
 * isProxy API 测试。
 *
 * 确认 reactive/readonly 系列代理返回 true，ref 与普通值不被误判为代理。
 */
import { afterEach, describe, expect, it } from 'vitest'

import {
  isProxy,
  ref,
  reactive,
  readonly,
  setReactiveScheduling,
  shallowReactive,
  shallowReadonly,
} from '@rue-js/rue'

afterEach(() => {
  setReactiveScheduling('microtask')
})

describe('isProxy api', () => {
  it('detects Rue reactive and readonly proxies', () => {
    setReactiveScheduling('sync')

    expect(isProxy(reactive({ count: 1 }))).toBe(true)
    expect(isProxy(shallowReactive({ count: 1 }))).toBe(true)
    expect(isProxy(readonly({ count: 1 }))).toBe(true)
    expect(isProxy(shallowReadonly({ count: 1 }))).toBe(true)
  })

  it('returns false for plain values', () => {
    expect(isProxy({ count: 1 })).toBe(false)
    expect(isProxy(ref(1))).toBe(false)
    expect(isProxy(null)).toBe(false)
    expect(isProxy(1)).toBe(false)
  })
})
