// oxlint-disable typescript/consistent-type-definitions

/**
 * Global ambient type declarations for text runtime globals.
 *
 * These globals are injected at various points in the text lifecycle:
 *
 * - Window globals: set by the browser entry / RSC browser entry / server-rendered
 *   inline scripts; read by navigation shims and router shims.
 * - globalThis globals: set at build time (injected into the Cloudflare Worker entry)
 *   or at server startup; read during SSR to collect asset tags.
 * - process.env defines: replaced at compile time by Vite's `define` transform;
 *   read by image and draft-mode shims.
 *
 * Declaring them here removes all `(window as any)` and `(globalThis as any)`
 * escape hatches scattered across the source files.
 */

import type { OnRequestErrorHandler } from './server/instrumentation'
import type { AppBrowserRueRoot } from './server/app-browser-hydration'
import type { CachedRscResponse, PrefetchCacheEntry } from 'text/shims/navigation'
import type { PagesClientRoot } from './client/pages-renderer-adapter'
import type { TextCompatComponentType } from './shims/text-compat-types'

type LegacyClientRoot = {
  render(children: unknown): void
  unmount(): void
}

// `window.text` is declared inline in `./client/window-text.ts` (mirroring
// Text.js's own pattern in `packages/text/src/client/text.ts`), not here, so
// the type is co-located with the installer that owns the runtime shape.

// ---------------------------------------------------------------------------
// Window globals — browser-side state shared across module boundaries
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    // ── Pages Router ────────────────────────────────────────────────────────

    /**
     * The Pages Router client root.
     * Set by the generated client entry (`entries/pages-client-entry.ts`) after
     * hydration. Read by `shims/router.ts` to call `root.render()` during
     * navigation. Legacy roots remain accepted for older generated entries,
     * while the adapter root can switch between historical and Rue renderables.
     */
    __TEXT_ROOT__: LegacyClientRoot | PagesClientRoot | undefined

    /**
     * High-resolution timestamp recorded after client hydration is usable.
     * Pages Router writes after hydrateRoot() returns; App Router writes after
     * the first committed tree attaches browser router state.
     */
    __TEXT_HYDRATED_AT: number | undefined

    /**
     * Text.js test/runtime compatibility hydration marker.
     */
    __TEXT_HYDRATED: boolean | undefined
    __TEXT_HYDRATED_AT: number | undefined
    __TEXT_HYDRATED_CB: (() => void) | undefined

    /**
     * The cached `_app` component for Pages Router.
     * Written and read by `shims/router.ts` to avoid re-importing on every
     * client-side navigation.
     */
    __TEXT_APP__:
      | TextCompatComponentType<{
          Component: TextCompatComponentType<Record<string, unknown>>
          pageProps: Record<string, unknown>
        }>
      | undefined

    /**
     * Pages Router code-split loader map. Keys are route patterns in Text.js
     * bracket format (e.g. `/blog/[slug]`), values are dynamic `import()`
     * thunks that resolve to the page module. Vite code-splits each thunk
     * into its own chunk, so this is the manifest the client uses to load
     * the right page chunk on a client-side `_text/data` navigation.
     *
     * Set by the generated client entry (`entries/pages-client-entry.ts`)
     * before `hydrate()`. Read by `shims/router.ts` `navigateClient` after a
     * successful `/_text/data/<buildId>/<page>.json` fetch.
     *
     * `undefined` during SSR and on the very first hydration tick.
     */
    __TEXT_PAGE_LOADERS__:
      | Record<string, () => Promise<{ default?: unknown; [key: string]: unknown }>>
      | undefined

    /**
     * Pages Router pattern list. The route patterns (Text.js bracket format)
     * keyed in `__TEXT_PAGE_LOADERS__`, in priority order (longest specific
     * pattern first, catch-alls last). Used by `shims/router.ts` to match an
     * incoming URL pathname to a registered loader.
     */
    __TEXT_PAGE_PATTERNS__: string[] | undefined

    /**
     * Pages Router `_app` loader. Dynamic `import()` thunk for the user's
     * `pages/_app.tsx` module, or `undefined` when the app has no `_app`.
     * Set by the generated client entry; read by `shims/router.ts`
     * `navigateClient` to lazy-load `_app` on the first client-side
     * navigation.
     */
    __TEXT_APP_LOADER__: (() => Promise<{ default?: unknown; [key: string]: unknown }>) | undefined

    /**
     * The current active locale for Pages Router internationalisation.
     * Injected as an inline `<script>` by the dev/prod server.
     */
    __TEXT_LOCALE__: string | undefined

    /**
     * All configured locales for Pages Router internationalisation.
     * Injected as an inline `<script>` by the dev/prod server.
     */
    __TEXT_LOCALES__: string[] | undefined

    /**
     * The default locale for Pages Router internationalisation.
     * Injected as an inline `<script>` by the dev/prod server.
     */
    __TEXT_DEFAULT_LOCALE__: string | undefined

    // ── App Router ──────────────────────────────────────────────────────────

    /**
     * The Rue root for App Router.
     * Set by the browser RSC entry after the initial root mount. Used by E2E
     * tests as a sentinel to detect that hydration has completed.
     */
    __TEXT_RSC_ROOT__: AppBrowserRueRoot | undefined

    /**
     * A Promise that resolves when the current in-flight popstate RSC navigation
     * finishes rendering.
     * Set by the popstate handler in the browser RSC entry; read by
     * `shims/navigation.ts` to defer scroll restoration until after new content
     * has painted.
     * `null` when no navigation is in flight.
     */
    __TEXT_RSC_PENDING__: Promise<void> | null | undefined

    /**
     * In-memory cache of prefetched RSC responses, keyed by `.rsc` URL.
     * Lazily initialised on `window` by `shims/navigation.ts` so the same Map
     * instance is shared between the navigation shim and the Link component.
     */
    __TEXT_RSC_PREFETCH_CACHE__: Map<string, PrefetchCacheEntry> | undefined

    /**
     * Set of RSC URLs that have already been prefetched (or are in-flight).
     * Prevents duplicate prefetch requests for the same URL.
     */
    __TEXT_RSC_PREFETCHED_URLS__: Set<string> | undefined

    // ── Text.js conventional globals ────────────────────────────────────────
    //
    // `__TEXT_DATA__` is already declared by `text/dist/client/index.d.ts` as
    // `TEXT_DATA` from `text/dist/shared/lib/utils`. We intentionally do NOT
    // re-declare it here to avoid type conflicts. text-specific extensions
    // (__text) are accessed via the `TextTextData` type in
    // `client/text-text-data.ts`.
    //
    // `window.text` is declared in `./client/window-text.ts` so its type
    // (`WindowText`) lives text to the installer that owns the runtime shape.
  }

  // ── self globals used inside server-injected inline scripts ───────────────
  //
  // `self` in a browser context is the same object as `window`, but the
  // inline scripts that push RSC chunks use `self` rather than `window` for
  // compatibility with Web Workers (where `window` is undefined).

  /**
   * Array of RSC payload chunks streamed progressively by the server
   * via inline `<script>` tags. Text chunks are stored directly; non-UTF-8
   * chunks are stored as `[3, base64]` binary chunks, matching Text.js'
   * inlined binary payload kind.
   * Each `<script>` calls `self.__TEXT_RSC_CHUNKS__.push(chunk)`.
   * The browser RSC entry monkey-patches this array's `push` method to feed the
   * active RSC stream consumer.
   */
  // oxlint-disable-text-line no-var
  var __TEXT_RSC_CHUNKS__: (string | [3, string])[] | undefined

  /**
   * Set to `true` by a final inline `<script>` when the server has finished
   * emitting all RSC chunks for the current request.
   * The browser RSC entry closes the `ReadableStream` when it sees this flag.
   */
  // oxlint-disable-text-line no-var
  var __TEXT_RSC_DONE__: boolean | undefined

  /**
   * Route params for the current page, embedded in `<head>` as a JSON inline
   * script so they are available synchronously before hydration.
   * Shape: `Record<string, string | string[]>` (same as Text.js `params`).
   */
  // oxlint-disable-text-line no-var
  var __TEXT_RSC_PARAMS__: Record<string, string | string[]> | undefined

  /**
   * Navigation context embedded by `generateSsrEntry()` for hydration
   * snapshot consistency. Contains the pathname and searchParams used
   * during SSR so `useSyncExternalStore` `getServerSnapshot` matches the
   * SSR-rendered HTML.
   * `searchParams` is serialised as an array of `[key, value]` pairs to
   * preserve duplicate keys (e.g. `?tag=a&tag=b`).
   */
  // oxlint-disable-text-line no-var
  var __TEXT_RSC_NAV__: { pathname: string; searchParams: [string, string][] } | undefined

  // ── globalThis globals — server-side / Cloudflare Workers ─────────────────
  //
  // These are injected into the Worker entry at build time by
  // `text:cloudflare-build`, or set at Node.js server startup by
  // `server/prod-server.ts`.  They are read during SSR by `collectAssetTags()`
  // in `index.ts`.

  /**
   * Vite SSR manifest injected into the Cloudflare Worker entry at build time.
   * Maps module file paths (relative to the project root) to the list of
   * associated JS / CSS asset filenames.
   * Read by `collectAssetTags()` to inject `<link rel="modulepreload">` and
   * `<link rel="stylesheet">` tags into the SSR HTML.
   */
  // oxlint-disable-text-line no-var
  var __TEXT_SSR_MANIFEST__: Record<string, string[]> | undefined

  /**
   * Array of chunk filenames that are only reachable via dynamic `import()`.
   * These chunks must NOT receive `<link rel="modulepreload">` tags because
   * they are fetched on demand (e.g. behind lazy component / `text/dynamic` boundaries).
   * Injected into the Worker entry at build time; also set at Node.js server
   * startup by `server/prod-server.ts`.
   */
  // oxlint-disable-text-line no-var
  var __TEXT_LAZY_CHUNKS__: string[] | undefined

  /**
   * The client entry JS filename (e.g. `"_text/static/entry-abc123.js"`) for Pages
   * Router builds.
   * Injected into the Worker entry at build time for Pages Router only.
   * App Router uses the RSC plugin's `loadBootstrapScriptContent` mechanism
   * instead.
   */
  // oxlint-disable-text-line no-var
  var __TEXT_CLIENT_ENTRY__: string | undefined

  /**
   * Current active locale, set on `globalThis` for server-side SSR rendering
   * (Pages Router with i18n).  Mirrors `window.__TEXT_LOCALE__` for use in
   * environments where `window` is not available (e.g. Cloudflare Workers).
   */
  // oxlint-disable-text-line no-var
  var __TEXT_LOCALE__: string | undefined

  /**
   * All configured locales, set on `globalThis` for server-side SSR rendering.
   */
  // oxlint-disable-text-line no-var
  var __TEXT_LOCALES__: string[] | undefined

  /**
   * Default locale, set on `globalThis` for server-side SSR rendering.
   * Also read client-side from `globalThis` in `shims/link.tsx` when `window`
   * is not yet available (e.g. during SSR of Link components).
   */
  // oxlint-disable-text-line no-var
  var __TEXT_DEFAULT_LOCALE__: string | undefined

  /**
   * Configured Pages Router domain locale mappings, set on `globalThis` for
   * server-side rendering so `text/link` can resolve cross-domain locale hrefs
   * before hydration.
   */
  // oxlint-disable-text-line no-var
  var __TEXT_DOMAIN_LOCALES__:
    | Array<{ domain: string; defaultLocale: string; locales?: string[]; http?: boolean }>
    | undefined

  /**
   * Current request hostname, set on `globalThis` during Pages Router SSR so
   * locale-domain links can decide whether to render relative or absolute
   * hrefs.
   */
  // oxlint-disable-text-line no-var
  var __TEXT_HOSTNAME__: string | undefined

  /**
   * The onRequestError handler registered by instrumentation.ts.
   * Set by the instrumentation.ts register() function.
   *
   * The handler is stored on `globalThis` so it is visible across the RSC and
   * SSR Vite environments (separate module graphs, same Node.js process). With
   * `@cloudflare/vite-plugin` it runs entirely inside the Worker, so
   * `globalThis` is the Worker's global — also correct.
   */
  // oxlint-disable-text-line no-var
  var __TEXT_onRequestErrorHandler__: OnRequestErrorHandler | undefined

  /**
   * Rue RSC's SSR-side client-reference module loader.
   * Set by `@rue-js/rsc` and read by the App Router SSR entry before
   * the SSR runtime consumes the payload stream, so first-request client references are
   * already resolved when the shell renders.
   */
  // oxlint-disable-text-line no-var
  var __rue_rsc_client_require__: ((id: string) => Promise<unknown>) | undefined

  /**
   * Legacy Vite RSC client-reference module loader name.
   */
  // oxlint-disable-text-line no-var
  var __vite_rsc_client_require__: ((id: string) => Promise<unknown>) | undefined
}

// ---------------------------------------------------------------------------
// process.features — Node.js v22.10.0+ feature flags
// ---------------------------------------------------------------------------
//
// `process.features.typescript` is available since Node.js v22.10.0 and
// indicates whether the runtime has built-in TypeScript support (--experimental-strip-types).
// Declared here so we don't have to cast `process.features as any` at the call site.

declare global {
  namespace NodeJS {
    interface ProcessFeatures {
      /** Available since Node.js v22.10.0. `true` when run with --experimental-strip-types. */
      typescript?: boolean
    }
  }
}

// ---------------------------------------------------------------------------
// process.env defines — compile-time Vite replacements
// ---------------------------------------------------------------------------
//
// These are replaced at bundle time by Vite's `define` transform in the
// text plugin (`index.ts`).  TypeScript needs to know they exist on
// `ProcessEnv` so we don't have to cast them to `string`.

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      /**
       * Build ID string injected via Vite `define` at production build time.
       * Matches `text.config.js` → `buildId` (or a generated UUID when unset).
       * `undefined` in dev mode.
       */
      __TEXT_BUILD_ID?: string

      /**
       * Public App Router RSC compatibility identity injected via Vite
       * `define`. Used by browser navigation code to reject RSC payloads from
       * a different text build without exposing the raw build ID header.
       */
      __TEXT_RSC_COMPATIBILITY_ID?: string

      /**
       * Deployment ID string injected via Vite `define` when
       * `TEXT_DEPLOYMENT_ID` is present at build time.
       */
      __TEXT_DEPLOYMENT_ID?: string

      /**
       * JSON-encoded array of `RemotePattern` objects from
       * `text.config.js` → `images.remotePatterns`.
       */
      __TEXT_IMAGE_REMOTE_PATTERNS?: string

      /**
       * JSON-encoded array of allowed hostname strings from
       * `text.config.js` → `images.domains` (legacy config).
       */
      __TEXT_IMAGE_DOMAINS?: string

      /**
       * JSON-encoded array of device width breakpoints (px) from
       * `text.config.js` → `images.deviceSizes`.
       */
      __TEXT_IMAGE_DEVICE_SIZES?: string

      /**
       * JSON-encoded array of image sizes (px) from
       * `text.config.js` → `images.sizes`.
       */
      __TEXT_IMAGE_SIZES?: string

      /**
       * `"true"` or `"false"` — whether SVG sources are allowed through the
       * image optimizer (`text.config.js` → `images.dangerouslyAllowSVG`).
       */
      __TEXT_IMAGE_DANGEROUSLY_ALLOW_SVG?: string

      /**
       * `"true"` or `"false"` — whether hostnames resolving to private IPs
       * are allowed (`text.config.js` → `images.dangerouslyAllowLocalIP`).
       */
      __TEXT_IMAGE_DANGEROUSLY_ALLOW_LOCAL_IP?: string

      /**
       * Text.js-compatible version string. text mirrors Text.js's
       * `process.env.__TEXT_VERSION` define (from
       * `packages/text/src/client/text.ts` line 5) so library code that
       * reads it works unmodified. Value is the text package version,
       * injected by the plugin at build time.
       */
      __TEXT_VERSION?: string
    }
  }
}

// ---------------------------------------------------------------------------
// node:http augmentations — text properties added to IncomingMessage
// ---------------------------------------------------------------------------

declare module 'node:http' {
  interface IncomingMessage {
    /**
     * The HTTP status code set by text middleware for Pages Router continue
     * or rewrite responses. Written in `index.ts` when middleware emits a
     * status override, read by the downstream Pages Router handler to decide
     * the final response status.
     */
    __textMiddlewareStatus?: number
  }
}

// The `import type { Root }` at the top of this file makes it a TypeScript
// module (rather than a script), which is required for `declare global` blocks
// to act as global augmentations.
