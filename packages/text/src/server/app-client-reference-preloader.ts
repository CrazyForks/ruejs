export type ClientReferenceRequire = (id: string) => Promise<unknown>
export type ClientReferenceLoader = () => Promise<unknown> | unknown

export type ClientReferenceMap = Readonly<Record<string, ClientReferenceLoader | unknown>>

export type ClientReferencePreloaderOptions = {
  getReferences: () => ClientReferenceMap | undefined
  getClientRequire: () => ClientReferenceRequire | undefined
  onPreloadError?: (id: string, error: unknown) => void
}

export type ClientReferencePreloader = {
  preload: (referenceIds?: Iterable<string>) => Promise<void>
}

const resolvedPreload = Promise.resolve()

export function createClientReferencePreloader(
  options: ClientReferencePreloaderOptions,
): ClientReferencePreloader {
  let allReferencesPreloaded = false
  let allReferencesPreloadPromise: Promise<void> | null = null
  const preloadedReferences = new Set<string>()
  const referencePreloadPromises = new Map<string, Promise<void>>()

  function preloadReference(
    id: string,
    reference: unknown,
    clientRequire: ClientReferenceRequire | undefined,
  ): Promise<void> {
    if (preloadedReferences.has(id)) {
      return resolvedPreload
    }

    const existing = referencePreloadPromises.get(id)
    if (existing) {
      return existing
    }

    const pending: Promise<unknown>[] = []
    if (clientRequire) {
      pending.push(clientRequire(id))
    }
    if (typeof reference === 'function') {
      pending.push(Promise.resolve((reference as ClientReferenceLoader)()))
    }
    if (pending.length === 0) {
      return resolvedPreload
    }

    const preloadPromise = Promise.all(pending)
      .catch(error => {
        options.onPreloadError?.(id, error)
      })
      .then(() => {
        preloadedReferences.add(id)
      })
      .finally(() => {
        referencePreloadPromises.delete(id)
      })

    referencePreloadPromises.set(id, preloadPromise)
    return preloadPromise
  }

  function preloadReferenceSet(
    referenceIds: Iterable<string>,
    refs: ClientReferenceMap,
    clientRequire: ClientReferenceRequire | undefined,
  ): Promise<void> | null {
    const pending: Promise<void>[] = []

    for (const id of referenceIds) {
      if (Object.hasOwn(refs, id)) {
        const reference = refs[id]
        if (clientRequire || typeof reference === 'function') {
          pending.push(preloadReference(id, reference, clientRequire))
        }
      }
    }

    if (pending.length === 0) {
      return null
    }

    return Promise.all(pending).then(() => {})
  }

  return {
    preload(referenceIds) {
      const refs = options.getReferences()
      const clientRequire = options.getClientRequire()
      if (!refs) {
        return resolvedPreload
      }

      if (referenceIds) {
        return preloadReferenceSet(referenceIds, refs, clientRequire) ?? resolvedPreload
      }

      if (allReferencesPreloaded) {
        return resolvedPreload
      }
      if (allReferencesPreloadPromise) {
        return allReferencesPreloadPromise
      }

      const preloadPromise = preloadReferenceSet(Object.keys(refs), refs, clientRequire)
      if (!preloadPromise) {
        return resolvedPreload
      }

      allReferencesPreloadPromise = preloadPromise
        .then(() => {
          allReferencesPreloaded = true
        })
        .finally(() => {
          allReferencesPreloadPromise = null
        })

      return allReferencesPreloadPromise
    },
  }
}
