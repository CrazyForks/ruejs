import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/**
 * Wait for Pages Router hydration to complete.
 * Checks for window.__TEXT_ROOT__.
 */
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean(window.__TEXT_ROOT__))
}

/**
 * Wait for App Router (RSC) hydration to complete.
 * Checks for window.__TEXT_RSC_ROOT__.
 *
 * Uses expect().toPass() for better error messages on timeout.
 * 10 second timeout matches Text.js hydration expectations.
 */
export async function waitForAppRouterHydration(page: Page): Promise<void> {
  await expect(async () => {
    const ready = await page.evaluate(() => {
      const runtime = Reflect.get(window, Symbol.for('text.navigationRuntime'))
      const hasNavigate =
        typeof runtime === 'object' &&
        runtime !== null &&
        'functions' in runtime &&
        typeof runtime.functions === 'object' &&
        runtime.functions !== null &&
        'navigate' in runtime.functions &&
        typeof runtime.functions.navigate === 'function'
      return (
        Boolean(window.__TEXT_RSC_ROOT__) &&
        hasNavigate &&
        typeof window.__TEXT_HYDRATED_AT === 'number'
      )
    })
    expect(ready).toBe(true)
  }).toPass({ timeout: 10_000 })
  await page.evaluate(
    () =>
      new Promise<void>(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )
}

/**
 * Hide both Vite's HMR error overlay and text's dev error overlay so their
 * modal backdrops don't intercept page clicks during tests that intentionally
 * trigger an error and then need to interact with the error.tsx fallback
 * (Try Again, navigate away, etc.).
 *
 * Best-effort — silently no-ops if the page isn't ready yet.
 */
export async function disableDevErrorOverlay(page: Page): Promise<void> {
  await page
    .addStyleTag({
      content: `
        vite-error-overlay{display:none !important;pointer-events:none !important;}
        #__text_dev_error_overlay_root{display:none !important;pointer-events:none !important;}
      `,
    })
    .catch(() => {
      // best effort
    })
}
