import { describe, expect, it, vi } from 'vite-plus/test'
import { createUseCacheRscProtocolLoader } from '../src/shims/cache-rsc-protocol-core.js'

describe('use cache RSC protocol', () => {
  it('loads through an injectable protocol loader', async () => {
    const protocol = {
      renderToReadableStream: vi.fn(),
      createFromReadableStream: vi.fn(),
      encodeActionArgs: vi.fn(),
      createActionReferenceSet: vi.fn(),
      createClientActionReferenceSet: vi.fn(),
      parseActionArgs: vi.fn(),
    }
    const load = vi.fn(async () => protocol)
    const loader = createUseCacheRscProtocolLoader(load)

    await expect(loader.load()).resolves.toBe(protocol)
    expect(load).toHaveBeenCalledTimes(1)
  })
})
