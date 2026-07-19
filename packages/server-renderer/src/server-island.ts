import { deserializeIslandProps, serializeIslandProps } from '@rue-js/runtime/island'
import type { ComponentProps } from '@rue-js/runtime'

export const RUE_SERVER_ISLAND_PAYLOAD_VERSION = 1 as const
export const RUE_SERVER_ISLAND_MAX_BODY_BYTES = 64 * 1024

export type ServerIslandKey = CryptoKey | Uint8Array

export interface ServerIslandEnvelope {
  v: typeof RUE_SERVER_ISLAND_PAYLOAD_VERSION
  id: string
  iv: string
  ciphertext: string
}

export interface EncodeServerIslandPayloadOptions {
  id: string
  props: unknown
  expiresAt: number
  key: ServerIslandKey
}

export interface DecodeServerIslandPayloadOptions {
  key: ServerIslandKey
  now?: number
}

export interface DecodedServerIslandPayload {
  v: typeof RUE_SERVER_ISLAND_PAYLOAD_VERSION
  id: string
  props: ComponentProps
  expiresAt: number
}

export type ServerIslandKeyResolver = (
  id: string,
  request: Request,
) => ServerIslandKey | null | Promise<ServerIslandKey | null>

export interface ServerIslandRenderContext<Component = unknown> {
  component: Component
  props: ComponentProps
  request: Request
}

export interface CreateServerIslandHandlerOptions<Component = unknown> {
  key: ServerIslandKey | ServerIslandKeyResolver
  resolve: (id: string, request: Request) => Component | null | Promise<Component | null>
  render: (
    context: ServerIslandRenderContext<Component>,
  ) => string | Response | Promise<string | Response>
  now?: () => number
  maxBodyBytes?: number
}

export class ServerIslandPayloadError extends Error {
  constructor(message = 'Invalid Rue server island payload.') {
    super(message)
    this.name = 'ServerIslandPayloadError'
  }
}

export class ServerIslandPayloadExpiredError extends ServerIslandPayloadError {
  constructor() {
    super('Rue server island payload has expired.')
    this.name = 'ServerIslandPayloadExpiredError'
  }
}

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder('utf-8', { fatal: true })

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function assertServerIslandId(id: unknown): asserts id is string {
  if (typeof id !== 'string' || id.length === 0 || id.length > 256) {
    throw new ServerIslandPayloadError()
  }
}

const isCryptoKey = (value: unknown): value is CryptoKey =>
  typeof CryptoKey !== 'undefined' && value instanceof CryptoKey

const resolveCryptoKey = async (key: ServerIslandKey, usage: KeyUsage) => {
  if (key instanceof Uint8Array) {
    if (key.byteLength !== 32) {
      throw new TypeError('Rue server island keys must be an exact 32-byte Uint8Array.')
    }
    return crypto.subtle.importKey('raw', new Uint8Array(key).buffer, { name: 'AES-GCM' }, false, [
      usage,
    ])
  }

  if (!isCryptoKey(key)) {
    throw new TypeError('Rue server island keys must be a CryptoKey or exact 32-byte Uint8Array.')
  }
  const algorithm = key.algorithm as KeyAlgorithm & { length?: number }
  if (algorithm.name !== 'AES-GCM' || algorithm.length !== 256 || !key.usages.includes(usage)) {
    throw new TypeError(`Rue server island CryptoKey must be AES-GCM-256 with ${usage} usage.`)
  }
  return key
}

const bytesToBase64Url = (bytes: Uint8Array) => {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const base64UrlToBytes = (value: unknown) => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new ServerIslandPayloadError()
  }
  try {
    const padding = (4 - (value.length % 4)) % 4
    const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padding))
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
    if (bytesToBase64Url(bytes) !== value) {
      throw new ServerIslandPayloadError()
    }
    return bytes
  } catch (error) {
    if (error instanceof ServerIslandPayloadError) throw error
    throw new ServerIslandPayloadError()
  }
}

const createAdditionalData = (version: number, id: string) =>
  textEncoder.encode(JSON.stringify([version, id]))

export const parseServerIslandEnvelope = (value: unknown): ServerIslandEnvelope => {
  if (!isPlainObject(value)) throw new ServerIslandPayloadError()
  const keys = Object.keys(value).sort()
  if (keys.join(',') !== 'ciphertext,id,iv,v') throw new ServerIslandPayloadError()
  if (value.v !== RUE_SERVER_ISLAND_PAYLOAD_VERSION) throw new ServerIslandPayloadError()
  assertServerIslandId(value.id)
  const iv = base64UrlToBytes(value.iv)
  const ciphertext = base64UrlToBytes(value.ciphertext)
  if (iv.byteLength !== 12 || ciphertext.byteLength < 16) {
    throw new ServerIslandPayloadError()
  }
  return {
    v: RUE_SERVER_ISLAND_PAYLOAD_VERSION,
    id: value.id,
    iv: value.iv as string,
    ciphertext: value.ciphertext as string,
  }
}

export const encodeServerIslandPayload = async (
  options: EncodeServerIslandPayloadOptions,
): Promise<ServerIslandEnvelope> => {
  assertServerIslandId(options.id)
  if (!Number.isSafeInteger(options.expiresAt) || options.expiresAt <= 0) {
    throw new TypeError('Rue server island expiresAt must be a positive safe integer timestamp.')
  }
  const key = await resolveCryptoKey(options.key, 'encrypt')
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = textEncoder.encode(
    JSON.stringify({
      v: RUE_SERVER_ISLAND_PAYLOAD_VERSION,
      id: options.id,
      props: serializeIslandProps(options.props),
      expiresAt: options.expiresAt,
    }),
  )
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: createAdditionalData(RUE_SERVER_ISLAND_PAYLOAD_VERSION, options.id),
      tagLength: 128,
    },
    key,
    plaintext,
  )
  return {
    v: RUE_SERVER_ISLAND_PAYLOAD_VERSION,
    id: options.id,
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
  }
}

export const decodeServerIslandPayload = async (
  input: unknown,
  options: DecodeServerIslandPayloadOptions,
): Promise<DecodedServerIslandPayload> => {
  const envelope = parseServerIslandEnvelope(input)
  const key = await resolveCryptoKey(options.key, 'decrypt')
  let plaintext: ArrayBuffer
  try {
    plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: base64UrlToBytes(envelope.iv),
        additionalData: createAdditionalData(envelope.v, envelope.id),
        tagLength: 128,
      },
      key,
      base64UrlToBytes(envelope.ciphertext),
    )
  } catch {
    throw new ServerIslandPayloadError()
  }

  let payload: unknown
  try {
    payload = JSON.parse(textDecoder.decode(plaintext))
  } catch {
    throw new ServerIslandPayloadError()
  }
  if (!isPlainObject(payload)) throw new ServerIslandPayloadError()
  if (Object.keys(payload).sort().join(',') !== 'expiresAt,id,props,v') {
    throw new ServerIslandPayloadError()
  }
  if (payload.v !== envelope.v || payload.id !== envelope.id) {
    throw new ServerIslandPayloadError()
  }
  if (!Number.isSafeInteger(payload.expiresAt) || (payload.expiresAt as number) <= 0) {
    throw new ServerIslandPayloadError()
  }
  const now = options.now ?? Date.now()
  if ((payload.expiresAt as number) <= now) {
    throw new ServerIslandPayloadExpiredError()
  }
  if (typeof payload.props !== 'string') throw new ServerIslandPayloadError()

  let props: ComponentProps
  try {
    props = deserializeIslandProps(payload.props)
  } catch {
    throw new ServerIslandPayloadError()
  }
  return {
    v: RUE_SERVER_ISLAND_PAYLOAD_VERSION,
    id: envelope.id,
    props,
    expiresAt: payload.expiresAt as number,
  }
}

const errorResponse = (status: number, message: string, headers?: HeadersInit) =>
  new Response(message, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', ...headers },
  })

const readLimitedBody = async (request: Request, maximum: number) => {
  const contentLength = request.headers.get('content-length')
  if (contentLength && Number(contentLength) > maximum) return null
  if (!request.body) return ''

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    length += value.byteLength
    if (length > maximum) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const body = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return textDecoder.decode(body)
  } catch {
    throw new ServerIslandPayloadError()
  }
}

export const createServerIslandHandler = <Component = unknown>(
  options: CreateServerIslandHandlerOptions<Component>,
) => {
  const maximum = options.maxBodyBytes ?? RUE_SERVER_ISLAND_MAX_BODY_BYTES
  if (!Number.isSafeInteger(maximum) || maximum <= 0) {
    throw new TypeError('Rue server island maxBodyBytes must be a positive safe integer.')
  }

  return async (request: Request): Promise<Response> => {
    let rawEnvelope: unknown
    if (request.method === 'GET') {
      const payload = new URL(request.url).searchParams.get('payload')
      if (!payload) return errorResponse(400, 'Invalid server island request.')
      try {
        rawEnvelope = JSON.parse(payload)
      } catch {
        return errorResponse(400, 'Invalid server island request.')
      }
    } else if (request.method === 'POST') {
      const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
      if (contentType !== 'application/json') {
        return errorResponse(400, 'Invalid server island request.')
      }
      let body: string | null
      try {
        body = await readLimitedBody(request, maximum)
      } catch {
        return errorResponse(400, 'Invalid server island request.')
      }
      if (body === null) return errorResponse(413, 'Server island request is too large.')
      try {
        rawEnvelope = JSON.parse(body)
      } catch {
        return errorResponse(400, 'Invalid server island request.')
      }
    } else {
      return errorResponse(405, 'Method not allowed.', { allow: 'GET, POST' })
    }

    let envelope: ServerIslandEnvelope
    try {
      envelope = parseServerIslandEnvelope(rawEnvelope)
    } catch {
      return errorResponse(400, 'Invalid server island request.')
    }

    const selectedKey =
      typeof options.key === 'function' ? await options.key(envelope.id, request) : options.key
    if (!selectedKey) return errorResponse(400, 'Invalid server island request.')

    let decoded: DecodedServerIslandPayload
    try {
      decoded = await decodeServerIslandPayload(envelope, {
        key: selectedKey,
        now: options.now?.(),
      })
    } catch (error) {
      if (error instanceof ServerIslandPayloadExpiredError) {
        return errorResponse(410, 'Server island request has expired.')
      }
      return errorResponse(400, 'Invalid server island request.')
    }

    const component = await options.resolve(decoded.id, request)
    if (component == null) return errorResponse(404, 'Server island not found.')

    const rendered = await options.render({ component, props: decoded.props, request })
    if (rendered instanceof Response) return rendered
    return new Response(rendered, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }
}
