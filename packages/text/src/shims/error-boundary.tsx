'use client'

import { useEffect } from './hooks-adapter.js'
// Import the local shim, not the public text/navigation alias. The built
// package may execute this file before the plugin's resolveId hook is active.
import { isRedirectError, usePathname, useRouter } from './navigation.js'
import { isNavigationSignalError } from '../utils/navigation-signal.js'
import {
  TextCompatComponent,
  createTextCompatElement,
  startTextCompatTransition,
  type TextCompatComponentType,
  type TextCompatNode,
} from './component-adapter.js'
import { markAppSsrPassthroughComponent } from '../server/app-ssr-passthrough-protocol.js'

export type ErrorBoundaryProps = {
  fallback: TextCompatComponentType<{ error: unknown; reset: () => void }>
  children: TextCompatNode
  resetKey?: string | null
}

type CapturedError = {
  thrownValue: unknown
}

type DigestError = Error & { digest?: string }

type RedirectBoundaryState = {
  redirect: string | null
  redirectType: 'push' | 'replace' | null
}

type RedirectError = Error & {
  digest: string
  handled?: boolean
}

type ErrorBoundaryInnerProps = {
  pathname: string
} & ErrorBoundaryProps

export type ErrorBoundaryState = {
  error: CapturedError | null
  previousPathname: string
  previousResetKey: string | null
}

export type BoundaryResetProps = {
  pathname: string
  resetKey?: string | null
}

export type BoundaryResetState = {
  previousPathname: string
  previousResetKey: string | null
}

export function normalizeBoundaryResetKey(resetKey: string | null | undefined): string | null {
  return resetKey === undefined || resetKey === null || resetKey === '' ? null : resetKey
}

export function readBoundaryResetState(props: BoundaryResetProps): BoundaryResetState {
  return {
    previousPathname: props.pathname,
    previousResetKey: normalizeBoundaryResetKey(props.resetKey),
  }
}

export function shouldResetBoundary(
  textResetState: BoundaryResetState,
  previousResetState: BoundaryResetState,
): boolean {
  const textResetKey = normalizeBoundaryResetKey(textResetState.previousResetKey)
  const previousResetKey = normalizeBoundaryResetKey(previousResetState.previousResetKey)

  if (textResetKey !== null || previousResetKey !== null) {
    return textResetKey !== previousResetKey
  }

  return textResetState.previousPathname !== previousResetState.previousPathname
}

export function deriveErrorBoundaryStateFromError(
  error: unknown,
): Pick<ErrorBoundaryState, 'error'> {
  if (isNavigationSignalError(error)) {
    throw error
  }
  return { error: { thrownValue: error } }
}

function getThrownValueMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function getThrownValueStack(error: unknown): string {
  return error instanceof Error ? error.stack || '' : ''
}

function errorDigest(input: string): string {
  let hash = 5381
  for (let i = input.length - 1; i >= 0; i--) {
    hash = (hash * 33) ^ input.charCodeAt(i)
  }
  return (hash >>> 0).toString()
}

function sanitizeErrorForServerRenderedBoundary(error: unknown): unknown {
  if (typeof window !== 'undefined' || process.env.NODE_ENV !== 'production') {
    return error
  }

  const sanitized: DigestError = new Error(
    'An error occurred in the Server Components render. ' +
      'The specific message is omitted in production builds to avoid leaking sensitive details. ' +
      'A digest property is included on this error instance which may provide additional details about the nature of the error.',
  )
  Object.defineProperty(sanitized, 'stack', {
    configurable: true,
    value: undefined,
  })
  sanitized.digest = errorDigest(getThrownValueMessage(error) + getThrownValueStack(error))
  return sanitized
}

export function deriveErrorBoundaryStateFromProps(
  props: BoundaryResetProps,
  state: Pick<ErrorBoundaryState, 'error'> & BoundaryResetState,
): ErrorBoundaryState {
  const textResetState = readBoundaryResetState(props)
  if (state.error && shouldResetBoundary(textResetState, state)) {
    return { error: null, ...textResetState }
  }
  return { error: state.error, ...textResetState }
}

function decodeRedirectTarget(target: string): string {
  try {
    return decodeURIComponent(target)
  } catch {
    return target
  }
}

function getURLFromRedirectError(error: RedirectError): string | null {
  const parts = error.digest.split(';')
  // text emits 3-part (redirect: `TEXT_REDIRECT;;<encoded>`) or 4-part
  // (permanentRedirect: `TEXT_REDIRECT;<type>;<encoded>;308`) digests;
  // Text.js emits 5-part digests (`TEXT_REDIRECT;<type>;<url>;<status>;<isClient>`).
  // text's `isRedirectError` is more permissive (just `startsWith("TEXT_REDIRECT;")`)
  // so we branch on length rather than always using `slice(2, -2)`.
  const encodedTarget = parts.length >= 5 ? parts.slice(2, -2).join(';') : parts[2]
  return encodedTarget ? decodeRedirectTarget(encodedTarget) : null
}

function getRedirectTypeFromError(error: RedirectError): 'push' | 'replace' {
  const type = error.digest.split(';', 2)[1]
  return type === 'push' ? 'push' : 'replace'
}

function HandleRedirect({
  redirect,
  redirectType,
}: {
  redirect: string
  redirectType: 'push' | 'replace'
}): TextCompatNode {
  const router = useRouter()

  useEffect(() => {
    startTextCompatTransition(() => {
      if (redirectType === 'push') {
        router.push(redirect)
      } else {
        router.replace(redirect)
      }
      // Intentionally no reset() here. The boundary stays in its "redirect
      // caught" state (rendering this component, which returns null) until
      // router.push()/replace() triggers a new render at the destination
      // route. That naturally unmounts this boundary and mounts a fresh one.
      // Calling reset() would clear the boundary state, causing Rue to
      // re-render children — which re-mounts the page component that threw
      // redirect() in the first place. For deterministic redirects (e.g.
      // auth guards), that creates an infinite redirect loop.
      // Matches Text.js's HandleRedirect in redirect-boundary.tsx.
    })
  }, [redirect, redirectType, router])

  return null
}

export class RedirectErrorBoundary extends TextCompatComponent<
  { children?: TextCompatNode },
  RedirectBoundaryState
> {
  constructor(props: { children?: TextCompatNode }) {
    super(props)
    this.state = {
      redirect: null,
      redirectType: null,
    }
  }

  static getDerivedStateFromError(error: unknown): RedirectBoundaryState {
    if (isRedirectError(error)) {
      // The public `isRedirectError` narrows to `Error & { digest: string }`.
      // Cast to the local `RedirectError` (which also carries the optional
      // `handled` field) so the parity logic below compiles. The cast is
      // safe because every error that matches the prefix predicate is — by
      // construction — produced by text's `redirect()` /
      // `permanentRedirect()` helpers, which yield `Error` instances.
      const redirectError = error as RedirectError
      // Text.js parity: an outer RedirectBoundary that has already started
      // handling a redirect marks the error as `handled` so that, if Rue
      // re-throws the same error during a retry render, an inner boundary
      // doesn't re-dispatch the same `router.replace()`. Text doesn't
      // currently emit `handled` itself (we never assign it on the error
      // object), but we keep the branch so behavior matches Text.js if a
      // host or future change ever does.
      if (redirectError.handled) {
        return {
          redirect: null,
          redirectType: null,
        }
      }

      const url = getURLFromRedirectError(redirectError)
      if (url === null) {
        // Malformed digest (e.g. `TEXT_REDIRECT;push;` with an empty URL
        // segment). The server-side parser at text-error-digest.ts:51 also
        // rejects this. Re-throw so the error reaches a regular error
        // boundary instead of being silently swallowed.
        throw error
      }

      return {
        redirect: url,
        redirectType: getRedirectTypeFromError(redirectError),
      }
    }

    throw error
  }

  render(): TextCompatNode {
    const { redirect, redirectType } = this.state
    if (redirect !== null && redirectType !== null) {
      return createTextCompatElement(HandleRedirect, { redirect, redirectType })
    }

    return this.props.children
  }
}

export function RedirectBoundary({ children }: { children?: TextCompatNode }): TextCompatNode {
  return createTextCompatElement(RedirectErrorBoundary, null, children)
}

/**
 * Generic ErrorBoundary used to wrap route segments with error.tsx.
 * This must be a client component since error boundaries use
 * componentDidCatch / getDerivedStateFromError.
 */
export class ErrorBoundaryInner extends TextCompatComponent<
  ErrorBoundaryInnerProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryInnerProps) {
    super(props)
    this.state = { error: null, ...readBoundaryResetState(props) }
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryInnerProps,
    state: ErrorBoundaryState,
  ): ErrorBoundaryState | null {
    return deriveErrorBoundaryStateFromProps(props, state)
  }

  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    return deriveErrorBoundaryStateFromError(error)
  }

  reset = () => {
    this.setState({ error: null })
  }

  render(): TextCompatNode {
    if (this.state.error) {
      const FallbackComponent = this.props.fallback
      return createTextCompatElement(FallbackComponent, {
        error: sanitizeErrorForServerRenderedBoundary(this.state.error.thrownValue),
        reset: this.reset,
      })
    }
    return this.props.children
  }
}

export function ErrorBoundary({
  fallback,
  children,
  resetKey,
}: ErrorBoundaryProps): TextCompatNode {
  const pathname = usePathname()
  return createTextCompatElement(ErrorBoundaryInner, { pathname, resetKey, fallback }, children)
}

// ---------------------------------------------------------------------------
// NotFoundBoundary — catches notFound() on the client and renders not-found.tsx
// ---------------------------------------------------------------------------

type NotFoundBoundaryProps = {
  fallback: TextCompatNode
  children: TextCompatNode
  resetKey?: string | null
}

type NotFoundBoundaryInnerProps = {
  pathname: string
} & NotFoundBoundaryProps

type NotFoundBoundaryState = {
  notFound: boolean
  previousPathname: string
  previousResetKey: string | null
}

/**
 * Inner class component that catches notFound() errors and renders the
 * not-found.tsx fallback. Resets on the caller's segment reset key when one is
 * provided, otherwise falls back to pathname changes for legacy callers.
 *
 * The ErrorBoundary above re-throws notFound errors so they propagate up to this
 * boundary. This must be placed above the ErrorBoundary in the component tree.
 */
class NotFoundBoundaryInner extends TextCompatComponent<
  NotFoundBoundaryInnerProps,
  NotFoundBoundaryState
> {
  constructor(props: NotFoundBoundaryInnerProps) {
    super(props)
    this.state = { notFound: false, ...readBoundaryResetState(props) }
  }

  static getDerivedStateFromProps(
    props: NotFoundBoundaryInnerProps,
    state: NotFoundBoundaryState,
  ): NotFoundBoundaryState | null {
    const textResetState = readBoundaryResetState(props)
    if (state.notFound && shouldResetBoundary(textResetState, state)) {
      return { notFound: false, ...textResetState }
    }
    return { notFound: state.notFound, ...textResetState }
  }

  static getDerivedStateFromError(error: unknown): Partial<NotFoundBoundaryState> {
    if (error && typeof error === 'object' && 'digest' in error) {
      const digest = String(error.digest)
      if (digest === 'TEXT_NOT_FOUND' || digest === 'TEXT_HTTP_ERROR_FALLBACK;404') {
        return { notFound: true }
      }
    }
    // Not a notFound error — re-throw so it reaches an ErrorBoundary or propagates
    throw error
  }

  render(): TextCompatNode {
    if (this.state.notFound) {
      return this.props.fallback
    }
    return this.props.children
  }
}

/**
 * Wrapper that reads the current pathname and passes it to the inner class
 * component. Segment reset keys own App Router remount semantics when present.
 */
export function NotFoundBoundary({
  fallback,
  children,
  resetKey,
}: NotFoundBoundaryProps): TextCompatNode {
  const pathname = usePathname()
  return createTextCompatElement(NotFoundBoundaryInner, { pathname, resetKey, fallback }, children)
}

// ---------------------------------------------------------------------------
// ForbiddenBoundary — catches forbidden() on the client and renders forbidden.tsx
// ---------------------------------------------------------------------------

type ForbiddenBoundaryProps = {
  fallback: TextCompatNode
  children: TextCompatNode
  resetKey?: string | null
}

type ForbiddenBoundaryInnerProps = {
  pathname: string
} & ForbiddenBoundaryProps

type ForbiddenBoundaryState = {
  forbidden: boolean
  previousPathname: string
  previousResetKey: string | null
}

export class ForbiddenBoundaryInner extends TextCompatComponent<
  ForbiddenBoundaryInnerProps,
  ForbiddenBoundaryState
> {
  constructor(props: ForbiddenBoundaryInnerProps) {
    super(props)
    this.state = { forbidden: false, ...readBoundaryResetState(props) }
  }

  static getDerivedStateFromProps(
    props: ForbiddenBoundaryInnerProps,
    state: ForbiddenBoundaryState,
  ): ForbiddenBoundaryState | null {
    const textResetState = readBoundaryResetState(props)
    if (state.forbidden && shouldResetBoundary(textResetState, state)) {
      return { forbidden: false, ...textResetState }
    }
    return { forbidden: state.forbidden, ...textResetState }
  }

  static getDerivedStateFromError(error: unknown): Partial<ForbiddenBoundaryState> {
    if (error && typeof error === 'object' && 'digest' in error) {
      const digest = String(error.digest)
      if (digest === 'TEXT_HTTP_ERROR_FALLBACK;403') {
        return { forbidden: true }
      }
    }
    throw error
  }

  render(): TextCompatNode {
    if (this.state.forbidden) {
      return this.props.fallback
    }
    return this.props.children
  }
}

export function ForbiddenBoundary({
  fallback,
  children,
  resetKey,
}: ForbiddenBoundaryProps): TextCompatNode {
  const pathname = usePathname()
  return createTextCompatElement(ForbiddenBoundaryInner, { pathname, resetKey, fallback }, children)
}

// ---------------------------------------------------------------------------
// UnauthorizedBoundary — catches unauthorized() on the client and renders unauthorized.tsx
// ---------------------------------------------------------------------------

type UnauthorizedBoundaryProps = {
  fallback: TextCompatNode
  children: TextCompatNode
  resetKey?: string | null
}

type UnauthorizedBoundaryInnerProps = {
  pathname: string
} & UnauthorizedBoundaryProps

type UnauthorizedBoundaryState = {
  unauthorized: boolean
  previousPathname: string
  previousResetKey: string | null
}

export class UnauthorizedBoundaryInner extends TextCompatComponent<
  UnauthorizedBoundaryInnerProps,
  UnauthorizedBoundaryState
> {
  constructor(props: UnauthorizedBoundaryInnerProps) {
    super(props)
    this.state = { unauthorized: false, ...readBoundaryResetState(props) }
  }

  static getDerivedStateFromProps(
    props: UnauthorizedBoundaryInnerProps,
    state: UnauthorizedBoundaryState,
  ): UnauthorizedBoundaryState | null {
    const textResetState = readBoundaryResetState(props)
    if (state.unauthorized && shouldResetBoundary(textResetState, state)) {
      return { unauthorized: false, ...textResetState }
    }
    return { unauthorized: state.unauthorized, ...textResetState }
  }

  static getDerivedStateFromError(error: unknown): Partial<UnauthorizedBoundaryState> {
    if (error && typeof error === 'object' && 'digest' in error) {
      const digest = String(error.digest)
      if (digest === 'TEXT_HTTP_ERROR_FALLBACK;401') {
        return { unauthorized: true }
      }
    }
    throw error
  }

  render(): TextCompatNode {
    if (this.state.unauthorized) {
      return this.props.fallback
    }
    return this.props.children
  }
}

export function UnauthorizedBoundary({
  fallback,
  children,
  resetKey,
}: UnauthorizedBoundaryProps): TextCompatNode {
  const pathname = usePathname()
  return createTextCompatElement(
    UnauthorizedBoundaryInner,
    { pathname, resetKey, fallback },
    children,
  )
}

markAppSsrPassthroughComponent(RedirectBoundary)
markAppSsrPassthroughComponent(ErrorBoundary)
markAppSsrPassthroughComponent(NotFoundBoundary)
markAppSsrPassthroughComponent(ForbiddenBoundary)
markAppSsrPassthroughComponent(UnauthorizedBoundary)

// ---------------------------------------------------------------------------
// DevRecoveryBoundary — dev-only top-level boundary inside BrowserRoot.
// Catches any render error that isn't already handled by a user-defined
// error.tsx (or the access-fallback boundaries above), renders nothing, and
// keeps BrowserRoot mounted so HMR can dispatch a new RSC payload without a
// full page reload. Resets on resetKey change — the caller bumps that key
// (e.g. via treeState.renderId) when a fresh tree is dispatched.
//
// Routing sentinels are re-thrown so notFound()/redirect()/forbidden()/
// unauthorized() still reach their dedicated boundaries above.
// ---------------------------------------------------------------------------

export type DevRecoveryBoundaryProps = {
  resetKey: number
  // Called from componentDidCatch with the current resetKey so the host can
  // run any pending side effects that NavigationCommitSignal would normally
  // drive on commit — most importantly the URL update for the in-flight
  // soft-nav. Without this, a navigation that fails mid-render leaves the
  // browser on the previous URL even though the boundary recovered.
  //
  // The error itself is intentionally not passed: the compat onCaughtError hook
  // already routes the error to the dev overlay, so this callback is only for
  // commit-side effects keyed by resetKey.
  onCatch?: (resetKey: number) => void
  // Children are declared optional so callers can pass them positionally to
  // createElement without tripping the eslint no-children-prop rule.
  children?: TextCompatNode
}

type DevRecoveryBoundaryState = {
  error: CapturedError | null
  previousResetKey: number
}

export class DevRecoveryBoundary extends TextCompatComponent<
  DevRecoveryBoundaryProps,
  DevRecoveryBoundaryState
> {
  constructor(props: DevRecoveryBoundaryProps) {
    super(props)
    this.state = { error: null, previousResetKey: props.resetKey }
  }

  static getDerivedStateFromProps(
    props: DevRecoveryBoundaryProps,
    state: DevRecoveryBoundaryState,
  ): DevRecoveryBoundaryState | null {
    if (props.resetKey === state.previousResetKey) {
      return null
    }
    return { error: null, previousResetKey: props.resetKey }
  }

  static getDerivedStateFromError(error: unknown): Partial<DevRecoveryBoundaryState> {
    // Re-throw routing sentinels so they still reach NotFoundBoundary /
    // RedirectBoundary / Forbidden / Unauthorized above.
    if (isNavigationSignalError(error)) {
      throw error
    }
    return { error: { thrownValue: error } }
  }

  componentDidCatch(): void {
    this.props.onCatch?.(this.props.resetKey)
  }

  render(): TextCompatNode {
    if (this.state.error) {
      // Render nothing — the dev overlay (mounted by the standalone DOM renderer)
      // shows the actual error to the developer. HMR pushing a new payload
      // bumps resetKey above, clearing this state and letting the children
      // re-render with the fixed code.
      return null
    }
    return this.props.children
  }
}
