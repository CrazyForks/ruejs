import { describe, expect, it } from 'vitest'

import * as runtimeMain from '@rue-js/runtime'
import * as rueMain from '@rue-js/rue'

describe('version export', () => {
  it('exposes the injected Rue version from the default public entries', () => {
    expect(runtimeMain.version).toBe('test')
    expect(rueMain.version).toBe(runtimeMain.version)
    expect(typeof rueMain.version).toBe('string')
  })
})
