import { describe, expect, it, vi } from 'vite-plus/test'
import { AppElementsWire, type AppWireElements } from '../src/server/app-elements.js'
import {
  ServerProtocolFragment,
  createServerProtocolElement,
} from '../src/server/element-protocol.js'
import { handleSsr } from '../src/server/app-ssr-entry.js'
import { Children, Slot } from '../src/shims/slot.js'
import { ErrorBoundary } from '../src/shims/error-boundary.js'
import { LayoutSegmentProvider } from '../src/shims/layout-segment-context.js'

vi.mock('../src/server/app-rsc-ssr-runtime.js', () => ({
  appClientReferencePreloader: {
    preload: vi.fn(async () => undefined),
  },
  installAppClientReferenceResolver: vi.fn(),
  loadAppBootstrapScriptContent: vi.fn(async () => undefined),
  loadAppRscRequestHandler: vi.fn(),
}))

function createStream(chunks: string[] = []): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
}

describe('App SSR entry', () => {
  it('renders inline App payload route/layout/template/page content into the HTML body', async () => {
    const routeId = AppElementsWire.encodeRouteId('/inline-ssr', null)
    const layoutId = AppElementsWire.encodeLayoutId('/')
    const templateId = AppElementsWire.encodeTemplateId('/')
    const pageId = AppElementsWire.encodePageId('/inline-ssr', null)

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

    const ssrPayload: AppWireElements = {
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
      [pageId]: createServerProtocolElement('main', { id: 'inline-page' }, 'inline body') as never,
    }

    const htmlStream = await handleSsr(
      createStream(),
      null,
      { links: [], preloads: [], styles: [] },
      { ssrPayload, waitForAllReady: true },
    )
    const html = await new Response(htmlStream).text()

    expect(html).toContain('<main id="inline-page">inline body</main>')
  })

  it('unwraps bridged Rue full-document layouts during HTML SSR', async () => {
    const routeId = AppElementsWire.encodeRouteId('/', null)
    const layoutId = AppElementsWire.encodeLayoutId('/')
    const pageId = AppElementsWire.encodePageId('/', null)

    const ssrPayload: AppWireElements = {
      [AppElementsWire.keys.interceptionContext]: null,
      [AppElementsWire.keys.layoutIds]: [layoutId],
      [AppElementsWire.keys.rootLayout]: '/',
      [AppElementsWire.keys.route]: routeId,
      [routeId]: createServerProtocolElement(
        ServerProtocolFragment,
        null,
        createServerProtocolElement('meta', { charSet: 'utf-8' }),
        createServerProtocolElement(Slot, { id: layoutId }),
      ) as never,
      [layoutId]: createServerProtocolElement('text-rue-html', {
        'data-text-rue-html': '',
        dangerouslySetInnerHTML: {
          __html:
            '<html lang="en"><head><style>body{color:red}</style></head><body>[object Object]</body></html>',
        },
        suppressHydrationWarning: true,
      }) as never,
      [pageId]: createServerProtocolElement('text-rue-html', {
        'data-text-rue-html': '',
        dangerouslySetInnerHTML: { __html: '<main id="page">page</main>' },
        suppressHydrationWarning: true,
      }) as never,
    }

    const htmlStream = await handleSsr(
      createStream(),
      null,
      { links: [], preloads: [], styles: [] },
      { ssrPayload, waitForAllReady: true },
    )
    const html = await new Response(htmlStream).text()

    expect(html).not.toContain('<text-rue-html')
    expect(html).toContain('<head><meta charSet="utf-8"/><style>body{color:red}</style>')
    expect(html).toContain('<body><main id="page">page</main>')
  })
})
