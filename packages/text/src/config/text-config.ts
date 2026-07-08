/**
 * text.config.js / text.config.mjs / text.config.ts parser
 *
 * Loads the text config file (if present) and extracts supported options.
 * Unsupported options are logged as warnings.
 */
import path from 'node:path'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import commonjs from 'vite-plugin-commonjs'
import { PHASE_DEVELOPMENT_SERVER } from '../shims/constants.js'
import { normalizePageExtensions } from '../routing/file-matcher.js'
import { getHtmlLimitedBotRegex } from '../utils/html-limited-bots.js'
import { isUnknownRecord } from '../utils/record.js'
import { applyLocaleToRoutes, isExternalUrl } from './config-matchers.js'
import { loadTsconfigPathAliasesForRoot } from './tsconfig-paths.js'

/**
 * Parse a body size limit value (string or number) into bytes.
 * Accepts Text.js-style strings like "1mb", "500kb", "10mb", bare number strings like "1048576" (bytes),
 * and numeric values. Supports b, kb, mb, gb, tb, pb units.
 * Returns the default 1MB if the value is not provided or invalid.
 * Throws if the parsed value is less than 1.
 */
export function parseBodySizeLimit(value: string | number | undefined | null): number {
  if (value === undefined || value === null) return 1 * 1024 * 1024
  if (typeof value === 'number') {
    if (value < 1) throw new Error(`Body size limit must be a positive number, got ${value}`)
    return value
  }
  const trimmed = value.trim()
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb|tb|pb)?$/i)
  if (!match) {
    console.warn(
      `[text] Invalid bodySizeLimit value: "${value}". Expected a number or a string like "1mb", "500kb". Falling back to 1MB.`,
    )
    return 1 * 1024 * 1024
  }
  const num = parseFloat(match[1])
  const unit = (match[2] ?? 'b').toLowerCase()
  let bytes: number
  switch (unit) {
    case 'b':
      bytes = Math.floor(num)
      break
    case 'kb':
      bytes = Math.floor(num * 1024)
      break
    case 'mb':
      bytes = Math.floor(num * 1024 * 1024)
      break
    case 'gb':
      bytes = Math.floor(num * 1024 * 1024 * 1024)
      break
    case 'tb':
      bytes = Math.floor(num * 1024 * 1024 * 1024 * 1024)
      break
    case 'pb':
      bytes = Math.floor(num * 1024 * 1024 * 1024 * 1024 * 1024)
      break
    default:
      return 1 * 1024 * 1024
  }
  if (bytes < 1) throw new Error(`Body size limit must be a positive number, got ${bytes}`)
  return bytes
}

export type HasCondition = {
  type: 'header' | 'cookie' | 'query' | 'host'
  key: string
  value?: string
}

export type TextRedirect = {
  source: string
  destination: string
  permanent: boolean
  has?: HasCondition[]
  missing?: HasCondition[]
  /**
   * When true (the default with i18n configured), Text.js prepends an internal
   * locale alternation to the source so the rule matches locale-prefixed paths.
   * When `false`, the source is left untouched and matches the raw path,
   * letting user-supplied `:locale` segments capture the prefix themselves.
   * See https://textjs.org/docs/app/api-reference/config/text-config-js/redirects#locale
   */
  locale?: false
  /**
   * When `false`, the rule is NOT prefixed with `basePath`. Source and
   * destination are matched/applied verbatim. Mirrors Text.js's
   * `Redirect.basePath: false` opt-out — see
   * `.textjs-ref/packages/text/src/lib/load-custom-routes.ts:26`.
   */
  basePath?: false
}

export type TextRewrite = {
  source: string
  destination: string
  has?: HasCondition[]
  missing?: HasCondition[]
  /** See {@link TextRedirect.locale}. */
  locale?: false
  /** See {@link TextRedirect.basePath}. */
  basePath?: false
}

export type TextHeader = {
  source: string
  has?: HasCondition[]
  missing?: HasCondition[]
  headers: Array<{ key: string; value: string }>
  /** See {@link TextRedirect.basePath}. */
  basePath?: false
}

export type TextI18nConfig = {
  /** List of supported locales */
  locales: string[]
  /** The default locale (used when no locale prefix is in the URL) */
  defaultLocale: string
  /**
   * Whether to auto-detect locale from Accept-Language header.
   * Defaults to true in Text.js.
   */
  localeDetection?: boolean
  /**
   * Domain-based routing. Each domain maps to a specific locale.
   */
  domains?: Array<{
    domain: string
    defaultLocale: string
    locales?: string[]
    http?: boolean
  }>
}

/**
 * MDX compilation options extracted from @text/mdx config.
 * These are passed through to @mdx-js/rollup so that custom
 * remark/rehype/recma plugins configured in text.config work with Vite.
 */
export type MdxOptions = {
  remarkPlugins?: unknown[]
  rehypePlugins?: unknown[]
  recmaPlugins?: unknown[]
}

export type TextConfig = {
  /** Additional env variables */
  env?: Record<string, string>
  /** Base URL path prefix */
  basePath?: string
  /**
   * Prefix applied to every emitted JS/CSS/image/static asset URL.
   * Accepts a path prefix (e.g. `/custom-asset-prefix`) or an absolute
   * URL (e.g. `https://cdn.example.com`). Distinct from `basePath`:
   * `basePath` affects route URLs; `assetPrefix` only affects asset URLs.
   * @see https://textjs.org/docs/app/api-reference/config/text-config-js/assetPrefix
   */
  assetPrefix?: string
  /** Whether to add trailing slashes */
  trailingSlash?: boolean
  /** Internationalization routing config */
  i18n?: TextI18nConfig
  /** URL redirect rules */
  redirects?: () => Promise<TextRedirect[]> | TextRedirect[]
  /** URL rewrite rules */
  rewrites?: () =>
    | Promise<
        | TextRewrite[]
        | {
            beforeFiles: TextRewrite[]
            afterFiles: TextRewrite[]
            fallback: TextRewrite[]
          }
      >
    | TextRewrite[]
    | {
        beforeFiles: TextRewrite[]
        afterFiles: TextRewrite[]
        fallback: TextRewrite[]
      }
  /** Custom response headers */
  headers?: () => Promise<TextHeader[]> | TextHeader[]
  /** Image optimization config */
  images?: {
    remotePatterns?: Array<{
      protocol?: string
      hostname: string
      port?: string
      pathname?: string
      search?: string
    }>
    domains?: string[]
    unoptimized?: boolean
    /** Allowed device widths for image optimization. Defaults to Text.js defaults: [640, 750, 828, 1080, 1200, 1920, 2048, 3840] */
    deviceSizes?: number[]
    /** Allowed image sizes for fixed-width images. Defaults to Text.js defaults: [16, 32, 48, 64, 96, 128, 256, 384] */
    imageSizes?: number[]
    /** Allow SVG images through the image optimization endpoint. SVG can contain scripts, so only enable if you trust all image sources. */
    dangerouslyAllowSVG?: boolean
    /** Allow image optimization for hostnames that resolve to private IP addresses. This is a security risk (SSRF) — only enable for private networks when you understand the risk. */
    dangerouslyAllowLocalIP?: boolean
    /** Content-Disposition header for image responses. Defaults to "inline". */
    contentDispositionType?: 'inline' | 'attachment'
    /** Content-Security-Policy header for image responses. Defaults to "script-src 'none'; frame-src 'none'; sandbox;" */
    contentSecurityPolicy?: string
  }
  /** Build output mode: 'export' for full static export, 'standalone' for single server */
  output?: 'export' | 'standalone'
  /** File extensions treated as routable pages/routes (Text.js pageExtensions) */
  pageExtensions?: string[]
  /**
   * Module specifiers that are required for side effects on the client before
   * hydration, in array order, ahead of the user's `instrumentation-client.{ts,js}`.
   * Each entry may be a bare npm package name or a path relative to the project root.
   */
  instrumentationClientInject?: string[]
  /** Extra origins allowed to access the dev server. */
  allowedDevOrigins?: string[]
  /** Maximum age in seconds for stale ISR entries before blocking regeneration. */
  expireTime?: number
  /** User agents that require blocking metadata in the initial head. */
  htmlLimitedBots?: RegExp | string
  /**
   * Enable Cache Components (Text.js 16).
   * When true, enables the "use cache" directive for pages, components, and functions.
   * Replaces the removed experimental.ppr and experimental.dynamicIO flags.
   */
  cacheComponents?: boolean
  /**
   * Enables source maps while generating static pages.
   * Helps with errors during the prerender phase in `text build`.
   * Defaults to `true`. Set to `false` to disable.
   */
  enablePrerenderSourceMaps?: boolean
  /** Transpile packages (Vite handles this natively) */
  transpilePackages?: string[]
  /**
   * Packages that should be treated as server-external (not bundled by Vite).
   * Corresponds to Text.js `serverExternalPackages` (or the legacy
   * `experimental.serverComponentsExternalPackages`).
   */
  serverExternalPackages?: string[]
  /** Webpack config (ignored — we use Vite) */
  webpack?: unknown
  /**
   * Path to a custom cache handler module (e.g., KV, Redis, DynamoDB).
   * Accepts relative paths, absolute paths, or file:// URLs from import.meta.resolve().
   * When "type": "module" is set in package.json, use import.meta.resolve() instead of
   * require.resolve() to get a valid path.
   */
  cacheHandler?: string
  /**
   * Maximum memory size (bytes) for the default in-memory cache handler.
   * Set to 0 to disable in-memory caching entirely.
   */
  cacheMaxMemorySize?: number
  /**
   * Custom build ID generator. If provided, called once at build/dev start.
   * Must return a non-empty string, or null to use the default random ID.
   */
  generateBuildId?: () => string | null | Promise<string | null>
  /** Identifier for deployment-aware cache keys and version skew protection. */
  deploymentId?: string
  /** Any other options */
  [key: string]: unknown
}

export type TextConfigFactory = (
  phase: string,
  opts: { defaultConfig: TextConfig },
) => TextConfig | Promise<TextConfig>

export type TextConfigInput = TextConfig | TextConfigFactory

/**
 * Resolved configuration with all async values awaited.
 */
export type ResolvedTextConfig = {
  env: Record<string, string>
  basePath: string
  /**
   * Resolved `assetPrefix` from text.config.
   *
   * Empty string when unset. Trailing slashes are trimmed. May be either:
   *  - a path prefix beginning with `/` (e.g. `"/custom-asset-prefix"`), or
   *  - an absolute URL with `http(s)://` origin (e.g. `"https://cdn.example.com"`
   *    or `"https://cdn.example.com/sub"`).
   *
   * Mirrors Text.js semantics — `assetPrefix` controls emitted asset URLs
   * only; route URLs continue to live under `basePath`.
   *
   * @see https://textjs.org/docs/app/api-reference/config/text-config-js/assetPrefix
   */
  assetPrefix: string
  trailingSlash: boolean
  output: '' | 'export' | 'standalone'
  pageExtensions: string[]
  instrumentationClientInject: string[]
  cacheComponents: boolean
  redirects: TextRedirect[]
  rewrites: {
    beforeFiles: TextRewrite[]
    afterFiles: TextRewrite[]
    fallback: TextRewrite[]
  }
  headers: TextHeader[]
  images: TextConfig['images']
  i18n: TextI18nConfig | null
  /** MDX remark/rehype/recma plugins extracted from @text/mdx config */
  mdx: MdxOptions | null
  /** Explicit module aliases preserved from wrapped text.config plugins. */
  aliases: Record<string, string>
  /** Extra allowed origins for dev server access (from allowedDevOrigins). */
  allowedDevOrigins: string[]
  /** Extra allowed origins for server action CSRF validation (from experimental.serverActions.allowedOrigins). */
  serverActionsAllowedOrigins: string[]
  /** Packages whose barrel imports should be optimized (from experimental.optimizePackageImports). */
  optimizePackageImports: string[]
  /** Parsed body size limit for server actions in bytes (from experimental.serverActions.bodySizeLimit). Defaults to 1MB. */
  serverActionsBodySizeLimit: number
  /** Route-level expire fallback in seconds for ISR entries with numeric revalidate. */
  expireTime: number
  /** Serialized htmlLimitedBots regexp source from text.config. */
  htmlLimitedBots: string | undefined
  /**
   * Packages that should be treated as server-external (not bundled by Vite).
   * Sourced from `serverExternalPackages` or the legacy
   * `experimental.serverComponentsExternalPackages` in text.config.
   */
  serverExternalPackages: string[]
  /** Enable sourcemaps for prerender error stack traces. Defaults to true. */
  enablePrerenderSourceMaps: boolean
  /** Resolved build ID (from generateBuildId, or a random UUID if not provided). */
  buildId: string
  /** Resolved deployment ID from text.config.js or TEXT_DEPLOYMENT_ID. */
  deploymentId: string | undefined
  /**
   * Path to a custom cache handler module. file:// URLs are resolved to
   * filesystem paths via fileURLToPath() during config resolution.
   */
  cacheHandler: string | undefined
  /**
   * Maximum memory size (bytes) for the default in-memory cache handler.
   * Set to 0 to disable in-memory caching entirely.
   */
  cacheMaxMemorySize: number | undefined
  /**
   * Concatenated hash salt from `experimental.outputHashSalt` config option
   * and `TEXT_HASH_SALT` environment variable. Empty string when neither is set.
   * When non-empty, mix into content-addressed output filenames so hash values
   * change without modifying source — useful for cache-busting after CDN poisoning.
   */
  hashSalt: string
  /**
   * Raw `sassOptions` object from text.config (or `null` when unset). text
   * passes the relevant keys through to Vite's `css.preprocessorOptions.scss`
   * so SCSS variables defined via `additionalData` / `prependData`, partials
   * resolved via `includePaths` / `loadPaths`, and a custom `implementation`
   * all behave the same as in Text.js.
   *
   * Kept loose (`Record<string, unknown> | null`) to match Text.js's typing —
   * the object is forwarded to Sass and may contain any modern Sass option.
   */
  sassOptions: Record<string, unknown> | null
}

const CONFIG_FILES = [
  'text.config.ts',
  'text.config.mts',
  'text.config.mjs',
  'text.config.js',
  'text.config.cjs',
]
const DEFAULT_EXPIRE_TIME = 31_536_000

/**
 * Check whether an error indicates a CJS module was loaded in an ESM context
 * (i.e. the file uses `require()` which is not available in ESM).
 */
function isCjsError(e: unknown): boolean {
  if (!(e instanceof Error)) return false
  const msg = e.message
  return (
    msg.includes('require is not a function') ||
    msg.includes('require is not defined') ||
    msg.includes('exports is not defined') ||
    msg.includes('module is not defined') ||
    msg.includes('__dirname is not defined') ||
    msg.includes('__filename is not defined')
  )
}

// Dev-server phase is the safe default for config loading: it enables all
// optional config sections (headers, redirects, rewrites) without triggering
// build-only behaviour. Used in two default parameter values below to avoid
// repeating PHASE_DEVELOPMENT_SERVER inline.
const DEFAULT_PHASE = PHASE_DEVELOPMENT_SERVER

/**
 * Emit a warning when config loading fails, with a targeted hint for
 * known plugin wrappers that are unnecessary in text.
 */
function warnConfigLoadFailure(filename: string, err: Error): void {
  const msg = err.message ?? ''
  const stack = err.stack ?? ''
  const isTextIntlPlugin =
    msg.includes('text-intl') ||
    stack.includes('text-intl/plugin') ||
    stack.includes('text-intl/dist')

  console.log()
  console.error(`[text] Failed to load ${filename}: ${msg}`)
  console.log()
  if (isTextIntlPlugin) {
    console.warn(
      '[text] Hint: createTextIntlPlugin() is not needed with text. ' +
        'Remove the text-intl/plugin wrapper from your text.config — ' +
        'text auto-detects text-intl and registers the i18n config alias automatically.',
    )
  }
}

/**
 * Resolve a text-style config value, calling it if it's a function-form config
 * (Text.js supports `module.exports = (phase, opts) => config`).
 */
async function resolveConfigValue(
  config: unknown,
  phase: string = DEFAULT_PHASE,
): Promise<TextConfig> {
  if (typeof config === 'function') {
    const result = await config(phase, {
      defaultConfig: {},
    })
    return result as TextConfig
  }
  return config as TextConfig
}

/**
 * Named export attached by `cjsGlobalsInjectorPlugin` when the source
 * statically looks like it assigns to `module.exports`. Holds the wrapper
 * `module` object so {@link unwrapConfig} can read back the user's CJS-style
 * export. Pure-ESM configs skip the wrapper entirely and rely on the ESM
 * `default` export instead.
 */
const TEXT_CJS_EXPORTS_KEY = '__text_cjs_exports'

/**
 * Companion named export pointing at the initial empty `{}` that the wrapper
 * is constructed with. Lets {@link unwrapConfig} distinguish "user reassigned
 * or mutated module.exports" from "module.exports is still the untouched
 * empty wrapper" — the latter happens when {@link reassignsModuleExports}
 * matches inside a string or comment (a harmless false positive that should
 * still fall through to the ESM `default` export).
 */
const TEXT_CJS_INITIAL_KEY = '__text_cjs_initial_exports'

/**
 * Unwrap the config value from a loaded module namespace.
 *
 * Prefers `module.exports` (CJS style) when the config file reassigned it,
 * otherwise falls back to `default`/the namespace itself. Mirrors Text.js's
 * behaviour, where the config is loaded through `Module._compile` and CJS
 * assignments override any ESM-style exports.
 *
 * The presence of the `__text_cjs_exports` named export is the static
 * signal (set by `cjsGlobalsInjectorPlugin` when `reassignsModuleExports`
 * matched) that this file might use CJS-style exports. We then disambiguate
 * "user actually touched module.exports" from "static heuristic was a false
 * positive" by comparing identity against the initial empty wrapper: if
 * `module.exports` is still the original `{}`, fall back to ESM `default`.
 */
async function unwrapConfig(
  // oxlint-disable-text-line typescript/no-explicit-any
  mod: any,
  phase: string = PHASE_DEVELOPMENT_SERVER,
): Promise<TextConfig> {
  const cjsModule = mod?.[TEXT_CJS_EXPORTS_KEY]
  const cjsExports = cjsModule?.exports
  const cjsInitial = mod?.[TEXT_CJS_INITIAL_KEY]
  const userTouchedExports =
    cjsExports !== undefined &&
    cjsExports !== null &&
    // Either reassigned outright, or mutated keys on the initial object.
    (cjsExports !== cjsInitial ||
      (typeof cjsExports === 'object' && Object.keys(cjsExports).length > 0))
  if (userTouchedExports) {
    return await resolveConfigValue(cjsExports, phase)
  }
  return await resolveConfigValue(mod.default ?? mod, phase)
}

/**
 * Resolve a path through filesystem symlinks, falling back to the original
 * path when the file does not exist (e.g. virtual ids, query-suffixed ids).
 */
function safeRealpath(p: string): string {
  try {
    return fs.realpathSync(p)
  } catch {
    return p
  }
}

/**
 * Whole-word substring check for any of the CJS-style globals that the
 * injector plugin would shim. Used to skip the transform entirely for the
 * common case where the config is pure ESM (no `__filename`, `__dirname`,
 * `require`, `module`, or `exports` references).
 *
 * False positives are harmless: a comment, string literal, or unrelated
 * identifier like `node:module` will trigger the transform unnecessarily,
 * but the resulting injection is idempotent and the loaded config is
 * unaffected. False negatives would be a correctness bug, so we err on the
 * side of matching too eagerly.
 *
 * Note: `\bexports\b` does not match `export default` (different word
 * boundaries), and `\brequire\b` does not match `requireSomething`.
 */
export function referencesCjsGlobals(source: string): boolean {
  return /\b(?:__filename|__dirname|require|module|exports)\b/.test(source)
}

/**
 * Static heuristic: returns true when the source appears to assign to
 * `module.exports` — either via `module.exports = …`, `module.exports.foo = …`,
 * or `module.exports[…] = …`. Used to decide whether the injector plugin
 * needs to wire up the wrapper `module` object so {@link unwrapConfig} can
 * read back the user's CJS-style export.
 *
 * Pure-ESM configs skip the wrapper entirely, which means a faster transform
 * (no extra `export const` line) and a simpler unwrap path (no need to
 * disambiguate "initial empty object" from "user reassigned to {}").
 *
 * Like {@link referencesCjsGlobals}, false positives are harmless: at worst
 * we emit an unused `__text_cjs_exports` named export, and `unwrapConfig`
 * still prefers it (it points at an empty object, which then gets treated
 * as the config — equivalent to today's sentinel logic for pure-ESM files
 * that happen to mention `module.exports` only in a string).
 */
export function reassignsModuleExports(source: string): boolean {
  // Match `module.exports` followed by `=` (not `==` / `===`), `.identifier =`,
  // or `[...] =`. Whitespace allowed around the dot.
  return /\bmodule\s*\.\s*exports\b\s*(?:=(?!=)|\.\s*[A-Za-z_$][\w$]*\s*=(?!=)|\[)/.test(source)
}

/**
 * Vite plugin that prepends CJS-style globals (`__filename`, `__dirname`,
 * `module`, `exports`, `require`) to the text.config.* source before
 * Vite's module runner evaluates it.
 *
 * Text.js's `text.config.ts` loader (packages/text/src/build/text-config-ts/
 * transpile-config.ts → require-hook.ts) feeds the file through Node's
 * `Module._compile`, which provides these CJS globals even when the source
 * uses ESM syntax. Upstream test fixtures in `test/e2e/app-dir/text-config-ts*`
 * rely on that, e.g. `node-api-cjs/text.config.ts` reads
 * `fs.readFileSync(path.join(__dirname, 'foo.txt'), 'utf8')`. text loads
 * configs through Vite's ESM-only module runner, so we inject the same
 * globals as plain `const` declarations.
 *
 * For configs that don't reference any CJS global (the common case — every
 * upstream `text-config-ts` fixture except `node-api-cjs` is pure ESM) we
 * skip the transform entirely; see {@link referencesCjsGlobals}.
 *
 * `module.exports` reassignment is preserved by exposing the injected
 * `module` object as a named export (see {@link TEXT_CJS_EXPORTS_KEY}) and
 * reading it back in {@link unwrapConfig}.
 */
function cjsGlobalsInjectorPlugin(configPath: string): {
  name: string
  enforce: 'pre'
  // oxlint-disable-text-line typescript/no-explicit-any
  transform(this: unknown, code: string, id: string): any
} {
  // Resolve symlinks once so we can compare against the (possibly
  // symlink-resolved) id Vite passes to `transform`. On macOS, `/var/folders`
  // is a symlink to `/private/var/folders`, so the temp-dir path in tests
  // would otherwise mismatch.
  const normalizedTarget = safeRealpath(path.resolve(configPath))
  return {
    name: 'text:text-config-cjs-globals',
    enforce: 'pre',
    transform(code: string, id: string) {
      // Vite may pass an id with a query suffix (?v=...) or as a file URL.
      const idPath = id.startsWith('file://') ? fileURLToPath(id) : id.split('?')[0]
      const resolvedId = safeRealpath(path.resolve(idPath))
      if (resolvedId !== normalizedTarget) return null

      // Fast path: skip the transform when the source contains no bareword
      // reference to any of the shimmed globals. The vast majority of
      // `text.config.ts` files are pure ESM (`export default { ... }`) and
      // pay no cost from this plugin.
      if (!referencesCjsGlobals(code)) return null

      const dirname = path.dirname(normalizedTarget)
      // JSON.stringify produces safe JS string literals for paths.
      const filenameLiteral = JSON.stringify(normalizedTarget)
      const dirnameLiteral = JSON.stringify(dirname)
      const requireBaseLiteral = JSON.stringify(path.join(dirname, 'package.json'))

      // Only wire up the wrapper `module` object — and the corresponding
      // named export read by unwrapConfig — when the source statically looks
      // like it assigns to module.exports. Pure-ESM configs avoid the extra
      // export and the unwrap-by-wrapper code path.
      const needsModuleWrapper = reassignsModuleExports(code)
      const moduleLines = needsModuleWrapper
        ? `const __textInitialExports = {};\n` +
          `const module = { exports: __textInitialExports };\n` +
          `const exports = module.exports;\n` +
          `export const ${TEXT_CJS_EXPORTS_KEY} = module;\n` +
          `export const ${TEXT_CJS_INITIAL_KEY} = __textInitialExports;\n`
        : ''

      // Preamble runs after ESM imports are hoisted; the const bindings shadow
      // any global lookups the source would otherwise perform.
      const preamble =
        `import { createRequire as __textCreateRequire } from "node:module";\n` +
        `const __filename = ${filenameLiteral};\n` +
        `const __dirname = ${dirnameLiteral};\n` +
        `const require = __textCreateRequire(${requireBaseLiteral});\n` +
        moduleLines

      return {
        code: preamble + code,
        map: null,
      }
    },
  }
}

export function findTextConfigPath(root: string): string | null {
  for (const filename of CONFIG_FILES) {
    const configPath = path.join(root, filename)
    if (fs.existsSync(configPath)) return configPath
  }
  return null
}

export async function resolveTextConfigInput(
  config: TextConfigInput,
  phase: string = PHASE_DEVELOPMENT_SERVER,
): Promise<TextConfig> {
  // Inline text({ textConfig }) already receives the config value itself,
  // not a module namespace object, so do not treat a "default" key specially.
  return await resolveConfigValue(config, phase)
}

/**
 * Load a CJS-flavoured text.config.{js,cjs} via createRequire.
 *
 * For `.cjs` (or `.js` in a non-type-module package) Node's loader picks the
 * right format automatically and `require()` just works. For `.js` in a
 * `"type": "module"` package, Node infers ESM from package.json and the file
 * fails with `require is not defined`. In that case we copy the source to a
 * sibling temp `.cjs` (where the explicit extension forces CJS regardless of
 * the parent type field) and require *that*. Relative imports inside the
 * config still resolve against the original directory.
 */
async function loadConfigViaRequire(
  configPath: string,
  root: string,
  phase: string,
): Promise<TextConfig> {
  const require = createRequire(path.join(root, 'package.json'))
  try {
    return await unwrapConfig(require(configPath), phase)
  } catch (e) {
    if (!isCjsError(e) || !configPath.endsWith('.js')) throw e
    return await loadConfigViaCjsTempCopy(configPath, root, phase)
  }
}

async function loadConfigViaCjsTempCopy(
  configPath: string,
  root: string,
  phase: string,
): Promise<TextConfig> {
  const dir = path.dirname(configPath)
  // Hidden + uniquely-named to avoid clashing with user files or being picked
  // up by text.js's own config scanner if a concurrent text dev is running.
  const tmpPath = path.join(dir, `.text-text-config.${process.pid}.${Date.now()}.cjs`)
  fs.copyFileSync(configPath, tmpPath)
  try {
    const require = createRequire(path.join(root, 'package.json'))
    return await unwrapConfig(require(tmpPath), phase)
  } finally {
    try {
      fs.unlinkSync(tmpPath)
    } catch {
      // Best-effort cleanup; a stray tmp file is harmless.
    }
  }
}

/**
 * Find and load the text.config file from the project root.
 * Returns null if no config file is found.
 *
 * Attempts Vite's module runner first so TS configs and extensionless local
 * imports (e.g. `import "./env"`) resolve consistently. If loading fails due
 * to CJS constructs (`require`, `module.exports`), falls back to `createRequire`
 * so common CJS plugin wrappers (textra, @text/mdx, etc.) still work, including
 * `text.config.js` files written in CJS syntax inside a `"type": "module"`
 * package (the common shape after `text init`).
 */
export async function loadTextConfig(
  root: string,
  phase: string = DEFAULT_PHASE,
): Promise<TextConfig | null> {
  const configPath = findTextConfigPath(root)
  if (!configPath) return null

  const filename = path.basename(configPath)

  // Mirror Text.js: read `compilerOptions.paths` from the project's
  // tsconfig.json so aliased imports inside text.config.ts (e.g.
  // `import { foo } from '@/foo'`) resolve at config-load time. Text.js
  // passes these to SWC; we pass them to Vite's resolver as `resolve.alias`.
  // See packages/text/src/build/text-config-ts/transpile-config.ts.
  const tsconfigAliases = loadTsconfigPathAliasesForRoot(root)

  // Symlink-resolved config path, used by the `commonjs()` filter below to
  // exclude the config file itself. macOS uses /private/var symlinks, so
  // string-compare without realpath would falsely include the config.
  const normalizedConfigPath = safeRealpath(path.resolve(configPath))

  try {
    // Load config via Vite's module runner (TS + extensionless import support)
    const { runnerImport } = await import('vite')
    const { module: mod } = await runnerImport(configPath, {
      root,
      logLevel: 'error',
      clearScreen: false,
      resolve: {
        alias: tsconfigAliases,
        // Include `.cjs` and `.cts` so `vite-plugin-commonjs` recognises
        // those extensions (the plugin keys off `config.resolve.extensions`,
        // which on Vite defaults to `[.mjs, .js, .mts, .ts, .jsx, .tsx,
        // .json]` — no CJS extensions). This also lets the runner's resolver
        // find `./foo` style imports that resolve to a `.cjs`/`.cts` sibling.
        extensions: ['.mjs', '.js', '.cjs', '.mts', '.ts', '.cts', '.jsx', '.tsx', '.json'],
      },
      // Only inject CJS globals for TypeScript config flavours. Text.js
      // applies its `Module._compile` / SWC pipeline (which exposes the
      // CJS globals) exclusively to `.ts`/`.mts`/`.cts`; legacy `.js`/`.cjs`
      // configs are loaded through Node and already have `require`/`module`,
      // and `.mjs` configs are explicitly ESM-only.
      //
      // Pair that with `vite-plugin-commonjs` (the same plugin used for
      // application code in index.ts) so sibling imports like `.cjs`/`.cts`,
      // or `.js`/`.ts` files that assign to `module.exports`, are converted
      // to ESM before Vite's runner evaluates them. The default `filter`
      // skips `node_modules`; we opt back in so bare-import packages
      // imported by text.config.* (e.g. CJS plugin wrappers) keep working —
      // this mirrors how Text.js's SWC pipeline handles those imports too.
      //
      // The config file itself is excluded from `commonjs()`: when it needs
      // CJS globals it goes through `cjsGlobalsInjectorPlugin`, which sets
      // up a specific `__text_cjs_exports` wiring that `unwrapConfig` reads
      // back. Letting both plugins inject `module = { exports: {} }` for the
      // same source produces an `Identifier 'module' has already been
      // declared` syntax error.
      plugins: [
        ...(/\.[cm]?ts$/.test(configPath) ? [cjsGlobalsInjectorPlugin(configPath)] : []),
        commonjs({
          filter: (id: string) => {
            const idPath = id.startsWith('file://') ? fileURLToPath(id) : id.split('?')[0]
            const resolvedId = safeRealpath(path.resolve(idPath))
            if (resolvedId === normalizedConfigPath) return false
            // Returning `true` forces the transform to run even for ids
            // inside `node_modules` (default behaviour skips them);
            // `undefined` falls through to the plugin's default for
            // user code.
            return id.includes('node_modules') ? true : undefined
          },
        }),
      ],
    })
    return await unwrapConfig(mod, phase)
  } catch (e) {
    // If the error indicates a CJS file loaded in ESM context, retry with
    // createRequire which provides a proper CommonJS environment.
    if (isCjsError(e) && (filename.endsWith('.js') || filename.endsWith('.cjs'))) {
      try {
        return await loadConfigViaRequire(configPath, root, phase)
      } catch (e2) {
        warnConfigLoadFailure(filename, e2 as Error)
        throw e2
      }
    }

    warnConfigLoadFailure(filename, e as Error)
    throw e
  }
}

/**
 * Generate a UUID that doesn't contain "ad" to avoid false-positive ad-blocker hits.
 * Mirrors Text.js's own nanoid retry loop.
 */
function safeUUID(): string {
  let id = randomUUID()
  while (/ad/i.test(id)) id = randomUUID()
  return id
}

/**
 * Call the user's generateBuildId function and validate its return value.
 * Follows Text.js semantics: null return falls back to a random UUID; any
 * other non-string throws. Leading/trailing whitespace is trimmed.
 *
 * @see https://textjs.org/docs/app/api-reference/config/text-config-js/generateBuildId
 */
async function resolveBuildId(
  generate: (() => string | null | Promise<string | null>) | undefined,
): Promise<string> {
  if (!generate) return safeUUID()

  const result = await generate()

  if (result === null) return safeUUID()

  if (typeof result !== 'string') {
    throw new Error(
      'generateBuildId did not return a string. https://textjs.org/docs/messages/generatebuildid-not-a-string',
    )
  }

  const trimmed = result.trim()
  if (trimmed.length === 0) {
    throw new Error(
      'generateBuildId returned an empty string. https://textjs.org/docs/messages/generatebuildid-not-a-string',
    )
  }

  return trimmed
}

/**
 * Normalize the `assetPrefix` option from text.config.
 *
 * Accepts both absolute URLs (`https://cdn.example.com[/subpath]`) and
 * path prefixes (`/custom-asset-prefix`). Trailing slashes are trimmed.
 * Empty/whitespace-only strings are treated as unset and return `""`.
 *
 * Path prefixes that omit the leading slash get one added so they always
 * begin with `/` — this matches how Text.js routes match against them.
 *
 * Non-string values are rejected to surface config mistakes early.
 *
 * @see https://textjs.org/docs/app/api-reference/config/text-config-js/assetPrefix
 */
export function normalizeAssetPrefix(value: unknown): string {
  if (value === undefined || value === null || value === '') return ''

  if (typeof value !== 'string') {
    throw new Error(
      `Invalid \`assetPrefix\` configuration: must be a string, got ${typeof value}. ` +
        `Accepts a path prefix ("/custom-asset-prefix") or an absolute URL ` +
        `("https://cdn.example.com").`,
    )
  }

  // Avoid `replace(/\/+$/, "")` — CodeQL flags it as polynomial backtracking
  // on uncontrolled input. An explicit loop has the same effect with linear time.
  let trimmed = value.trim()
  while (trimmed.endsWith('/')) trimmed = trimmed.slice(0, -1)
  if (trimmed === '') return ''

  // Absolute URL — keep origin verbatim, validate parseability so a typo
  // surfaces at config-load time instead of as a confusing build error.
  if (/^https?:\/\//i.test(trimmed)) {
    if (!URL.canParse(trimmed)) {
      throw new Error(`Invalid \`assetPrefix\` configuration: "${value}" is not a parseable URL.`)
    }
    return trimmed
  }

  // Path prefix — always begin with "/", consistent with basePath.
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

function resolveDeploymentId(configDeploymentId: unknown): string | undefined {
  const deploymentId =
    configDeploymentId !== undefined ? configDeploymentId : process.env.TEXT_DEPLOYMENT_ID
  if (deploymentId === undefined || deploymentId === '') return undefined

  if (typeof deploymentId !== 'string') {
    throw new Error(
      'Invalid `deploymentId` configuration: must be a string. https://textjs.org/docs/messages/deploymentid-not-a-string',
    )
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(deploymentId)) {
    throw new Error(
      'Invalid `deploymentId` configuration: contains invalid characters. Only alphanumeric characters, hyphens, and underscores are allowed. https://textjs.org/docs/messages/deploymentid-invalid-characters',
    )
  }

  return deploymentId
}

/**
 * Converts a cache handler path to a filesystem path.
 * ESM's import.meta.resolve() returns file:// URLs which break when concatenated
 * with path operations like path.join or path.relative.
 * @param filePath - Absolute path, relative path, or file:// URL (e.g. from import.meta.resolve)
 * @returns A filesystem path suitable for path operations
 */
function resolveCacheHandlerPathToFilesystem(filePath: string): string {
  if (filePath.startsWith('file://')) {
    return fileURLToPath(filePath)
  }
  return filePath
}

function resolveHtmlLimitedBots(value: TextConfig['htmlLimitedBots']): string | undefined {
  const source =
    value instanceof RegExp ? value.source : typeof value === 'string' ? value : undefined
  if (!source) return undefined

  try {
    getHtmlLimitedBotRegex(source)
  } catch (error) {
    throw new Error(
      'Invalid text.config option "htmlLimitedBots": expected a valid regular expression source',
      { cause: error },
    )
  }

  return source
}

function readOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  return isUnknownRecord(value) ? value : undefined
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function readOptionalBodySizeLimit(value: unknown): string | number | undefined {
  return typeof value === 'string' || typeof value === 'number' ? value : undefined
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

/**
 * Resolve a TextConfig into a fully-resolved ResolvedTextConfig.
 * Awaits async functions for redirects/rewrites/headers.
 */
export async function resolveTextConfig(
  config: TextConfig | null,
  root: string = process.cwd(),
): Promise<ResolvedTextConfig> {
  if (!config) {
    const buildId = await resolveBuildId(undefined)
    const deploymentId = resolveDeploymentId(undefined)
    const resolved: ResolvedTextConfig = {
      env: {},
      basePath: '',
      assetPrefix: '',
      trailingSlash: false,
      output: '',
      pageExtensions: normalizePageExtensions(),
      cacheComponents: false,
      redirects: [],
      rewrites: { beforeFiles: [], afterFiles: [], fallback: [] },
      headers: [],
      images: undefined,
      i18n: null,
      mdx: null,
      aliases: {},
      allowedDevOrigins: [],
      serverActionsAllowedOrigins: [],
      optimizePackageImports: [],
      serverActionsBodySizeLimit: 1 * 1024 * 1024,
      expireTime: DEFAULT_EXPIRE_TIME,
      htmlLimitedBots: undefined,
      serverExternalPackages: [],
      cacheHandler: undefined,
      cacheMaxMemorySize: undefined,
      enablePrerenderSourceMaps: true,
      hashSalt: process.env.TEXT_HASH_SALT ?? '',
      buildId,
      deploymentId,
      sassOptions: null,
      instrumentationClientInject: [],
    }
    detectTextIntlConfig(root, resolved)
    return resolved
  }

  // Resolve redirects
  let redirects: TextRedirect[] = []
  if (config.redirects) {
    const result = await config.redirects()
    redirects = Array.isArray(result) ? result : []
  }

  // Resolve rewrites
  let rewrites: {
    beforeFiles: TextRewrite[]
    afterFiles: TextRewrite[]
    fallback: TextRewrite[]
  } = {
    beforeFiles: [],
    afterFiles: [],
    fallback: [],
  }
  if (config.rewrites) {
    const result = await config.rewrites()
    if (Array.isArray(result)) {
      rewrites.afterFiles = result
    } else {
      rewrites = {
        beforeFiles: result.beforeFiles ?? [],
        afterFiles: result.afterFiles ?? [],
        fallback: result.fallback ?? [],
      }
    }
  }

  {
    const allRewrites = [...rewrites.beforeFiles, ...rewrites.afterFiles, ...rewrites.fallback]
    const externalRewrites = allRewrites.filter(rewrite => isExternalUrl(rewrite.destination))

    if (externalRewrites.length > 0) {
      const noun = externalRewrites.length === 1 ? 'external rewrite' : 'external rewrites'
      const listing = externalRewrites
        .map(rewrite => `  ${rewrite.source} → ${rewrite.destination}`)
        .join('\n')

      console.warn(
        `[text] Found ${externalRewrites.length} ${noun} that proxy requests to external origins:\n` +
          `${listing}\n` +
          `Request headers, including credential headers (cookie, authorization, proxy-authorization, x-api-key), ` +
          `are forwarded to the external origin to match Text.js behavior. ` +
          `If you do not want to forward credentials, use an API route or route handler where you control exactly which headers are sent.`,
      )
    }
  }

  // Resolve headers
  let headers: TextHeader[] = []
  if (config.headers) {
    headers = await config.headers()
  }

  // Probe wrapped webpack config once so alias extraction and MDX extraction
  // observe the same mock environment.
  const webpackProbe = await probeWebpackConfig(config, root)
  const mdx = webpackProbe.mdx
  const aliases = {
    ...extractTurboAliases(config, root),
    ...webpackProbe.aliases,
  }

  const allowedDevOrigins = Array.isArray(config.allowedDevOrigins) ? config.allowedDevOrigins : []

  // Resolve serverActions.allowedOrigins and bodySizeLimit from experimental config
  const experimental = readOptionalRecord(config.experimental)
  const serverActionsConfig = readOptionalRecord(experimental?.serverActions)
  const serverActionsAllowedOrigins = readStringArray(serverActionsConfig?.allowedOrigins)
  const serverActionsBodySizeLimit = parseBodySizeLimit(
    readOptionalBodySizeLimit(serverActionsConfig?.bodySizeLimit),
  )

  // Resolve hashSalt from experimental.outputHashSalt config + TEXT_HASH_SALT env var.
  // Text.js concatenates them: config value first, then env var.
  const configOutputHashSalt = readOptionalString(experimental?.outputHashSalt)
  const hashSalt = (configOutputHashSalt ?? '') + (process.env.TEXT_HASH_SALT ?? '')
  const htmlLimitedBots = resolveHtmlLimitedBots(config.htmlLimitedBots)

  // Resolve optimizePackageImports from experimental config
  const rawOptimize = experimental?.optimizePackageImports
  const optimizePackageImports = Array.isArray(rawOptimize)
    ? rawOptimize.filter((x): x is string => typeof x === 'string')
    : []

  // Resolve serverExternalPackages — support the current top-level key and the
  // legacy experimental.serverComponentsExternalPackages name that Text.js still
  // accepts (it moved out of experimental in Text.js 14.2).
  const topLevelServerExternalPackages = Array.isArray(config.serverExternalPackages)
    ? readStringArray(config.serverExternalPackages)
    : undefined
  const legacyServerComponentsExternal = readStringArray(
    experimental?.serverComponentsExternalPackages,
  )
  const serverExternalPackages = topLevelServerExternalPackages ?? legacyServerComponentsExternal

  // Warn about unsupported experimental.swcEnvOptions. text uses Vite for
  // transforms, not SWC, so automatic polyfill injection is not applicable.
  if (experimental?.swcEnvOptions !== undefined) {
    console.warn(
      '[text] text.config option "experimental.swcEnvOptions" is not applicable and will be ignored (text uses Vite, not SWC). ' +
        'A Vite-compatible polyfill solution may be explored in the future.',
    )
  }

  // `text/root-params` is now stable — no longer requires an experimental flag.
  if (experimental?.rootParams !== undefined) {
    console.warn(
      '[text] `experimental.rootParams` is no longer needed, because `text/root-params` is available by default. ' +
        'You can remove it from text.config.(js|mjs|ts).',
    )
  }

  // Warn about unsupported webpack usage. We preserve alias injection and
  // extract MDX settings, but all other webpack customization is still ignored.
  if (config.webpack !== undefined) {
    if (mdx || Object.keys(webpackProbe.aliases).length > 0) {
      console.warn(
        '[text] text.config option "webpack" is only partially supported. ' +
          'text preserves resolve.alias entries and MDX loader settings, but other webpack customization is ignored',
      )
    } else {
      console.warn('[text] text.config option "webpack" is not yet supported and will be ignored')
    }
  }

  const output = readOptionalString(config.output) ?? ''
  if (output && output !== 'export' && output !== 'standalone') {
    console.warn(`[text] Unknown output mode "${output}", ignoring`)
  }

  const pageExtensions = normalizePageExtensions(config.pageExtensions)

  // Parse i18n config
  let i18n: TextI18nConfig | null = null
  if (config.i18n) {
    i18n = {
      locales: config.i18n.locales,
      defaultLocale: config.i18n.defaultLocale,
      localeDetection: config.i18n.localeDetection ?? true,
      domains: config.i18n.domains,
    }
  }

  const buildId = await resolveBuildId(config.generateBuildId)
  const deploymentId = resolveDeploymentId(config.deploymentId)

  // Resolve cacheHandler path — handle file:// URLs from import.meta.resolve()
  const cacheHandler: string | undefined =
    typeof config.cacheHandler === 'string'
      ? resolveCacheHandlerPathToFilesystem(config.cacheHandler)
      : undefined

  // Resolve cacheMaxMemorySize
  const cacheMaxMemorySize: number | undefined =
    typeof config.cacheMaxMemorySize === 'number' ? config.cacheMaxMemorySize : undefined

  // Apply Text.js i18n locale-prefix transformation to redirects/rewrites.
  // When i18n is configured and a rule does NOT carry `locale: false`, the
  // source is rewritten to match locale-prefixed URLs. Rules with
  // `locale: false` are left untouched so user-supplied `:locale` segments
  // can capture the prefix themselves. Mirrors processRoutes() in
  // packages/text/src/lib/load-custom-routes.ts.
  if (i18n) {
    const opts = { trailingSlash: config.trailingSlash ?? false }
    redirects = applyLocaleToRoutes(redirects, i18n, 'redirect', opts)
    rewrites = {
      beforeFiles: applyLocaleToRoutes(rewrites.beforeFiles, i18n, 'rewrite', opts),
      afterFiles: applyLocaleToRoutes(rewrites.afterFiles, i18n, 'rewrite', opts),
      fallback: applyLocaleToRoutes(rewrites.fallback, i18n, 'rewrite', opts),
    }
  }

  const resolved: ResolvedTextConfig = {
    env: config.env ?? {},
    basePath: config.basePath ?? '',
    assetPrefix: normalizeAssetPrefix(config.assetPrefix),
    trailingSlash: config.trailingSlash ?? false,
    output: output === 'export' || output === 'standalone' ? output : '',
    pageExtensions,
    instrumentationClientInject: Array.isArray(config.instrumentationClientInject)
      ? (config.instrumentationClientInject as unknown[]).filter(
          (x): x is string => typeof x === 'string',
        )
      : [],
    cacheComponents: config.cacheComponents ?? false,
    redirects,
    rewrites,
    headers,
    images: config.images,
    i18n,
    mdx,
    aliases,
    allowedDevOrigins,
    serverActionsAllowedOrigins,
    optimizePackageImports,
    serverActionsBodySizeLimit,
    expireTime: typeof config.expireTime === 'number' ? config.expireTime : DEFAULT_EXPIRE_TIME,
    htmlLimitedBots,
    serverExternalPackages,
    cacheHandler,
    cacheMaxMemorySize,
    enablePrerenderSourceMaps: config.enablePrerenderSourceMaps ?? true,
    hashSalt,
    buildId,
    deploymentId,
    sassOptions: readOptionalRecord(config.sassOptions) ?? null,
  }

  // Auto-detect text-intl (lowest priority — explicit aliases from
  // webpack/turbopack already in `aliases` take precedence)
  detectTextIntlConfig(root, resolved)

  // Parity with Text.js: when `basePath` is configured but `assetPrefix` is
  // not, fall back to using `basePath` as the asset prefix. This ensures the
  // on-disk layout under `dist/client` is rooted at `<basePath>/_text/static/`
  // (matching the URL Vite emits via `base + assetsDir`), so Cloudflare's
  // ASSETS binding and the prod-server static layer can serve requests
  // verbatim without any runtime path rewriting.
  //
  // Mirrors Text.js: packages/text/src/server/config.ts:509-532
  // https://github.com/vercel/next.js/blob/canary/packages/text/src/server/config.ts
  // Conditions copied verbatim:
  //   - `basePath !== ""` (skips when basePath is unset)
  //   - `basePath !== "/"` (Text.js rejects this earlier, but we mirror the
  //     guard so we don't silently produce `assetPrefix === "/"`)
  //   - `assetPrefix === ""` (user did not explicitly opt out by setting it)
  if (resolved.basePath !== '' && resolved.basePath !== '/' && resolved.assetPrefix === '') {
    resolved.assetPrefix = resolved.basePath
  }

  return resolved
}

function normalizeAliasEntries(
  aliases: Record<string, unknown> | undefined,
  root: string,
): Record<string, string> {
  if (!aliases) return {}

  const normalized: Record<string, string> = {}
  for (const [key, value] of Object.entries(aliases)) {
    if (typeof value !== 'string') continue
    normalized[key] = path.isAbsolute(value) ? value : path.resolve(root, value)
  }
  return normalized
}

function extractTurboAliases(config: TextConfig, root: string): Record<string, string> {
  const experimental = readOptionalRecord(config.experimental)
  const experimentalTurbo = readOptionalRecord(experimental?.turbo)
  const topLevelTurbopack = readOptionalRecord(config.turbopack)

  return {
    ...normalizeAliasEntries(readOptionalRecord(experimentalTurbo?.resolveAlias), root),
    ...normalizeAliasEntries(readOptionalRecord(topLevelTurbopack?.resolveAlias), root),
  }
}

async function probeWebpackConfig(
  config: TextConfig,
  root: string,
): Promise<{ aliases: Record<string, string>; mdx: MdxOptions | null }> {
  if (typeof config.webpack !== 'function') {
    return { aliases: {}, mdx: null }
  }

  // oxlint-disable-text-line typescript/no-explicit-any
  const mockModuleRules: any[] = []
  const mockResolve: { alias: Record<string, unknown> } = { alias: {} }
  const mockConfig = {
    context: root,
    resolve: mockResolve,
    module: { rules: mockModuleRules },
    // oxlint-disable-text-line typescript/no-explicit-any
    plugins: [] as any[],
  }
  const mockOptions = {
    defaultLoaders: { babel: { loader: 'text-babel-loader' } },
    isServer: false,
    dev: false,
    dir: root,
  }

  try {
    // oxlint-disable-text-line typescript/no-unsafe-function-type
    const result = await (config.webpack as Function)(mockConfig, mockOptions)
    const finalConfig = result ?? mockConfig
    // oxlint-disable-text-line typescript/no-explicit-any
    const rules: any[] = finalConfig.module?.rules ?? mockModuleRules
    return {
      aliases: normalizeAliasEntries(finalConfig.resolve?.alias, root),
      mdx: extractMdxOptionsFromRules(rules),
    }
  } catch {
    return { aliases: {}, mdx: null }
  }
}

/**
 * Extract MDX compilation options (remark/rehype/recma plugins) from
 * a text config that uses @text/mdx.
 *
 * @text/mdx wraps the config with a webpack function that injects an MDX
 * loader rule. The remark/rehype plugins are captured in that closure.
 * We probe the webpack function with a mock config to extract them.
 */
export async function extractMdxOptions(
  config: TextConfig,
  root: string = process.cwd(),
): Promise<MdxOptions | null> {
  return (await probeWebpackConfig(config, root)).mdx
}

/**
 * Probe file candidates relative to root. Returns the first one that exists,
 * or null if none match.
 */
function probeFiles(root: string, candidates: string[]): string | null {
  for (const candidate of candidates) {
    const abs = path.resolve(root, candidate)
    if (fs.existsSync(abs)) return abs
  }
  return null
}

const I18N_REQUEST_CANDIDATES = [
  'i18n/request.ts',
  'i18n/request.tsx',
  'i18n/request.js',
  'i18n/request.jsx',
  'src/i18n/request.ts',
  'src/i18n/request.tsx',
  'src/i18n/request.js',
  'src/i18n/request.jsx',
]

/**
 * Detect text-intl in the project and auto-register the `text-intl/config`
 * alias if needed.
 *
 * text-intl's `createTextIntlPlugin()` crashes in text because it calls
 * `require('text/package.json')` to check the Text.js version. Instead,
 * text detects text-intl and registers the alias automatically.
 *
 * Note: `require.resolve('text-intl')` walks up to parent `node_modules`
 * directories via standard Node module resolution. In a monorepo, text-intl
 * installed at the workspace root will trigger detection even if not listed
 * in the project's own package.json. This is acceptable since a workspace-root
 * install implies the user wants it available.
 *
 * Mutates `resolved.aliases` and `resolved.env` in place.
 */
export function detectTextIntlConfig(root: string, resolved: ResolvedTextConfig): void {
  // Explicit alias wins — user or plugin already set it
  if (resolved.aliases['text-intl/config']) return

  // Check if text-intl is installed (use main entry — some packages
  // don't expose ./package.json in their exports map)
  const require = createRequire(path.join(root, 'package.json'))
  try {
    require.resolve('text-intl')
  } catch {
    return // text-intl not installed
  }

  // Probe for the i18n request config file
  const configPath = probeFiles(root, I18N_REQUEST_CANDIDATES)
  if (!configPath) return

  resolved.aliases['text-intl/config'] = configPath

  if (resolved.trailingSlash) {
    resolved.env._text_intl_trailing_slash = 'true'
  }
}

// oxlint-disable-text-line typescript/no-explicit-any
function extractMdxOptionsFromRules(rules: any[]): MdxOptions | null {
  // Search through webpack rules for the MDX loader injected by @text/mdx
  for (const rule of rules) {
    const loaders = extractMdxLoaders(rule)
    if (loaders) return loaders
  }
  return null
}

/**
 * Recursively search a webpack rule (which may have nested `oneOf` arrays)
 * for an MDX loader and extract its remark/rehype/recma plugin options.
 */
// oxlint-disable-text-line typescript/no-explicit-any
function extractMdxLoaders(rule: any): MdxOptions | null {
  if (!rule) return null

  // Check `oneOf` arrays (Text.js uses these extensively)
  if (Array.isArray(rule.oneOf)) {
    for (const child of rule.oneOf) {
      const result = extractMdxLoaders(child)
      if (result) return result
    }
  }

  // Check `use` array (loader chain)
  const use = Array.isArray(rule.use) ? rule.use : rule.use ? [rule.use] : []
  for (const loader of use) {
    const loaderPath = typeof loader === 'string' ? loader : loader?.loader
    if (typeof loaderPath === 'string' && isMdxLoader(loaderPath)) {
      const opts = typeof loader === 'object' ? loader.options : {}
      return extractPluginsFromOptions(opts)
    }
  }

  // Check direct `loader` field
  if (typeof rule.loader === 'string' && isMdxLoader(rule.loader)) {
    return extractPluginsFromOptions(rule.options)
  }

  return null
}

function isMdxLoader(loaderPath: string): boolean {
  return (
    loaderPath.includes('mdx') &&
    (loaderPath.includes('@text') ||
      loaderPath.includes('@mdx-js') ||
      loaderPath.includes('mdx-js-loader') ||
      loaderPath.includes('text-mdx'))
  )
}

// oxlint-disable-text-line typescript/no-explicit-any
function extractPluginsFromOptions(opts: any): MdxOptions | null {
  if (!opts || typeof opts !== 'object') return null

  const remarkPlugins = Array.isArray(opts.remarkPlugins) ? opts.remarkPlugins : undefined
  const rehypePlugins = Array.isArray(opts.rehypePlugins) ? opts.rehypePlugins : undefined
  const recmaPlugins = Array.isArray(opts.recmaPlugins) ? opts.recmaPlugins : undefined

  // Only return if at least one plugin array is non-empty
  if (
    (remarkPlugins && remarkPlugins.length > 0) ||
    (rehypePlugins && rehypePlugins.length > 0) ||
    (recmaPlugins && recmaPlugins.length > 0)
  ) {
    return {
      ...(remarkPlugins && remarkPlugins.length > 0 ? { remarkPlugins } : {}),
      ...(rehypePlugins && rehypePlugins.length > 0 ? { rehypePlugins } : {}),
      ...(recmaPlugins && recmaPlugins.length > 0 ? { recmaPlugins } : {}),
    }
  }

  return null
}

export { PHASE_PRODUCTION_BUILD } from '../shims/constants.js'
