import { describe, expect, it } from 'vitest'
import { fromResolvedIdProxy, toResolvedIdProxy } from './resolved-id-proxy'
import {
  normalizeRscVirtualId,
  parseCssVirtual,
  parseReferenceValidationVirtual,
  toCssVirtual,
  toReferenceValidationVirtual,
  toRueRscVirtualId,
  toViteRscVirtualId,
} from './shared'
import { createVirtualPlugin } from './utils'

describe('RSC virtual namespaces', () => {
  it('normalizes legacy vite-rsc virtual ids to rue-rsc ids', () => {
    expect(toRueRscVirtualId('client-references')).toBe('virtual:rue-rsc/client-references')
    expect(toViteRscVirtualId('client-references')).toBe('virtual:vite-rsc/client-references')
    expect(normalizeRscVirtualId('virtual:vite-rsc/client-references')).toBe(
      'virtual:rue-rsc/client-references',
    )
    expect(normalizeRscVirtualId('\0virtual:vite-rsc/client-references')).toBe(
      '\0virtual:rue-rsc/client-references',
    )
  })

  it('generates rue-rsc css virtual ids and parses both namespaces', () => {
    const rueId = toCssVirtual({ id: '/src/page.tsx', type: 'rsc' })
    const legacyId = 'virtual:vite-rsc/css?type=ssr&id=%2Fsrc%2Flayout.tsx&lang.js'

    expect(rueId).toBe('virtual:rue-rsc/css?type=rsc&id=%2Fsrc%2Fpage.tsx&lang.js')
    expect(parseCssVirtual(`\0${rueId}`)).toEqual({
      id: '/src/page.tsx',
      type: 'rsc',
    })
    expect(parseCssVirtual(`\0${legacyId}`)).toEqual({
      id: '/src/layout.tsx',
      type: 'ssr',
    })
  })

  it('generates rue-rsc reference validation ids and parses legacy aliases', () => {
    const rueId = toReferenceValidationVirtual({
      id: 'server-action',
      type: 'server',
    })
    const legacyId = 'virtual:vite-rsc/reference-validation?type=client&id=client-ref&lang.js'

    expect(rueId).toBe('virtual:rue-rsc/reference-validation?type=server&id=server-action&lang.js')
    expect(parseReferenceValidationVirtual(`\0${rueId}`)).toEqual({
      id: 'server-action',
      type: 'server',
    })
    expect(parseReferenceValidationVirtual(`\0${legacyId}`)).toEqual({
      id: 'client-ref',
      type: 'client',
    })
  })

  it('generates rue-rsc resolved-id proxies and reads legacy proxies', () => {
    const resolvedId = '\0virtual:test.css'
    const rueProxy = toResolvedIdProxy(resolvedId)
    const legacyProxy = 'virtual:vite-rsc/resolved-id/' + encodeURIComponent(resolvedId)

    expect(rueProxy).toBe('virtual:rue-rsc/resolved-id/%00virtual%3Atest.css')
    expect(fromResolvedIdProxy(rueProxy)).toBe(resolvedId)
    expect(fromResolvedIdProxy(`${legacyProxy}?direct`)).toBe(resolvedId)
  })

  it('resolves createVirtualPlugin aliases to the rue-rsc canonical id', async () => {
    const plugin = createVirtualPlugin('vite-rsc/server-references', id => `loaded:${id}`) as any

    expect(plugin.resolveId.handler('virtual:rue-rsc/server-references')).toBe(
      '\0virtual:rue-rsc/server-references',
    )
    expect(plugin.resolveId.handler('virtual:vite-rsc/server-references')).toBe(
      '\0virtual:rue-rsc/server-references',
    )
    expect(await plugin.load.handler('\0virtual:rue-rsc/server-references')).toBe(
      'loaded:\0virtual:rue-rsc/server-references',
    )
    expect(await plugin.load.handler('\0virtual:vite-rsc/server-references')).toBe(
      'loaded:\0virtual:rue-rsc/server-references',
    )
  })
})
