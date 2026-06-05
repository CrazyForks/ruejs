import type { TextI18nConfig } from '../config/text-config.js'
import {
  getCollectedFetchTags,
  ensureFetchPatch,
  setCurrentFetchSoftTags,
} from '../shims/fetch-cache.js'
import {
  consumeDynamicUsage,
  getAndClearPendingCookies,
  getDraftModeCookieHeader,
  markDynamicUsage,
  setHeadersAccessPhase,
} from '../shims/headers.js'
import { setNavigationContext } from '../shims/navigation.js'
import { getRequestExecutionContext } from '../shims/request-context.js'
import { createRequestContext, runWithRequestContext } from '../shims/unified-request-context.js'
import type { ISRCacheEntry } from './isr-cache.js'
import {
  getAppRouteHandlerRevalidateSeconds,
  hasAppRouteHandlerDefaultExport,
  resolveAppRouteHandlerMethod,
  shouldReadAppRouteHandlerCache,
  type AppRouteHandlerModule,
} from './app-route-handler-policy.js'
import { readAppRouteHandlerCacheResponse } from './app-route-handler-cache.js'
import {
  executeAppRouteHandler,
  type AppRouteDebugLogger,
  type AppRouteHandlerFunction,
  type AppRouteParams,
  type RouteHandlerCacheSetter,
} from './app-route-handler-execution.js'
import { isKnownDynamicAppRoute, isValidHTTPMethod } from './app-route-handler-runtime.js'
import {
  applyRouteHandlerMiddlewareContext,
  type RouteHandlerMiddlewareContext,
} from './app-route-handler-response.js'
import { createStaticGenerationHeadersContext } from './app-static-generation.js'
import { buildPageCacheTags } from './implicit-tags.js'
import { makeThenableParams } from '../shims/thenable-params.js'
import { reportRequestError } from './instrumentation.js'

type AppRouteHandlerDispatchRoute = {
  pattern: string
  routeHandler: AppRouteHandlerModule
  routeSegments: string[]
}

type RouteHandlerCacheGetter = (key: string) => Promise<ISRCacheEntry | null>
type RouteHandlerBackgroundRegenerationErrorContext = {
  routerKind: 'App Router'
  routePath: string
  routeType: 'route'
}
type RouteHandlerBackgroundRegenerator = (
  key: string,
  renderFn: () => Promise<void>,
  errorContext?: RouteHandlerBackgroundRegenerationErrorContext,
) => void

type DispatchAppRouteHandlerOptions = {
  basePath?: string
  cleanPathname: string
  clearRequestContext: () => void
  draftModeSecret: string
  expireSeconds?: number
  i18n?: TextI18nConfig | null
  isDevelopment?: boolean
  isProduction?: boolean
  isrDebug?: AppRouteDebugLogger
  isrGet: RouteHandlerCacheGetter
  isrRouteKey: (pathname: string) => string
  isrSet: RouteHandlerCacheSetter
  middlewareContext: RouteHandlerMiddlewareContext
  middlewareRequestHeaders?: Headers | null
  /**
   * `null` for non-dynamic routes, matching Text.js semantics. The dispatch
   * layer threads this through to the handler context unchanged so user code
   * (`params ? await params : null`) resolves to `null`.
   */
  params: AppRouteParams | null
  request: Request
  route: AppRouteHandlerDispatchRoute
  scheduleBackgroundRegeneration: RouteHandlerBackgroundRegenerator
  searchParams: URLSearchParams
}

function isAppRouteHandlerFunction(value: unknown): value is AppRouteHandlerFunction {
  return typeof value === 'function'
}

function buildRouteHandlerPageCacheTags(
  pathname: string,
  extraTags: string[],
  routeSegments: string[],
): string[] {
  return buildPageCacheTags(pathname, extraTags, routeSegments, 'route')
}

async function runInRouteHandlerRevalidationContext(
  options: {
    cleanPathname: string
    draftModeSecret: string
    dynamicConfig?: string
    routePattern: string
    routeSegments: string[]
  },
  renderFn: () => Promise<void>,
): Promise<void> {
  const headersContext = createStaticGenerationHeadersContext({
    draftModeSecret: options.draftModeSecret,
    dynamicConfig: options.dynamicConfig,
    routeKind: 'route',
    routePattern: options.routePattern,
  })
  const requestContext = createRequestContext({
    headersContext,
    executionContext: getRequestExecutionContext(),
    unstableCacheRevalidation: 'foreground',
  })

  await runWithRequestContext(requestContext, async () => {
    ensureFetchPatch()
    setCurrentFetchSoftTags(
      buildRouteHandlerPageCacheTags(options.cleanPathname, [], options.routeSegments),
    )
    await renderFn()
  })
}

export async function dispatchAppRouteHandler(
  options: DispatchAppRouteHandlerOptions,
): Promise<Response> {
  const { route } = options
  const handler = route.routeHandler
  const method = options.request.method.toUpperCase()
  const revalidateSeconds = getAppRouteHandlerRevalidateSeconds(handler)
  const isDevelopment = options.isDevelopment ?? process.env.NODE_ENV === 'development'
  const isProduction = options.isProduction ?? process.env.NODE_ENV === 'production'

  if (hasAppRouteHandlerDefaultExport(handler) && isDevelopment) {
    console.error(
      '[text] Detected default export in route handler ' +
        route.pattern +
        '. Export a named export for each HTTP method instead.',
    )
  }

  // Reject non-standard HTTP methods before any auto-OPTIONS/405 logic.
  // Text.js returns 400 for invalid methods; text mirrors that behavior.
  // https://github.com/vercel/next.js/blob/canary/packages/text/src/server/route-modules/app-route/module.ts#L390-L392
  if (!isValidHTTPMethod(method)) {
    options.clearRequestContext()
    return applyRouteHandlerMiddlewareContext(
      new Response(null, { status: 400 }),
      options.middlewareContext,
    )
  }

  const { allowHeaderForOptions, handlerFn, isAutoHead, shouldAutoRespondToOptions } =
    resolveAppRouteHandlerMethod(handler, method)

  if (shouldAutoRespondToOptions) {
    options.clearRequestContext()
    return applyRouteHandlerMiddlewareContext(
      new Response(null, {
        status: 204,
        headers: { Allow: allowHeaderForOptions },
      }),
      options.middlewareContext,
    )
  }

  const resolvedHandlerFn = isAppRouteHandlerFunction(handlerFn) ? handlerFn : undefined

  if (
    revalidateSeconds !== null &&
    shouldReadAppRouteHandlerCache({
      dynamicConfig: handler.dynamic,
      handlerFn: resolvedHandlerFn,
      isAutoHead,
      isKnownDynamic: isKnownDynamicAppRoute(route.pattern),
      isProduction,
      method,
      revalidateSeconds,
    }) &&
    resolvedHandlerFn
  ) {
    const cachedRouteResponse = await readAppRouteHandlerCacheResponse({
      basePath: options.basePath,
      buildPageCacheTags(pathname, extraTags) {
        return buildRouteHandlerPageCacheTags(pathname, extraTags, route.routeSegments)
      },
      cleanPathname: options.cleanPathname,
      clearRequestContext: options.clearRequestContext,
      consumeDynamicUsage,
      dynamicConfig: handler.dynamic,
      getCollectedFetchTags,
      handlerFn: resolvedHandlerFn,
      i18n: options.i18n,
      isAutoHead,
      isrDebug: options.isrDebug,
      isrGet: options.isrGet,
      isrRouteKey: options.isrRouteKey,
      isrSet: options.isrSet,
      markDynamicUsage,
      middlewareContext: options.middlewareContext,
      params: options.params,
      requestUrl: options.request.url,
      revalidateSearchParams: options.searchParams,
      expireSeconds: options.expireSeconds,
      revalidateSeconds,
      routePattern: route.pattern,
      runInRevalidationContext(renderFn) {
        return runInRouteHandlerRevalidationContext(
          {
            cleanPathname: options.cleanPathname,
            draftModeSecret: options.draftModeSecret,
            dynamicConfig: handler.dynamic,
            routePattern: route.pattern,
            routeSegments: route.routeSegments,
          },
          renderFn,
        )
      },
      scheduleBackgroundRegeneration(key, renderFn) {
        options.scheduleBackgroundRegeneration(key, renderFn, {
          routerKind: 'App Router',
          routePath: route.pattern,
          routeType: 'route',
        })
      },
      setHeadersAccessPhase,
      setNavigationContext,
    })
    if (cachedRouteResponse) {
      return cachedRouteResponse
    }
  }

  if (resolvedHandlerFn) {
    return executeAppRouteHandler({
      basePath: options.basePath,
      buildPageCacheTags(pathname, extraTags) {
        return buildRouteHandlerPageCacheTags(pathname, extraTags, route.routeSegments)
      },
      cleanPathname: options.cleanPathname,
      clearRequestContext: options.clearRequestContext,
      consumeDynamicUsage,
      draftModeSecret: options.draftModeSecret,
      executionContext: getRequestExecutionContext(),
      getAndClearPendingCookies,
      getCollectedFetchTags,
      getDraftModeCookieHeader,
      handler,
      handlerFn: resolvedHandlerFn,
      i18n: options.i18n,
      isAutoHead,
      isProduction,
      isrDebug: options.isrDebug,
      isrRouteKey: options.isrRouteKey,
      isrSet: options.isrSet,
      markDynamicUsage,
      method,
      middlewareContext: options.middlewareContext,
      middlewareRequestHeaders: options.middlewareRequestHeaders,
      params: options.params === null ? null : makeThenableParams(options.params),
      reportRequestError(error, request, context) {
        void reportRequestError(error, request, context)
      },
      request: options.request,
      expireSeconds: options.expireSeconds,
      revalidateSeconds,
      routePattern: route.pattern,
      setHeadersAccessPhase,
    })
  }

  options.clearRequestContext()
  return applyRouteHandlerMiddlewareContext(
    new Response(null, {
      status: 405,
    }),
    options.middlewareContext,
  )
}
