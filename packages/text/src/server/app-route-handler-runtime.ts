import type { TextI18nConfig } from '../config/text-config.js'
import {
  isTextRequest,
  TextRequest,
  RequestCookies,
  sealRequestCookies,
  sealRequestHeaders,
  type TextURL,
} from '../shims/server.js'
import { buildRequestHeadersFromMiddlewareResponse } from './middleware-request-headers.js'

const ROUTE_HANDLER_HTTP_METHODS = [
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'OPTIONS',
] as const

export type RouteHandlerHttpMethod = (typeof ROUTE_HANDLER_HTTP_METHODS)[number]

export type RouteHandlerModule = Partial<Record<RouteHandlerHttpMethod | 'default', unknown>>

/**
 * Checks whether a string is a recognized HTTP method for App Router route
 * handlers. Invalid methods must be rejected with 400 before any auto-OPTIONS
 * or 405 logic runs.
 *
 * @see https://github.com/vercel/next.js/blob/canary/packages/text/src/server/web/http.ts
 */
export function isValidHTTPMethod(maybeMethod: string): maybeMethod is RouteHandlerHttpMethod {
  return (ROUTE_HANDLER_HTTP_METHODS as readonly string[]).includes(maybeMethod)
}

export function collectRouteHandlerMethods(handler: RouteHandlerModule): RouteHandlerHttpMethod[] {
  const methods = ROUTE_HANDLER_HTTP_METHODS.filter(method => typeof handler[method] === 'function')

  if (methods.includes('GET') && !methods.includes('HEAD')) {
    methods.push('HEAD')
  }

  return methods
}

export function buildRouteHandlerAllowHeader(exportedMethods: readonly string[]): string {
  const allow = new Set(exportedMethods)
  allow.add('OPTIONS')
  return Array.from(allow).sort().join(', ')
}

const _KNOWN_DYNAMIC_APP_ROUTE_HANDLERS_KEY = Symbol.for(
  'text.appRouteHandlerRuntime.knownDynamicHandlers',
)
const _g = globalThis as unknown as Record<PropertyKey, unknown>

// NOTE: This set starts empty on cold start. The first request may serve a
// stale ISR cache entry before the handler runs and signals dynamic usage.
// Text.js avoids this by determining dynamism statically at build time; text
// learns it at runtime and remembers the result for the process lifetime.
const knownDynamicAppRouteHandlers = (_g[_KNOWN_DYNAMIC_APP_ROUTE_HANDLERS_KEY] ??=
  new Set<string>()) as Set<string>

export function isKnownDynamicAppRoute(pattern: string): boolean {
  return knownDynamicAppRouteHandlers.has(pattern)
}

export function markKnownDynamicAppRoute(pattern: string): void {
  knownDynamicAppRouteHandlers.add(pattern)
}

type RequestDynamicAccess =
  | 'request.headers'
  | 'request.cookies'
  | 'request.ip'
  | 'request.geo'
  | 'request.url'
  | 'request.body'
  | 'request.blob'
  | 'request.json'
  | 'request.text'
  | 'request.arrayBuffer'
  | 'request.formData'

type TextUrlDynamicAccess =
  | 'textUrl.search'
  | 'textUrl.searchParams'
  | 'textUrl.url'
  | 'textUrl.href'
  | 'textUrl.toJSON'
  | 'textUrl.toString'
  | 'textUrl.origin'

type AppRouteDynamicRequestAccess = RequestDynamicAccess | TextUrlDynamicAccess
type AppRouteRequestMode = 'auto' | 'force-static' | 'error'

type TrackedAppRouteRequestOptions = {
  basePath?: string
  i18n?: TextI18nConfig | null
  middlewareHeaders?: Headers | null
  onDynamicAccess?: (access: AppRouteDynamicRequestAccess) => void
  requestMode?: AppRouteRequestMode
  staticGenerationErrorMessage?: (expression?: string) => string
}

type TrackedAppRouteRequest = {
  request: TextRequest
  didAccessDynamicRequest(): boolean
}

function bindMethodIfNeeded<T>(value: T, target: object): T {
  return typeof value === 'function' ? (value.bind(target) as T) : value
}

function buildTextConfig(options: TrackedAppRouteRequestOptions): {
  basePath?: string
  i18n?: TextI18nConfig
} | null {
  if (!options.basePath && !options.i18n) {
    return null
  }

  return {
    basePath: options.basePath,
    i18n: options.i18n ?? undefined,
  }
}

function rebuildRequestWithHeaders(input: Request, headers: Headers): Request {
  const method = input.method
  const hasBody = method !== 'GET' && method !== 'HEAD'
  const init: RequestInit & { duplex?: 'half' } = {
    method,
    headers,
    cache: input.cache,
    credentials: input.credentials,
    integrity: input.integrity,
    keepalive: input.keepalive,
    mode: input.mode,
    redirect: input.redirect,
    referrer: input.referrer,
    referrerPolicy: input.referrerPolicy,
    signal: input.signal,
  }

  if (hasBody && input.body) {
    init.body = input.body
    init.duplex = 'half'
  }

  return new Request(input.url, init)
}

function cleanStaticUrl(url: string): string {
  const cleanUrl = new URL(url)
  cleanUrl.protocol = 'http:'
  cleanUrl.host = 'localhost:3000'
  cleanUrl.username = ''
  cleanUrl.password = ''
  cleanUrl.search = ''
  cleanUrl.hash = ''
  return cleanUrl.href
}

function readEmptyBodyAsArrayBuffer(): Promise<ArrayBuffer> {
  return new Response(null).arrayBuffer()
}

function readEmptyBodyAsBlob(): Promise<Blob> {
  return new Response(null).blob()
}

// Empty JSON/form-data parses reject naturally; that keeps force-static body
// stubs aligned with a bodyless request instead of inventing synthetic data.
function readEmptyBodyAsFormData(): Promise<FormData> {
  return new Response(null).formData()
}

function readEmptyBodyAsJson(): Promise<unknown> {
  return new Response(null).json()
}

function readEmptyBodyAsText(): Promise<string> {
  return new Response(null).text()
}

export function createTrackedAppRouteRequest(
  request: Request,
  options: TrackedAppRouteRequestOptions = {},
): TrackedAppRouteRequest {
  let didAccessDynamicRequest = false
  const requestMode = options.requestMode ?? 'auto'
  const textConfig = buildTextConfig(options)

  const markDynamicAccess = (access: AppRouteDynamicRequestAccess): void => {
    didAccessDynamicRequest = true
    options.onDynamicAccess?.(access)
  }

  // Mirror the dynamic request reads that Text.js tracks inside
  // packages/text/src/server/route-modules/app-route/module.ts
  // via proxyTextRequest(), but keep the logic in a normal typed module.
  const wrapTextUrl = (textUrl: TextURL): TextURL => {
    const textUrlHandler: ProxyHandler<TextURL> = {
      get(target, prop): unknown {
        switch (prop) {
          case 'search':
          case 'searchParams':
          case 'url':
          case 'href':
          case 'toJSON':
          case 'toString':
          case 'origin':
            markDynamicAccess(`textUrl.${String(prop)}` as TextUrlDynamicAccess)
            return bindMethodIfNeeded(Reflect.get(target, prop, target), target)
          case 'clone':
            return () => wrapTextUrl(target.clone())
          default:
            return bindMethodIfNeeded(Reflect.get(target, prop, target), target)
        }
      },
    }

    return new Proxy(textUrl, textUrlHandler)
  }

  const wrapForceStaticTextUrl = (textUrl: TextURL): TextURL => {
    const emptySearchParams = new URLSearchParams()
    const staticHref = cleanStaticUrl(textUrl.href)
    const textUrlHandler: ProxyHandler<TextURL> = {
      get(target, prop): unknown {
        switch (prop) {
          case 'search':
            return ''
          case 'searchParams':
            return emptySearchParams
          case 'href':
            return staticHref
          case 'url':
            return undefined
          case 'toJSON':
          case 'toString':
            return () => staticHref
          case 'clone':
            return () => wrapForceStaticTextUrl(target.clone())
          default:
            return bindMethodIfNeeded(Reflect.get(target, prop, target), target)
        }
      },
    }

    return new Proxy(textUrl, textUrlHandler)
  }

  const throwStaticGenerationError = (expression: string): never => {
    throw new Error(
      options.staticGenerationErrorMessage?.(expression) ??
        `Route handler with \`dynamic = "error"\` used ${expression}.`,
    )
  }

  const wrapRequireStaticTextUrl = (textUrl: TextURL): TextURL => {
    const textUrlHandler: ProxyHandler<TextURL> = {
      get(target, prop): unknown {
        switch (prop) {
          case 'search':
          case 'searchParams':
          case 'url':
          case 'href':
          case 'toJSON':
          case 'toString':
          case 'origin':
            return throwStaticGenerationError(`textUrl.${String(prop)}`)
          case 'clone':
            return () => wrapRequireStaticTextUrl(target.clone())
          default:
            return bindMethodIfNeeded(Reflect.get(target, prop, target), target)
        }
      },
    }

    return new Proxy(textUrl, textUrlHandler)
  }

  const wrapRequest = (input: Request): TextRequest => {
    const requestHeaders = options.middlewareHeaders
      ? buildRequestHeadersFromMiddlewareResponse(input.headers, options.middlewareHeaders)
      : null
    const requestWithOverrides = requestHeaders
      ? rebuildRequestWithHeaders(input, requestHeaders)
      : input
    const textRequest = isTextRequest(requestWithOverrides)
      ? requestWithOverrides
      : new TextRequest(requestWithOverrides, { textConfig: textConfig ?? undefined })
    let proxiedTextUrl: TextURL | null = null
    let forceStaticTextUrl: TextURL | null = null
    let requireStaticTextUrl: TextURL | null = null
    let forceStaticHeaders: Headers | null = null
    let forceStaticCookies: RequestCookies | null = null

    const requestHandler: ProxyHandler<TextRequest> = {
      get(target, prop): unknown {
        if (requestMode === 'force-static') {
          switch (prop) {
            case 'textUrl':
              forceStaticTextUrl ??= wrapForceStaticTextUrl(target.textUrl)
              return forceStaticTextUrl
            case 'headers':
              forceStaticHeaders ??= sealRequestHeaders(new Headers())
              return forceStaticHeaders
            case 'cookies':
              forceStaticCookies ??= sealRequestCookies(new RequestCookies(new Headers()))
              return forceStaticCookies
            case 'url':
              return cleanStaticUrl(target.textUrl.href)
            case 'ip':
            case 'geo':
              return undefined
            case 'body':
              return null
            case 'arrayBuffer':
              return readEmptyBodyAsArrayBuffer
            case 'blob':
              return readEmptyBodyAsBlob
            case 'formData':
              return readEmptyBodyAsFormData
            case 'json':
              return readEmptyBodyAsJson
            case 'text':
              return readEmptyBodyAsText
            case 'clone':
              return () => wrapRequest(target.clone())
            default:
              return bindMethodIfNeeded(Reflect.get(target, prop, target), target)
          }
        }

        if (requestMode === 'error') {
          switch (prop) {
            case 'textUrl':
              requireStaticTextUrl ??= wrapRequireStaticTextUrl(target.textUrl)
              return requireStaticTextUrl
            case 'headers':
            case 'cookies':
            case 'url':
            // Deliberate text divergence from Text.js: ip/geo are exposed
            // on TextRequest for Cloudflare compatibility, so require-static
            // treats them as dynamic request APIs instead of falling through.
            case 'ip':
            case 'geo':
            case 'body':
            case 'blob':
            case 'json':
            case 'text':
            case 'arrayBuffer':
            case 'formData':
              return throwStaticGenerationError(`request.${String(prop)}`)
            case 'clone':
              return () => wrapRequest(target.clone())
            default:
              return bindMethodIfNeeded(Reflect.get(target, prop, target), target)
          }
        }

        switch (prop) {
          case 'textUrl':
            proxiedTextUrl ??= wrapTextUrl(target.textUrl)
            return proxiedTextUrl
          case 'headers':
          case 'cookies':
          case 'ip':
          case 'geo':
          case 'url':
          case 'body':
          case 'blob':
          case 'json':
          case 'text':
          case 'arrayBuffer':
          case 'formData':
            markDynamicAccess(`request.${String(prop)}` as RequestDynamicAccess)
            return bindMethodIfNeeded(Reflect.get(target, prop, target), target)
          case 'clone':
            return () => wrapRequest(target.clone())
          default:
            return bindMethodIfNeeded(Reflect.get(target, prop, target), target)
        }
      },
    }

    return new Proxy(textRequest, requestHandler)
  }

  return {
    request: wrapRequest(request),
    didAccessDynamicRequest() {
      return didAccessDynamicRequest
    },
  }
}
