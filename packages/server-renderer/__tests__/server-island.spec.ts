// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'

import {
  ServerIslandPayloadExpiredError,
  createServerIslandHandler,
  decodeServerIslandPayload,
  encodeServerIslandPayload,
  type ServerIslandEnvelope,
} from '../src/server-island'

const key = new Uint8Array(32).fill(7)
const otherKey = new Uint8Array(32).fill(9)
const future = 2_000_000_000_000

const payloadUrl = (envelope: ServerIslandEnvelope) =>
  `https://example.test/_rue/server-island?payload=${encodeURIComponent(JSON.stringify(envelope))}`

describe('server island payload codec', () => {
  it('round-trips strict island props and uses a fresh 96-bit IV', async () => {
    const input = {
      id: 'catalog:price',
      props: {
        createdAt: new Date('2026-07-18T00:00:00.000Z'),
        filters: new Map([['region', 'cn']]),
        total: 12n,
      },
      expiresAt: future,
      key,
    }

    const first = await encodeServerIslandPayload(input)
    const second = await encodeServerIslandPayload(input)
    const decoded = await decodeServerIslandPayload(first, { key, now: future - 1 })

    expect(first).toMatchObject({ v: 1, id: 'catalog:price' })
    expect(first.iv).not.toBe(second.iv)
    expect(first.ciphertext).not.toBe(second.ciphertext)
    expect(decoded.id).toBe(input.id)
    expect(decoded.expiresAt).toBe(future)
    expect(decoded.props).toEqual(input.props)
  })

  it('rejects weak keys, tampering, wrong keys, and expired payloads', async () => {
    await expect(
      encodeServerIslandPayload({
        id: 'demo',
        props: {},
        expiresAt: future,
        key: new Uint8Array(16),
      }),
    ).rejects.toThrow(/32-byte/)

    const envelope = await encodeServerIslandPayload({
      id: 'demo',
      props: { safe: true },
      expiresAt: future,
      key,
    })
    const tampered = {
      ...envelope,
      ciphertext: `${envelope.ciphertext.slice(0, -1)}${
        envelope.ciphertext.endsWith('A') ? 'B' : 'A'
      }`,
    }

    await expect(decodeServerIslandPayload(tampered, { key, now: future - 1 })).rejects.toThrow(
      /invalid/i,
    )
    await expect(
      decodeServerIslandPayload(envelope, { key: otherKey, now: future - 1 }),
    ).rejects.toThrow(/invalid/i)
    await expect(decodeServerIslandPayload(envelope, { key, now: future })).rejects.toBeInstanceOf(
      ServerIslandPayloadExpiredError,
    )
  })
})

describe('server island fetch handler', () => {
  const createHandler = () => {
    const resolve = vi.fn((id: string) => (id === 'known' ? { name: 'KnownIsland' } : null))
    const render = vi.fn(
      ({ component, props, request }: any) =>
        `<section>${component.name}:${props.message}:${new URL(request.url).pathname}</section>`,
    )
    const handler = createServerIslandHandler({ key, resolve, render, now: () => future - 1 })
    return { handler, resolve, render }
  }

  it('renders valid GET and JSON POST requests through the allowlist resolver', async () => {
    const envelope = await encodeServerIslandPayload({
      id: 'known',
      props: { message: 'hello' },
      expiresAt: future,
      key,
    })
    const { handler, resolve, render } = createHandler()

    const getResponse = await handler(new Request(payloadUrl(envelope)))
    const postResponse = await handler(
      new Request('https://example.test/_rue/server-island', {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify(envelope),
      }),
    )

    expect(getResponse.status).toBe(200)
    expect(await getResponse.text()).toContain('KnownIsland:hello')
    expect(postResponse.status).toBe(200)
    expect(resolve).toHaveBeenCalledTimes(2)
    expect(resolve).toHaveBeenLastCalledWith('known', expect.any(Request))
    expect(render).toHaveBeenCalledTimes(2)
  })

  it('returns exact safe statuses for malformed, expired, unknown, oversized, and method requests', async () => {
    const valid = await encodeServerIslandPayload({
      id: 'known',
      props: { message: 'secret-prop' },
      expiresAt: future,
      key,
    })
    const expired = await encodeServerIslandPayload({
      id: 'known',
      props: {},
      expiresAt: future - 2,
      key,
    })
    const unknown = await encodeServerIslandPayload({
      id: 'missing',
      props: {},
      expiresAt: future,
      key,
    })
    const tampered = { ...valid, id: 'missing' }
    const { handler, resolve, render } = createHandler()

    const responses = await Promise.all([
      handler(new Request('https://example.test/_rue/server-island?payload=not-json')),
      handler(new Request(payloadUrl(tampered))),
      handler(new Request(payloadUrl(expired))),
      handler(new Request(payloadUrl(unknown))),
      handler(
        new Request('https://example.test/_rue/server-island', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'content-length': '70000' },
          body: JSON.stringify(valid),
        }),
      ),
      handler(new Request('https://example.test/_rue/server-island', { method: 'PUT' })),
    ])

    expect(responses.map(response => response.status)).toEqual([400, 400, 410, 404, 413, 405])
    expect(responses[5].headers.get('allow')).toBe('GET, POST')
    for (const response of responses) {
      const text = await response.text()
      expect(text).not.toContain('secret-prop')
      expect(text).not.toContain(valid.ciphertext)
    }
    expect(resolve).toHaveBeenCalledTimes(1)
    expect(render).not.toHaveBeenCalled()
  })

  it('measures the actual POST bytes and does not swallow renderer failures', async () => {
    const envelope = await encodeServerIslandPayload({
      id: 'known',
      props: { message: 'hello' },
      expiresAt: future,
      key,
    })
    const oversized = JSON.stringify({ ...envelope, padding: '界'.repeat(30_000) })
    const handler = createServerIslandHandler({
      key,
      resolve: () => ({ name: 'KnownIsland' }),
      render: () => {
        throw new Error('renderer failed')
      },
      now: () => future - 1,
    })

    const oversizedResponse = await handler(
      new Request('https://example.test/_rue/server-island', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: oversized,
      }),
    )
    expect(oversizedResponse.status).toBe(413)
    await expect(handler(new Request(payloadUrl(envelope)))).rejects.toThrow('renderer failed')
  })
})
