/**
 * text/error shim
 *
 * Provides the default Text.js error page component.
 * Used by apps that import `import Error from 'text/error'` for
 * custom error handling in getServerSideProps or API routes.
 *
 * Also re-exports the unstable App Router error-boundary HOC
 * (`unstable_catchError`) and its `ErrorInfo` type, mirroring
 * `text/error`'s public surface.
 */
import { appRouterInstance, isTextRouterError } from './navigation.js'
import {
  createTextCompatElement,
  TextCompatComponent,
  startTextCompatTransition,
  type TextCompatComponentType,
  type TextCompatElement,
  type TextCompatNode,
} from './component-adapter.js'
import { createTextCompatProtocolElement } from './rue-element-compat.js'

type ErrorProps = {
  statusCode: number
  title?: string
  withDarkMode?: boolean
}

function ErrorComponent({ statusCode, title }: ErrorProps): TextCompatElement {
  const defaultTitle = statusCode === 404 ? 'This page could not be found' : 'Internal Server Error'

  const displayTitle = title ?? defaultTitle

  return createTextCompatElement(
    'div',
    {
      style: {
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        height: '100vh',
        textAlign: 'center' as const,
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
      },
    },
    createTextCompatElement(
      'div',
      null,
      createTextCompatElement(
        'h1',
        {
          style: {
            display: 'inline-block',
            margin: '0 20px 0 0',
            padding: '0 23px 0 0',
            fontSize: 24,
            fontWeight: 500,
            verticalAlign: 'top',
            lineHeight: '49px',
            borderRight: '1px solid rgba(0, 0, 0, .3)',
          },
        },
        statusCode,
      ),
      createTextCompatElement(
        'div',
        { style: { display: 'inline-block' } },
        createTextCompatElement(
          'h2',
          {
            style: {
              fontSize: 14,
              fontWeight: 400,
              lineHeight: '49px',
              margin: 0,
            },
          },
          displayTitle + '.',
        ),
      ),
    ),
  )
}

export default ErrorComponent

// ---------------------------------------------------------------------------
// unstable_catchError — App Router error-boundary HOC
//
// `unstable_catchError(fallback)` returns a Component that renders `children`
// and, if the children throw, renders the user-supplied fallback with an
// `ErrorInfo` object. Internal Text.js navigation signals (redirect /
// notFound / forbidden / unauthorized) are rethrown so they reach the outer
// framework boundaries.
//
// Ported from Text.js:
//   https://github.com/vercel/next.js/blob/canary/packages/text/src/client/components/catch-error.tsx
//   https://github.com/vercel/next.js/blob/canary/packages/text/src/api/error.ts
//   https://github.com/vercel/next.js/blob/canary/packages/text/src/api/error.rue-server.ts
//
// Differences from Text.js:
//   - `unstable_retry()` matches Text.js's App Router behavior on the
//     client — it calls `appRouterInstance.refresh()` inside the transition
//     scheduler and then resets the boundary. On the server it throws
//     (consistent with class boundaries only being installed during SSR
//     setup, where retry isn't meaningful). The
//     Pages-Router-only error message Text.js throws
//     (`unstable_retry()` can only be used in the App Router. Use
//     `reset()` in the Pages Router.) is not currently dispatched because
//     text's boundary doesn't read `PagesRouterContext`. Calling retry
//     under Pages Router will trigger an App Router refresh, which is a
//     no-op in that environment — the error remains visible until
//     `reset()` is called. Tracked as a parity follow-up.
//   - Bot-user-agent graceful-degradation, `handleHardNavError`, and
//     `handleISRError` are not yet supported. Errors always render the
//     fallback in non-bot contexts.
//   - The single implementation runs in both rue-server and client
//     conditions. In Text.js, the rue-server build exports a throwing stub
//     because the API is documented as client-only. Here we let module
//     evaluation succeed everywhere so `import { unstable_catchError } from
//     'text/error'` does not break SSR-only bundles; misuse in a Server
//     Component still fails at render time because client class boundaries
//     are unavailable in the rue-server condition for this code path.
// ---------------------------------------------------------------------------

export type ErrorInfo = {
  error: unknown
  reset: () => void
  unstable_retry: () => void
}

type _UserProps = Record<string, unknown>

type _CatchErrorState = { thrownValue: unknown } | null

class _CatchError<P extends _UserProps> extends TextCompatComponent<
  {
    fallback: (props: P, errorInfo: ErrorInfo) => TextCompatNode
    forwardedProps: P
    children?: TextCompatNode
  },
  { error: _CatchErrorState }
> {
  // Match Text.js's DevTools label so userland tooling/snapshots align.
  // https://github.com/vercel/next.js/blob/canary/packages/text/src/client/components/catch-error.tsx
  static displayName = 'unstable_catchError(Text.CatchError)'

  state = { error: null as _CatchErrorState }

  static getDerivedStateFromError(thrownValue: unknown): { error: _CatchErrorState } {
    if (isTextRouterError(thrownValue)) {
      // Re-throw redirect/notFound/etc. so an outer framework boundary handles
      // them. Matches Text.js's CatchError.getDerivedStateFromError().
      throw thrownValue
    }
    return { error: { thrownValue } }
  }

  reset = (): void => {
    this.setState({ error: null })
  }

  unstable_retry = (): void => {
    // Matches Text.js's App Router branch in
    // packages/text/src/client/components/catch-error.tsx — refresh the
    // current route, then clear the error so children re-render. Wrapped in
    // startTransition so the in-flight refresh and the reset commit
    // together (no flash of the children rendering with stale data).
    //
    // On the server, refresh is meaningless and `appRouterInstance.refresh`
    // is a no-op; throw a clear error so callers don't silently swallow a
    // retry attempt during SSR setup. Matches the spirit of Text.js's
    // server-side throw (which lives in error-boundary.tsx, not here).
    if (typeof window === 'undefined') {
      throw new Error(
        '`unstable_retry()` can only be used on the client. Call it from a user ' +
          'interaction handler inside the error fallback.',
      )
    }
    startTextCompatTransition(() => {
      appRouterInstance.refresh()
      this.reset()
    })
  }

  render(): TextCompatNode {
    if (this.state.error) {
      const errorInfo: ErrorInfo = {
        error: this.state.error.thrownValue,
        reset: this.reset,
        unstable_retry: this.unstable_retry,
      }
      return this.props.fallback(this.props.forwardedProps, errorInfo)
    }
    return this.props.children
  }
}

/**
 * Wrap a fallback render function in a Component-level error boundary.
 * Returns a Component that renders `children` and, on error, renders the
 * supplied fallback with an `ErrorInfo` value.
 *
 * Ported from Text.js:
 *   https://github.com/vercel/next.js/blob/canary/packages/text/src/client/components/catch-error.tsx
 */
export function unstable_catchError<P extends _UserProps>(
  fallback: (props: P, errorInfo: ErrorInfo) => TextCompatNode,
): TextCompatComponentType<P & { children?: TextCompatNode }> {
  // The inner class is generic in P, but createElement loses that generic at
  // the call site. Cast it to a non-generic constructor for the specific P
  // we close over here so TypeScript can pick the JSX-style createElement
  // overload without complaining about missing generic instantiation.
  const TypedCatchError = _CatchError as unknown as TextCompatComponentType<{
    fallback: (props: P, errorInfo: ErrorInfo) => TextCompatNode
    forwardedProps: P
    children?: TextCompatNode
  }>

  function CatchErrorBoundary(allProps: P & { children?: TextCompatNode }): TextCompatElement {
    const { children, ...rest } = allProps
    const forwardedProps = rest as unknown as P
    return createTextCompatProtocolElement(
      TypedCatchError,
      { fallback, forwardedProps },
      children as TextCompatNode,
    ) as TextCompatElement
  }
  CatchErrorBoundary.displayName = `unstable_catchError(${fallback.name || 'CatchErrorFallback'})`
  return CatchErrorBoundary
}
