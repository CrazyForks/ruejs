import type { TextI18nConfig } from '../config/text-config.js'
import {
  detectDomainLocale,
  normalizeDomainHostname,
  type DomainLocale,
} from '../utils/domain-locale.js'

type HeaderValue = string | string[] | undefined
type HeaderBag = Headers | Record<string, HeaderValue> | undefined

type LocaleRedirectOptions = {
  headers?: HeaderBag
  textConfig: {
    basePath?: string
    i18n?: TextI18nConfig | null
    trailingSlash?: boolean
  }
  pathLocale?: string
  urlParsed: {
    hostname?: string | null
    pathname: string
    search?: string
  }
}

type PagesI18nRequestInfo = {
  locale: string
  url: string
  hadPrefix: boolean
  domainLocale?: DomainLocale
  redirectUrl?: string
}

function readHeader(headers: HeaderBag, name: string): string | undefined {
  if (!headers) return undefined
  if (headers instanceof Headers) {
    return headers.get(name) ?? undefined
  }

  // For Record headers, callers must pass lowercase names. Node's
  // IncomingMessage.headers are already lowercased by the HTTP parser.
  const direct = headers[name]
  if (Array.isArray(direct)) return direct.join(', ')
  return direct
}

const normalizeHostname = normalizeDomainHostname
export { detectDomainLocale }

/**
 * Prepend the default locale prefix to a pathname when i18n is configured and
 * the path does not already carry a locale prefix. Mirrors Text.js's
 * server-side path normalisation in `resolve-routes.ts` (lines ~250-263):
 *
 *   if (!initialLocaleResult.detectedLocale && !pathname.startsWith('/_text/')) {
 *     parsedUrl.pathname = `/${defaultLocale}${pathname === '/' ? '' : pathname}`
 *   }
 *
 * Run this **before** matching against `text.config.js` redirects/rewrites
 * (which are emitted by `applyLocaleToRoutes` in locale-prefixed forms) so
 * that requests arriving without a locale prefix still match those rules.
 *
 * Skips internal paths that Text.js leaves alone:
 *   - `/_text/*` (text build assets)
 *   - `/__text/*` (text-internal endpoints)
 *
 * Returns the input unchanged when i18n is not configured or when the path
 * already starts with one of the configured locales. The host-based default
 * locale (i18n.domains[].defaultLocale) is preferred over the global default
 * when supplied, matching Text.js's `domainLocale.defaultLocale` branch.
 *
 * Item 4 of issue #1336: without this normalisation, requests like
 * `/to-sv` (default locale = en) against a rule `source: '/:locale/to-sv'`
 * with `locale: false` do not match because there is no segment for
 * `:locale`. After normalisation the request looks like `/en/to-sv` and
 * the rule matches with `:locale=en`.
 *
 * Ported from Text.js: packages/text/src/server/lib/router-utils/resolve-routes.ts
 * https://github.com/vercel/next.js/blob/canary/packages/text/src/server/lib/router-utils/resolve-routes.ts
 */
export function normalizeDefaultLocalePathname(
  pathname: string,
  i18n: TextI18nConfig | null | undefined,
  options: { hostname?: string | null } = {},
): string {
  if (!i18n) return pathname
  // Don't touch internal paths.
  if (pathname.startsWith('/_text/') || pathname.startsWith('/__text/')) {
    return pathname
  }
  // If the path already starts with a known locale, leave it alone.
  const parts = pathname.split('/', 3)
  // parts[0] is the empty string before the leading "/", parts[1] is the first segment.
  if (parts[1] && i18n.locales.includes(parts[1])) return pathname

  // Pick the default locale: prefer the domain-mapped one when host matches.
  const domainLocale = detectDomainLocale(i18n.domains, options.hostname ?? undefined)
  const defaultLocale = domainLocale?.defaultLocale ?? i18n.defaultLocale

  if (pathname === '/') return `/${defaultLocale}`
  return `/${defaultLocale}${pathname}`
}

/**
 * Extract locale prefix from a URL path.
 * e.g. /fr/about -> { locale: "fr", url: "/about", hadPrefix: true }
 *      /about    -> { locale: defaultLocale, url: "/about", hadPrefix: false }
 */
export function extractLocaleFromUrl(
  url: string,
  i18nConfig: TextI18nConfig,
  defaultLocale = i18nConfig.defaultLocale,
): { locale: string; url: string; hadPrefix: boolean } {
  const pathname = url.split('?')[0]
  const parts = pathname.split('/').filter(Boolean)
  const query = url.includes('?') ? url.slice(url.indexOf('?')) : ''

  if (parts.length > 0 && i18nConfig.locales.includes(parts[0])) {
    const locale = parts[0]
    const rest = '/' + parts.slice(1).join('/')
    return { locale, url: (rest || '/') + query, hadPrefix: true }
  }

  return { locale: defaultLocale, url, hadPrefix: false }
}

/**
 * Strip a leading i18n locale segment from a URL so the result can be used for
 * API route matching. Mirrors Text.js's base-server behaviour for Pages
 * Router API routes: `normalizeLocalePath(pathname, i18n.locales).pathname`
 * runs before the `/api/*` check so `/fr/api/ok` resolves to the
 * `pages/api/ok` handler instead of 404'ing.
 *
 * Returns the original URL untouched when:
 * - `i18nConfig` is null/undefined (no i18n configured)
 * - the URL does not start with a configured locale
 *
 * The query string is preserved verbatim — only the path segment is stripped.
 *
 * Reference: packages/text/src/shared/lib/i18n/normalize-locale-path.ts.
 */
export function stripI18nLocaleForApiRoute(
  url: string,
  i18nConfig: TextI18nConfig | null | undefined,
): string {
  if (!i18nConfig) return url
  const { url: stripped, hadPrefix } = extractLocaleFromUrl(url, i18nConfig)
  return hadPrefix ? stripped : url
}

/**
 * Detect the preferred locale from the Accept-Language header.
 * Returns the best matching locale or null.
 */
export function detectLocaleFromAcceptLanguage(
  acceptLang: string | null | undefined,
  i18nConfig: TextI18nConfig,
): string | null {
  if (!acceptLang) return null

  const langs = acceptLang
    .split(',')
    .map(part => {
      const [lang, qPart] = part.trim().split(';')
      const q = qPart ? parseFloat(qPart.replace('q=', '')) : 1
      return { lang: lang.trim().toLowerCase(), q }
    })
    .sort((a, b) => b.q - a.q)

  for (const { lang } of langs) {
    const exactMatch = i18nConfig.locales.find(locale => locale.toLowerCase() === lang)
    if (exactMatch) return exactMatch

    const prefix = lang.split('-')[0]
    const prefixMatch = i18nConfig.locales.find(locale => {
      const lowered = locale.toLowerCase()
      return lowered === prefix || lowered.startsWith(prefix + '-')
    })
    if (prefixMatch) return prefixMatch
  }

  return null
}

/**
 * Parse the TEXT_LOCALE cookie.
 * Returns the cookie value if it matches a configured locale, otherwise null.
 */
export function parseCookieLocaleFromHeader(
  cookieHeader: string | null | undefined,
  i18nConfig: TextI18nConfig,
): string | null {
  if (!cookieHeader) return null

  const match = cookieHeader.match(/(?:^|;\s*)TEXT_LOCALE=([^;]*)/)
  if (!match) return null

  let value: string
  try {
    value = decodeURIComponent(match[1].trim())
  } catch {
    return null
  }

  if (i18nConfig.locales.includes(value)) return value
  return null
}

function formatLocalizedRootPath(
  locale: string,
  defaultLocale: string,
  basePath = '',
  trailingSlash = false,
  search = '',
): string | undefined {
  if (locale.toLowerCase() === defaultLocale.toLowerCase()) return undefined
  const rootPath = `${basePath}/${locale}${trailingSlash ? '/' : ''}`
  return `${rootPath.replace(/\/{2,}/g, '/')}${search}`
}

export function getLocaleRedirect({
  headers,
  textConfig,
  pathLocale,
  urlParsed,
}: LocaleRedirectOptions): string | undefined {
  const i18n = textConfig.i18n
  // Text.js treats localeDetection as the global auto-redirect switch, so
  // disabling it also disables root domain-locale redirects, including
  // cross-domain redirects driven by the current host or Accept-Language.
  if (!i18n || i18n.localeDetection === false || urlParsed.pathname !== '/') return undefined

  const domainLocale = detectDomainLocale(i18n.domains, urlParsed.hostname ?? undefined)
  const defaultLocale = domainLocale?.defaultLocale || i18n.defaultLocale
  const preferredLocale =
    detectLocaleFromAcceptLanguage(readHeader(headers, 'accept-language'), i18n) ?? undefined
  const detectedLocale =
    pathLocale ||
    domainLocale?.defaultLocale ||
    (parseCookieLocaleFromHeader(readHeader(headers, 'cookie'), i18n) ?? undefined) ||
    preferredLocale ||
    i18n.defaultLocale
  const search = urlParsed.search ?? ''

  const preferredDomain = detectDomainLocale(i18n.domains, undefined, preferredLocale)
  if (domainLocale && preferredDomain) {
    const sameDomain =
      normalizeHostname(domainLocale.domain) === normalizeHostname(preferredDomain.domain)
    const sameLocale =
      preferredLocale !== undefined &&
      preferredDomain.defaultLocale.toLowerCase() === preferredLocale.toLowerCase()

    if (!sameDomain || !sameLocale) {
      // sameDomain && !sameLocale yields a locale-prefixed redirect on the same
      // host (for example /nl-BE). This matches Text.js and doesn't loop because
      // the text request is prefixed and therefore skips getLocaleRedirect().
      const scheme = `http${preferredDomain.http ? '' : 's'}`
      const localePath = sameLocale || preferredLocale === undefined ? '' : `/${preferredLocale}`
      const basePath = textConfig.basePath ?? ''
      const rootPath = `${basePath}${localePath}${textConfig.trailingSlash ? '/' : ''}` || '/'
      const normalizedPath = rootPath.startsWith('/') ? rootPath : `/${rootPath}`
      return `${scheme}://${preferredDomain.domain}${normalizedPath}${search}`
    }
  }

  return formatLocalizedRootPath(
    detectedLocale,
    defaultLocale,
    textConfig.basePath,
    textConfig.trailingSlash,
    search,
  )
}

export function resolvePagesI18nRequest(
  url: string,
  i18nConfig: TextI18nConfig,
  headers?: HeaderBag,
  hostname?: string | null,
  basePath = '',
  trailingSlash = false,
): PagesI18nRequestInfo {
  const domainLocale = detectDomainLocale(i18nConfig.domains, hostname ?? undefined)
  const defaultLocale = domainLocale?.defaultLocale || i18nConfig.defaultLocale
  const localeInfo = extractLocaleFromUrl(url, i18nConfig, defaultLocale)

  let redirectUrl: string | undefined
  if (!localeInfo.hadPrefix) {
    redirectUrl = getLocaleRedirect({
      headers,
      textConfig: {
        basePath,
        i18n: i18nConfig,
        trailingSlash,
      },
      urlParsed: {
        hostname,
        pathname: localeInfo.url.split('?')[0] || '/',
        search: localeInfo.url.includes('?')
          ? localeInfo.url.slice(localeInfo.url.indexOf('?'))
          : '',
      },
    })
  }

  return {
    ...localeInfo,
    domainLocale,
    redirectUrl,
  }
}
