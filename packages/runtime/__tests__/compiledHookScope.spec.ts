// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'

import * as compiledRuntime from '../src/internal'
import { createContext, useContext } from '../src/context'

afterEach(() => {
  compiledRuntime.setReactiveScheduling('frame')
  document.body.innerHTML = ''
})

describe('compiled hook owner', () => {
  it('caches compiler-assigned hook slots on one owner', () => {
    const owner = compiledRuntime.createOwner()
    let memoRuns = 0
    const first = compiledRuntime.runWithOwner(owner, () => ({
      memo: compiledRuntime._$compiledUseMemo('memo:0', () => ({ run: ++memoRuns })),
      ref: compiledRuntime._$compiledUseRef('ref:1', 'first'),
    }))!
    first.ref.current = 'persisted'
    const second = compiledRuntime.runWithOwner(owner, () => ({
      memo: compiledRuntime._$compiledUseMemo('memo:0', () => ({ run: ++memoRuns })),
      ref: compiledRuntime._$compiledUseRef('ref:1', 'ignored'),
    }))!

    expect(second.memo).toBe(first.memo)
    expect(second.ref).toBe(first.ref)
    expect(second.ref.current).toBe('persisted')
    expect(memoRuns).toBe(1)
    compiledRuntime.disposeOwner(owner)
  })

  it('runs effects and lifecycle from the compiled owner without current-instance state', () => {
    compiledRuntime.setReactiveScheduling('sync')
    const events: string[] = []
    const value = compiledRuntime.signal(0)
    const handle = compiledRuntime._$withCompiledHookScope(() => {
      compiledRuntime.onBeforeMount(() => events.push('before-mount'))
      compiledRuntime.onMounted(() => events.push('mounted'))
      compiledRuntime.onBeforeUnmount(() => events.push('before-unmount'))
      compiledRuntime.onUnmounted(() => events.push('unmounted'))
      compiledRuntime._$compiledUseEffect('effect:0', () => {
        events.push(`effect:${value.get()}`)
        return () => events.push('effect-cleanup')
      })
      return compiledRuntime._$compiledRoot(() => document.createTextNode('owned'))
    })
    const container = document.createElement('main')

    handle.__rue_compiled_mount(container)
    value.set(1)
    handle.dispose()
    handle.dispose()

    expect(events).toEqual([
      'before-mount',
      'mounted',
      'effect:0',
      'effect-cleanup',
      'effect:1',
      'before-unmount',
      'effect-cleanup',
      'unmounted',
    ])
    expect(container.innerHTML).toBe('')
  })

  it('resolves shadowed context values through the compiled owner parent chain', () => {
    const Theme = createContext('fallback')
    const parent = compiledRuntime.createOwner()
    const parentValue = compiledRuntime.runWithOwner(parent, () => {
      Theme.Provider({ value: 'parent' })
      const child = compiledRuntime.createOwner()
      const childValue = compiledRuntime.runWithOwner(child, () => useContext(Theme))
      const shadow = compiledRuntime.createOwner()
      const shadowValue = compiledRuntime.runWithOwner(shadow, () => {
        Theme.Provider({ value: 'shadow' })
        return useContext(Theme)
      })
      return { childValue, shadowValue }
    })

    expect(parentValue).toEqual({ childValue: 'parent', shadowValue: 'shadow' })
    compiledRuntime.disposeOwner(parent)
  })

  it('disposes the owner exactly once when mount throws', () => {
    const events: string[] = []
    const handle = compiledRuntime._$withCompiledHookScope(() => {
      compiledRuntime.onBeforeUnmount(() => events.push('before-unmount'))
      compiledRuntime.onUnmounted(() => events.push('unmounted'))
      return compiledRuntime._$compiledRoot(parent => {
        parent?.appendChild(document.createElement('span'))
        throw new Error('mount failed')
      })
    })
    const container = document.createElement('main')

    expect(() => handle.__rue_compiled_mount(container)).toThrowError('mount failed')
    handle.dispose()
    expect(events).toEqual(['before-unmount', 'unmounted'])
    expect(container.innerHTML).toBe('')
  })
})
