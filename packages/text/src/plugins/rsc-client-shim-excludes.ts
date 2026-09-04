const RSC_CLIENT_SHIM_OPTIMIZE_DEPS_EXCLUDE = Object.freeze([
  // @vitejs/plugin-rsc tracks package client references by the original
  // bare source. If Vite pre-bundles these known client shims, the generated
  // client-package proxy can lose the matching export metadata in dev.
  'text/shims/error-boundary',
  'text/shims/form',
  'text/shims/layout-segment-context',
  'text/shims/link',
  'text/shims/script',
  'text/shims/slot',
  'text/shims/offline',
])

const RUE_RUNTIME_OPTIMIZE_DEPS_EXCLUDE = Object.freeze([
  '@rue-js/rue',
  '@rue-js/rue/internal',
  '@rue-js/rue/server-renderer',
  '@rue-js/runtime',
  '@rue-js/runtime/internal',
  '@rue-js/runtime/server',
  '@rue-js/server-renderer',
])

export const TEXT_OPTIMIZE_DEPS_EXCLUDE = Object.freeze([
  'text',
  '@vercel/og',
  // Aliased to the user's instrumentation-client source file (or an empty
  // shim). Not a real npm dep, so pre-bundling it would break HMR and cause
  // a "new dependencies optimized" reload on the first request.
  'private-text-instrumentation-client',
  ...RUE_RUNTIME_OPTIMIZE_DEPS_EXCLUDE,
  ...RSC_CLIENT_SHIM_OPTIMIZE_DEPS_EXCLUDE,
])

export function mergeOptimizeDepsExclude(
  ...excludeGroups: readonly (readonly string[])[]
): string[] {
  const seen = new Set<string>()

  for (const group of excludeGroups) {
    for (const entry of group) {
      if (seen.has(entry)) continue
      seen.add(entry)
    }
  }

  return [...seen]
}
