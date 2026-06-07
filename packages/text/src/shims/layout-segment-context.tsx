'use client'

/**
 * Layout segment context provider.
 *
 * Must be "use client" so that Vite's RSC bundler renders this component in
 * the SSR/browser environment where the compat context runtime is available. The RSC
 * entry imports and renders LayoutSegmentProvider directly, but because of the
 * "use client" boundary the actual execution happens on the SSR/client side
 * where the context can be created and consumed by useSelectedLayoutSegment(s).
 *
 * Without "use client", this runs in the RSC environment where
 * the compat context runtime is unavailable, getLayoutSegmentContext() returns null,
 * the provider becomes a no-op, and useSelectedLayoutSegments always returns [].
 *
 * The context is shared with navigation.ts via getLayoutSegmentContext()
 * to avoid creating separate contexts in different modules.
 */
export { LayoutSegmentProvider } from './layout-segment-context-core.js'
export type { SegmentMap } from './navigation.js'
