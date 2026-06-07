import { describe, expect, it } from 'vite-plus/test'
import { parseTextRedirectDigest } from '../src/server/text-error-digest.js'

describe('text error digest parsing', () => {
  // Mirrors Text.js redirect type semantics from:
  // https://github.com/vercel/next.js/blob/canary/packages/text/src/client/components/redirect.ts
  it('preserves an omitted redirect type so callers can apply context-sensitive defaults', () => {
    expect(parseTextRedirectDigest('TEXT_REDIRECT;;%2Fdashboard;307')).toEqual({
      status: 307,
      type: null,
      url: '/dashboard',
    })
  })

  it('preserves explicit redirect types', () => {
    expect(parseTextRedirectDigest('TEXT_REDIRECT;replace;%2Flogin;308')).toEqual({
      status: 308,
      type: 'replace',
      url: '/login',
    })

    expect(parseTextRedirectDigest('TEXT_REDIRECT;push;%2Fprofile;307')).toEqual({
      status: 307,
      type: 'push',
      url: '/profile',
    })
  })

  it('preserves non-empty redirect type segments as raw digest data', () => {
    expect(parseTextRedirectDigest('TEXT_REDIRECT;custom;%2Fprofile;307')).toEqual({
      status: 307,
      type: 'custom',
      url: '/profile',
    })
  })
})
