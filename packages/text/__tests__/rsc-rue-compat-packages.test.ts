import { describe, expect, it } from 'vite-plus/test'
import {
  RSC_RUE_CLIENT_OPTIMIZE_INCLUDE,
  RSC_RUE_DEDUPE,
  RSC_RUE_NODE_EXTERNALS,
  RSC_RUE_OPTIMIZE_DEPS_EXCLUDE,
  RSC_RUE_RUNTIME_ENTRIES,
  RSC_RUE_SERVER_DOM_CLIENT_EDGE,
  RSC_RUE_SSR_EXTERNAL_ENTRIES,
} from '../src/plugins/rsc-rue-compat-packages.js'

describe('RSC Rue compatibility package manifest', () => {
  it('keeps Text core free of Rue runtime package names', () => {
    expect(RSC_RUE_RUNTIME_ENTRIES).toEqual([])
    expect(RSC_RUE_DEDUPE).toBe(RSC_RUE_RUNTIME_ENTRIES)
  })

  it('keeps Rue Flight vendor edge entries outside Text core', () => {
    expect(RSC_RUE_SERVER_DOM_CLIENT_EDGE).toBe('')
    expect(RSC_RUE_OPTIMIZE_DEPS_EXCLUDE).toEqual([])
  })

  it('keeps client, node, and SSR package lists empty in Text core', () => {
    expect(RSC_RUE_CLIENT_OPTIMIZE_INCLUDE).toEqual([])
    expect(RSC_RUE_NODE_EXTERNALS).toEqual([])
    expect(RSC_RUE_SSR_EXTERNAL_ENTRIES).toEqual([])
  })
})
