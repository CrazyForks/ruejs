import { describe, expect, it, vi } from 'vite-plus/test'
import { createLegacyRenderProtocol } from '../src/server/legacy-render-protocol-core.js'

describe('Legacy render protocol', () => {
  it('delegates legacy rendering through an injectable protocol', async () => {
    const stream = new ReadableStream<Uint8Array>()
    const element = { type: 'main', props: {} }
    const renderToReadableStream = vi.fn(async () => stream)
    const renderToString = vi.fn(async () => '<main></main>')
    const protocol = createLegacyRenderProtocol({
      renderToReadableStream,
      renderToString,
    })

    await expect(protocol.renderToReadableStream(element)).resolves.toBe(stream)
    await expect(protocol.renderToString(element)).resolves.toBe('<main></main>')
    expect(renderToReadableStream).toHaveBeenCalledWith(element)
    expect(renderToString).toHaveBeenCalledWith(element)
  })
})
