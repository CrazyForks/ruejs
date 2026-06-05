import { throwClientHookError } from './client-hook-error.js'

// Re-export server-safe APIs from the canonical navigation module.
// This import uses a relative path to the source file, which does NOT
// go through the `text/navigation` resolveId hook — so it always
// resolves to the full module, avoiding a circular redirect.
export {
  // Types
  type NavigationContext,
  type SegmentMap,

  // Server-side navigation state
  GLOBAL_ACCESSORS_KEY,
  _registerStateAccessors,
  getNavigationContext,
  setNavigationContext,

  // Layout segment context (returns null in RSC — createContext unavailable)
  getLayoutSegmentContext,
  ServerInsertedHTMLContext,

  // Server-inserted HTML
  flushServerInsertedHTML,
  renderServerInsertedHTML,
  clearServerInsertedHTML,

  // Control-flow errors
  HTTP_ERROR_FALLBACK_ERROR_CODE,
  isHTTPAccessFallbackError,
  getAccessFallbackHTTPStatus,
  RedirectType,
  redirect,
  permanentRedirect,
  notFound,
  forbidden,
  unauthorized,

  // Internal-error predicates and rethrow.
  //
  // These are environment-agnostic (no Rue hooks, no browser globals), so
  // we re-export the canonical implementation from `./navigation.js` to keep
  // a single source of truth across the rue-server and client conditions.
  //
  // Ported from Text.js:
  //   https://github.com/vercel/next.js/blob/canary/packages/text/src/client/components/navigation.rue-server.ts
  // where `unstable_rethrow` is also re-exported in the rue-server build.
  isRedirectError,
  isTextRouterError,
  isBailoutToCSRError,
  isDynamicServerError,
  BailoutToCSRError,
  DynamicServerError,
  unstable_rethrow,

  // Utilities
  ReadonlyURLSearchParams,
} from './navigation.js'

// These hooks are client-only. Exporting error-throwing stubs (rather than
// omitting them entirely) gives developers a clear, actionable error message
// instead of the cryptic "is not a function" that Vite's runtime module
// system produces for missing exports.

export function usePathname(): never {
  throwClientHookError('usePathname()')
}

export function useSearchParams(): never {
  throwClientHookError('useSearchParams()')
}

export function useParams(): never {
  throwClientHookError('useParams()')
}

export function useRouter(): never {
  throwClientHookError('useRouter()')
}

export function useSelectedLayoutSegment(): never {
  throwClientHookError('useSelectedLayoutSegment()')
}

export function useSelectedLayoutSegments(): never {
  throwClientHookError('useSelectedLayoutSegments()')
}

export function useServerInsertedHTML(): never {
  throwClientHookError('useServerInsertedHTML()')
}

// `unstable_isUnrecognizedActionError` is client-only: server actions cannot
// fail with "unrecognized action" inside the Rue-server render path because
// they execute synchronously against the action manifest. Calling this from a
// Server Component is always a programming error.
//
// Ported from Text.js:
//   https://github.com/vercel/next.js/blob/canary/packages/text/src/client/components/navigation.rue-server.ts
// which throws the same diagnostic message from the rue-server condition.
export function unstable_isUnrecognizedActionError(): boolean {
  throw new Error('`unstable_isUnrecognizedActionError` can only be used on the client.')
}
