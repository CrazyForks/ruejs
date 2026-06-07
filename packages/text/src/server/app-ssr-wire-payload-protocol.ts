import type { AppWireElements } from './app-elements.js'
import type { AppSsrPayloadDecoder } from './app-ssr-payload-reader-core.js'

export const APP_SSR_WIRE_PAYLOAD_CONTENT_TYPE =
  'application/vnd.rue.text.app-wire+json; charset=utf-8'

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

function createNonSerializableAppWirePayloadError(path: string, reason: string): Error {
  return new Error(`[text] App SSR wire payload cannot encode ${path}: ${reason}`)
}

function formatObjectPath(parentPath: string, key: string): string {
  return parentPath === '$' ? `$.${key}` : `${parentPath}.${key}`
}

function formatArrayPath(parentPath: string, index: number): string {
  return `${parentPath}[${index}]`
}

function isPlainJsonObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function assertJsonWireValue(
  value: unknown,
  path: string,
  seen: WeakSet<object>,
): asserts value is AppWireElements[keyof AppWireElements] {
  if (value === null) return

  switch (typeof value) {
    case 'string':
    case 'boolean':
      return
    case 'number':
      if (Number.isFinite(value)) return
      throw createNonSerializableAppWirePayloadError(path, 'non-finite numbers are not supported')
    case 'undefined':
      throw createNonSerializableAppWirePayloadError(path, 'undefined is not supported')
    case 'bigint':
      throw createNonSerializableAppWirePayloadError(path, 'bigint values are not supported')
    case 'function':
      throw createNonSerializableAppWirePayloadError(path, 'function values are not supported')
    case 'symbol':
      throw createNonSerializableAppWirePayloadError(path, 'symbol values are not supported')
    case 'object':
      break
  }

  if (seen.has(value)) {
    throw createNonSerializableAppWirePayloadError(path, 'cyclic objects are not supported')
  }
  seen.add(value)

  try {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        assertJsonWireValue(value[index], formatArrayPath(path, index), seen)
      }
      return
    }

    if (!isPlainJsonObject(value)) {
      throw createNonSerializableAppWirePayloadError(path, 'non-plain objects are not supported')
    }

    for (const [key, childValue] of Object.entries(value)) {
      assertJsonWireValue(childValue, formatObjectPath(path, key), seen)
    }
  } finally {
    seen.delete(value)
  }
}

function assertAppWirePayloadRecord(value: unknown): asserts value is AppWireElements {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    !isPlainJsonObject(value)
  ) {
    throw new Error('[text] App SSR wire payload must be an object record')
  }

  assertJsonWireValue(value, '$', new WeakSet())
}

export function encodeAppSsrWirePayload(payload: AppWireElements): Uint8Array {
  assertAppWirePayloadRecord(payload)
  return textEncoder.encode(JSON.stringify(payload))
}

export function renderAppSsrWirePayloadToReadableStream(
  payload: AppWireElements,
): ReadableStream<Uint8Array> {
  const encoded = encodeAppSsrWirePayload(payload)
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoded)
      controller.close()
    },
  })
}

async function readUtf8Stream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader()
  let text = ''

  try {
    while (true) {
      const result = await reader.read()
      if (result.done) {
        text += textDecoder.decode()
        return text
      }
      text += textDecoder.decode(result.value, { stream: true })
    }
  } finally {
    reader.releaseLock()
  }
}

export async function decodeAppSsrWirePayloadStream(
  stream: ReadableStream<Uint8Array>,
): Promise<AppWireElements> {
  let parsed: unknown

  try {
    parsed = JSON.parse(await readUtf8Stream(stream))
  } catch (error) {
    throw new Error('[text] App SSR wire payload must be valid JSON', { cause: error })
  }

  assertAppWirePayloadRecord(parsed)
  return parsed
}

export function createAppSsrWirePayloadDecoder(): AppSsrPayloadDecoder {
  return decodeAppSsrWirePayloadStream
}
