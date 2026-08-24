/**
 * effectScope 运行时测试。
 *
 * 覆盖手动创建 scope、父子 scope 关联与 detached scope 的停止语义。
 */
import { afterEach, describe, expect, it } from 'vitest'

import {
  computed,
  effectScope,
  getCurrentScope,
  onScopeDispose,
  setReactiveScheduling,
  signal,
  watchEffect,
} from '../src'
import type { EffectScope } from '../src'
import { __rueGetEffectScopeDebugState } from '@rue-js/runtime-vapor/reactive'

afterEach(() => {
  setReactiveScheduling('microtask')
})

describe('effectScope', () => {
  it('captures effects created during run and stops them together', () => {
    setReactiveScheduling('sync')

    const count = signal(0, {}, true)
    const seen: number[] = []
    let cleanupCount = 0

    const scope = effectScope()
    const runResult = scope.run(() => {
      expect(getCurrentScope()).toBe(scope)

      const doubled = computed(() => count.get() * 2)
      watchEffect(() => {
        seen.push(doubled.get())
      })
      onScopeDispose(() => {
        cleanupCount += 1
      })

      return 'ok'
    })

    expect(runResult).toBe('ok')
    expect(scope.active).toBe(true)
    expect(seen).toEqual([0])

    count.set(1)
    expect(seen).toEqual([0, 2])

    scope.stop()
    expect(scope.active).toBe(false)
    expect(cleanupCount).toBe(1)

    count.set(2)
    expect(seen).toEqual([0, 2])
    expect(scope.run(() => 'ignored')).toBeUndefined()

    scope.stop()
    expect(cleanupCount).toBe(1)
  })

  it('stops non-detached child scopes when the parent stops', () => {
    setReactiveScheduling('sync')

    const count = signal(0, {}, true)
    const seen: number[] = []
    const parent = effectScope()
    let child: EffectScope | undefined

    parent.run(() => {
      child = effectScope()
      child.run(() => {
        watchEffect(() => {
          seen.push(count.get())
        })
      })
    })

    expect(seen).toEqual([0])

    count.set(1)
    expect(seen).toEqual([0, 1])

    parent.stop()
    expect(parent.active).toBe(false)
    expect(child?.active).toBe(false)

    count.set(2)
    expect(seen).toEqual([0, 1])
  })

  it('keeps detached child scopes alive after the parent stops', () => {
    setReactiveScheduling('sync')

    const count = signal(0, {}, true)
    const seen: number[] = []
    const parent = effectScope()
    let child: EffectScope | undefined

    parent.run(() => {
      child = effectScope(true)
      child.run(() => {
        watchEffect(() => {
          seen.push(count.get())
        })
      })
    })

    expect(seen).toEqual([0])

    parent.stop()
    expect(parent.active).toBe(false)
    expect(child?.active).toBe(true)

    count.set(1)
    expect(seen).toEqual([0, 1])

    child?.stop()
    expect(child?.active).toBe(false)

    count.set(2)
    expect(seen).toEqual([0, 1])
  })

  it('keeps stopped state on each handle without retaining stopped scope ids', () => {
    const baseline = __rueGetEffectScopeDebugState()
    const stopped: EffectScope[] = []

    for (let index = 0; index < 100; index += 1) {
      const scope = effectScope(true)
      scope.stop()
      stopped.push(scope)
    }

    expect(stopped.every(scope => scope.active === false)).toBe(true)
    expect(__rueGetEffectScopeDebugState()).toEqual(baseline)
  })
})
