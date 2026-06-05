/**
 * Shim for text/dist/shared/lib/router-context.shared-runtime
 *
 * Used by: some testing utilities and older libraries.
 * Provides the Pages Router context.
 */
import type { TextRouter } from '../router'
import { createRequiredTextCompatContext } from '../context-adapter.js'

const ROUTER_CONTEXT_KEY = Symbol.for('text.pagesRouterContext')

export const RouterContext = createRequiredTextCompatContext<TextRouter | null>(
  ROUTER_CONTEXT_KEY,
  null,
)
