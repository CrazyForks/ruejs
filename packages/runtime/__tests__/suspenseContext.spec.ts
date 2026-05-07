import { describe, expect, it } from 'vitest'

import {
  getCurrentSuspenseBoundary,
  isSuspenseThenable,
  type SuspenseBoundary,
  withSuspenseBoundary,
} from '../src/components/suspenseContext'

const createBoundary = (label: string): SuspenseBoundary => ({
  id: Symbol(label),
  register: () => {},
})

describe('suspenseContext', () => {
  it('tracks nested boundaries and restores the previous one after errors', () => {
    const outer = createBoundary('outer')
    const inner = createBoundary('inner')
    const error = new Error('boom')

    expect(getCurrentSuspenseBoundary()).toBeNull()

    withSuspenseBoundary(outer, () => {
      expect(getCurrentSuspenseBoundary()).toBe(outer)

      withSuspenseBoundary(inner, () => {
        expect(getCurrentSuspenseBoundary()).toBe(inner)
      })

      expect(getCurrentSuspenseBoundary()).toBe(outer)

      expect(() =>
        withSuspenseBoundary(inner, () => {
          expect(getCurrentSuspenseBoundary()).toBe(inner)
          throw error
        }),
      ).toThrow(error)

      expect(getCurrentSuspenseBoundary()).toBe(outer)
    })

    expect(getCurrentSuspenseBoundary()).toBeNull()
  })

  it('detects promise-like values and rejects non-thenables', () => {
    const thenableFunction = Object.assign(() => undefined, { then: () => undefined })

    expect(isSuspenseThenable(Promise.resolve())).toBe(true)
    expect(isSuspenseThenable({ then: () => undefined })).toBe(true)
    expect(isSuspenseThenable(thenableFunction)).toBe(true)
    expect(isSuspenseThenable(null)).toBe(false)
    expect(isSuspenseThenable({})).toBe(false)
    expect(isSuspenseThenable(1)).toBe(false)
  })
})