/**
 * Text.js Compatibility Tests: app-custom-routes (Route Handlers)
 *
 * Ported from: https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/app-routes/app-custom-routes.test.ts
 *
 * Tests route handler behavior in the App Router:
 * - Basic HTTP methods (GET, POST, PUT, DELETE, PATCH)
 * - Query parameter reading
 * - Request headers reading via headers()
 * - Cookie reading via cookies()
 * - JSON and text body reading
 * - TextResponse.redirect() helper
 * - TextResponse.json() helper
 * - HEAD auto-implementation
 * - OPTIONS auto-implementation
 * - 405 Method Not Allowed
 * - 500 Internal Server Error (handler throws)
 * - redirect() and notFound() in route handlers
 * - cookies().set() and cookies().delete()
 * - Dynamic params in route handlers
 *
 * Fixture routes live in:
 * - fixtures/app-basic/app/textjs-compat/api/* (new)
 * - fixtures/app-basic/app/api/* (pre-existing, referenced for some tests)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vite-plus/test'
import type { ViteDevServer } from 'vite-plus'
import { APP_FIXTURE_DIR, startFixtureServer } from '../helpers.js'

describe('Text.js compat: app-routes', () => {
  let server: ViteDevServer
  let baseUrl: string

  beforeAll(async () => {
    ;({ server, baseUrl } = await startFixtureServer(APP_FIXTURE_DIR, {
      appRouter: true,
    }))
    // Warm up
    await fetch(`${baseUrl}/`).catch(() => {})
  }, 60_000)

  afterAll(async () => {
    await server?.close()
  })

  // ── Basic HTTP methods ───────────────────────────────────────
  // Text.js: describe.each(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
  // Source: https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/app-routes/app-custom-routes.test.ts#L30-L47

  describe.each(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])('%s method', method => {
    it('responds with 200 and correct content', async () => {
      const res = await fetch(`${baseUrl}/textjs-compat/api/methods`, {
        method,
      })
      expect(res.status).toBe(200)
      expect(await res.text()).toContain('hello, world')
      expect(res.headers.get('x-method')).toBe(method)
    })
  })

  // ── Query parameters ─────────────────────────────────────────
  // Text.js: 'can read query parameters'
  // Source: https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/app-routes/app-custom-routes.test.ts#L69-L77

  it('can read query parameters', async () => {
    const res = await fetch(`${baseUrl}/textjs-compat/api/query?ping=pong`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ping).toBe('pong')
  })

  // ── Headers reading ──────────────────────────────────────────
  // Text.js: 'gets the correct values' (headers)
  // Source: https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/app-routes/app-custom-routes.test.ts#L121-L131

  it('can read request headers via headers()', async () => {
    const res = await fetch(`${baseUrl}/textjs-compat/api/headers-read`, {
      headers: { 'x-test-ping': 'pong' },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ping).toBe('pong')
  })

  // ── Cookies reading ──────────────────────────────────────────
  // Text.js: 'gets the correct values' (cookies)
  // Source: https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/app-routes/app-custom-routes.test.ts#L134-L144

  it('can read cookies via cookies()', async () => {
    const res = await fetch(`${baseUrl}/textjs-compat/api/cookies-read`, {
      headers: { cookie: 'ping=pong' },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ping).toBe('pong')
  })

  // ── JSON body ────────────────────────────────────────────────
  // Text.js: 'can read a JSON encoded body'
  // Source: https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/app-routes/app-custom-routes.test.ts#L137-L149

  it('can read a JSON encoded body', async () => {
    const body = { ping: 'pong' }
    const res = await fetch(`${baseUrl}/textjs-compat/api/body-json`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.body).toEqual(body)
  })

  // Text.js: 'can read a JSON encoded body for DELETE requests'
  // Source: https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/app-routes/app-custom-routes.test.ts#L163-L172

  it('can read a JSON encoded body for DELETE requests', async () => {
    const body = { name: 'foo' }
    const res = await fetch(`${baseUrl}/textjs-compat/api/body-json`, {
      method: 'DELETE',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('delete foo')
  })

  // ── Text body ────────────────────────────────────────────────
  // Text.js: 'can read the text body'
  // Source: https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/app-routes/app-custom-routes.test.ts#L213-L223

  it('can read the text body', async () => {
    const body = 'hello, world'
    const res = await fetch(`${baseUrl}/textjs-compat/api/body-text`, {
      method: 'POST',
      body,
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.body).toBe(body)
  })

  // ── TextResponse.redirect() ──────────────────────────────────
  // Text.js: 'supports the TextResponse.redirect() helper'
  // Source: https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/app-routes/app-custom-routes.test.ts#L94-L104

  it('supports TextResponse.redirect()', async () => {
    const res = await fetch(`${baseUrl}/textjs-compat/api/redirect-response`, {
      redirect: 'manual',
    })
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('https://textjs.org/')
  })

  // ── TextResponse.json() ──────────────────────────────────────
  // Text.js: 'supports the TextResponse.json() helper'
  // Source: https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/app-routes/app-custom-routes.test.ts#L106-L115

  it('supports TextResponse.json()', async () => {
    const res = await fetch(`${baseUrl}/textjs-compat/api/json-response?ping=hello`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    const data = await res.json()
    expect(data.ping).toBe('hello')
  })

  // ── HEAD auto-implementation ─────────────────────────────────
  // Text.js: 'implements HEAD on routes with GET already implemented'
  // Source: https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/app-routes/app-custom-routes.test.ts#L237-L244
  //
  // Using pre-existing /api/get-only which only exports GET

  it('auto-implements HEAD from GET', async () => {
    const res = await fetch(`${baseUrl}/api/get-only`, {
      method: 'HEAD',
    })
    expect(res.status).toBe(200)
    const body = await res.text()
    expect(body).toBe('')
  })

  // ── OPTIONS auto-implementation ──────────────────────────────
  // Text.js: 'implements OPTIONS on routes'
  // Source: https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/app-routes/app-custom-routes.test.ts#L246-L255

  it('auto-implements OPTIONS with Allow header', async () => {
    const res = await fetch(`${baseUrl}/api/get-only`, {
      method: 'OPTIONS',
    })
    expect(res.status).toBe(204)
    const body = await res.text()
    expect(body).toBe('')
    const allow = res.headers.get('allow')
    expect(allow).toContain('GET')
    expect(allow).toContain('OPTIONS')
  })

  // ── 405 Method Not Allowed ───────────────────────────────────
  // Text.js: 'responds with 405 when method is not implemented'
  // Source: https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/app-routes/app-custom-routes.test.ts#L220-L227

  it('responds with 405 for unimplemented method', async () => {
    const res = await fetch(`${baseUrl}/api/get-only`, {
      method: 'POST',
    })
    expect(res.status).toBe(405)
  })

  // ── 500 Internal Server Error ────────────────────────────────
  // Text.js: 'responds with 500 when the handler throws an error'
  // Source: https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/app-routes/app-custom-routes.test.ts#L229-L233
  //
  // Using pre-existing /api/error-route

  it('responds with 500 when handler throws', async () => {
    const res = await fetch(`${baseUrl}/api/error-route`)
    expect(res.status).toBe(500)
  })

  // ── redirect() in route handlers ─────────────────────────────
  // Text.js: 'can respond correctly' (redirect)
  // Source: https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/app-routes/app-custom-routes.test.ts#L161-L172
  //
  // Using pre-existing /api/redirect-route (calls redirect('/about'))

  it('redirect() produces 307 with Location header', async () => {
    const res = await fetch(`${baseUrl}/api/redirect-route`, {
      redirect: 'manual',
    })
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/about')
  })

  // Ported from Text.js:
  // test/e2e/app-dir/actions/app-action.test.ts
  // https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/actions/app-action.test.ts
  it('POST form route handler redirect() produces 303', async () => {
    const res = await fetch(`${baseUrl}/textjs-compat/api/post-form-redirect`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: '',
      redirect: 'manual',
    })

    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toContain(
      '/textjs-compat/route-handler-redirects?success=true',
    )
    expect(res.headers.get('set-cookie')).toContain('route-redirect=preserved')
  })

  // Ported from Text.js:
  // test/e2e/app-dir/actions/app-action.test.ts
  // https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/actions/app-action.test.ts
  it('POST form route handler permanentRedirect() produces 303', async () => {
    const res = await fetch(`${baseUrl}/textjs-compat/api/post-form-permanent-redirect`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: '',
      redirect: 'manual',
    })

    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toContain(
      '/textjs-compat/route-handler-redirects?success=true',
    )
  })

  // ── notFound() in route handlers ─────────────────────────────
  // Text.js: 'can respond correctly in nodejs' (notFound)
  // Source: https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/app-routes/app-custom-routes.test.ts#L186-L191
  //
  // Using pre-existing /api/not-found-route

  it('notFound() produces 404', async () => {
    const res = await fetch(`${baseUrl}/api/not-found-route`)
    expect(res.status).toBe(404)
  })

  // ── cookies().set() ──────────────────────────────────────────
  // Text.js: tests cookie setting via cookies() in route handlers
  // Using pre-existing /api/set-cookie

  it('cookies().set() produces Set-Cookie headers', async () => {
    const res = await fetch(`${baseUrl}/api/set-cookie`)
    expect(res.status).toBe(200)
    const setCookies = res.headers.getSetCookie()
    const sessionCookie = setCookies.find((c: string) => c.startsWith('session='))
    expect(sessionCookie).toBeDefined()
    expect(sessionCookie).toContain('abc123')
  })

  // ── cookies().delete() ───────────────────────────────────────
  it('cookies().delete() produces an expired Set-Cookie header', async () => {
    const res = await fetch(`${baseUrl}/api/set-cookie`, {
      method: 'POST',
    })
    expect(res.status).toBe(200)
    const setCookies = res.headers.getSetCookie()
    const sessionCookie = setCookies.find((c: string) => c.startsWith('session='))
    expect(sessionCookie).toBeDefined()
    expect(sessionCookie).toContain('Expires=')
  })

  // ── Dynamic params ───────────────────────────────────────────
  // Text.js: 'provides params to routes with dynamic parameters'
  // Source: https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/app-routes/app-custom-routes.test.ts#L84-L92
  //
  // Using pre-existing /api/items/[id]

  it('provides dynamic params to route handler', async () => {
    const res = await fetch(`${baseUrl}/api/items/42`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe('42')
  })

  it('provides dynamic params with different methods', async () => {
    const res = await fetch(`${baseUrl}/api/items/99`, {
      method: 'PUT',
      body: JSON.stringify({ name: 'Widget' }),
      headers: { 'content-type': 'application/json' },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe('99')
    expect(data.name).toBe('Widget')
  })

  // ── Route segment config: revalidate ────────────────────────
  // Text.js: GET-only route handlers with `export const revalidate = N`
  // get Cache-Control: s-maxage=N, stale-while-revalidate
  // Fixture: /api/static-data exports revalidate = 1

  it('sets Cache-Control s-maxage from route handler revalidate config', async () => {
    const res = await fetch(`${baseUrl}/api/static-data`)
    expect(res.status).toBe(200)
    const cacheControl = res.headers.get('cache-control')
    expect(cacheControl).toContain('s-maxage=1')
    expect(cacheControl).toContain('stale-while-revalidate')
  })

  it('does not set s-maxage when revalidate is 0', async () => {
    // revalidate=0 means "never cache" in Text.js — no s-maxage header
    const res = await fetch(`${baseUrl}/api/no-cache`)
    expect(res.status).toBe(200)
    const cacheControl = res.headers.get('cache-control')
    // Should either be null or not contain s-maxage
    if (cacheControl) {
      expect(cacheControl).not.toContain('s-maxage')
    }
  })

  it('does not override handler-set Cache-Control with revalidate config', async () => {
    // Fixture: /api/custom-cache exports revalidate=60 but sets its own Cache-Control
    const res = await fetch(`${baseUrl}/api/custom-cache`)
    expect(res.status).toBe(200)
    const cacheControl = res.headers.get('cache-control')
    expect(cacheControl).toBe('public, max-age=300')
  })

  it('does not set s-maxage when a revalidated GET handler reads request-specific data', async () => {
    const res = await fetch(`${baseUrl}/api/dynamic-request-data`, {
      headers: {
        'x-test-ping': 'pong',
        cookie: 'ping=cookie-pong',
      },
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      ping: 'pong',
      cookie: 'cookie-pong',
    })

    const cacheControl = res.headers.get('cache-control')
    if (cacheControl) {
      expect(cacheControl).not.toContain('s-maxage')
      expect(cacheControl).not.toContain('stale-while-revalidate')
    }
  })

  // ── Catch-all dynamic params (Text.js 15 async params) ──────
  // Regression test for: https://github.com/cloudflare/vinext/pull/466
  // Route handlers must support `await params` (Promise<{ ... }> pattern).
  // Fixture: /api/catch-all/[...slugs]/route.ts uses `await params`
  //
  // Text.js: 'provides params to routes with dynamic parameters'
  // Source: https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/app-routes/app-custom-routes.test.ts#L84-L92

  // Text.js: 'does not provide params to routes without dynamic parameters'
  // Source: https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/app-routes/app-custom-routes.test.ts#L424-L431
  it('does not provide params to routes without dynamic parameters', async () => {
    const res = await fetch(`${baseUrl}/textjs-compat/api/params-null`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.params).toBeNull()
  })

  it('catch-all route handler supports await params (Text.js 15 async params)', async () => {
    const res = await fetch(`${baseUrl}/api/catch-all/a/b/c`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.slugs).toEqual(['a', 'b', 'c'])
  })

  it('catch-all route handler with hyphenated segments', async () => {
    const res = await fetch(`${baseUrl}/api/catch-all/foo-bar/baz-qux`)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.slugs).toEqual(['foo-bar', 'baz-qux'])
  })

  // ── Documented skips ─────────────────────────────────────────
  //
  // N/A: 'statically generates correctly with no dynamic usage'
  //   Text.js-specific build output (.text/server/app/...) not applicable
  //
  // N/A: 'works with generateStaticParams correctly'
  //   Tests ISR revalidation on route handlers with static params — build-specific
  //
  // N/A: 'abort via a request' (various methods)
  //   Tests AbortController on fetch — needs stderr inspection not available in vitest
  //
  // N/A: 'route groups' — Tests (group) routing syntax, separate feature
  //
  // N/A: 'can handle a streaming request and streaming response'
  //   Tests streaming body upload — complex streaming setup
  //
  // N/A: 'responds with 400 (Bad Request) when method is not a valid HTTP method'
  //   Can't send invalid HTTP method from fetch()
  //
  // N/A: 'responds with 500 when handler calls TextResponse.text()'
  //   Tests console output inspection, not available in vitest
  //
  // N/A: 'edge functions' — Tests edge runtime variant
  //
  // N/A: 'dynamic = "force-static"' — Tests force-static config stripping
  //
  // N/A: 'customized metadata routes' (robots.txt) — Metadata routes not in scope
  //
  // N/A: 'invalid exports' — Tests dev-only console error for default export
  //
  // N/A: 'no response returned' — Tests console error inspection
  //
  // N/A: 'permanentRedirect' — Would need fixture, minor variant of redirect

  // ── ISR caching (dev mode) ─────────────────────────────────
  // In dev mode, ISR caching is disabled. Route handlers should NOT emit
  // X-Text-Cache headers — every request re-executes the handler fresh.
  // Production ISR behavioral tests are in app-router.test.ts's production server section.

  it('dev mode: route handler with revalidate does not emit X-Text-Cache header', async () => {
    const res = await fetch(`${baseUrl}/api/static-data`)
    expect(res.status).toBe(200)
    // Dev mode should not set X-Text-Cache (ISR is production-only)
    expect(res.headers.get('x-text-cache')).toBeNull()
  })
})
