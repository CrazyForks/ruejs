import { TEXTJS_CACHE_HEADER, TEXT_CACHE_HEADER, TEXT_LEGACY_CACHE_HEADER } from './headers.js'

type TextCacheState = 'HIT' | 'MISS' | 'STALE' | 'STATIC'
type TextJsCacheState = 'HIT' | 'MISS' | 'STALE'

function toTextJsCacheState(cacheState: TextCacheState): TextJsCacheState {
  return cacheState === 'STATIC' ? 'HIT' : cacheState
}

export function setCacheStateHeaders(headers: Headers, cacheState: TextCacheState): void {
  headers.set(TEXT_CACHE_HEADER, cacheState)
  if (TEXT_LEGACY_CACHE_HEADER.toLowerCase() !== TEXT_CACHE_HEADER.toLowerCase()) {
    headers.set(TEXT_LEGACY_CACHE_HEADER, cacheState)
  }
  headers.set(TEXTJS_CACHE_HEADER, toTextJsCacheState(cacheState))
}

export function buildCacheStateHeaders(cacheState: TextCacheState): Record<string, string> {
  const headers = {
    [TEXT_CACHE_HEADER]: cacheState,
    [TEXTJS_CACHE_HEADER]: toTextJsCacheState(cacheState),
  }
  if (TEXT_LEGACY_CACHE_HEADER.toLowerCase() !== TEXT_CACHE_HEADER.toLowerCase()) {
    headers[TEXT_LEGACY_CACHE_HEADER] = cacheState
  }
  return headers
}
