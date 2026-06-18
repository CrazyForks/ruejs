import type { TextNode as RueRenderableOutput } from '../runtime/render-protocol.js'
import { isThenableParams } from '../shims/thenable-params.js'
import type {
  TextCompatComponentType,
  TextCompatElement,
  TextCompatNode,
} from '../shims/text-compat-types.js'
import {
  ServerProtocolFragment,
  ServerProtocolSuspense,
  createServerProtocolElement,
  isServerProtocolElement,
  normalizeServerProtocolType,
} from './element-protocol.js'
import { isAppRscServerClientReference } from './app-rsc-client-reference-protocol.js'
import {
  hasAppClientReferenceResolver,
  resolveAppClientReference,
} from './app-client-reference-resolver.js'
import { renderRueRenderableForRsc } from './app-rsc-html-bridge.js'
import {
  markAppRenderDependencySsrUnwrap,
  readAppRenderDependencySsrUnwrap,
} from './app-render-dependency-protocol.js'
import {
  isAppSsrPassthroughComponent,
  markAppSsrPassthroughComponent,
} from './app-ssr-passthrough-protocol.js'
import {
  APP_SLOT_PLACEHOLDER_SENTINEL_TYPE,
  createAppSlotPlaceholderSentinelProps,
  markAppSlotPlaceholderComponent,
  readAppSlotPlaceholderKind,
  readAppSlotPlaceholderSentinel,
} from './app-slot-placeholder-protocol.js'
import {
  markTextCompatContextProvider,
  readTextCompatContextProviderValue,
  readTextCompatContextProviderContext,
  runWithTextCompatContextProviderValue,
} from '../shims/context-provider-adapter.js'
import { writeSsrCompatContextProviderValue } from '../shims/rue-ssr-compat.js'
import { ChildrenContext, ElementsContext, ParallelSlotsContext } from '../shims/slot-core.js'
import { setCurrentSsrLayoutSegmentMap, type SegmentMap } from '../shims/navigation.js'
import { isRueRenderableHandle } from './renderable.js'
import { runWithServerElementRuntime } from './server-element-runtime.js'

export type AppServerRenderable = TextCompatNode | RueRenderableOutput

export type AppServerComponent<P = Record<string, unknown>> =
  | TextCompatComponentType<P>
  | ((props: P) => AppServerRenderable)

export const AppServerFragment = ServerProtocolFragment
export const AppServerSuspense = ServerProtocolSuspense

const appServerComponentAdapterCache = new WeakMap<
  Function,
  TextCompatComponentType<Record<string, unknown>>
>()
const appInlineSsrComponentAdapterCache = new WeakMap<
  Function,
  TextCompatComponentType<Record<string, unknown>>
>()
const appSsrComponentAdapterCache = new WeakMap<
  Function,
  TextCompatComponentType<Record<string, unknown>>
>()
const appServerComponentAdapterSourceTypes = new WeakMap<Function, Function>()
const appSsrClientReferenceAdapterCache = new WeakMap<
  Function,
  TextCompatComponentType<Record<string, unknown>>
>()
const appSsrClientReferencePassthroughAdapterCache = new WeakMap<
  Function,
  TextCompatComponentType<Record<string, unknown>>
>()
const appServerComponentAdapters = new WeakSet<Function>()
const appSsrComponentAdapters = new WeakSet<Function>()
const TEXT_CLIENT_REFERENCE_SSR_KEY = Symbol.for('text.clientReferenceSsr')
const RUE_CONTEXT_PROVIDER_CONTEXT_PROP = '__rue_context_provider_context__'
const RUE_ELEMENT_HEAD_RECORD = Symbol.for('rue.element.head-record')
const RUE_SUSPENSE_COMPONENT_MARKER = Symbol.for('rue.suspense.component')
const TEXT_DYNAMIC_RESOLVED_COMPONENT_MARKER = Symbol.for('text.dynamic.resolvedComponent')
const TEXT_HEAD_RECORD = Symbol.for('text.head.record')
const APP_LAYOUT_SEGMENT_MAP_PROP = '__textLayoutSegmentMap'
const APP_SSR_ERROR_BOUNDARY_COMPONENT_NAMES = new Set([
  'ErrorBoundary',
  'ForbiddenBoundary',
  'NotFoundBoundary',
  'RedirectBoundary',
  'UnauthorizedBoundary',
])

export function isAppServerProtocolElement(value: unknown): value is TextCompatElement {
  return isServerProtocolElement(value)
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}

function runWithAppClientReferenceSsr<T>(callback: () => T): T {
  const globalState = globalThis as Record<symbol, unknown>
  const previous = globalState[TEXT_CLIENT_REFERENCE_SSR_KEY]
  const previousCount = typeof previous === 'number' ? previous : 0
  globalState[TEXT_CLIENT_REFERENCE_SSR_KEY] = previousCount + 1

  const restore = () => {
    if (previous === undefined) {
      delete globalState[TEXT_CLIENT_REFERENCE_SSR_KEY]
    } else {
      globalState[TEXT_CLIENT_REFERENCE_SSR_KEY] = previous
    }
  }

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

function isTextClassComponent(value: unknown): boolean {
  return (
    typeof value === 'function' &&
    typeof (value as { prototype?: { render?: unknown } }).prototype?.render === 'function'
  )
}

function resolveAppServerComponentResult(
  value: AppServerRenderable,
  options: { htmlSsr?: boolean; inlineSsr?: boolean } = {},
): TextCompatNode | Promise<TextCompatNode> {
  const adaptResolvedRenderable = (resolved: AppServerRenderable) => {
    if (hasAppClientReferenceResolver()) {
      if (options.htmlSsr) return adaptAppServerRenderableForHtmlSsr(resolved)
      if (options.inlineSsr) return adaptAppServerRenderableForSsr(resolved)
    }
    return adaptAppServerRenderable(resolved)
  }

  if (isThenable(value)) {
    return Promise.resolve(value).then(resolved =>
      adaptResolvedRenderable(resolved as AppServerRenderable),
    )
  }

  return adaptResolvedRenderable(value)
}

function adaptRueRenderableForRsc(
  value: RueRenderableOutput,
): TextCompatNode | Promise<TextCompatNode> {
  return renderRueRenderableForRsc(value)
}

function adaptAppServerProtocolProps(
  props: Record<string, unknown> | null | undefined,
  options: AdaptAppServerRenderableOptions,
):
  | { changed: boolean; props: Record<string, unknown> }
  | Promise<{
      changed: boolean
      props: Record<string, unknown>
    }> {
  if (!props) return { changed: false, props: {} }

  const textProps: Record<string, unknown> = {}
  const pendingProps: Promise<void>[] = []
  let changed = false
  for (const [key, propValue] of Object.entries(props)) {
    if (!containsAdaptableAppServerRenderable(propValue, options)) {
      const normalizedPropValue = normalizeAppSsrPropValue(propValue)
      textProps[key] = normalizedPropValue
      if (normalizedPropValue !== propValue) changed = true
      continue
    }
    const adaptedProp = adaptAppServerRenderableWithOptions(
      propValue as AppServerRenderable,
      options,
    )
    if (isThenable(adaptedProp)) {
      pendingProps.push(
        Promise.resolve(adaptedProp).then(resolvedProp => {
          textProps[key] = normalizeAppSsrPropValue(resolvedProp)
        }),
      )
    } else {
      textProps[key] = normalizeAppSsrPropValue(adaptedProp)
    }
    changed = true
  }
  if (pendingProps.length > 0) {
    return Promise.all(pendingProps).then(() => ({ changed, props: textProps }))
  }
  return { changed, props: textProps }
}

function containsAdaptableAppServerRenderable(
  value: unknown,
  options: AdaptAppServerRenderableOptions,
): boolean {
  if (containsThenable(value)) return true
  if (containsRueRenderableHandle(value)) return true
  if (!options.resolveClientReferences) return false
  return containsAppServerProtocolElement(value)
}

function createServerProtocolElementWithType(
  source: TextCompatElement<Record<string, unknown>>,
  type: unknown,
  props: Record<string, unknown>,
): TextCompatElement<Record<string, unknown>> {
  const textProps =
    source.key === null ? props : ({ ...props, key: source.key } as Record<string, unknown>)
  return createServerProtocolElement(type, textProps)
}

function hasServerRenderableChildren(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasServerRenderableChildren)
  if (isAppServerProtocolElement(value)) {
    const element = value as TextCompatElement<Record<string, unknown>>
    if (readAppSlotPlaceholderSentinel(element.type, element.props)) return false
    if (readAppSlotPlaceholderKind(element.type)) return false
  }
  return value !== undefined && value !== null && value !== false
}

function readClientReferenceExportName(type: unknown): string {
  if (!isAppRscServerClientReference(type)) return ''
  const id = (type as { $$id?: unknown }).$$id
  return typeof id === 'string' ? (id.split('#').pop() ?? '') : ''
}

function isProviderLikeClientReference(type: unknown): boolean {
  const exportName = readClientReferenceExportName(type)
  return exportName.endsWith('Provider') || exportName.endsWith('Adapter')
}

function isLinkLikeClientReference(type: unknown): boolean {
  return readClientReferenceExportName(type) === 'Link'
}

function readRueContextProviderContext(type: unknown): object | null {
  if ((typeof type !== 'object' && typeof type !== 'function') || type === null) return null
  const context = (type as { [RUE_CONTEXT_PROVIDER_CONTEXT_PROP]?: unknown })[
    RUE_CONTEXT_PROVIDER_CONTEXT_PROP
  ]
  return typeof context === 'object' && context !== null ? context : null
}

function readRueRenderableHandleType(value: unknown): unknown {
  if (!isRueRenderableHandle(value)) return null
  return (value as { __rue_component_type?: unknown }).__rue_component_type
}

function readRueRenderableHandleProps(value: unknown): Record<string, unknown> {
  if (!isRueRenderableHandle(value)) return {}
  const props = (value as { props?: unknown }).props
  return props && typeof props === 'object' ? (props as Record<string, unknown>) : {}
}

function readRueElementHeadRecord(value: unknown): {
  key?: unknown
  props?: Record<string, unknown> | null
  type: unknown
} | null {
  if (typeof value !== 'object' || value === null) return null
  const record = Reflect.get(value, RUE_ELEMENT_HEAD_RECORD)
  if (typeof record !== 'object' || record === null) return null
  if (Reflect.get(record, TEXT_HEAD_RECORD) !== true) return null
  return record as { key?: unknown; props?: Record<string, unknown> | null; type: unknown }
}

function containsAppServerProtocolOrClientReference(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsAppServerProtocolOrClientReference)
  if (isAppServerProtocolElement(value)) return true
  if (!isRueRenderableHandle(value)) return false

  const type = readRueRenderableHandleType(value)
  if (isAppRscServerClientReference(type)) return true
  if (isRueSuspenseComponentType(type)) return true
  if (isTextDynamicLoadableComponent(type)) return true
  if (isTextDynamicResolvedComponent(type)) return true

  const headRecord = readRueElementHeadRecord(value)
  const props = headRecord?.props ?? readRueRenderableHandleProps(value)
  return Object.values(props).some(containsAppServerProtocolOrClientReference)
}

function isRueSuspenseComponentType(type: unknown): boolean {
  return (
    (typeof type === 'object' || typeof type === 'function') &&
    type !== null &&
    (type as Record<PropertyKey, unknown>)[RUE_SUSPENSE_COMPONENT_MARKER] === true
  )
}

function isTextDynamicLoadableComponent(type: unknown): boolean {
  return (
    typeof type === 'function' &&
    typeof (type as { __text_dynamic_loader__?: unknown }).__text_dynamic_loader__ === 'function'
  )
}

function isTextDynamicResolvedComponent(type: unknown): boolean {
  return (
    typeof type === 'function' &&
    (type as Record<PropertyKey, unknown>)[TEXT_DYNAMIC_RESOLVED_COMPONENT_MARKER] === true
  )
}

function createAppServerProtocolElementFromRueHandle(
  value: Extract<RueRenderableOutput, object>,
): TextCompatNode | null {
  const headRecord = readRueElementHeadRecord(value)
  if (headRecord) {
    const props = headRecord.props ? { ...headRecord.props } : {}
    if (headRecord.key !== null && headRecord.key !== undefined && props.key === undefined) {
      props.key = headRecord.key
    }
    return createServerProtocolElement(headRecord.type, props)
  }

  const type = readRueRenderableHandleType(value)
  if (type === null) return null
  return createServerProtocolElement(type, readRueRenderableHandleProps(value))
}

function readProviderContextEntryFromRenderable(
  value: unknown,
): { context: object; type: unknown; value: unknown } | null {
  if (isAppServerProtocolElement(value)) {
    const element = value as TextCompatElement<Record<string, unknown>>
    const context =
      readTextCompatContextProviderContext(element.type) ??
      readRueContextProviderContext(element.type)
    if (!context) return null
    return {
      context,
      type: element.type,
      value: (element.props as { value?: unknown } | null | undefined)?.value,
    }
  }
  if (isRueRenderableHandle(value)) {
    const type = readRueRenderableHandleType(value)
    const context = readRueContextProviderContext(type)
    if (!context) return null
    return { context, type, value: readRueRenderableHandleProps(value).value }
  }
  return null
}

function shouldAwaitClientReferenceForHtmlSsr(type: unknown): boolean {
  // Some client references have meaningful server output even when they carry
  // children. Providers/adapters establish context for their subtree.
  return isProviderLikeClientReference(type)
}

function readRueSignalValue(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value
  const record = value as {
    __rue_ref__?: unknown
    get?: unknown
    set?: unknown
    value?: unknown
  }
  if (
    'value' in record &&
    (typeof record.get === 'function' ||
      typeof record.set === 'function' ||
      '__rue_ref__' in record ||
      Object.keys(record).length === 0)
  ) {
    try {
      return record.value
    } catch {
      return value
    }
  }
  return value
}

function normalizeAppSsrPropValue(value: unknown): unknown {
  const unwrapped = readRueSignalValue(value)
  if (unwrapped !== value) return normalizeAppSsrPropValue(unwrapped)
  if (Array.isArray(value)) {
    let changed = false
    const textValue = value.map(item => {
      const textItem = normalizeAppSsrPropValue(item)
      if (textItem !== item) changed = true
      return textItem
    })
    return changed ? textValue : value
  }
  return value
}

function shouldWrapAppServerComponentForSsr(type: unknown): type is Function {
  return (
    typeof type === 'function' &&
    !appServerComponentAdapters.has(type) &&
    !appSsrComponentAdapters.has(type) &&
    !isAppRscServerClientReference(type) &&
    !isAppSsrPassthroughComponent(type) &&
    !isTextClassComponent(type)
  )
}

function shouldWrapResolvedClientReferenceForHtmlSsr(type: unknown): type is Function {
  return (
    typeof type === 'function' &&
    !appServerComponentAdapters.has(type) &&
    !appSsrComponentAdapters.has(type) &&
    !isTextClassComponent(type)
  )
}

function shouldPassthroughClientReferenceForHtmlSsr(type: unknown): type is Function {
  const displayName =
    typeof type === 'function'
      ? ((type as { displayName?: string; name?: string }).displayName ?? type.name)
      : null
  return (
    typeof type === 'function' &&
    isAppRscServerClientReference(type) &&
    isAppSsrPassthroughComponent(type) &&
    !isProviderLikeClientReference(type) &&
    !APP_SSR_ERROR_BOUNDARY_COMPONENT_NAMES.has(displayName ?? '')
  )
}

function renderStaticClientReferenceAnchor(props: Record<string, unknown>): TextCompatNode {
  const { href, as, children, onClick: _onClick, ref: _ref, ...rest } = props
  const resolvedHref = typeof as === 'string' ? as : typeof href === 'string' ? href : null
  return createServerProtocolElement(
    'a',
    resolvedHref ? { href: resolvedHref, ...rest } : rest,
    children as AppServerRenderable,
  )
}

function getAppSsrComponentAdapter(
  type: Function,
): TextCompatComponentType<Record<string, unknown>> {
  const cached = appSsrComponentAdapterCache.get(type)
  if (cached) return cached

  const displayName = (type as { displayName?: string; name?: string }).displayName ?? type.name
  const AppSsrComponentAdapter = (props: Record<string, unknown>) => {
    const result = runWithServerElementRuntime(() =>
      (type as (props: Record<string, unknown>) => AppServerRenderable)(props),
    )
    return resolveAppServerComponentResult(result, { htmlSsr: true })
  }

  if (displayName) {
    AppSsrComponentAdapter.displayName = displayName
  }
  if (isTextDynamicResolvedComponent(type)) {
    Object.defineProperty(AppSsrComponentAdapter, TEXT_DYNAMIC_RESOLVED_COMPONENT_MARKER, {
      configurable: true,
      enumerable: false,
      value: true,
    })
  }

  appSsrComponentAdapterCache.set(type, AppSsrComponentAdapter)
  appSsrComponentAdapters.add(AppSsrComponentAdapter)
  return AppSsrComponentAdapter
}

function getAppInlineSsrComponentAdapter(
  type: Function,
): TextCompatComponentType<Record<string, unknown>> {
  const cached = appInlineSsrComponentAdapterCache.get(type)
  if (cached) return cached

  const displayName = (type as { displayName?: string; name?: string }).displayName ?? type.name
  const AppInlineSsrComponentAdapter = (props: Record<string, unknown>) => {
    const result = runWithServerElementRuntime(() =>
      (type as (props: Record<string, unknown>) => AppServerRenderable)(props),
    )
    return resolveAppServerComponentResult(result, { inlineSsr: true })
  }

  if (displayName) {
    AppInlineSsrComponentAdapter.displayName = displayName
  }
  if (isTextDynamicResolvedComponent(type)) {
    Object.defineProperty(AppInlineSsrComponentAdapter, TEXT_DYNAMIC_RESOLVED_COMPONENT_MARKER, {
      configurable: true,
      enumerable: false,
      value: true,
    })
  }
  const ssrUnwrapChildren = readAppRenderDependencySsrUnwrap(type)
  if (ssrUnwrapChildren !== null) {
    markAppRenderDependencySsrUnwrap(AppInlineSsrComponentAdapter, ssrUnwrapChildren)
  }
  if (readTextCompatContextProviderContext(type)) {
    const logicalProviderContext = readAppServerTextCompatProviderContext(type)
    markTextCompatContextProvider(
      AppInlineSsrComponentAdapter,
      logicalProviderContext ?? (() => readTextCompatContextProviderContext(type)),
    )
  }

  appInlineSsrComponentAdapterCache.set(type, AppInlineSsrComponentAdapter)
  appSsrComponentAdapters.add(AppInlineSsrComponentAdapter)
  return AppInlineSsrComponentAdapter
}

function getAppSsrClientReferencePassthroughAdapter(
  type: Function,
): TextCompatComponentType<Record<string, unknown>> {
  const cached = appSsrClientReferencePassthroughAdapterCache.get(type)
  if (cached) return cached

  const displayName = (type as { displayName?: string; name?: string }).displayName ?? type.name
  const AppSsrClientReferencePassthroughAdapter = (props: Record<string, unknown>) =>
    (props.children ?? null) as TextCompatNode

  if (displayName) {
    AppSsrClientReferencePassthroughAdapter.displayName = displayName
  }
  markAppSsrPassthroughComponent(AppSsrClientReferencePassthroughAdapter)

  appSsrClientReferencePassthroughAdapterCache.set(type, AppSsrClientReferencePassthroughAdapter)
  appSsrComponentAdapters.add(AppSsrClientReferencePassthroughAdapter)
  return AppSsrClientReferencePassthroughAdapter
}

function getAppSsrClientReferenceAdapter(
  type: Function,
): TextCompatComponentType<Record<string, unknown>> {
  const cached = appSsrClientReferenceAdapterCache.get(type)
  if (cached) return cached

  const displayName = (type as { displayName?: string; name?: string }).displayName ?? type.name
  const AppSsrClientReferenceAdapter = (props: Record<string, unknown>) => {
    return runWithAppClientReferenceSsr(() => {
      const layoutSegmentMap = props[APP_LAYOUT_SEGMENT_MAP_PROP]
      const componentProps =
        layoutSegmentMap && typeof layoutSegmentMap === 'object'
          ? { ...props, [APP_LAYOUT_SEGMENT_MAP_PROP]: undefined }
          : props
      const result = runWithServerElementRuntime(() => {
        if (layoutSegmentMap && typeof layoutSegmentMap === 'object') {
          setCurrentSsrLayoutSegmentMap(layoutSegmentMap as SegmentMap)
        }
        return (type as (props: Record<string, unknown>) => AppServerRenderable)(componentProps)
      })
      if (isAppSsrPassthroughComponent(type)) {
        return result
      }
      return resolveAppServerComponentResult(result, { htmlSsr: true })
    })
  }

  if (displayName) {
    AppSsrClientReferenceAdapter.displayName = displayName
  }
  if (isAppSsrPassthroughComponent(type)) {
    markAppSsrPassthroughComponent(AppSsrClientReferenceAdapter)
  }
  const slotPlaceholderKind = readAppSlotPlaceholderKind(type)
  if (slotPlaceholderKind) {
    markAppSlotPlaceholderComponent(AppSsrClientReferenceAdapter, slotPlaceholderKind)
  }

  appSsrClientReferenceAdapterCache.set(type, AppSsrClientReferenceAdapter)
  appSsrComponentAdapters.add(AppSsrClientReferenceAdapter)
  return AppSsrClientReferenceAdapter
}

function adaptAppServerElementTypeForSsr(
  type: unknown,
  options: AdaptAppServerRenderableOptions,
): unknown {
  const protocolType = normalizeServerProtocolType(type)
  if (protocolType !== type) return protocolType

  const sourceType =
    typeof type === 'function' ? appServerComponentAdapterSourceTypes.get(type) : undefined
  if (sourceType) {
    return options.htmlSsr
      ? getAppSsrComponentAdapter(sourceType)
      : getAppInlineSsrComponentAdapter(sourceType)
  }

  if (options.htmlSsr && shouldPassthroughClientReferenceForHtmlSsr(type)) {
    return getAppSsrClientReferencePassthroughAdapter(type)
  }
  if (shouldWrapAppServerComponentForSsr(type)) {
    return options.htmlSsr ? getAppSsrComponentAdapter(type) : getAppInlineSsrComponentAdapter(type)
  }
  return protocolType
}

type AdaptAppServerRenderableOptions = {
  clientReferenceThenableMode: 'await' | 'read-or-fallback'
  htmlSsr: boolean
  resolveClientReferences: boolean
  unwrapRenderDependencies: boolean
}

function renderUnresolvedClientReferenceForSsr(
  element: TextCompatElement<Record<string, unknown>>,
  props: Record<string, unknown>,
  options: AdaptAppServerRenderableOptions,
): TextCompatNode | null {
  if (!options.htmlSsr) {
    return createServerProtocolElementWithType(element, element.type, props)
  }
  if (isLinkLikeClientReference(element.type)) {
    return renderStaticClientReferenceAnchor(props)
  }
  return hasServerRenderableChildren(props.children)
    ? ((props.children ?? null) as TextCompatNode)
    : createServerProtocolElementWithType(element, element.type, props)
}

function adaptResolvedClientReferenceTypeForSsr(
  type: unknown,
  options: AdaptAppServerRenderableOptions,
): unknown {
  const protocolType = normalizeServerProtocolType(type)
  if (
    protocolType === type &&
    options.htmlSsr &&
    shouldPassthroughClientReferenceForHtmlSsr(type)
  ) {
    return getAppSsrClientReferencePassthroughAdapter(type)
  }
  return protocolType === type &&
    options.htmlSsr &&
    shouldWrapResolvedClientReferenceForHtmlSsr(type)
    ? getAppSsrClientReferenceAdapter(type)
    : protocolType
}

function adaptAppServerRenderableWithOptions(
  value: AppServerRenderable,
  options: AdaptAppServerRenderableOptions,
): TextCompatNode | Promise<TextCompatNode> {
  if (isThenable(value)) {
    return Promise.resolve(value).then(resolved =>
      adaptAppServerRenderableWithOptions(resolved as AppServerRenderable, options),
    )
  }
  if (Array.isArray(value)) {
    const adaptedItems = value.map(item =>
      adaptAppServerRenderableWithOptions(item as AppServerRenderable, options),
    )
    return adaptedItems.some(isThenable)
      ? Promise.all(adaptedItems.map(item => Promise.resolve(item)))
      : adaptedItems
  }
  if (isAppServerProtocolElement(value)) {
    const element = value as TextCompatElement<Record<string, unknown>>
    const slotPlaceholderSentinel = readAppSlotPlaceholderSentinel(element.type, element.props)
    const slotPlaceholderKind =
      slotPlaceholderSentinel?.kind ?? readAppSlotPlaceholderKind(element.type)
    if (slotPlaceholderKind === 'children') {
      if (!options.htmlSsr) {
        if (slotPlaceholderSentinel) return value as TextCompatNode
        return createServerProtocolElement(
          APP_SLOT_PLACEHOLDER_SENTINEL_TYPE,
          createAppSlotPlaceholderSentinelProps({ kind: 'children' }),
        )
      }
      const provided = readTextCompatContextProviderValue<AppServerRenderable>(
        ChildrenContext as object,
      )
      return provided.found
        ? adaptAppServerRenderableWithOptions(provided.value, options)
        : (value as TextCompatNode)
    }
    if (slotPlaceholderKind === 'parallel-slot') {
      const slotName = slotPlaceholderSentinel?.name ?? (element.props as { name?: unknown }).name
      if (!options.htmlSsr) {
        if (slotPlaceholderSentinel) return value as TextCompatNode
        return createServerProtocolElement(
          APP_SLOT_PLACEHOLDER_SENTINEL_TYPE,
          createAppSlotPlaceholderSentinelProps({
            kind: 'parallel-slot',
            ...(typeof slotName === 'string' ? { name: slotName } : {}),
          }),
        )
      }
      const provided = readTextCompatContextProviderValue<Readonly<
        Record<string, AppServerRenderable>
      > | null>(ParallelSlotsContext as object)
      const slotValue =
        typeof slotName === 'string' && provided.found ? (provided.value?.[slotName] ?? null) : null
      return provided.found
        ? adaptAppServerRenderableWithOptions(slotValue as AppServerRenderable, options)
        : (value as TextCompatNode)
    }

    const providerContext =
      readTextCompatContextProviderContext(element.type) ??
      readRueContextProviderContext(element.type)
    if (providerContext) {
      const props = (element.props ?? {}) as Record<string, unknown>
      return runWithTextCompatContextProviderValue(providerContext, props.value, () =>
        adaptAppServerRenderableWithOptions(
          (props.children ?? null) as AppServerRenderable,
          options,
        ),
      )
    }

    if (options.resolveClientReferences && options.unwrapRenderDependencies) {
      const unwrappedDependencyChildren = readAppRenderDependencySsrUnwrap(element.type)
      if (unwrappedDependencyChildren !== null) {
        return adaptAppServerRenderableWithOptions(unwrappedDependencyChildren, options)
      }
    }
    const resolvedClientReference = options.resolveClientReferences
      ? resolveAppClientReference(element.type)
      : null
    const elementType =
      options.resolveClientReferences && !resolvedClientReference
        ? adaptAppServerElementTypeForSsr(element.type, options)
        : element.type
    const createAdaptedElement = (resolvedProps: {
      changed: boolean
      props: Record<string, unknown>
    }): TextCompatNode | Promise<TextCompatNode> => {
      const createResolvedClientReferenceElement = (
        resolvedType: unknown,
      ): TextCompatNode | Promise<TextCompatNode> => {
        if (resolvedType == null) {
          return renderUnresolvedClientReferenceForSsr(element, resolvedProps.props, options)
        }
        return createServerProtocolElementWithType(
          element,
          adaptResolvedClientReferenceTypeForSsr(resolvedType, options),
          resolvedProps.props,
        )
      }

      if (resolvedClientReference) {
        if (isThenable(resolvedClientReference)) {
          if (
            options.clientReferenceThenableMode === 'await' ||
            (options.htmlSsr && shouldAwaitClientReferenceForHtmlSsr(element.type))
          ) {
            return Promise.resolve(resolvedClientReference).then(
              createResolvedClientReferenceElement,
            )
          }
          Promise.resolve(resolvedClientReference).catch(() => undefined)
          if (options.htmlSsr && isLinkLikeClientReference(element.type)) {
            return renderStaticClientReferenceAnchor(resolvedProps.props)
          }
          if (!hasServerRenderableChildren(resolvedProps.props.children)) {
            return Promise.resolve(resolvedClientReference).then(
              createResolvedClientReferenceElement,
            )
          }
          return (resolvedProps.props.children ?? null) as TextCompatNode
        }
        return createResolvedClientReferenceElement(resolvedClientReference)
      }

      if (
        options.htmlSsr &&
        options.resolveClientReferences &&
        elementType === element.type &&
        isAppRscServerClientReference(element.type)
      ) {
        return renderUnresolvedClientReferenceForSsr(element, resolvedProps.props, options)
      }

      if (resolvedProps.changed || elementType !== element.type) {
        return createServerProtocolElementWithType(element, elementType, resolvedProps.props)
      }

      return value as TextCompatNode
    }

    const renderProviderLikeClientReferenceChildren = (
      resolvedType: unknown,
    ): TextCompatNode | Promise<TextCompatNode> | null => {
      if (!options.htmlSsr || !isProviderLikeClientReference(element.type)) return null
      if (typeof resolvedType !== 'function') return null
      const props = (element.props ?? {}) as Record<string, unknown>
      const renderedProvider = runWithAppClientReferenceSsr(() =>
        runWithServerElementRuntime(() =>
          (resolvedType as (props: Record<string, unknown>) => AppServerRenderable)({
            ...props,
            children: null,
          }),
        ),
      )
      const renderChildren = (providerRenderable: unknown) => {
        const providerEntry = readProviderContextEntryFromRenderable(providerRenderable)
        if (!providerEntry) return null
        writeSsrCompatContextProviderValue(providerEntry.context, providerEntry.value)
        return runWithTextCompatContextProviderValue(
          providerEntry.context,
          providerEntry.value,
          () =>
            adaptAppServerRenderableWithOptions(
              (props.children ?? null) as AppServerRenderable,
              options,
            ),
        )
      }
      return isThenable(renderedProvider)
        ? Promise.resolve(renderedProvider).then(renderChildren)
        : renderChildren(renderedProvider)
    }

    if (resolvedClientReference && isThenable(resolvedClientReference)) {
      if (options.htmlSsr && isProviderLikeClientReference(element.type)) {
        return Promise.resolve(resolvedClientReference).then(resolvedType => {
          const providerChildren = renderProviderLikeClientReferenceChildren(resolvedType)
          if (isThenable(providerChildren)) {
            return Promise.resolve(providerChildren).then(resolvedProviderChildren => {
              if (resolvedProviderChildren !== null) return resolvedProviderChildren
              const adaptedProps = adaptAppServerProtocolProps(
                element.props as Record<string, unknown>,
                options,
              )
              return isThenable(adaptedProps)
                ? Promise.resolve(adaptedProps).then(createAdaptedElement)
                : createAdaptedElement(adaptedProps)
            })
          }
          if (providerChildren !== null) return providerChildren
          const adaptedProps = adaptAppServerProtocolProps(
            element.props as Record<string, unknown>,
            options,
          )
          return isThenable(adaptedProps)
            ? Promise.resolve(adaptedProps).then(createAdaptedElement)
            : createAdaptedElement(adaptedProps)
        })
      }
    } else if (resolvedClientReference) {
      const providerChildren = renderProviderLikeClientReferenceChildren(resolvedClientReference)
      if (providerChildren !== null) return providerChildren
    }

    const adaptedProps = adaptAppServerProtocolProps(
      element.props as Record<string, unknown>,
      options,
    )

    if (isThenable(adaptedProps)) {
      return Promise.resolve(adaptedProps).then(createAdaptedElement)
    }

    return createAdaptedElement(adaptedProps)
  }
  if (isRueRenderableHandle(value)) {
    const type = readRueRenderableHandleType(value)
    const providerContext = readRueContextProviderContext(type)
    if (providerContext) {
      const props = readRueRenderableHandleProps(value)
      return runWithTextCompatContextProviderValue(providerContext, props.value, () =>
        adaptAppServerRenderableWithOptions(
          (props.children ?? null) as AppServerRenderable,
          options,
        ),
      )
    }
    if (containsAppServerProtocolOrClientReference(value)) {
      const protocolElement = createAppServerProtocolElementFromRueHandle(value)
      if (protocolElement !== null) {
        return adaptAppServerRenderableWithOptions(protocolElement as AppServerRenderable, options)
      }
    }
    return adaptRueRenderableForRsc(value)
  }
  return value as TextCompatNode
}

function adaptAppServerChild(child: AppServerRenderable): TextCompatNode | Promise<TextCompatNode> {
  return adaptAppServerRenderable(child)
}

export function adaptAppServerRenderable(
  value: AppServerRenderable,
): TextCompatNode | Promise<TextCompatNode> {
  return adaptAppServerRenderableWithOptions(value, {
    clientReferenceThenableMode: 'await',
    htmlSsr: false,
    resolveClientReferences: false,
    unwrapRenderDependencies: true,
  })
}

export function adaptAppServerRenderableForSsr(
  value: AppServerRenderable,
): TextCompatNode | Promise<TextCompatNode> {
  return adaptAppServerRenderableWithOptions(value, {
    clientReferenceThenableMode: 'await',
    htmlSsr: false,
    resolveClientReferences: true,
    unwrapRenderDependencies: true,
  })
}

export function adaptAppServerRenderableForHtmlSsr(
  value: AppServerRenderable,
  options: { unwrapRenderDependencies?: boolean } = {},
): TextCompatNode | Promise<TextCompatNode> {
  return adaptAppServerRenderableWithOptions(value, {
    clientReferenceThenableMode: 'read-or-fallback',
    htmlSsr: true,
    resolveClientReferences: true,
    unwrapRenderDependencies: options.unwrapRenderDependencies ?? true,
  })
}

function containsRueRenderableHandle(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsRueRenderableHandle)
  if (isAppServerProtocolElement(value)) {
    return containsRueRenderableHandle((value.props as { children?: unknown }).children)
  }
  return isRueRenderableHandle(value)
}

function containsThenable(value: unknown): boolean {
  if (isThenableParams(value)) return false
  if (Array.isArray(value)) return value.some(containsThenable)
  if (isAppServerProtocolElement(value)) {
    return containsThenable((value.props as { children?: unknown }).children)
  }
  return isThenable(value)
}

function containsAppServerProtocolElement(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsAppServerProtocolElement)
  return isAppServerProtocolElement(value)
}

function getAppServerComponentAdapter<P>(type: AppServerComponent<P>): TextCompatComponentType<P> {
  const cached = appServerComponentAdapterCache.get(type as Function)
  if (cached) return cached as TextCompatComponentType<P>

  const displayName = (type as { displayName?: string; name?: string }).displayName ?? type.name
  const AppServerComponentAdapter = (props: P) => {
    const result = runWithServerElementRuntime(() =>
      (type as (props: P) => AppServerRenderable)(props),
    )
    return resolveAppServerComponentResult(result)
  }

  if (displayName) {
    AppServerComponentAdapter.displayName = displayName
  }
  const ssrUnwrapChildren = readAppRenderDependencySsrUnwrap(type)
  if (ssrUnwrapChildren !== null) {
    markAppRenderDependencySsrUnwrap(AppServerComponentAdapter, ssrUnwrapChildren)
  }
  if (readTextCompatContextProviderContext(type)) {
    const logicalProviderContext = readAppServerTextCompatProviderContext(type)
    markTextCompatContextProvider(
      AppServerComponentAdapter,
      logicalProviderContext ?? (() => readTextCompatContextProviderContext(type)),
    )
  }

  appServerComponentAdapterCache.set(
    type as Function,
    AppServerComponentAdapter as TextCompatComponentType<Record<string, unknown>>,
  )
  appServerComponentAdapterSourceTypes.set(AppServerComponentAdapter, type as Function)
  appServerComponentAdapters.add(AppServerComponentAdapter)
  return AppServerComponentAdapter as TextCompatComponentType<P>
}

function readAppServerTextCompatProviderContext(type: unknown): object | null {
  if (type === ElementsContext.Provider) return ElementsContext as object
  if (type === ChildrenContext.Provider) return ChildrenContext as object
  if (type === ParallelSlotsContext.Provider) return ParallelSlotsContext as object
  return null
}

export function createAppServerElement<P>(
  type:
    | string
    | AppServerComponent<P>
    | typeof ServerProtocolFragment
    | typeof ServerProtocolSuspense,
  props?: (P & { key?: unknown }) | null,
  ...children: AppServerRenderable[]
): AppServerRenderable {
  const slotPlaceholderKind = readAppSlotPlaceholderKind(type)
  if (slotPlaceholderKind) {
    const slotName = (props as { name?: unknown } | null | undefined)?.name
    return createServerProtocolElement(
      APP_SLOT_PLACEHOLDER_SENTINEL_TYPE,
      createAppSlotPlaceholderSentinelProps({
        kind: slotPlaceholderKind,
        ...(slotPlaceholderKind === 'parallel-slot' && typeof slotName === 'string'
          ? { name: slotName }
          : {}),
      }),
    )
  }

  const protocolType = normalizeServerProtocolType(type)
  const elementType =
    protocolType === type &&
    typeof type === 'function' &&
    !isAppRscServerClientReference(type) &&
    !isAppSsrPassthroughComponent(type) &&
    !isTextClassComponent(type)
      ? getAppServerComponentAdapter(type as AppServerComponent<P>)
      : protocolType
  return createServerProtocolElement(
    elementType as TextCompatComponentType<P> | string,
    props as P | null,
    ...children.map(adaptAppServerChild),
  )
}
