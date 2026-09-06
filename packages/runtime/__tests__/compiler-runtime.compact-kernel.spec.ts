import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  _$compiledSetup,
  __rueGetCompiledReactiveDebugState,
  adoptOwner,
  batch,
  createOwner,
  createSelector,
  disposeOwner,
  effect,
  getCurrentOwner,
  getOwnerParent,
  isDisposingOwnerTree,
  onCleanup,
  onOwnerCleanup,
  registerOwnerLifecycle,
  runOwnerLifecycle,
  runOwnerLifecycleTree,
  runWithOwner,
  setReactiveScheduling,
  signal,
} from '../src/runtime-core/compiled'

afterEach(() => {
  setReactiveScheduling('frame')
  vi.useRealTimers()
})

describe('compact compiler reactive kernel', () => {
  it('finishes owner-tree disposal after lifecycle, effect and owner cleanup errors', () => {
    const baseline = __rueGetCompiledReactiveDebugState()
    const owner = createOwner()
    const events: string[] = []
    runWithOwner(owner, () => {
      registerOwnerLifecycle('beforeUnmount', () => {
        throw new Error('before')
      })
      registerOwnerLifecycle('beforeUnmount', () => events.push('before'))
      const child = createOwner()
      runWithOwner(child, () => {
        effect(() => () => {
          throw new Error('effect')
        })
        onOwnerCleanup(() => {
          throw new Error('child')
        })
        onOwnerCleanup(() => events.push('child'))
      })
      onOwnerCleanup(() => events.push('parent'))
      registerOwnerLifecycle('unmounted', () => {
        throw new Error('unmounted')
      })
      registerOwnerLifecycle('unmounted', () => events.push('unmounted'))
    })
    expect(() => disposeOwner(owner)).toThrow(AggregateError)
    expect(events).toEqual(['before', 'child', 'parent', 'unmounted'])
    expect(disposeOwner(owner)).toBe(false)
    expect(__rueGetCompiledReactiveDebugState()).toEqual(baseline)
  })

  it('updates signals synchronously and deduplicates batched effects', () => {
    setReactiveScheduling('sync')
    const count = signal(0)
    const values: number[] = []

    effect(() => values.push(count.get()))
    batch(() => {
      count.set(1)
      count.set(2)
      count.update(value => value + 1)
    })

    expect(values).toEqual([0, 3])
  })

  it('adopts child owners and disposes their effects and owner cleanups with the parent', () => {
    setReactiveScheduling('sync')
    const source = signal(0)
    const events: string[] = []
    const parent = createOwner()
    const child = createOwner()

    expect(getCurrentOwner()).toBeUndefined()
    expect(getOwnerParent(child)).toBeUndefined()
    adoptOwner(child, parent)
    expect(getOwnerParent(child)).toBe(parent)

    runWithOwner(child, () => {
      expect(getCurrentOwner()).toBe(child)
      onOwnerCleanup(() => events.push('owner-cleanup'))
      effect(() => {
        source.get()
        onCleanup(() => events.push('effect-cleanup'))
      })
    })

    source.set(1)
    expect(events).toEqual(['effect-cleanup'])
    expect(disposeOwner(parent)).toBe(true)
    expect(events).toEqual(['effect-cleanup', 'effect-cleanup', 'owner-cleanup'])
    source.set(2)
    expect(events).toHaveLength(3)
  })

  it('runs owner lifecycle callbacks and brackets recursive disposal', () => {
    const events: string[] = []
    const parent = createOwner()
    let child!: ReturnType<typeof createOwner>

    runWithOwner(parent, () => {
      registerOwnerLifecycle('mounted', () => events.push('parent:mounted'))
      registerOwnerLifecycle('deactivated', () => events.push('parent:deactivated'))
      registerOwnerLifecycle('beforeUnmount', () =>
        events.push(`parent:before:${isDisposingOwnerTree()}`),
      )
      registerOwnerLifecycle('unmounted', () =>
        events.push(`parent:after:${isDisposingOwnerTree()}`),
      )
      child = createOwner()
      runWithOwner(child, () => {
        registerOwnerLifecycle('deactivated', () => events.push('child:deactivated'))
        registerOwnerLifecycle('beforeUnmount', () =>
          events.push(`child:before:${isDisposingOwnerTree()}`),
        )
        registerOwnerLifecycle('unmounted', () =>
          events.push(`child:after:${isDisposingOwnerTree()}`),
        )
      })
    })

    runOwnerLifecycle(parent, 'mounted')
    runOwnerLifecycleTree(parent, 'deactivated')
    disposeOwner(parent)

    expect(events).toEqual([
      'parent:mounted',
      'parent:deactivated',
      'child:deactivated',
      'parent:before:true',
      'child:before:true',
      'child:after:true',
      'parent:after:true',
    ])
    expect(isDisposingOwnerTree()).toBe(false)
  })

  it('invalidates only the previous and next selector keys', () => {
    setReactiveScheduling('sync')
    const selected = signal('a')
    const owner = createOwner()
    const runs = { a: 0, b: 0, c: 0 }

    runWithOwner(owner, () => {
      const isSelected = createSelector(() => selected.get())
      for (const key of ['a', 'b', 'c'] as const) {
        effect(() => {
          runs[key] += 1
          isSelected(key)
        })
      }
    })

    selected.set('b')
    expect(runs).toEqual({ a: 2, b: 2, c: 1 })
    disposeOwner(owner)
  })

  it('caches setup values once per owner and stable region id', () => {
    const first = createOwner()
    const second = createOwner()
    let calls = 0
    const setup = () => _$compiledSetup('row', () => ++calls)

    expect(runWithOwner(first, setup)).toBe(1)
    expect(runWithOwner(first, setup)).toBe(1)
    expect(runWithOwner(second, setup)).toBe(2)
    expect(setup()).toBe(3)

    disposeOwner(first)
    disposeOwner(second)
  })

  it('does not collect setup-only reads into an enclosing effect', () => {
    setReactiveScheduling('sync')
    const source = signal(0)
    const owner = createOwner()
    let runs = 0

    runWithOwner(owner, () => {
      effect(() => {
        runs += 1
        _$compiledSetup('stable', () => source.get())
      })
    })

    source.set(1)
    expect(runs).toBe(1)
    disposeOwner(owner)
  })
})
