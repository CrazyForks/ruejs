/**
 * Pages Router client hydration entry generator.
 *
 * Generates the virtual client entry module (`virtual:text-client-entry`).
 * This is the entry point for `vite build` (client bundle). It maps route
 * patterns to dynamic imports of page modules so Vite code-splits each page
 * into its own chunk. At runtime it reads __TEXT_DATA__ to determine which
 * page to hydrate.
 *
 * Extracted from index.ts.
 */
import {
  pagesRouter,
  patternToTextFormat as pagesPatternToTextFormat,
  type Route,
} from '../routing/pages-router.js'
import { createValidFileMatcher } from '../routing/file-matcher.js'
import { type ResolvedTextConfig } from '../config/text-config.js'
import { findFileWithExts } from './pages-entry-helpers.js'
import {
  normalizePathSeparators,
  resolveClientRuntimeModule,
  resolveShimRuntimeModule,
} from './runtime-entry-module.js'

const _instrumentationClientPath = resolveClientRuntimeModule('instrumentation-client')
const _pagesRouterRuntimePath = resolveShimRuntimeModule('pages-router-runtime')
const _pagesRendererAdapterPath = resolveClientRuntimeModule('pages-renderer-adapter')

export async function generateClientEntry(
  pagesDir: string,
  textConfig: ResolvedTextConfig,
  fileMatcher: ReturnType<typeof createValidFileMatcher>,
): Promise<string> {
  const pageRoutes = await pagesRouter(pagesDir, textConfig?.pageExtensions, fileMatcher)

  const appFilePath = findFileWithExts(pagesDir, '_app', fileMatcher)
  const hasApp = appFilePath !== null

  // Build a map of route pattern -> dynamic import.
  // Keys must use Text.js bracket format (e.g. "/user/[id]") to match
  // __TEXT_DATA__.page which is set via patternToTextFormat() during SSR.
  const loaderEntries = pageRoutes.map((r: Route) => {
    const absPath = normalizePathSeparators(r.filePath)
    const textFormatPattern = pagesPatternToTextFormat(r.pattern)
    // JSON.stringify safely escapes quotes, backslashes, and special chars in
    // both the route pattern and the absolute file path.
    // lgtm[js/bad-code-sanitization]
    return `  ${JSON.stringify(textFormatPattern)}: () => import(${JSON.stringify(absPath)})`
  })

  const appFileBase = appFilePath ? normalizePathSeparators(appFilePath) : undefined

  return `
import ${JSON.stringify(_instrumentationClientPath)};
import { installPagesRouterRuntime } from ${JSON.stringify(_pagesRouterRuntimePath)};
import { createPagesClientElement, hydratePagesClientRoot } from ${JSON.stringify(_pagesRendererAdapterPath)};
// Statically import text/router as the very first text shim so that
// (a) installWindowText runs at top-level — \`window.text.router\` is
//     available to test harnesses and third-party scripts BEFORE
//     hydrate() resolves (see .textjs-ref/packages/text/src/client/text.ts
//     line 13, which also sets window.text as a top-level side effect),
// and (b) the popstate handler is registered before
//     installPagesRouterRuntime() runs, removing the race window where a
//     popstate event could fire between hydration and runtime install.
//
// Mirrors Text.js's bootstrap order: client/text.ts statically imports
// from './' before calling initialize/hydrate, so window.text is set up
// before any async work.
import { wrapWithRouterContext } from "text/router";

const pageLoaders = {
${loaderEntries.join(',\n')}
};
${
  hasApp
    ? `
const appLoader = () => import(${JSON.stringify(appFileBase!)});
`
    : `
const appLoader = undefined;
`
}
// Expose the code-split loader manifest on window so client-side
// _text/data navigations in shims/router.ts can resolve the correct page
// chunk for any route. Without this, navigateClient() would have to extract
// the chunk URL from an HTML response — the whole point of switching to the
// JSON data endpoint is to avoid that round trip.
//
// Keys are route patterns in Text.js bracket format (matching __TEXT_DATA__.page
// and the keys of pageLoaders above). The patterns list is the same as
// Object.keys(pageLoaders), exposed separately so navigateClient() can iterate
// it without re-keying the map. Ordering is the insertion order of pageRoutes,
// which pagesRouter() has already sorted by specificity (static → dynamic →
// catch-all → optional catch-all) via compareRoutes — so matchPagesPattern()
// can iterate in order and trust the first match.
window.__TEXT_PAGE_LOADERS__ = pageLoaders;
window.__TEXT_PAGE_PATTERNS__ = Object.keys(pageLoaders);
window.__TEXT_APP_LOADER__ = appLoader;

async function hydrate() {
  const textData = window.__TEXT_DATA__;
  if (!textData) {
    console.error("[text] No __TEXT_DATA__ found");
    return;
  }

  const { pageProps } = textData.props;
  const loader = pageLoaders[textData.page];
  if (!loader) {
    console.error("[text] No page loader for route:", textData.page);
    return;
  }

  const pageModule = await loader();
  const PageComponent = pageModule.default;
  if (!PageComponent) {
    console.error("[text] Page module has no default export");
    return;
  }

  let element;
  ${
    hasApp
      ? `
  try {
    const appModule = await appLoader();
    const AppComponent = appModule.default;
    window.__TEXT_APP__ = AppComponent;
    element = createPagesClientElement({
      AppComponent,
      PageComponent,
      pageProps,
      wrapWithRouterContext,
    });
  } catch {
    element = createPagesClientElement({
      PageComponent,
      pageProps,
      wrapWithRouterContext,
    });
  }
  `
      : `
  element = createPagesClientElement({
    PageComponent,
    pageProps,
    wrapWithRouterContext,
  });
  `
  }

  const container = document.getElementById("__text");
  if (!container) {
    console.error("[text] No #__text element found");
    return;
  }

  const root = hydratePagesClientRoot(container, element);
  window.__TEXT_ROOT__ = root;
  installPagesRouterRuntime();
  const hydratedAt = performance.now();
  window.__TEXT_HYDRATED_AT = hydratedAt;
  window.__TEXT_HYDRATED = true;
  window.__TEXT_HYDRATED_AT = hydratedAt;
  window.__TEXT_HYDRATED_CB?.();
}

hydrate();
`
}
