import { headers as textHeaders } from 'text/headers'
import { TextRequest, TextResponse, TextFetchEvent } from 'text/server'
import { recordMiddlewareInvocation } from './instrumentation-state'

/**
 * App Router middleware that uses TextRequest-specific APIs.
 * This tests that the middleware receives a TextRequest (not a plain Request).
 *
 * Also covers OpenText compat tests (ON-11):
 * - Redirect with cookie setting
 * - Rewrite (URL stays, content from another page)
 * - Rewrite with custom status code
 * - Block with 403
 * - Search params forwarding
 */
export async function middleware(request: TextRequest, event: TextFetchEvent) {
  // Test TextRequest.textUrl - this would fail with TypeError if request is plain Request
  const { pathname } = request.textUrl

  // Record this invocation so tests can detect double-execution.
  // In a hybrid app+pages fixture the Vite connect handler runs middleware
  // via ssrLoadModule (SSR env) and then the RSC entry runs it again inline
  // (RSC env). A single request should produce exactly one invocation.
  recordMiddlewareInvocation(pathname)

  // Test TextRequest.cookies - this would fail with TypeError if request is plain Request
  const sessionToken = request.cookies.get('session')
  const acceptsRsc = request.headers.get('accept')?.startsWith('text/x-component') ?? false

  if (acceptsRsc && pathname === '/rsc-fetch-redirect-src') {
    return TextResponse.redirect(new URL('/rsc-fetch-error-target.rsc', request.url), 307)
  }

  if (acceptsRsc && pathname === '/rsc-fetch-error-target') {
    return new Response('<html><body><h1>Internal Server Error</h1></body></html>', {
      status: 500,
      headers: { 'content-type': 'text/html' },
    })
  }

  const response = TextResponse.text()

  // Add headers to prove middleware ran and TextRequest APIs worked
  response.headers.set('x-mw-pathname', pathname)
  response.headers.set('x-mw-ran', 'true')

  if (sessionToken) {
    response.headers.set('x-mw-has-session', 'true')
  }

  // Redirect /middleware-redirect to /about (with cookie, like OpenText)
  // Ref: opennextjs-cloudflare middleware.ts — redirect with set-cookie header
  if (pathname === '/middleware-redirect') {
    return TextResponse.redirect(new URL('/about', request.url), {
      headers: { 'set-cookie': 'middleware-redirect=success; Path=/' },
    })
  }

  // Rewrite /middleware-rewrite to render / content (URL stays the same)
  // Ref: opennextjs-cloudflare middleware.ts — TextResponse.rewrite
  if (pathname === '/middleware-rewrite') {
    return TextResponse.rewrite(new URL('/', request.url))
  }

  // Used by Vitest: textjs-compat/hooks.test.ts — verifies usePathname()
  // returns the CANONICAL URL (the one the user sees) after a middleware
  // rewrite, not the internal rewrite target. Mirrors the Text.js test
  // semantics for `/rewritten-use-pathname` via a middleware rewrite.
  if (pathname === '/middleware-rewritten-use-pathname') {
    return TextResponse.rewrite(new URL('/textjs-compat/hooks-search', request.url))
  }

  // Ported from Text.js: test/e2e/middleware-rewrites/app/middleware.js
  // https://github.com/vercel/next.js/blob/canary/test/e2e/middleware-rewrites/app/middleware.js
  if (pathname === '/middleware-external-rewrite') {
    const target =
      request.headers.get('x-middleware-test-rewrite-target') ??
      process.env.TEST_MIDDLEWARE_EXTERNAL_PROXY_TARGET
    if (target) {
      const rewriteTarget = new URL('/middleware-external-target', target)
      rewriteTarget.search = request.textUrl.search
      if (request.headers.get('x-middleware-test-request-override') === '1') {
        const headers = new Headers(request.headers)
        headers.set('x-hello-from-middleware1', 'hello')
        headers.set('x-hello-from-middleware2', 'world')
        return TextResponse.rewrite(rewriteTarget, { request: { headers } })
      }
      return TextResponse.rewrite(rewriteTarget)
    }
  }

  // Rewrite with query params — the rewrite URL's query string should be
  // visible to the target page via searchParams props and useSearchParams().
  if (pathname === '/middleware-rewrite-query') {
    return TextResponse.rewrite(
      new URL('/search-query?searchParams=from-rewrite&extra=injected', request.url),
    )
  }

  // Rewrite with custom status code
  // Ref: opennextjs-cloudflare middleware.ts — TextResponse.rewrite with status
  if (pathname === '/middleware-rewrite-status') {
    return TextResponse.rewrite(new URL('/', request.url), {
      status: 403,
    })
  }

  // Action forward loop test: rewrite POSTs from /textjs-compat/action-forward-loop
  // to /textjs-compat/action-forward-loop-rewrite so the receiving page does not
  // bundle the action. Without the x-action-forwarded guard, a multi-worker
  // deployment would loop indefinitely. In text's single-worker model, the
  // guard still fires defensively when the header is injected.
  if (pathname === '/textjs-compat/action-forward-loop' && request.method === 'POST') {
    return TextResponse.rewrite(new URL('/textjs-compat/action-forward-loop-rewrite', request.url))
  }

  // Block /middleware-blocked with custom response
  if (pathname === '/middleware-blocked') {
    return new Response('Blocked by middleware', { status: 403 })
  }

  // Throw an error to test that middleware errors return 500, not bypass auth
  if (pathname === '/middleware-throw') {
    throw new Error('middleware crash')
  }

  // Test event and event.waitUntil (needed for Clerk etc)
  if (pathname === '/middleware-event') {
    if (!event || typeof event.waitUntil !== 'function') {
      return new Response('Missing event.waitUntil', { status: 500 })
    }
    event.waitUntil(Promise.resolve())
    return new Response('Event OK', { status: 200 })
  }

  if (pathname === '/middleware-fetch-dedupe') {
    const target = process.env.TEST_FETCH_DEDUPE_TARGET
    if (!target) {
      return Response.json({ error: 'missing TEST_FETCH_DEDUPE_TARGET' }, { status: 500 })
    }

    const first = await fetch(target, { cache: 'no-store' })
    const second = await fetch(target, { cache: 'no-store' })
    const firstBody = (await first.json()) as { count: number }
    const secondBody = (await second.json()) as { count: number }
    return Response.json({ counts: [firstBody.count, secondBody.count] })
  }

  // Inject mw-before-user=1 cookie for beforeFiles rewrite gating test.
  // In App Router order, beforeFiles rewrites run after middleware, so they
  // should see this cookie. The /mw-gated-before rule in text.config.ts has:
  // [cookie:mw-before-user], which matches when ?mw-auth is present.
  if (pathname === '/mw-gated-before' && request.textUrl.searchParams.has('mw-auth')) {
    const headers = new Headers(request.headers)
    const existing = headers.get('cookie') ?? ''
    headers.set('cookie', existing ? existing + '; mw-before-user=1' : 'mw-before-user=1')
    return TextResponse.text({ request: { headers } })
  }

  // Inject mw-fallback-user=1 cookie for fallback rewrite gating test.
  // Fallback rewrites run after middleware and after a 404 from route matching.
  // The /mw-gated-fallback rule has: [cookie:mw-fallback-user].
  if (pathname === '/mw-gated-fallback' && request.textUrl.searchParams.has('mw-auth')) {
    const headers = new Headers(request.headers)
    const existing = headers.get('cookie') ?? ''
    headers.set('cookie', existing ? existing + '; mw-fallback-user=1' : 'mw-fallback-user=1')
    return TextResponse.text({ request: { headers } })
  }

  // Inject mw-pages-fallback-user=1 cookie for mixed app/pages fallback routing.
  // This ensures the host dev shell can still match a Pages-targeted fallback
  // rewrite in a mixed project after the middleware header ownership changes.
  if (pathname === '/mw-gated-fallback-pages' && request.textUrl.searchParams.has('mw-auth')) {
    const headers = new Headers(request.headers)
    const existing = headers.get('cookie') ?? ''
    headers.set(
      'cookie',
      existing ? existing + '; mw-pages-fallback-user=1' : 'mw-pages-fallback-user=1',
    )
    return TextResponse.text({ request: { headers } })
  }

  // Middleware headers take precedence over text.config.js headers for the same key.
  // Middleware sets e2e-headers=middleware; config sets e2e-headers=text.config.js via /(.*).
  // Ref: opennextjs-cloudflare headers.test.ts — "Middleware headers override text.config.js headers"
  if (pathname === '/headers/override-from-middleware') {
    const res = TextResponse.text()
    res.headers.set('e2e-headers', 'middleware')
    return res
  }

  if (pathname === '/header-override-delete' || pathname === '/api/header-override-delete') {
    const headers = new Headers(request.headers)
    headers.delete('authorization')
    headers.delete('cookie')
    headers.set('x-from-middleware', 'hello-from-middleware')
    return TextResponse.text({ request: { headers } })
  }

  // Regression for a bug where a middleware that reads `text/headers` →
  // `headers()` before returning a `TextResponse.text({ request: { headers } })`
  // override leaked the pre-override snapshot into the Server Component.
  //
  // Discovered with @clerk/textjs, whose internal `clerkClient()` calls
  // `await headers()` via `buildRequestLike()` during middleware execution.
  // That call cached the sealed read-only Headers view on the shared
  // HeadersContext. Afterwards, `applyMiddlewareRequestHeaders()` replaced
  // `ctx.headers` with the override view but never invalidated the cached
  // sealed snapshot, so the Server Component's later `headers()` call
  // returned the original request headers — `x-from-middleware` was missing
  // and deleted credential headers were still visible.
  if (pathname === '/header-override-after-prior-access') {
    // 1. Prime the sealed Headers cache via an early `headers()` read — this
    //    is the step that a real-world middleware like Clerk performs under
    //    the covers.
    await textHeaders()

    // 2. Apply the header override. A correct implementation must invalidate
    //    the cached sealed snapshot so this override reaches the render.
    const headers = new Headers(request.headers)
    headers.delete('authorization')
    headers.delete('cookie')
    headers.set('x-from-middleware', 'hello-from-middleware')
    return TextResponse.text({ request: { headers } })
  }

  if (pathname === '/pages-header-override-delete') {
    const headers = new Headers(request.headers)
    headers.delete('authorization')
    headers.delete('cookie')
    headers.set('x-from-middleware', 'hello-from-middleware')
    return TextResponse.text({ request: { headers } })
  }

  // Forward search params as a header for RSC testing
  // Ref: opennextjs-cloudflare middleware.ts — search-params header
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(
    'x-search-params',
    `mw/${request.textUrl.searchParams.get('searchParams') || ''}`,
  )
  const r = TextResponse.text({
    request: { headers: requestHeaders },
  })
  if (
    pathname.startsWith('/use-client-page-pathname') &&
    request.textUrl.searchParams.has('csp-nonce')
  ) {
    r.headers.set('content-security-policy', "script-src 'nonce-text-test-nonce' 'strict-dynamic';")
  }
  if (
    pathname.startsWith('/use-client-page-pathname') &&
    request.textUrl.searchParams.has('csp-default-src')
  ) {
    r.headers.set('content-security-policy', "default-src 'nonce-text-test-nonce';")
  }
  if (
    pathname.startsWith('/use-client-page-pathname') &&
    request.textUrl.searchParams.has('csp-report-only')
  ) {
    r.headers.set(
      'content-security-policy-report-only',
      "script-src 'nonce-text-test-nonce' 'strict-dynamic';",
    )
  }
  if (pathname === '/script-nonce' || pathname.startsWith('/script-nonce/')) {
    r.headers.set('content-security-policy', "script-src 'nonce-text-test-nonce' 'strict-dynamic';")
  }
  if (
    (pathname === '/revalidate-test' || pathname.startsWith('/beforeinteractive-head-ordering')) &&
    request.textUrl.searchParams.has('csp-nonce')
  ) {
    const nonce = request.textUrl.searchParams.get('csp-nonce') ?? 'text-test-nonce'
    r.headers.set('content-security-policy', `script-src 'nonce-${nonce}' 'strict-dynamic';`)
  }
  if (
    pathname.startsWith('/textjs-compat/dynamic') &&
    request.textUrl.searchParams.has('csp-nonce')
  ) {
    r.headers.set('content-security-policy', "script-src 'nonce-text-test-nonce' 'strict-dynamic';")
  }
  r.headers.set('x-mw-pathname', pathname)
  r.headers.set('x-mw-ran', 'true')
  if (sessionToken) {
    r.headers.set('x-mw-has-session', 'true')
  }
  return r
}

export const config = {
  matcher: [
    '/about',
    '/middleware-redirect',
    '/middleware-rewrite',
    '/middleware-rewritten-use-pathname',
    '/middleware-external-rewrite',
    '/middleware-rewrite-query',
    '/middleware-rewrite-status',
    '/middleware-blocked',
    '/middleware-throw',
    '/middleware-event',
    '/middleware-fetch-dedupe',
    '/search-query',
    '/headers/override-from-middleware',
    '/header-override-delete',
    '/api/header-override-delete',
    '/api/pages-og',
    '/header-override-after-prior-access',
    '/pages-header-override-delete',
    '/revalidate-test',
    '/script-nonce/:path*',
    '/script-manual-nonce',
    '/pages-script-manual-nonce',
    '/textjs-compat/dynamic/:path*',
    '/textjs-compat/action-forward-loop',
    '/use-client-page-pathname/:path*',
    '/rsc-fetch-redirect-src',
    '/rsc-fetch-error-target',
    '/',
    '/mw-gated-before',
    '/mw-gated-fallback',
    {
      source: '/mw-object-gated',
      has: [{ type: 'header', key: 'x-mw-allow', value: '1' }],
      missing: [{ type: 'cookie', key: 'mw-blocked' }],
    },
    '/mw-gated-fallback-pages',
    '/photos/:path*',
    '/actions',
    '/beforeinteractive-head-ordering/:path*',
    '/beforeinteractive-head-ordering',
  ],
}
