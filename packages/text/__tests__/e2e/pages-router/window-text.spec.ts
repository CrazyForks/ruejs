import { test, expect } from '@playwright/test'
import { waitForHydration } from '../helpers'

const BASE = 'http://localhost:4173'

// Text.js exposes `window.text = { version, router, ... }` from its Pages
// Router client bootstrap (.textjs-ref/packages/text/src/client/text.ts:13).
// The Text.js deploy test suite — and many third-party libraries — call
// `window.text.router.push(...)` and `window.text.router.events.on(...)`
// directly, so we must mirror the shape during hydration.
//
// Issue: https://github.com/cloudflare/vinext/issues/1329
test.describe('window.text.router (Pages Router)', () => {
  test('window.text is defined after hydration with the documented shape', async ({ page }) => {
    await page.goto(`${BASE}/`)
    await waitForHydration(page)

    const shape = await page.evaluate(() => {
      const w = window as unknown as {
        text?: {
          version?: unknown
          router?: {
            push?: unknown
            replace?: unknown
            back?: unknown
            reload?: unknown
            prefetch?: unknown
            beforePopState?: unknown
            pathname?: unknown
            asPath?: unknown
            query?: unknown
            events?: {
              on?: unknown
              off?: unknown
              emit?: unknown
            }
          }
        }
      }
      const r = w.text?.router
      return {
        hasText: typeof w.text === 'object' && w.text !== null,
        versionType: typeof w.text?.version,
        hasRouter: typeof r === 'object' && r !== null,
        pushType: typeof r?.push,
        replaceType: typeof r?.replace,
        backType: typeof r?.back,
        reloadType: typeof r?.reload,
        prefetchType: typeof r?.prefetch,
        beforePopStateType: typeof r?.beforePopState,
        pathnameType: typeof r?.pathname,
        asPathType: typeof r?.asPath,
        queryType: typeof r?.query,
        eventsOnType: typeof r?.events?.on,
        eventsOffType: typeof r?.events?.off,
        eventsEmitType: typeof r?.events?.emit,
      }
    })

    expect(shape.hasText).toBe(true)
    expect(shape.versionType).toBe('string')
    expect(shape.hasRouter).toBe(true)
    expect(shape.pushType).toBe('function')
    expect(shape.replaceType).toBe('function')
    expect(shape.backType).toBe('function')
    expect(shape.reloadType).toBe('function')
    expect(shape.prefetchType).toBe('function')
    expect(shape.beforePopStateType).toBe('function')
    expect(shape.pathnameType).toBe('string')
    expect(shape.asPathType).toBe('string')
    expect(shape.queryType).toBe('object')
    expect(shape.eventsOnType).toBe('function')
    expect(shape.eventsOffType).toBe('function')
    expect(shape.eventsEmitType).toBe('function')
  })

  // Mirrors the access pattern used throughout the Text.js deploy suite,
  // e.g. test/e2e/middleware-general/test/index.test.ts which calls
  // `browser.eval('text.router.push(...)')` to drive client navigations.
  test('window.text.router.push triggers a client-side navigation', async ({ page }) => {
    await page.goto(`${BASE}/`)
    await waitForHydration(page)

    // Mark the window so we can detect a full reload (which would clear it).
    await page.evaluate(() => {
      ;(window as unknown as { __NAV_MARKER__: true }).__NAV_MARKER__ = true
    })

    await page.evaluate(() => {
      const w = window as unknown as {
        text: { router: { push: (url: string) => Promise<boolean> } }
      }
      return w.text.router.push('/about')
    })

    await expect(page.locator('h1')).toHaveText('About')
    expect(page.url()).toBe(`${BASE}/about`)

    const marker = await page.evaluate(
      () => (window as unknown as { __NAV_MARKER__?: true }).__NAV_MARKER__,
    )
    expect(marker).toBe(true)
  })
})
