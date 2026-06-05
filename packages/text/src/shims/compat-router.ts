/**
 * text/compat/router shim
 *
 * Designed for components that can be shared between app/ and pages/.
 * Unlike text/router, this hook returns null instead of throwing when
 * the Pages Router is not mounted (e.g., in App Router context).
 */
import { RouterContext } from './internal/router-context.js'
import { useTextCompatContext } from './context-adapter.js'
import { getSSRRouter, type TextRouter } from './router.js'

/**
 * useRouter from `text/compat/router` is designed to assist developers
 * migrating from `pages/` to `app/`. Unlike `text/router`, this hook does not
 * throw when the `TextRouter` is not mounted, and instead returns `null`. The
 * more concrete return type here lets developers use this hook within
 * components that could be shared between both `app/` and `pages/` and handle
 * to the case where the router is not mounted.
 *
 * This remains a minimal Rue hook facade because the public compat API is
 * consumed from component modules and must read the same RouterContext provider
 * as `text/router`.
 *
 * @returns The `TextRouter` instance if it's available, otherwise `null`.
 */
export function useRouter(): TextRouter | null {
  const router = useTextCompatContext(RouterContext)
  if (router) return router
  if (typeof window === 'undefined') return getSSRRouter()
  return null
}
