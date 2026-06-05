/**
 * Helpers for parsing Text.js error `digest` strings shared across the App
 * Router execution paths (server actions, page renders, route handlers).
 *
 * Text.js encodes special control flow as thrown errors carrying a `digest`
 * field with one of these formats:
 *  - `TEXT_REDIRECT;<type>;<encodedUrl>;<status>` — `redirect()` / `permanentRedirect()`
 *  - `TEXT_NOT_FOUND` — `notFound()`
 *  - `TEXT_HTTP_ERROR_FALLBACK;<status>` — `forbidden()` / `unauthorized()` / etc.
 *
 * Each call site needs slightly different post-processing (URL resolution
 * against the request, 303-vs-307 status overrides for actions, etc.), so
 * these helpers only handle the parsing — callers shape the result.
 */

type TextRedirectDigest = {
  status: number
  type: string | null
  url: string
}

type TextHttpErrorDigest = {
  status: number
}

/**
 * Pulls a stringified `digest` off an unknown thrown value, or returns null
 * when the value is not a digest-bearing error.
 */
export function getTextErrorDigest(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('digest' in error)) {
    return null
  }

  return String(error.digest)
}

/**
 * Parses a `TEXT_REDIRECT;<type>;<encodedUrl>;<status>` digest. Returns null
 * when the digest is not a redirect digest or the encoded URL segment is
 * missing. The `url` is decoded with `decodeURIComponent`; the `status`
 * defaults to 307 when omitted; an omitted `type` is left as null so the
 * caller can apply the correct context-sensitive default.
 */
export function parseTextRedirectDigest(digest: string): TextRedirectDigest | null {
  if (!digest.startsWith('TEXT_REDIRECT;')) {
    return null
  }

  const parts = digest.split(';')
  const encodedUrl = parts[2]
  if (!encodedUrl) {
    return null
  }

  const type = parts[1]

  return {
    status: parts[3] ? parseInt(parts[3], 10) : 307,
    type: type || null,
    url: decodeURIComponent(encodedUrl),
  }
}

/**
 * Parses a `TEXT_NOT_FOUND` or `TEXT_HTTP_ERROR_FALLBACK;<status>` digest.
 * Returns `{ status: 404 }` for `TEXT_NOT_FOUND` and the parsed status code
 * for the fallback form. Returns null otherwise.
 */
export function parseTextHttpErrorDigest(digest: string): TextHttpErrorDigest | null {
  if (digest === 'TEXT_NOT_FOUND') {
    return { status: 404 }
  }
  if (digest.startsWith('TEXT_HTTP_ERROR_FALLBACK;')) {
    return { status: parseInt(digest.split(';')[1], 10) }
  }
  return null
}
