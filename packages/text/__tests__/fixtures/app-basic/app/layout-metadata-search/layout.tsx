/**
 * Parity fixture: layout generateMetadata() must NOT receive searchParams.
 *
 * In Text.js, only page generateMetadata() receives searchParams. Layouts
 * always get undefined. This fixture verifies text matches that behavior
 * by asserting the fallback title is produced even when a query string is
 * present in the URL.
 *
 * See: text.js resolve-metadata.ts — `isPage ? { params, searchParams } : { params }`
 */

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>
}) {
  const sp = searchParams ? await searchParams : undefined
  const tab = sp?.tab ?? 'home'
  return {
    title: `Layout Section: ${tab}`,
  }
}

export default function LayoutMetadataSearchLayout({
  children,
}: {
  children: import('@rue-js/rue').RenderableOutput
}) {
  return <div data-testid="layout-metadata-search-layout">{children}</div>
}
