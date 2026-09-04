import clientReferences, { clientReferenceMetadata } from 'virtual:text-rsc/client-references'
import * as appRouterScrollShim from '../shims/app-router-scroll.js'
import * as errorBoundaryShim from '../shims/error-boundary.js'
import * as layoutSegmentContextShim from '../shims/layout-segment-context-core.js'
import LinkShimDefault from '../shims/link.js'
import * as linkShim from '../shims/link.js'
import * as slotShim from '../shims/slot-core.js'
import { setAppClientReferenceResolver } from './app-client-reference-resolver.js'
import {
  createAppRscSsrRuntimeProtocol,
  type AppRscSsrRuntimeProtocol,
} from './app-rsc-ssr-runtime-protocol-core.js'
import type { AppRscPluginRuntime } from './app-rsc-plugin-runtime.js'

type CompatClientReferenceLoaders = Readonly<
  Record<string, () => Promise<Record<string, unknown>> | Record<string, unknown>>
>
type CompatClientReferenceMetadata = Readonly<
  Record<string, { importId: string; referenceKey: string }>
>

const compatClientReferenceLoaders = clientReferences as CompatClientReferenceLoaders
const compatClientReferenceMetadata = (clientReferenceMetadata ??
  {}) as CompatClientReferenceMetadata
const COMPAT_CLIENT_REFERENCE_LOADERS_KEY = Symbol.for('text.compat.clientReferenceLoaders')
const COMPAT_CLIENT_REFERENCE_MODULES_KEY = Symbol.for('text.compat.clientReferenceModules')
const resolvedClientReferenceCache = new Map<string, PromiseLike<unknown> | unknown>()
const resolvedCompatClientReferenceModules = (() => {
  const globalState = globalThis as Record<symbol, unknown>
  const existing = globalState[COMPAT_CLIENT_REFERENCE_MODULES_KEY]
  if (existing instanceof Map) {
    return existing as Map<string, Record<string, unknown>>
  }
  const modules = new Map<string, Record<string, unknown>>()
  globalState[COMPAT_CLIENT_REFERENCE_MODULES_KEY] = modules
  return modules
})()
const APP_SSR_ERROR_BOUNDARY_EXPORT_NAMES = new Set([
  'ErrorBoundary',
  'ForbiddenBoundary',
  'NotFoundBoundary',
  'RedirectBoundary',
  'UnauthorizedBoundary',
])
const linkShimModule: Record<string, unknown> = { ...linkShim, default: LinkShimDefault }
const localSsrClientReferenceModules: readonly {
  match: string
  module: Record<string, unknown>
}[] = [
  {
    match: 'shims/slot',
    module: slotShim,
  },
  {
    match: 'shims/slot-core',
    module: slotShim,
  },
  {
    match: 'shims/layout-segment-context',
    module: layoutSegmentContextShim,
  },
  {
    match: 'shims/layout-segment-context-core',
    module: layoutSegmentContextShim,
  },
  {
    match: 'shims/link',
    module: linkShimModule,
  },
  {
    match: 'src/link',
    module: linkShimModule,
  },
  {
    match: 'text/link',
    module: linkShimModule,
  },
  {
    match: 'shims/error-boundary',
    module: errorBoundaryShim,
  },
  {
    match: 'shims/app-router-scroll',
    module: appRouterScrollShim,
  },
]

const preloadedCompatClientReferenceLoaders: CompatClientReferenceLoaders = Object.fromEntries(
  Object.entries(compatClientReferenceLoaders).map(([referenceKey, load]) => [
    referenceKey,
    () =>
      Promise.resolve(load()).then(module => {
        const resolvedModule = module as Record<string, unknown>
        resolvedCompatClientReferenceModules.set(referenceKey, resolvedModule)
        resolvedCompatClientReferenceModules.set(
          normalizeSsrClientReferenceKey(referenceKey),
          resolvedModule,
        )
        return resolvedModule
      }),
  ]),
)

const localSsrClientReferenceModulesByKey = new Map<string, Record<string, unknown>>()
for (const meta of Object.values(compatClientReferenceMetadata)) {
  const normalizedImportId = meta.importId.replaceAll('\\', '/')
  const localModule = localSsrClientReferenceModules.find(entry =>
    normalizedImportId.includes(entry.match),
  )?.module
  if (localModule) {
    localSsrClientReferenceModulesByKey.set(meta.referenceKey, localModule)
  }
}
for (const entry of localSsrClientReferenceModules) {
  for (const value of Object.values(entry.module)) {
    const referenceKey =
      value && (typeof value === 'object' || typeof value === 'function')
        ? (value as { $$referenceKey?: unknown }).$$referenceKey
        : undefined
    if (typeof referenceKey === 'string') {
      localSsrClientReferenceModulesByKey.set(referenceKey, entry.module)
    }
  }
}

function readGlobalCompatClientReferenceLoaders(): CompatClientReferenceLoaders {
  const registry = (globalThis as Record<symbol, unknown>)[COMPAT_CLIENT_REFERENCE_LOADERS_KEY]
  return registry && typeof registry === 'object' ? (registry as CompatClientReferenceLoaders) : {}
}

function registerGlobalCompatClientReferenceLoaders(loaders: CompatClientReferenceLoaders): void {
  if (Object.keys(loaders).length === 0) return
  const existing = readGlobalCompatClientReferenceLoaders()
  ;(globalThis as Record<symbol, unknown>)[COMPAT_CLIENT_REFERENCE_LOADERS_KEY] = {
    ...existing,
    ...loaders,
  }
}

registerGlobalCompatClientReferenceLoaders(preloadedCompatClientReferenceLoaders)

function normalizeSsrClientReferenceKey(referenceKey: string): string {
  return referenceKey.replace(/\$\$cache=[^?#]+/g, '')
}

function resolveLocalSsrClientReference(
  referenceKey: string,
  exportName: string,
): { found: boolean; value?: unknown } {
  const normalizedReferenceKey = normalizeSsrClientReferenceKey(referenceKey)
  const hashedModule =
    localSsrClientReferenceModulesByKey.get(referenceKey) ??
    localSsrClientReferenceModulesByKey.get(normalizedReferenceKey)
  if (hashedModule) {
    if (!Object.hasOwn(hashedModule, exportName)) {
      throw new Error(
        `[text] App client reference "${referenceKey}" does not export "${exportName}".`,
      )
    }
    return { found: true, value: hashedModule[exportName] }
  }
  for (const entry of localSsrClientReferenceModules) {
    if (normalizedReferenceKey.includes(entry.match)) {
      if (!Object.hasOwn(entry.module, exportName)) {
        throw new Error(
          `[text] App client reference "${referenceKey}" does not export "${exportName}".`,
        )
      }
      return { found: true, value: entry.module[exportName] }
    }
  }
  return { found: false }
}

function assertCompatEntry(entry: string): void {
  if (entry !== 'index') {
    throw new Error(`[text] Unsupported App RSC compat runtime entry "${entry}".`)
  }
}

function normalizeResolvedClientReferenceExport(exportName: string, value: unknown): unknown {
  if (
    typeof value === 'function' &&
    APP_SSR_ERROR_BOUNDARY_EXPORT_NAMES.has(exportName) &&
    !(value as { displayName?: unknown }).displayName
  ) {
    Object.defineProperty(value, 'displayName', {
      configurable: true,
      enumerable: false,
      value: exportName,
      writable: true,
    })
  }
  return value
}

function isServerClientReferenceStub(value: unknown): boolean {
  if (typeof value !== 'function') return false
  try {
    return Function.prototype.toString.call(value).includes('Unexpectedly client reference export')
  } catch {
    return false
  }
}

const compatAppRscPluginRuntime: AppRscPluginRuntime = {
  loadBootstrapScriptContent(entry) {
    assertCompatEntry(entry)
    // @ts-expect-error - plugin-rsc rewrites this compat hook at transform time.
    return import.meta.viteRsc.loadBootstrapScriptContent('index')
  },
  loadModule(environment, entry) {
    assertCompatEntry(entry)
    if (environment === 'rsc') {
      // @ts-expect-error - plugin-rsc rewrites this compat hook at transform time.
      return import.meta.viteRsc.loadModule('rsc', 'index')
    }
    // @ts-expect-error - plugin-rsc rewrites this compat hook at transform time.
    return import.meta.viteRsc.loadModule('ssr', 'index')
  },
}

export function installCompatAppClientReferenceResolver(): void {
  setAppClientReferenceResolver((referenceKey, exportName) => {
    const cacheKey = `${referenceKey}#${exportName}`
    if (resolvedClientReferenceCache.has(cacheKey)) {
      return resolvedClientReferenceCache.get(cacheKey) ?? null
    }

    const localReference = resolveLocalSsrClientReference(referenceKey, exportName)
    if (localReference.found) {
      const resolved = normalizeResolvedClientReferenceExport(exportName, localReference.value)
      resolvedClientReferenceCache.set(cacheKey, resolved)
      return resolved
    }

    const resolveExport = (mod: Record<string, unknown>) => {
      if (!Object.hasOwn(mod, exportName)) {
        throw new Error(
          `[text] App client reference "${referenceKey}" does not export "${exportName}".`,
        )
      }
      return normalizeResolvedClientReferenceExport(exportName, mod[exportName])
    }

    const resolveClientRequireReference = () => {
      const clientRequire =
        globalThis.__rue_rsc_client_require__ ?? globalThis.__vite_rsc_client_require__
      if (!clientRequire) return null
      const loaded = clientRequire(referenceKey)
      const resolveClientRequire = (mod: unknown) => {
        if (mod && typeof mod === 'object' && Object.hasOwn(mod, exportName)) {
          return normalizeResolvedClientReferenceExport(
            exportName,
            (mod as Record<string, unknown>)[exportName],
          )
        }
        return null
      }
      return Promise.resolve(loaded).then(resolveClientRequire, () => null)
    }

    const loadCompatReference = () => {
      const normalizedReferenceKey = normalizeSsrClientReferenceKey(referenceKey)
      const preloadedModule =
        resolvedCompatClientReferenceModules.get(referenceKey) ??
        resolvedCompatClientReferenceModules.get(normalizedReferenceKey)
      if (preloadedModule) {
        return resolveExport(preloadedModule)
      }
      const load =
        preloadedCompatClientReferenceLoaders[referenceKey] ??
        preloadedCompatClientReferenceLoaders[normalizedReferenceKey] ??
        readGlobalCompatClientReferenceLoaders()[referenceKey] ??
        readGlobalCompatClientReferenceLoaders()[normalizedReferenceKey]
      const loaded = load
        ? load()
        : import(
            /* @vite-ignore */
            referenceKey
          )
      const resolveCompat = (mod: Record<string, unknown>) => {
        const compatValue = resolveExport(mod)
        if (!isServerClientReferenceStub(compatValue)) {
          return compatValue
        }
        const clientRequireValue = resolveClientRequireReference()
        if (!clientRequireValue) return compatValue
        return Promise.resolve(clientRequireValue).then(value => value ?? compatValue)
      }
      if (loaded && typeof (loaded as { then?: unknown }).then === 'function') {
        return Promise.resolve(loaded).then(mod => resolveCompat(mod as Record<string, unknown>))
      }
      return resolveCompat(loaded as Record<string, unknown>)
    }

    const resolved = loadCompatReference()
    if (resolved && typeof (resolved as { then?: unknown }).then === 'function') {
      const pending = Promise.resolve(resolved).then(
        value => {
          resolvedClientReferenceCache.set(cacheKey, value)
          return value
        },
        error => {
          resolvedClientReferenceCache.delete(cacheKey)
          throw error
        },
      )
      resolvedClientReferenceCache.set(cacheKey, pending)
      return pending
    }
    resolvedClientReferenceCache.set(cacheKey, resolved)
    return resolved
  })
}

export function createCompatAppRscSsrRuntimeProtocol(): AppRscSsrRuntimeProtocol {
  return createAppRscSsrRuntimeProtocol({
    getClientReferences() {
      return preloadedCompatClientReferenceLoaders
    },
    getClientRequire() {
      return undefined
    },
    getRuntime() {
      return compatAppRscPluginRuntime
    },
    onPreloadError(id, error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[text] failed to preload client ref:', id, error)
      }
    },
  })
}

export const compatAppRscSsrRuntimeProtocol = createCompatAppRscSsrRuntimeProtocol()
