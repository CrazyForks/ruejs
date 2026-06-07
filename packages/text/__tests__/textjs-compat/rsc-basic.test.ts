/**
 * Text.js Compatibility Tests: rsc-basic
 *
 * Ported from: https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/rsc-basic/rsc-basic.test.ts
 *
 * Tests RSC behavior at the HTTP/SSR level:
 * - Server components render correctly in SSR HTML
 * - Props are passed from server components to client components
 * - Client component initial state is present in SSR
 * - Page returning null renders without error
 * - Async server components render after await
 * - RSC payload response has correct content-type
 * - Missing routes return 404
 *
 * Fixture pages live in:
 * - fixtures/app-basic/app/textjs-compat/rsc-server/    (server + client child)
 * - fixtures/app-basic/app/textjs-compat/rsc-null/       (returns null)
 * - fixtures/app-basic/app/textjs-compat/rsc-async/      (async server component)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vite-plus/test'
import type { ViteDevServer } from 'vite-plus'
import { APP_FIXTURE_DIR, startFixtureServer, fetchHtml } from '../helpers.js'

describe('Text.js compat: rsc-basic', () => {
  let server: ViteDevServer
  let baseUrl: string

  beforeAll(async () => {
    ;({ server, baseUrl } = await startFixtureServer(APP_FIXTURE_DIR, {
      appRouter: true,
    }))
    // Warm up
    await fetchHtml(baseUrl, '/textjs-compat/rsc-server')
  }, 60_000)

  afterAll(async () => {
    await server?.close()
  })

  // ── Server component rendering ──────────────────────────────

  // Text.js: 'should render server components correctly'
  // Source: https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/rsc-basic/rsc-basic.test.ts
  it('server component renders correctly in SSR', async () => {
    const { html } = await fetchHtml(baseUrl, '/textjs-compat/rsc-server')
    expect(html).toContain('Server Component')
    expect(html).toContain('from server')
  })

  // Text.js: 'should pass props from server to client components'
  // Source: https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/rsc-basic/rsc-basic.test.ts
  it('server component passes props to client component', async () => {
    const { html } = await fetchHtml(baseUrl, '/textjs-compat/rsc-server')
    expect(html).toContain('hello from server')
  })

  // Text.js: 'should render initial state of client component in SSR'
  // Source: https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/rsc-basic/rsc-basic.test.ts
  it('client component SSR includes initial state', async () => {
    const { html } = await fetchHtml(baseUrl, '/textjs-compat/rsc-server')
    expect(html).toContain('>0<')
  })

  // Text.js: 'should render page returning null without error'
  // Source: https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/rsc-basic/rsc-basic.test.ts
  it('page returning null renders without error', async () => {
    const { res } = await fetchHtml(baseUrl, '/textjs-compat/rsc-null')
    expect(res.status).toBe(200)
  })

  // Text.js: 'should render async server component after await'
  // Source: https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/rsc-basic/rsc-basic.test.ts
  it('async server component renders after await', async () => {
    const { html } = await fetchHtml(baseUrl, '/textjs-compat/rsc-async')
    expect(html).toContain('Async Server Component')
  })

  // ── RSC response ────────────────────────────────────────────

  // Text.js: 'should return RSC response with correct content-type'
  // Source: https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/rsc-basic/rsc-basic.test.ts
  it('RSC response has correct content-type', async () => {
    const res = await fetch(`${baseUrl}/textjs-compat/rsc-server.rsc`, {
      headers: {
        RSC: '1',
        Accept: 'text/x-component',
      },
    })
    const contentType = res.headers.get('content-type') ?? ''
    expect(contentType).toContain('text/x-component')
  })

  // Text.js: 'should return RSC response with rendered content'
  // Source: https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/rsc-basic/rsc-basic.test.ts
  it('RSC response contains rendered content', async () => {
    const res = await fetch(`${baseUrl}/textjs-compat/rsc-server.rsc`, {
      headers: {
        RSC: '1',
        Accept: 'text/x-component',
      },
    })
    const body = await res.text()
    const hasContent = body.includes('Server Component') || body.includes('from server')
    expect(hasContent).toBe(true)
  })

  // ── 404 handling ────────────────────────────────────────────

  // Text.js: 'should return 404 for missing routes'
  // Source: https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/rsc-basic/rsc-basic.test.ts
  it('missing route returns 404', async () => {
    const res = await fetch(`${baseUrl}/textjs-compat/definitely-does-not-exist`)
    expect(res.status).toBe(404)
  })
})
