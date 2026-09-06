import { APP_ROUTE_KEY, isAppElementsRecord, type AppElements } from '../src/server/app-elements.js'
import {
  AppServerFragment,
  AppServerSuspense,
  createAppServerElement,
  isAppServerProtocolElement,
  type AppServerComponent,
  type AppServerRenderable,
} from '../src/server/app-server-tree.js'
import { readAppSlotPlaceholderSentinel } from '../src/server/app-slot-placeholder-protocol.js'
import { TextCompatFragment, TextCompatSuspense } from '../src/shims/component-adapter.js'
import {
  beginCurrentSsrLayoutSegmentMap,
  clearCurrentSsrLayoutSegmentMap,
} from '../src/shims/navigation.js'
import {
  ChildrenContext,
  ElementsContext,
  ParallelSlotsContext,
  beginCurrentSsrAppElements,
  clearCurrentSsrAppElements,
  setCurrentSsrAppElements,
} from '../src/shims/slot-core.js'
import {
  readTextCompatContextProviderContext,
  readTextCompatContextProviderValue,
  runWithTextCompatContextProviderValue,
} from '../src/shims/context-provider-adapter.js'
import {
  deleteContextRuntime,
  readContextRuntime,
  setContextRuntime,
} from '../src/shims/context-runtime-global.js'

export type TestServerComponent<P = Record<string, unknown>> = AppServerComponent<P>
export type TestServerNode = AppServerRenderable

export const Fragment = AppServerFragment

const RUE_SERVER_OPERATION = Symbol.for('rue.server.operation')
const RUE_COMPILED_COMPONENT_FACTORY_KEY = '__rue_compiled_component_factory__'
const RUE_COMPILED_COMPONENT_READ_PROPS_KEY = '__rue_compiled_component_read_props__'

type TestContext<T> = {
  defaultValue: T
  stack: T[]
  Provider: TestContextProvider<T>
}

type TestContextProvider<T> = ((props: {
  value: T
  children?: AppServerRenderable
}) => AppServerRenderable) & {
  testContext?: TestContext<T>
}

type TestContextProviderElement<T = unknown> = {
  $$typeof: symbol
  aliasContext: object | null
  context: TestContext<T>
  value: T
  children: unknown
}

type TestContextRuntime = {
  createContext: <T>(defaultValue: T) => TestContext<T>
  createElement: (
    type: unknown,
    props: Record<string, unknown> | null,
    ...children: unknown[]
  ) => unknown
  startTransition: (callback: () => void) => void
  useContext: <T>(context: TestContext<T>) => T
  useEffect: () => void
  useRef: <T>(initialValue: T) => { current: T }
  useState: <T>(initialState: T | (() => T)) => [T, (value: T | ((previous: T) => T)) => void]
  useSyncExternalStore: <T>(
    subscribe: (onStoreChange: () => void) => () => void,
    getSnapshot: () => T,
    getServerSnapshot?: () => T,
  ) => T
}

const TEST_CONTEXT_PROVIDER_ELEMENT = Symbol('text.testContextProviderElement')
const RUE_COMPONENT_TYPE_KEY = '__rue_component_type'
const RUE_ELEMENT_HEAD_RECORD = Symbol.for('rue.element.head-record')

const testContextRuntime: TestContextRuntime = {
  createContext(defaultValue) {
    const context: TestContext<typeof defaultValue> = {
      defaultValue,
      stack: [],
      Provider: null as never,
    }
    context.Provider = Object.assign(
      function TestContextProvider(props: {
        value: typeof defaultValue
        children?: AppServerRenderable
      }): AppServerRenderable {
        return createTestContextProviderElement(context, props.value, props.children)
      },
      { testContext: context },
    )
    return context
  },
  createElement(type, props, ...children) {
    const providerContext = readTestContextProvider(type)
    if (providerContext) {
      return createTestContextProviderElement(
        providerContext,
        props?.value,
        children.length === 0 ? props?.children : children.length === 1 ? children[0] : children,
        readTextCompatProviderContextAlias(type),
      )
    }
    return createAppServerElement(
      type as never,
      props as never,
      ...(children as AppServerRenderable[]),
    )
  },
  startTransition(callback) {
    callback()
  },
  useContext(context) {
    return context.stack.length > 0
      ? context.stack[context.stack.length - 1]!
      : context.defaultValue
  },
  useEffect() {},
  useRef(initialValue) {
    return { current: initialValue }
  },
  useState(initialState) {
    let state =
      typeof initialState === 'function' ? (initialState as () => unknown)() : initialState
    const setState = (value: unknown) => {
      state = typeof value === 'function' ? (value as (previous: unknown) => unknown)(state) : value
    }
    return [state, setState] as never
  },
  useSyncExternalStore(_subscribe, getSnapshot, getServerSnapshot) {
    const serverRenderingCount = (globalThis as Record<string, unknown>).__rue_is_server_rendering__
    const isServerRendering = typeof serverRenderingCount === 'number' && serverRenderingCount > 0
    return (typeof window === 'undefined' || isServerRendering) && getServerSnapshot
      ? getServerSnapshot()
      : getSnapshot()
  },
}

export function createElement<P = Record<string, unknown>>(
  type: string | AppServerComponent<P> | typeof AppServerFragment | typeof AppServerSuspense,
  props?: (P & { key?: unknown }) | null,
  ...children: AppServerRenderable[]
): AppServerRenderable {
  return createAppServerElement(type, props, ...children)
}

export function createStreamFromMarkup(markup: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(markup))
      controller.close()
    },
  })
}

export function renderAppServerElementToStream(
  element: AppServerRenderable | AppElements,
): ReadableStream<Uint8Array> {
  return createStreamFromMarkup(renderAppServerElementToHtml(element))
}

export function renderAppServerElementToStreamAsync(
  element: AppServerRenderable | AppElements,
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          new TextEncoder().encode(await renderAppServerElementToHtmlAsync(element)),
        )
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })
}

export function renderAppServerElementToHtml(element: AppServerRenderable | AppElements): string {
  const globalRecord = globalThis as Record<string, unknown>
  const previousServerRenderingCount =
    typeof globalRecord.__rue_is_server_rendering__ === 'number'
      ? (globalRecord.__rue_is_server_rendering__ as number)
      : 0
  const previousContextRuntime = readContextRuntime<unknown>()
  const hadPreviousContextRuntime = previousContextRuntime !== undefined
  globalRecord.__rue_is_server_rendering__ = previousServerRenderingCount + 1
  setContextRuntime(testContextRuntime)
  beginCurrentSsrAppElements()
  beginCurrentSsrLayoutSegmentMap()
  try {
    return renderAppServerNodeToHtml(readRenderableEntry(element))
  } finally {
    clearCurrentSsrAppElements()
    clearCurrentSsrLayoutSegmentMap()
    restorePreviousContextRuntime(previousContextRuntime, hadPreviousContextRuntime)
    if (previousServerRenderingCount > 0) {
      globalRecord.__rue_is_server_rendering__ = previousServerRenderingCount
    } else {
      delete globalRecord.__rue_is_server_rendering__
    }
  }
}

export async function renderAppServerElementToHtmlAsync(
  element: AppServerRenderable | AppElements,
): Promise<string> {
  const globalRecord = globalThis as Record<string, unknown>
  const previousServerRenderingCount =
    typeof globalRecord.__rue_is_server_rendering__ === 'number'
      ? (globalRecord.__rue_is_server_rendering__ as number)
      : 0
  const previousContextRuntime = readContextRuntime<unknown>()
  const hadPreviousContextRuntime = previousContextRuntime !== undefined
  globalRecord.__rue_is_server_rendering__ = previousServerRenderingCount + 1
  setContextRuntime(testContextRuntime)
  beginCurrentSsrAppElements()
  beginCurrentSsrLayoutSegmentMap()
  try {
    return await renderAppServerNodeToHtmlAsync(readRenderableEntry(element))
  } finally {
    clearCurrentSsrAppElements()
    clearCurrentSsrLayoutSegmentMap()
    restorePreviousContextRuntime(previousContextRuntime, hadPreviousContextRuntime)
    if (previousServerRenderingCount > 0) {
      globalRecord.__rue_is_server_rendering__ = previousServerRenderingCount
    } else {
      delete globalRecord.__rue_is_server_rendering__
    }
  }
}

function readRenderableEntry(element: AppServerRenderable | AppElements): unknown {
  if (!isAppElementsRecord(element)) {
    return element
  }

  setCurrentSsrAppElements(element)
  const routeId = element[APP_ROUTE_KEY]
  if (typeof routeId === 'string' && routeId in element) {
    return element[routeId]
  }

  return JSON.stringify(element)
}

async function renderAppServerNodeToHtmlAsync(node: unknown): Promise<string> {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return ''
  }
  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'bigint') {
    return escapeHtml(String(node))
  }
  if (Array.isArray(node)) {
    let html = ''
    for (const item of node) {
      html += await renderAppServerNodeToHtmlAsync(item)
    }
    return html
  }
  if (isThenable(node)) {
    return renderAppServerNodeToHtmlAsync(await node)
  }
  if (isTestContextProviderElement(node)) {
    return renderWithTestContextProviderAsync(node)
  }
  const textElement = readTextCompatibleElement(node)
  if (textElement) {
    return renderTextCompatibleElementToHtmlAsync(textElement)
  }
  if (!isAppServerProtocolElement(node)) {
    return renderInvalidNodeToHtml(node)
  }

  const element = node as {
    type: unknown
    props?: Record<string, unknown> | null
  }
  const props = element.props ?? {}
  const children = props.children
  const slotPlaceholder = readAppSlotPlaceholderSentinel(element.type, props)
  if (slotPlaceholder?.kind === 'children') {
    const provided = readTextCompatContextProviderValue<AppServerRenderable>(
      ChildrenContext as object,
    )
    return provided.found ? renderAppServerNodeToHtmlAsync(provided.value) : ''
  }
  if (slotPlaceholder?.kind === 'parallel-slot') {
    const provided = readTextCompatContextProviderValue<Readonly<
      Record<string, AppServerRenderable>
    > | null>(ParallelSlotsContext as object)
    const slotValue = provided.found ? (provided.value?.[slotPlaceholder.name ?? ''] ?? null) : null
    return renderAppServerNodeToHtmlAsync(slotValue)
  }

  if (element.type === AppServerFragment || element.type === TextCompatFragment) {
    return renderAppServerFragmentChildrenToHtmlAsync(children)
  }
  if (element.type === AppServerSuspense || element.type === TextCompatSuspense) {
    return renderSuspenseElementToHtmlAsync(children, props.fallback)
  }

  const providerContext = readTestContextProviderContext(element.type)
  if (providerContext) {
    return runWithTextCompatProviderAlias(element.type, props.value, () =>
      renderWithTestContextProviderAsync(
        createTestContextProviderElement(
          providerContext,
          props.value,
          children,
          readTextCompatProviderContextAlias(element.type),
        ),
      ),
    )
  }
  const markedProviderContext = readTextCompatContextProviderContext(element.type)
  if (markedProviderContext) {
    return runWithMarkedTextCompatProvider(element.type, markedProviderContext, props.value, () =>
      renderAppServerNodeToHtmlAsync(children),
    )
  }

  if (isTestClassComponentType(element.type)) {
    const Component = element.type
    const instance = new Component(props)
    return renderAppServerNodeToHtmlAsync(instance.render())
  }

  if (typeof element.type === 'function') {
    return renderAppServerNodeToHtmlAsync(element.type(props))
  }

  if (typeof element.type !== 'string') {
    return renderAppServerNodeToHtmlAsync(children)
  }

  const tagName = element.type
  const innerHtml = readDangerouslySetInnerHtml(props)
  const body = innerHtml ?? (await renderAppServerNodeToHtmlAsync(children))
  const attrs = renderAttributes(props)
  if (VOID_ELEMENTS.has(tagName.toLowerCase())) {
    return `<${tagName}${attrs}>`
  }
  return `<${tagName}${attrs}>${body}</${tagName}>`
}

function renderAppServerNodeToHtml(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return ''
  }
  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'bigint') {
    return escapeHtml(String(node))
  }
  if (Array.isArray(node)) {
    return node.map(renderAppServerNodeToHtml).join('')
  }
  if (isThenable(node)) {
    throw new Error('[text:test] Async server protocol elements are not supported by this helper')
  }
  if (
    typeof node === 'object' &&
    node !== null &&
    RUE_SERVER_OPERATION in (node as Record<PropertyKey, unknown>)
  ) {
    const operation = node as Record<PropertyKey, unknown>
    const children = Array.isArray(operation.children) ? operation.children : []
    if (operation[RUE_SERVER_OPERATION] === 'fragment') {
      return renderAppServerNodeToHtml(children)
    }
    return renderAppServerNodeToHtml(
      createAppServerElement(
        operation.type as never,
        operation.props && typeof operation.props === 'object'
          ? (operation.props as Record<string, unknown>)
          : null,
        ...(children as never[]),
      ),
    )
  }
  if (
    typeof node === 'object' &&
    node !== null &&
    typeof (node as Record<string, unknown>)[RUE_COMPILED_COMPONENT_FACTORY_KEY] === 'function'
  ) {
    const handle = node as Record<string, unknown>
    const readProps = handle[RUE_COMPILED_COMPONENT_READ_PROPS_KEY]
    const props = typeof readProps === 'function' ? readProps() : null
    return renderAppServerNodeToHtml(
      createAppServerElement(
        handle[RUE_COMPILED_COMPONENT_FACTORY_KEY] as never,
        props && typeof props === 'object' ? (props as Record<string, unknown>) : null,
      ),
    )
  }
  if (isTestContextProviderElement(node)) {
    return renderWithTestContextProvider(node)
  }
  const textElement = readTextCompatibleElement(node)
  if (textElement) {
    return renderTextCompatibleElementToHtml(textElement)
  }
  if (!isAppServerProtocolElement(node)) {
    return renderInvalidNodeToHtml(node)
  }

  const element = node as {
    type: unknown
    props?: Record<string, unknown> | null
  }
  const props = element.props ?? {}
  const children = props.children
  const slotPlaceholder = readAppSlotPlaceholderSentinel(element.type, props)
  if (slotPlaceholder?.kind === 'children') {
    const provided = readTextCompatContextProviderValue<AppServerRenderable>(
      ChildrenContext as object,
    )
    return provided.found ? renderAppServerNodeToHtml(provided.value) : ''
  }
  if (slotPlaceholder?.kind === 'parallel-slot') {
    const provided = readTextCompatContextProviderValue<Readonly<
      Record<string, AppServerRenderable>
    > | null>(ParallelSlotsContext as object)
    const slotValue = provided.found ? (provided.value?.[slotPlaceholder.name ?? ''] ?? null) : null
    return renderAppServerNodeToHtml(slotValue)
  }

  if (element.type === AppServerFragment || element.type === TextCompatFragment) {
    return renderAppServerNodeToHtml(children)
  }
  if (element.type === AppServerSuspense || element.type === TextCompatSuspense) {
    return renderSuspenseElementToHtml(children, props.fallback)
  }

  const providerContext = readTestContextProviderContext(element.type)
  if (providerContext) {
    return runWithTextCompatProviderAlias(element.type, props.value, () =>
      renderWithTestContextProvider(
        createTestContextProviderElement(
          providerContext,
          props.value,
          children,
          readTextCompatProviderContextAlias(element.type),
        ),
      ),
    )
  }
  const markedProviderContext = readTextCompatContextProviderContext(element.type)
  if (markedProviderContext) {
    return runWithMarkedTextCompatProvider(element.type, markedProviderContext, props.value, () =>
      renderAppServerNodeToHtml(children),
    )
  }

  if (isTestClassComponentType(element.type)) {
    const Component = element.type
    const instance = new Component(props)
    return renderAppServerNodeToHtml(instance.render())
  }

  if (typeof element.type === 'function') {
    return renderAppServerNodeToHtml(element.type(props))
  }

  if (typeof element.type !== 'string') {
    return renderAppServerNodeToHtml(children)
  }

  const tagName = element.type
  const innerHtml = readDangerouslySetInnerHtml(props)
  const body = innerHtml ?? renderAppServerNodeToHtml(children)
  const attrs = renderAttributes(props)
  if (VOID_ELEMENTS.has(tagName.toLowerCase())) {
    return `<${tagName}${attrs}>`
  }
  return `<${tagName}${attrs}>${body}</${tagName}>`
}

function renderAttributes(props: Record<string, unknown>): string {
  const attrs: string[] = []

  for (const [rawName, value] of Object.entries(props)) {
    if (
      rawName === 'children' ||
      rawName === 'dangerouslySetInnerHTML' ||
      rawName === 'key' ||
      rawName === 'ref' ||
      rawName === 'suppressHydrationWarning' ||
      value === null ||
      value === undefined ||
      value === false ||
      typeof value === 'function'
    ) {
      continue
    }

    const name = rawName === 'className' ? 'class' : rawName
    if (value === true) {
      attrs.push(name)
      continue
    }
    if (name === 'style' && typeof value === 'object') {
      attrs.push(`style="${escapeAttribute(renderStyle(value as Record<string, unknown>))}"`)
      continue
    }
    attrs.push(`${name}="${escapeAttribute(String(value))}"`)
  }

  return attrs.length > 0 ? ` ${attrs.join(' ')}` : ''
}

function readDangerouslySetInnerHtml(props: Record<string, unknown>): string | null {
  const inner = props.dangerouslySetInnerHTML
  if (typeof inner !== 'object' || inner === null) {
    return null
  }
  const html = (inner as { __html?: unknown }).__html
  return html === undefined || html === null ? '' : String(html)
}

function renderStyle(style: Record<string, unknown>): string {
  const declarations: string[] = []
  for (const [rawName, value] of Object.entries(style)) {
    if (value === null || value === undefined || value === false) {
      continue
    }
    const name = rawName.startsWith('--')
      ? rawName
      : rawName.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)
    declarations.push(`${name}:${String(value)}`)
  }
  return declarations.join(';')
}

function renderInvalidNodeToHtml(node: unknown): string {
  if (typeof node === 'object' || typeof node === 'function') {
    throw new Error('[text:test] Objects are not valid as App Server renderable children.')
  }
  return escapeHtml(String(node))
}

function createTestContextProviderElement<T>(
  context: TestContext<T>,
  value: unknown,
  children: unknown,
  aliasContext: object | null = null,
): TestContextProviderElement<T> {
  return {
    $$typeof: TEST_CONTEXT_PROVIDER_ELEMENT,
    aliasContext,
    context,
    value: value as T,
    children,
  }
}

function isTestContextProviderElement(value: unknown): value is TestContextProviderElement {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { $$typeof?: unknown }).$$typeof === TEST_CONTEXT_PROVIDER_ELEMENT
  )
}

function readTestContextProvider(value: unknown): TestContext<unknown> | null {
  if (typeof value !== 'function') return null
  const context = (value as TestContextProvider<unknown>).testContext
  return context ?? null
}

function readTestContextProviderContext(value: unknown): TestContext<unknown> | null {
  return readTestContextProvider(value) ?? readMarkedTestContextProviderContext(value)
}

function readMarkedTestContextProviderContext(value: unknown): TestContext<unknown> | null {
  const context = readTextCompatContextProviderContext(value)
  return isTestContext(context) ? context : null
}

function readTextCompatProviderContextAlias(type: unknown): object | null {
  const providerContext = readTextCompatContextProviderContext(type)
  if (isTextCompatProviderType(type, providerContext, ElementsContext)) {
    return ElementsContext as object
  }
  if (isTextCompatProviderType(type, providerContext, ChildrenContext)) {
    return ChildrenContext as object
  }
  if (isTextCompatProviderType(type, providerContext, ParallelSlotsContext)) {
    return ParallelSlotsContext as object
  }
  return null
}

function isTextCompatProviderType(
  type: unknown,
  providerContext: object | null,
  context: object,
): boolean {
  if (type === (context as { Provider?: unknown }).Provider) return true
  if (!providerContext) return false
  if (providerContext === context) return true
  const rueContext = (context as { rueContext?: unknown }).rueContext
  if (typeof rueContext === 'object' && rueContext !== null && providerContext === rueContext) {
    return true
  }
  const runtimeContext = (context as { compatRuntimeContext?: unknown }).compatRuntimeContext
  if (
    typeof runtimeContext === 'object' &&
    runtimeContext !== null &&
    providerContext === runtimeContext
  ) {
    return true
  }
  const runtimeContexts = (context as { compatRuntimeContexts?: WeakMap<object, unknown> })
    .compatRuntimeContexts
  const testRuntimeContext = runtimeContexts?.get(testContextRuntime.createContext as object)
  return (
    typeof testRuntimeContext === 'object' &&
    testRuntimeContext !== null &&
    providerContext === testRuntimeContext
  )
}

function runWithMarkedTextCompatProvider<T>(
  type: unknown,
  context: object,
  value: unknown,
  callback: () => T,
): T {
  const runWithPrimaryProvider = () =>
    runWithTextCompatContextProviderValue(context, value, callback)
  const aliasContext = readTextCompatProviderContextAlias(type)
  return aliasContext
    ? runWithTextCompatContextProviderValue(aliasContext, value, runWithPrimaryProvider)
    : runWithPrimaryProvider()
}

function runWithTextCompatProviderAlias<T>(type: unknown, value: unknown, callback: () => T): T {
  const aliasContext = readTextCompatProviderContextAlias(type)
  return aliasContext
    ? runWithTextCompatContextProviderValue(aliasContext, value, callback)
    : callback()
}

function isTestContext(value: unknown): value is TestContext<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { stack?: unknown }).stack) &&
    typeof (value as { Provider?: unknown }).Provider === 'function'
  )
}

function isTestClassComponentType(
  value: unknown,
): value is new (props: Record<string, unknown>) => { render: () => unknown } {
  return (
    typeof value === 'function' &&
    !!(value as { prototype?: { render?: unknown } }).prototype &&
    typeof (value as { prototype?: { render?: unknown } }).prototype?.render === 'function'
  )
}

type TextCompatibleElement = {
  type: unknown
  props: Record<string, unknown> | null
}

function readTextCompatibleElement(value: unknown): TextCompatibleElement | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const record = value as Record<PropertyKey, unknown>
  if (RUE_COMPONENT_TYPE_KEY in record) {
    return {
      type: record[RUE_COMPONENT_TYPE_KEY],
      props: normalizeTextCompatibleProps(record.props),
    }
  }

  const headRecord = record[RUE_ELEMENT_HEAD_RECORD]
  if (typeof headRecord === 'object' && headRecord !== null) {
    const head = headRecord as { type?: unknown; props?: unknown }
    if ('type' in head) {
      return {
        type: head.type,
        props: normalizeTextCompatibleProps(head.props),
      }
    }
  }
  return null
}

function normalizeTextCompatibleProps(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

function renderTextCompatibleElementToHtml(element: TextCompatibleElement): string {
  const props = element.props ?? {}
  const children = props.children
  const slotPlaceholder = readAppSlotPlaceholderSentinel(element.type, props)
  if (slotPlaceholder?.kind === 'children') {
    const provided = readTextCompatContextProviderValue<AppServerRenderable>(
      ChildrenContext as object,
    )
    return provided.found ? renderAppServerNodeToHtml(provided.value) : ''
  }
  if (slotPlaceholder?.kind === 'parallel-slot') {
    const provided = readTextCompatContextProviderValue<Readonly<
      Record<string, AppServerRenderable>
    > | null>(ParallelSlotsContext as object)
    const slotValue = provided.found ? (provided.value?.[slotPlaceholder.name ?? ''] ?? null) : null
    return renderAppServerNodeToHtml(slotValue)
  }
  const providerContext = readTestContextProviderContext(element.type)
  if (providerContext) {
    return runWithTextCompatProviderAlias(element.type, props.value, () =>
      renderWithTestContextProvider(
        createTestContextProviderElement(
          providerContext,
          props.value,
          children,
          readTextCompatProviderContextAlias(element.type),
        ),
      ),
    )
  }
  const markedProviderContext = readTextCompatContextProviderContext(element.type)
  if (markedProviderContext) {
    return runWithMarkedTextCompatProvider(element.type, markedProviderContext, props.value, () =>
      renderAppServerNodeToHtml(children),
    )
  }
  if (isTestClassComponentType(element.type)) {
    const Component = element.type
    const instance = new Component(props)
    return renderAppServerNodeToHtml(instance.render())
  }
  if (typeof element.type === 'function') {
    return renderAppServerNodeToHtml(element.type(props))
  }
  if (typeof element.type !== 'string') {
    return renderAppServerNodeToHtml(children)
  }

  const innerHtml = readDangerouslySetInnerHtml(props)
  const body = innerHtml ?? renderAppServerNodeToHtml(children)
  const attrs = renderAttributes(props)
  if (VOID_ELEMENTS.has(element.type.toLowerCase())) {
    return `<${element.type}${attrs}>`
  }
  return `<${element.type}${attrs}>${body}</${element.type}>`
}

async function renderTextCompatibleElementToHtmlAsync(
  element: TextCompatibleElement,
): Promise<string> {
  const props = element.props ?? {}
  const children = props.children
  const slotPlaceholder = readAppSlotPlaceholderSentinel(element.type, props)
  if (slotPlaceholder?.kind === 'children') {
    const provided = readTextCompatContextProviderValue<AppServerRenderable>(
      ChildrenContext as object,
    )
    return provided.found ? renderAppServerNodeToHtmlAsync(provided.value) : ''
  }
  if (slotPlaceholder?.kind === 'parallel-slot') {
    const provided = readTextCompatContextProviderValue<Readonly<
      Record<string, AppServerRenderable>
    > | null>(ParallelSlotsContext as object)
    const slotValue = provided.found ? (provided.value?.[slotPlaceholder.name ?? ''] ?? null) : null
    return renderAppServerNodeToHtmlAsync(slotValue)
  }
  const providerContext = readTestContextProviderContext(element.type)
  if (providerContext) {
    return runWithTextCompatProviderAlias(element.type, props.value, () =>
      renderWithTestContextProviderAsync(
        createTestContextProviderElement(
          providerContext,
          props.value,
          children,
          readTextCompatProviderContextAlias(element.type),
        ),
      ),
    )
  }
  const markedProviderContext = readTextCompatContextProviderContext(element.type)
  if (markedProviderContext) {
    return runWithMarkedTextCompatProvider(element.type, markedProviderContext, props.value, () =>
      renderAppServerNodeToHtmlAsync(children),
    )
  }
  if (isTestClassComponentType(element.type)) {
    const Component = element.type
    const instance = new Component(props)
    return renderAppServerNodeToHtmlAsync(instance.render())
  }
  if (typeof element.type === 'function') {
    return renderAppServerNodeToHtmlAsync(element.type(props))
  }
  if (typeof element.type !== 'string') {
    return renderAppServerNodeToHtmlAsync(children)
  }

  const innerHtml = readDangerouslySetInnerHtml(props)
  const body = innerHtml ?? (await renderAppServerNodeToHtmlAsync(children))
  const attrs = renderAttributes(props)
  if (VOID_ELEMENTS.has(element.type.toLowerCase())) {
    return `<${element.type}${attrs}>`
  }
  return `<${element.type}${attrs}>${body}</${element.type}>`
}

function renderWithTestContextProvider(element: TestContextProviderElement): string {
  element.context.stack.push(element.value)
  try {
    const renderChildren = () => renderAppServerNodeToHtml(element.children)
    return element.aliasContext
      ? runWithTextCompatContextProviderValue(element.aliasContext, element.value, renderChildren)
      : renderChildren()
  } finally {
    element.context.stack.pop()
  }
}

async function renderWithTestContextProviderAsync(
  element: TestContextProviderElement,
): Promise<string> {
  element.context.stack.push(element.value)
  try {
    const renderChildren = () => renderAppServerNodeToHtmlAsync(element.children)
    return element.aliasContext
      ? await runWithTextCompatContextProviderValue(
          element.aliasContext,
          element.value,
          renderChildren,
        )
      : await renderChildren()
  } finally {
    element.context.stack.pop()
  }
}

function renderSuspenseElementToHtml(children: unknown, fallback: unknown): string {
  try {
    return renderAppServerNodeToHtml(children)
  } catch (cause) {
    if (isThenable(cause)) {
      return renderAppServerNodeToHtml(fallback)
    }
    throw cause
  }
}

async function renderSuspenseElementToHtmlAsync(
  children: unknown,
  _fallback: unknown,
): Promise<string> {
  try {
    return await renderAppServerNodeToHtmlAsync(children)
  } catch (cause) {
    if (!isThenable(cause)) {
      throw cause
    }
    await cause
    return renderAppServerNodeToHtmlAsync(children)
  }
}

async function renderAppServerFragmentChildrenToHtmlAsync(children: unknown): Promise<string> {
  if (!Array.isArray(children)) {
    return renderAppServerNodeToHtmlAsync(children)
  }
  const parts = await Promise.all(children.map(renderAppServerNodeToHtmlAsync))
  return parts.join('')
}

function restorePreviousContextRuntime(
  previousContextRuntime: unknown,
  hadPreviousContextRuntime: boolean,
): void {
  if (hadPreviousContextRuntime) {
    setContextRuntime(previousContextRuntime)
  } else {
    deleteContextRuntime()
  }
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;')
}

const VOID_ELEMENTS = new Set([
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
