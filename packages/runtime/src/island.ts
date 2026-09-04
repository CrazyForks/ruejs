import {
  createCompiledComponent,
  render,
  renderAnchor,
  type ComponentInstance,
  type ComponentProps,
  type RenderInput,
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
import {
  RUE_ISLAND_ELEMENT,
  RUE_ISLAND_PROPS_SCRIPT_TYPE,
  deserializeIslandProps,
  escapeIslandAttribute,
  serializeIslandProps,
  type RueIslandHtmlOptions,
  type RueIslandHydrationStrategy,
  type RueIslandManifest,
  type RueIslandManifestEntry,
} from './island-protocol'
import {
  adoptHydratedNode,
  withDOMHostOperations as withHydrationDOMHostOperations,
  withHydrationStaging,
} from './compiler-runtime/dom.hydrate'
import { withHydrationDOMMutations } from './compiler-runtime/dom.browser'
export {
  appendChild as _$compiledAppendChild,
  createComment as _$compiledCreateComment,
  createElement as _$compiledCreateElement,
  createTextNode as _$compiledCreateTextNode,
  insertBefore as _$compiledInsertBefore,
  removeChild as _$compiledRemoveChild,
  template as _$template,
} from './compiler-runtime/dom.hydrate'

export * from './island-protocol'

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
    value: RenderInput,
    options?: HydrateRootOptions,
  ) => RueRootHandle | void
  onError?: (error: unknown, island: Element, manifest?: RueIslandManifestEntry) => void
}

export interface RueIslandLifecycleDetail {
  id: string
  strategy: RueIslandHydrationStrategy
}

const RUE_ELEMENT_HEAD_RECORD = Symbol.for('rue.element.head-record')
const TEXT_HEAD_RECORD = Symbol.for('text.head.record')
const RUE_HYDRATION_ROOT_ANCHOR = 'rue:hydrate:anchor'
const RUE_HYDRATED_ADOPTED_NODE = '__rue_hydrated_adopted'
const loadedIslandCleanups = new WeakMap<Element, () => void>()
const activeIslandLoaders = new WeakMap<ParentNode, () => void>()

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
    'data-rue-timeout': options.timeout === undefined ? undefined : String(options.timeout),
    'data-rue-root-margin': options.rootMargin,
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

const isCompiledNativeElementHandle = (value: unknown): boolean =>
  value != null &&
  typeof value === 'object' &&
  typeof (value as Record<string, unknown>).__rue_compiled_component_factory__ === 'string'

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
  private readonly initialNodes: Set<Node>
  private readonly initialTreeNodes = new WeakSet<Node>()
  private readonly nativeListenerRecords: Array<{
    target: EventTarget
    type: string
    listener: EventListenerOrEventListenerObject
  }> = []

  constructor(
    private readonly base: DOMAdapter,
    private readonly container: Element,
    private readonly rootAnchor: Node,
  ) {
    this.initialNodes = new Set(Array.from(container.childNodes))
    const remember = (node: Node) => {
      this.initialTreeNodes.add(node)
      for (const child of Array.from(node.childNodes)) remember(child)
    }
    for (const node of this.initialNodes) remember(node)
  }

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
      return candidate as unknown as DomTextLike
    }

    return fresh
  }

  createElement(tag: string, parent?: DomElementLike | null): DomElementLike {
    const fresh = this.base.createElement(tag, parent)
    const explicitParent = this.asParentNode(parent)
    const isRootStaging =
      explicitParent != null &&
      (explicitParent as unknown as { __rue_hydrated_adopted?: boolean }).__rue_hydrated_adopted ===
        true
    if (isRootStaging) {
      this.predictedAdoptionTargets.set(explicitParent as unknown as object, this.container)
    }
    const resolvedExplicitParent = explicitParent
      ? this.resolvePredictedParent(explicitParent)
      : null
    if (explicitParent && resolvedExplicitParent !== explicitParent) {
      this.observeHydrationParent(resolvedExplicitParent)
    }
    const activeAnchor = this.resolveActiveAnchor()
    const parentNode = resolvedExplicitParent ?? activeAnchor?.parentNode ?? null
    const anchor = parentNode
      ? explicitParent
        ? isRootStaging
          ? this.rootAnchor
          : this.resolveAnchorForParent(parentNode)
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
        return adopted as unknown as DomElementLike
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
      return adopted as unknown as DomElementLike
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
    this.base.appendChild(
      this.resolvePredictedAdoptionTarget(parent),
      this.resolvePredictedAdoptionTarget(child),
    )
    this.rememberAnchor(child)
  }

  removeChild(parent: DomNodeLike, child: DomNodeLike): void {
    this.base.removeChild(
      this.resolvePredictedAdoptionTarget(parent),
      this.resolvePredictedAdoptionTarget(child),
    )
  }

  insertBefore(parent: DomNodeLike, child: DomNodeLike, ref: DomNodeLike | null): void {
    this.observeParent(parent)
    this.base.insertBefore(
      this.resolvePredictedAdoptionTarget(parent),
      this.resolvePredictedAdoptionTarget(child),
      this.resolvePredictedAdoptionTarget(ref),
    )
    this.rememberAnchor(child)
  }

  replaceChild(parent: DomNodeLike, newChild: DomNodeLike, oldChild: DomNodeLike): void {
    this.observeParent(parent)
    this.base.replaceChild(
      this.resolvePredictedAdoptionTarget(parent),
      this.resolvePredictedAdoptionTarget(newChild),
      this.resolvePredictedAdoptionTarget(oldChild),
    )
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
    this.reconcileMixedHydrationChildren(this.container)
    if (!this.adoptedRoot && !this.failureMessage) {
      const hydratableRoots = getHydratableChildNodes(this.container, { ignoreWhitespace: true })
      const clientRoots = hydratableRoots.filter(
        node => node !== this.rootAnchor && !this.initialNodes.has(node),
      )
      const serverRoots = hydratableRoots.filter(
        node => this.initialNodes.has(node) && !isIslandPropsScriptNode(node),
      )
      if (
        clientRoots.length === 1 &&
        serverRoots.length === 1 &&
        adoptHydratedNode(serverRoots[0], clientRoots[0])
      ) {
        this.markAdoptedNode(serverRoots[0], this.container)
        clientRoots[0].parentNode?.removeChild(clientRoots[0])
      } else if (clientRoots.length === 1 && serverRoots.length === 1) {
        this.markFailure('Rue hydrateRoot SSR root structure did not match the client element.')
      }
    }
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

  recordNativeListeners(
    records: Array<{
      target: EventTarget
      type: string
      listener: EventListenerOrEventListenerObject
    }>,
  ) {
    this.nativeListenerRecords.push(...records)
  }

  transferNativeListeners() {
    for (const { target, type, listener } of this.nativeListenerRecords) {
      const adopted = (target as EventTarget & { __rue_hydrated_adopted_target?: EventTarget })
        .__rue_hydrated_adopted_target
      if (!adopted || adopted === target) continue
      adopted.addEventListener(type, listener)
      this.cleanupCallbacks.push(() => adopted.removeEventListener(type, listener))
    }
  }

  private reconcileMixedHydrationChildren(parent: ParentNode) {
    const children = Array.from(parent.childNodes)
    for (const clientNode of children) {
      if (this.initialTreeNodes.has(clientNode) || isRueHydrationComment(clientNode)) continue
      const serverNode = children.find(
        candidate =>
          candidate !== clientNode &&
          this.initialTreeNodes.has(candidate) &&
          candidate.nodeType === clientNode.nodeType &&
          (candidate.nodeType !== Node.ELEMENT_NODE ||
            (candidate as Element).tagName === (clientNode as Element).tagName),
      )
      if (serverNode && adoptHydratedNode(serverNode, clientNode)) {
        this.markAdoptedNode(serverNode, parent)
        clientNode.parentNode?.removeChild(clientNode)
      }
    }
    for (const child of Array.from(parent.childNodes)) {
      if ('childNodes' in child)
        this.reconcileMixedHydrationChildren(child as unknown as ParentNode)
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
  value: RenderInput,
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
        null as unknown as RenderInput,
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
    null as unknown as RenderInput,
    container as unknown as DomElementLike,
    anchor as unknown as DomNodeLike,
  )
  cleanup()
  removeNode(anchor)
}

const tryAdoptHydrationRootWithRenderer = (
  container: Element,
  value: RenderInput,
  options: HydrateRootOptions,
): RueRootHandle | null => {
  const previousAdapter = getDOMAdapter()
  const anchor = previousAdapter.createComment(RUE_HYDRATION_ROOT_ANCHOR) as unknown as Node
  const hydrationAdapter = new HydrationDOMAdapter(previousAdapter, container, anchor)

  try {
    hydrationAdapter.appendChild(
      container as unknown as DomNodeLike,
      anchor as unknown as DomNodeLike,
    )
    const nativeAddEventListener = EventTarget.prototype.addEventListener
    const nativeListeners: Array<{
      target: EventTarget
      type: string
      listener: EventListenerOrEventListenerObject
    }> = []
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      if (listener != null) nativeListeners.push({ target: this, type, listener })
      return nativeAddEventListener.call(this, type, listener, options)
    }
    try {
      withHydrationDOMHostOperations(container, () =>
        withHydrationStaging(() =>
          renderAnchor(
            value,
            container as unknown as DomElementLike,
            anchor as unknown as DomNodeLike,
          ),
        ),
      )
    } finally {
      EventTarget.prototype.addEventListener = nativeAddEventListener
      hydrationAdapter.recordNativeListeners(nativeListeners)
    }
  } catch (error) {
    cleanupRendererHydrationAttempt(container, anchor, () => hydrationAdapter.cleanup())
    throw error
  }
  removeDirectIslandPropsScripts(container)
  const commit = hydrationAdapter.commitStatus()
  if (!commit.ok) {
    cleanupRendererHydrationAttempt(container, anchor, () => hydrationAdapter.cleanup())
    options.onMismatch?.(commit.message ?? 'Rue hydrateRoot SSR DOM adoption failed.', container)
    return null
  }

  hydrationAdapter.transferNativeListeners()

  return createRendererAdoptedRootHandle(container, anchor, () => hydrationAdapter.cleanup())
}

export const hydrateRoot = (
  container: Element,
  value: RenderInput,
  options: HydrateRootOptions = {},
): RueRootHandle => {
  if (options.replace === false && container.firstChild) {
    if (
      options.adoptComponents === true ||
      getElementHeadRecord(value) ||
      isCompiledNativeElementHandle(value)
    ) {
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
      render(null as unknown as RenderInput, container as unknown as DomElementLike)
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
    value: RenderInput,
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

  const vnode = createCompiledComponent(component, context.props)
  if (context.strategy === 'only') {
    render(vnode as RenderInput, island as unknown as DomElementLike)
    return undefined
  }
  return hydrateRootImpl(island, vnode as RenderInput, {
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

const requestIdle = (cb: () => void, timeout?: number) => {
  const win = typeof window !== 'undefined' ? window : undefined
  const request = win?.requestIdleCallback
  const id = request
    ? request(cb, timeout === undefined ? undefined : { timeout })
    : setTimeout(cb, 1)
  return () => {
    if (request) {
      win?.cancelIdleCallback?.(id as number)
    } else {
      clearTimeout(id as number)
    }
  }
}

const scheduleVisible = (island: Element, cb: () => void, rootMargin?: string) => {
  const win = island.ownerDocument?.defaultView ?? (typeof window !== 'undefined' ? window : null)
  const Observer = win?.IntersectionObserver ?? globalThis.IntersectionObserver
  if (typeof Observer !== 'function') {
    cb()
    return () => {}
  }

  const observer = new Observer(
    entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect()
        cb()
      }
    },
    rootMargin ? { rootMargin } : undefined,
  )
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

const readNonNegativeNumberAttribute = (island: Element, name: string) => {
  const raw = island.getAttribute(name)
  if (raw == null || raw.trim() === '') return undefined
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : undefined
}

const scheduleIslandHydration = (
  island: Element,
  strategy: RueIslandHydrationStrategy,
  manifest: RueIslandManifestEntry | undefined,
  hydrate: (event?: Event) => void,
) => {
  switch (strategy) {
    case 'idle':
      return requestIdle(
        () => hydrate(),
        manifest?.timeout ?? readNonNegativeNumberAttribute(island, 'data-rue-timeout'),
      )
    case 'visible':
      return scheduleVisible(
        island,
        () => hydrate(),
        manifest?.rootMargin ?? island.getAttribute('data-rue-root-margin') ?? undefined,
      )
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

const dispatchIslandLifecycleEvent = (
  island: Element,
  type: 'rue:before-hydrate' | 'rue:hydrate' | 'rue:error',
  detail: RueIslandLifecycleDetail,
) => {
  const EventConstructor = island.ownerDocument?.defaultView?.CustomEvent ?? globalThis.CustomEvent
  if (typeof EventConstructor !== 'function') return
  island.dispatchEvent(new EventConstructor(type, { bubbles: true, detail }))
}

const isIslandWithinRoot = (island: Element, root: ParentNode | undefined) => {
  if (!root) return island.isConnected
  if (root === island) return true
  return typeof (root as ParentNode & { contains?: (node: Node) => boolean }).contains ===
    'function'
    ? (root as ParentNode & { contains: (node: Node) => boolean }).contains(island)
    : island.isConnected
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
  const detail: RueIslandLifecycleDetail = {
    id: island.getAttribute('data-rue-id') ?? manifest?.id ?? '',
    strategy,
  }
  let active = true
  let hydrated = false
  let scheduleCleanup = () => {}

  const runHydration = (replayEvent?: Event) => {
    if (hydrated || strategy === 'none' || !active || !isIslandWithinRoot(island, options.root)) {
      return
    }

    hydrated = true
    scheduleCleanup()
    island.setAttribute('data-rue-status', 'loading')
    dispatchIslandLifecycleEvent(island, 'rue:before-hydrate', detail)

    const load = options.resolveModule ?? defaultResolveModule
    Promise.resolve(load(specifier, island, manifest))
      .then(module => {
        if (!active || !isIslandWithinRoot(island, options.root)) return undefined
        return mountRueIsland(
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
        )
      })
      .then(() => {
        if (!active || !isIslandWithinRoot(island, options.root)) return
        island.setAttribute('data-rue-status', 'hydrated')
        dispatchIslandLifecycleEvent(island, 'rue:hydrate', detail)
        replayInteractionEvent(island, replayEvent)
      })
      .catch(error => {
        if (!active || !isIslandWithinRoot(island, options.root)) return
        island.setAttribute('data-rue-status', 'error')
        dispatchIslandLifecycleEvent(island, 'rue:error', detail)
        if (options.onError) {
          options.onError(error, island, manifest)
          return
        }
        setTimeout(() => {
          throw error
        })
      })
  }

  scheduleCleanup = scheduleIslandHydration(island, strategy, manifest, runHydration)
  const unregister = () => {
    if (!active) return
    active = false
    scheduleCleanup()
    loadedIslandCleanups.delete(island)
  }
  loadedIslandCleanups.set(island, unregister)
  if (strategy === 'none') {
    queueMicrotask(() => {
      if (active && isIslandWithinRoot(island, options.root)) {
        dispatchIslandLifecycleEvent(island, 'rue:hydrate', detail)
      }
    })
  }
  return unregister
}

export const startRueIslandLoader = (options: RueIslandLoaderOptions = {}) => {
  const root =
    options.root ??
    (typeof document !== 'undefined' ? document : (undefined as ParentNode | undefined))
  if (!root) {
    return () => {}
  }

  activeIslandLoaders.get(root)?.()

  let active = true
  const registered = new Map<Element, () => void>()
  const terminalStatuses = new Set(['hydrated', 'static', 'error'])

  const getIslandsInSubtree = (node: ParentNode | Element) => {
    const islands: Element[] = []
    if ((node as Element).nodeType === 1 && (node as Element).matches?.(RUE_ISLAND_ELEMENT)) {
      islands.push(node as Element)
    }
    if (typeof node.querySelectorAll === 'function') {
      islands.push(...Array.from(node.querySelectorAll(RUE_ISLAND_ELEMENT)))
    }
    return islands
  }

  const canRegister = (island: Element) => {
    let ancestor = island.parentElement?.closest(RUE_ISLAND_ELEMENT)
    while (ancestor && isIslandWithinRoot(ancestor, root)) {
      const status = ancestor.getAttribute('data-rue-status')
      if (!status || !terminalStatuses.has(status)) return false
      ancestor = ancestor.parentElement?.closest(RUE_ISLAND_ELEMENT)
    }
    return true
  }

  const registerCandidate = (island: Element) => {
    if (
      !active ||
      registered.has(island) ||
      loadedIslandCleanups.has(island) ||
      !isIslandWithinRoot(island, root) ||
      !canRegister(island)
    ) {
      return
    }
    const cleanup = registerRueIsland(island, { ...options, root })
    if (cleanup) registered.set(island, cleanup)
  }

  const scan = (node: ParentNode | Element) => {
    for (const island of getIslandsInSubtree(node)) registerCandidate(island)
  }

  const unregisterSubtree = (node: ParentNode | Element) => {
    for (const island of getIslandsInSubtree(node)) {
      const cleanup = registered.get(island)
      if (!cleanup) continue
      cleanup()
      registered.delete(island)
    }
  }

  const onAncestorComplete = (event: Event) => {
    if (!active || !(event.target instanceof Element)) return
    scan(event.target)
  }
  ;(root as ParentNode & EventTarget).addEventListener?.('rue:hydrate', onAncestorComplete)
  ;(root as ParentNode & EventTarget).addEventListener?.('rue:error', onAncestorComplete)

  const ownerWindow =
    (root as Node).ownerDocument?.defaultView ??
    ((root as Document).defaultView || (typeof window !== 'undefined' ? window : null))
  const Observer = ownerWindow?.MutationObserver ?? globalThis.MutationObserver
  const observer =
    typeof Observer === 'function'
      ? new Observer(records => {
          for (const record of records) {
            for (const removed of Array.from(record.removedNodes)) {
              unregisterSubtree(removed as ParentNode)
            }
            for (const added of Array.from(record.addedNodes)) {
              scan(added as ParentNode)
            }
          }
        })
      : null
  observer?.observe(root as Node, { childList: true, subtree: true })
  scan(root)

  const stop = () => {
    if (!active) return
    active = false
    observer?.disconnect()
    ;(root as ParentNode & EventTarget).removeEventListener?.('rue:hydrate', onAncestorComplete)
    ;(root as ParentNode & EventTarget).removeEventListener?.('rue:error', onAncestorComplete)
    for (const cleanup of registered.values()) cleanup()
    registered.clear()
    if (activeIslandLoaders.get(root) === stop) {
      activeIslandLoaders.delete(root)
    }
  }
  activeIslandLoaders.set(root, stop)
  return stop
}
