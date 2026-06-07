import { describe, expect, it } from 'vite-plus/test'
import {
  createSsrErrorMetaRenderer,
  renderSsrErrorMetaTags,
} from '../src/server/app-ssr-error-meta.js'

function digestError(digest: string): Error & { digest: string } {
  return Object.assign(new Error(digest), { digest })
}

describe('App SSR error meta tags', () => {
  it('renders noindex meta tags for streamed notFound and HTTP access fallback errors', () => {
    expect(renderSsrErrorMetaTags([digestError('TEXT_NOT_FOUND')])).toBe(
      '<meta name="robots" content="noindex" />',
    )

    expect(renderSsrErrorMetaTags([digestError('TEXT_HTTP_ERROR_FALLBACK;403')])).toBe(
      '<meta name="robots" content="noindex" />',
    )
  })

  it('renders development text-error metadata for streamed notFound errors', () => {
    expect(
      renderSsrErrorMetaTags([digestError('TEXT_NOT_FOUND')], { nodeEnv: 'development' }),
    ).toBe(
      '<meta name="robots" content="noindex" />' + '<meta name="text-error" content="not-found" />',
    )
  })

  it('renders refresh meta tags for streamed temporary and permanent redirects', () => {
    expect(renderSsrErrorMetaTags([digestError('TEXT_REDIRECT;replace;/target;307')])).toBe(
      '<meta id="__text-page-redirect" http-equiv="refresh" content="1;url=/target" />',
    )

    expect(renderSsrErrorMetaTags([digestError('TEXT_REDIRECT;replace;/target;308')])).toBe(
      '<meta id="__text-page-redirect" http-equiv="refresh" content="0;url=/target" />',
    )
  })

  it('prefixes app-internal redirect meta URLs with the configured basePath', () => {
    expect(
      renderSsrErrorMetaTags([digestError('TEXT_REDIRECT;replace;/target?ok=1#done;307')], {
        basePath: '/docs',
      }),
    ).toBe(
      '<meta id="__text-page-redirect" http-equiv="refresh" content="1;url=/docs/target?ok=1#done" />',
    )

    expect(
      renderSsrErrorMetaTags([digestError('TEXT_REDIRECT;replace;https%3A%2F%2Fexample.com;307')], {
        basePath: '/docs',
      }),
    ).toBe(
      '<meta id="__text-page-redirect" http-equiv="refresh" content="1;url=https://example.com" />',
    )

    expect(
      renderSsrErrorMetaTags([digestError('TEXT_REDIRECT;replace;/docs%3Ffrom%3Dcheckout;307')], {
        basePath: '/docs',
      }),
    ).toBe(
      '<meta id="__text-page-redirect" http-equiv="refresh" content="1;url=/docs?from=checkout" />',
    )

    expect(
      renderSsrErrorMetaTags([digestError('TEXT_REDIRECT;replace;/docs%23top;307')], {
        basePath: '/docs',
      }),
    ).toBe('<meta id="__text-page-redirect" http-equiv="refresh" content="1;url=/docs#top" />')
  })

  it('escapes redirect meta URLs before inserting them into HTML', () => {
    expect(
      renderSsrErrorMetaTags([
        digestError('TEXT_REDIRECT;replace;/target%3Ftext%3D%26%22%3Cscript%3E;307'),
      ]),
    ).toBe(
      '<meta id="__text-page-redirect" http-equiv="refresh" content="1;url=/target?text=&amp;&quot;&lt;script&gt;" />',
    )
  })

  it('flushes each captured SSR error meta tag once', () => {
    const renderer = createSsrErrorMetaRenderer({ nodeEnv: 'production' })

    renderer.capture(digestError('TEXT_NOT_FOUND'))
    expect(renderer.flush()).toBe('<meta name="robots" content="noindex" />')
    expect(renderer.flush()).toBe('')

    renderer.capture(digestError('TEXT_REDIRECT;replace;/target;307'))
    expect(renderer.flush()).toBe(
      '<meta id="__text-page-redirect" http-equiv="refresh" content="1;url=/target" />',
    )
    expect(renderer.flush()).toBe('')
  })
})
