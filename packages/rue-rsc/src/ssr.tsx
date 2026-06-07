import assetsManifest from 'virtual:rue-rsc/assets-manifest'
import * as clientReferences from 'virtual:rue-rsc/client-references'
import { setRequireModule } from './core/ssr'
import type { ResolvedAssetDeps } from './plugin'
import { toCssVirtual, toReferenceValidationVirtual } from './plugins/shared'

export { createServerConsumerManifest } from './core/ssr'

export { decodeRuePayloadReadableStream } from './core/payload'

/**
 * Callback type for client reference dependency notifications.
 * Called during SSR when a client component's dependencies are loaded.
 * @experimental
 */
export type OnClientReference = (reference: { id: string; deps: ResolvedAssetDeps }) => void

// Registered callback for client reference deps
let onClientReference: OnClientReference | undefined

/**
 * Register a callback to be notified when client reference dependencies are loaded.
 * Called during SSR when a client component is accessed.
 * @experimental
 */
export function setOnClientReference(callback: OnClientReference | undefined): void {
  onClientReference = callback
}

initialize()

function initialize(): void {
  setRequireModule({
    load: async id => {
      if (!import.meta.env.__vite_rsc_build__) {
        await import(
          /* @vite-ignore */ '/@id/__x00__' + toReferenceValidationVirtual({ id, type: 'client' })
        )
        const mod = await import(/* @vite-ignore */ id)
        const modCss = await import(
          /* @vite-ignore */ '/@id/__x00__' + toCssVirtual({ id, type: 'ssr' })
        )
        return wrapResourceProxy(mod, id, { js: [], css: modCss.default })
      } else {
        const import_ = clientReferences.default[id]
        if (!import_) {
          throw new Error(`client reference not found '${id}'`)
        }
        const deps = assetsManifest.clientReferenceDeps[id] ?? {
          js: [],
          css: [],
        }
        // kick off preload/notify before initial async import, which is not sync-cached
        preloadDeps(deps)
        onClientReference?.({ id, deps })
        const mod: any = await import_()
        return wrapResourceProxy(mod, id, deps)
      }
    },
  })
}

// Preload during getter access since `load` is cached in production.
// Also notify `onClientReference` here because export access itself is not memoized.
function wrapResourceProxy(mod: any, id: string, deps: ResolvedAssetDeps) {
  return new Proxy(mod, {
    get(target, p, receiver) {
      if (p in mod) {
        preloadDeps(deps)
        onClientReference?.({ id, deps })
      }
      return Reflect.get(target, p, receiver)
    },
  })
}

function preloadDeps(deps: ResolvedAssetDeps) {
  void deps
}
