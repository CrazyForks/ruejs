import { describe, expect, it, vi } from 'vite-plus/test'
import { createAppSsrRenderProtocol } from '../src/server/app-ssr-render-protocol-core.js'

describe('App SSR render protocol', () => {
  it('delegates SSR rendering through an injectable protocol', async () => {
    const stream = new ReadableStream<Uint8Array>()
    const node = { type: 'main', props: {} }
    const options = { bootstrapModules: ['/entry.js'] }
    const renderToReadableStream = vi.fn(async () => stream)
    const renderToStaticMarkup = vi.fn(() => '<main></main>')
    const protocol = createAppSsrRenderProtocol({
      renderToReadableStream,
      renderToStaticMarkup,
    })

    await expect(protocol.renderToReadableStream(node, options)).resolves.toBe(stream)
    expect(protocol.renderToStaticMarkup(node)).toBe('<main></main>')
    expect(renderToReadableStream).toHaveBeenCalledWith(node, options)
    expect(renderToStaticMarkup).toHaveBeenCalledWith(node)
  })
})
