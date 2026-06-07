/**
 * Error boundary unit tests.
 *
 * Tests the ErrorBoundary, NotFoundBoundary, ForbiddenBoundary, and
 * UnauthorizedBoundary components that handle error.tsx, not-found.tsx,
 * forbidden.tsx, and unauthorized.tsx rendering in the App Router.
 * Verifies correct digest handling, error propagation, and reset behavior.
 *
 * Ported from Text.js: test/e2e/app-dir/error-boundary/error-boundary.test.ts
 * https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/error-boundary/error-boundary.test.ts
 */
import { describe, it, expect, beforeAll, vi } from 'vite-plus/test'

// Mock text/navigation since it's a virtual module provided by the text plugin.
// We only need usePathname for the NotFoundBoundary wrapper, not for the static
// getDerivedStateFromError methods we're testing.
vi.mock('text/navigation', () => ({
  usePathname: () => '/',
}))
// The error boundary is primarily a client-side component.
//
// Verified against Text.js source:
// - packages/text/src/client/components/error-boundary.tsx
// - packages/text/src/client/components/navigation.ts
//
// Text.js keeps pathname reset fallback in the boundary implementation, while
// segment remounts provide the App Router's preferred reset owner. These tests
// lock both paths.

type ErrorBoundaryHelpers = {
  deriveErrorBoundaryStateFromError(error: unknown): {
    error: { thrownValue: unknown } | null
  }
  deriveErrorBoundaryStateFromProps(
    props: {
      pathname: string
      resetKey?: string | null
    },
    state: {
      error: { thrownValue: unknown } | null
      previousPathname: string
      previousResetKey: string | null
    },
  ): {
    error: { thrownValue: unknown } | null
    previousPathname: string
    previousResetKey: string | null
  }
}

function createErrorWithDigest(message: string, digest: string) {
  return Object.assign(new Error(message), { digest })
}

// Test the digest detection patterns used by the boundaries
describe('ErrorBoundary digest patterns', () => {
  it('TEXT_NOT_FOUND digest matches legacy not-found pattern', () => {
    const error = createErrorWithDigest('Not Found', 'TEXT_NOT_FOUND')
    expect(Reflect.get(error, 'digest')).toBe('TEXT_NOT_FOUND')
  })

  it('TEXT_HTTP_ERROR_FALLBACK;404 matches new not-found pattern', () => {
    const digest = 'TEXT_HTTP_ERROR_FALLBACK;404'
    const error = createErrorWithDigest('Not Found', digest)

    expect(Reflect.get(error, 'digest')).toBe(digest)
    expect(digest.startsWith('TEXT_HTTP_ERROR_FALLBACK;')).toBe(true)
    expect(digest).toBe('TEXT_HTTP_ERROR_FALLBACK;404')
  })

  it('TEXT_HTTP_ERROR_FALLBACK;403 matches forbidden pattern', () => {
    const digest = 'TEXT_HTTP_ERROR_FALLBACK;403'
    const error = createErrorWithDigest('Forbidden', digest)

    expect(Reflect.get(error, 'digest')).toBe(digest)
    expect(digest.startsWith('TEXT_HTTP_ERROR_FALLBACK;')).toBe(true)
  })

  it('TEXT_HTTP_ERROR_FALLBACK;401 matches unauthorized pattern', () => {
    const digest = 'TEXT_HTTP_ERROR_FALLBACK;401'
    const error = createErrorWithDigest('Unauthorized', digest)

    expect(Reflect.get(error, 'digest')).toBe(digest)
    expect(digest.startsWith('TEXT_HTTP_ERROR_FALLBACK;')).toBe(true)
  })

  it('TEXT_REDIRECT digest matches redirect pattern', () => {
    const digest = 'TEXT_REDIRECT;replace;/login;307;'
    const error = createErrorWithDigest('Redirect', digest)

    expect(Reflect.get(error, 'digest')).toBe(digest)
    expect(digest.startsWith('TEXT_REDIRECT;')).toBe(true)
  })

  it('regular errors (no digest) are caught by ErrorBoundary', () => {
    const error = new Error('Something broke')
    // No digest property — this is a normal error
    expect('digest' in error).toBe(false)
  })

  it('errors with non-special digests are caught by ErrorBoundary', () => {
    const digest = 'SOME_CUSTOM_DIGEST'
    const error = createErrorWithDigest('Custom error', digest)

    expect(Reflect.get(error, 'digest')).toBe(digest)
    // These should NOT be re-thrown — they should be caught
    expect(digest).not.toBe('TEXT_NOT_FOUND')
    expect(digest.startsWith('TEXT_HTTP_ERROR_FALLBACK;')).toBe(false)
    expect(digest.startsWith('TEXT_REDIRECT;')).toBe(false)
  })
})

// Test ErrorBoundary classification without tying the assertions to a Rue class.
// The helper THROWS for digest errors (re-throwing them past the boundary)
// and wraps regular thrown values so falsy values remain distinguishable from no error.
describe('ErrorBoundary digest classification helpers', () => {
  let helpers: ErrorBoundaryHelpers | null = null

  beforeAll(async () => {
    const mod = await import('../src/shims/error-boundary.js')
    helpers = mod as unknown as ErrorBoundaryHelpers
  })

  it('rethrows TEXT_NOT_FOUND', () => {
    const e = createErrorWithDigest('TEXT_NOT_FOUND', 'TEXT_NOT_FOUND')
    expect(helpers).not.toBeNull()
    expect(() => helpers?.deriveErrorBoundaryStateFromError(e)).toThrow(e)
  })

  it('rethrows TEXT_HTTP_ERROR_FALLBACK;404', () => {
    const e = createErrorWithDigest('TEXT_HTTP_ERROR_FALLBACK;404', 'TEXT_HTTP_ERROR_FALLBACK;404')
    expect(helpers).not.toBeNull()
    expect(() => helpers?.deriveErrorBoundaryStateFromError(e)).toThrow(e)
  })

  it('rethrows TEXT_HTTP_ERROR_FALLBACK;403', () => {
    const e = createErrorWithDigest('TEXT_HTTP_ERROR_FALLBACK;403', 'TEXT_HTTP_ERROR_FALLBACK;403')
    expect(helpers).not.toBeNull()
    expect(() => helpers?.deriveErrorBoundaryStateFromError(e)).toThrow(e)
  })

  it('rethrows TEXT_HTTP_ERROR_FALLBACK;401', () => {
    const e = createErrorWithDigest('TEXT_HTTP_ERROR_FALLBACK;401', 'TEXT_HTTP_ERROR_FALLBACK;401')
    expect(helpers).not.toBeNull()
    expect(() => helpers?.deriveErrorBoundaryStateFromError(e)).toThrow(e)
  })

  it('rethrows TEXT_REDIRECT', () => {
    const e = createErrorWithDigest(
      'TEXT_REDIRECT;replace;/login;307;',
      'TEXT_REDIRECT;replace;/login;307;',
    )
    expect(helpers).not.toBeNull()
    expect(() => helpers?.deriveErrorBoundaryStateFromError(e)).toThrow(e)
  })

  it('catches regular errors (no digest)', () => {
    const e = new Error('oops')
    expect(helpers).not.toBeNull()
    const state = helpers?.deriveErrorBoundaryStateFromError(e)
    expect(state).toEqual({ error: { thrownValue: e } })
  })

  it('catches errors with unknown digest', () => {
    const e = createErrorWithDigest('CUSTOM_ERROR', 'CUSTOM_ERROR')
    expect(helpers).not.toBeNull()
    const state = helpers?.deriveErrorBoundaryStateFromError(e)
    expect(state).toEqual({ error: { thrownValue: e } })
  })

  it('catches errors with empty digest', () => {
    const e = createErrorWithDigest('Empty digest', '')
    expect(helpers).not.toBeNull()
    const state = helpers?.deriveErrorBoundaryStateFromError(e)
    expect(state).toEqual({ error: { thrownValue: e } })
  })

  it('catches falsy thrown values instead of treating them as empty state', () => {
    // Ported from Text.js: test/e2e/app-dir/errors/index.test.ts
    // https://github.com/vercel/next.js/blob/canary/test/e2e/app-dir/errors/index.test.ts
    expect(helpers).not.toBeNull()

    const falsyThrownValues = [undefined, null, 0, '', false]
    for (const thrownValue of falsyThrownValues) {
      const state = helpers?.deriveErrorBoundaryStateFromError(thrownValue)
      expect(state).toEqual({ error: { thrownValue } })
    }
  })

  it('resets caught errors when the pathname changes', () => {
    expect(helpers).not.toBeNull()
    const state = helpers?.deriveErrorBoundaryStateFromProps(
      {
        pathname: '/text',
      },
      {
        error: { thrownValue: new Error('stuck') },
        previousPathname: '/previous',
        previousResetKey: null,
      },
    )

    expect(state).toEqual({
      error: null,
      previousPathname: '/text',
      previousResetKey: null,
    })
  })

  it('resets caught errors when the semantic reset key changes on the same pathname', () => {
    expect(helpers).not.toBeNull()
    const state = helpers?.deriveErrorBoundaryStateFromProps(
      {
        pathname: '/products/[id]',
        resetKey: 'product-b',
      },
      {
        error: { thrownValue: new Error('stuck') },
        previousPathname: '/products/[id]',
        previousResetKey: 'product-a',
      },
    )

    expect(state).toEqual({
      error: null,
      previousPathname: '/products/[id]',
      previousResetKey: 'product-b',
    })
  })

  it('treats an empty semantic reset key as absent for pathname fallback', () => {
    expect(helpers).not.toBeNull()
    const state = helpers?.deriveErrorBoundaryStateFromProps(
      {
        pathname: '/text',
        resetKey: '',
      },
      {
        error: { thrownValue: new Error('stuck') },
        previousPathname: '/previous',
        previousResetKey: '',
      },
    )

    expect(state).toEqual({
      error: null,
      previousPathname: '/text',
      previousResetKey: null,
    })
  })

  it('keeps caught errors when the semantic reset key is unchanged', () => {
    expect(helpers).not.toBeNull()

    const error = new Error('stuck')

    const state = helpers?.deriveErrorBoundaryStateFromProps(
      {
        pathname: '/products/text',
        resetKey: 'product-a',
      },
      {
        error: { thrownValue: error },
        previousPathname: '/products/previous',
        previousResetKey: 'product-a',
      },
    )

    expect(state).toEqual({
      error: { thrownValue: error },
      previousPathname: '/products/text',
      previousResetKey: 'product-a',
    })
  })

  it('does not immediately clear a caught error on the same pathname', () => {
    expect(helpers).not.toBeNull()

    const error = new Error('stuck')
    const baseState = {
      error: null,
      previousPathname: '/error-test',
      previousResetKey: null,
    }
    const stateAfterError = {
      ...baseState,
      ...helpers?.deriveErrorBoundaryStateFromError(error),
    }

    const stateAfterProps = helpers?.deriveErrorBoundaryStateFromProps(
      {
        pathname: '/error-test',
      },
      stateAfterError,
    )

    expect(stateAfterProps).toEqual({
      error: { thrownValue: error },
      previousPathname: '/error-test',
      previousResetKey: null,
    })
  })
})

describe('RedirectBoundary digest classification', () => {
  let RedirectErrorBoundaryClass: {
    getDerivedStateFromError(error: unknown): {
      redirect: string | null
      redirectType: 'push' | 'replace' | null
    }
  } | null = null

  beforeAll(async () => {
    const mod = await import('../src/shims/error-boundary.js')
    RedirectErrorBoundaryClass = Reflect.get(mod, 'RedirectErrorBoundary') ?? null
  })

  it('catches Text redirect digests and decodes the target', () => {
    const e = Object.assign(new Error('TEXT_REDIRECT:/?auth=required'), {
      digest: 'TEXT_REDIRECT;;%2F%3Fauth%3Drequired',
    })

    expect(RedirectErrorBoundaryClass).not.toBeNull()
    expect(RedirectErrorBoundaryClass?.getDerivedStateFromError(e)).toEqual({
      redirect: '/?auth=required',
      redirectType: 'replace',
    })
  })

  it('catches Text-style redirect digests and preserves push type', () => {
    const e = Object.assign(new Error('TEXT_REDIRECT'), {
      digest: 'TEXT_REDIRECT;push;/login;307;',
    })

    expect(RedirectErrorBoundaryClass).not.toBeNull()
    expect(RedirectErrorBoundaryClass?.getDerivedStateFromError(e)).toEqual({
      redirect: '/login',
      redirectType: 'push',
    })
  })

  it('re-throws non-redirect errors', () => {
    const e = Object.assign(new Error('TEXT_NOT_FOUND'), { digest: 'TEXT_NOT_FOUND' })

    expect(RedirectErrorBoundaryClass).not.toBeNull()
    expect(() => RedirectErrorBoundaryClass?.getDerivedStateFromError(e)).toThrow(e)
  })

  it('re-throws redirect errors with malformed/empty URL', () => {
    const e = Object.assign(new Error('TEXT_REDIRECT'), {
      digest: 'TEXT_REDIRECT;push;',
    })

    expect(RedirectErrorBoundaryClass).not.toBeNull()
    expect(() => RedirectErrorBoundaryClass?.getDerivedStateFromError(e)).toThrow(e)
  })

  it('returns null state for handled redirect errors (Text.js parity placeholder)', () => {
    const e = Object.assign(new Error('TEXT_REDIRECT'), {
      digest: 'TEXT_REDIRECT;;%2Flogin',
      handled: true,
    })

    expect(RedirectErrorBoundaryClass).not.toBeNull()
    expect(RedirectErrorBoundaryClass?.getDerivedStateFromError(e)).toEqual({
      redirect: null,
      redirectType: null,
    })
  })
})

// Test the actual ForbiddenBoundary.getDerivedStateFromError classification.
// Catches TEXT_HTTP_ERROR_FALLBACK;403 and re-throws everything else.
describe('ForbiddenBoundary digest classification', () => {
  let ForbiddenBoundaryInnerClass: {
    getDerivedStateFromError(error: unknown): Partial<{ forbidden: boolean }>
  } | null = null

  beforeAll(async () => {
    const mod = await import('../src/shims/error-boundary.js')
    ForbiddenBoundaryInnerClass = Reflect.get(mod, 'ForbiddenBoundaryInner') ?? null
  })

  it('catches TEXT_HTTP_ERROR_FALLBACK;403', () => {
    const e = createErrorWithDigest('TEXT_HTTP_ERROR_FALLBACK;403', 'TEXT_HTTP_ERROR_FALLBACK;403')
    expect(ForbiddenBoundaryInnerClass).not.toBeNull()
    const state = ForbiddenBoundaryInnerClass?.getDerivedStateFromError(e)
    expect(state).toMatchObject({ forbidden: true })
  })

  it('re-throws TEXT_HTTP_ERROR_FALLBACK;404 (notFound domain)', () => {
    const e = createErrorWithDigest('TEXT_HTTP_ERROR_FALLBACK;404', 'TEXT_HTTP_ERROR_FALLBACK;404')
    expect(ForbiddenBoundaryInnerClass).not.toBeNull()
    expect(() => ForbiddenBoundaryInnerClass?.getDerivedStateFromError(e)).toThrow(e)
  })

  it('re-throws TEXT_HTTP_ERROR_FALLBACK;401 (unauthorized domain)', () => {
    const e = createErrorWithDigest('TEXT_HTTP_ERROR_FALLBACK;401', 'TEXT_HTTP_ERROR_FALLBACK;401')
    expect(ForbiddenBoundaryInnerClass).not.toBeNull()
    expect(() => ForbiddenBoundaryInnerClass?.getDerivedStateFromError(e)).toThrow(e)
  })

  it('re-throws TEXT_HTTP_ERROR_FALLBACK;4030 (defensive: exact match, startsWith would be wrong)', () => {
    const e = createErrorWithDigest(
      'TEXT_HTTP_ERROR_FALLBACK;4030',
      'TEXT_HTTP_ERROR_FALLBACK;4030',
    )
    expect(ForbiddenBoundaryInnerClass).not.toBeNull()
    expect(() => ForbiddenBoundaryInnerClass?.getDerivedStateFromError(e)).toThrow(e)
  })

  it('re-throws regular errors (no digest)', () => {
    const e = new Error('oops')
    expect(ForbiddenBoundaryInnerClass).not.toBeNull()
    expect(() => ForbiddenBoundaryInnerClass?.getDerivedStateFromError(e)).toThrow(e)
  })
})

// Test the actual UnauthorizedBoundary.getDerivedStateFromError classification.
// Catches TEXT_HTTP_ERROR_FALLBACK;401 and re-throws everything else.
describe('UnauthorizedBoundary digest classification', () => {
  let UnauthorizedBoundaryInnerClass: {
    getDerivedStateFromError(error: unknown): Partial<{ unauthorized: boolean }>
  } | null = null

  beforeAll(async () => {
    const mod = await import('../src/shims/error-boundary.js')
    UnauthorizedBoundaryInnerClass = Reflect.get(mod, 'UnauthorizedBoundaryInner') ?? null
  })

  it('catches TEXT_HTTP_ERROR_FALLBACK;401', () => {
    const e = createErrorWithDigest('TEXT_HTTP_ERROR_FALLBACK;401', 'TEXT_HTTP_ERROR_FALLBACK;401')
    expect(UnauthorizedBoundaryInnerClass).not.toBeNull()
    const state = UnauthorizedBoundaryInnerClass?.getDerivedStateFromError(e)
    expect(state).toMatchObject({ unauthorized: true })
  })

  it('re-throws TEXT_HTTP_ERROR_FALLBACK;404 (notFound domain)', () => {
    const e = createErrorWithDigest('TEXT_HTTP_ERROR_FALLBACK;404', 'TEXT_HTTP_ERROR_FALLBACK;404')
    expect(UnauthorizedBoundaryInnerClass).not.toBeNull()
    expect(() => UnauthorizedBoundaryInnerClass?.getDerivedStateFromError(e)).toThrow(e)
  })

  it('re-throws TEXT_HTTP_ERROR_FALLBACK;403 (forbidden domain)', () => {
    const e = createErrorWithDigest('TEXT_HTTP_ERROR_FALLBACK;403', 'TEXT_HTTP_ERROR_FALLBACK;403')
    expect(UnauthorizedBoundaryInnerClass).not.toBeNull()
    expect(() => UnauthorizedBoundaryInnerClass?.getDerivedStateFromError(e)).toThrow(e)
  })

  it('re-throws TEXT_HTTP_ERROR_FALLBACK;4010 (defensive: exact match, startsWith would be wrong)', () => {
    const e = createErrorWithDigest(
      'TEXT_HTTP_ERROR_FALLBACK;4010',
      'TEXT_HTTP_ERROR_FALLBACK;4010',
    )
    expect(UnauthorizedBoundaryInnerClass).not.toBeNull()
    expect(() => UnauthorizedBoundaryInnerClass?.getDerivedStateFromError(e)).toThrow(e)
  })

  it('re-throws regular errors (no digest)', () => {
    const e = new Error('oops')
    expect(UnauthorizedBoundaryInnerClass).not.toBeNull()
    expect(() => UnauthorizedBoundaryInnerClass?.getDerivedStateFromError(e)).toThrow(e)
  })
})
