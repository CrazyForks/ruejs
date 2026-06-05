import type { Plugin } from 'vite'
import {
  generateAppClientReferenceLoaders,
  type AppClientReferenceLoaderMeta,
} from './rsc-client-reference-loaders-core.js'

const TEXT_CLIENT_REFERENCES_PUBLIC_ID = 'virtual:text-rsc/client-references'
const TEXT_CLIENT_REFERENCES_ID = '\0' + TEXT_CLIENT_REFERENCES_PUBLIC_ID
const VITE_RSC_CLIENT_REFERENCES_PUBLIC_ID = 'virtual:vite-rsc/client-references'
const VITE_RSC_CLIENT_REFERENCES_ID = '\0' + VITE_RSC_CLIENT_REFERENCES_PUBLIC_ID
const RESOLVED_ID_PROXY_PREFIX = 'virtual:vite-rsc/resolved-id/'

export type RscClientReferenceMeta = {
  groupChunkId?: string
  importId: string
  referenceKey: string
  renderedExports: string[]
  serverChunk?: unknown
}

export type RscClientReferenceManifest = Record<string, RscClientReferenceMeta>

type RscPluginApi = {
  manager?: {
    clientReferenceRegistry: RscClientReferenceManifest
    isScanBuild?: boolean
  }
}

type RscPluginWithApi = Plugin & {
  api?: RscPluginApi
}

function readRscPluginApi(plugin: Plugin): RscPluginApi | undefined {
  const api = (plugin as RscPluginWithApi).api
  const manager = api?.manager
  return manager && typeof manager === 'object' && 'clientReferenceRegistry' in manager
    ? api
    : undefined
}

export function prepareRscClientReferenceMetas(
  manifest: RscClientReferenceManifest,
): AppClientReferenceLoaderMeta[] {
  const entries = Object.entries(manifest).filter(([, meta]) => meta.serverChunk)

  for (const [id, meta] of entries) {
    meta.groupChunkId = id
  }

  return entries.map(([, meta]) => ({
    importId: meta.importId,
    referenceKey: meta.referenceKey,
    exportedNames: meta.renderedExports,
  }))
}

function generateClientReferenceLoadersFromManager(
  manager: NonNullable<RscPluginApi['manager']> | undefined,
): string | null {
  if (!manager || manager.isScanBuild) return null

  const metas = prepareRscClientReferenceMetas(manager.clientReferenceRegistry)
  if (metas.length === 0) return null

  return generateAppClientReferenceLoaders(metas, {
    resolvedIdProxyPrefix: RESOLVED_ID_PROXY_PREFIX,
  })
}

export function createRscClientReferenceLoadersPlugin(): Plugin {
  let rscApi: RscPluginApi | undefined

  return {
    name: 'text:rsc-client-reference-loaders',
    enforce: 'post',
    configResolved(config) {
      rscApi = config.plugins.map(readRscPluginApi).find(Boolean)
    },
    resolveId(id) {
      if (id === TEXT_CLIENT_REFERENCES_PUBLIC_ID) {
        return TEXT_CLIENT_REFERENCES_ID
      }
      return null
    },
    load(id) {
      if (id !== TEXT_CLIENT_REFERENCES_ID) return null

      return generateClientReferenceLoadersFromManager(rscApi?.manager) ?? 'export default {};\n'
    },
    transform(_code, id) {
      if (id !== VITE_RSC_CLIENT_REFERENCES_ID) return null

      const code = generateClientReferenceLoadersFromManager(rscApi?.manager)
      if (!code) return null

      return {
        code,
        map: null,
      }
    },
  }
}
