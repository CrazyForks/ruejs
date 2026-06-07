import {
  buildRevalidateCacheControl,
  NO_STORE_CACHE_CONTROL,
  STATIC_CACHE_CONTROL,
} from './cache-control.js'
import { TEXT_MOUNTED_SLOTS_HEADER, TEXT_PARAMS_HEADER, TEXT_TIMING_HEADER } from './headers.js'
import { setCacheStateHeaders } from './cache-headers.js'
import { mergeMiddlewareResponseHeaders } from './middleware-response-headers.js'
import {
  TEXT_RSC_CONTENT_TYPE,
  TEXT_RSC_VARY_HEADER,
  applyRscCompatibilityIdHeader,
} from './app-rsc-cache-busting.js'

const HTML_DOCTYPE = '<!DOCTYPE html>'

export type AppPageMiddlewareContext = {
  headers: Headers | null
  status: number | null
}

export type AppPageResponseTiming = {
  compileEnd?: number
  handlerStart: number
  renderEnd?: number
  responseKind: 'html' | 'rsc'
}

type AppPageResponsePolicy = {
  cacheControl?: string
  cacheState?: 'MISS' | 'STATIC'
}

type ResolveAppPageResponsePolicyBaseOptions = {
  isDraftMode: boolean
  isDynamicError: boolean
  isForceDynamic: boolean
  isForceStatic: boolean
  isProduction: boolean
  expireSeconds?: number
  revalidateSeconds: number | null
}

type ResolveAppPageRscResponsePolicyOptions = {
  dynamicUsedDuringBuild: boolean
} & ResolveAppPageResponsePolicyBaseOptions

type ResolveAppPageHtmlResponsePolicyOptions = {
  dynamicUsedDuringRender: boolean
  isProgressiveActionRender?: boolean
  hasScriptNonce: boolean
} & ResolveAppPageResponsePolicyBaseOptions

type AppPageHtmlResponsePolicy = {
  shouldWriteToCache: boolean
} & AppPageResponsePolicy

type BuildAppPageRscResponseOptions = {
  isEdgeRuntime?: boolean
  middlewareContext: AppPageMiddlewareContext
  mountedSlotsHeader?: string | null
  params?: Record<string, unknown>
  policy: AppPageResponsePolicy
  timing?: AppPageResponseTiming
}

type BuildAppPageHtmlResponseOptions = {
  draftCookie?: string | null
  fontLinkHeader?: string
  isEdgeRuntime?: boolean
  middlewareContext: AppPageMiddlewareContext
  policy: AppPageResponsePolicy
  timing?: AppPageResponseTiming
}

function applyTimingHeader(headers: Headers, timing?: AppPageResponseTiming): void {
  if (!timing) {
    return
  }

  const handlerStart = Math.round(timing.handlerStart)
  const compileMs =
    timing.compileEnd !== undefined ? Math.round(timing.compileEnd - timing.handlerStart) : -1
  const renderMs =
    timing.responseKind === 'html' &&
    timing.renderEnd !== undefined &&
    timing.compileEnd !== undefined
      ? Math.round(timing.renderEnd - timing.compileEnd)
      : -1

  headers.set(TEXT_TIMING_HEADER, `${handlerStart},${compileMs},${renderMs}`)
}

function ensureHtmlDoctypeStream(stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = stream.getReader()
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  let checked = false

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read()
      if (done) {
        if (!checked) controller.enqueue(encoder.encode(HTML_DOCTYPE))
        controller.close()
        return
      }

      if (!checked) {
        checked = true
        const prefix = decoder.decode(value.slice(0, 64))
        if (!/^\s*<!doctype\s+html(?:\s|>)/i.test(prefix)) {
          controller.enqueue(encoder.encode(HTML_DOCTYPE))
        }
      }

      controller.enqueue(value)
    },
    cancel(reason) {
      return reader.cancel(reason)
    },
  })
}

export function resolveAppPageRscResponsePolicy(
  options: ResolveAppPageRscResponsePolicyOptions,
): AppPageResponsePolicy {
  if (options.isDraftMode) {
    return { cacheControl: NO_STORE_CACHE_CONTROL }
  }

  if (options.isForceDynamic || options.dynamicUsedDuringBuild) {
    return { cacheControl: NO_STORE_CACHE_CONTROL }
  }

  // revalidate = 0 means "always dynamic, never cache" — equivalent to
  // force-dynamic for caching purposes. Must be checked before the
  // isForceStatic/isDynamicError branch below, which uses !revalidateSeconds
  // and would incorrectly catch 0 as a falsy value.
  if (options.revalidateSeconds === 0) {
    return { cacheControl: NO_STORE_CACHE_CONTROL }
  }

  if (
    ((options.isForceStatic || options.isDynamicError) && !options.revalidateSeconds) ||
    options.revalidateSeconds === Infinity
  ) {
    return {
      cacheControl: STATIC_CACHE_CONTROL,
      cacheState: 'STATIC',
    }
  }

  if (options.revalidateSeconds) {
    return {
      cacheControl: buildRevalidateCacheControl(options.revalidateSeconds, options.expireSeconds),
      // Emit MISS as part of the initial RSC response shape rather than bolting
      // it on later in the cache-write block so response construction stays
      // centralized in this helper. This matches the eventual write path: the
      // first ISR-eligible production response is a cache miss.
      cacheState: options.isProduction ? 'MISS' : undefined,
    }
  }

  return {}
}

export function resolveAppPageHtmlResponsePolicy(
  options: ResolveAppPageHtmlResponsePolicyOptions,
): AppPageHtmlResponsePolicy {
  if (options.isDraftMode) {
    return {
      cacheControl: NO_STORE_CACHE_CONTROL,
      shouldWriteToCache: false,
    }
  }

  if (options.isForceDynamic) {
    return {
      cacheControl: NO_STORE_CACHE_CONTROL,
      shouldWriteToCache: false,
    }
  }

  if (options.hasScriptNonce) {
    return {
      cacheControl: NO_STORE_CACHE_CONTROL,
      shouldWriteToCache: false,
    }
  }

  if (options.isProgressiveActionRender) {
    return {
      cacheControl: NO_STORE_CACHE_CONTROL,
      shouldWriteToCache: false,
    }
  }

  // revalidate = 0 means "always dynamic, never cache" — equivalent to
  // force-dynamic for caching purposes. Must be checked before the
  // isForceStatic/isDynamicError branch below, which matches revalidateSeconds
  // === 0 and would incorrectly return a static Cache-Control.
  if (options.revalidateSeconds === 0) {
    return {
      cacheControl: NO_STORE_CACHE_CONTROL,
      shouldWriteToCache: false,
    }
  }

  if ((options.isForceStatic || options.isDynamicError) && options.revalidateSeconds === null) {
    return {
      cacheControl: STATIC_CACHE_CONTROL,
      cacheState: 'STATIC',
      shouldWriteToCache: false,
    }
  }

  if (options.dynamicUsedDuringRender) {
    return {
      cacheControl: NO_STORE_CACHE_CONTROL,
      shouldWriteToCache: false,
    }
  }

  if (
    options.revalidateSeconds !== null &&
    options.revalidateSeconds > 0 &&
    options.revalidateSeconds !== Infinity
  ) {
    return {
      cacheControl: buildRevalidateCacheControl(options.revalidateSeconds, options.expireSeconds),
      cacheState: options.isProduction ? 'MISS' : undefined,
      shouldWriteToCache: options.isProduction,
    }
  }

  if (options.revalidateSeconds === Infinity) {
    return {
      cacheControl: STATIC_CACHE_CONTROL,
      cacheState: 'STATIC',
      shouldWriteToCache: false,
    }
  }

  return { shouldWriteToCache: false }
}

export { mergeMiddlewareResponseHeaders }

/**
 * Mirror Text.js' edge-runtime marker (set in edge-ssr-app.ts). Only routes
 * whose resolved segment config is `runtime = "edge"` should advertise it —
 * nodejs-runtime routes must not, otherwise downstream consumers can't tell
 * the configured runtime from the response. Centralized so every response
 * construction site can opt in without re-deriving the header name.
 */
export function applyEdgeRuntimeHeader(headers: Headers, isEdgeRuntime: boolean | undefined): void {
  if (isEdgeRuntime) {
    headers.set('x-edge-runtime', '1')
  }
}

export function buildAppPageRscResponse(
  body: ReadableStream,
  options: BuildAppPageRscResponseOptions,
): Response {
  const headers = new Headers({
    'Content-Type': TEXT_RSC_CONTENT_TYPE,
    Vary: TEXT_RSC_VARY_HEADER,
  })

  applyEdgeRuntimeHeader(headers, options.isEdgeRuntime)

  if (options.params && Object.keys(options.params).length > 0) {
    // encodeURIComponent so non-ASCII params (e.g. Korean slugs) survive the
    // HTTP ByteString constraint — Headers.set() rejects chars above U+00FF.
    headers.set(TEXT_PARAMS_HEADER, encodeURIComponent(JSON.stringify(options.params)))
  }
  if (options.mountedSlotsHeader) {
    headers.set(TEXT_MOUNTED_SLOTS_HEADER, options.mountedSlotsHeader)
  }
  if (options.policy.cacheControl) {
    headers.set('Cache-Control', options.policy.cacheControl)
  }
  if (options.policy.cacheState) {
    setCacheStateHeaders(headers, options.policy.cacheState)
  }
  mergeMiddlewareResponseHeaders(headers, options.middlewareContext.headers)
  applyRscCompatibilityIdHeader(headers)

  applyTimingHeader(headers, options.timing)

  return new Response(body, {
    status: options.middlewareContext.status ?? 200,
    headers,
  })
}

export function buildAppPageHtmlResponse(
  body: ReadableStream,
  options: BuildAppPageHtmlResponseOptions,
): Response {
  const headers = new Headers({
    'Content-Type': 'text/html; charset=utf-8',
    Vary: TEXT_RSC_VARY_HEADER,
  })

  applyEdgeRuntimeHeader(headers, options.isEdgeRuntime)

  if (options.policy.cacheControl) {
    headers.set('Cache-Control', options.policy.cacheControl)
  }
  if (options.policy.cacheState) {
    setCacheStateHeaders(headers, options.policy.cacheState)
  }
  if (options.draftCookie) {
    headers.append('Set-Cookie', options.draftCookie)
  }
  if (options.fontLinkHeader) {
    headers.set('Link', options.fontLinkHeader)
  }

  mergeMiddlewareResponseHeaders(headers, options.middlewareContext.headers)

  applyTimingHeader(headers, options.timing)

  return new Response(ensureHtmlDoctypeStream(body as ReadableStream<Uint8Array>), {
    status: options.middlewareContext.status ?? 200,
    headers,
  })
}
