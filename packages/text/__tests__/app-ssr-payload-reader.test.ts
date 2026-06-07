import { describe, expect, it } from 'vite-plus/test'
import { AppElementsWire, type AppWireElements } from '../src/server/app-elements.js'
import { setAppClientReferenceResolver } from '../src/server/app-client-reference-resolver.js'
import { AppRscServerClientReferenceSymbol } from '../src/server/app-rsc-client-reference-protocol.js'
import {
  createAppSsrPayloadReader,
  createAppSsrWirePayloadDecoder,
  renderAppSsrWirePayloadToReadableStream,
} from '../src/server/app-ssr-payload-reader.js'
import { APP_SSR_INLINE_PAYLOAD_STREAM_CANCEL_REASON } from '../src/server/app-ssr-inline-payload-protocol.js'
import {
  ServerProtocolFragment,
  createServerProtocolElement,
} from '../src/server/element-protocol.js'
import {
  createAppRenderDependency,
  renderAfterAppDependencies,
} from '../src/server/app-render-dependency.js'
import {
  renderAppSsrToReadableStream,
  renderAppSsrToStaticMarkup,
} from '../src/server/app-ssr-renderer.js'
import type { TextCompatNode } from '../src/shims/text-compat-types.js'
import { Children, ElementsContext, Slot } from '../src/shims/slot.js'
import { ErrorBoundary } from '../src/shims/error-boundary.js'
import { LayoutSegmentProvider } from '../src/shims/layout-segment-context.js'

describe('App SSR payload reader', () => {
  it('can read an in-process App payload without decoding the SSR payload stream', async () => {
    let cancelCalls = 0
    let cancelReason: unknown
    const stream = new ReadableStream<Uint8Array>({
      cancel(reason) {
        cancelCalls += 1
        cancelReason = reason
      },
    })
    const payload: AppWireElements = {
      [AppElementsWire.keys.interceptionContext]: null,
      [AppElementsWire.keys.rootLayout]: '/',
      [AppElementsWire.keys.route]: AppElementsWire.encodeRouteId('/', null),
      [AppElementsWire.encodePageId('/', null)]: 'home',
    }
    let readCalls = 0

    const readPayload = createAppSsrPayloadReader(stream, {
      inlinePayload: payload,
      readThenable(thenable) {
        expect(typeof thenable.then).toBe('function')
        readCalls += 1
        return payload
      },
    })

    expect(readPayload()[AppElementsWire.encodePageId('/', null)]).toBe('home')
    expect(readPayload()[AppElementsWire.encodePageId('/', null)]).toBe('home')
    await Promise.resolve()

    expect(readCalls).toBe(0)
    expect(cancelCalls).toBe(1)
    expect(cancelReason).toBe(APP_SSR_INLINE_PAYLOAD_STREAM_CANCEL_REASON)
  })

  it('keeps synchronous SSR entry adaptation synchronous before returning App elements', () => {
    const stream = new ReadableStream<Uint8Array>()
    const pageId = AppElementsWire.encodePageId('/client-ref', null)
    const clientReference = {
      $$typeof: AppRscServerClientReferenceSymbol,
      $$id: 'slot-shim#Children',
    }
    function ResolvedClientReference() {
      return null
    }
    const payload: AppWireElements = {
      [AppElementsWire.keys.interceptionContext]: null,
      [AppElementsWire.keys.rootLayout]: '/',
      [AppElementsWire.keys.route]: AppElementsWire.encodeRouteId('/client-ref', null),
      [pageId]: createServerProtocolElement(clientReference, null) as never,
    }
    const resolvedElements = {
      ...payload,
      [pageId]: createServerProtocolElement(ResolvedClientReference, null),
    }
    let readThenableCalls = 0

    setAppClientReferenceResolver((referenceKey, exportName) => {
      expect(referenceKey).toBe('slot-shim')
      expect(exportName).toBe('Children')
      return ResolvedClientReference
    })

    try {
      const readPayload = createAppSsrPayloadReader(stream, {
        inlinePayload: payload,
        readThenable(thenable) {
          expect(typeof thenable.then).toBe('function')
          readThenableCalls += 1
          return resolvedElements as never
        },
      })

      const elements = readPayload()
      const elementType = (elements[pageId] as { type?: { displayName?: string } }).type
      expect(typeof elementType).toBe('function')
      expect(readThenableCalls).toBe(0)
    } finally {
      setAppClientReferenceResolver(null)
    }
  })

  it('rethrows synchronous primed page errors during SSR render instead of payload read', () => {
    const stream = new ReadableStream<Uint8Array>()
    const pageId = AppElementsWire.encodePageId('/throw', null)
    function ThrowingPage() {
      throw new Error('page failed')
    }
    const payload: AppWireElements = {
      [AppElementsWire.keys.interceptionContext]: null,
      [AppElementsWire.keys.rootLayout]: '/',
      [AppElementsWire.keys.route]: pageId,
      [pageId]: createServerProtocolElement(ThrowingPage, null) as never,
    }
    const readPayload = createAppSsrPayloadReader(stream, {
      inlinePayload: payload,
      primePageForHtmlSsr: true,
      readThenable() {
        throw new Error('sync page errors should not become thenables')
      },
    })

    const elements = readPayload()
    expect(() =>
      renderAppSsrToStaticMarkup(
        createServerProtocolElement(
          ElementsContext.Provider,
          { value: elements },
          createServerProtocolElement(Slot, { id: pageId }),
        ),
      ),
    ).toThrow('page failed')
  })

  it('reuses primed async page output during HTML SSR render', async () => {
    const stream = new ReadableStream<Uint8Array>()
    const pageId = AppElementsWire.encodePageId('/async-prime', null)
    let pageCalls = 0
    let resolvePage: ((value: TextCompatNode) => void) | null = null
    function AsyncPage() {
      pageCalls += 1
      return new Promise<TextCompatNode>(resolve => {
        resolvePage = resolve
      })
    }
    const payload: AppWireElements = {
      [AppElementsWire.keys.interceptionContext]: null,
      [AppElementsWire.keys.rootLayout]: '/',
      [AppElementsWire.keys.route]: pageId,
      [pageId]: createServerProtocolElement(AsyncPage, null) as never,
    }
    const readPayload = createAppSsrPayloadReader(stream, {
      inlinePayload: payload,
      primePageForHtmlSsr: true,
    })

    const elements = readPayload()
    expect(pageCalls).toBe(1)
    expect(resolvePage).not.toBeNull()
    resolvePage?.(createServerProtocolElement('main', null, 'async page'))

    const ssrStream = await renderAppSsrToReadableStream(
      createServerProtocolElement(
        ElementsContext.Provider,
        { value: elements },
        createServerProtocolElement(Slot, { id: pageId }),
      ),
      {},
    )
    expect(await new Response(ssrStream).text()).toContain('<main>async page</main>')
    expect(pageCalls).toBe(1)
  })

  it('only primes the active page entry for HTML SSR', () => {
    const stream = new ReadableStream<Uint8Array>()
    const routeId = AppElementsWire.encodeRouteId('/', null)
    const activePageId = AppElementsWire.encodePageId('/', null)
    const inactivePageId = AppElementsWire.encodePageId('/inactive', null)
    let inactiveCalls = 0
    function HomePage() {
      return createServerProtocolElement('h1', null, 'home')
    }
    function InactivePage() {
      inactiveCalls += 1
      throw new Error('inactive page should not be primed')
    }
    const payload: AppWireElements = {
      [AppElementsWire.keys.interceptionContext]: null,
      [AppElementsWire.keys.rootLayout]: '/',
      [AppElementsWire.keys.route]: routeId,
      [activePageId]: createServerProtocolElement(HomePage, null) as never,
      [inactivePageId]: createServerProtocolElement(InactivePage, null) as never,
    }
    const readPayload = createAppSsrPayloadReader(stream, {
      inlinePayload: payload,
      primePageForHtmlSsr: true,
      readThenable() {
        throw new Error('inactive page priming should stay synchronous')
      },
    })

    const elements = readPayload()
    const html = renderAppSsrToStaticMarkup(
      createServerProtocolElement(
        ElementsContext.Provider,
        { value: elements },
        createServerProtocolElement(Slot, { id: activePageId }),
      ),
    )

    expect(html).toContain('<h1>home</h1>')
    expect(inactiveCalls).toBe(0)
  })

  it('renders Slot content through the App SSR compat context runtime', () => {
    const routeId = AppElementsWire.encodeRouteId('/slot', null)
    const elements = AppElementsWire.decode({
      [AppElementsWire.keys.interceptionContext]: null,
      [AppElementsWire.keys.rootLayout]: '/',
      [AppElementsWire.keys.route]: routeId,
      [routeId]: createServerProtocolElement('main', null, 'slot body') as never,
    })

    const html = renderAppSsrToStaticMarkup(
      createServerProtocolElement(
        ElementsContext.Provider,
        { value: elements },
        createServerProtocolElement(Slot, { id: routeId }),
      ),
    )

    expect(html).toContain('<main>slot body</main>')
  })

  it('recursively resolves nested client-reference wrapper elements for SSR', () => {
    const stream = new ReadableStream<Uint8Array>()
    const routeId = AppElementsWire.encodeRouteId('/client-ref-children', null)
    const childrenReference = {
      $$typeof: AppRscServerClientReferenceSymbol,
      $$id: 'slot-shim#Children',
    }
    const payload: AppWireElements = {
      [AppElementsWire.keys.interceptionContext]: null,
      [AppElementsWire.keys.rootLayout]: '/',
      [AppElementsWire.keys.route]: routeId,
      [routeId]: createServerProtocolElement(
        'section',
        null,
        createServerProtocolElement(
          'article',
          null,
          createServerProtocolElement(childrenReference, null),
        ),
      ) as never,
    }

    setAppClientReferenceResolver((referenceKey, exportName) => {
      expect(referenceKey).toBe('slot-shim')
      expect(exportName).toBe('Children')
      return function ResolvedChildren() {
        return createServerProtocolElement('p', null, 'resolved children')
      }
    })

    try {
      const readPayload = createAppSsrPayloadReader(stream, {
        inlinePayload: payload,
        readThenable(_thenable) {
          throw new Error('nested client reference adaptation should stay synchronous')
        },
      })

      const elements = readPayload()
      const html = renderAppSsrToStaticMarkup(
        createServerProtocolElement(
          ElementsContext.Provider,
          { value: elements },
          createServerProtocolElement(Slot, { id: routeId }),
        ),
      )
      expect(html).toContain('<p>resolved children</p>')
    } finally {
      setAppClientReferenceResolver(null)
    }
  })

  it('does not suspend HTML SSR on async client references with server-renderable children', () => {
    const stream = new ReadableStream<Uint8Array>()
    const routeId = AppElementsWire.encodeRouteId('/async-client-ref', null)
    const clientReference = {
      $$typeof: AppRscServerClientReferenceSymbol,
      $$id: 'client-widget#default',
    }
    const payload: AppWireElements = {
      [AppElementsWire.keys.interceptionContext]: null,
      [AppElementsWire.keys.rootLayout]: '/',
      [AppElementsWire.keys.route]: routeId,
      [routeId]: createServerProtocolElement(
        'main',
        null,
        createServerProtocolElement(
          clientReference,
          null,
          createServerProtocolElement('p', null, 'server child'),
        ),
      ) as never,
    }

    setAppClientReferenceResolver((referenceKey, exportName) => {
      expect(referenceKey).toBe('client-widget')
      expect(exportName).toBe('default')
      return Promise.resolve(function ClientWidget() {
        return createServerProtocolElement('p', null, 'client widget')
      })
    })

    try {
      const readPayload = createAppSsrPayloadReader(stream, {
        inlinePayload: payload,
        readThenable() {
          throw new Error('async client references should not block HTML SSR adaptation')
        },
      })
      const elements = readPayload()
      const html = renderAppSsrToStaticMarkup(
        createServerProtocolElement(
          ElementsContext.Provider,
          { value: elements },
          createServerProtocolElement(Slot, { id: routeId }),
        ),
      )
      expect(html).toContain('<p>server child</p>')
      expect(html).not.toContain('client widget')
    } finally {
      setAppClientReferenceResolver(null)
    }
  })

  it('resolves async page client references before priming HTML SSR', async () => {
    const stream = new ReadableStream<Uint8Array>()
    const pageId = AppElementsWire.encodePageId('/async-page-client-ref', null)
    const clientReference = {
      $$typeof: AppRscServerClientReferenceSymbol,
      $$id: 'client-page#default',
    }
    const payload: AppWireElements = {
      [AppElementsWire.keys.interceptionContext]: null,
      [AppElementsWire.keys.rootLayout]: '/',
      [AppElementsWire.keys.route]: pageId,
      [pageId]: createServerProtocolElement(clientReference, null) as never,
    }

    setAppClientReferenceResolver((referenceKey, exportName) => {
      expect(referenceKey).toBe('client-page')
      expect(exportName).toBe('default')
      return Promise.resolve(function ClientPage() {
        throw new Error('client page failed')
      })
    })

    try {
      const readPayload = createAppSsrPayloadReader(stream, {
        inlinePayload: payload,
        primePageForHtmlSsr: true,
      })
      function SsrRoot() {
        const elements = readPayload()
        return createServerProtocolElement(
          ElementsContext.Provider,
          { value: elements },
          createServerProtocolElement(Slot, { id: pageId }),
        )
      }
      await expect(
        renderAppSsrToReadableStream(createServerProtocolElement(SsrRoot, null), {
          onError() {},
        }),
      ).rejects.toThrow('client page failed')
    } finally {
      setAppClientReferenceResolver(null)
    }
  })

  it('renders a composed route/layout/template/page Slot chain for SSR', async () => {
    const routeId = AppElementsWire.encodeRouteId('/composed', null)
    const layoutId = AppElementsWire.encodeLayoutId('/')
    const templateId = AppElementsWire.encodeTemplateId('/')
    const pageId = AppElementsWire.encodePageId('/composed', null)

    function RootLayout({ children }: { children?: unknown }) {
      return createServerProtocolElement(
        'html',
        null,
        createServerProtocolElement('body', null, children as never),
      )
    }
    function RootTemplate({ children }: { children?: unknown }) {
      return createServerProtocolElement('section', null, children as never)
    }

    const elements = AppElementsWire.decode({
      [AppElementsWire.keys.interceptionContext]: null,
      [AppElementsWire.keys.layoutIds]: [layoutId],
      [AppElementsWire.keys.rootLayout]: '/',
      [AppElementsWire.keys.route]: routeId,
      [routeId]: createServerProtocolElement(
        ServerProtocolFragment,
        null,
        createServerProtocolElement(
          ErrorBoundary,
          { fallback: () => createServerProtocolElement('p', null, 'error') },
          createServerProtocolElement(
            LayoutSegmentProvider,
            { segmentMap: { children: [] } },
            createServerProtocolElement(
              Slot,
              { id: layoutId },
              createServerProtocolElement(
                Slot,
                { id: templateId },
                createServerProtocolElement(Slot, { id: pageId }),
              ),
            ),
          ),
        ),
      ) as never,
      [layoutId]: createServerProtocolElement(
        RootLayout,
        null,
        createServerProtocolElement(Children, null),
      ) as never,
      [templateId]: createServerProtocolElement(
        RootTemplate,
        null,
        createServerProtocolElement(Children, null),
      ) as never,
      [pageId]: createServerProtocolElement('main', null, 'composed page') as never,
    })

    const html = renderAppSsrToStaticMarkup(
      createServerProtocolElement(
        ElementsContext.Provider,
        { value: elements },
        createServerProtocolElement(Slot, { id: routeId }),
      ),
    )

    expect(html).toContain('<main>composed page</main>')

    const stream = await renderAppSsrToReadableStream(
      createServerProtocolElement(
        ElementsContext.Provider,
        { value: elements },
        createServerProtocolElement(Slot, { id: routeId }),
      ),
      {},
    )
    expect(await new Response(stream).text()).toContain('<main>composed page</main>')
  })

  it('unwraps RSC render dependency barriers during HTML SSR payload adaptation', () => {
    const stream = new ReadableStream<Uint8Array>()
    const routeId = AppElementsWire.encodeRouteId('/dependency-barrier', null)
    const dependency = createAppRenderDependency()
    const payload: AppWireElements = {
      [AppElementsWire.keys.interceptionContext]: null,
      [AppElementsWire.keys.rootLayout]: '/',
      [AppElementsWire.keys.route]: routeId,
      [routeId]: renderAfterAppDependencies(
        createServerProtocolElement('main', null, 'barrier body'),
        [dependency],
      ) as never,
    }

    const readPayload = createAppSsrPayloadReader(stream, {
      inlinePayload: payload,
      readThenable() {
        throw new Error('HTML SSR adaptation should not wait for RSC dependency barriers')
      },
    })
    const elements = readPayload()
    const html = renderAppSsrToStaticMarkup(
      createServerProtocolElement(
        ElementsContext.Provider,
        { value: elements },
        createServerProtocolElement(Slot, { id: routeId }),
      ),
    )

    expect(html).toContain('<main>barrier body</main>')
  })

  it('uses an explicit decoder for cross-runtime compatibility streams', () => {
    const stream = new ReadableStream<Uint8Array>()
    const payload: AppWireElements = {
      [AppElementsWire.keys.interceptionContext]: null,
      [AppElementsWire.keys.rootLayout]: '/',
      [AppElementsWire.keys.route]: AppElementsWire.encodeRouteId('/compat', null),
      [AppElementsWire.encodePageId('/compat', null)]: 'compat page',
    }
    let decodeCalls = 0

    const readPayload = createAppSsrPayloadReader(stream, {
      decodePayload(input) {
        expect(input).toBe(stream)
        decodeCalls += 1
        return Promise.resolve(payload)
      },
      readThenable(thenable) {
        expect(typeof thenable.then).toBe('function')
        return payload
      },
    })

    expect(readPayload()[AppElementsWire.encodePageId('/compat', null)]).toBe('compat page')
    expect(decodeCalls).toBe(1)
  })

  it('prefers in-process App payloads over explicit compatibility decoders', async () => {
    let cancelCalls = 0
    const inlinePayload: AppWireElements = {
      [AppElementsWire.keys.interceptionContext]: null,
      [AppElementsWire.keys.rootLayout]: '/',
      [AppElementsWire.keys.route]: AppElementsWire.encodeRouteId('/inline', null),
      [AppElementsWire.encodePageId('/inline', null)]: 'inline page',
    }
    const decoderPayload: AppWireElements = {
      [AppElementsWire.keys.interceptionContext]: null,
      [AppElementsWire.keys.rootLayout]: '/',
      [AppElementsWire.keys.route]: AppElementsWire.encodeRouteId('/decoder', null),
      [AppElementsWire.encodePageId('/decoder', null)]: 'decoder page',
    }
    const stream = new ReadableStream<Uint8Array>({
      cancel() {
        cancelCalls += 1
      },
    })
    let decodeCalls = 0

    const readPayload = createAppSsrPayloadReader(stream, {
      decodePayload() {
        decodeCalls += 1
        return Promise.resolve(decoderPayload)
      },
      inlinePayload,
      readThenable() {
        return inlinePayload
      },
    })

    expect(readPayload()[AppElementsWire.encodePageId('/inline', null)]).toBe('inline page')
    await Promise.resolve()
    expect(decodeCalls).toBe(0)
    expect(cancelCalls).toBe(1)
  })

  it('can decode a Rue-native App wire payload through the neutral reader facade', () => {
    const payload: AppWireElements = {
      [AppElementsWire.keys.interceptionContext]: null,
      [AppElementsWire.keys.rootLayout]: '/',
      [AppElementsWire.keys.route]: AppElementsWire.encodeRouteId('/wire', null),
      [AppElementsWire.encodePageId('/wire', null)]: 'wire page',
    }
    const decodeWirePayload = createAppSsrWirePayloadDecoder()
    let decodeCalls = 0
    const readPayload = createAppSsrPayloadReader(
      renderAppSsrWirePayloadToReadableStream(payload),
      {
        decodePayload(stream) {
          decodeCalls += 1
          return decodeWirePayload(stream)
        },
        readThenable(thenable) {
          expect(typeof thenable.then).toBe('function')
          return payload
        },
      },
    )

    expect(readPayload()[AppElementsWire.encodePageId('/wire', null)]).toBe('wire page')
    expect(decodeCalls).toBe(1)
  })

  it('does not implicitly fall back to the plugin-rsc SSR decoder', () => {
    const readPayload = createAppSsrPayloadReader(new ReadableStream<Uint8Array>(), {
      readThenable(thenable) {
        return thenable as never
      },
    })

    expect(readPayload).toThrow(
      'Pass inlinePayload from the App render pipeline, or provide an explicit decodePayload',
    )
  })
})
