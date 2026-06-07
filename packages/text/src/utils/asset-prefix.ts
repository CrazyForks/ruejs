/**
 * Shared helpers for text.config `assetPrefix`.
 *
 * Mirrors Text.js semantics: `assetPrefix` is prepended to every JS/CSS/image/
 * static asset URL emitted in the page. It is distinct from `basePath`, which
 * affects route URLs.
 *
 *  - A `assetPrefix` of `""` (empty) means "no prefix". URLs are emitted as
 *    `/_text/static/...` and assets are written to
 *    `dist/client/_text/static/...` so the on-disk layout matches.
 *  - A path prefix like `"/custom-asset-prefix"` is applied as a URL prefix
 *    relative to the deployment origin. The prod server must also serve assets
 *    under that prefix.
 *  - An absolute URL like `"https://cdn.example.com"` makes asset URLs fully
 *    qualified. Runtime serving on the deployment origin is a no-op — the CDN
 *    serves the assets directly.
 *
 * The path component of the asset URL after the prefix is always
 * `/_text/static/<filename>`.
 *
 * @see https://textjs.org/docs/app/api-reference/config/text-config-js/assetPrefix
 */

/**
 * Suffix appended to the assetPrefix (or used standalone when no prefix is
 * configured) to form the leading portion of every emitted asset URL.
 */
export const ASSET_PREFIX_URL_DIR = '_text/static'
export const LEGACY_ASSET_PREFIX_URL_DIR = '_text/static'

/** Whether `assetPrefix` is an absolute URL (vs a path prefix). */
export function isAbsoluteAssetPrefix(assetPrefix: string): boolean {
  return /^https?:\/\//i.test(assetPrefix)
}

/**
 * Compute the on-disk `build.assetsDir` for the given `assetPrefix`.
 *
 *  - Path prefix (`/cdn`): write to `cdn/_text/static/` so the on-disk layout
 *    matches the URL — the Cloudflare ASSETS binding (and any static file
 *    server) serves them directly without a runtime rewrite.
 *  - Absolute URL (with or without path component): write to `_text/static/`.
 *    Runtime serving is best-effort — the CDN is expected to serve these.
 *  - Empty: write to `_text/static/` so the on-disk layout matches the URL
 *    text emits. This makes `assetPrefix` consistent in
 *    both the configured and unconfigured cases — the URL contract is
 *    always `/<prefix?>/_text/static/...`, and the on-disk layout mirrors
 *    it 1:1 so the static-file layer can serve hits and return
 *    `404 + "Not Found"` on misses without any URL-shape special-casing
 *    upstream of it.
 */
export function resolveAssetsDir(assetPrefix: string): string {
  if (!assetPrefix) return ASSET_PREFIX_URL_DIR
  if (isAbsoluteAssetPrefix(assetPrefix)) {
    // Files on disk land at `_text/static/...`. The absolute URL is applied
    // at URL-rendering time via renderBuiltUrl; on-disk path is irrelevant
    // to the CDN.
    return ASSET_PREFIX_URL_DIR
  }
  // Path prefix — strip leading slash so the path joins cleanly with outDir.
  // Use an explicit loop instead of `replace(/^\/+/, "")` so CodeQL doesn't
  // flag the regex as polynomial-time on uncontrolled input.
  let stripped = assetPrefix
  while (stripped.startsWith('/')) stripped = stripped.slice(1)
  return `${stripped}/${ASSET_PREFIX_URL_DIR}`
}

/**
 * Build the URL prefix to apply to emitted asset URLs. Returns the full URL
 * prefix including the `_text/static/` directory, with a trailing slash.
 *
 * Examples:
 *  - `""` → `"/_text/static/"`
 *  - `"/cdn"` → `"/cdn/_text/static/"`
 *  - `"https://cdn.example.com"` → `"https://cdn.example.com/_text/static/"`
 *  - `"https://cdn.example.com/sub"` → `"https://cdn.example.com/sub/_text/static/"`
 */
export function resolveAssetUrlPrefix(assetPrefix: string): string {
  if (!assetPrefix) return `/${ASSET_PREFIX_URL_DIR}/`
  return `${assetPrefix}/${ASSET_PREFIX_URL_DIR}/`
}

/**
 * Extract the path portion of `assetPrefix` for use in runtime URL matching.
 *
 *  - For a path prefix: returns it verbatim (e.g. `/custom-asset-prefix`).
 *  - For an absolute URL: returns its pathname stripped of trailing slashes
 *    (e.g. `"https://cdn.example.com/sub"` → `/sub`, plain origin → `""`).
 *  - For empty input: returns `""`.
 *
 * Used by the prod server and Cloudflare worker entry to recognise asset
 * requests that arrive at the deployment origin under the configured prefix.
 */
export function assetPrefixPathname(assetPrefix: string): string {
  if (!assetPrefix) return ''
  if (!isAbsoluteAssetPrefix(assetPrefix)) return assetPrefix
  try {
    let pathname = new URL(assetPrefix).pathname
    while (pathname.endsWith('/')) pathname = pathname.slice(0, -1)
    return pathname === '' ? '' : pathname
  } catch {
    return ''
  }
}

/**
 * Whether the incoming request pathname targets text's static asset tree after
 * stripping any configured `basePath` and `assetPrefix` path component.
 *
 * Used by the Cloudflare worker entry to recognise asset-shaped requests
 * that the ASSETS binding didn't serve, so they can short-circuit with a
 * plain-text 404 instead of falling through to the RSC handler (which
 * would render the full HTML 404 page). Mirrors Text.js's behaviour in
 * `packages/text/src/server/lib/router-server.ts` where
 * `realRequestPathname` is stripped of basePath/assetPrefix/i18n locale
 * before the static asset path check.
 *
 *  - `pathname`: incoming request pathname (with leading slash, no query).
 *  - `basePath`: configured `basePath` (e.g. `"/docs"`) or `""`.
 *  - `assetPathPrefix`: path component of `assetPrefix` (e.g. `"/cdn"`) or
 *    `""`. Use `assetPrefixPathname()` to derive this from a raw assetPrefix.
 *
 * @see https://github.com/vercel/next.js/blob/canary/packages/text/src/server/lib/router-server.ts
 */
export function isTextStaticPath(
  pathname: string,
  basePath: string,
  assetPathPrefix: string,
): boolean {
  let p = pathname
  if (basePath && (p === basePath || p.startsWith(basePath + '/'))) {
    p = p.slice(basePath.length) || '/'
  }
  if (assetPathPrefix && (p === assetPathPrefix || p.startsWith(assetPathPrefix + '/'))) {
    p = p.slice(assetPathPrefix.length) || '/'
  }
  return (
    p.startsWith(`/${ASSET_PREFIX_URL_DIR}/`) || p.startsWith(`/${LEGACY_ASSET_PREFIX_URL_DIR}/`)
  )
}
