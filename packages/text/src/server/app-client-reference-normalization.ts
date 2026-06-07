import { AppRscServerClientReferenceSymbol } from './app-rsc-client-reference-protocol-core.js'

type AppClientReferenceTransportValue = {
  $rue: 'clientReference'
  exportName: string
  id?: string
  referenceKey: string
}

function readDecodedClientReference(value: unknown): AppClientReferenceTransportValue | null {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return null
  const record = value as {
    $$exportName?: unknown
    $$id?: unknown
    $$referenceKey?: unknown
    $$typeof?: unknown
    $rue?: unknown
  }
  if (record.$rue === 'clientReference') return null
  if (record.$$typeof !== AppRscServerClientReferenceSymbol) return null

  const id = typeof record.$$id === 'string' ? record.$$id : null
  const separator = id?.lastIndexOf('#') ?? -1
  const referenceKey =
    typeof record.$$referenceKey === 'string'
      ? record.$$referenceKey
      : id && separator > 0
        ? id.slice(0, separator)
        : null
  if (!referenceKey) return null

  const exportName =
    typeof record.$$exportName === 'string'
      ? record.$$exportName
      : id && separator > -1
        ? id.slice(separator + 1)
        : 'default'

  return {
    $rue: 'clientReference',
    exportName,
    ...(id ? { id } : {}),
    referenceKey,
  }
}

function normalizeClientReferences(value: unknown, seen: WeakMap<object, unknown>): unknown {
  const clientReference = readDecodedClientReference(value)
  if (clientReference) return clientReference

  if (typeof value !== 'object' || value === null) return value
  if (seen.has(value)) return seen.get(value)

  if (Array.isArray(value)) {
    let changed = false
    const normalizedArray: unknown[] = []
    seen.set(value, normalizedArray)
    for (const item of value) {
      const normalizedItem = normalizeClientReferences(item, seen)
      normalizedArray.push(normalizedItem)
      if (normalizedItem !== item) changed = true
    }
    if (!changed) {
      seen.set(value, value)
      return value
    }
    return normalizedArray
  }

  let changed = false
  const descriptors = Object.getOwnPropertyDescriptors(value)
  const normalizedDescriptors: PropertyDescriptorMap = {}
  const normalizedObject = Object.create(Object.getPrototypeOf(value)) as object
  seen.set(value, normalizedObject)

  for (const key of Reflect.ownKeys(descriptors)) {
    const descriptor = descriptors[key]
    if ('value' in descriptor) {
      const normalizedValue = normalizeClientReferences(descriptor.value, seen)
      normalizedDescriptors[key] =
        normalizedValue === descriptor.value
          ? descriptor
          : {
              ...descriptor,
              value: normalizedValue,
            }
      if (normalizedValue !== descriptor.value) changed = true
      continue
    }
    normalizedDescriptors[key] = descriptor
  }

  if (!changed) {
    seen.set(value, value)
    return value
  }

  Object.defineProperties(normalizedObject, normalizedDescriptors)
  return normalizedObject
}

export function normalizeAppClientReferences<T>(value: T): T {
  return normalizeClientReferences(value, new WeakMap()) as T
}
