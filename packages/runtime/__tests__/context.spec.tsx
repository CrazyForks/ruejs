import { describe, expect, it } from 'vitest'

import { createContext, useContext } from '../src/context'
import { createOwner, disposeOwner, runWithOwner } from '../src/reactive-core'

describe('compiled owner context', () => {
  it('returns the default value without a provider', () => {
    const Theme = createContext('fallback')
    expect(useContext(Theme)).toBe('fallback')
  })

  it('inherits a provider value through the owner parent chain', () => {
    const Theme = createContext('fallback')
    const parent = createOwner()
    const value = runWithOwner(parent, () => {
      Theme.Provider({ value: 'parent' })
      const child = createOwner()
      return runWithOwner(child, () => useContext(Theme))
    })

    expect(value).toBe('parent')
    disposeOwner(parent)
  })

  it('shadows the nearest provider without mutating its parent', () => {
    const Theme = createContext('fallback')
    const parent = createOwner()
    const values = runWithOwner(parent, () => {
      Theme.Provider({ value: 'parent' })
      const child = createOwner()
      const childValue = runWithOwner(child, () => {
        Theme.Provider({ value: 'child' })
        return useContext(Theme)
      })
      return { childValue, parentValue: useContext(Theme) }
    })

    expect(values).toEqual({ childValue: 'child', parentValue: 'parent' })
    disposeOwner(parent)
  })

  it('keeps provided objects by reference and returns children directly', () => {
    const Session = createContext<{ count: number } | null>(null)
    const provided = { count: 1 }
    const child = { kind: 'compiled-child' }
    const owner = createOwner()
    const result = runWithOwner(owner, () => {
      const returned = Session.Provider({ value: provided, children: child as never })
      return { returned, value: useContext(Session) }
    })

    expect(result?.returned).toBe(child)
    expect(result?.value).toBe(provided)
    disposeOwner(owner)
  })
})
