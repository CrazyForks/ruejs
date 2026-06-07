import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { Suspense, h } from '@rue-js/rue'
import {
  AppServerSuspense,
  adaptAppServerRenderableForHtmlSsr,
  adaptAppServerRenderableForSsr,
  createAppServerElement,
} from '../src/server/app-server-tree.js'
import { setAppClientReferenceResolver } from '../src/server/app-client-reference-resolver.js'
import {
  AppRscServerClientReferenceSymbol,
  CompatRueRscServerClientReferenceSymbol,
  createAppRscClientReferenceProtocol,
  isAppRscServerClientReference,
} from '../src/server/app-rsc-client-reference-protocol.js'
import { markAppSsrPassthroughComponent } from '../src/server/app-ssr-passthrough-protocol.js'
import { ServerProtocolElementSymbol } from '../src/server/element-protocol.js'

vi.mock('@rue-js/server-renderer', () => ({
  renderToString: vi.fn(async () => '<main>rue html</main>'),
}))

describe('createAppServerElement', () => {
  afterEach(() => {
    setAppClientReferenceResolver(null)
    delete (globalThis as Record<string, unknown>).__TEXT_RUE_RENDER_TO_STRING__
  })

  it('maps Rue Suspense to the App Server Suspense protocol without executing DOM runtime code', () => {
    const element = createAppServerElement(
      Suspense,
      { fallback: createAppServerElement('p', null, 'loading') },
      createAppServerElement('span', null, 'child'),
    ) as { type: unknown }

    expect(element.type).toBe(AppServerSuspense)
  })

  it('normalizes Rue Suspense before HTML SSR adaptation can execute the DOM runtime component', async () => {
    const element = {
      $$typeof: ServerProtocolElementSymbol,
      type: Suspense,
      key: null,
      props: {
        fallback: createAppServerElement('p', null, 'loading'),
        children: createAppServerElement('span', null, 'child'),
      },
      _owner: null,
      _store: {},
      ref: null,
    }

    const adapted = (await adaptAppServerRenderableForHtmlSsr(element as never)) as {
      type: unknown
    }

    expect(adapted.type).toBe(AppServerSuspense)
  })

  it('adapts portable Rue Vapor component results before the SSR renderer consumes them as children', async () => {
    const portableVapor = {
      __rue_vapor_setup() {},
      __rue_cleanup_bucket: [],
    }
    function VaporPage() {
      return portableVapor
    }

    const element = createAppServerElement(VaporPage, { answer: 42 }) as {
      props: { answer: number }
      type: (props: { answer: number }) => Promise<unknown>
    }
    const rendered = (await element.type(element.props)) as {
      props: {
        'data-text-rue-html': string
        dangerouslySetInnerHTML: { __html: string }
      }
      type: string
    }
    const { renderToString } = await import('@rue-js/server-renderer')

    expect(renderToString).toHaveBeenCalledWith(portableVapor)
    expect(rendered.type).toBe('text-rue-html')
    expect(rendered.props['data-text-rue-html']).toBe('')
    expect(rendered.props.dangerouslySetInnerHTML.__html).toBe('<main>rue html</main>')
  })

  it('uses the injected Rue SSR renderer when the RSC graph adapts portable Rue output', async () => {
    const portableVapor = {
      __rue_vapor_setup() {},
      __rue_cleanup_bucket: [],
    }
    const injectedRenderToString = vi.fn(async () => '<article>injected rue html</article>')
    ;(globalThis as Record<string, unknown>).__TEXT_RUE_RENDER_TO_STRING__ = injectedRenderToString

    const rendered = (await adaptAppServerRenderableForHtmlSsr(portableVapor as never)) as {
      props: {
        'data-text-rue-html': string
        dangerouslySetInnerHTML: { __html: string }
      }
      type: string
    }

    expect(injectedRenderToString).toHaveBeenCalledWith(portableVapor)
    expect(rendered.type).toBe('text-rue-html')
    expect(rendered.props.dangerouslySetInnerHTML.__html).toBe(
      '<article>injected rue html</article>',
    )
  })

  it('adapts portable Rue Vapor children before they cross client references', async () => {
    const portableVapor = {
      __rue_vapor_setup() {},
      __rue_cleanup_bucket: [],
    }
    const clientReference = Object.assign(
      () => {
        throw new Error('client reference should not execute on the server')
      },
      { $$typeof: AppRscServerClientReferenceSymbol },
    )

    const element = createAppServerElement(clientReference, null, portableVapor) as {
      props: {
        children: Promise<unknown>
      }
    }
    const rendered = (await element.props.children) as {
      props: {
        'data-text-rue-html': string
        dangerouslySetInnerHTML: { __html: string }
      }
      type: string
    }
    const { renderToString } = await import('@rue-js/server-renderer')

    expect(renderToString).toHaveBeenCalledWith(portableVapor)
    expect(rendered.type).toBe('text-rue-html')
    expect(rendered.props['data-text-rue-html']).toBe('')
    expect(rendered.props.dangerouslySetInnerHTML.__html).toBe('<main>rue html</main>')
  })

  it('keeps server client references unwrapped', () => {
    const clientReference = Object.assign(
      () => {
        throw new Error('client reference should not execute on the server')
      },
      { $$typeof: AppRscServerClientReferenceSymbol },
    )

    const element = createAppServerElement(clientReference, null) as { type: unknown }

    expect(element.type).toBe(clientReference)
  })

  it('keeps client references in server component results during RSC adaptation', async () => {
    const resolver = vi.fn(() => {
      function ResolvedClientComponent() {
        return createAppServerElement('button', null, 'resolved')
      }
      return ResolvedClientComponent
    })
    const clientReference = Object.assign(
      () => {
        throw new Error('client reference should not execute on the server')
      },
      {
        $$typeof: AppRscServerClientReferenceSymbol,
        $$id: '/src/like-button.tsx#default',
      },
    )
    function Page() {
      return createAppServerElement(clientReference, { initialLikes: 16 })
    }
    setAppClientReferenceResolver(resolver)

    const element = createAppServerElement(Page, null) as {
      props: Record<string, unknown>
      type: (props: Record<string, unknown>) => Promise<{
        props: { initialLikes: number }
        type: unknown
      }>
    }
    const rendered = await element.type(element.props)

    expect(resolver).not.toHaveBeenCalled()
    expect(rendered.type).toBe(clientReference)
    expect(rendered.props.initialLikes).toBe(16)
  })

  it('treats Rue client references as compatibility tags, not the native tag', () => {
    const nativeReference = { $$typeof: AppRscServerClientReferenceSymbol }
    const textCompatReference = { $$typeof: Symbol.for('text.client.reference') }
    const rueCompatReference = { $$typeof: CompatRueRscServerClientReferenceSymbol }
    const nativeProtocol = createAppRscClientReferenceProtocol()

    expect(AppRscServerClientReferenceSymbol).toBe(Symbol.for('rue.client.reference'))
    expect(isAppRscServerClientReference(nativeReference)).toBe(true)
    expect(isAppRscServerClientReference(textCompatReference)).toBe(false)
    expect(isAppRscServerClientReference(rueCompatReference)).toBe(true)
    expect(nativeProtocol.isServerClientReference(nativeReference)).toBe(true)
    expect(nativeProtocol.isServerClientReference(textCompatReference)).toBe(false)
    expect(nativeProtocol.isServerClientReference(rueCompatReference)).toBe(false)
  })

  it('keeps Rue compatibility client references unwrapped', () => {
    const clientReference = Object.assign(
      () => {
        throw new Error('client reference should not execute on the server')
      },
      { $$typeof: CompatRueRscServerClientReferenceSymbol },
    )

    const element = createAppServerElement(clientReference, null) as { type: unknown }

    expect(element.type).toBe(clientReference)
  })

  it('renders marked passthrough client references as children during HTML SSR', async () => {
    const clientReference = Object.assign(
      () => {
        throw new Error('client reference should not execute on the server')
      },
      { $$typeof: CompatRueRscServerClientReferenceSymbol },
    )
    markAppSsrPassthroughComponent(clientReference)

    const element = createAppServerElement(clientReference, null, 'server child') as never
    const adapted = (await adaptAppServerRenderableForHtmlSsr(element)) as {
      props: { children: string }
      type: (props: { children: string }) => string
    }

    expect(adapted.type).not.toBe(clientReference)
    expect(adapted.type(adapted.props)).toBe('server child')
  })

  it('resolves Rue compatibility client references for inline SSR adaptation', async () => {
    function ResolvedClientComponent(props: { children?: unknown }) {
      return createAppServerElement('button', null, props.children)
    }
    const clientReference = Object.assign(
      () => {
        throw new Error('client reference should not execute on the server')
      },
      {
        $$typeof: CompatRueRscServerClientReferenceSymbol,
        $$id: '/src/client-button.tsx#default',
      },
    )
    setAppClientReferenceResolver(async (referenceKey, exportName) => {
      expect(referenceKey).toBe('/src/client-button.tsx')
      expect(exportName).toBe('default')
      return ResolvedClientComponent
    })

    const element = createAppServerElement(clientReference, null, 'Click') as never
    const adapted = (await adaptAppServerRenderableForSsr(element)) as {
      type: typeof ResolvedClientComponent
      props: { children: string }
    }

    expect(adapted.type).toBe(ResolvedClientComponent)
    expect(adapted.props.children).toBe('Click')
  })

  it('resolves async client references during HTML SSR when no server-renderable children exist', async () => {
    function ResolvedClientComponent() {
      return createAppServerElement('span', null, 'Client')
    }
    const clientReference = Object.assign(
      () => {
        throw new Error('client reference should not execute on the server')
      },
      {
        $$typeof: CompatRueRscServerClientReferenceSymbol,
        $$id: '/src/no-children-client.tsx#default',
      },
    )
    setAppClientReferenceResolver(async (referenceKey, exportName) => {
      expect(referenceKey).toBe('/src/no-children-client.tsx')
      expect(exportName).toBe('default')
      return ResolvedClientComponent
    })

    const element = createAppServerElement(clientReference, null) as never
    const adapted = (await adaptAppServerRenderableForHtmlSsr(element)) as {
      props: Record<string, unknown>
      type: (props: Record<string, unknown>) => PromiseLike<{ type: string }>
    }
    const rendered = await adapted.type(adapted.props)

    expect(rendered.type).toBe('span')
  })

  it('preserves childless client references when HTML SSR resolves back to a server stub', async () => {
    const clientReference = Object.assign(
      () => {
        throw new Error('client reference should not execute on the server')
      },
      {
        $$typeof: AppRscServerClientReferenceSymbol,
        $$id: '/src/unresolved-client.tsx#default',
      },
    )
    setAppClientReferenceResolver((referenceKey, exportName) => {
      expect(referenceKey).toBe('/src/unresolved-client.tsx')
      expect(exportName).toBe('default')
      return clientReference
    })

    const element = createAppServerElement(clientReference, null) as never
    const adapted = (await adaptAppServerRenderableForHtmlSsr(element)) as {
      props: Record<string, unknown>
      type: unknown
    }

    expect(adapted.type).toBe(clientReference)
    expect(adapted.props).toEqual({})
  })

  it('preserves unresolved client references during RSC adaptation', async () => {
    const clientReference = Object.assign(
      () => {
        throw new Error('client reference should not execute on the server')
      },
      {
        $$typeof: AppRscServerClientReferenceSymbol,
        $$id: '/src/unresolved-rsc-client.tsx#default',
      },
    )
    setAppClientReferenceResolver((referenceKey, exportName) => {
      expect(referenceKey).toBe('/src/unresolved-rsc-client.tsx')
      expect(exportName).toBe('default')
      return null
    })

    const element = createAppServerElement(clientReference, { count: 4 }) as never
    const adapted = (await adaptAppServerRenderableForSsr(element)) as {
      props: { count: number }
      type: unknown
    }

    expect(adapted.type).toBe(clientReference)
    expect(adapted.props.count).toBe(4)
  })

  it('falls back to children when an async HTML SSR client reference resolves to a server stub', async () => {
    const clientReference = Object.assign(
      () => {
        throw new Error('client reference should not execute on the server')
      },
      {
        $$typeof: AppRscServerClientReferenceSymbol,
        $$id: '/src/async-unresolved-client.tsx#default',
      },
    )
    setAppClientReferenceResolver((referenceKey, exportName) => {
      expect(referenceKey).toBe('/src/async-unresolved-client.tsx')
      expect(exportName).toBe('default')
      return Promise.resolve(clientReference)
    })

    const element = createAppServerElement(clientReference, null, 'server child') as never
    const adapted = await adaptAppServerRenderableForHtmlSsr(element)

    expect(adapted).toBe('server child')
  })

  it('adapts Rue client component output after resolving async references for HTML SSR', async () => {
    function ResolvedClientComponent() {
      return h('button', null, 'Client')
    }
    const clientReference = Object.assign(
      () => {
        throw new Error('client reference should not execute on the server')
      },
      {
        $$typeof: CompatRueRscServerClientReferenceSymbol,
        $$id: '/src/rue-client.tsx#default',
      },
    )
    setAppClientReferenceResolver(async (referenceKey, exportName) => {
      expect(referenceKey).toBe('/src/rue-client.tsx')
      expect(exportName).toBe('default')
      return ResolvedClientComponent
    })

    const element = createAppServerElement(clientReference, null) as never
    const adapted = (await adaptAppServerRenderableForHtmlSsr(element)) as {
      props: Record<string, unknown>
      type: (props: Record<string, unknown>) => PromiseLike<{
        props: {
          dangerouslySetInnerHTML: { __html: string }
        }
        type: string
      }>
    }
    const rendered = await adapted.type(adapted.props)

    expect(rendered.type).toBe('text-rue-html')
    expect(rendered.props.dangerouslySetInnerHTML.__html).toBe('<main>rue html</main>')
  })

  it('unwraps Rue signal children returned by client components during HTML SSR', async () => {
    function ResolvedClientComponent() {
      return createAppServerElement('p', null, 'Count: ', {
        get() {
          return 0
        },
        value: 0,
      } as never)
    }
    const clientReference = Object.assign(
      () => {
        throw new Error('client reference should not execute on the server')
      },
      {
        $$typeof: CompatRueRscServerClientReferenceSymbol,
        $$id: '/src/signal-client.tsx#default',
      },
    )
    setAppClientReferenceResolver(async (referenceKey, exportName) => {
      expect(referenceKey).toBe('/src/signal-client.tsx')
      expect(exportName).toBe('default')
      return ResolvedClientComponent
    })

    const element = createAppServerElement(clientReference, null) as never
    const adapted = (await adaptAppServerRenderableForHtmlSsr(element)) as {
      props: Record<string, unknown>
      type: (props: Record<string, unknown>) => PromiseLike<{
        props: { children: [string, number] }
      }>
    }
    const rendered = await adapted.type(adapted.props)

    expect(rendered.props.children).toEqual(['Count: ', 0])
  })

  it('keeps async client references non-blocking during HTML SSR when children can render', async () => {
    function ResolvedClientComponent() {
      return createAppServerElement('span', null, 'Client')
    }
    const clientReference = Object.assign(
      () => {
        throw new Error('client reference should not execute on the server')
      },
      {
        $$typeof: CompatRueRscServerClientReferenceSymbol,
        $$id: '/src/children-client.tsx#default',
      },
    )
    setAppClientReferenceResolver(async (referenceKey, exportName) => {
      expect(referenceKey).toBe('/src/children-client.tsx')
      expect(exportName).toBe('default')
      return ResolvedClientComponent
    })

    const element = createAppServerElement(clientReference, null, 'server child') as never
    const adapted = await adaptAppServerRenderableForHtmlSsr(element)

    expect(adapted).toBe('server child')
  })

  it('awaits async provider client references during HTML SSR even when children can render', async () => {
    function ResolvedProvider(props: { children?: unknown }) {
      return createAppServerElement('provider-shell', null, props.children)
    }
    const clientReference = Object.assign(
      () => {
        throw new Error('client reference should not execute on the server')
      },
      {
        $$typeof: CompatRueRscServerClientReferenceSymbol,
        $$id: '/src/theme-provider.tsx#ThemeProvider',
      },
    )
    markAppSsrPassthroughComponent(clientReference)
    setAppClientReferenceResolver(async (referenceKey, exportName) => {
      expect(referenceKey).toBe('/src/theme-provider.tsx')
      expect(exportName).toBe('ThemeProvider')
      return ResolvedProvider
    })

    const element = createAppServerElement(clientReference, null, 'server child') as never
    const adapted = (await adaptAppServerRenderableForHtmlSsr(element)) as {
      props: { children: string }
      type: (props: { children: string }) => { type: string }
    }
    const rendered = adapted.type(adapted.props)

    expect(rendered.type).toBe('provider-shell')
  })

  it('resolves nested Rue compatibility client references during inline SSR adaptation', async () => {
    function ResolvedClientComponent() {
      return createAppServerElement('span', null, 'Client')
    }
    const clientReference = Object.assign(
      () => {
        throw new Error('client reference should not execute on the server')
      },
      {
        $$typeof: CompatRueRscServerClientReferenceSymbol,
        $$id: '/src/nested-client.tsx#default',
      },
    )
    setAppClientReferenceResolver(async (referenceKey, exportName) => {
      expect(referenceKey).toBe('/src/nested-client.tsx')
      expect(exportName).toBe('default')
      return ResolvedClientComponent
    })

    const tree = createAppServerElement(
      'div',
      null,
      createAppServerElement(clientReference, null),
    ) as never
    const adapted = (await adaptAppServerRenderableForSsr(tree)) as {
      props: {
        children: {
          type: typeof ResolvedClientComponent
        }
      }
    }
    const adaptedChild = adapted.props.children

    expect(adaptedChild.type).toBe(ResolvedClientComponent)
  })

  it('resolves async Rue children in arrays during inline SSR adaptation', async () => {
    const portableVapor = {
      __rue_vapor_setup() {},
      __rue_cleanup_bucket: [],
    }

    const tree = createAppServerElement('div', null, 'before', portableVapor) as never
    const adapted = (await adaptAppServerRenderableForSsr(tree)) as {
      props: {
        children: [
          string,
          {
            props: {
              'data-text-rue-html': string
              dangerouslySetInnerHTML: { __html: string }
            }
            type: string
          },
        ]
      }
    }

    expect(adapted.props.children[0]).toBe('before')
    expect(adapted.props.children[1].type).toBe('text-rue-html')
    expect(adapted.props.children[1].props.dangerouslySetInnerHTML.__html).toBe(
      '<main>rue html</main>',
    )
  })

  it('re-adapts foreign server component adapter results during inline SSR', async () => {
    function ResolvedClientComponent() {
      return createAppServerElement('span', null, 'Client')
    }
    const clientReference = Object.assign(
      () => {
        throw new Error('client reference should not execute on the server')
      },
      {
        $$typeof: CompatRueRscServerClientReferenceSymbol,
        $$id: '/src/foreign-client.tsx#default',
      },
    )
    function ForeignServerComponentAdapter() {
      return createAppServerElement('div', null, createAppServerElement(clientReference, null))
    }
    setAppClientReferenceResolver(async (referenceKey, exportName) => {
      expect(referenceKey).toBe('/src/foreign-client.tsx')
      expect(exportName).toBe('default')
      return ResolvedClientComponent
    })

    const tree = createAppServerElement(ForeignServerComponentAdapter, null) as never
    const adapted = (await adaptAppServerRenderableForSsr(tree)) as {
      props: Record<string, unknown>
      type: (props: Record<string, unknown>) => PromiseLike<{
        props: {
          children: {
            props: Record<string, unknown>
            type: (props: Record<string, unknown>) => PromiseLike<{
              type: string
            }>
          }
        }
      }>
    }
    const rendered = await adapted.type(adapted.props)
    const renderedChild = rendered.props.children
    const renderedGrandchild = await renderedChild.type(renderedChild.props)

    expect(renderedGrandchild.type).toBe('span')
  })
})
