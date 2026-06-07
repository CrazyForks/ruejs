/**
 * Shim for text/dist/server/web/spec-extension/cookies
 * and text/dist/compiled/@edge-runtime/cookies
 *
 * Used by: text-intl (type-only), test utilities.
 * Re-exports from our server shim's cookie implementations.
 */
export { RequestCookies, ResponseCookies } from '../server.js'
