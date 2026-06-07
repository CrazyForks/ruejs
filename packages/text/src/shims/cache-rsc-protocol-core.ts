export type UseCacheRscProtocol = {
  renderToReadableStream: (data: unknown, options?: object) => ReadableStream<Uint8Array>
  createFromReadableStream: <T>(stream: ReadableStream<Uint8Array>, options?: object) => Promise<T>
  encodeActionArgs: (v: unknown[], options?: unknown) => Promise<string | FormData>
  createActionReferenceSet: () => unknown
  createClientActionReferenceSet: () => unknown
  parseActionArgs: (body: string | FormData, options?: unknown) => Promise<unknown[]>
}

export type UseCacheRscProtocolLoader = {
  load: () => Promise<UseCacheRscProtocol | null>
}

export function createUseCacheRscProtocolLoader(
  load: UseCacheRscProtocolLoader['load'],
): UseCacheRscProtocolLoader {
  return { load }
}
