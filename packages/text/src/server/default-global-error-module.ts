import DefaultGlobalError from '../shims/default-global-error.js'

/**
 * Module-shaped wrapper around text's built-in default global error
 * component. Used as the fallback when an app does not define its own
 * `app/global-error.tsx`. The runtime treats any `{ default: Component }`
 * record as a "global error module", so wrapping the component this way lets
 * us thread the default through the existing `globalErrorModule` plumbing
 * without introducing a parallel code path.
 *
 * Mirrors Text.js's `defaultGlobalErrorPath`
 * (`text/dist/client/components/builtin/global-error.js`), which is selected
 * automatically when the user has not supplied a custom global error file:
 * https://github.com/vercel/next.js/blob/canary/packages/text/src/build/webpack/loaders/text-app-loader/index.ts
 */
export const DEFAULT_GLOBAL_ERROR_MODULE = {
  default: DefaultGlobalError,
} as const
