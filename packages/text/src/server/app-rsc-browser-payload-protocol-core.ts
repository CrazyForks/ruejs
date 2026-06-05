import type { AppBrowserActionCodecOptions } from './app-rsc-browser-action-protocol-core.js'

export type AppBrowserPayloadProtocol = {
  decodeFetch: <T>(
    response: Promise<Response>,
    options?: AppBrowserActionCodecOptions,
  ) => Promise<T>
  decodeReadableStream: <T>(
    stream: ReadableStream<Uint8Array>,
    options?: AppBrowserActionCodecOptions,
  ) => Promise<T>
}

export type AppBrowserPayloadProtocolLoader = {
  load: () => Promise<AppBrowserPayloadProtocol | null>
}

export type CreateAppBrowserPayloadProtocolOptions = {
  createMissingProtocolError?: () => Error
}

function createMissingAppBrowserPayloadProtocolError(): Error {
  return new Error(
    '[text] App Router browser payload decoding requires a configured App browser payload protocol. ' +
      'provide a Rue-native browser decode implementation.',
  )
}

export function createAppBrowserPayloadProtocol(
  loader: AppBrowserPayloadProtocolLoader,
  options: CreateAppBrowserPayloadProtocolOptions = {},
): AppBrowserPayloadProtocol {
  const createMissingProtocolError =
    options.createMissingProtocolError ?? createMissingAppBrowserPayloadProtocolError

  return {
    async decodeFetch<T>(
      response: Promise<Response>,
      decodeOptions?: AppBrowserActionCodecOptions,
    ): Promise<T> {
      const protocol = await loader.load()
      if (!protocol) {
        throw createMissingProtocolError()
      }
      return protocol.decodeFetch<T>(response, decodeOptions)
    },
    async decodeReadableStream<T>(
      stream: ReadableStream<Uint8Array>,
      decodeOptions?: AppBrowserActionCodecOptions,
    ): Promise<T> {
      const protocol = await loader.load()
      if (!protocol) {
        throw createMissingProtocolError()
      }
      return protocol.decodeReadableStream<T>(stream, decodeOptions)
    },
  }
}
