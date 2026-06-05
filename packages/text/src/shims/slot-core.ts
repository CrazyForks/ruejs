import {
  AppElementsWire,
  UNMATCHED_SLOT,
  type AppElementValue,
  type AppElements,
  type AppElementsInterception,
  type AppElementsSlotBinding,
  type LayoutFlags,
} from '../server/app-elements.js'
import { cloneServerProtocolElement, isServerProtocolElement } from '../server/element-protocol.js'
import { markAppSsrPassthroughComponent } from '../server/app-ssr-passthrough-protocol.js'
import {
  markAppSlotPlaceholderComponent,
  readAppSlotPlaceholderKind,
  readAppSlotPlaceholderSentinel,
} from '../server/app-slot-placeholder-protocol.js'
import type { ArtifactCompatibilityEnvelope } from '../server/artifact-compatibility.js'
import type { CacheEntryReuseProof } from '../server/cache-proof.js'
import { notFound } from './navigation.js'
import {
  createTextCompatElement,
  getOrCreateTextCompatContext,
  useTextCompatContext,
  type TextCompatContext,
  type TextCompatNode,
} from './context-adapter.js'
import { _$appendChild, _$createComment, _$createDocumentFragment } from '@rue-js/runtime'
import {
  getCurrentInstance,
  renderBetween,
  setCurrentInstance,
  vapor,
  watchEffect,
} from '@rue-js/rue'

const EMPTY_ELEMENTS: AppElements = Object.freeze({})
const warnedMissingEntryIds = new Set<string>()
const warnedTransportMetadataEntryIds = new Set<string>()
const clientReferenceComponents = new Map<string, TextCompatNode>()
const clientReferenceExports = new Map<string, unknown>()

export { UNMATCHED_SLOT }

/**
 * Holds resolved AppElements (not a Promise). Rue 19's use(Promise) during
 * hydration triggers "async Client Component" for native Promises that lack
 * Rue's internal .status property. Storing resolved values sidesteps this.
 */
const ELEMENTS_CONTEXT_KEY = Symbol.for('text.appElementsContext')
const CHILDREN_CONTEXT_KEY = Symbol.for('text.appChildrenContext')
const PARALLEL_SLOTS_CONTEXT_KEY = Symbol.for('text.appParallelSlotsContext')
const CURRENT_SSR_APP_ELEMENTS_KEY = Symbol.for('text.currentSsrAppElements')

type CurrentSsrAppElementsState = {
  active: boolean
  elements: AppElements | null
  readElements: (() => AppElements) | null
  renderedEntryIds: Set<string>
}

type CurrentSsrAppElementsGlobal = typeof globalThis & {
  [CURRENT_SSR_APP_ELEMENTS_KEY]?: CurrentSsrAppElementsState
}
type ThenableRecord<T> =
  | { status: 'pending'; value: PromiseLike<T> }
  | { status: 'fulfilled'; value: T }
  | { reason: unknown; status: 'rejected' }

const thenableRecords = new WeakMap<PromiseLike<unknown>, ThenableRecord<unknown>>()

function getCurrentSsrAppElementsState(): CurrentSsrAppElementsState {
  const globalState = globalThis as CurrentSsrAppElementsGlobal
  if (!globalState[CURRENT_SSR_APP_ELEMENTS_KEY]) {
    globalState[CURRENT_SSR_APP_ELEMENTS_KEY] = {
      active: false,
      elements: null,
      readElements: null,
      renderedEntryIds: new Set(),
    }
  }
  return globalState[CURRENT_SSR_APP_ELEMENTS_KEY]
}

export function beginCurrentSsrAppElements(): void {
  const state = getCurrentSsrAppElementsState()
  state.active = true
  state.elements = null
  state.readElements = null
  state.renderedEntryIds.clear()
}

export function setCurrentSsrAppElements(elements: AppElements): void {
  const state = getCurrentSsrAppElementsState()
  if (!state.active) return
  state.elements = elements
}

export function setCurrentSsrAppElementsReader(readElements: (() => AppElements) | null): void {
  const state = getCurrentSsrAppElementsState()
  if (!state.active) return
  state.readElements = readElements
}

export function clearCurrentSsrAppElements(): void {
  const state = getCurrentSsrAppElementsState()
  state.active = false
  state.elements = null
  state.readElements = null
  state.renderedEntryIds.clear()
}

function readCurrentSsrAppElementsFallback(id?: string): AppElements | null {
  const state = getCurrentSsrAppElementsState()
  if (!state.active) return null
  if (
    id !== undefined &&
    state.elements &&
    !Object.hasOwn(state.elements, id) &&
    state.readElements
  ) {
    const elements = state.readElements()
    state.elements = elements
    return elements
  }
  return state.elements
}

function createLazyRequiredTextCompatContext<T>(
  key: symbol,
  defaultValue: T,
): TextCompatContext<T> {
  let context: TextCompatContext<T> | null = null
  const readContext = () => {
    context ??= getOrCreateTextCompatContext<T>(key, defaultValue)
    if (!context) {
      throw new Error('Rue context is unavailable in this runtime condition.')
    }
    return context
  }
  return new Proxy({} as TextCompatContext<T>, {
    get(_target, prop, receiver) {
      return Reflect.get(readContext() as object, prop, receiver)
    },
    set(_target, prop, value) {
      ;(readContext() as Record<PropertyKey, unknown>)[prop] = value
      return true
    },
    defineProperty(_target, prop, descriptor) {
      return Reflect.defineProperty(readContext() as object, prop, descriptor)
    },
    has(_target, prop) {
      return prop in readContext()
    },
    ownKeys() {
      return Reflect.ownKeys(readContext() as object)
    },
    getOwnPropertyDescriptor(_target, prop) {
      return Reflect.getOwnPropertyDescriptor(readContext() as object, prop)
    },
  })
}

export const ElementsContext = createLazyRequiredTextCompatContext<AppElements>(
  ELEMENTS_CONTEXT_KEY,
  EMPTY_ELEMENTS,
)

export const ChildrenContext = createLazyRequiredTextCompatContext<TextCompatNode>(
  CHILDREN_CONTEXT_KEY,
  null,
)

export const ParallelSlotsContext = createLazyRequiredTextCompatContext<Readonly<
  Record<string, TextCompatNode>
> | null>(PARALLEL_SLOTS_CONTEXT_KEY, null)

type MergeElementsOptions = {
  clearAbsentSlots?: boolean
  preserveAbsentSlots?: boolean
  preserveElementIds?: readonly string[]
  preservePreviousSlotIds?: readonly string[]
}

function resolveSlotPlaceholders(
  value: TextCompatNode,
  slotChildren: TextCompatNode,
  parallelSlots: Readonly<Record<string, TextCompatNode>> | null,
): TextCompatNode {
  if (Array.isArray(value)) {
    let changed = false
    const textValue = value.map(item => {
      const textItem = resolveSlotPlaceholders(item, slotChildren, parallelSlots)
      if (textItem !== item) changed = true
      return textItem
    })
    return changed ? textValue : value
  }

  if (!isServerProtocolElement(value)) {
    return value
  }

  if (isSlotComponentType(value.type)) {
    return value
  }

  const sentinel = readAppSlotPlaceholderSentinel(value.type, value.props)
  if (sentinel?.kind === 'children') {
    return slotChildren ?? null
  }
  if (sentinel?.kind === 'parallel-slot') {
    return sentinel.name ? (parallelSlots?.[sentinel.name] ?? null) : null
  }

  const placeholderKind = readAppSlotPlaceholderKind(value.type)
  if (placeholderKind === 'children') {
    return slotChildren ?? null
  }
  if (placeholderKind === 'parallel-slot') {
    const name = (value.props as { name?: unknown }).name
    return typeof name === 'string' ? (parallelSlots?.[name] ?? null) : null
  }

  const props = value.props as Record<string, unknown>
  let changed = false
  const textProps: Record<string, unknown> = {}
  for (const [key, propValue] of Object.entries(props)) {
    const textValue = resolveSlotPlaceholders(
      propValue as TextCompatNode,
      slotChildren,
      parallelSlots,
    )
    textProps[key] = textValue
    if (textValue !== propValue) changed = true
  }

  return changed ? (cloneServerProtocolElement(value, textProps) as TextCompatNode) : value
}

function isTransportTextValue(value: unknown): value is { value: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { $rue?: unknown }).$rue === 'text' &&
    'value' in value
  )
}

function isTransportClientReferenceValue(
  value: unknown,
): value is { exportName: string; referenceKey: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { $rue?: unknown }).$rue === 'clientReference' &&
    typeof (value as { referenceKey?: unknown }).referenceKey === 'string' &&
    typeof (value as { exportName?: unknown }).exportName === 'string'
  )
}

function isTransportFragmentValue(value: unknown): value is { $rue: 'fragment' } {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { $rue?: unknown }).$rue === 'fragment'
  )
}

function isTransportElementValue(value: unknown): value is {
  key?: unknown
  props?: Record<string, unknown> | null
  type: unknown
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { $rue?: unknown }).$rue === 'element' &&
    'type' in value
  )
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}

function readThenable<T>(thenable: PromiseLike<T>): T {
  const existing = thenableRecords.get(thenable as PromiseLike<unknown>) as
    | ThenableRecord<T>
    | undefined
  if (existing) {
    if (existing.status === 'fulfilled') return existing.value
    if (existing.status === 'rejected') throw existing.reason
    throw existing.value
  }

  const record: ThenableRecord<T> = {
    status: 'pending',
    value: thenable,
  }
  thenableRecords.set(thenable as PromiseLike<unknown>, record as ThenableRecord<unknown>)
  Promise.resolve(thenable).then(
    value => {
      thenableRecords.set(
        thenable as PromiseLike<unknown>,
        {
          status: 'fulfilled',
          value,
        } as ThenableRecord<unknown>,
      )
    },
    reason => {
      thenableRecords.set(thenable as PromiseLike<unknown>, {
        reason,
        status: 'rejected',
      })
    },
  )
  throw thenable
}

function resolveClientReferenceModule(referenceKey: string): unknown {
  const globalState = globalThis as {
    __rue_rsc_client_require__?: (referenceKey: string) => unknown
    __vite_rsc_client_require__?: (referenceKey: string) => unknown
  }
  const clientRequire =
    globalState.__rue_rsc_client_require__ ?? globalState.__vite_rsc_client_require__
  if (!clientRequire) {
    throw new Error(`[text] App client reference loader is not installed: ${referenceKey}`)
  }
  return clientRequire(referenceKey)
}

function readClientReferenceExport(referenceKey: string, exportName: string): unknown {
  const cacheKey = `${referenceKey}#${exportName}`
  if (clientReferenceExports.has(cacheKey)) {
    const cached = clientReferenceExports.get(cacheKey)
    return isThenable(cached) ? readThenable(cached) : cached
  }

  const loaded = resolveClientReferenceModule(referenceKey)
  const readExport = (mod: unknown): unknown => {
    if (mod && typeof mod === 'object' && Object.hasOwn(mod, exportName)) {
      return (mod as Record<string, unknown>)[exportName]
    }
    throw new Error(
      `[text] App client reference "${referenceKey}" does not export "${exportName}".`,
    )
  }
  const resolved = isThenable(loaded)
    ? Promise.resolve(loaded).then(readExport)
    : readExport(loaded)
  clientReferenceExports.set(cacheKey, resolved)
  if (isThenable(resolved)) {
    void Promise.resolve(resolved).then(value => {
      clientReferenceExports.set(cacheKey, value)
    })
    return readThenable(resolved)
  }
  return resolved
}

function resetClientReferenceHookCursor(owner: unknown): void {
  if ((typeof owner !== 'object' && typeof owner !== 'function') || owner === null) return
  const record = owner as { __hooks?: { index?: number; states?: unknown[] } }
  const hooks = record.__hooks ?? (record.__hooks = { index: 0, states: [] })
  if (!Array.isArray(hooks.states)) {
    hooks.states = []
  }
  hooks.index = 0
}

function renderClientReferenceWithOwner(
  Component: unknown,
  props: Record<string, unknown>,
  owner: unknown,
): unknown {
  const previousOwner = getCurrentInstance()
  resetClientReferenceHookCursor(owner)
  setCurrentInstance(owner)
  try {
    return (Component as (props: Record<string, unknown>) => unknown)(props)
  } finally {
    setCurrentInstance(previousOwner)
  }
}

function createClientReferenceVaporBlock(
  referenceKey: string,
  exportName: string,
  props: Record<string, unknown>,
): TextCompatNode {
  return vapor(() => {
    const fragment = _$createDocumentFragment()
    const start = _$createComment('text:client-reference:start')
    const end = _$createComment('text:client-reference:end')
    _$appendChild(fragment, start)
    _$appendChild(fragment, end)

    const owner = getCurrentInstance() ?? {}
    watchEffect(() => {
      const Component = readClientReferenceExport(referenceKey, exportName)
      const textValue = renderClientReferenceWithOwner(Component, props, owner)
      renderBetween(textValue as never, fragment, start, end)
    })

    return fragment
  }) as TextCompatNode
}

function materializeClientReferenceType(value: {
  exportName: string
  referenceKey: string
}): TextCompatNode {
  const cacheKey = `${value.referenceKey}#${value.exportName}`
  const existing = clientReferenceComponents.get(cacheKey)
  if (existing) return existing

  const ClientReference = (props: Record<string, unknown>) => {
    return createClientReferenceVaporBlock(value.referenceKey, value.exportName, props)
  }
  clientReferenceComponents.set(cacheKey, ClientReference as TextCompatNode)
  return ClientReference as TextCompatNode
}

function isMaterializablePlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function materializeServerProtocolNode(value: unknown): unknown {
  if (Array.isArray(value)) {
    let changed = false
    const textValue = value.map(item => {
      const textItem = materializeServerProtocolNode(item)
      if (textItem !== item) changed = true
      return textItem
    })
    return changed ? textValue : value
  }

  if (isTransportTextValue(value)) {
    return materializeServerProtocolNode(value.value)
  }

  if (isTransportClientReferenceValue(value)) {
    return materializeClientReferenceType(value)
  }

  if (isTransportFragmentValue(value)) {
    return Symbol.for('rue.fragment')
  }

  if (isTransportElementValue(value)) {
    const props = (value.props ?? {}) as Record<string, unknown>
    const textProps: Record<string, unknown> = {}
    const childValues: TextCompatNode[] = []
    for (const [key, propValue] of Object.entries(props)) {
      if (key === 'children') {
        if (Array.isArray(propValue)) {
          childValues.push(
            ...(propValue.map(item => materializeServerProtocolNode(item)) as TextCompatNode[]),
          )
        } else if (propValue !== undefined) {
          childValues.push(materializeServerProtocolNode(propValue) as TextCompatNode)
        }
        continue
      }
      textProps[key] = materializeServerProtocolNode(propValue)
    }
    if (value.key !== null && value.key !== undefined) {
      textProps.key = value.key
    }

    const elementType = materializeServerProtocolNode(value.type)
    return createTextCompatElement(elementType as never, textProps, ...childValues)
  }

  if (!isServerProtocolElement(value)) {
    if (isMaterializablePlainObject(value)) {
      let changed = false
      const textValue: Record<string, unknown> = {}
      for (const [key, item] of Object.entries(value)) {
        const textItem = materializeServerProtocolNode(item)
        textValue[key] = textItem
        if (textItem !== item) changed = true
      }
      return changed ? textValue : value
    }
    return value
  }

  const props = (value.props ?? {}) as Record<string, unknown>
  const textProps: Record<string, unknown> = {}
  const childValues: TextCompatNode[] = []
  for (const [key, propValue] of Object.entries(props)) {
    if (key === 'children') {
      if (Array.isArray(propValue)) {
        childValues.push(
          ...(propValue.map(item => materializeServerProtocolNode(item)) as TextCompatNode[]),
        )
      } else if (propValue !== undefined) {
        childValues.push(materializeServerProtocolNode(propValue) as TextCompatNode)
      }
      continue
    }
    textProps[key] = materializeServerProtocolNode(propValue)
  }
  if (value.key !== null && value.key !== undefined) {
    textProps.key = value.key
  }

  const elementType = materializeServerProtocolNode(value.type)
  return createTextCompatElement(elementType as never, textProps, ...childValues)
}

function isLayoutFlagsValue(value: unknown): value is LayoutFlags {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const entries = Object.values(value)
  return entries.length > 0 && entries.every(entry => entry === 's' || entry === 'd')
}

function isArtifactCompatibilityEnvelopeValue(
  value: unknown,
): value is ArtifactCompatibilityEnvelope {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  return (
    'schemaVersion' in value &&
    'appElementsSchemaVersion' in value &&
    'rscPayloadSchemaVersion' in value &&
    'graphVersion' in value &&
    'deploymentVersion' in value &&
    'rootBoundaryId' in value &&
    'renderEpoch' in value
  )
}

function isSlotBindingValue(value: unknown): value is AppElementsSlotBinding {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  return 'ownerLayoutId' in value && 'slotId' in value && 'state' in value
}

function isSlotBindingListValue(value: unknown): value is readonly AppElementsSlotBinding[] {
  // Empty [] is valid metadata when parsed from a missing __slotBindings key,
  // but it is not valid renderable slot content. Keep this guard non-empty so
  // accidental [] entries under render keys are not silently swallowed.
  return Array.isArray(value) && value.length > 0 && value.every(isSlotBindingValue)
}

function isSlotComponentType(value: unknown): boolean {
  if (value === Slot) return true
  if (typeof value !== 'function') return false
  const name = (value as { name?: unknown }).name
  if (name === 'Slot') return true
  return Function.prototype.toString.call(value).includes('function Slot(')
}

function isInterceptionMetadataValue(value: unknown): value is AppElementsInterception {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  return (
    'sourceMatchedUrl' in value &&
    typeof value.sourceMatchedUrl === 'string' &&
    'sourceRouteId' in value &&
    typeof value.sourceRouteId === 'string' &&
    'slotId' in value &&
    typeof value.slotId === 'string' &&
    'targetMatchedUrl' in value &&
    typeof value.targetMatchedUrl === 'string' &&
    'targetRouteId' in value &&
    typeof value.targetRouteId === 'string'
  )
}

function isCacheEntryReuseProofValue(value: unknown): value is CacheEntryReuseProof {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  return 'kind' in value && value.kind === 'runtime-cache-entry' && 'decision' in value
}

function isTransportMetadataValue(
  value: AppElementValue | undefined,
): value is
  | LayoutFlags
  | ArtifactCompatibilityEnvelope
  | CacheEntryReuseProof
  | AppElementsInterception
  | readonly AppElementsSlotBinding[] {
  return (
    isLayoutFlagsValue(value) ||
    isArtifactCompatibilityEnvelopeValue(value) ||
    isCacheEntryReuseProofValue(value) ||
    isInterceptionMetadataValue(value) ||
    isSlotBindingListValue(value)
  )
}

function warnTransportMetadataEntry(id: string): void {
  if (process.env.NODE_ENV === 'production') return
  if (warnedTransportMetadataEntryIds.has(id)) return

  warnedTransportMetadataEntryIds.add(id)
  console.warn('[text] Transport metadata value found under App Router render entry: ' + id)
}

export function mergeElements(
  prev: AppElements,
  text: AppElements,
  options: MergeElementsOptions | boolean = {},
): AppElements {
  const clearAbsentSlots =
    typeof options === 'boolean' ? options : (options.clearAbsentSlots ?? false)
  const preserveAbsentSlots =
    typeof options === 'boolean' ? !options : (options.preserveAbsentSlots ?? true)
  const preserveElementIds = typeof options === 'boolean' ? [] : (options.preserveElementIds ?? [])
  const preservePreviousSlotIds =
    typeof options === 'boolean' ? [] : (options.preservePreviousSlotIds ?? [])
  const merged: Record<string, AppElementValue> = { ...text }

  for (const id of preserveElementIds) {
    if (Object.hasOwn(merged, id)) continue
    if (Object.hasOwn(prev, id)) {
      const value = prev[id]
      if (value !== undefined) merged[id] = value
    }
  }

  const slotKeys = new Set(
    [...Object.keys(prev), ...Object.keys(text)].filter(key => AppElementsWire.isSlotId(key)),
  )
  // On traversal (browser back/forward), the server renders the full destination
  // route tree. A slot absent from text means the destination route tree does not
  // include it, so clear it rather than keeping the stale prev value. The legacy
  // absent-slot path stays opt-in for unpromoted fallbacks; promoted navigation
  // commits preserve default/unmatched slots through planner-approved
  // preservePreviousSlotIds.
  if (clearAbsentSlots) {
    for (const key of slotKeys) {
      if (!Object.hasOwn(text, key)) {
        delete merged[key]
      }
    }
  } else if (preserveAbsentSlots) {
    for (const key of slotKeys) {
      if (!Object.hasOwn(merged, key) && Object.hasOwn(prev, key)) {
        const value = prev[key]
        if (value !== undefined) merged[key] = value
      }
    }
  }

  // Default/unmatched slot preservation is a router-state decision, not a
  // consequence of a missing key or an unmatched marker on the transport. This
  // loop intentionally runs after clear/preserve element handling so planner-
  // approved slot content and binding proof win the final merged value.
  for (const id of preservePreviousSlotIds) {
    if (!AppElementsWire.isSlotId(id)) continue
    if (!Object.hasOwn(prev, id)) continue
    const value = prev[id]
    if (value !== undefined && value !== UNMATCHED_SLOT) {
      merged[id] = value
    }
  }

  return merged
}

export function Slot({
  id,
  children,
  elements: explicitElements,
  parallelSlots,
}: {
  id: string
  children?: TextCompatNode
  elements?: AppElements
  parallelSlots?: Readonly<Record<string, TextCompatNode>>
}) {
  if (typeof id !== 'string') {
    return children ?? null
  }

  if (explicitElements && typeof explicitElements === 'object') {
    return renderSlotElement({ children, elements: explicitElements, id, parallelSlots })
  }

  const contextElements = useTextCompatContext(ElementsContext)
  const safeContextElements =
    contextElements && typeof contextElements === 'object' ? contextElements : EMPTY_ELEMENTS
  const elements =
    safeContextElements === EMPTY_ELEMENTS
      ? (readCurrentSsrAppElementsFallback() ?? safeContextElements)
      : safeContextElements

  return renderSlotElement({ children, elements, id, parallelSlots })
}

export function renderSlotElement({
  id,
  children,
  elements: initialElements,
  parallelSlots,
}: {
  id: string
  children?: TextCompatNode
  elements?: AppElements
  parallelSlots?: Readonly<Record<string, TextCompatNode>>
}) {
  let elements =
    initialElements && typeof initialElements === 'object'
      ? initialElements
      : (readCurrentSsrAppElementsFallback(id) ?? EMPTY_ELEMENTS)
  if (!Object.hasOwn(elements, id)) {
    const currentElements = readCurrentSsrAppElementsFallback(id)
    if (currentElements && Object.hasOwn(currentElements, id)) {
      elements = currentElements
    }
  }

  if (!Object.hasOwn(elements, id)) {
    if (AppElementsWire.parseElementKey(id) !== null && children !== undefined) {
      return children
    }
    if (process.env.NODE_ENV !== 'production' && !AppElementsWire.isSlotId(id)) {
      if (!warnedMissingEntryIds.has(id)) {
        warnedMissingEntryIds.add(id)
        console.warn('[text] Missing App Router element entry during render: ' + id)
      }
    }
    return null
  }

  const element = elements[id]
  if (isTransportMetadataValue(element)) {
    warnTransportMetadataEntry(id)
    return null
  }
  if (element === UNMATCHED_SLOT) {
    notFound()
  }
  const elementKey = AppElementsWire.parseElementKey(id)
  const state = getCurrentSsrAppElementsState()
  const shouldTrackRenderedEntry = state.active && elementKey && elementKey.kind !== 'page'
  if (shouldTrackRenderedEntry && state.renderedEntryIds.has(id)) {
    return children ?? null
  }
  if (shouldTrackRenderedEntry) {
    state.renderedEntryIds.add(id)
  }
  const resolvedElement =
    elementKey?.kind === 'route'
      ? (element as TextCompatNode)
      : resolveSlotPlaceholders(element as TextCompatNode, children ?? null, parallelSlots ?? null)
  const materializedElement = materializeServerProtocolNode(resolvedElement)

  if ((children === undefined || children === null) && !parallelSlots) {
    return materializedElement
  }

  return createTextCompatElement(
    ParallelSlotsContext.Provider,
    { value: parallelSlots ?? null },
    createTextCompatElement(
      ChildrenContext.Provider,
      { value: children ?? null },
      materializedElement,
    ),
  )
}

export function Children() {
  return useTextCompatContext(ChildrenContext)
}

export function ParallelSlot({ name }: { name: string }) {
  const slots = useTextCompatContext(ParallelSlotsContext)
  return slots?.[name] ?? null
}

markAppSsrPassthroughComponent(Children)
markAppSsrPassthroughComponent(ParallelSlot)
markAppSsrPassthroughComponent(Slot)
markAppSlotPlaceholderComponent(Children, 'children')
markAppSlotPlaceholderComponent(ParallelSlot, 'parallel-slot')
