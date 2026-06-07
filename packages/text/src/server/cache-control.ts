export const NEVER_CACHE_CONTROL = 'private, no-cache, no-store, max-age=0, must-revalidate'

export const STATIC_CACHE_CONTROL = 's-maxage=31536000, stale-while-revalidate'

const STALE_REVALIDATE_CACHE_CONTROL = 's-maxage=0, stale-while-revalidate'

export const NO_STORE_CACHE_CONTROL = 'no-store, must-revalidate'

/**
 * Matches Text.js's `getCacheControlHeader` stale window semantics while
 * preserving text's legacy unbounded SWR header when no expire ceiling is
 * available yet.
 *
 * Text.js source:
 * https://github.com/vercel/next.js/blob/canary/packages/text/src/server/lib/cache-control.ts
 */
export function buildRevalidateCacheControl(
  revalidateSeconds: number,
  expireSeconds?: number,
): string {
  if (expireSeconds === undefined) {
    return `s-maxage=${revalidateSeconds}, stale-while-revalidate`
  }

  // `expire <= revalidate` is a zero-width stale window: downstream caches
  // should refetch after s-maxage instead of serving stale.
  if (revalidateSeconds >= expireSeconds) {
    return `s-maxage=${revalidateSeconds}`
  }

  return `s-maxage=${revalidateSeconds}, stale-while-revalidate=${
    expireSeconds - revalidateSeconds
  }`
}

/**
 * Builds Cache-Control for ISR cache reads. HIT responses and STALE responses
 * with stored expire metadata use the same route policy because Text.js derives
 * this header from cache-control metadata, not from the cache hit/stale state.
 * STALE entries without expire metadata keep text's legacy `s-maxage=0`
 * fallback so older cache entries are not treated as newly fresh downstream.
 */
export function buildCachedRevalidateCacheControl(
  cacheState: 'HIT' | 'STALE',
  revalidateSeconds: number,
  expireSeconds?: number,
): string {
  if (revalidateSeconds === Infinity) {
    return STATIC_CACHE_CONTROL
  }

  // When expire is known, match Text.js and emit the route policy even for
  // text-served STALE entries. The hard-expire gate has already decided the
  // stale payload is still usable, and downstream caches should see the same
  // finite SWR window Text.js would emit from cacheControl metadata.
  if (cacheState === 'STALE' && expireSeconds === undefined) {
    return STALE_REVALIDATE_CACHE_CONTROL
  }

  return buildRevalidateCacheControl(revalidateSeconds, expireSeconds)
}
