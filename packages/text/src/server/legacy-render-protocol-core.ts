import type { TextCompatNode } from '../shims/text-compat-types.js'

export type LegacyRenderProtocol = {
  renderToReadableStream: (element: TextCompatNode) => Promise<ReadableStream<Uint8Array>>
  renderToString: (element: TextCompatNode) => Promise<string>
}

export function createLegacyRenderProtocol(protocol: LegacyRenderProtocol): LegacyRenderProtocol {
  return protocol
}
