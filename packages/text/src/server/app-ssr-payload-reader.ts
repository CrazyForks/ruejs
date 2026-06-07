import type { AppWireElements } from './app-elements.js'
import {
  createInlineAppSsrPayloadDecoder,
  type AppSsrInlinePayload,
} from './app-ssr-inline-payload-protocol.js'
import {
  createAppSsrPayloadReader as createAppSsrPayloadReaderCore,
  resolveAppSsrPayloadElements as resolveAppSsrPayloadElementsCore,
  type AppSsrPayloadDecoder,
  type AppSsrPayloadThenableReader,
} from './app-ssr-payload-reader-core.js'
import { readAppSsrThenableValue } from './app-ssr-thenable-protocol.js'

export {
  APP_SSR_WIRE_PAYLOAD_CONTENT_TYPE,
  createAppSsrWirePayloadDecoder,
  decodeAppSsrWirePayloadStream,
  encodeAppSsrWirePayload,
  renderAppSsrWirePayloadToReadableStream,
} from './app-ssr-wire-payload-protocol.js'

export type AppSsrPayloadReaderOptions = {
  decodePayload?: AppSsrPayloadDecoder
  inlinePayload?: AppSsrInlinePayload
  primePageForHtmlSsr?: boolean
  readThenable?: AppSsrPayloadThenableReader
}

function createMissingAppSsrInlinePayloadError(): Error {
  return new Error(
    '[text] App Router HTML SSR requires an in-process App payload. ' +
      'Pass inlinePayload from the App render pipeline, or provide an explicit decodePayload ' +
      'compatibility decoder for cross-runtime SSR payload streams.',
  )
}

function decodeMissingAppSsrInlinePayload(): PromiseLike<AppWireElements> {
  throw createMissingAppSsrInlinePayloadError()
}

export function createAppSsrPayloadReader(
  stream: ReadableStream<Uint8Array>,
  options: AppSsrPayloadReaderOptions = {},
): ReturnType<typeof createAppSsrPayloadReaderCore> {
  const decodePayload =
    options.inlinePayload !== undefined
      ? createInlineAppSsrPayloadDecoder(options.inlinePayload)
      : (options.decodePayload ?? decodeMissingAppSsrInlinePayload)
  const readThenable = options.readThenable ?? readAppSsrThenableValue
  return createAppSsrPayloadReaderCore(stream, {
    decodePayload,
    primePageForHtmlSsr: options.primePageForHtmlSsr,
    readThenable,
  })
}

export function resolveAppSsrPayloadElements(
  stream: ReadableStream<Uint8Array>,
  options: AppSsrPayloadReaderOptions = {},
): ReturnType<typeof resolveAppSsrPayloadElementsCore> {
  const decodePayload =
    options.inlinePayload !== undefined
      ? createInlineAppSsrPayloadDecoder(options.inlinePayload)
      : (options.decodePayload ?? decodeMissingAppSsrInlinePayload)
  return resolveAppSsrPayloadElementsCore(stream, {
    decodePayload,
    primePageForHtmlSsr: options.primePageForHtmlSsr,
    readThenable: options.readThenable ?? readAppSsrThenableValue,
  })
}
