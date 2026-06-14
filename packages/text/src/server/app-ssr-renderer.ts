import type { TextCompatNode } from '../shims/text-compat-types.js'
import { buildClientHookErrorMessage } from '../shims/client-hook-error.js'
import {
  readTextCompatContextProviderContext,
  runWithTextCompatContextProviderValue,
} from '../shims/context-provider-adapter.js'
import { type AppSsrReadableStream, type AppSsrRenderOptions } from './app-ssr-render-protocol.js'
import {
  runWithAppContextRuntimeStream,
  runWithAppContextRuntimeSync,
} from './app-context-runtime.js'
import { readAppSsrThenableValue } from './app-ssr-thenable-protocol.js'
import {
  ServerProtocolFragment,
  ServerProtocolSuspense,
  isServerProtocolElement,
} from './element-protocol.js'
import { isRueRenderable, type TextRenderable } from './renderable.js'
import {
  runWithServerElementContextValue,
  runWithServerElementRuntime,
} from './server-element-runtime.js'
import { resolveAppClientReference } from './app-client-reference-resolver.js'
import { adaptAppServerRenderableForHtmlSsr } from './app-server-tree.js'
import { AppElementsWire } from './app-elements.js'
import { readCurrentSsrAppElementsFallback } from '../shims/slot-core.js'

export type { AppSsrReadableStream, AppSsrRenderOptions }
export { readAppSsrThenableValue }

type AppProtocolComponent = (props: Record<string, unknown>) => unknown
type AppProtocolClassComponent = new (props: Record<string, unknown>) => {
  props: Record<string, unknown>
  state?: Record<string, unknown> | null
  componentDidCatch?: (error: unknown, errorInfo: { componentStack: string }) => void
  render: () => unknown
}
type AppDynamicLoadableComponent = AppProtocolComponent & {
  __text_dynamic_loader__?: () => Promise<AppProtocolComponent>
}
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
type AppErrorBoundaryClassComponent = AppProtocolClassComponent & {
  getDerivedStateFromError?: (error: unknown) => Record<string, unknown> | null | undefined
  getDerivedStateFromProps?: (
    props: Record<string, unknown>,
    state: Record<string, unknown> | null | undefined,
  ) => Record<string, unknown> | null | undefined
}
type AppSsrStreamTask = Promise<string>

const RUE_SERVER_RENDERING_FLAG = '__rue_is_server_rendering__'
const RUE_CONTEXT_PROVIDER_CONTEXT_PROP = '__rue_context_provider_context__'
const TEXT_CLIENT_REFERENCE_SSR_KEY = Symbol.for('text.clientReferenceSsr')
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

export async function renderAppSsrToReadableStream(
  node: TextCompatNode,
  options: AppSsrRenderOptions,
): Promise<AppSsrReadableStream> {
  return runWithAppContextRuntimeStream(() => renderRueAppSsrToReadableStream(node, options))
}

export function renderAppSsrToStaticMarkup(node: TextCompatNode): string {
  return runWithAppContextRuntimeSync(() =>
    normalizeAppDocumentHtml(renderStaticAppSsrNodeToHtml(node)),
  )
}

async function renderRueAppSsrToReadableStream(
  node: TextCompatNode,
  options: AppSsrRenderOptions,
): Promise<AppSsrReadableStream> {
  const streamTasks: AppSsrStreamTask[] = []
  const shellHtml = await replaceAppSsrObjectSlotLeak(
    normalizeAppDocumentHtml(
      await renderAppSsrNodeToHtml(node, {
        mode: 'shell',
        onError: options.onError,
        streamTasks,
      }),
    ),
    { onError: options.onError },
  )
  const bootstrapHtml = renderBootstrapModules(options)
  if (streamTasks.length === 0) {
    const stream = stringToAppSsrStream(shellHtml + bootstrapHtml)
    Object.defineProperty(stream, 'allReady', {
      configurable: true,
      enumerable: false,
      value: Promise.resolve(),
      writable: false,
    })
    return stream
  }

  const allReady = Promise.all(streamTasks).then(
    () => undefined,
    error => {
      options.onError?.(error)
      return undefined
    },
  )
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(shellHtml))
      try {
        for (const task of streamTasks) {
          const html = await task
          if (html) controller.enqueue(encoder.encode(html))
        }
        if (bootstrapHtml) controller.enqueue(encoder.encode(bootstrapHtml))
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  }) as AppSsrReadableStream

  Object.defineProperty(stream, 'allReady', {
    configurable: true,
    enumerable: false,
    value: allReady,
    writable: false,
  })

  return stream
}

async function renderAppSsrNodeToHtml(
  value: unknown,
  options: {
    mode: 'full' | 'shell'
    onError?: (error: unknown) => string | undefined
    streamTasks?: AppSsrStreamTask[]
  },
): Promise<string> {
  for (let i = 0; i < 8; i += 1) {
    try {
      return await renderAppSsrNodeToHtmlOnce(value, options)
    } catch (error) {
      if (!isThenable(error)) throw error
      await Promise.resolve(error)
    }
  }
  return renderAppSsrNodeToHtmlOnce(value, options)
}

async function renderAppSsrNodeToHtmlOnce(
  value: unknown,
  options: {
    mode: 'full' | 'shell'
    onError?: (error: unknown) => string | undefined
    streamTasks?: AppSsrStreamTask[]
  },
): Promise<string> {
  if (value == null || typeof value === 'boolean') return ''
  if (typeof value === 'string' || typeof value === 'number') {
    return escapeHtmlText(String(value))
  }
  if (Array.isArray(value)) {
    return (await Promise.all(value.map(child => renderAppSsrNodeToHtml(child, options)))).join('')
  }
  if (isRueRenderable(value)) {
    const adaptedValue = await adaptAppServerRenderableForHtmlSsr(value as TextRenderable)
    return renderAppSsrNodeToHtml(adaptedValue, options)
  }
  if (!isServerProtocolElement(value)) return ''

  let type = value.type
  const props = (value.props ?? {}) as Record<string, unknown>
  const children = props.children

  let resolvedClientReferenceForSsr = false
  const resolvedClientReference = resolveAppClientReference(type)
  if (resolvedClientReference) {
    type = await Promise.resolve(resolvedClientReference)
    resolvedClientReferenceForSsr = true
  }

  if (isDynamicLoadableComponent(type)) {
    type = await type.__text_dynamic_loader__!()
  }

  if (type === ServerProtocolSuspense) {
    if (options.mode === 'shell' && options.streamTasks) {
      options.streamTasks.push(
        renderAppSsrNodeToHtml(children, {
          mode: 'full',
          onError: options.onError,
        }).catch(error => {
          const digest = options.onError?.(error)
          return renderStreamedErrorMarker(error, typeof digest === 'string' ? digest : null)
        }),
      )
      return renderAppSsrNodeToHtml(props.fallback, options)
    }
    return renderAppSsrNodeToHtml(children, options)
  }

  const providerContext =
    readTextCompatContextProviderContext(type) ?? readRueContextProviderContext(type)
  if (providerContext) {
    return runWithServerElementRuntime(() =>
      runWithAppSsrContextProviderValue(
        resolveActiveAppSsrProviderContext(type, providerContext),
        props.value,
        () => renderAppSsrNodeToHtml(children, options),
      ),
    )
  }

  if (typeof type === 'function') {
    try {
      const renderComponent = () => renderProtocolComponentToHtml(type, props, options)
      return await (resolvedClientReferenceForSsr
        ? runWithAppClientReferenceSsr(renderComponent)
        : renderComponent())
    } catch (error) {
      options.onError?.(error)
      throw error
    }
  }

  if (type === ServerProtocolFragment) {
    return renderAppSsrNodeToHtml(children, options)
  }

  if (typeof type !== 'string') return ''

  const innerHtml = (props.dangerouslySetInnerHTML as { __html?: unknown } | undefined)?.__html
  if (type === 'text-rue-html') {
    return innerHtml != null ? String(innerHtml) : renderAppSsrNodeToHtml(children, options)
  }

  const formActionMetadata = type === 'form' ? readFormActionMetadata(props) : null
  const attrs = renderHtmlAttrs(formAttrsWithActionMetadata(props, formActionMetadata))
  if (VOID_HTML_TAGS.has(type.toLowerCase())) {
    return `<${type}${attrs}/>`
  }
  const hiddenInputs = renderFormActionHiddenInputs(formActionMetadata)
  const body =
    innerHtml != null
      ? String(innerHtml)
      : hiddenInputs + (await renderAppSsrNodeToHtml(children, options))
  return `<${type}${attrs}>${body}</${type}>`
}

function renderStaticAppSsrNodeToHtml(value: unknown): string {
  if (value == null || typeof value === 'boolean') return ''
  if (typeof value === 'string' || typeof value === 'number') return escapeHtmlText(String(value))
  if (Array.isArray(value)) return value.map(renderStaticAppSsrNodeToHtml).join('')
  if (!isServerProtocolElement(value)) return ''

  const type = value.type
  const props = (value.props ?? {}) as Record<string, unknown>
  const children = props.children
  if (type === ServerProtocolFragment || type === ServerProtocolSuspense) {
    return renderStaticAppSsrNodeToHtml(
      type === ServerProtocolSuspense ? (props.fallback ?? children) : children,
    )
  }
  const providerContext =
    readTextCompatContextProviderContext(type) ?? readRueContextProviderContext(type)
  if (providerContext) {
    return runWithServerElementRuntime(() =>
      runWithAppSsrContextProviderValue(
        resolveActiveAppSsrProviderContext(type, providerContext),
        props.value,
        () => renderStaticAppSsrNodeToHtml(children),
      ),
    )
  }
  if (typeof type === 'function') {
    const output = runWithServerElementRuntime(() =>
      runWithRueServerRenderingFlag(() =>
        isClassComponentType(type)
          ? new (type as new (props: Record<string, unknown>) => { render: () => unknown })(
              props,
            ).render()
          : (type as AppProtocolComponent)(props),
      ),
    )
    return isThenable(output) ? '' : renderStaticAppSsrNodeToHtml(output)
  }
  if (typeof type !== 'string') return ''

  const innerHtml = (props.dangerouslySetInnerHTML as { __html?: unknown } | undefined)?.__html
  if (type === 'text-rue-html') {
    return innerHtml != null ? String(innerHtml) : renderStaticAppSsrNodeToHtml(children)
  }

  const formActionMetadata = type === 'form' ? readFormActionMetadata(props) : null
  const attrs = renderHtmlAttrs(formAttrsWithActionMetadata(props, formActionMetadata))
  if (VOID_HTML_TAGS.has(type.toLowerCase())) return `<${type}${attrs}/>`
  const hiddenInputs = renderFormActionHiddenInputs(formActionMetadata)
  const body =
    innerHtml != null ? String(innerHtml) : hiddenInputs + renderStaticAppSsrNodeToHtml(children)
  return `<${type}${attrs}>${body}</${type}>`
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
          return (type as AppProtocolComponent)(props)
        }),
      )
    } catch (error) {
      if (!isThenable(error)) throw error
      await Promise.resolve(error)
    }
  }
  return runWithServerElementRuntime(() =>
    runWithRueServerRenderingFlag(() => (type as AppProtocolComponent)(props)),
  )
}

async function renderProtocolComponentToHtml(
  type: unknown,
  props: Record<string, unknown>,
  options: {
    mode: 'full' | 'shell'
    onError?: (error: unknown) => string | undefined
    streamTasks?: AppSsrStreamTask[]
  },
): Promise<string> {
  if (!isClassComponentType(type)) {
    let output: unknown
    try {
      output = await renderProtocolComponent(type, props)
    } catch (error) {
      if (isRueClientHookError(error)) return ''
      throw error
    }
    return renderAppSsrNodeToHtml(output, options)
  }

  const Component = type as AppProtocolClassComponent
  const instance = new Component(props)
  applyDerivedStateFromProps(type, instance, props)
  try {
    const output = await runWithServerElementRuntime(() =>
      runWithRueServerRenderingFlag(() => instance.render()),
    )
    return await renderAppSsrNodeToHtml(output, options)
  } catch (error) {
    if (!isErrorBoundaryClassComponent(type)) throw error
    rewriteRueClientHookError(error)
    const textState = type.getDerivedStateFromError?.(error)
    if (textState && typeof textState === 'object') {
      instance.state = { ...instance.state, ...textState }
    }
    instance.componentDidCatch?.(error, { componentStack: '' })
    const fallback = await runWithServerElementRuntime(() =>
      runWithRueServerRenderingFlag(() => instance.render()),
    )
    return renderAppSsrNodeToHtml(fallback, options)
  }
}

function applyDerivedStateFromProps(
  type: unknown,
  instance: InstanceType<AppProtocolClassComponent>,
  props: Record<string, unknown>,
): void {
  const derive = (type as AppErrorBoundaryClassComponent).getDerivedStateFromProps
  if (typeof derive !== 'function') return
  const textState = derive(props, instance.state)
  if (textState && typeof textState === 'object') {
    instance.state = { ...instance.state, ...textState }
  }
}

function isErrorBoundaryClassComponent(type: unknown): type is AppErrorBoundaryClassComponent {
  return (
    isClassComponentType(type) &&
    typeof (type as AppErrorBoundaryClassComponent).getDerivedStateFromError === 'function'
  )
}

function isDynamicLoadableComponent(type: unknown): type is AppDynamicLoadableComponent {
  return (
    typeof type === 'function' &&
    typeof (type as AppDynamicLoadableComponent).__text_dynamic_loader__ === 'function'
  )
}

function runWithAppSsrContextProviderValue<T>(
  context: object,
  value: unknown,
  callback: () => T,
): T {
  return runWithAppSsrContextProviderAliases(
    readAppSsrContextProviderAliases(context),
    value,
    callback,
  )
}

function resolveActiveAppSsrProviderContext(type: unknown, fallbackContext: object): object {
  return (
    readTextCompatContextProviderContext(type) ??
    readRueContextProviderContext(type) ??
    fallbackContext
  )
}

function readAppSsrContextProviderAliases(context: object): object[] {
  const aliases = [context]
  const compatRuntimeContext = (context as { compatRuntimeContext?: unknown }).compatRuntimeContext
  if (
    typeof compatRuntimeContext === 'object' &&
    compatRuntimeContext !== null &&
    compatRuntimeContext !== context
  ) {
    aliases.push(compatRuntimeContext)
  }
  const nativeTextContext = (context as { nativeTextContext?: unknown }).nativeTextContext
  if (
    typeof nativeTextContext === 'object' &&
    nativeTextContext !== null &&
    nativeTextContext !== context &&
    nativeTextContext !== compatRuntimeContext
  ) {
    aliases.push(nativeTextContext)
  }
  return aliases
}

function runWithAppSsrContextProviderAliases<T>(
  aliases: readonly object[],
  value: unknown,
  callback: () => T,
): T {
  const [context, ...rest] = aliases
  if (!context) return callback()
  return runWithTextCompatContextProviderValue(context, value, () =>
    runWithServerElementContextValue(context, value, () =>
      runWithAppSsrContextProviderAliases(rest, value, callback),
    ),
  )
}

function readRueContextProviderContext(type: unknown): object | null {
  if ((typeof type !== 'object' && typeof type !== 'function') || type === null) return null
  const context = (type as { [RUE_CONTEXT_PROVIDER_CONTEXT_PROP]?: unknown })[
    RUE_CONTEXT_PROVIDER_CONTEXT_PROP
  ]
  return typeof context === 'object' && context !== null ? context : null
}

const CLIENT_HOOK_NAMES = [
  'useState',
  'useSignal',
  'useEffect',
  'useReducer',
  'useRef',
  'useContext',
  'useLayoutEffect',
  'useInsertionEffect',
  'useSyncExternalStore',
  'useTransition',
  'useImperativeHandle',
  'useDeferredValue',
  'useActionState',
  'useOptimistic',
  'useEffectEvent',
]
const CLIENT_HOOK_PATTERN = new RegExp(
  `\\b(${CLIENT_HOOK_NAMES.join('|')})\\b.*(?:is not a function|only works in Client Components)`,
)

function rewriteRueClientHookError(error: unknown): void {
  if (!(error instanceof Error)) return
  const match = error.message.match(CLIENT_HOOK_PATTERN)
  if (match) {
    error.message = buildClientHookErrorMessage(`${match[1]}()`)
  }
}

function isRueClientHookError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return CLIENT_HOOK_PATTERN.test(error.message)
}

function renderStreamedErrorMarker(error: unknown, digest: string | null): string {
  const message = error instanceof Error ? error.message : String(error)
  const detail = digest ? `${message} ${digest}` : message
  return `<!--${escapeHtmlText(`Switched to client rendering ${detail}`)}-->`
}

function isClassComponentType(type: unknown): boolean {
  return (
    typeof type === 'function' &&
    !!(type as { prototype?: { render?: unknown } }).prototype &&
    typeof (type as { prototype?: { render?: unknown } }).prototype?.render === 'function'
  )
}

function isThenable<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
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

function enterAppClientReferenceSsr(): () => void {
  const globalState = globalThis as Record<symbol, unknown>
  const previous = globalState[TEXT_CLIENT_REFERENCE_SSR_KEY]
  const previousCount = typeof previous === 'number' ? previous : 0
  globalState[TEXT_CLIENT_REFERENCE_SSR_KEY] = previousCount + 1

  return () => {
    if (previous === undefined) {
      delete globalState[TEXT_CLIENT_REFERENCE_SSR_KEY]
    } else {
      globalState[TEXT_CLIENT_REFERENCE_SSR_KEY] = previous
    }
  }
}

function runWithAppClientReferenceSsr<T>(callback: () => T): T {
  const restore = enterAppClientReferenceSsr()
  let restoreOnReturn = true
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

function stringToAppSsrStream(value: string): AppSsrReadableStream {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(value))
      controller.close()
    },
  }) as AppSsrReadableStream
}

function normalizeAppDocumentHtml(html: string): string {
  const htmlMatch = /<html\b[^>]*>/i.exec(html)
  if (!htmlMatch || htmlMatch.index <= 0) return html

  const headHtml = html.slice(0, htmlMatch.index)
  if (!headHtml.trim()) return html

  const htmlOpenEnd = htmlMatch.index + htmlMatch[0].length
  const afterHtmlOpen = html.slice(htmlOpenEnd)
  const headMatch = /^\s*<head\b[^>]*>/i.exec(afterHtmlOpen)
  if (headMatch) {
    const headOpenEnd = htmlOpenEnd + headMatch.index + headMatch[0].length
    return html.slice(htmlMatch.index, headOpenEnd) + headHtml + html.slice(headOpenEnd)
  }

  return `${htmlMatch[0]}<head>${headHtml}</head>${afterHtmlOpen}`
}

function readActivePageValueForObjectSlotLeak(): unknown {
  const elements = readCurrentSsrAppElementsFallback()
  if (!elements) return null

  const routeId = elements[AppElementsWire.keys.route]
  if (typeof routeId !== 'string') return null

  const routeKey = AppElementsWire.parseElementKey(routeId)
  const pageId =
    routeKey?.kind === 'page'
      ? routeId
      : routeKey?.kind === 'route'
        ? AppElementsWire.encodePageId(routeKey.path, routeKey.interceptionContext)
        : null
  if (!pageId) return null

  const nextElements = readCurrentSsrAppElementsFallback(pageId)
  if (!nextElements || !Object.hasOwn(nextElements, pageId)) return null
  return nextElements[pageId]
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

async function replaceAppSsrObjectSlotLeak(
  html: string,
  options: { onError?: (error: unknown) => string | undefined },
): Promise<string> {
  if (!html.includes('[object Object]')) return html
  const pageValue = readActivePageValueForObjectSlotLeak()
  const pageHtml =
    readTextRueHtml(pageValue) ??
    (pageValue == null
      ? null
      : await renderAppSsrNodeToHtml(pageValue, {
          mode: 'full',
          onError: options.onError,
        }))
  return pageHtml === null ? html : html.replaceAll('[object Object]', pageHtml)
}

function renderBootstrapModules(options: AppSsrRenderOptions): string {
  return (options.bootstrapModules ?? [])
    .map(src => {
      const nonce = options.nonce ? ` nonce="${escapeHtmlAttribute(options.nonce)}"` : ''
      return `<script type="module" src="${escapeHtmlAttribute(src)}"${nonce}></script>`
    })
    .join('')
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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
