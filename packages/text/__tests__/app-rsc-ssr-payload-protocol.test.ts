import { describe, expect, it, vi } from 'vite-plus/test'
import {
  decodeRuePayloadReadableStream,
  renderRuePayloadToReadableStream,
} from '@rue-js/rsc/core/payload'
import { createRscSsrPayloadProtocol } from '../src/server/app-rsc-ssr-payload-protocol.js'
import { createServerProtocolElement } from '../src/server/element-protocol.js'

describe('App RSC SSR payload protocol', () => {
  it('decodes Rue payload frames through the SSR payload facade', async () => {
    const protocol = createRscSsrPayloadProtocol({
      load: vi.fn(async () => ({ decodePayload: decodeRuePayloadReadableStream })),
    })

    await expect(
      protocol.decodePayload<Record<string, unknown>>(
        renderRuePayloadToReadableStream({
          'page:/ssr': createServerProtocolElement('main', null, 'SSR payload'),
        }),
      ),
    ).resolves.toMatchObject({
      'page:/ssr': {
        type: 'main',
        props: { children: 'SSR payload' },
      },
    })
  })
})
