import { resolveRuntimeEntryModule } from './runtime-entry-module.js'

/**
 * Generate the virtual SSR entry module.
 *
 * This runs in the `ssr` Vite environment. It receives an App payload stream,
 * deserializes it to a server element tree, and renders to HTML.
 *
 * When `hasPagesDir` is true (hybrid App + Pages Router project), the SSR
 * entry also re-exports selected Pages server entry hooks from
 * `virtual:text-server-entry` so the RSC bundle can access Pages Router
 * route metadata and fallback dispatchers via `import("./ssr/index.js")`.
 */
export function generateSsrEntry(hasPagesDir = false): string {
  const entryPath = resolveRuntimeEntryModule('app-ssr-entry')

  return `
export * from ${JSON.stringify(entryPath)};
export { default } from ${JSON.stringify(entryPath)};
${
  hasPagesDir
    ? `
export { handleApiRoute, pageRoutes, renderPage } from "virtual:text-server-entry";
`
    : ''
}`
}
