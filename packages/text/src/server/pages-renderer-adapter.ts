import type {
  TextCompatComponentType,
  TextCompatElement,
  TextCompatNode,
} from '../shims/text-compat-types.js'
import {
  TextFragment,
  createRueTextElement,
  createTextElement,
  type TextNode,
} from '../runtime/render-protocol.js'
import { runWithPrivateCache } from '../shims/cache-runtime.js'
import { runWithServerInsertedHTMLState } from '../shims/navigation-state.js'
import { withScriptNonce } from '../shims/script-nonce-context.js'
import { readTextCompatContextProviderContext } from '../shims/context-provider-adapter.js'
import { isRueRenderableHandle, type TextRenderable } from './renderable.js'
import {
  ServerProtocolFragment,
  ServerProtocolSuspense,
  createServerProtocolElement,
  isServerProtocolElement,
} from './element-protocol.js'
import {
  runWithServerElementContextValue,
  runWithServerElementRuntime,
} from './server-element-runtime.js'
import {
  renderLegacyProtocolToReadableStream as defaultRenderLegacyProtocolToReadableStream,
  renderLegacyProtocolToString as defaultRenderLegacyProtocolToString,
} from './legacy-render-protocol.js'

type PagesComponent = TextCompatComponentType<Record<string, unknown>>
type PagesAppComponent = TextCompatComponentType<{
  Component: PagesComponent
  pageProps: Record<string, unknown>
}>
type PagesRenderableFactory = {
  __text_pages_renderable_factory: true
  render: () => TextRenderable | Promise<TextRenderable>
}
type RueServerRenderer = (element: TextRenderable) => Promise<string> | string
type LegacyProtocolStringRenderer = (element: TextCompatNode) => Promise<string>
type LegacyProtocolStreamRenderer = (element: TextCompatNode) => Promise<ReadableStream<Uint8Array>>
type LegacyProtocolRenderMode = 'full' | 'shell'
type LegacyProtocolStreamTask = Promise<string>
type FormActionMetadata = {
  action: string
  data: FormData | null
  encType: string
  method: string
  name: string
}
type ServerActionReference = {
  $$FORM_ACTION?: (identifierPrefix: string) => FormActionMetadata | null
}
type LazyComponentType = {
  $$typeof?: unknown
  _payload?: unknown
  _init?: (payload: unknown) => unknown
}
type DynamicLoadableComponent = TextCompatComponentType<Record<string, unknown>> & {
  __text_dynamic_loader__?: () => Promise<TextCompatComponentType<Record<string, unknown>>>
}

const VOID_HTML_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])
const RUE_SERVER_RENDERING_FLAG = '__rue_is_server_rendering__'

export type PagesRouterContextWrapper = (element: TextCompatElement) => TextCompatElement

function isRueRenderable(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(isRueRenderable)
  }
  return isRueRenderableHandle(value)
}

function isPagesRenderableFactory(value: unknown): value is PagesRenderableFactory {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as PagesRenderableFactory).__text_pages_renderable_factory === true &&
    typeof (value as PagesRenderableFactory).render === 'function'
  )
}

function isThenable<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}

function isClassComponentType(type: unknown): boolean {
  return (
    typeof type === 'function' &&
    !!(type as { prototype?: { render?: unknown } }).prototype &&
    typeof (type as { prototype?: { render?: unknown } }).prototype?.render === 'function'
  )
}

function isRueLazyType(type: unknown): type is LazyComponentType {
  return (
    typeof type === 'object' &&
    type !== null &&
    (type as { $$typeof?: unknown }).$$typeof === Symbol.for('rue.lazy') &&
    typeof (type as { _init?: unknown })._init === 'function'
  )
}

function isRueContextProviderType(type: unknown): type is object {
  return (
    typeof type === 'object' &&
    type !== null &&
    (type as { $$typeof?: unknown }).$$typeof === Symbol.for('rue.context')
  )
}

function readRueContextProviderContext(type: unknown): object | null {
  return (
    readTextCompatContextProviderContext(type) ?? (isRueContextProviderType(type) ? type : null)
  )
}

async function resolveRueLazyType(type: LazyComponentType): Promise<unknown> {
  for (let i = 0; i < 8; i += 1) {
    try {
      return type._init?.(type._payload)
    } catch (error) {
      if (!isThenable(error)) throw error
      await Promise.resolve(error)
    }
  }
  return type._init?.(type._payload)
}

function isDynamicLoadableComponent(type: unknown): type is DynamicLoadableComponent {
  return (
    typeof type === 'function' &&
    typeof (type as DynamicLoadableComponent).__text_dynamic_loader__ === 'function'
  )
}

async function resolveDynamicLoadableComponent(
  type: DynamicLoadableComponent,
): Promise<TextCompatComponentType<Record<string, unknown>>> {
  return type.__text_dynamic_loader__!()
}

async function renderProtocolComponent(
  type: unknown,
  props: Record<string, unknown>,
): Promise<unknown> {
  for (let i = 0; i < 8; i += 1) {
    try {
      return await runWithServerElementRuntime(() =>
        runWithRueServerRenderingFlag(() => {
          if (isClassComponentType(type)) {
            const instance = new (type as new (props: Record<string, unknown>) => {
              render: () => unknown
            })(props)
            return instance.render()
          }
          return (type as TextCompatComponentType<Record<string, unknown>>)(props)
        }),
      )
    } catch (error) {
      if (!isThenable(error)) throw error
      await Promise.resolve(error)
    }
  }
  return runWithServerElementRuntime(() =>
    runWithRueServerRenderingFlag(() =>
      (type as TextCompatComponentType<Record<string, unknown>>)(props),
    ),
  )
}

function runWithRueServerRenderingFlag<T>(callback: () => T): T {
  const globalRecord = globalThis as Record<string, unknown>
  const previous =
    typeof globalRecord[RUE_SERVER_RENDERING_FLAG] === 'number'
      ? (globalRecord[RUE_SERVER_RENDERING_FLAG] as number)
      : 0
  globalRecord[RUE_SERVER_RENDERING_FLAG] = previous + 1
  let restoreOnReturn = true
  const restore = () => {
    const current =
      typeof globalRecord[RUE_SERVER_RENDERING_FLAG] === 'number'
        ? (globalRecord[RUE_SERVER_RENDERING_FLAG] as number)
        : 0
    if (current > 1) {
      globalRecord[RUE_SERVER_RENDERING_FLAG] = current - 1
    } else {
      delete globalRecord[RUE_SERVER_RENDERING_FLAG]
    }
  }
  try {
    const result = callback()
    if (isThenable(result)) {
      restoreOnReturn = false
      return Promise.resolve(result).finally(restore) as T
    }
    return result
  } finally {
    if (restoreOnReturn) restore()
  }
}

function canConvertLegacyProtocolToRue(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.every(child => canConvertLegacyProtocolToRue(child))
  }
  if (!isServerProtocolElement(value)) {
    return true
  }

  const type = value.type
  if (type !== ServerProtocolFragment && typeof type !== 'string') {
    return false
  }

  const children = (value.props as { children?: unknown } | null | undefined)?.children
  return children === undefined || canConvertLegacyProtocolToRue(children)
}

function legacyProtocolToRueNode(value: unknown): TextNode {
  if (Array.isArray(value)) {
    return value.map(child => legacyProtocolToRueNode(child)) as TextNode
  }
  if (!isServerProtocolElement(value)) {
    return value as TextNode
  }

  const rawProps = (value.props ?? {}) as Record<string, unknown>
  const { children, ref: _ref, ...props } = rawProps
  const childList = Array.isArray(children)
    ? children.map(child => legacyProtocolToRueNode(child))
    : children !== undefined
      ? [legacyProtocolToRueNode(children)]
      : []
  const type = value.type === ServerProtocolFragment ? TextFragment : value.type
  return createRueTextElement(type as never, props, ...(childList as TextNode[])) as TextNode
}

function legacyProtocolToRueRenderable(value: unknown): TextRenderable | null {
  if (!isServerProtocolElement(value) && !Array.isArray(value)) return null
  if (!canConvertLegacyProtocolToRue(value)) return null
  return legacyProtocolToRueNode(value) as TextRenderable
}

async function resolveLegacyProtocolToRueNode(
  value: unknown,
  options: {
    mode: LegacyProtocolRenderMode
    streamTasks?: LegacyProtocolStreamTask[]
    renderRueToString?: RueServerRenderer
  },
): Promise<TextNode> {
  if (Array.isArray(value)) {
    return Promise.all(
      value.map(child => resolveLegacyProtocolToRueNode(child, options)),
    ) as Promise<TextNode>
  }
  if (!isServerProtocolElement(value)) {
    return value as TextNode
  }

  let type = value.type
  const rawProps = (value.props ?? {}) as Record<string, unknown>
  const { children, ref: _ref, ...props } = rawProps

  if (isRueLazyType(type)) {
    type = await resolveRueLazyType(type)
  }

  if (isDynamicLoadableComponent(type)) {
    type = await resolveDynamicLoadableComponent(type)
  }

  if (type === ServerProtocolSuspense) {
    if (options.mode === 'shell' && options.streamTasks) {
      options.streamTasks.push(
        (async () => {
          const resolvedChildren = await runWithRueServerDOMAdapter(() =>
            resolveLegacyProtocolToRueNode(children, {
              mode: 'full',
              renderRueToString: options.renderRueToString,
            }),
          )
          return renderRueRenderableToString(
            resolvedChildren as TextRenderable,
            options.renderRueToString,
          )
        })(),
      )
      return resolveLegacyProtocolToRueNode(props.fallback, options)
    }
    return resolveLegacyProtocolToRueNode(children, options)
  }

  const providerContext = readRueContextProviderContext(type)
  if (providerContext) {
    return runWithServerElementContextValue(providerContext, props.value, () =>
      resolveLegacyProtocolToRueNode(children, options),
    )
  }

  if (typeof type === 'function') {
    const output = await renderProtocolComponent(type, {
      ...props,
      ...(children !== undefined ? { children } : null),
    })
    return resolveLegacyProtocolToRueNode(output, options)
  }

  if (type !== ServerProtocolFragment && typeof type !== 'string') {
    return null
  }

  const childList = Array.isArray(children)
    ? await Promise.all(children.map(child => resolveLegacyProtocolToRueNode(child, options)))
    : children !== undefined
      ? [await resolveLegacyProtocolToRueNode(children, options)]
      : []
  const textType = type === ServerProtocolFragment ? TextFragment : type
  return createRueTextElement(textType as never, props, ...(childList as TextNode[])) as TextNode
}

async function _renderLegacyProtocolNativelyToString(
  element: TextCompatNode,
  renderRueToString?: RueServerRenderer,
): Promise<string> {
  const rueElement = await runWithRueServerDOMAdapter(() =>
    resolveLegacyProtocolToRueNode(element, {
      mode: 'full',
      renderRueToString,
    }),
  )
  return renderRueRenderableToString(rueElement as TextRenderable, renderRueToString)
}

async function _renderLegacyProtocolNativelyToReadableStream(
  element: TextCompatNode,
  renderRueToString?: RueServerRenderer,
): Promise<ReadableStream<Uint8Array>> {
  const streamTasks: LegacyProtocolStreamTask[] = []
  const shellElement = await runWithRueServerDOMAdapter(() =>
    resolveLegacyProtocolToRueNode(element, {
      mode: 'shell',
      renderRueToString,
      streamTasks,
    }),
  )
  const shellHtml = await renderRueRenderableToString(
    shellElement as TextRenderable,
    renderRueToString,
  )
  if (streamTasks.length === 0) {
    return stringToStream(shellHtml)
  }

  const encoder = new TextEncoder()
  return new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(shellHtml))
      try {
        for (const task of streamTasks) {
          const html = await task
          if (html) controller.enqueue(encoder.encode(html))
        }
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })
}

function escapeHtmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtmlText(value)
    .replace(/"/g, '&quot;')
    .replace(/\u00a0/g, '&nbsp;')
}

function styleObjectToCss(value: Record<string, unknown>): string {
  let css = ''
  for (const [key, rawValue] of Object.entries(value)) {
    if (rawValue == null || rawValue === false) continue
    const name = key.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)
    css += `${name}: ${String(rawValue)}; `
  }
  return css.trim()
}

function renderHtmlAttrs(props: Record<string, unknown>): string {
  const attrs: string[] = []
  for (const [key, rawValue] of Object.entries(props)) {
    if (
      key === 'children' ||
      key === 'dangerouslySetInnerHTML' ||
      key === 'key' ||
      key === 'ref' ||
      key === 'suppressHydrationWarning' ||
      rawValue == null ||
      rawValue === false ||
      typeof rawValue === 'function'
    ) {
      continue
    }
    const name = key === 'className' ? 'class' : key === 'htmlFor' ? 'for' : key
    if (rawValue === true) {
      attrs.push(name)
      continue
    }
    const value =
      key === 'style' && typeof rawValue === 'object' && rawValue !== null
        ? styleObjectToCss(rawValue as Record<string, unknown>)
        : String(rawValue)
    attrs.push(`${name}="${escapeHtmlAttribute(value)}"`)
  }
  return attrs.length ? ` ${attrs.join(' ')}` : ''
}

function readFormActionMetadata(props: Record<string, unknown>): FormActionMetadata | null {
  const action = props.action
  if (typeof action !== 'function') return null
  const formAction = (action as ServerActionReference).$$FORM_ACTION
  if (typeof formAction !== 'function') return null
  return formAction('')
}

function formDataEntryToString(value: FormDataEntryValue): string {
  return typeof value === 'string' ? value : value.name
}

function renderFormActionHiddenInputs(metadata: FormActionMetadata | null): string {
  if (!metadata) return ''
  const inputs = [`<input type="hidden" name="${escapeHtmlAttribute(metadata.name)}" value="">`]
  if (metadata.data) {
    for (const [name, value] of metadata.data) {
      inputs.push(
        `<input type="hidden" name="${escapeHtmlAttribute(name)}" value="${escapeHtmlAttribute(
          formDataEntryToString(value),
        )}">`,
      )
    }
  }
  return inputs.join('')
}

function formAttrsWithActionMetadata(
  props: Record<string, unknown>,
  metadata: FormActionMetadata | null,
): Record<string, unknown> {
  if (!metadata) return props
  return {
    ...props,
    action: metadata.action,
    encType: metadata.encType,
    method: metadata.method,
  }
}

async function renderLegacyProtocolNodeToHtml(
  value: unknown,
  options: {
    mode: LegacyProtocolRenderMode
    streamTasks?: LegacyProtocolStreamTask[]
    renderRueToString?: RueServerRenderer
  },
): Promise<string> {
  if (value == null || typeof value === 'boolean') return ''
  if (typeof value === 'string' || typeof value === 'number') {
    return escapeHtmlText(String(value))
  }
  if (Array.isArray(value)) {
    return (
      await Promise.all(value.map(child => renderLegacyProtocolNodeToHtml(child, options)))
    ).join('')
  }
  if (!isServerProtocolElement(value)) return ''

  let type = value.type
  const props = (value.props ?? {}) as Record<string, unknown>
  const children = props.children

  if (isRueLazyType(type)) {
    type = await resolveRueLazyType(type)
  }

  if (isDynamicLoadableComponent(type)) {
    type = await resolveDynamicLoadableComponent(type)
  }

  if (type === ServerProtocolSuspense) {
    if (options.mode === 'shell' && options.streamTasks) {
      options.streamTasks.push(
        renderLegacyProtocolNodeToHtml(children, {
          mode: 'full',
          renderRueToString: options.renderRueToString,
        }),
      )
      return renderLegacyProtocolNodeToHtml(props.fallback, options)
    }
    return renderLegacyProtocolNodeToHtml(children, options)
  }

  const providerContext = readRueContextProviderContext(type)
  if (providerContext) {
    return runWithServerElementContextValue(providerContext, props.value, () =>
      renderLegacyProtocolNodeToHtml(children, options),
    )
  }

  if (typeof type === 'function') {
    const output = await renderProtocolComponent(type, props)
    if (isRueRenderable(output)) {
      return renderRueRenderableToString(output, options.renderRueToString)
    }
    return renderLegacyProtocolNodeToHtml(output, options)
  }

  if (type === ServerProtocolFragment) {
    return renderLegacyProtocolNodeToHtml(children, options)
  }

  if (typeof type !== 'string') return ''

  const innerHtml = (props.dangerouslySetInnerHTML as { __html?: unknown } | undefined)?.__html
  const formActionMetadata = type === 'form' ? readFormActionMetadata(props) : null
  const attrs = renderHtmlAttrs(formAttrsWithActionMetadata(props, formActionMetadata))
  if (VOID_HTML_TAGS.has(type.toLowerCase())) {
    return `<${type}${attrs}>`
  }
  const hiddenInputs = renderFormActionHiddenInputs(formActionMetadata)
  const body =
    innerHtml != null
      ? String(innerHtml)
      : hiddenInputs + (await renderLegacyProtocolNodeToHtml(children, options))
  return `<${type}${attrs}>${body}</${type}>`
}

async function renderLegacyProtocolHtmlToString(
  element: TextCompatNode,
  renderRueToString?: RueServerRenderer,
): Promise<string> {
  return renderLegacyProtocolNodeToHtml(element, { mode: 'full', renderRueToString })
}

async function renderLegacyProtocolHtmlToStringWithFallback(
  element: TextCompatNode,
  renderLegacyProtocolToString?: LegacyProtocolStringRenderer,
  renderRueToString?: RueServerRenderer,
): Promise<string> {
  try {
    return await renderLegacyProtocolHtmlToString(element, renderRueToString)
  } catch (error) {
    if (!isInvalidCompatHookCall(error)) throw error
    return (renderLegacyProtocolToString ?? defaultRenderLegacyProtocolToString)(element)
  }
}

async function renderLegacyProtocolHtmlToReadableStream(
  element: TextCompatNode,
  renderRueToString?: RueServerRenderer,
): Promise<ReadableStream<Uint8Array>> {
  const streamTasks: LegacyProtocolStreamTask[] = []
  const shellHtml = await renderLegacyProtocolNodeToHtml(element, {
    mode: 'shell',
    streamTasks,
    renderRueToString,
  })
  if (streamTasks.length === 0) return stringToStream(shellHtml)
  const encoder = new TextEncoder()
  return new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(shellHtml))
      try {
        for (const task of streamTasks) {
          const html = await task
          if (html) controller.enqueue(encoder.encode(html))
        }
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })
}

async function renderLegacyProtocolHtmlToReadableStreamWithFallback(
  element: TextCompatNode,
  renderLegacyProtocolToReadableStream?: LegacyProtocolStreamRenderer,
  renderRueToString?: RueServerRenderer,
): Promise<ReadableStream<Uint8Array>> {
  try {
    return await renderLegacyProtocolHtmlToReadableStream(element, renderRueToString)
  } catch (error) {
    if (!isInvalidCompatHookCall(error)) throw error
    return (renderLegacyProtocolToReadableStream ?? defaultRenderLegacyProtocolToReadableStream)(
      element,
    )
  }
}

function isInvalidCompatHookCall(error: unknown): boolean {
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: unknown }).message)
      : String(error)
  return (
    message.includes('Invalid hook call') ||
    message.includes("Cannot read properties of null (reading 'use") ||
    message.includes('only works in Client Components')
  )
}

function stringToStream(value: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(value))
      controller.close()
    },
  })
}

function getRueServerRenderer(): RueServerRenderer | null {
  const renderer = (globalThis as Record<string, unknown>).__TEXT_RUE_RENDER_TO_STRING__
  return typeof renderer === 'function' ? (renderer as RueServerRenderer) : null
}

async function withServerRenderScope<T>(fn: () => Promise<T> | T): Promise<T> {
  return fn()
}

async function renderRueRenderableToString(
  element: TextRenderable,
  renderRueToString?: RueServerRenderer,
): Promise<string> {
  const injectedRenderer = renderRueToString ?? getRueServerRenderer()
  if (injectedRenderer) {
    return withServerRenderScope(() => injectedRenderer(element))
  }

  const { renderToString } = await import('@rue-js/server-renderer')
  return withServerRenderScope(() => renderToString(element))
}

async function renderRueRenderableToReadableStream(
  element: TextRenderable,
): Promise<ReadableStream<Uint8Array>> {
  const { renderToReadableStream } = await import('@rue-js/server-renderer')
  return withServerRenderScope(() => renderToReadableStream(element))
}

async function runWithRueServerDOMAdapter<T>(fn: () => T | Promise<T>): Promise<T> {
  const { runWithServerDOMAdapter } = await import('@rue-js/server-renderer')
  return runWithServerDOMAdapter(fn)
}

async function probePagesComponentOutput(
  component: PagesComponent,
  pageProps: Record<string, unknown>,
): Promise<TextRenderable> {
  const { runWithServerDOMAdapter } = await import('@rue-js/server-renderer')
  try {
    return await runWithServerDOMAdapter(() =>
      runWithServerInsertedHTMLState(() =>
        runWithPrivateCache(() =>
          runWithServerElementRuntime(() => component(pageProps) as TextRenderable),
        ),
      ),
    )
  } catch (error) {
    if (!isInvalidCompatHookCall(error)) throw error
    return createServerProtocolElement(component, pageProps) as TextRenderable
  }
}

async function probePagesAppComponentOutput(
  component: PagesAppComponent,
  PageComponent: PagesComponent,
  pageProps: Record<string, unknown>,
): Promise<TextRenderable> {
  const { runWithServerDOMAdapter } = await import('@rue-js/server-renderer')
  try {
    return await runWithServerDOMAdapter(() =>
      runWithServerInsertedHTMLState(() =>
        runWithPrivateCache(() =>
          runWithServerElementRuntime(
            () =>
              component({
                Component: PageComponent,
                pageProps,
              }) as TextRenderable,
          ),
        ),
      ),
    )
  } catch (error) {
    if (!isInvalidCompatHookCall(error)) throw error
    return createServerProtocolElement(component, {
      Component: PageComponent,
      pageProps,
    }) as TextRenderable
  }
}

export function createPagesDocumentElement(
  DocumentComponent: TextCompatComponentType,
): TextRenderable {
  return createServerProtocolElement(DocumentComponent, null) as TextRenderable
}

export function createPagesPageElement(options: {
  AppComponent?: PagesAppComponent | null
  PageComponent: PagesComponent
  pageProps: Record<string, unknown>
  wrapWithRouterContext?: PagesRouterContextWrapper | null
}): TextRenderable {
  return {
    __text_pages_renderable_factory: true,
    async render() {
      const pageElement =
        typeof options.PageComponent === 'function'
          ? await probePagesComponentOutput(options.PageComponent, options.pageProps)
          : createTextElement(options.PageComponent, options.pageProps)

      if (typeof options.AppComponent === 'function') {
        const appElement = await probePagesAppComponentOutput(
          options.AppComponent,
          options.PageComponent,
          options.pageProps,
        )

        if (isRueRenderable(appElement)) {
          return options.wrapWithRouterContext
            ? options.wrapWithRouterContext(appElement as TextCompatElement)
            : appElement
        }

        if (isRueRenderable(pageElement)) {
          const html = await renderRueRenderableToString(pageElement)
          const PageHtmlComponent = (): TextNode =>
            createServerProtocolElement('text-rue-html', {
              'data-text-rue-html': '',
              dangerouslySetInnerHTML: { __html: html },
              suppressHydrationWarning: true,
            }) as TextNode
          PageHtmlComponent.displayName =
            (options.PageComponent as { displayName?: string; name?: string }).displayName ??
            (options.PageComponent as { name?: string }).name ??
            'PageHtmlComponent'
          const element = createServerProtocolElement(options.AppComponent, {
            Component: PageHtmlComponent,
            pageProps: options.pageProps,
          })

          return options.wrapWithRouterContext
            ? options.wrapWithRouterContext(element as TextCompatElement)
            : (element as TextRenderable)
        }

        return options.wrapWithRouterContext
          ? options.wrapWithRouterContext(appElement as TextCompatElement)
          : appElement
      }

      if (isServerProtocolElement(pageElement)) {
        return options.wrapWithRouterContext
          ? options.wrapWithRouterContext(pageElement as TextCompatElement)
          : (pageElement as TextRenderable)
      }

      const element = pageElement

      if (isRueRenderable(element)) {
        return element
      }

      const { runWithServerDOMAdapter } = await import('@rue-js/server-renderer')
      const rueElement = await runWithServerDOMAdapter(() => legacyProtocolToRueRenderable(element))
      if (rueElement) {
        return rueElement
      }

      return options.wrapWithRouterContext
        ? options.wrapWithRouterContext(element as TextCompatElement)
        : (element as TextRenderable)
    },
  } as TextRenderable
}

export function withPagesScriptNonce(element: TextRenderable, nonce?: string): TextRenderable {
  if (isPagesRenderableFactory(element)) {
    return {
      __text_pages_renderable_factory: true,
      async render() {
        return withPagesScriptNonce(await element.render(), nonce)
      },
    } as TextRenderable
  }

  if (!nonce || isRueRenderable(element)) {
    return element
  }

  if (isServerProtocolElement(element)) {
    return withScriptNonce(element as TextCompatElement, nonce) as TextRenderable
  }

  return withScriptNonce(
    createTextElement(TextFragment, null, element as TextNode),
    nonce,
  ) as TextRenderable
}

export async function renderPagesRenderableToString(
  element: TextRenderable,
  renderLegacyProtocolToString?: LegacyProtocolStringRenderer,
  renderRueToString?: RueServerRenderer,
): Promise<string> {
  if (isPagesRenderableFactory(element)) {
    const rendered = await withServerRenderScope(() => element.render())
    if (isRueRenderable(rendered)) {
      return renderRueRenderableToString(rendered, renderRueToString)
    }
    if (isServerProtocolElement(rendered) || Array.isArray(rendered)) {
      return renderLegacyProtocolHtmlToStringWithFallback(
        rendered as TextCompatNode,
        renderLegacyProtocolToString,
        renderRueToString,
      )
    }
    const rueElement = legacyProtocolToRueRenderable(rendered)
    if (rueElement) {
      return renderRueRenderableToString(rueElement, renderRueToString)
    }
    return (renderLegacyProtocolToString ?? defaultRenderLegacyProtocolToString)(
      rendered as TextCompatNode,
    )
  }

  if (isRueRenderable(element)) {
    return renderRueRenderableToString(element, renderRueToString)
  }

  if (isServerProtocolElement(element) || Array.isArray(element)) {
    return renderLegacyProtocolHtmlToStringWithFallback(
      element as TextCompatNode,
      renderLegacyProtocolToString,
      renderRueToString,
    )
  }

  const rueElement = legacyProtocolToRueRenderable(element)
  if (rueElement) {
    return renderRueRenderableToString(rueElement, renderRueToString)
  }

  return (renderLegacyProtocolToString ?? defaultRenderLegacyProtocolToString)(
    element as TextCompatNode,
  )
}

export async function renderPagesRenderableToReadableStream(
  element: TextRenderable,
  renderLegacyProtocolToReadableStream?: LegacyProtocolStreamRenderer,
  renderRueToString?: RueServerRenderer,
): Promise<ReadableStream<Uint8Array>> {
  if (isPagesRenderableFactory(element)) {
    const rendered = await withServerRenderScope(() => element.render())
    if (isRueRenderable(rendered)) {
      return renderRueRenderableToReadableStream(rendered)
    }
    if (isServerProtocolElement(rendered) || Array.isArray(rendered)) {
      return renderLegacyProtocolHtmlToReadableStreamWithFallback(
        rendered as TextCompatNode,
        renderLegacyProtocolToReadableStream,
        renderRueToString,
      )
    }
    const rueElement = legacyProtocolToRueRenderable(rendered)
    if (rueElement) {
      return stringToStream(await renderRueRenderableToString(rueElement, renderRueToString))
    }
    return (renderLegacyProtocolToReadableStream ?? defaultRenderLegacyProtocolToReadableStream)(
      rendered as TextCompatNode,
    )
  }

  if (isRueRenderable(element)) {
    return renderRueRenderableToReadableStream(element)
  }

  if (isServerProtocolElement(element) || Array.isArray(element)) {
    return renderLegacyProtocolHtmlToReadableStreamWithFallback(
      element as TextCompatNode,
      renderLegacyProtocolToReadableStream,
      renderRueToString,
    )
  }

  const rueElement = legacyProtocolToRueRenderable(element)
  if (rueElement) {
    return renderRueRenderableToReadableStream(rueElement)
  }

  return (renderLegacyProtocolToReadableStream ?? defaultRenderLegacyProtocolToReadableStream)(
    element as TextCompatNode,
  )
}
