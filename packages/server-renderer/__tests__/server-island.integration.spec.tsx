// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'

import { type FC } from '@rue-js/rue'
import {
  createRueIslandDescriptor,
  createRueServerIslandDescriptor,
  startRueIslandLoader,
} from '@rue-js/runtime/island'
import { startRueServerIslandLoader } from '@rue-js/runtime/server-island'

import { renderToString } from '../src'
import { createServerIslandHandler, encodeServerIslandPayload } from '../src/server-island'

const waitFor = async (assertion: () => void) => {
  let lastError: unknown
  for (let index = 0; index < 50; index += 1) {
    try {
      assertion()
      return
    } catch (error) {
      lastError = error
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }
  throw lastError
}

describe('server island end-to-end protocol', () => {
  const key = crypto.getRandomValues(new Uint8Array(32))
  const ClientBadge: FC<{ label: string }> = props => (
    <button data-client-badge>{`hydrated ${props.label}`}</button>
  )
  const UserPanel: FC<{ layout: string; username: string }> = props => (
    <section data-user-panel={props.layout}>
      <h2>{`Welcome, ${props.username}`}</h2>
      {
        createRueIslandDescriptor({
          component: ClientBadge,
          props: { label: 'client badge' },
          metadata: {
            id: 'client-badge',
            component: '/private/ClientBadge.tsx',
            exportName: 'default',
            hydrate: 'load',
          },
        }) as any
      }
    </section>
  )

  const handler = createServerIslandHandler<FC<any>>({
    key,
    resolve: id => (id === 'user-panel' ? UserPanel : null),
    render: ({ component, props, request }) => {
      const cookie = request.headers.get('cookie') || ''
      const username = cookie.includes('session=ada') ? 'Ada Lovelace' : 'Guest'
      return renderToString(component, { props: { ...props, username } })
    },
  })

  const renderShell = (props: Record<string, unknown>, maxGetUrlLength = 2048) =>
    renderToString(
      createRueServerIslandDescriptor({
        id: 'user-panel',
        props,
        fallback: <p data-user-fallback>Loading your account</p>,
      }) as any,
      {
        serverIslands: {
          endpoint: '/_rue/server-island',
          maxGetUrlLength,
          encode: payload =>
            encodeServerIslandPayload({
              ...payload,
              expiresAt: Date.now() + 60_000,
              key,
            }),
        },
      },
    )

  const createFetch =
    (cookie = 'session=ada') =>
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      headers.set('cookie', cookie)
      return handler(
        new Request(new URL(String(input), 'https://example.test'), {
          method: init?.method,
          headers,
          body: init?.body,
        }),
      )
    }

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('keeps personalization out of the shell, then loads GET HTML and hydrates a nested client island', async () => {
    const shell = await renderShell({ layout: 'compact' })
    expect(shell).toContain('Loading your account')
    expect(shell).toContain('data-rue-method="GET"')
    expect(shell).not.toContain('Ada Lovelace')
    expect(shell).not.toContain('/private/ClientBadge.tsx')

    document.body.innerHTML = shell
    const stopClient = startRueIslandLoader({
      resolveModule: async id => {
        expect(id).toBe('client-badge')
        return { default: ClientBadge }
      },
    })
    const stopServer = startRueServerIslandLoader({ fetch: createFetch() })

    await waitFor(() => {
      expect(document.querySelector('rue-server-island')?.getAttribute('data-rue-status')).toBe(
        'loaded',
      )
      expect(document.body.textContent).toContain('Welcome, Ada Lovelace')
      expect(document.querySelector('rue-island')?.getAttribute('data-rue-status')).toBe('hydrated')
      expect(document.body.textContent).toContain('hydrated client badge')
    })

    stopServer()
    stopClient()
  })

  it('switches large encrypted props to POST and renders through the same request context', async () => {
    const shell = await renderShell({ layout: 'wide', query: '界'.repeat(500) }, 256)
    expect(shell).toContain('data-rue-method="POST"')
    expect(shell).toContain('data-rue-server-island-payload')
    expect(shell).not.toContain('界')
    expect(shell).not.toContain('Ada Lovelace')

    document.body.innerHTML = shell
    const stop = startRueServerIslandLoader({ fetch: createFetch() })
    await waitFor(() => {
      expect(document.body.textContent).toContain('Welcome, Ada Lovelace')
      expect(document.querySelector('rue-server-island')?.getAttribute('data-rue-status')).toBe(
        'loaded',
      )
    })
    stop()
  })

  it('leaves fallback intact and marks an encrypted GET request error after tampering', async () => {
    document.body.innerHTML = await renderShell({ layout: 'compact' })
    const island = document.querySelector('rue-server-island')!
    const url = new URL(island.getAttribute('data-rue-url')!, 'https://example.test')
    const envelope = JSON.parse(url.searchParams.get('payload')!)
    envelope.ciphertext = `${envelope.ciphertext.slice(0, -1)}${
      envelope.ciphertext.endsWith('A') ? 'B' : 'A'
    }`
    url.searchParams.set('payload', JSON.stringify(envelope))
    island.setAttribute('data-rue-url', `${url.pathname}${url.search}`)

    const stop = startRueServerIslandLoader({ fetch: createFetch() })
    await waitFor(() => {
      expect(island.getAttribute('data-rue-status')).toBe('error')
    })
    expect(island.innerHTML).toContain('Loading your account')
    expect(document.body.textContent).not.toContain('Ada Lovelace')
    stop()
  })
})
