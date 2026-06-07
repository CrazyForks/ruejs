import DefaultNotFound from '../shims/default-not-found.js'

/**
 * Module-shaped wrapper around text's built-in default not-found component.
 * Used as the fallback when an app does not define its own `app/not-found.tsx`
 * (and has not opted into `app/global-not-found.tsx`). The runtime treats any
 * `{ default: Component }` record as a "not-found module", so wrapping the
 * component this way lets us thread the default through the existing
 * `rootNotFoundModule` plumbing without introducing a parallel code path.
 *
 * Mirrors Text.js's `defaultNotFoundPath`
 * (`text/dist/client/components/builtin/not-found.js`), which is selected
 * automatically when the user has not supplied a custom not-found file:
 * https://github.com/vercel/next.js/blob/canary/packages/text/src/build/webpack/loaders/text-app-loader/index.ts
 */
export const DEFAULT_NOT_FOUND_MODULE = {
  default: DefaultNotFound,
} as const
