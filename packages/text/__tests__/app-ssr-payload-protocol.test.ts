import { describe, expect, it, vi } from 'vite-plus/test'
import { AppElementsWire, type AppWireElements } from '../src/server/app-elements.js'
import {
  createAppSsrPayloadProtocol,
  createAppSsrWirePayloadDecoder,
  renderAppSsrWirePayloadToReadableStream,
} from '../src/server/app-ssr-payload-protocol.js'

function createTestStream(): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.close()
    },
  })
}

describe('App SSR payload protocol', () => {
  it('decodes through an injectable protocol loader', async () => {
    const stream = createTestStream()
    const payload = { 'page:/': 'home' }
    const decodePayload = vi.fn(async (input: ReadableStream<Uint8Array>) => {
      expect(input).toBe(stream)
      return payload
    })
    const load = vi.fn(async () => ({ decodePayload }))

    const protocol = createAppSsrPayloadProtocol({ load })

    await expect(protocol.decodePayload(stream)).resolves.toBe(payload)
    expect(load).toHaveBeenCalledTimes(1)
    expect(decodePayload).toHaveBeenCalledTimes(1)
  })

  it('fails with an explicit replacement message when no protocol is available', async () => {
    const protocol = createAppSsrPayloadProtocol({
      load: vi.fn(async () => null),
    })

    await expect(protocol.decodePayload(createTestStream())).rejects.toThrow(
      'provide a Rue-native decodePayload implementation',
    )
  })

  it('exposes the Rue-native App wire payload decoder through the neutral facade', async () => {
    const payload: AppWireElements = {
      [AppElementsWire.keys.interceptionContext]: null,
      [AppElementsWire.keys.rootLayout]: '/',
      [AppElementsWire.keys.route]: AppElementsWire.encodeRouteId('/wire', null),
      [AppElementsWire.encodePageId('/wire', null)]: 'wire page',
    }
    const protocol = createAppSsrPayloadProtocol({
      load: vi.fn(async () => ({ decodePayload: createAppSsrWirePayloadDecoder() })),
    })

    await expect(
      protocol.decodePayload(renderAppSsrWirePayloadToReadableStream(payload)),
    ).resolves.toEqual(payload)
  })
})
