import type { ComponentInstance, ComponentProps, RenderableInput } from './runtime-types'

export const RUE_ISLAND_ELEMENT = 'rue-island'
export const RUE_ISLAND_PROPS_SCRIPT_TYPE = 'application/json'
export const RUE_ISLAND_DESCRIPTOR = Symbol.for('rue.island.descriptor')
export const RUE_SERVER_ISLAND_DESCRIPTOR = Symbol.for('rue.server-island.descriptor')
export const RUE_SERVER_ISLAND_SSR_BRIDGE = Symbol.for('rue.server-island.ssr-bridge')

export type RueIslandHydrationStrategy =
  | 'load'
  | 'idle'
  | 'visible'
  | 'media'
  | 'interaction'
  | 'none'
  | 'only'

export interface RueIslandManifestEntry {
  id?: string
  component: string
  entry?: string
  exportName?: string
  hydrate?: RueIslandHydrationStrategy
  props?: string
  media?: string
  interaction?: string | string[]
  timeout?: number
  rootMargin?: string
}

export type RueIslandManifest = Record<string, RueIslandManifestEntry>

export interface RueIslandHtmlOptions {
  id: string
  component: string
  entry?: string
  exportName?: string
  hydrate?: RueIslandHydrationStrategy
  props?: unknown
  html?: string
  fallback?: string
  media?: string
  interaction?: string | string[]
  timeout?: number
  rootMargin?: string
}

export interface RueIslandDescriptorMetadata extends RueIslandManifestEntry {
  id: string
}

export interface RueIslandDescriptorOptions {
  component: ComponentInstance<any>
  props?: ComponentProps
  fallback?: RenderableInput
  metadata: RueIslandDescriptorMetadata
}

export interface RueIslandDescriptor {
  readonly [RUE_ISLAND_DESCRIPTOR]: true
  readonly component: ComponentInstance<any>
  readonly props: ComponentProps
  readonly fallback?: RenderableInput
  readonly metadata: Readonly<RueIslandDescriptorMetadata>
}

export const isRueIslandDescriptor = (value: unknown): value is RueIslandDescriptor =>
  typeof value === 'object' &&
  value !== null &&
  (value as Partial<RueIslandDescriptor>)[RUE_ISLAND_DESCRIPTOR] === true

export const createRueIslandDescriptor = (
  options: RueIslandDescriptorOptions,
): RueIslandDescriptor =>
  Object.freeze({
    [RUE_ISLAND_DESCRIPTOR]: true as const,
    component: options.component,
    props: options.props ?? {},
    fallback: options.fallback,
    metadata: Object.freeze({ ...options.metadata }),
  })

export interface RueServerIslandDescriptorOptions {
  id: string
  props?: ComponentProps
  fallback?: RenderableInput
}

export interface RueServerIslandDescriptor {
  readonly [RUE_SERVER_ISLAND_DESCRIPTOR]: true
  readonly id: string
  readonly props: ComponentProps
  readonly fallback?: RenderableInput
}

export const isRueServerIslandDescriptor = (value: unknown): value is RueServerIslandDescriptor =>
  typeof value === 'object' &&
  value !== null &&
  (value as Partial<RueServerIslandDescriptor>)[RUE_SERVER_ISLAND_DESCRIPTOR] === true

export const createRueServerIslandDescriptor = (
  options: RueServerIslandDescriptorOptions,
): RueServerIslandDescriptor => {
  if (!options.id) {
    throw new TypeError('Rue server island descriptor requires a non-empty id.')
  }

  return Object.freeze({
    [RUE_SERVER_ISLAND_DESCRIPTOR]: true as const,
    id: options.id,
    props: options.props ?? {},
    fallback: options.fallback,
  })
}

const RUE_SERIALIZED_TYPE_KEY = '__rueType'
const RUE_SERIALIZED_VALUE_KEY = 'value'

const createSerializedValue = (type: string, value: unknown) => ({
  [RUE_SERIALIZED_TYPE_KEY]: type,
  [RUE_SERIALIZED_VALUE_KEY]: value,
})

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const toSerializableValue = (value: unknown, seen: WeakSet<object>, path: string): unknown => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    if (Number.isNaN(value)) {
      throw new TypeError(`Rue island props cannot serialize non-finite number at ${path}.`)
    }
    if (value === Infinity || value === -Infinity) {
      return createSerializedValue('Infinity', value === Infinity ? 'positive' : 'negative')
    }
    return value
  }

  if (value === undefined) {
    throw new TypeError(`Rue island props cannot serialize undefined at ${path}.`)
  }

  if (typeof value === 'bigint') {
    return createSerializedValue('BigInt', value.toString())
  }

  if (typeof value === 'function' || typeof value === 'symbol') {
    throw new TypeError(`Rue island props cannot serialize ${typeof value} at ${path}.`)
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new TypeError(`Rue island props cannot serialize invalid Date at ${path}.`)
    }
    return createSerializedValue('Date', value.toISOString())
  }

  if (typeof URL !== 'undefined' && value instanceof URL) {
    return createSerializedValue('URL', value.href)
  }

  if (typeof value !== 'object' || value === null) {
    return value
  }

  if (seen.has(value)) {
    throw new TypeError(`Rue island props cannot serialize circular reference at ${path}.`)
  }
  seen.add(value)

  if (value instanceof Map) {
    const entries = Array.from(value.entries(), ([key, entry], index) => [
      toSerializableValue(key, seen, `${path}.map[${index}][0]`),
      toSerializableValue(entry, seen, `${path}.map[${index}][1]`),
    ])
    seen.delete(value)
    return createSerializedValue('Map', entries)
  }

  if (value instanceof Set) {
    const entries = Array.from(value.values(), (entry, index) =>
      toSerializableValue(entry, seen, `${path}.set[${index}]`),
    )
    seen.delete(value)
    return createSerializedValue('Set', entries)
  }

  if (value instanceof RegExp) {
    seen.delete(value)
    return createSerializedValue('RegExp', { source: value.source, flags: value.flags })
  }

  if (value instanceof Uint8Array) {
    seen.delete(value)
    return createSerializedValue('Uint8Array', Array.from(value))
  }

  if (value instanceof Uint16Array) {
    seen.delete(value)
    return createSerializedValue('Uint16Array', Array.from(value))
  }

  if (value instanceof Uint32Array) {
    seen.delete(value)
    return createSerializedValue('Uint32Array', Array.from(value))
  }

  if (Array.isArray(value)) {
    const serialized = value.map((item, index) =>
      toSerializableValue(item, seen, `${path}[${index}]`),
    )
    seen.delete(value)
    return serialized
  }

  if (!isPlainObject(value)) {
    const ctor = (value as { constructor?: { name?: string } }).constructor?.name || 'object'
    throw new TypeError(`Rue island props cannot serialize ${ctor} instance at ${path}.`)
  }

  if (Object.prototype.hasOwnProperty.call(value, RUE_SERIALIZED_TYPE_KEY)) {
    throw new TypeError(`Rue island props cannot serialize reserved type tag at ${path}.`)
  }

  const serialized: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    serialized[key] = toSerializableValue(entry, seen, `${path}.${key}`)
  }
  seen.delete(value)
  return serialized
}

const fromSerializableValue = (_key: string, value: unknown) => {
  if (!isPlainObject(value)) {
    return value
  }

  if (!Object.prototype.hasOwnProperty.call(value, RUE_SERIALIZED_TYPE_KEY)) {
    return value
  }

  const type = value[RUE_SERIALIZED_TYPE_KEY]
  const raw = value[RUE_SERIALIZED_VALUE_KEY]
  const keys = Object.keys(value)
  if (
    typeof type !== 'string' ||
    keys.length !== 2 ||
    !Object.prototype.hasOwnProperty.call(value, RUE_SERIALIZED_VALUE_KEY)
  ) {
    throw new TypeError('Rue island props contain an invalid serialized type envelope.')
  }

  switch (type) {
    case 'Date': {
      if (typeof raw !== 'string') throw new TypeError('Rue island props contain an invalid Date.')
      const date = new Date(raw)
      if (Number.isNaN(date.getTime()) || date.toISOString() !== raw) {
        throw new TypeError('Rue island props contain an invalid Date.')
      }
      return date
    }
    case 'URL': {
      if (typeof raw !== 'string') throw new TypeError('Rue island props contain an invalid URL.')
      try {
        return new URL(raw)
      } catch {
        throw new TypeError('Rue island props contain an invalid URL.')
      }
    }
    case 'BigInt':
      if (typeof raw !== 'string' || !/^-?(?:0|[1-9]\d*)$/.test(raw)) {
        throw new TypeError('Rue island props contain an invalid BigInt.')
      }
      return BigInt(raw)
    case 'Infinity':
      if (raw !== 'positive' && raw !== 'negative') {
        throw new TypeError('Rue island props contain an invalid Infinity value.')
      }
      return raw === 'positive' ? Infinity : -Infinity
    case 'Map':
      if (!Array.isArray(raw) || raw.some(entry => !Array.isArray(entry) || entry.length !== 2)) {
        throw new TypeError('Rue island props contain an invalid Map.')
      }
      return new Map(raw as Array<[unknown, unknown]>)
    case 'Set':
      if (!Array.isArray(raw)) throw new TypeError('Rue island props contain an invalid Set.')
      return new Set(raw)
    case 'RegExp': {
      if (
        !isPlainObject(raw) ||
        Object.keys(raw).length !== 2 ||
        typeof raw.source !== 'string' ||
        typeof raw.flags !== 'string'
      ) {
        throw new TypeError('Rue island props contain an invalid RegExp.')
      }
      try {
        return new RegExp(raw.source, raw.flags)
      } catch {
        throw new TypeError('Rue island props contain an invalid RegExp.')
      }
    }
    case 'Uint8Array':
      return deserializeUnsignedIntegerArray(raw, 255, Uint8Array, type)
    case 'Uint16Array':
      return deserializeUnsignedIntegerArray(raw, 65535, Uint16Array, type)
    case 'Uint32Array':
      return deserializeUnsignedIntegerArray(raw, 4294967295, Uint32Array, type)
    default:
      throw new TypeError(`Rue island props contain unknown serialized type ${type}.`)
  }
}

const deserializeUnsignedIntegerArray = <T extends Uint8Array | Uint16Array | Uint32Array>(
  value: unknown,
  maximum: number,
  Constructor: new (values: number[]) => T,
  type: string,
): T => {
  if (
    !Array.isArray(value) ||
    value.some(
      entry =>
        typeof entry !== 'number' || !Number.isInteger(entry) || entry < 0 || entry > maximum,
    )
  ) {
    throw new TypeError(`Rue island props contain an invalid ${type}.`)
  }
  return new Constructor(value)
}

export const escapeIslandJson = (json: string) =>
  json
    .replace(/&/g, '\\u0026')
    .replace(/</g, '\\u003C')
    .replace(/>/g, '\\u003E')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')

export const escapeIslandAttribute = (value: string) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

export const serializeIslandProps = (value: unknown) =>
  escapeIslandJson(JSON.stringify(toSerializableValue(value, new WeakSet(), '$')))

export const deserializeIslandProps = (serialized: string): ComponentProps =>
  JSON.parse(serialized || '{}', fromSerializableValue) as ComponentProps
