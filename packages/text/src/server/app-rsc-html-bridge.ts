import type { TextNode as RueRenderableOutput } from '../runtime/render-protocol.js'
import type { TextCompatNode } from '../shims/text-compat-types.js'
import {
  cloneServerProtocolElement,
  createServerProtocolElement,
  isServerProtocolElement,
} from './element-protocol.js'
import { readAppSlotPlaceholderSentinel } from './app-slot-placeholder-protocol.js'
import { AppElementsWire } from './app-elements.js'
import { readCurrentSsrAppElementsFallback } from '../shims/slot-core.js'

type RueServerRenderer = (element: RueRenderableOutput) => Promise<string> | string
type RueServerRendererModule = {
  renderToString?: RueServerRenderer
  default?: {
    renderToString?: RueServerRenderer
  }
}

const RUE_ELEMENT_HEAD_RECORD = Symbol.for('rue.element.head-record')
const TEXT_HEAD_RECORD = Symbol.for('text.head.record')

function sanitizeAppSlotPlaceholdersForHtml(value: unknown): unknown {
  if (Array.isArray(value)) {
    let changed = false
    const nextValue = value.map(item => {
      const sanitized = sanitizeAppSlotPlaceholdersForHtml(item)
      if (sanitized !== item) changed = true
      return sanitized
    })
    return changed ? nextValue : value
  }

  if (isServerProtocolElement(value)) {
    if (readAppSlotPlaceholderSentinel(value.type, value.props)) {
      return null
    }

    const props = (value.props ?? {}) as Record<string, unknown>
    const nextProps = sanitizePropsAppSlotPlaceholdersForHtml(props)
    return nextProps === props ? value : cloneServerProtocolElement(value, nextProps)
  }

  if (typeof value !== 'object' || value === null) return value

  const props = (value as { props?: unknown }).props
  const nextProps =
    props && typeof props === 'object'
      ? sanitizePropsAppSlotPlaceholdersForHtml(props as Record<string, unknown>)
      : props

  const headRecord = Reflect.get(value, RUE_ELEMENT_HEAD_RECORD)
  const nextHeadRecord =
    headRecord &&
    typeof headRecord === 'object' &&
    Reflect.get(headRecord, TEXT_HEAD_RECORD) === true
      ? sanitizeRueElementHeadRecordForHtml(headRecord as Record<string | symbol, unknown>)
      : headRecord

  if (nextProps === props && nextHeadRecord === headRecord) return value

  const clone = { ...(value as Record<string, unknown>) }
  if (nextProps !== props) clone.props = nextProps
  if (nextHeadRecord !== headRecord) {
    Object.defineProperty(clone, RUE_ELEMENT_HEAD_RECORD, {
      configurable: true,
      enumerable: false,
      value: nextHeadRecord,
      writable: true,
    })
  }
  return clone
}

function sanitizePropsAppSlotPlaceholdersForHtml(
  props: Record<string, unknown>,
): Record<string, unknown> {
  let changed = false
  const nextProps: Record<string, unknown> = {}
  for (const [key, propValue] of Object.entries(props)) {
    const sanitized = sanitizeAppSlotPlaceholdersForHtml(propValue)
    if (sanitized !== propValue) changed = true
    nextProps[key] = sanitized
  }
  return changed ? nextProps : props
}

function sanitizeRueElementHeadRecordForHtml(
  record: Record<string | symbol, unknown>,
): Record<string | symbol, unknown> {
  const props = record.props
  if (!props || typeof props !== 'object') return record
  const nextProps = sanitizePropsAppSlotPlaceholdersForHtml(props as Record<string, unknown>)
  return nextProps === props ? record : { ...record, props: nextProps }
}

function getActivePageId(): string | null {
  const elements = readCurrentSsrAppElementsFallback()
  if (!elements) return null

  const routeId = elements[AppElementsWire.keys.route]
  if (typeof routeId !== 'string') return null

  const routeKey = AppElementsWire.parseElementKey(routeId)
  if (routeKey?.kind === 'page') return routeId
  if (routeKey?.kind === 'route') {
    return AppElementsWire.encodePageId(routeKey.path, routeKey.interceptionContext)
  }
  return null
}

function readTextRueHtml(value: unknown): string | null {
  if (Array.isArray(value)) {
    const parts = value.map(readTextRueHtml)
    return parts.some(part => part !== null) ? parts.map(part => part ?? '').join('') : null
  }
  if (!isServerProtocolElement(value)) return null
  const props = (value.props ?? {}) as Record<string, unknown>
  if (value.type === 'text-rue-html') {
    const html = (props.dangerouslySetInnerHTML as { __html?: unknown } | undefined)?.__html
    return typeof html === 'string' ? html : null
  }
  return readTextRueHtml(props.children)
}

function readActivePageHtmlForRueSlotLeak(): string | null {
  const pageId = getActivePageId()
  if (!pageId) return null
  const elements = readCurrentSsrAppElementsFallback(pageId)
  if (!elements || !Object.hasOwn(elements, pageId)) return null
  return readTextRueHtml(elements[pageId])
}

function replaceRueObjectSlotLeak(html: string): string {
  if (!html.includes('[object Object]')) return html
  const pageHtml = readActivePageHtmlForRueSlotLeak()
  return pageHtml === null ? html : html.replaceAll('[object Object]', pageHtml)
}

function isUnexpectedClientReferenceExportCall(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.startsWith('Unexpectedly client reference export ') &&
    error.message.endsWith(' is called on server')
  )
}

function getInjectedRueServerRenderer(): RueServerRenderer | null {
  const renderer = (globalThis as Record<string, unknown>).__TEXT_RUE_RENDER_TO_STRING__
  return typeof renderer === 'function' ? (renderer as RueServerRenderer) : null
}

async function renderRueRenderableToString(value: RueRenderableOutput): Promise<string> {
  const sanitizedValue = sanitizeAppSlotPlaceholdersForHtml(value) as RueRenderableOutput
  const injectedRenderer = getInjectedRueServerRenderer()
  if (injectedRenderer) {
    return replaceRueObjectSlotLeak(await injectedRenderer(sanitizedValue))
  }

  const rendererModule = (await import('@rue-js/server-renderer')) as RueServerRendererModule
  const renderToString =
    typeof rendererModule.renderToString === 'function'
      ? rendererModule.renderToString
      : typeof rendererModule.default?.renderToString === 'function'
        ? rendererModule.default.renderToString
        : null

  if (!renderToString) {
    throw new Error('text: @rue-js/server-renderer did not export renderToString.')
  }

  return replaceRueObjectSlotLeak(await renderToString(sanitizedValue))
}

export async function renderRueRenderableForRsc(
  value: RueRenderableOutput,
): Promise<TextCompatNode> {
  if (value == null || typeof value === 'boolean') {
    return null
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return value
  }
  let html: string
  try {
    html = await renderRueRenderableToString(value)
  } catch (error) {
    if (isUnexpectedClientReferenceExportCall(error)) {
      return null
    }
    throw error
  }
  return createServerProtocolElement('text-rue-html', {
    'data-text-rue-html': '',
    dangerouslySetInnerHTML: { __html: html },
    suppressHydrationWarning: true,
  })
}
