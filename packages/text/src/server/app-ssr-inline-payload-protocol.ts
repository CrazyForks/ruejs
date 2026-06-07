import type { AppWireElements } from './app-elements.js'
import type { AppSsrPayloadDecoder } from './app-ssr-payload-reader-core.js'

export type AppSsrInlinePayload = AppWireElements | PromiseLike<AppWireElements>

export const APP_SSR_INLINE_PAYLOAD_STREAM_CANCEL_REASON =
  '[text] SSR payload resolved from in-process App payload'

function cancelUnusedSsrPayloadStream(stream: ReadableStream<Uint8Array>): void {
  try {
    void stream.cancel(APP_SSR_INLINE_PAYLOAD_STREAM_CANCEL_REASON).catch(() => {})
  } catch {}
}

export function createInlineAppSsrPayloadDecoder(
  inlinePayload: AppSsrInlinePayload,
): AppSsrPayloadDecoder {
  let cancelled = false

  return stream => {
    if (!cancelled) {
      cancelled = true
      cancelUnusedSsrPayloadStream(stream)
    }
    return inlinePayload
  }
}
