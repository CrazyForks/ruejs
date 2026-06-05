/**
 * Internal HTTP header name constants used throughout text.
 *
 * Centralizes all custom header names so they are defined once and referenced
 * everywhere via imports. Keeping them in one module prevents typos, makes
 * rename-refactors trivial, and lets grep find every consumer instantly.
 *
 * Standard HTTP headers (Content-Type, Cache-Control, etc.) are intentionally
 * omitted — only text-internal and Text.js-protocol headers belong here.
 */

// ---------------------------------------------------------------------------
// Text-proprietary headers (`x-text-*` / `X-Text-*`)
// ---------------------------------------------------------------------------

/** ISR / page cache state indicator: "HIT" | "MISS" | "STALE" | "STATIC". */
export const TEXT_CACHE_HEADER = 'X-Text-Cache'

/** Legacy text cache state header kept for compatibility with existing tests and apps. */
export const TEXT_LEGACY_CACHE_HEADER = 'x-text-cache'

/** Text.js public ISR / page cache state indicator. */
export const TEXTJS_CACHE_HEADER = 'x-textjs-cache'

/** Static file signal — value is URL-encoded pathname. */
export const TEXT_STATIC_FILE_HEADER = 'x-text-static-file'

/** Serialized middleware context (JSON) forwarded from dev server to RSC entry. */
export const TEXT_MW_CTX_HEADER = 'x-text-mw-ctx'

/** Timing metrics: `handlerStart,compileMs,renderMs`. */
export const TEXT_TIMING_HEADER = 'x-text-timing'

/** Build-time prerender authentication secret. */
export const TEXT_PRERENDER_SECRET_HEADER = 'x-text-prerender-secret'

/** URL-encoded JSON route params for build-time prerender renders. */
export const TEXT_PRERENDER_ROUTE_PARAMS_HEADER = 'x-text-prerender-route-params'

/** TPR (Tailored Per-Request) revalidation interval in seconds. */
export const TEXT_REVALIDATE_HEADER = 'x-text-revalidate'

/** Marker on cached ISR entries indicating RSC payload (value "1"). */
export const TEXT_RSC_MARKER_HEADER = 'x-text-rsc'

/** URL-encoded JSON route params carried on RSC responses. */
export const TEXT_PARAMS_HEADER = 'x-text-params'

/** Deduplicated, sorted list of mounted layout slots for cache keying. */
export const TEXT_MOUNTED_SLOTS_HEADER = 'x-text-mounted-slots'

/** Route interception context for parallel/intercepting routes. */
export const TEXT_INTERCEPTION_CONTEXT_HEADER = 'X-Text-Interception-Context'

/** RSC render mode (e.g. "navigation", "prefetch"). */
export const TEXT_RSC_RENDER_MODE_HEADER = 'X-Text-Rsc-Render-Mode'

/** Disabled-by-default client hint describing already-held App Router payload entries. */
export const TEXT_CLIENT_REUSE_MANIFEST_HEADER = 'X-Text-Client-Reuse-Manifest'

/**
 * Side-channel signal that an RSC response (HTTP 200) encodes a `redirect()`
 * thrown during render. The header value is the redirect target (path-only
 * for same-origin, absolute for cross-origin). The RSC payload body still carries
 * the canonical `TEXT_REDIRECT;...` digest so Text.js's own tests can read it
 * via response.body; this header is purely for text's own client
 * (`navigateRsc` in app-browser-entry.ts) to follow the redirect inside the
 * same navigation transaction — keeping `useTransition`'s pending state
 * continuous across the hop. Pre-1347 text relied on `fetch`'s auto-follow
 * of a 307 for that, but the new 200 + payload format leaves it without a
 * cheap way to detect the redirect ahead of stream decode.
 */
export const TEXT_RSC_REDIRECT_HEADER = 'X-Text-Rsc-Redirect'

// ---------------------------------------------------------------------------
// RSC protocol headers
// ---------------------------------------------------------------------------

/** Standard RSC header — value "1" indicates an RSC payload request. */
export const RSC_HEADER = 'RSC'

/** Server Action invocation header (text/vite-rsc protocol). */
export const RSC_ACTION_HEADER = 'x-rsc-action'

// ---------------------------------------------------------------------------
// Text.js compatibility headers
// ---------------------------------------------------------------------------

/** Text.js Server Action invocation header (fallback for x-rsc-action). */
export const TEXT_ACTION_HEADER = 'text-action'

/** Text.js action-not-found indicator (value "1"). */
export const TEXTJS_ACTION_NOT_FOUND_HEADER = 'x-textjs-action-not-found'

/** Forwarded action marker — set when a request has already been forwarded between workers. */
export const ACTION_FORWARDED_HEADER = 'x-action-forwarded'

// ---------------------------------------------------------------------------
// Server Action response headers (`x-action-*`)
// ---------------------------------------------------------------------------

/** Indicates revalidation occurred — value is JSON kind (1 = path/tag, 2 = dynamic-only). */
export const ACTION_REVALIDATED_HEADER = 'x-action-revalidated'

/** Redirect URL from a Server Action. */
export const ACTION_REDIRECT_HEADER = 'x-action-redirect'

/** Redirect type from a Server Action ("push" | "replace"). */
export const ACTION_REDIRECT_TYPE_HEADER = 'x-action-redirect-type'

/** HTTP status for a Server Action redirect (e.g. "308"). */
export const ACTION_REDIRECT_STATUS_HEADER = 'x-action-redirect-status'

// ---------------------------------------------------------------------------
// Middleware protocol headers (`x-middleware-*`)
// ---------------------------------------------------------------------------

/** Prefix for forwarded request headers (e.g. `x-middleware-request-cookie`). */
export const MIDDLEWARE_REQUEST_HEADER_PREFIX = 'x-middleware-request-'

/** Comma-separated list of header names that middleware wants to override. */
export const MIDDLEWARE_OVERRIDE_HEADERS = 'x-middleware-override-headers'

/** Carries cookies set by middleware for same-render reads. */
export const MIDDLEWARE_SET_COOKIE_HEADER = 'x-middleware-set-cookie'

/** Signal from `TextResponse.text()` — value "1" means "continue to text handler". */
export const MIDDLEWARE_TEXT_HEADER = 'x-middleware-text'

/** Rewrite destination URL set by `TextResponse.rewrite()`. */
export const MIDDLEWARE_REWRITE_HEADER = 'x-middleware-rewrite'

/** Redirect URL set by middleware. */
const MIDDLEWARE_REDIRECT_HEADER = 'x-middleware-redirect'

/** Skip-middleware signal. */
const MIDDLEWARE_SKIP_HEADER = 'x-middleware-skip'

/** Generic prefix for all middleware internal headers. */
export const MIDDLEWARE_HEADER_PREFIX = 'x-middleware-'

// ---------------------------------------------------------------------------
// Text.js / RSC middleware headers (forwarded through middleware)
// ---------------------------------------------------------------------------

export const TEXT_ROUTER_STATE_TREE_HEADER = 'Text-Router-State-Tree'
export const TEXT_ROUTER_PREFETCH_HEADER = 'Text-Router-Prefetch'
export const TEXT_ROUTER_SEGMENT_PREFETCH_HEADER = 'Text-Router-Segment-Prefetch'
export const TEXT_URL_HEADER = 'Text-Url'

/** Lowercase RSC middleware header variants used in middleware forwarding. */
export const FLIGHT_HEADERS: readonly string[] = [
  'rsc',
  'text-router-state-tree',
  'text-router-prefetch',
  'text-hmr-refresh',
  'text-router-segment-prefetch',
]

// ---------------------------------------------------------------------------
// Vercel / Now.sh legacy internal headers (stripped from inbound requests)
// ---------------------------------------------------------------------------

const NOW_ROUTE_MATCHES_HEADER = 'x-now-route-matches'
const MATCHED_PATH_HEADER = 'x-matched-path'
const TEXTJS_DATA_HEADER = 'x-textjs-data'
const TEXT_RESUME_STATE_LENGTH_HEADER = 'x-text-resume-state-length'

// ---------------------------------------------------------------------------
// Internal headers blocklist — stripped from inbound requests for security
// ---------------------------------------------------------------------------

/**
 * Headers that must be stripped from external requests before any handler
 * processes them. An attacker could forge these to influence routing or
 * impersonate internal data fetches.
 *
 * Ported from Text.js `INTERNAL_HEADERS`:
 * https://github.com/vercel/next.js/blob/canary/packages/text/src/server/lib/server-ipc/utils.ts
 */
export const INTERNAL_HEADERS = [
  MIDDLEWARE_REWRITE_HEADER,
  MIDDLEWARE_REDIRECT_HEADER,
  MIDDLEWARE_SET_COOKIE_HEADER,
  MIDDLEWARE_SKIP_HEADER,
  MIDDLEWARE_OVERRIDE_HEADERS,
  MIDDLEWARE_TEXT_HEADER,
  NOW_ROUTE_MATCHES_HEADER,
  MATCHED_PATH_HEADER,
  TEXTJS_DATA_HEADER,
  TEXT_RESUME_STATE_LENGTH_HEADER,
  ACTION_FORWARDED_HEADER,
]

/** Text-only internal headers stripped alongside Text.js protocol internals. */
export const TEXT_INTERNAL_HEADERS = [TEXT_PRERENDER_ROUTE_PARAMS_HEADER]
