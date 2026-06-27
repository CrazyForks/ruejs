import {
  getDOMAdapter,
  setDOMAdapter,
  type DOMAdapter,
  type DomElementLike,
  type DomFragmentLike,
  type DomNodeLike,
  type DomTextLike,
} from './dom'
import {
  createElement,
  render,
  type ComponentInstance,
  type ComponentProps,
  type RenderableInput,
} from './rue'

type ServerNodeType = 1 | 3 | 8 | 11

const VOID_TAGS = new Set([
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

const BOOLEAN_ATTRIBUTES = new Set(['checked', 'disabled', 'multiple', 'readonly', 'selected'])
const SERVER_RENDERING_FLAG = '__rue_is_server_rendering__'
const RUE_SSR_PENDING_ASYNC_COMPONENT_KEY = '__rue_ssr_pending_async_component__'
const SERVER_RENDERING_BASE_ADAPTER_KEY = '__rue_server_rendering_base_adapter__'
const SERVER_RENDERING_ADAPTER_STACK_KEY = '__rue_server_rendering_adapter_stack__'
const RUE_PORTABLE_COMPONENT_TYPE_KEY = '__rue_component_type'
const RUE_PORTABLE_VAPOR_SETUP_KEY = '__rue_vapor_setup'
const RUE_PORTABLE_PROPS_KEY = 'props'
const RUE_REPEATABLE_MOUNT_FACTORY_KEY = '__rue_repeatable_mount_factory__'
const SERVER_PROTOCOL_ELEMENT_SYMBOLS = new Set([
  Symbol.for('rue.transitional.element'),
  Symbol.for('rue.element'),
])
const SERVER_PROTOCOL_FRAGMENT_SYMBOLS = new Set([
  Symbol.for('rue.fragment'),
  Symbol.for(`${['re', 'act'].join('')}.fragment`),
])
const RUE_CONTEXT_PROVIDER_MARKER = '__rue_context_provider__'
const RUE_SUSPENSE_STAGING_KEY = '__rue_suspense_staging'
const RUE_ELEMENT_HEAD_RECORD = Symbol.for('rue.element.head-record')
const TEXT_HEAD_RECORD = Symbol.for('text.head.record')
const RUE_CLIENT_REFERENCE_SYMBOL = Symbol.for('rue.client.reference')
const TEXT_CLIENT_REFERENCE_SSR_RESOLVER_KEY = '__TEXT_RESOLVE_CLIENT_REFERENCE_EXPORT__'

const escapeText = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const escapeAttribute = (value: string) =>
  escapeText(value)
    .replace(/"/g, '&quot;')
    .replace(/\u00a0/g, '&nbsp;')

class ServerNode implements DomNodeLike {
  parentNode: ServerNode | null = null
  childNodes: ServerNode[] = []

  constructor(readonly nodeType: ServerNodeType) {}

  get firstChild(): ServerNode | null {
    return this.childNodes[0] ?? null
  }

  get nextSibling(): ServerNode | null {
    if (!this.parentNode) {
      return null
    }
    const siblings = getMutableServerChildNodes(this.parentNode)
    const index = siblings.indexOf(this)
    return index === -1 ? null : (siblings[index + 1] ?? null)
  }
}

export class ServerTextNode extends ServerNode implements DomTextLike {
  textContent: string

  constructor(data: string) {
    super(3)
    this.textContent = data
  }
}

export class ServerCommentNode extends ServerNode {
  data: string

  constructor(data: string) {
    super(8)
    this.data = data
  }
}

export class ServerElementNode extends ServerNode implements DomElementLike {
  attributes = new Map<string, string>()
  rawInnerHTML: string | null = null
  style: Record<string, string> = {}
  transparent = false
  value: any
  checked = false
  disabled = false
  multiple = false
  selected = false

  constructor(readonly tagName: string) {
    super(1)
  }

  get innerHTML() {
    return this.rawInnerHTML ?? serializeServerNodeChildren(this)
  }

  set innerHTML(value: any) {
    this.rawInnerHTML = value == null ? '' : String(value)
    this.childNodes.forEach(child => {
      child.parentNode = null
    })
    this.childNodes = []
  }

  setAttribute(name: string, value: any) {
    this.attributes.set(name, String(value))
  }

  removeAttribute(name: string) {
    this.attributes.delete(name)
  }
}

export class ServerFragmentNode extends ServerNode implements DomFragmentLike {
  constructor() {
    super(11)
  }
}

const getMutableServerChildNodes = (node: ServerNode): ServerNode[] => {
  const childNodes = node.childNodes
  if (Array.isArray(childNodes)) {
    return childNodes
  }

  const normalized = Array.from((childNodes ?? []) as ArrayLike<ServerNode>)
  try {
    node.childNodes = normalized
  } catch {
    Object.defineProperty(node, 'childNodes', {
      value: normalized,
      configurable: true,
      writable: true,
    })
  }

  return normalized
}

export interface RenderToStringOptions {
  /** 传给组件根节点的 props；当 input 是组件函数时生效。 */
  props?: ComponentProps | null
  /** 是否保留 comment 节点，默认不输出。 */
  includeComments?: boolean
}

export class ServerDOMAdapter implements DOMAdapter {
  readonly root = new ServerElementNode('rue-ssr-root')

  createComment(data: string) {
    return new ServerCommentNode(data)
  }

  createTextNode(data: string) {
    return new ServerTextNode(data)
  }

  createElement(tag: string) {
    return new ServerElementNode(tag)
  }

  createTextWrapper() {
    const node = new ServerElementNode('span')
    node.transparent = true
    return node
  }

  setStyle(el: DomElementLike, style: string | Partial<CSSStyleDeclaration> | null | undefined) {
    const target = el as ServerElementNode
    if (typeof style === 'string') {
      target.attributes.set('style', style)
      return
    }
    if (!style || typeof style !== 'object') {
      target.attributes.delete('style')
      target.style = {}
      return
    }
    for (const [key, value] of Object.entries(style)) {
      if (value != null && value !== '') {
        target.style[key] = String(value)
      }
    }
    syncStyleAttribute(target)
  }

  patchStyle(
    el: DomElementLike,
    oldStyle: Partial<CSSStyleDeclaration> | undefined,
    newStyle: Partial<CSSStyleDeclaration> | undefined,
  ) {
    const target = el as ServerElementNode
    for (const key of Object.keys(oldStyle || {})) {
      if (!(key in (newStyle || {}))) {
        delete target.style[key]
      }
    }
    for (const [key, value] of Object.entries(newStyle || {})) {
      if (value != null && value !== '') {
        target.style[key] = String(value)
      }
    }
    syncStyleAttribute(target)
  }

  settextContent(el: DomNodeLike, val: any) {
    const text = val == null || typeof val === 'boolean' ? '' : String(val)
    if ((el as ServerNode).nodeType === 3) {
      ;(el as ServerTextNode).textContent = text
      return
    }
    const childNodes = getMutableServerChildNodes(el as ServerNode)
    childNodes.forEach(child => {
      child.parentNode = null
    })
    childNodes.splice(0, childNodes.length, new ServerTextNode(text))
    childNodes[0].parentNode = el as ServerNode
  }

  createDocumentFragment() {
    return new ServerFragmentNode()
  }

  appendChild(parent: DomNodeLike, child: DomNodeLike) {
    insertServerChild(parent as ServerNode, child as ServerNode, null)
  }

  removeChild(parent: DomNodeLike, child: DomNodeLike) {
    removeServerChild(parent as ServerNode, child as ServerNode)
  }

  insertBefore(parent: DomNodeLike, child: DomNodeLike, ref: DomNodeLike | null) {
    insertServerChild(parent as ServerNode, child as ServerNode, ref as ServerNode | null)
  }

  replaceChild(parent: DomNodeLike, newChild: DomNodeLike, oldChild: DomNodeLike) {
    const targetParent = parent as ServerNode
    const childNodes = getMutableServerChildNodes(targetParent)
    const oldIndex = childNodes.indexOf(oldChild as ServerNode)
    if (oldIndex === -1) {
      return
    }
    removeServerChild(targetParent, oldChild as ServerNode)
    insertServerChild(targetParent, newChild as ServerNode, childNodes[oldIndex] ?? null)
  }

  querySelector() {
    return null
  }

  setAttribute(el: DomElementLike, name: string, value: any) {
    ;(el as ServerElementNode).attributes.set(name, String(value))
  }

  removeAttribute(el: DomElementLike, name: string) {
    ;(el as ServerElementNode).attributes.delete(name)
  }

  addEventListener() {}

  removeEventListener() {}

  setClassName(el: DomElementLike, value: string) {
    ;(el as ServerElementNode).attributes.set('class', value)
  }

  setInnerHTML(el: DomElementLike, html: string) {
    ;(el as ServerElementNode).innerHTML = html
  }

  setValue(el: DomElementLike, value: any) {
    const target = el as ServerElementNode
    target.value = value
    target.attributes.set('value', value == null ? '' : String(value))
  }

  setChecked(el: DomElementLike, checked: boolean) {
    const target = el as ServerElementNode
    target.checked = checked
    setBooleanAttribute(target, 'checked', checked)
  }

  setDisabled(el: DomElementLike, disabled: boolean) {
    const target = el as ServerElementNode
    target.disabled = disabled
    setBooleanAttribute(target, 'disabled', disabled)
  }

  getTagName(el: DomElementLike) {
    return (el as ServerElementNode).tagName.toUpperCase()
  }

  contains(parent: DomNodeLike, child: DomNodeLike) {
    let current: ServerNode | null = child as ServerNode
    while (current) {
      if (current === parent) {
        return true
      }
      current = current.parentNode
    }
    return false
  }

  getParentNode(node: DomNodeLike) {
    return (node as ServerNode).parentNode
  }

  isFragment(node: DomNodeLike) {
    return (node as ServerNode).nodeType === 11
  }

  collectFragmentChildren(node: DomNodeLike) {
    return this.isFragment(node) ? [...(node as ServerNode).childNodes] : [node]
  }

  applyRef(el: DomElementLike, ref: any) {
    if (typeof ref === 'function') {
      ref(el)
    } else if (ref && typeof ref === 'object' && 'current' in ref) {
      ref.current = el
    }
  }

  clearRef(ref: any) {
    if (typeof ref === 'function') {
      ref(null)
    } else if (ref && typeof ref === 'object' && 'current' in ref) {
      ref.current = undefined
    }
  }
}

const getServerRenderingCount = (globalRecord: Record<string, unknown>) => {
  const count = globalRecord[SERVER_RENDERING_FLAG]
  return typeof count === 'number' && count > 0 ? count : 0
}

// SSR renders can overlap; keep a server adapter installed until every scope exits.
const enterServerDOMAdapterScope = (adapter: DOMAdapter) => {
  const globalRecord = globalThis as Record<string, unknown>
  const previousServerRenderingCount = getServerRenderingCount(globalRecord)

  if (previousServerRenderingCount === 0) {
    globalRecord[SERVER_RENDERING_BASE_ADAPTER_KEY] = getDOMAdapter()
  }

  const adapterStack = Array.isArray(globalRecord[SERVER_RENDERING_ADAPTER_STACK_KEY])
    ? (globalRecord[SERVER_RENDERING_ADAPTER_STACK_KEY] as DOMAdapter[])
    : []
  if (adapterStack.length === 0) {
    globalRecord[SERVER_RENDERING_ADAPTER_STACK_KEY] = adapterStack
  }
  adapterStack.push(adapter)

  setDOMAdapter(adapter)
  globalRecord[SERVER_RENDERING_FLAG] = previousServerRenderingCount + 1

  return () => {
    const currentStack = Array.isArray(globalRecord[SERVER_RENDERING_ADAPTER_STACK_KEY])
      ? (globalRecord[SERVER_RENDERING_ADAPTER_STACK_KEY] as DOMAdapter[])
      : []
    const adapterIndex = currentStack.lastIndexOf(adapter)
    if (adapterIndex >= 0) {
      currentStack.splice(adapterIndex, 1)
    }

    const nextServerRenderingCount = Math.max(0, getServerRenderingCount(globalRecord) - 1)
    if (nextServerRenderingCount > 0) {
      globalRecord[SERVER_RENDERING_FLAG] = nextServerRenderingCount
      const nextAdapter = currentStack[currentStack.length - 1]
      if (nextAdapter && getDOMAdapter() === adapter) {
        setDOMAdapter(nextAdapter)
      }
      return
    }

    delete globalRecord[SERVER_RENDERING_FLAG]
    delete globalRecord[SERVER_RENDERING_ADAPTER_STACK_KEY]
    const baseAdapter = globalRecord[SERVER_RENDERING_BASE_ADAPTER_KEY] as DOMAdapter | undefined
    delete globalRecord[SERVER_RENDERING_BASE_ADAPTER_KEY]
    if (baseAdapter) {
      setDOMAdapter(baseAdapter)
    }
  }
}

function isServerProtocolElement(value: unknown): value is {
  $$typeof: symbol
  type: unknown
  props?: Record<string, unknown> | null
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    SERVER_PROTOCOL_ELEMENT_SYMBOLS.has((value as { $$typeof?: symbol }).$$typeof as symbol)
  )
}

function isClassComponentType(value: unknown): value is new (props: Record<string, unknown>) => {
  render: () => unknown
} {
  return (
    typeof value === 'function' &&
    !!(value as { prototype?: { render?: unknown } }).prototype &&
    typeof (value as { prototype?: { render?: unknown } }).prototype?.render === 'function'
  )
}

function readClientReferenceExport(value: unknown): {
  exportName: string
  referenceKey: string
} | null {
  if (
    (typeof value !== 'object' && typeof value !== 'function') ||
    value === null ||
    (value as { $$typeof?: unknown }).$$typeof !== RUE_CLIENT_REFERENCE_SYMBOL
  ) {
    return null
  }

  const referenceKey = (value as { $$referenceKey?: unknown }).$$referenceKey
  const exportName = (value as { $$exportName?: unknown }).$$exportName
  if (typeof referenceKey === 'string' && typeof exportName === 'string') {
    return { referenceKey, exportName }
  }

  const id = (value as { $$id?: unknown }).$$id
  if (typeof id !== 'string') return null
  const separator = id.lastIndexOf('#')
  if (separator <= 0 || separator === id.length - 1) return null
  return {
    referenceKey: id.slice(0, separator),
    exportName: id.slice(separator + 1),
  }
}

function resolveClientReferenceComponentType(type: unknown): unknown {
  const reference = readClientReferenceExport(type)
  if (!reference) return type

  const resolver = (globalThis as Record<string, unknown>)[TEXT_CLIENT_REFERENCE_SSR_RESOLVER_KEY]
  if (typeof resolver !== 'function') return type

  const resolved = (resolver as (referenceKey: string, exportName: string) => unknown)(
    reference.referenceKey,
    reference.exportName,
  )
  return typeof resolved === 'function' ? resolved : type
}

function isRuePortableComponentHandle(value: unknown): value is {
  __rue_component_type: unknown
  props?: Record<string, unknown> | null
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    RUE_PORTABLE_COMPONENT_TYPE_KEY in (value as Record<string, unknown>)
  )
}

function isRuePortableVaporHandle(value: unknown): value is {
  __rue_vapor_setup: (parentContext?: DomElementLike | null) => unknown
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>)[RUE_PORTABLE_VAPOR_SETUP_KEY] === 'function'
  )
}

function readRueElementHeadRecord(value: unknown): {
  type: unknown
  props?: Record<string, unknown> | null
} | null {
  if (typeof value !== 'object' || value === null) return null
  const record = (value as { [RUE_ELEMENT_HEAD_RECORD]?: unknown })[RUE_ELEMENT_HEAD_RECORD]
  if (typeof record !== 'object' || record === null) return null
  if ((record as { [TEXT_HEAD_RECORD]?: unknown })[TEXT_HEAD_RECORD] !== true) return null
  return record as { type: unknown; props?: Record<string, unknown> | null }
}

function createFreshServerRenderable(value: unknown): unknown {
  if (Array.isArray(value)) {
    let changed = false
    const nextValue = value.map(item => {
      const replayed = createFreshServerRenderable(item)
      if (replayed !== item) changed = true
      return replayed
    })
    return changed ? nextValue : value
  }
  if (typeof value !== 'object' && typeof value !== 'function') {
    return value
  }
  if (value === null) {
    return value
  }

  const factory = (value as Record<string, unknown>)[RUE_REPEATABLE_MOUNT_FACTORY_KEY]
  if (typeof factory === 'function') {
    return factory()
  }

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    return value
  }

  let changed = false
  const clone = Object.create(prototype) as Record<string, unknown>
  for (const [key, entryValue] of Object.entries(value)) {
    const replayed = createFreshServerRenderable(entryValue)
    if (replayed !== entryValue) changed = true
    clone[key] = replayed
  }
  return changed ? clone : value
}

function normalizeServerProtocolProps(rawProps: Record<string, unknown> | null | undefined): {
  children: unknown
  props: Record<string, unknown>
} {
  const source = rawProps ?? {}
  const { children, ...props } = source
  const normalizedProps: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(props)) {
    normalizedProps[key] = normalizeServerProtocolRenderable(value)
  }
  return { children, props: normalizedProps }
}

function appendNormalizedServerChild(parent: ServerNode, child: unknown) {
  const normalized = normalizeServerProtocolRenderable(child)
  if (Array.isArray(normalized)) {
    for (const item of normalized) {
      appendNormalizedServerChild(parent, item)
    }
    return
  }
  if (normalized == null || typeof normalized === 'boolean') return
  if (typeof normalized === 'string' || typeof normalized === 'number') {
    insertServerChild(parent, new ServerTextNode(String(normalized)), null)
    return
  }
  if (normalized instanceof ServerNode) {
    insertServerChild(parent, normalized, null)
    return
  }
  insertServerChild(parent, cloneExternalDomNode(normalized as ServerNode), null)
}

function setServerElementProp(element: ServerElementNode, key: string, value: unknown) {
  if (
    key === 'children' ||
    key === 'key' ||
    key === 'ref' ||
    key === 'suppressHydrationWarning' ||
    value == null ||
    (typeof value === 'boolean' && value === false) ||
    typeof value === 'function'
  ) {
    return
  }
  if (key === 'dangerouslySetInnerHTML') {
    const html =
      typeof value === 'object' && value !== null
        ? (value as { __html?: unknown }).__html
        : undefined
    if (html !== undefined && html !== null) {
      element.innerHTML = html
    }
    return
  }
  if (key === 'style' && typeof value === 'object' && value !== null) {
    for (const [styleKey, styleValue] of Object.entries(value)) {
      if (styleValue != null && styleValue !== '') {
        element.style[styleKey] = String(styleValue)
      }
    }
    syncStyleAttribute(element)
    return
  }

  const attributeName = key === 'className' ? 'class' : key === 'htmlFor' ? 'for' : key
  if (typeof value === 'boolean') {
    if (BOOLEAN_ATTRIBUTES.has(attributeName)) {
      setBooleanAttribute(element, attributeName, value)
    } else {
      element.attributes.set(attributeName, String(value))
    }
    return
  }
  element.attributes.set(attributeName, String(value))
}

function createServerNodeFromProtocolElement(
  type: string,
  props: Record<string, unknown>,
  children: unknown,
): ServerNode {
  const node = type === 'fragment' ? new ServerFragmentNode() : new ServerElementNode(type)
  if (node instanceof ServerElementNode) {
    for (const [key, value] of Object.entries(props)) {
      setServerElementProp(node, key, value)
    }
    const ref = props.ref
    if (ref) {
      getDOMAdapter().applyRef(node, ref)
    }
  }
  if (!(node instanceof ServerElementNode) || node.rawInnerHTML == null) {
    if (Array.isArray(children)) {
      for (const child of children) appendNormalizedServerChild(node, child)
    } else if (children !== undefined) {
      appendNormalizedServerChild(node, children)
    }
  }
  return node
}

function normalizeServerProtocolRenderable(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => normalizeServerProtocolRenderable(item))
  }

  if (isRuePortableComponentHandle(value)) {
    const type = resolveClientReferenceComponentType(value[RUE_PORTABLE_COMPONENT_TYPE_KEY])
    const rawProps =
      value[RUE_PORTABLE_PROPS_KEY] && typeof value[RUE_PORTABLE_PROPS_KEY] === 'object'
        ? (value[RUE_PORTABLE_PROPS_KEY] as Record<string, unknown>)
        : {}
    const { children, props } = normalizeServerProtocolProps(rawProps)

    if (isClassComponentType(type)) {
      const instance = new type({
        ...props,
        ...(children !== undefined ? { children } : null),
      })
      return normalizeServerProtocolRenderable(instance.render())
    }

    if (
      typeof type === 'function' &&
      (type as unknown as Record<string, unknown>)[RUE_CONTEXT_PROVIDER_MARKER] === true
    ) {
      return normalizeServerProtocolRenderable(children)
    }

    if (typeof type === 'function') {
      return normalizeServerProtocolRenderable(
        (type as (props: Record<string, unknown>) => unknown)({
          ...props,
          ...(children !== undefined ? { children } : null),
        }),
      )
    }
  }

  const headRecord = readRueElementHeadRecord(value)
  if (headRecord) {
    const { children, props } = normalizeServerProtocolProps(headRecord.props)
    const childList = Array.isArray(children)
      ? children.map(child => normalizeServerProtocolRenderable(child))
      : children !== undefined
        ? [normalizeServerProtocolRenderable(children)]
        : []
    const type = SERVER_PROTOCOL_FRAGMENT_SYMBOLS.has(headRecord.type as symbol)
      ? 'fragment'
      : headRecord.type
    if (typeof type === 'string') {
      return createServerNodeFromProtocolElement(type, props, childList)
    }
  }

  if (isRuePortableVaporHandle(value)) {
    return normalizeServerProtocolRenderable(value[RUE_PORTABLE_VAPOR_SETUP_KEY](null))
  }

  if (!isServerProtocolElement(value)) {
    return value
  }

  const { children, props } = normalizeServerProtocolProps(value.props)
  const rawType = SERVER_PROTOCOL_FRAGMENT_SYMBOLS.has(value.type as symbol)
    ? 'fragment'
    : value.type
  const type = resolveClientReferenceComponentType(rawType)

  if (isClassComponentType(type)) {
    const instance = new type({
      ...props,
      ...(children !== undefined ? { children } : null),
    })
    return normalizeServerProtocolRenderable(instance.render())
  }

  if (
    typeof type === 'function' &&
    (type as unknown as Record<string, unknown>)[RUE_CONTEXT_PROVIDER_MARKER] === true
  ) {
    return normalizeServerProtocolRenderable(children)
  }

  if (typeof type === 'function') {
    return normalizeServerProtocolRenderable(
      (type as (props: Record<string, unknown>) => unknown)({
        ...props,
        ...(children !== undefined ? { children } : null),
      }),
    )
  }

  if (typeof type !== 'string') {
    return null
  }

  const childList = Array.isArray(children)
    ? children.map(child => normalizeServerProtocolRenderable(child))
    : children !== undefined
      ? [normalizeServerProtocolRenderable(children)]
      : []
  return createServerNodeFromProtocolElement(type, props, childList)
}

const setBooleanAttribute = (node: ServerElementNode, name: string, value: boolean) => {
  if (value) {
    node.attributes.set(name, '')
  } else {
    node.attributes.delete(name)
  }
}

const syncStyleAttribute = (node: ServerElementNode) => {
  const style = Object.entries(node.style)
    .map(([key, value]) => `${key.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)}: ${value}`)
    .join('; ')
  if (style) {
    node.attributes.set('style', style)
  } else {
    node.attributes.delete('style')
  }
}

const removeServerChild = (parent: ServerNode, child: ServerNode) => {
  const childNodes = getMutableServerChildNodes(parent)
  const index = childNodes.indexOf(child)
  if (index === -1) {
    return
  }
  childNodes.splice(index, 1)
  child.parentNode = null
}

const copyExternalAttributes = (source: unknown, target: ServerElementNode) => {
  const attributes = (source as { attributes?: unknown }).attributes
  if (!attributes) return
  if (attributes instanceof Map) {
    for (const [name, value] of attributes) {
      target.attributes.set(String(name), String(value))
    }
    return
  }
  if (
    typeof attributes === 'object' &&
    attributes !== null &&
    typeof (attributes as { length?: unknown }).length === 'number'
  ) {
    const list = attributes as {
      length: number
      item?: (index: number) => { name?: unknown; value?: unknown } | null
      [index: number]: { name?: unknown; value?: unknown } | undefined
    }
    for (let i = 0; i < list.length; i += 1) {
      const attr = typeof list.item === 'function' ? list.item(i) : list[i]
      if (!attr || attr.name == null) continue
      target.attributes.set(String(attr.name), String(attr.value ?? ''))
    }
  }
}

const cloneExternalDomNode = (node: unknown): ServerNode => {
  if (node instanceof ServerNode) return node
  const domNode = node as {
    childNodes?: ArrayLike<unknown>
    data?: unknown
    nodeName?: unknown
    nodeType?: unknown
    tagName?: unknown
    textContent?: unknown
  }
  if (domNode.nodeType === 3) {
    return new ServerTextNode(String(domNode.textContent ?? ''))
  }
  if (domNode.nodeType === 8) {
    return new ServerCommentNode(String(domNode.data ?? ''))
  }
  if (domNode.nodeType === 11) {
    const fragment = new ServerFragmentNode()
    for (const child of Array.from(domNode.childNodes ?? [])) {
      insertServerChild(fragment, child, null)
    }
    return fragment
  }
  if (domNode.nodeType !== 1) return new ServerTextNode('')

  const tagName = String(domNode.tagName ?? domNode.nodeName ?? '').toLowerCase()
  const element = new ServerElementNode(tagName || 'span')
  copyExternalAttributes(node, element)
  for (const child of Array.from(domNode.childNodes ?? [])) {
    insertServerChild(element, child, null)
  }
  return element
}

const insertServerChild = (parent: ServerNode, child: unknown, ref: ServerNode | null) => {
  const serverChild = cloneExternalDomNode(child)
  if (serverChild.nodeType === 11) {
    const moving = [...getMutableServerChildNodes(serverChild)]
    for (const fragmentChild of moving) {
      insertServerChild(parent, fragmentChild, ref)
    }
    return
  }

  if (serverChild.parentNode) {
    removeServerChild(serverChild.parentNode, serverChild)
  }

  const childNodes = getMutableServerChildNodes(parent)
  const refIndex = ref ? childNodes.indexOf(ref) : -1
  const insertIndex = refIndex === -1 ? childNodes.length : refIndex
  childNodes.splice(insertIndex, 0, serverChild)
  serverChild.parentNode = parent
}

const serializeAttributes = (node: ServerElementNode) => {
  const attributes: string[] = []
  for (const [name, value] of node.attributes) {
    if (value == null) {
      continue
    }
    if (BOOLEAN_ATTRIBUTES.has(name) && (value === '' || value === 'true')) {
      attributes.push(name)
      continue
    }
    attributes.push(`${name}="${escapeAttribute(String(value))}"`)
  }
  return attributes.length ? ` ${attributes.join(' ')}` : ''
}

const serializeServerNode = (node: ServerNode, options: RenderToStringOptions = {}): string => {
  if ((node as unknown as Record<string, unknown>)[RUE_SUSPENSE_STAGING_KEY] === true) {
    return ''
  }
  if (node.nodeType === 3) {
    return escapeText((node as ServerTextNode).textContent)
  }
  if (node.nodeType === 8) {
    return options.includeComments ? `<!--${(node as ServerCommentNode).data}-->` : ''
  }
  if (node.nodeType === 11) {
    return serializeServerNodeChildren(node, options)
  }

  const element = node as ServerElementNode
  if (element.transparent) {
    return serializeServerNodeChildren(element, options)
  }
  const tag = element.tagName
  const attrs = serializeAttributes(element)
  if (VOID_TAGS.has(tag.toLowerCase())) {
    return `<${tag}${attrs}>`
  }
  const children =
    element.rawInnerHTML == null
      ? serializeServerNodeChildren(element, options)
      : element.rawInnerHTML
  return `<${tag}${attrs}>${children}</${tag}>`
}

const serializeServerNodeChildren = (
  node: ServerNode,
  options: RenderToStringOptions = {},
): string => node.childNodes.map(child => serializeServerNode(child, options)).join('')

const flushServerRenderMicrotasks = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

export const renderToString = async (
  input: RenderableInput | ComponentInstance<any>,
  options: RenderToStringOptions = {},
) => {
  const adapter = new ServerDOMAdapter()
  const globalRecord = globalThis as Record<string, unknown>
  const leaveServerDOMAdapterScope = enterServerDOMAdapterScope(adapter)

  try {
    const createRenderValue = () => {
      const value =
        typeof input === 'function'
          ? createElement(input as ComponentInstance<any>, options.props ?? null)
          : input
      return normalizeServerProtocolRenderable(createFreshServerRenderable(value))
    }
    let shouldRender = true
    for (let i = 0; i < 8; i += 1) {
      if (shouldRender) {
        render(null as RenderableInput, adapter.root)
        const renderValue = createRenderValue()
        render(renderValue as RenderableInput, adapter.root)
        shouldRender = false
      }
      const pendingAsyncComponents = globalRecord[RUE_SSR_PENDING_ASYNC_COMPONENT_KEY] as
        | Promise<unknown>[]
        | undefined
      if (pendingAsyncComponents?.length) {
        globalRecord[RUE_SSR_PENDING_ASYNC_COMPONENT_KEY] = []
        await Promise.all(pendingAsyncComponents)
        shouldRender = true
        continue
      }
      await flushServerRenderMicrotasks()
    }
    return serializeServerNodeChildren(adapter.root, options)
  } finally {
    try {
      render(null as RenderableInput, adapter.root)
      await flushServerRenderMicrotasks()
    } finally {
      leaveServerDOMAdapterScope()
    }
  }
}

/** Run arbitrary server-side renderable creation with a ServerDOMAdapter installed. */
export const runWithServerDOMAdapter = async <T>(runner: () => T | Promise<T>): Promise<T> => {
  const adapter = new ServerDOMAdapter()
  const leaveServerDOMAdapterScope = enterServerDOMAdapterScope(adapter)

  try {
    return await runner()
  } finally {
    leaveServerDOMAdapterScope()
  }
}
