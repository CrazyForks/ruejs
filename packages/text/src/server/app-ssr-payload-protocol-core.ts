export type AppSsrStreamPayloadDecoder<T> = (stream: ReadableStream<Uint8Array>) => PromiseLike<T>

export type AppSsrPayloadProtocol = {
  decodePayload: <T>(stream: ReadableStream<Uint8Array>) => PromiseLike<T>
}

export type AppSsrPayloadProtocolLoader = {
  load: () => Promise<AppSsrPayloadProtocol | null>
}

export type CreateAppSsrPayloadProtocolOptions = {
  createMissingProtocolError?: () => Error
}

function createMissingAppSsrPayloadProtocolError(): Error {
  return new Error(
    '[text] App Router SSR stream payload decoding requires a configured payload protocol. ' +
      'provide a Rue-native decodePayload implementation.',
  )
}

export function createAppSsrPayloadProtocol(
  loader: AppSsrPayloadProtocolLoader,
  options: CreateAppSsrPayloadProtocolOptions = {},
): AppSsrPayloadProtocol {
  const createMissingProtocolError =
    options.createMissingProtocolError ?? createMissingAppSsrPayloadProtocolError

  return {
    async decodePayload<T>(stream: ReadableStream<Uint8Array>): Promise<T> {
      const protocol = await loader.load()
      if (!protocol) {
        throw createMissingProtocolError()
      }
      return protocol.decodePayload<T>(stream)
    },
  }
}
