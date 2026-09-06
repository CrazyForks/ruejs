import { beforeAll, describe, expect, it, vi } from 'vitest'

const scopeCreation = vi.hoisted(() => ({ detached: [] as boolean[] }))

vi.mock('../src/runtime-core/reactive', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/runtime-core/reactive')>()
  return {
    ...actual,
    effectScope(detached = false) {
      scopeCreation.detached.push(detached)
      return actual.effectScope(detached)
    },
  }
})

let compiledRuntime: typeof import('../src/reactive-core')

beforeAll(async () => {
  vi.resetModules()
  compiledRuntime = await import('../src/reactive-core')
})

describe('full compiled owner retention', () => {
  it('keeps every compiled owner scope detached from the reactive scope cleanup chain', () => {
    scopeCreation.detached.length = 0
    const { createOwner, disposeOwner, onOwnerCleanup, runWithOwner } = compiledRuntime
    const parent = createOwner()

    for (let cycle = 0; cycle < 20; cycle += 1) {
      const rows = runWithOwner(parent, () =>
        Array.from({ length: 100 }, () => {
          const row = createOwner()
          runWithOwner(row, () => onOwnerCleanup(() => {}))
          return row
        }),
      )!
      for (const row of rows) expect(disposeOwner(row)).toBe(true)
    }

    expect(scopeCreation.detached).toHaveLength(2_001)
    expect(scopeCreation.detached.every(Boolean)).toBe(true)
    expect(disposeOwner(parent)).toBe(true)
  })

  it('disposes reused rows once even after repeated disposal', () => {
    const { createOwner, disposeOwner, onOwnerCleanup, runWithOwner } = compiledRuntime
    const parent = createOwner()
    let cleanups = 0
    const row = runWithOwner(parent, () => {
      const owner = createOwner()
      runWithOwner(owner, () => onOwnerCleanup(() => cleanups++))
      return owner
    })!

    expect(disposeOwner(row)).toBe(true)
    expect(disposeOwner(row)).toBe(false)
    expect(cleanups).toBe(1)
    expect(disposeOwner(parent)).toBe(true)
    expect(cleanups).toBe(1)
  })

  it('continues releasing sibling rows when one cleanup throws', () => {
    const { createOwner, disposeOwner, onOwnerCleanup, runWithOwner } = compiledRuntime
    const parent = createOwner()
    let released = 0
    runWithOwner(parent, () => {
      const failing = createOwner()
      runWithOwner(failing, () =>
        onOwnerCleanup(() => {
          throw new Error('row cleanup failed')
        }),
      )
      const sibling = createOwner()
      runWithOwner(sibling, () => onOwnerCleanup(() => released++))
    })

    expect(disposeOwner(parent)).toBe(true)
    expect(released).toBe(1)
  })
})
