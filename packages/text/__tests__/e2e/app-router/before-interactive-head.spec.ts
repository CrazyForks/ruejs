import { test, expect } from '../fixtures'

const BASE = 'http://localhost:4174'

test.describe('inline beforeInteractive head ordering', () => {
  test('inline beforeInteractive script runs before stylesheets and hydration completes without console errors', async ({
    page,
    consoleErrors,
  }) => {
    await page.goto(`${BASE}/beforeinteractive-head-ordering`)

    // The hoisted script writes a marker on `self` before any stylesheet or
    // modulepreload runs. The fixture stores the flag on a global (not a
    // `<html>` dataset attribute) so the assertion survives Rue Float's
    // head reconciliation without `suppressHydrationWarning` on the shared
    // root layout.
    const themeInitRan = await page.evaluate(
      () => (self as unknown as { __textThemeInitRan?: boolean }).__textThemeInitRan,
    )
    expect(themeInitRan).toBe(true)

    // Verify exactly one instance of the hoisted script is in the DOM. A
    // hydration mismatch where the client renders a second <script> would
    // produce two matches.
    const scriptCount = await page.evaluate(
      () => document.querySelectorAll('script[id="text-test-theme-init"]').length,
    )
    expect(scriptCount).toBe(1)

    // Verify the hoisted script is the first <script> tag in head, even
    // though other resource hints exist.
    const isFirstHeadScript = await page.evaluate(() => {
      const headScripts = document.head.querySelectorAll('script')
      return headScripts.length > 0 && headScripts[0]?.id === 'text-test-theme-init'
    })
    expect(isFirstHeadScript).toBe(true)

    // consoleErrors fixture fails the test if any errors occurred, including
    // hydration warnings.
    void consoleErrors
  })
})
