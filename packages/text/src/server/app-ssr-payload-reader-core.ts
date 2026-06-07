import {
  AppElementsWire,
  type AppElementValue,
  type AppElements,
  type AppWireElements,
} from './app-elements.js'
import { adaptAppServerRenderableForHtmlSsr, type AppServerRenderable } from './app-server-tree.js'
import { isAppRscServerClientReference } from './app-rsc-client-reference-protocol.js'
import { readAppRenderDependencySsrUnwrap } from './app-render-dependency-protocol.js'
import { createServerProtocolElement, isServerProtocolElement } from './element-protocol.js'
import type { TextCompatElement, TextCompatNode } from '../shims/text-compat-types.js'

export type AppSsrPayloadDecoder = (
  stream: ReadableStream<Uint8Array>,
) => AppWireElements | PromiseLike<AppWireElements>

export type AppSsrPayloadThenableReader = <T>(thenable: PromiseLike<T>) => T

export type AppSsrPayloadReaderOptions = {
  decodePayload: AppSsrPayloadDecoder
  primePageForHtmlSsr?: boolean
  readThenable: AppSsrPayloadThenableReader
}

function adaptAppElementsForSsr(elements: AppElements): AppElements | Promise<AppElements> {
  let changed = false
  const textElements: Record<string, AppElementValue> = {}
  const pendingElements: Promise<void>[] = []
  const activePageId = getActivePageId(elements)

  for (const [key, value] of Object.entries(elements)) {
    const elementKey = AppElementsWire.parseElementKey(key)
    const isRenderableEntry = elementKey !== null
    const shouldPrimePage =
      elementKey?.kind === 'page' && key === activePageId && !isClientReferencePageElement(value)
    const shouldPreserveRenderDependencies =
      elementKey?.kind === 'page' && isClientReferencePageElement(value)
    const adaptRenderable = (renderable: AppServerRenderable) =>
      adaptAppServerRenderableForHtmlSsr(renderable, {
        unwrapRenderDependencies: !shouldPreserveRenderDependencies,
      })
    const textValue = isRenderableEntry
      ? (adaptRenderable(value as AppServerRenderable) as AppElementValue)
      : value
    const primedValue = shouldPrimePage ? primeAppPageElementForHtmlSsr(textValue) : textValue
    if (isThenable(textValue)) {
      pendingElements.push(
        Promise.resolve(textValue).then(resolvedValue => {
          textElements[key] = shouldPrimePage
            ? (primeAppPageElementForHtmlSsr(resolvedValue) as AppElementValue)
            : (resolvedValue as AppElementValue)
        }),
      )
    } else {
      textElements[key] = primedValue as AppElementValue
    }
    if (primedValue !== value) changed = true
  }

  if (pendingElements.length > 0) {
    return Promise.all(pendingElements).then(() => textElements)
  }
  return changed ? textElements : elements
}

function getActivePageId(elements: AppElements): string | null {
  const routeId = elements[AppElementsWire.keys.route]
  if (typeof routeId !== 'string') return null

  const routeKey = AppElementsWire.parseElementKey(routeId)
  if (routeKey?.kind === 'page') return routeId
  if (routeKey?.kind === 'route') {
    return AppElementsWire.encodePageId(routeKey.path, routeKey.interceptionContext)
  }
  return null
}

function isClientReferencePageElement(value: unknown): boolean {
  if (isServerProtocolElement(value)) {
    const unwrapped = readAppRenderDependencySsrUnwrap(
      (value as TextCompatElement<Record<string, unknown>>).type,
    )
    if (unwrapped !== null) {
      return isClientReferencePageElement(unwrapped)
    }
  }
  if (!isServerProtocolElement(value)) return false
  return isAppRscServerClientReference((value as TextCompatElement<Record<string, unknown>>).type)
}

function primeAppPageElementForHtmlSsr(value: unknown): unknown {
  if (!isServerProtocolElement(value) || typeof value.type !== 'function') {
    return value
  }

  const element = value as TextCompatElement<Record<string, unknown>>
  const component = element.type as (props: Record<string, unknown>) => TextCompatNode
  const props = element.props ?? {}
  let rendered: TextCompatNode = null
  let pendingRendered: PromiseLike<TextCompatNode> | null = null
  let syncError: unknown = null
  let initialized = false

  const renderComponent = (): TextCompatNode | PromiseLike<TextCompatNode> => component(props)

  const renderAfterThenableSettles = async (thenable: PromiseLike<unknown>) => {
    await thenable
    while (true) {
      try {
        const renderedValue = renderComponent()
        return isThenable(renderedValue) ? await renderedValue : renderedValue
      } catch (error) {
        if (!isThenable(error)) throw error
        await error
      }
    }
  }

  const setPendingRendered = (pending: PromiseLike<TextCompatNode>) => {
    pendingRendered = pending
    void Promise.resolve(pending).then(
      resolved => {
        rendered = resolved
        pendingRendered = null
      },
      error => {
        syncError = error
        pendingRendered = null
      },
    )
  }

  const ensureRendered = (): TextCompatNode | PromiseLike<TextCompatNode> => {
    if (syncError !== null) {
      throw syncError
    }
    if (pendingRendered) {
      return pendingRendered
    }
    if (initialized) {
      return rendered
    }
    initialized = true
    try {
      const renderedValue = renderComponent()
      if (isThenable(renderedValue)) {
        setPendingRendered(Promise.resolve(renderedValue as Awaited<TextCompatNode>))
        return pendingRendered as PromiseLike<TextCompatNode>
      }
      rendered = renderedValue
      return rendered
    } catch (error) {
      if (isThenable(error)) {
        setPendingRendered(renderAfterThenableSettles(error))
        return pendingRendered as PromiseLike<TextCompatNode>
      }
      syncError = error
      throw error
    }
  }

  function PrimedAppPageElement(): TextCompatNode {
    return ensureRendered() as TextCompatNode
  }

  const displayName = (component as { displayName?: string; name?: string }).displayName
  if (displayName) {
    PrimedAppPageElement.displayName = displayName
  }

  try {
    ensureRendered()
  } catch {
    // Keep sync page errors deferred to the HTML SSR render pass.
  }

  return createServerProtocolElement(PrimedAppPageElement, null)
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}

export function createAppSsrPayloadReader(
  stream: ReadableStream<Uint8Array>,
  options: AppSsrPayloadReaderOptions,
): () => AppElements {
  let payloadRoot: AppWireElements | PromiseLike<AppWireElements> | null = null
  let adaptedRoot: AppElements | PromiseLike<AppElements> | null = null

  return () => {
    if (!payloadRoot) {
      payloadRoot = options.decodePayload(stream)
    }
    const wireElements = isThenable(payloadRoot) ? options.readThenable(payloadRoot) : payloadRoot
    if (options.primePageForHtmlSsr !== true) {
      const appElements = adaptAppElementsForSsr(AppElementsWire.decode(wireElements))
      return isThenable(appElements) ? options.readThenable(appElements) : appElements
    }
    if (!adaptedRoot) {
      adaptedRoot = adaptAppElementsForSsr(AppElementsWire.decode(wireElements))
    }
    return isThenable(adaptedRoot) ? options.readThenable(adaptedRoot) : adaptedRoot
  }
}

export async function resolveAppSsrPayloadElements(
  stream: ReadableStream<Uint8Array>,
  options: AppSsrPayloadReaderOptions,
): Promise<AppElements> {
  const wireElements = await options.decodePayload(stream)
  return await adaptAppElementsForSsr(AppElementsWire.decode(wireElements))
}
