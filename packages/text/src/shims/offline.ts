/**
 * text/offline shim
 *
 * Stub for the experimental `useOffline()` hook added in Text.js
 * (vercel/text.js#92012). Returns `false` (online) unconditionally.
 * Full offline retry behavior (navigation retry, prefetch pause/resume,
 * OfflineProvider) will be implemented once the feature stabilizes upstream.
 */
'use client'

export function useOffline(): boolean {
  return false
}
