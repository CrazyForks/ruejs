import { describe, expect, it, vi } from 'vite-plus/test'
import { decodeRuePayloadReadableStream } from '@rue-js/rsc/core/payload'
import { AppRscServerClientReferenceSymbol } from '../src/server/app-rsc-client-reference-protocol-core.js'
import { createServerProtocolElement } from '../src/server/element-protocol.js'
import { renderAppRscPayloadToReadableStream } from '../src/server/app-rsc-runtime-compat.js'

vi.mock('../src/server/app-rsc-ssr-plugin-runtime-compat.js', () => ({
  installCompatAppClientReferenceResolver: vi.fn(),
}))

function createClientReference(id: string): unknown {
  return Object.assign(
    () => {
      throw new Error('client reference should not execute on the server')
    },
    {
      $$typeof: AppRscServerClientReferenceSymbol,
      $$id: id,
    },
  )
}

describe('App RSC runtime compat payload renderer', () => {
  it('normalizes server component results before encoding nested client references', async () => {
    const clientReference = createClientReference('/components/LikeButton.tsx#default')

    function Page() {
      return createServerProtocolElement(
        'article',
        null,
        'before',
        createServerProtocolElement(clientReference, { initialLikes: 16 }),
        'after',
      )
    }

    const decoded = await decodeRuePayloadReadableStream<Record<string, unknown>>(
      renderAppRscPayloadToReadableStream({
        'page:/blog/:slug': createServerProtocolElement(Page),
      }),
      { preserveClientReferences: true },
    )
    const page = decoded['page:/blog/:slug'] as {
      props: {
        children: [
          string,
          {
            props: { initialLikes: number }
            type: {
              $rue: string
              exportName: string
              id: string
              referenceKey: string
            }
          },
          string,
        ]
      }
      type: string
    }
    const likeButton = page.props.children[1]

    expect(page.type).toBe('article')
    expect(page.props.children[0]).toBe('before')
    expect(page.props.children[2]).toBe('after')
    expect(likeButton.type).toMatchObject({
      $rue: 'clientReference',
      exportName: 'default',
      id: '/components/LikeButton.tsx#default',
      referenceKey: '/components/LikeButton.tsx',
    })
    expect(likeButton.props.initialLikes).toBe(16)
  })
})
