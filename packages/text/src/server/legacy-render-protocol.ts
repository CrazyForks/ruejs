export {
  createLegacyRenderProtocol,
  type LegacyRenderProtocol,
} from './legacy-render-protocol-core.js'
import type { TextCompatNode } from '../shims/text-compat-types.js'
import { renderAppSsrToReadableStream, renderAppSsrToStaticMarkup } from './app-ssr-renderer.js'
import { createLegacyRenderProtocol } from './legacy-render-protocol-core.js'

export const legacyRenderProtocol = createLegacyRenderProtocol({
  async renderToReadableStream(element) {
    return renderAppSsrToReadableStream(element, {})
  },
  async renderToString(element) {
    return renderAppSsrToStaticMarkup(element)
  },
})

export async function renderLegacyProtocolToString(element: TextCompatNode): Promise<string> {
  return legacyRenderProtocol.renderToString(element)
}

export async function renderLegacyProtocolToReadableStream(
  element: TextCompatNode,
): Promise<ReadableStream<Uint8Array>> {
  return legacyRenderProtocol.renderToReadableStream(element)
}
