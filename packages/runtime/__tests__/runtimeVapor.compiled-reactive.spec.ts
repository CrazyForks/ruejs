// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'

import {
  batch,
  createOwner,
  createSelector,
  disposeOwner,
  effect,
  onCleanup,
  runWithOwner,
  setReactiveScheduling,
  signal,
  untrack,
  type CompiledOwner,
} from '../../runtime-vapor/dist/compiled.js'

const owners: CompiledOwner[] = []

const owned = (): CompiledOwner => {
  const owner = createOwner()
  owners.push(owner)
  return owner
}

const flushCompiledEffects = async (): Promise<void> => {
  const waitForScheduler = (): Promise<void> =>
    typeof requestAnimationFrame === 'function'
      ? new Promise(resolve => requestAnimationFrame(() => resolve()))
      : Promise.resolve()

  await waitForScheduler()
  await waitForScheduler()
  await waitForScheduler()
}

afterEach(() => {
  setReactiveScheduling('frame')
  for (const owner of owners.splice(0)) disposeOwner(owner)
})

describe('@rue-js/runtime-vapor compiled reactivity', () => {
  it('can select synchronous scheduling without the Vapor runtime', () => {
    setReactiveScheduling('sync')
    const source = signal(0)
    const seen: number[] = []
    const handle = effect(() => seen.push(source.get()))

    source.set(1)

    expect(seen).toEqual([0, 1])
    handle.dispose()
  })

  it('runs one compiled graph with owned cleanup', async () => {
    const source = signal(0)
    const owner = owned()
    const seen: number[] = []
    let cleanupCount = 0
    let ownerCleanupCount = 0

    expect(
      runWithOwner(owner, () => {
        onCleanup(() => {
          ownerCleanupCount += 1
        })
        effect(() => {
          seen.push(source.get())
          onCleanup(() => {
            cleanupCount += 1
          })
        })
        return 'owned'
      }),
    ).toBe('owned')
    expect(seen).toEqual([0])

    batch(() => {
      source.set(1)
      source.set(2)
    })
    await flushCompiledEffects()

    expect(untrack(() => source.get())).toBe(2)
    expect(seen).toEqual([0, 2])
    expect(cleanupCount).toBe(1)

    expect(disposeOwner(owner)).toBe(true)
    expect(disposeOwner(owner)).toBe(false)
    expect(cleanupCount).toBe(2)
    expect(ownerCleanupCount).toBe(1)

    source.set(3)
    await flushCompiledEffects()
    expect(seen).toEqual([0, 2])
    expect(cleanupCount).toBe(2)
    expect(ownerCleanupCount).toBe(1)
  })

  it('keeps nested owner cleanup out of the surrounding effect rerun', () => {
    setReactiveScheduling('sync')
    const source = signal(0)
    const root = owned()
    const row = owned()
    let cleanupCount = 0
    let registered = false

    runWithOwner(root, () => {
      effect(() => {
        source.get()
        if (!registered) {
          registered = true
          runWithOwner(row, () => onCleanup(() => (cleanupCount += 1)))
        }
      })
    })

    source.set(1)
    expect(cleanupCount).toBe(0)
    expect(disposeOwner(row)).toBe(true)
    expect(cleanupCount).toBe(1)
  })

  it('disposes multiple child owners and effects once in registration order', () => {
    const root = owned()
    const events: string[] = []
    let firstChild!: CompiledOwner
    let secondChild!: CompiledOwner

    runWithOwner(root, () => {
      onCleanup(() => events.push('root owner'))
      effect(() => onCleanup(() => events.push('root effect 1')))
      effect(() => onCleanup(() => events.push('root effect 2')))

      firstChild = owned()
      runWithOwner(firstChild, () => {
        onCleanup(() => events.push('first owner'))
        effect(() => onCleanup(() => events.push('first effect 1')))
        effect(() => onCleanup(() => events.push('first effect 2')))
      })

      secondChild = owned()
      runWithOwner(secondChild, () => {
        onCleanup(() => events.push('second owner'))
        effect(() => onCleanup(() => events.push('second effect 1')))
        effect(() => onCleanup(() => events.push('second effect 2')))
      })
    })

    expect(disposeOwner(root)).toBe(true)
    expect(events).toEqual([
      'first effect 1',
      'first effect 2',
      'first owner',
      'second effect 1',
      'second effect 2',
      'second owner',
      'root effect 1',
      'root effect 2',
      'root owner',
    ])
    expect(disposeOwner(firstChild)).toBe(false)
    expect(disposeOwner(secondChild)).toBe(false)
    expect(disposeOwner(root)).toBe(false)
    expect(events).toHaveLength(9)
  })

  it('pre-clears owner cleanups before propagating a cleanup error', () => {
    const owner = owned()
    const events: string[] = []
    const cleanupError = new Error('cleanup failed')

    runWithOwner(owner, () => {
      onCleanup(() => events.push('before error'))
      onCleanup(() => {
        events.push('throws')
        throw cleanupError
      })
    })

    expect(() => disposeOwner(owner)).toThrow(cleanupError)
    expect(events).toEqual(['before error', 'throws'])
    expect(disposeOwner(owner)).toBe(false)
    expect(events).toEqual(['before error', 'throws'])
  })

  it('notifies only previous and next selector keys', async () => {
    const selected = signal('A')
    const owner = owned()
    const runs = new Map<string, number>()
    const values = new Map<string, boolean>()

    runWithOwner(owner, () => {
      const isSelected = createSelector(() => selected.get())
      for (const key of ['A', 'B', 'C']) {
        effect(() => {
          runs.set(key, (runs.get(key) ?? 0) + 1)
          values.set(key, isSelected(key))
        })
      }
    })

    expect(Object.fromEntries(runs)).toEqual({ A: 1, B: 1, C: 1 })
    expect(Object.fromEntries(values)).toEqual({ A: true, B: false, C: false })

    selected.set('B')
    await flushCompiledEffects()

    expect(Object.fromEntries(runs)).toEqual({ A: 2, B: 2, C: 1 })
    expect(Object.fromEntries(values)).toEqual({ A: false, B: true, C: false })

    selected.set('C')
    await flushCompiledEffects()

    expect(Object.fromEntries(runs)).toEqual({ A: 2, B: 3, C: 2 })
    expect(Object.fromEntries(values)).toEqual({ A: false, B: false, C: true })
  })
})
