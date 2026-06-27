import {
  h,
  render,
  renderAnchor,
  type ComponentInstance,
  type ComponentProps,
  type RenderableInput,
} from './rue'
import {
  applyDomProps,
  getDOMAdapter,
  removeChild,
  setDOMAdapter,
  settextContent,
  type DOMAdapter,
  type DOMEventHandler,
  type DomElementLike,
  type DomFragmentLike,
  type DomNodeLike,
  type DomTextLike,
} from './dom'

export const RUE_ISLAND_ELEMENT = 'rue-island'
export const RUE_ISLAND_PROPS_SCRIPT_TYPE = 'application/json'

export type RueIslandHydrationStrategy =
  | 'load'
  | 'idle'
  | 'visible'
  | 'media'
  | 'interaction'
  | 'none'
  | 'only'

export interface RueIslandManifestEntry {
  id?: string
  component: string
  entry?: string
  exportName?: string
  hydrate?: RueIslandHydrationStrategy
  props?: string
  media?: string
  interaction?: string | string[]
}

export type RueIslandManifest = Record<string, RueIslandManifestEntry>

export interface RueIslandHtmlOptions {
  id: string
  component: string
  entry?: string
  exportName?: string
  hydrate?: RueIslandHydrationStrategy
  props?: unknown
  html?: string
  fallback?: string
  media?: string
  interaction?: string | string[]
}

export interface HydrateRootOptions {
  replace?: boolean
  adoptComponents?: boolean
  onMismatch?: (message: string, container: Element) => void
}

export interface RueRootHandle {
  unmount(): void
}

export interface RueIslandMountContext {
  island: Element
  props: ComponentProps
  manifest?: RueIslandManifestEntry
  strategy: RueIslandHydrationStrategy
  replayEvent?: Event
}

export interface RueIslandClientModule {
  default?: ComponentInstance<any>
  Component?: ComponentInstance<any>
  adopt?: boolean
  hydrate?: (island: Element, props: ComponentProps, context: RueIslandMountContext) => unknown
  mount?: (island: Element, props: ComponentProps, context: RueIslandMountContext) => unknown
}

export interface RueIslandLoaderOptions {
  root?: ParentNode
  manifest?: RueIslandManifest
  resolveModule?: (
    specifier: string,
    island: Element,
    manifest?: RueIslandManifestEntry,
  ) => Promise<RueIslandClientModule> | RueIslandClientModule
  hydrateRoot?: (
    container: Element,
    value: RenderableInput,
    options?: HydrateRootOptions,
  ) => RueRootHandle | void
  onError?: (error: unknown, island: Element, manifest?: RueIslandManifestEntry) => void
}

const RUE_SERIALIZED_TYPE_KEY = '__rueType'
const RUE_SERIALIZED_VALUE_KEY = 'value'
const RUE_ELEMENT_HEAD_RECORD = Symbol.for('rue.element.head-record')
const TEXT_HEAD_RECORD = Symbol.for('text.head.record')
const RUE_HYDRATION_ROOT_ANCHOR = 'rue:hydrate:anchor'
const RUE_HYDRATED_ADOPTED_NODE = '__rue_hydrated_adopted'
const loadedIslandCleanups = new WeakMap<Element, () => void>()

let islandIdSeed = 0

type RueElementHeadRecord = {
  [TEXT_HEAD_RECORD]?: true
  props?: ComponentProps | null
  type: string
}

type AdoptedElementProps = {
  element: Element
  props: Record<string, any>
}

export const createRueIslandId = (prefix = 'rue-island') => {
  islandIdSeed += 1
  return `${prefix}-${islandIdSeed.toString(36)}`
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const toSerializableValue = (value: unknown, seen: WeakSet<object>, path: string): unknown => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Rue island props cannot serialize non-finite number at ${path}.`)
    }
    return value
  }

  if (value === undefined) {
    throw new TypeError(`Rue island props cannot serialize undefined at ${path}.`)
  }

  if (typeof value === 'bigint' || typeof value === 'function' || typeof value === 'symbol') {
    throw new TypeError(`Rue island props cannot serialize ${typeof value} at ${path}.`)
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new TypeError(`Rue island props cannot serialize invalid Date at ${path}.`)
    }
    return {
      [RUE_SERIALIZED_TYPE_KEY]: 'Date',
      [RUE_SERIALIZED_VALUE_KEY]: value.toISOString(),
    }
  }

  if (typeof URL !== 'undefined' && value instanceof URL) {
    return {
      [RUE_SERIALIZED_TYPE_KEY]: 'URL',
      [RUE_SERIALIZED_VALUE_KEY]: value.href,
    }
  }

  if (typeof value !== 'object' || value === null) {
    return value
  }

  if (seen.has(value)) {
    throw new TypeError(`Rue island props cannot serialize circular reference at ${path}.`)
  }
  seen.add(value)

  if (Array.isArray(value)) {
    const serialized = value.map((item, index) =>
      toSerializableValue(item, seen, `${path}[${index}]`),
    )
    seen.delete(value)
    return serialized
  }

  if (!isPlainObject(value)) {
    const ctor = (value as { constructor?: { name?: string } }).constructor?.name || 'object'
    throw new TypeError(`Rue island props cannot serialize ${ctor} instance at ${path}.`)
  }

  const serialized: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    serialized[key] = toSerializableValue(entry, seen, `${path}.${key}`)
  }
  seen.delete(value)
  return serialized
}

const fromSerializableValue = (_key: string, value: unknown) => {
  if (!isPlainObject(value)) {
    return value
  }

  const type = value[RUE_SERIALIZED_TYPE_KEY]
  const raw = value[RUE_SERIALIZED_VALUE_KEY]
  if (type === 'Date' && typeof raw === 'string') {
    return new Date(raw)
  }
  if (type === 'URL' && typeof raw === 'string') {
    return new URL(raw)
  }
  return value
}

export const escapeIslandJson = (json: string) =>
  json
    .replace(/&/g, '\\u0026')
    .replace(/</g, '\\u003C')
    .replace(/>/g, '\\u003E')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')

export const escapeIslandAttribute = (value: string) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

export const serializeIslandProps = (value: unknown) =>
  escapeIslandJson(JSON.stringify(toSerializableValue(value, new WeakSet(), '$')))

export const deserializeIslandProps = (serialized: string): ComponentProps =>
  JSON.parse(serialized || '{}', fromSerializableValue) as ComponentProps

const renderAttrs = (attrs: Record<string, string | undefined>) =>
  Object.entries(attrs)
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([key, value]) => ` ${key}="${escapeIslandAttribute(value)}"`)
    .join('')

export const createIslandContainerHtml = (options: RueIslandHtmlOptions) => {
  const hydrate = options.hydrate ?? 'load'
  const attrs = renderAttrs({
    'data-rue-id': options.id,
    'data-rue-component': options.component,
    'data-rue-entry': hydrate === 'none' ? undefined : options.entry,
    'data-rue-export': options.exportName,
    'data-rue-hydrate': hydrate,
    'data-rue-media': options.media,
    'data-rue-interaction': Array.isArray(options.interaction)
      ? options.interaction.join(',')
      : options.interaction,
  })
  const body = hydrate === 'only' ? (options.fallback ?? '') : (options.html ?? '')
  const propsScript =
    options.props === undefined || hydrate === 'none'
      ? ''
      : `<script type="${RUE_ISLAND_PROPS_SCRIPT_TYPE}" data-rue-props="${escapeIslandAttribute(
          options.id,
        )}">${serializeIslandProps(options.props)}</script>`

  return `<${RUE_ISLAND_ELEMENT}${attrs}>${body}${propsScript}</${RUE_ISLAND_ELEMENT}>`
}

const isElementNode = (node: Node | null | undefined): node is Element => node?.nodeType === 1

const isTextNode = (node: Node | null | undefined): node is Text => node?.nodeType === 3

const isRueHydrationComment = (node: Node) =>
  node.nodeType === 8 && (node.nodeValue ?? '').startsWith('rue:')

const isWhitespaceTextNode = (node: Node) => node.nodeType === 3 && !(node.nodeValue ?? '').trim()

const isIslandPropsScriptNode = (node: Node) =>
  isElementNode(node) &&
  node.tagName.toLowerCase() === 'script' &&
  node.hasAttribute('data-rue-props')

const getHydratableChildNodes = (
  parent: ParentNode,
  options: { ignoreWhitespace?: boolean } = {},
) =>
  Array.from(parent.childNodes).filter(
    node =>
      !isRueHydrationComment(node) &&
      !isIslandPropsScriptNode(node) &&
      !(options.ignoreWhitespace && isWhitespaceTextNode(node)),
  )

const getElementHeadRecord = (value: unknown): RueElementHeadRecord | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = (value as { [RUE_ELEMENT_HEAD_RECORD]?: unknown })[RUE_ELEMENT_HEAD_RECORD]
  if (
    !record ||
    typeof record !== 'object' ||
    (record as { [TEXT_HEAD_RECORD]?: unknown })[TEXT_HEAD_RECORD] !== true ||
    typeof (record as { type?: unknown }).type !== 'string'
  ) {
    return null
  }

  return record as RueElementHeadRecord
}

const normalizeHydrationChildren = (value: unknown): unknown[] => {
  if (value === null || value === undefined || typeof value === 'boolean') {
    return []
  }
  if (Array.isArray(value)) {
    return value.flatMap(child => normalizeHydrationChildren(child))
  }
  return [value]
}

const getHydrationText = (value: unknown): string | null => {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
  }
  return null
}

const getElementTagName = (element: Element) => element.tagName.toLowerCase()

const removeNode = (node: Node) => {
  const parent = node.parentNode
  if (parent) {
    removeChild(parent as unknown as DomElementLike, node as unknown as DomElementLike)
  }
}

const removeDirectIslandPropsScripts = (container: Element) => {
  container.querySelectorAll('script[data-rue-props]').forEach(node => {
    node.parentNode?.removeChild(node)
  })
  Array.from(container.childNodes).forEach(node => {
    if (isIslandPropsScriptNode(node)) {
      node.parentNode?.removeChild(node)
    }
  })
}

const clearNodeChildren = (node: Element) => {
  settextContent(node as unknown as DomElementLike, '')
}

const appendTextChild = (parent: Element, text: string) => {
  const doc = parent.ownerDocument ?? (typeof document !== 'undefined' ? document : undefined)
  if (!doc) {
    return false
  }
  parent.appendChild(doc.createTextNode(text))
  return true
}

const adoptHydrationText = (parent: Element, node: Node | undefined, text: string) => {
  if (!node) {
    return appendTextChild(parent, text)
  }
  if (!isTextNode(node)) {
    return false
  }
  if (node.data !== text) {
    node.data = text
  }
  return true
}

const hasDangerousInnerHTML = (props: ComponentProps | null | undefined) => {
  const value = props?.dangerouslySetInnerHTML
  return !!value && typeof value === 'object' && '__html' in (value as Record<string, unknown>)
}

const adoptHydrationElement = (
  element: Element,
  record: RueElementHeadRecord,
  adopted: AdoptedElementProps[],
): boolean => {
  if (getElementTagName(element) !== record.type.toLowerCase()) {
    return false
  }

  const props = (record.props ?? {}) as Record<string, any>
  applyDomProps(element as unknown as DomElementLike, props)
  adopted.push({ element, props })

  if (hasDangerousInnerHTML(record.props)) {
    return true
  }

  const expectedChildren = normalizeHydrationChildren(props.children)
  const actualChildren = getHydratableChildNodes(element)
  if (expectedChildren.length === 0) {
    if (actualChildren.length > 0) {
      clearNodeChildren(element)
    }
    return true
  }

  if (expectedChildren.length === 1) {
    const text = getHydrationText(expectedChildren[0])
    if (text !== null) {
      if (actualChildren.length === 1 && isTextNode(actualChildren[0])) {
        return adoptHydrationText(element, actualChildren[0], text)
      }
      clearNodeChildren(element)
      return appendTextChild(element, text)
    }
  }

  if (actualChildren.length !== expectedChildren.length) {
    return false
  }

  for (let i = 0; i < expectedChildren.length; i += 1) {
    const child = expectedChildren[i]
    const text = getHydrationText(child)
    if (text !== null) {
      if (!adoptHydrationText(element, actualChildren[i], text)) {
        return false
      }
      continue
    }

    const childRecord = getElementHeadRecord(child)
    const actualChild = actualChildren[i]
    if (!childRecord || !isElementNode(actualChild)) {
      return false
    }
    if (!adoptHydrationElement(actualChild, childRecord, adopted)) {
      return false
    }
  }

  return true
}

const cleanupAdoptedProps = (adopted: AdoptedElementProps[]) => {
  for (const entry of adopted.slice().reverse()) {
    applyDomProps(entry.element as unknown as DomElementLike, {}, entry.props)
  }
}

const clearContainer = (container: Element) => {
  ;(container as HTMLElement).textContent = ''
}

type HydrationDOMAdapterCommit = {
  message?: string
  ok: boolean
}

class HydrationDOMAdapter implements DOMAdapter {
  private activeAnchor: Node | null = null
  private adoptedRoot = false
  private failureMessage: string | undefined
  private readonly adoptedNodes = new WeakSet<Node>()
  private readonly cleanupCallbacks: Array<() => void> = []
  private readonly observedParents = new Set<ParentNode>()
  private readonly predictedAdoptionTargets = new WeakMap<object, Node>()

  constructor(
    private readonly base: DOMAdapter,
    private readonly container: Element,
    private readonly rootAnchor: Node,
  ) {}

  createComment(data: string): DomNodeLike {
    return this.base.createComment(data)
  }

  createTextNode(data: string): DomTextLike {
    const fresh = this.base.createTextNode(data)
    const anchor = this.resolveActiveAnchor()
    const rawParent = anchor?.parentNode
    if (!rawParent) {
      return fresh
    }
    const parent = this.resolvePredictedParent(rawParent)
    if (parent !== rawParent) {
      this.observeHydrationParent(parent)
      return fresh
    }

    this.observeHydrationParent(parent)
    const candidate = this.findNextHydratableNode(parent, anchor, data)
    if (candidate && isTextNode(candidate)) {
      this.markAdoptedNode(candidate, parent)
      this.predictedAdoptionTargets.set(fresh as unknown as object, candidate)
      return fresh
    }

    return fresh
  }

  createElement(tag: string, parent?: DomElementLike | null): DomElementLike {
    const fresh = this.base.createElement(tag, parent)
    const explicitParent = this.asParentNode(parent)
    const resolvedExplicitParent = explicitParent
      ? this.resolvePredictedParent(explicitParent)
      : null
    if (explicitParent && resolvedExplicitParent !== explicitParent) {
      this.observeHydrationParent(resolvedExplicitParent)
      return fresh
    }
    const activeAnchor = this.resolveActiveAnchor()
    const parentNode = explicitParent ?? activeAnchor?.parentNode ?? null
    const anchor = parentNode
      ? explicitParent
        ? this.resolveAnchorForParent(parentNode)
        : activeAnchor
      : null
    if (parentNode && anchor) {
      const expectedTag = tag.toLowerCase()
      const adopted = this.takeNextHydratableNode(
        parentNode,
        anchor,
        node => isElementNode(node) && getElementTagName(node) === expectedTag,
        'Rue hydrateRoot SSR root structure did not match the client element.',
      )
      if (adopted && isElementNode(adopted)) {
        this.predictedAdoptionTargets.set(fresh as unknown as object, adopted)
        return fresh
      }
    }

    return fresh
  }

  createTextWrapper(parent: DomElementLike): DomElementLike {
    const fresh = this.base.createTextWrapper(parent)
    const parentNode = this.asParentNode(parent)
    const resolvedParentNode = parentNode ? this.resolvePredictedParent(parentNode) : null
    if (parentNode && resolvedParentNode !== parentNode) {
      this.observeHydrationParent(resolvedParentNode)
      return fresh
    }
    const anchor = parentNode ? this.resolveAnchorForParent(parentNode) : null
    if (!parentNode || !anchor) {
      return fresh
    }

    const expectedTag = this.base.getTagName(fresh).toLowerCase()
    const adopted = this.takeNextHydratableNode(
      parentNode,
      anchor,
      node => isElementNode(node) && getElementTagName(node) === expectedTag,
      'Rue hydrateRoot SSR root structure did not match the client element.',
    )
    if (adopted && isElementNode(adopted)) {
      this.predictedAdoptionTargets.set(fresh as unknown as object, adopted)
    }
    return fresh
  }

  setStyle(
    el: DomElementLike,
    style: string | Partial<CSSStyleDeclaration> | null | undefined,
  ): void {
    this.base.setStyle(el, style)
  }

  patchStyle(
    el: DomElementLike,
    oldStyle: Partial<CSSStyleDeclaration> | undefined,
    newStyle: Partial<CSSStyleDeclaration> | undefined,
  ): void {
    this.base.patchStyle(el, oldStyle, newStyle)
  }

  settextContent(el: DomNodeLike, val: any): void {
    this.base.settextContent(el, val)
  }

  createDocumentFragment(): DomFragmentLike {
    return this.base.createDocumentFragment()
  }

  appendChild(parent: DomNodeLike, child: DomNodeLike): void {
    this.observeParent(parent)
    this.base.appendChild(parent, child)
    this.rememberAnchor(child)
  }

  removeChild(parent: DomNodeLike, child: DomNodeLike): void {
    this.base.removeChild(parent, child)
  }

  insertBefore(parent: DomNodeLike, child: DomNodeLike, ref: DomNodeLike | null): void {
    this.observeParent(parent)
    this.base.insertBefore(parent, child, ref)
    this.rememberAnchor(child)
  }

  replaceChild(parent: DomNodeLike, newChild: DomNodeLike, oldChild: DomNodeLike): void {
    this.observeParent(parent)
    this.base.replaceChild(parent, newChild, oldChild)
    this.rememberAnchor(newChild)
  }

  querySelector(selector: string): DomElementLike | null {
    return this.base.querySelector(selector)
  }

  setAttribute(el: DomElementLike, name: string, value: any): void {
    this.base.setAttribute(el, name, value)
  }

  removeAttribute(el: DomElementLike, name: string): void {
    this.base.removeAttribute(el, name)
  }

  addEventListener(el: DomElementLike, eventName: string, listener: DOMEventHandler): void {
    this.base.addEventListener(el, eventName, listener)
    this.cleanupCallbacks.push(() => this.base.removeEventListener(el, eventName, listener))
  }

  removeEventListener(el: DomElementLike, eventName: string, listener: DOMEventHandler): void {
    this.base.removeEventListener(el, eventName, listener)
  }

  setClassName(el: DomElementLike, value: any): void {
    this.base.setClassName(el, value)
  }

  setInnerHTML(el: DomElementLike, html: string): void {
    this.base.setInnerHTML(el, html)
  }

  setValue(el: DomElementLike, value: any): void {
    this.base.setValue(el, value)
  }

  setChecked(el: DomElementLike, checked: boolean): void {
    this.base.setChecked(el, checked)
  }

  setDisabled(el: DomElementLike, disabled: boolean): void {
    this.base.setDisabled(el, disabled)
  }

  getTagName(el: DomElementLike): string {
    return this.base.getTagName(el)
  }

  contains(parent: DomNodeLike, child: DomNodeLike): boolean {
    return this.base.contains(parent, child)
  }

  getParentNode(node: DomNodeLike): DomNodeLike | null {
    return this.base.getParentNode(node)
  }

  isFragment(node: DomNodeLike): boolean {
    return this.base.isFragment(node)
  }

  collectFragmentChildren(node: DomNodeLike): DomNodeLike[] {
    return this.base.collectFragmentChildren(node)
  }

  applyRef(el: DomElementLike, ref: any): void {
    this.base.applyRef(this.resolvePredictedAdoptionTarget(el), ref)
  }

  clearRef(ref: any): void {
    this.base.clearRef(ref)
  }

  commitStatus(): HydrationDOMAdapterCommit {
    if (!this.adoptedRoot && !this.failureMessage) {
      this.failureMessage = 'Rue hydrateRoot expected exactly one SSR node to adopt.'
    }
    if (!this.failureMessage) {
      const extraNode = this.findExtraHydratableNode()
      if (extraNode) {
        this.failureMessage = 'Rue hydrateRoot SSR DOM contained extra nodes after adoption.'
      }
    }

    return {
      message: this.failureMessage,
      ok: !this.failureMessage,
    }
  }

  cleanup() {
    for (const cleanup of this.cleanupCallbacks.splice(0).reverse()) {
      cleanup()
    }
  }

  private asParentNode(value: DomNodeLike | null | undefined): ParentNode | null {
    if (!value || !('childNodes' in (value as Node))) {
      return null
    }
    return value as unknown as ParentNode
  }

  private observeParent(value: DomNodeLike | null | undefined) {
    const parent = this.asParentNode(this.resolvePredictedAdoptionTarget(value))
    this.observeHydrationParent(parent)
  }

  private rememberAnchor(value: DomNodeLike | null | undefined) {
    const node = value as unknown as Node | null | undefined
    if (node && isRueHydrationComment(node)) {
      this.activeAnchor = node
    }
  }

  private resolveActiveAnchor() {
    const anchor = this.activeAnchor
    return anchor?.parentNode ? anchor : null
  }

  private resolveAnchorForParent(parent: ParentNode) {
    const active = this.resolveActiveAnchor()
    if (active?.parentNode === parent) {
      return active
    }
    if (this.rootAnchor.parentNode === parent) {
      return this.rootAnchor
    }
    return null
  }

  private markFailure(message: string) {
    this.failureMessage ??= message
  }

  private observeHydrationParent(parent: ParentNode | null | undefined) {
    if (
      parent &&
      (parent === this.container ||
        this.adoptedNodes.has(parent as Node) ||
        (parent as unknown as Record<string, unknown>)[RUE_HYDRATED_ADOPTED_NODE] === true)
    ) {
      this.observedParents.add(parent)
    }
  }

  private resolvePredictedAdoptionTarget<T extends DomNodeLike | null | undefined>(value: T): T {
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
      return value
    }
    return (this.predictedAdoptionTargets.get(value as unknown as object) as unknown as T) ?? value
  }

  private resolvePredictedParent(parent: ParentNode): ParentNode {
    return (
      (this.predictedAdoptionTargets.get(parent as unknown as object) as ParentNode | undefined) ??
      parent
    )
  }

  private markAdoptedNode(node: Node, parent: ParentNode) {
    this.adoptedNodes.add(node)
    ;(node as unknown as Record<string, unknown>)[RUE_HYDRATED_ADOPTED_NODE] = true
    if (parent === this.container) {
      this.adoptedRoot = true
    }
  }

  private takeNextHydratableNode(
    parent: ParentNode,
    anchor: Node,
    matches: (node: Node) => boolean,
    mismatchMessage: string,
    expectedText?: string,
  ) {
    this.observeHydrationParent(parent)
    const candidate = this.findNextHydratableNode(parent, anchor, expectedText)
    if (!candidate) {
      this.markFailure('Rue hydrateRoot expected SSR DOM to contain the client structure.')
      return null
    }
    if (!matches(candidate)) {
      this.markFailure(mismatchMessage)
      return null
    }

    this.markAdoptedNode(candidate, parent)
    return candidate
  }

  private findNextHydratableNode(parent: ParentNode, anchor: Node, expectedText?: string) {
    for (const node of Array.from(parent.childNodes)) {
      if (node === anchor) {
        return null
      }
      if (this.isIgnoredHydrationNode(parent, node, expectedText) || this.adoptedNodes.has(node)) {
        continue
      }
      return node
    }
    return null
  }

  private findExtraHydratableNode() {
    for (const parent of this.observedParents) {
      if ((parent as unknown as Record<string, unknown>)[RUE_HYDRATED_ADOPTED_NODE]) {
        continue
      }
      for (const node of Array.from(parent.childNodes)) {
        if (this.isIgnoredHydrationNode(parent, node) || this.adoptedNodes.has(node)) {
          continue
        }
        return node
      }
    }
    return null
  }

  private isIgnoredHydrationNode(parent: ParentNode, node: Node, expectedText?: string) {
    if ((node as unknown as Record<string, unknown>)[RUE_HYDRATED_ADOPTED_NODE]) {
      return true
    }
    if (isRueHydrationComment(node) || isIslandPropsScriptNode(node)) {
      return true
    }
    if (isWhitespaceTextNode(node) && (parent === this.container || expectedText?.trim())) {
      return true
    }
    return false
  }
}

const createAdoptedRootHandle = (
  container: Element,
  adopted: AdoptedElementProps[],
): RueRootHandle => ({
  unmount() {
    cleanupAdoptedProps(adopted)
    clearContainer(container)
  },
})

const tryAdoptHydrationRoot = (
  container: Element,
  value: RenderableInput,
  options: HydrateRootOptions,
): RueRootHandle | null => {
  const record = getElementHeadRecord(value)
  if (!record) {
    options.onMismatch?.('Rue hydrateRoot could not find an adoptable element record.', container)
    return null
  }

  const roots = getHydratableChildNodes(container, { ignoreWhitespace: true })
  if (roots.length !== 1 || !isElementNode(roots[0])) {
    options.onMismatch?.(
      'Rue hydrateRoot expected exactly one SSR element root to adopt.',
      container,
    )
    return null
  }

  const adopted: AdoptedElementProps[] = []
  if (!adoptHydrationElement(roots[0], record, adopted)) {
    cleanupAdoptedProps(adopted)
    options.onMismatch?.(
      'Rue hydrateRoot SSR root structure did not match the client element.',
      container,
    )
    return null
  }

  removeDirectIslandPropsScripts(container)
  return createAdoptedRootHandle(container, adopted)
}

const createRendererAdoptedRootHandle = (
  container: Element,
  anchor: Node,
  cleanup: () => void,
): RueRootHandle => {
  let mounted = true
  return {
    unmount() {
      if (!mounted) {
        return
      }
      mounted = false
      renderAnchor(
        null as unknown as RenderableInput,
        container as unknown as DomElementLike,
        anchor as unknown as DomNodeLike,
      )
      cleanup()
      removeNode(anchor)
      clearContainer(container)
    },
  }
}

const cleanupRendererHydrationAttempt = (
  container: Element,
  anchor: Node,
  cleanup: () => void = () => {},
) => {
  renderAnchor(
    null as unknown as RenderableInput,
    container as unknown as DomElementLike,
    anchor as unknown as DomNodeLike,
  )
  cleanup()
  removeNode(anchor)
}

const tryAdoptHydrationRootWithRenderer = (
  container: Element,
  value: RenderableInput,
  options: HydrateRootOptions,
): RueRootHandle | null => {
  const previousAdapter = getDOMAdapter()
  const anchor = previousAdapter.createComment(RUE_HYDRATION_ROOT_ANCHOR) as unknown as Node
  const hydrationAdapter = new HydrationDOMAdapter(previousAdapter, container, anchor)

  setDOMAdapter(hydrationAdapter)
  try {
    hydrationAdapter.appendChild(
      container as unknown as DomNodeLike,
      anchor as unknown as DomNodeLike,
    )
    renderAnchor(value, container as unknown as DomElementLike, anchor as unknown as DomNodeLike)
  } catch (error) {
    setDOMAdapter(previousAdapter)
    cleanupRendererHydrationAttempt(container, anchor, () => hydrationAdapter.cleanup())
    throw error
  }
  setDOMAdapter(previousAdapter)

  removeDirectIslandPropsScripts(container)
  const commit = hydrationAdapter.commitStatus()
  if (!commit.ok) {
    cleanupRendererHydrationAttempt(container, anchor, () => hydrationAdapter.cleanup())
    options.onMismatch?.(commit.message ?? 'Rue hydrateRoot SSR DOM adoption failed.', container)
    return null
  }

  return createRendererAdoptedRootHandle(container, anchor, () => hydrationAdapter.cleanup())
}

export const hydrateRoot = (
  container: Element,
  value: RenderableInput,
  options: HydrateRootOptions = {},
): RueRootHandle => {
  if (options.replace === false && container.firstChild) {
    if (options.adoptComponents === true || getElementHeadRecord(value)) {
      const adopted = tryAdoptHydrationRootWithRenderer(container, value, options)
      if (adopted) {
        return adopted
      }
    } else {
      const adopted = tryAdoptHydrationRoot(container, value, options)
      if (adopted) {
        return adopted
      }
    }
  }

  render(value, container as unknown as DomElementLike)
  return {
    unmount() {
      render(null as unknown as RenderableInput, container as unknown as DomElementLike)
    },
  }
}

const getIslandManifestEntry = (
  island: Element,
  manifest?: RueIslandManifest,
): RueIslandManifestEntry | undefined => {
  const id = island.getAttribute('data-rue-id')
  return id ? manifest?.[id] : undefined
}

const getIslandHydrationStrategy = (
  island: Element,
  manifest?: RueIslandManifestEntry,
): RueIslandHydrationStrategy => {
  const raw = manifest?.hydrate ?? island.getAttribute('data-rue-hydrate') ?? 'load'
  switch (raw) {
    case 'idle':
    case 'visible':
    case 'media':
    case 'interaction':
    case 'none':
    case 'only':
      return raw
    default:
      return 'load'
  }
}

const getIslandSpecifier = (island: Element, manifest?: RueIslandManifestEntry) =>
  manifest?.entry ??
  island.getAttribute('data-rue-entry') ??
  manifest?.component ??
  island.getAttribute('data-rue-component') ??
  ''

const getIslandPropsScript = (island: Element, manifest?: RueIslandManifestEntry) => {
  const id = island.getAttribute('data-rue-id') ?? manifest?.id
  const scripts = Array.from(
    island.querySelectorAll(`script[type="${RUE_ISLAND_PROPS_SCRIPT_TYPE}"][data-rue-props]`),
  )
  return scripts.find(script => !id || script.getAttribute('data-rue-props') === id) ?? null
}

const readIslandProps = (island: Element, manifest?: RueIslandManifestEntry): ComponentProps => {
  if (manifest?.props) {
    return deserializeIslandProps(manifest.props)
  }

  const script = getIslandPropsScript(island, manifest)
  if (!script?.textContent) {
    return {}
  }
  return deserializeIslandProps(script.textContent)
}

const defaultResolveModule = async (specifier: string) => {
  const load = new Function('specifier', 'return import(specifier)') as (
    value: string,
  ) => Promise<RueIslandClientModule>
  return load(specifier)
}

const cloneEventForReplay = (event: Event) => {
  const init = {
    bubbles: event.bubbles,
    cancelable: event.cancelable,
    composed: event.composed,
  }

  try {
    const EventCtor = (
      event as unknown as {
        constructor: new (type: string, init?: EventInit) => Event
      }
    ).constructor
    return new EventCtor(event.type, init)
  } catch {
    return new Event(event.type, init)
  }
}

const replayInteractionEvent = (island: Element, event: Event | undefined) => {
  if (!event) {
    return
  }

  queueMicrotask(() => {
    const target = event.target
    const clone = cloneEventForReplay(event)
    if (
      target &&
      typeof (target as EventTarget).dispatchEvent === 'function' &&
      (!('isConnected' in (target as Node)) || (target as Node).isConnected)
    ) {
      ;(target as EventTarget).dispatchEvent(clone)
      return
    }
    island.dispatchEvent(clone)
  })
}

export const mountRueIsland = async (
  island: Element,
  module: RueIslandClientModule,
  context: RueIslandMountContext,
  hydrateRootImpl: (
    container: Element,
    value: RenderableInput,
    options?: HydrateRootOptions,
  ) => RueRootHandle | void = hydrateRoot,
) => {
  if (typeof module.mount === 'function') {
    return module.mount(island, context.props, context)
  }

  if (typeof module.hydrate === 'function' && context.strategy !== 'only') {
    return module.hydrate(island, context.props, context)
  }

  const component = module.default ?? module.Component
  if (typeof component !== 'function') {
    throw new TypeError('Rue island module must export a component, hydrate(), or mount().')
  }

  const vnode = h(component, context.props)
  if (context.strategy === 'only') {
    render(vnode as RenderableInput, island as unknown as DomElementLike)
    return undefined
  }
  return hydrateRootImpl(island, vnode as RenderableInput, {
    adoptComponents: module.adopt === true,
    replace: false,
  })
}

const onDocumentReady = (cb: () => void) => {
  if (typeof document === 'undefined' || document.readyState !== 'loading') {
    queueMicrotask(cb)
    return () => {}
  }

  document.addEventListener('DOMContentLoaded', cb, { once: true })
  return () => {
    document.removeEventListener('DOMContentLoaded', cb)
  }
}

const requestIdle = (cb: () => void) => {
  const win = typeof window !== 'undefined' ? window : undefined
  const request = win?.requestIdleCallback ?? ((callback: () => void) => setTimeout(callback, 1))
  const cancel = win?.cancelIdleCallback ?? ((id: number) => clearTimeout(id))
  const id = request(cb)
  return () => {
    cancel(id as number)
  }
}

const scheduleVisible = (island: Element, cb: () => void) => {
  const win = island.ownerDocument?.defaultView ?? (typeof window !== 'undefined' ? window : null)
  const Observer = win?.IntersectionObserver ?? globalThis.IntersectionObserver
  if (typeof Observer !== 'function') {
    cb()
    return () => {}
  }

  const observer = new Observer(entries => {
    if (entries.some(entry => entry.isIntersecting)) {
      observer.disconnect()
      cb()
    }
  })
  observer.observe(island)
  return () => {
    observer.disconnect()
  }
}

const scheduleMedia = (query: string | undefined, cb: () => void) => {
  const matchMedia =
    (typeof window !== 'undefined' ? window.matchMedia : undefined) ?? globalThis.matchMedia
  if (typeof matchMedia !== 'function' || !query) {
    cb()
    return () => {}
  }

  const list = matchMedia.call(typeof window !== 'undefined' ? window : globalThis, query)
  if (list.matches) {
    cb()
    return () => {}
  }

  const onChange = () => {
    if (!list.matches) {
      return
    }
    cleanup()
    cb()
  }
  const cleanup = () => {
    if (typeof list.removeEventListener === 'function') {
      list.removeEventListener('change', onChange)
    } else {
      list.removeListener(onChange)
    }
  }

  if (typeof list.addEventListener === 'function') {
    list.addEventListener('change', onChange)
  } else {
    list.addListener(onChange)
  }
  return cleanup
}

const parseInteractionEvents = (value: string | string[] | undefined) => {
  const events = Array.isArray(value) ? value : (value ?? 'click').split(',')
  return events.map(event => event.trim()).filter(Boolean)
}

const scheduleInteraction = (
  island: Element,
  events: string | string[] | undefined,
  cb: (event: Event) => void,
) => {
  const eventNames = parseInteractionEvents(events)
  if (eventNames.length === 0) {
    cb(new Event('click'))
    return () => {}
  }

  let active = true
  const onInteraction = (event: Event) => {
    if (!active) {
      return
    }
    cleanup()
    cb(event)
  }
  const cleanup = () => {
    active = false
    for (const eventName of eventNames) {
      island.removeEventListener(eventName, onInteraction)
    }
  }

  for (const eventName of eventNames) {
    island.addEventListener(eventName, onInteraction, { once: true })
  }
  return cleanup
}

const scheduleIslandHydration = (
  island: Element,
  strategy: RueIslandHydrationStrategy,
  manifest: RueIslandManifestEntry | undefined,
  hydrate: (event?: Event) => void,
) => {
  switch (strategy) {
    case 'idle':
      return requestIdle(() => hydrate())
    case 'visible':
      return scheduleVisible(island, () => hydrate())
    case 'media':
      return scheduleMedia(
        manifest?.media ?? island.getAttribute('data-rue-media') ?? undefined,
        () => hydrate(),
      )
    case 'interaction':
      return scheduleInteraction(
        island,
        manifest?.interaction ?? island.getAttribute('data-rue-interaction') ?? undefined,
        event => hydrate(event),
      )
    case 'none':
      island.setAttribute('data-rue-status', 'static')
      return () => {}
    default:
      return onDocumentReady(() => hydrate())
  }
}

export const registerRueIsland = (
  island: Element,
  options: RueIslandLoaderOptions = {},
): (() => void) | undefined => {
  const existingCleanup = loadedIslandCleanups.get(island)
  if (existingCleanup) {
    return existingCleanup
  }

  const manifest = getIslandManifestEntry(island, options.manifest)
  const strategy = getIslandHydrationStrategy(island, manifest)
  const specifier = getIslandSpecifier(island, manifest)
  let hydrated = false
  let cleanup = () => {}

  const runHydration = (replayEvent?: Event) => {
    if (hydrated || strategy === 'none') {
      return
    }

    hydrated = true
    cleanup()
    island.setAttribute('data-rue-status', 'loading')

    const load = options.resolveModule ?? defaultResolveModule
    Promise.resolve(load(specifier, island, manifest))
      .then(module =>
        mountRueIsland(
          island,
          module,
          {
            island,
            props: readIslandProps(island, manifest),
            manifest,
            strategy,
            replayEvent,
          },
          options.hydrateRoot ?? hydrateRoot,
        ),
      )
      .then(() => {
        island.setAttribute('data-rue-status', 'hydrated')
        replayInteractionEvent(island, replayEvent)
      })
      .catch(error => {
        island.setAttribute('data-rue-status', 'error')
        if (options.onError) {
          options.onError(error, island, manifest)
          return
        }
        setTimeout(() => {
          throw error
        })
      })
  }

  cleanup = scheduleIslandHydration(island, strategy, manifest, runHydration)
  const unregister = () => {
    cleanup()
    loadedIslandCleanups.delete(island)
  }
  loadedIslandCleanups.set(island, unregister)
  return unregister
}

export const startRueIslandLoader = (options: RueIslandLoaderOptions = {}) => {
  const root =
    options.root ??
    (typeof document !== 'undefined' ? document : (undefined as ParentNode | undefined))
  if (!root) {
    return () => {}
  }

  const cleanups = Array.from(root.querySelectorAll(RUE_ISLAND_ELEMENT))
    .map(island => registerRueIsland(island, options))
    .filter((cleanup): cleanup is () => void => typeof cleanup === 'function')

  return () => {
    for (const cleanup of cleanups) {
      cleanup()
    }
  }
}
