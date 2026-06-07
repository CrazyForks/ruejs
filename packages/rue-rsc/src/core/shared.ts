// use special prefix to switch client/server reference loading inside __webpack_require__
export const SERVER_REFERENCE_PREFIX = '$$server:'

export const SERVER_DECODE_CLIENT_PREFIX = '$$decode-client:'

export type RueClientReferenceModule = Record<string, unknown>
export type RueClientReferenceLoader = () => Promise<unknown> | unknown
export type RueClientReferenceLoaders = Readonly<Record<string, RueClientReferenceLoader>>
export type RueClientReferenceFallbackLoader = (id: string) => Promise<unknown> | unknown

type RueClientReferenceRegistry = {
  fallbackLoader?: RueClientReferenceFallbackLoader
  loaders: Record<string, RueClientReferenceLoader>
  modules: Map<string, unknown>
  promises: Map<string, Promise<unknown>>
}

const RUE_CLIENT_REFERENCE_REGISTRY_KEY = Symbol.for('rue.client.reference.registry')
const RUE_RSC_CLIENT_REQUIRE_KEY = '__rue_rsc_client_require__'
const VITE_RSC_CLIENT_REQUIRE_KEY = '__vite_rsc_client_require__'

// cache bust memoized require promise during dev
export function createReferenceCacheTag(): string {
  const cache = Math.random().toString(36).slice(2)
  return '$$cache=' + cache
}

export function removeReferenceCacheTag(id: string): string {
  return id.split('$$cache=')[0]!
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}

function readRueClientReferenceRegistry(): RueClientReferenceRegistry {
  const globalState = globalThis as typeof globalThis & Record<symbol, unknown>
  const existing = globalState[RUE_CLIENT_REFERENCE_REGISTRY_KEY]
  if (existing && typeof existing === 'object') {
    return existing as RueClientReferenceRegistry
  }

  const registry: RueClientReferenceRegistry = {
    loaders: {},
    modules: new Map(),
    promises: new Map(),
  }
  globalState[RUE_CLIENT_REFERENCE_REGISTRY_KEY] = registry
  return registry
}

export function registerRueClientReferenceLoaders(loaders: RueClientReferenceLoaders): void {
  const registry = readRueClientReferenceRegistry()
  for (const [id, loader] of Object.entries(loaders)) {
    registry.loaders[removeReferenceCacheTag(id)] = loader
  }
}

export function setRueClientReferenceFallbackLoader(load: RueClientReferenceFallbackLoader): void {
  readRueClientReferenceRegistry().fallbackLoader = load
}

export function loadRueClientReferenceModule(id: string): unknown {
  const referenceKey = removeReferenceCacheTag(id)
  const registry = readRueClientReferenceRegistry()

  if (registry.modules.has(referenceKey)) {
    return registry.modules.get(referenceKey)
  }

  const existing = registry.promises.get(referenceKey)
  if (existing) return existing

  const loader = registry.loaders[referenceKey]
  const loaded = loader
    ? loader()
    : registry.fallbackLoader
      ? registry.fallbackLoader(referenceKey)
      : undefined

  if (loaded === undefined) {
    throw new Error(`[rue-rsc] client reference not found '${referenceKey}'`)
  }

  if (isThenable(loaded)) {
    const promise = Promise.resolve(loaded)
      .then(mod => {
        registry.modules.set(referenceKey, mod)
        return mod
      })
      .finally(() => {
        registry.promises.delete(referenceKey)
      })
    registry.promises.set(referenceKey, promise)
    return promise
  }

  registry.modules.set(referenceKey, loaded)
  return loaded
}

export function resolveRueClientReferenceExport(referenceKey: string, exportName: string): unknown {
  const loaded = loadRueClientReferenceModule(referenceKey)
  const resolve = (mod: unknown) => {
    if (mod && typeof mod === 'object' && Object.hasOwn(mod, exportName)) {
      return (mod as Record<string, unknown>)[exportName]
    }
    throw new Error(`[rue-rsc] client reference '${referenceKey}' does not export '${exportName}'`)
  }
  return isThenable(loaded) ? Promise.resolve(loaded).then(resolve) : resolve(loaded)
}

export function preloadRueClientReferences(referenceKeys?: Iterable<string>): Promise<void> {
  const registry = readRueClientReferenceRegistry()
  const keys = referenceKeys
    ? Array.from(referenceKeys, removeReferenceCacheTag)
    : Object.keys(registry.loaders)
  return Promise.all(
    keys.map(id => Promise.resolve(loadRueClientReferenceModule(id)).then(() => {})),
  ).then(() => {})
}

export function installRueClientReferenceRequire(): void {
  const globalState = globalThis as typeof globalThis & Record<string, unknown>
  const load = (id: string) => loadRueClientReferenceModule(id)
  globalState[RUE_RSC_CLIENT_REQUIRE_KEY] = load
  globalState[VITE_RSC_CLIENT_REQUIRE_KEY] = load
}

export function setInternalRequire(): void {
  // branch client and server require to support the case when ssr and rsc share the same global
  ;(globalThis as any).__vite_rsc_require__ = (id: string) => {
    if (id.startsWith(SERVER_REFERENCE_PREFIX)) {
      id = id.slice(SERVER_REFERENCE_PREFIX.length)
      return (globalThis as any).__vite_rsc_server_require__(id)
    }
    return loadRueClientReferenceModule(id)
  }
}
