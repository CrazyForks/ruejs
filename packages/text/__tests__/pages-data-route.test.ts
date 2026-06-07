import { describe, it, expect } from 'vite-plus/test'
import {
  isTextDataPathname,
  parseTextDataPathname,
  buildTextDataJsonResponse,
  buildTextDataNotFoundResponse,
} from '../src/server/pages-data-route.js'

// Helper mirroring text/html safeJsonStringify behavior for tests.
const safeJsonStringify = (value: unknown) => JSON.stringify(value)

describe('pages-data-route', () => {
  describe('isTextDataPathname', () => {
    it('returns true for valid _text/data paths regardless of buildId', () => {
      expect(isTextDataPathname('/_text/data/abc/about.json')).toBe(true)
      expect(isTextDataPathname('/_text/data/abc/en/about.json')).toBe(true)
      expect(isTextDataPathname('/_text/data/wrong/about.json')).toBe(true)
    })

    it('returns false for non-_text/data paths', () => {
      expect(isTextDataPathname('/about')).toBe(false)
      expect(isTextDataPathname('/_text/static/chunks/foo.js')).toBe(false)
      expect(isTextDataPathname('/_text/data/abc/about')).toBe(false) // no .json
      expect(isTextDataPathname('/data/abc/about.json')).toBe(false)
    })
  })

  describe('parseTextDataPathname', () => {
    const BUILD_ID = 'abc123'

    it('extracts the page pathname from a flat route', () => {
      expect(parseTextDataPathname(`/_text/data/${BUILD_ID}/about.json`, BUILD_ID)).toEqual({
        pagePathname: '/about',
      })
    })

    it('preserves locale prefix (handled by downstream i18n resolver)', () => {
      expect(parseTextDataPathname(`/_text/data/${BUILD_ID}/en/about.json`, BUILD_ID)).toEqual({
        pagePathname: '/en/about',
      })
    })

    it('preserves nested segments', () => {
      expect(parseTextDataPathname(`/_text/data/${BUILD_ID}/blog/post-1.json`, BUILD_ID)).toEqual({
        pagePathname: '/blog/post-1',
      })
    })

    it('denormalizes `index` to `/`', () => {
      expect(parseTextDataPathname(`/_text/data/${BUILD_ID}/index.json`, BUILD_ID)).toEqual({
        pagePathname: '/',
      })
    })

    it('denormalizes trailing `/index` to a directory', () => {
      expect(parseTextDataPathname(`/_text/data/${BUILD_ID}/en/index.json`, BUILD_ID)).toEqual({
        pagePathname: '/en',
      })
    })

    it('returns null for a mismatched buildId', () => {
      expect(parseTextDataPathname(`/_text/data/other-build/about.json`, BUILD_ID)).toBeNull()
    })

    it('returns null when the prefix is missing the trailing slash', () => {
      expect(parseTextDataPathname(`/_text/data/${BUILD_ID}.json`, BUILD_ID)).toBeNull()
    })

    it('returns null for empty page segment', () => {
      expect(parseTextDataPathname(`/_text/data/${BUILD_ID}/.json`, BUILD_ID)).toBeNull()
    })

    it('returns null for non-_text/data paths', () => {
      expect(parseTextDataPathname('/about', BUILD_ID)).toBeNull()
      expect(parseTextDataPathname('/_text/static/x.json', BUILD_ID)).toBeNull()
    })

    it('returns null when buildId is empty', () => {
      expect(parseTextDataPathname(`/_text/data/abc/about.json`, '')).toBeNull()
    })
  })

  describe('buildTextDataJsonResponse', () => {
    it('returns a 200 JSON envelope with pageProps key', async () => {
      const res = buildTextDataJsonResponse({ message: 'hi' }, safeJsonStringify)
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('application/json')
      expect(await res.json()).toEqual({ pageProps: { message: 'hi' } })
    })
  })

  describe('buildTextDataNotFoundResponse', () => {
    it('returns a 404 JSON response with empty body', async () => {
      const res = buildTextDataNotFoundResponse()
      expect(res.status).toBe(404)
      expect(res.headers.get('Content-Type')).toBe('application/json')
      // Body is `{}` — clients blindly calling `.json()` won't throw before
      // checking the status code.
      expect(await res.json()).toEqual({})
    })
  })
})
