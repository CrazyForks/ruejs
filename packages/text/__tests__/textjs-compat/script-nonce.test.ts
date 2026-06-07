import { describe, it, expect, beforeAll, afterAll } from 'vite-plus/test'
import type { ViteDevServer } from 'vite-plus'
import { APP_FIXTURE_DIR, fetchHtml, startFixtureServer } from '../helpers.js'

function getMatchingScriptTags(html: string, patterns: RegExp[]): string[] {
  return [...html.matchAll(/<script\b[^>]*>/g)]
    .map(match => match[0])
    .filter(tag => patterns.some(pattern => pattern.test(tag)))
}

describe('Text.js compat: script nonce', () => {
  let server: ViteDevServer
  let baseUrl: string

  beforeAll(async () => {
    ;({ server, baseUrl } = await startFixtureServer(APP_FIXTURE_DIR, {
      appRouter: true,
    }))
    await fetch(`${baseUrl}/`).catch(() => {})
  }, 60_000)

  afterAll(async () => {
    await server?.close()
  })

  // Ported from Text.js: test/e2e/app-dir/app/index.test.ts
  // https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/app/index.test.ts
  it('SSR: applies middleware nonce to text/script tags', async () => {
    const { res, html } = await fetchHtml(baseUrl, '/script-nonce')
    expect(res.headers.get('content-security-policy')).toBe(
      "script-src 'nonce-text-test-nonce' 'strict-dynamic';",
    )

    const tags = getMatchingScriptTags(html, [/src="\/test2\.js"/, /id="3"/])
    expect(tags.length).toBeGreaterThan(0)
    for (const tag of tags) {
      expect(tag).toContain('nonce="text-test-nonce"')
    }
  })

  // Ported from Text.js: test/e2e/app-dir/app/index.test.ts
  // https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/app/index.test.ts
  it('SSR: preserves manual nonce for App Router text/script tags', async () => {
    const { html } = await fetchHtml(baseUrl, '/script-manual-nonce')

    const tags = getMatchingScriptTags(html, [/src="\/test2\.js"/, /id="3"/])
    expect(tags.length).toBeGreaterThan(0)
    for (const tag of tags) {
      expect(tag).toContain('nonce="hello-world"')
    }
  })

  // Ported from Text.js: test/e2e/app-dir/app/index.test.ts
  // https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/app/index.test.ts
  it('SSR: preserves manual nonce for Pages Router text/script tags', async () => {
    const { html } = await fetchHtml(baseUrl, '/pages-script-manual-nonce')

    const tags = getMatchingScriptTags(html, [/src="\/test2\.js"/, /id="3"/])
    expect(tags.length).toBeGreaterThan(0)
    for (const tag of tags) {
      expect(tag).toContain('nonce="hello-world"')
    }
  })

  // Ported from Text.js: test/e2e/app-dir/app/index.test.ts
  // https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/app/index.test.ts
  it('SSR: passes middleware nonce through text/font output', async () => {
    const { res, html } = await fetchHtml(baseUrl, '/script-nonce/with-text-font')
    expect(res.headers.get('content-security-policy')).toBe(
      "script-src 'nonce-text-test-nonce' 'strict-dynamic';",
    )
    expect(html).toContain('id="script-nonce-font"')

    const fontTags = [
      ...html.matchAll(/<link\b[^>]*rel="(?:preload|stylesheet)"[^>]*>/g),
      ...html.matchAll(/<style\b[^>]*data-text-fonts[^>]*>/g),
    ].map(match => match[0])
    expect(fontTags.length).toBeGreaterThan(0)
    for (const tag of fontTags) {
      expect(tag).toContain('nonce="text-test-nonce"')
    }
  })
})
