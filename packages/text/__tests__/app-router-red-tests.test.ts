import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractTextSnippet } from './helpers.js'

const APP_ROUTER_TEST_FILE = path.resolve(import.meta.dirname, 'app-router.test.ts')

const HISTORICAL_APP_ROUTER_RED_TEST_FILTER =
  'renders pages with params named then, catch, finally, and status|renders pages-router page when both app/ and pages|context provider/consumer|Rue client hook|redirect\\(\\) inside Suspense boundary|notFound\\(\\) inside Suspense boundary|async server throw in Suspense|error boundary wrapper|App->Pages fallback rendering in production|fallback rewrites targeting Pages routes|credential headers before pages getServerSideProps'

type AppRouterRegressionTest = {
  title: string
  lastObservedFailure: string
}

const CURRENT_APP_ROUTER_RED_TESTS: AppRouterRegressionTest[] = []

const HISTORICAL_APP_ROUTER_RED_TESTS: AppRouterRegressionTest[] = [
  {
    title: 'renders pages with params named then, catch, finally, and status',
    lastObservedFailure: 'expected is-thenable "no" to be "yes"',
  },
  {
    title: 'renders pages-router page when both app/ and pages/ directories exist',
    lastObservedFailure: 'expected mixed App/Pages fallback status 200, received 500',
  },
  {
    title: "renders context provider/consumer from package with internal 'use client' submodule",
    lastObservedFailure:
      'expected HTML to contain Context Dedup Test and dark-test-theme without NOT_FOUND',
  },
  {
    title: "errors when Rue client hook is used in a Server Component without 'use client' (#834)",
    lastObservedFailure: 'expected html to contain useState()',
  },
  {
    title: 'redirect() inside Suspense boundary preserves digest in RSC payload',
    lastObservedFailure: 'expected RSC payload to preserve TEXT_REDIRECT digest',
  },
  {
    title: 'notFound() inside Suspense boundary preserves digest for not-found UI',
    lastObservedFailure: 'expected RSC payload to preserve TEXT_HTTP_ERROR_FALLBACK;404 marker',
  },
  {
    title: 'async server throw in Suspense avoids compat dev decode crash',
    lastObservedFailure: 'expected Suspense fallback without compat dev decode crash',
  },
  {
    title: 'renders error boundary wrapper for routes with error.tsx',
    lastObservedFailure:
      'expected html to contain Error Test Page; previous body rendered Test error from client component',
  },
  {
    title:
      'applies middleware request header overrides before App->Pages fallback rendering in production',
    lastObservedFailure: 'expected production App->Pages fallback status 200, received 500',
  },
  {
    title: 'fallback rewrites targeting Pages routes still work in mixed app/pages projects',
    lastObservedFailure: 'expected fallback rewrite to Pages route status 200, received 500',
  },
  {
    title:
      'middleware request header overrides can delete credential headers before pages getServerSideProps in mixed projects',
    lastObservedFailure: 'expected middleware App->Pages fallback status 200, received 500',
  },
]

function extractVitestItTitles(source: string): string[] {
  return [...source.matchAll(/\bit\((['"`])((?:\\.|(?!\1).)*)\1,/g)].map(match =>
    match[2].replace(/\\(['"`])/g, '$1'),
  )
}

describe('App Router red test tracking', () => {
  it('documents that no App Router failures are currently tracked in this worktree', () => {
    expect(CURRENT_APP_ROUTER_RED_TESTS).toEqual([])
  })

  it('keeps the historical regression filter aligned with resolved App Router red points', () => {
    const source = fs.readFileSync(APP_ROUTER_TEST_FILE, 'utf8')
    const titles = extractVitestItTitles(source)
    const filter = new RegExp(HISTORICAL_APP_ROUTER_RED_TEST_FILTER)
    const matchedTitles = titles.filter(title => filter.test(title))

    expect(matchedTitles).toEqual(HISTORICAL_APP_ROUTER_RED_TESTS.map(test => test.title))
  })

  it('records every historical App Router red point with its last observed assertion diff', () => {
    expect(HISTORICAL_APP_ROUTER_RED_TESTS).toHaveLength(11)

    for (const trackedTest of HISTORICAL_APP_ROUTER_RED_TESTS) {
      expect(trackedTest.lastObservedFailure, trackedTest.title).not.toHaveLength(0)
    }
  })

  it('provides a focused snippet helper for large HTML and RSC payload debugging', () => {
    const payload = `${'a'.repeat(12)}TEXT_REDIRECT;replace;/about;307${'b'.repeat(12)}`

    expect(extractTextSnippet(payload, 'TEXT_REDIRECT', { radius: 4 })).toBe(
      '...aaaaTEXT_REDIRECT;rep...',
    )
    expect(extractTextSnippet(payload, 'TEXT_HTTP_ERROR_FALLBACK')).toBe(
      '<missing "TEXT_HTTP_ERROR_FALLBACK">',
    )
  })
})
