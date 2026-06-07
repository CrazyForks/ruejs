import assetsManifest from 'virtual:rue-rsc/assets-manifest'
import serverReferences from 'virtual:rue-rsc/server-references'
import { setRequireModule } from './core/rsc'
import type { ResolvedAssetDeps } from './plugin'
import { toReferenceValidationVirtual } from './plugins/shared'
import { renderRuePayloadToReadableStream as renderCoreRuePayloadToReadableStream } from './core/payload'

export { createClientManifest, createServerManifest, loadServerAction } from './core/rsc'

export { encryptActionBoundArgs, decryptActionBoundArgs } from './utils/encryption-runtime'

export { decodeRuePayloadFetch, decodeRuePayloadReadableStream } from './core/payload'

initialize()

function initialize(): void {
  setRequireModule({
    load: async id => {
      if (!import.meta.env.__vite_rsc_build__) {
        await import(
          /* @vite-ignore */ '/@id/__x00__' + toReferenceValidationVirtual({ id, type: 'server' })
        )
        return import(/* @vite-ignore */ id)
      } else {
        const import_ = serverReferences[id]
        if (!import_) {
          throw new Error(`server reference not found '${id}'`)
        }
        return import_()
      }
    },
  })
}

export function renderRuePayloadToReadableStream<T>(
  data: T,
  options?: object,
  extraOptions?: {
    /**
     * @experimental
     */
    onClientReference?: (metadata: { id: string; name: string; deps: ResolvedAssetDeps }) => void
  },
): ReadableStream<Uint8Array> {
  return renderCoreRuePayloadToReadableStream(data, options, {
    onClientReference(metadata) {
      const deps = assetsManifest.clientReferenceDeps[metadata.id] ?? {
        js: [],
        css: [],
      }
      extraOptions?.onClientReference?.({
        id: metadata.id,
        name: metadata.name,
        deps,
      })
    },
  })
}
