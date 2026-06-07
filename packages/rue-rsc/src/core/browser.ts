import { memoize } from '@hiogawa/utils'
import {
  installRueClientReferenceRequire,
  removeReferenceCacheTag,
  setInternalRequire,
  setRueClientReferenceFallbackLoader,
} from './shared'

export {
  loadRueClientReferenceModule,
  preloadRueClientReferences,
  registerRueClientReferenceLoaders,
  resolveRueClientReferenceExport,
  type RueClientReferenceLoader,
  type RueClientReferenceLoaders,
  type RueClientReferenceModule,
} from './shared'

let init = false

export function setRequireModule(options: { load: (id: string) => Promise<unknown> }): void {
  if (init) return
  init = true

  const requireModule = memoize((id: string) => {
    return options.load(removeReferenceCacheTag(id))
  })

  setRueClientReferenceFallbackLoader(requireModule)
  installRueClientReferenceRequire()

  setInternalRequire()
}
