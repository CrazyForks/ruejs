import { ImageResponse as VercelImageResponse } from '@vercel/og'
import type { ImageResponseOptions } from '@vercel/og'
import type { TextElement } from '../runtime/render-protocol.js'

const RUE_PROTOCOL_ELEMENT_SYMBOL = Symbol.for('rue.transitional.element')
const LEGACY_RUE_PROTOCOL_ELEMENT_SYMBOL = Symbol.for('rue.element')
const RUE_COMPONENT_TYPE_KEY = '__rue_component_type'
const RUE_ELEMENT_HEAD_RECORD = Symbol.for('rue.element.head-record')

const CACHE_HEADERS = {
  noCache: 'no-cache, no-store',
  revalidate: 'public, max-age=0, must-revalidate',
} as const

/**
 * text/og shim.
 *
 * The text:og-inline-fetch-assets Vite plugin patches @vercel/og's runtime
 * asset fetches so this wrapper can delegate image generation while preserving
 * Text.js's public ImageResponse headers and option merging semantics.
 */
export class ImageResponse extends Response {
  static displayName = 'ImageResponse'

  constructor(element: TextElement, options?: ImageResponseOptions) {
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        const imageResponse = new VercelImageResponse(toVercelOgElement(element) as any, options)
        if (!imageResponse.body) {
          controller.close()
          return
        }

        const reader = imageResponse.body.getReader()
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            controller.close()
            return
          }
          controller.enqueue(value)
        }
      },
    })

    const headers = new Headers({
      'content-type': 'image/png',
      'cache-control':
        process.env.NODE_ENV === 'development' ? CACHE_HEADERS.noCache : CACHE_HEADERS.revalidate,
    })
    if (options?.headers) {
      new Headers(options.headers).forEach((value, key) => {
        headers.set(key, value)
      })
    }

    super(readable, {
      headers,
      status: options?.status,
      statusText: options?.statusText,
    })
  }
}

export type { ImageResponseOptions } from '@vercel/og'

function toVercelOgElement(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(toVercelOgElement)
  }
  if (typeof value !== 'object' || value === null) {
    return value
  }

  const record = value as Record<PropertyKey, unknown>
  if (
    record.$$typeof === RUE_PROTOCOL_ELEMENT_SYMBOL ||
    record.$$typeof === LEGACY_RUE_PROTOCOL_ELEMENT_SYMBOL
  ) {
    return value
  }

  if (RUE_COMPONENT_TYPE_KEY in record) {
    const type = record[RUE_COMPONENT_TYPE_KEY]
    const props = normalizeElementProps(record.props)
    if (typeof type === 'function') {
      return toVercelOgElement(type(props))
    }
    if (typeof type === 'string') {
      return createVercelOgElement(type, props)
    }
  }

  const headRecord = record[RUE_ELEMENT_HEAD_RECORD]
  if (typeof headRecord === 'object' && headRecord !== null) {
    const head = headRecord as { key?: unknown; props?: unknown; type?: unknown }
    const props = normalizeElementProps(head.props)
    if (typeof head.type === 'function') {
      return toVercelOgElement(head.type(props))
    }
    if (typeof head.type === 'string') {
      return createVercelOgElement(head.type, props, head.key)
    }
  }

  return value
}

function createVercelOgElement(
  type: string,
  props: Record<string, unknown>,
  key: unknown = props.key ?? null,
): Record<string, unknown> {
  const normalizedProps = { ...props }
  if ('children' in normalizedProps) {
    normalizedProps.children = toVercelOgElement(normalizedProps.children)
  }
  return {
    $$typeof: RUE_PROTOCOL_ELEMENT_SYMBOL,
    key: key == null ? null : String(key),
    props: normalizedProps,
    ref: null,
    type,
  }
}

function normalizeElementProps(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}
