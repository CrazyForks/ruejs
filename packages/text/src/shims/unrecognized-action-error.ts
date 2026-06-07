/**
 * Unrecognized server-action errors.
 *
 * When a server action call fails because the server did not recognize the
 * action id, the client bundle and the server are typically from different
 * deployments and a hard reload is required.
 *
 * This module is intentionally dependency-free: both the `text/navigation`
 * shim (which re-exports these for user code) and text's client
 * server-action dispatcher import `UnrecognizedActionError` from here, so the
 * `instanceof` check inside `unstable_isUnrecognizedActionError` resolves
 * against a single shared class.
 *
 * Ported 1:1 from Text.js:
 *   https://github.com/vercel/next.js/blob/canary/packages/text/src/client/components/unrecognized-action-error.ts
 */

/**
 * Error class for unrecognized server-action calls. Thrown by text's client
 * server-action dispatcher when the server reports the requested action id as
 * unknown (the `x-textjs-action-not-found` response header).
 */
export class UnrecognizedActionError extends Error {
  constructor(...args: ConstructorParameters<typeof Error>) {
    super(...args)
    this.name = 'UnrecognizedActionError'
  }
}

/**
 * Returns true if the error came from a server action whose id was not
 * recognized by the server. Useful inside `catch` blocks that surround
 * `await myAction(...)` calls; reloading the page generally fixes the
 * underlying client/server deployment mismatch.
 */
export function unstable_isUnrecognizedActionError(
  error: unknown,
): error is UnrecognizedActionError {
  return !!(error && typeof error === 'object' && error instanceof UnrecognizedActionError)
}
