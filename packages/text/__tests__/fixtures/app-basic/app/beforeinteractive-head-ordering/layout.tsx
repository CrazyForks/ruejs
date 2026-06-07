import Script from 'text/script'

/**
 * Layout used by `tests/script-head-ordering.test.ts` to verify that inline
 * `<Script strategy="beforeInteractive">` content is hoisted to the very top
 * of `<head>` — before any renderer-emitted resource hints (stylesheets,
 * modulepreload links, preload links).
 *
 * The script writes a marker on `self` so a browser-side test can confirm
 * the script ran. We deliberately don't touch `<html>` attributes here —
 * doing so would trip a hydration warning unless the shared root
 * layout (used by every other test) opted into `suppressHydrationWarning`,
 * which it doesn't.
 */
export default function BeforeInteractiveHeadOrderingLayout({
  children,
}: {
  children: import('@rue-js/rue').RenderableOutput
}): import('@rue-js/rue').RenderableOutput {
  return (
    <>
      <Script
        id="text-test-theme-init"
        strategy="beforeInteractive"
        data-text-test="theme-init"
        dangerouslySetInnerHTML={{
          __html: `self.__textThemeInitRan = true;`,
        }}
      />
      {children}
    </>
  )
}
