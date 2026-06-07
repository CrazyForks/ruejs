import { describe, expect, it, vi } from 'vite-plus/test'
import {
  RUE_ELEMENT_SYMBOL,
  RUE_FRAGMENT_SYMBOL,
  RUE_SUSPENSE_SYMBOL,
  decodeRuePayloadReadableStream,
  renderRuePayloadToReadableStream,
} from '@rue-js/rsc/core/payload'
import {
  ServerProtocolFragment,
  ServerProtocolSuspense,
  createServerProtocolElement,
  isServerProtocolElement,
} from '../src/server/element-protocol.js'
import {
  createAppServerPayloadProtocol,
  createLazyAppServerPayloadProtocol,
} from '../src/server/app-rsc-server-payload-protocol-core.js'

function createTestStream(): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.close()
    },
  })
}

function renderTestAppPayloadToReadableStream(
  model: unknown,
  options?: unknown,
): ReadableStream<Uint8Array> {
  return renderRuePayloadToReadableStream(adaptTestAppPayloadModel(model), options as object)
}

function adaptTestAppPayloadModel(model: unknown): unknown {
  if (isServerProtocolElement(model)) {
    return {
      ...model,
      $$typeof: RUE_ELEMENT_SYMBOL,
      type: adaptTestAppPayloadModel(model.type),
      props: adaptTestAppPayloadModel(model.props ?? {}),
    }
  }
  if (model === ServerProtocolFragment) return RUE_FRAGMENT_SYMBOL
  if (model === ServerProtocolSuspense) return RUE_SUSPENSE_SYMBOL
  if (Array.isArray(model)) return model.map(adaptTestAppPayloadModel)
  if (typeof model !== 'object' || model === null) return model
  const record: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(model)) {
    record[key] = adaptTestAppPayloadModel(value)
  }
  return record
}

describe('App server payload protocol', () => {
  it('renders through an injectable server payload renderer', () => {
    const stream = createTestStream()
    const model = { route: '/' }
    const options = { onError: vi.fn() }
    const renderToReadableStream = vi.fn(() => stream)
    const protocol = createAppServerPayloadProtocol(renderToReadableStream)

    expect(protocol.renderToReadableStream(model, options)).toBe(stream)
    expect(renderToReadableStream).toHaveBeenCalledWith(model, options)
  })

  it('renders through an injectable lazy server payload protocol loader', async () => {
    const stream = createTestStream()
    const model = { route: '/lazy' }
    const options = { onError: vi.fn() }
    const renderToReadableStream = vi.fn(() => stream)
    const load = vi.fn(async () => createAppServerPayloadProtocol(renderToReadableStream))
    const protocol = createLazyAppServerPayloadProtocol({ load })

    await expect(
      protocol.renderToReadableStream(model, options).getReader().read(),
    ).resolves.toEqual({
      done: true,
      value: undefined,
    })
    expect(load).toHaveBeenCalledTimes(1)
    expect(renderToReadableStream).toHaveBeenCalledWith(model, options)
  })

  it('fails with an explicit replacement message when no protocol is available', async () => {
    const protocol = createLazyAppServerPayloadProtocol({
      load: vi.fn(async () => null),
    })

    await expect(protocol.renderToReadableStream({}).getReader().read()).rejects.toThrow(
      'Rue-native renderToReadableStream implementation',
    )
  })

  it('round-trips server component output through the Rue payload codec', async () => {
    function Page() {
      return createServerProtocolElement('h1', { id: 'title' }, 'Hello Rue')
    }

    const protocol = createAppServerPayloadProtocol(renderTestAppPayloadToReadableStream)
    const decoded = await decodeRuePayloadReadableStream<{
      [key: string]: unknown
    }>(
      protocol.renderToReadableStream({
        'page:/': createServerProtocolElement(Page),
      }),
    )

    expect(decoded['page:/']).toMatchObject({
      type: 'h1',
      props: { id: 'title', children: 'Hello Rue' },
    })
  })
})
