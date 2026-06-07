/**
 * Shim for text/dist/shared/lib/app-router-context.shared-runtime
 *
 * Used by: @clerk/textjs, text-intl, text-nprogress-bar, textjs-toploader,
 * text-view-transitions. Mostly type-only imports in published .d.ts files.
 *
 * We export the types and minimal context objects so these libraries resolve.
 */
import { getOrCreateTextCompatContext, type TextCompatContext } from '../context-adapter.js'

export type NavigateOptions = {
  scroll?: boolean
}

export type PrefetchOptions = {
  kind?: unknown
  onInvalidate?: () => void
}

export type AppRouterInstance = {
  bfcacheId: string
  back(): void
  forward(): void
  refresh(): void
  push(href: string, options?: NavigateOptions): void
  replace(href: string, options?: NavigateOptions): void
  prefetch(href: string, options?: PrefetchOptions): void
}

const APP_ROUTER_CONTEXT_KEY = Symbol.for('text.appRouterContext')
const GLOBAL_LAYOUT_ROUTER_CONTEXT_KEY = Symbol.for('text.globalLayoutRouterContext')
const LAYOUT_ROUTER_CONTEXT_KEY = Symbol.for('text.layoutRouterContext')
const MISSING_SLOT_CONTEXT_KEY = Symbol.for('text.missingSlotContext')
const TEMPLATE_CONTEXT_KEY = Symbol.for('text.templateContext')

function getOrCreateContext<T>(key: symbol, defaultValue: T): TextCompatContext<T> | null {
  // Boundary assertion: symbol-keyed global storage preserves context identity
  // across duplicate module instances while keeping the public exports typed.
  return getOrCreateTextCompatContext(key, defaultValue)
}

export const AppRouterContext: TextCompatContext<AppRouterInstance | null> | null =
  getOrCreateContext<AppRouterInstance | null>(APP_ROUTER_CONTEXT_KEY, null)
export const GlobalLayoutRouterContext: TextCompatContext<unknown> | null =
  getOrCreateContext<unknown>(GLOBAL_LAYOUT_ROUTER_CONTEXT_KEY, null)
export const LayoutRouterContext: TextCompatContext<unknown> | null = getOrCreateContext<unknown>(
  LAYOUT_ROUTER_CONTEXT_KEY,
  null,
)
export const MissingSlotContext: TextCompatContext<Set<string>> | null = getOrCreateContext(
  MISSING_SLOT_CONTEXT_KEY,
  new Set(),
)
export const TemplateContext: TextCompatContext<unknown> | null = getOrCreateContext<unknown>(
  TEMPLATE_CONTEXT_KEY,
  null,
)
