export type AppServerPayloadRenderer = (
  model: unknown,
  options?: unknown,
) => ReadableStream<Uint8Array>

export type AppServerPayloadProtocol = {
  renderToReadableStream: AppServerPayloadRenderer
}

export type AppServerPayloadProtocolLoader = {
  load: () => Promise<AppServerPayloadProtocol | null>
}

export type CreateLazyAppServerPayloadProtocolOptions = {
  createMissingProtocolError?: () => Error
}

export function createAppServerPayloadProtocol(
  renderToReadableStream: AppServerPayloadRenderer,
): AppServerPayloadProtocol {
  return { renderToReadableStream }
}

function createMissingAppServerPayloadProtocolError(): Error {
  return new Error(
    '[text] App Router server payload rendering requires a configured App server payload protocol. ' +
      'Provide a Rue-native renderToReadableStream implementation or install the compatibility dependency.',
  )
}

function createDeferredReadableStream(
  loadStream: () => Promise<ReadableStream<Uint8Array>>,
): ReadableStream<Uint8Array> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        reader = (await loadStream()).getReader()
        while (true) {
          const result = await reader.read()
          if (result.done) {
            controller.close()
            return
          }
          controller.enqueue(result.value)
        }
      } catch (error) {
        controller.error(error)
      } finally {
        reader = null
      }
    },
    async cancel(reason) {
      await reader?.cancel(reason)
    },
  })
}

export function createLazyAppServerPayloadProtocol(
  loader: AppServerPayloadProtocolLoader,
  options: CreateLazyAppServerPayloadProtocolOptions = {},
): AppServerPayloadProtocol {
  return {
    renderToReadableStream(model, renderOptions) {
      return createDeferredReadableStream(async () => {
        const protocol = await loader.load()
        if (!protocol) {
          throw (
            options.createMissingProtocolError?.() ?? createMissingAppServerPayloadProtocolError()
          )
        }
        return protocol.renderToReadableStream(model, renderOptions)
      })
    },
  }
}
