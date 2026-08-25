/*
架构设计总览
- DOMAdapter 抽象：定义跨宿主（浏览器/SSR/自定义渲染器）一致的节点与元素操作。
- BrowserDOMAdapter 实现：以原生 document 为后端，提供创建、插入、样式、属性、事件等完整能力。
- CURRENT_ADAPTER：保存当前适配器，支持运行时替换；通过 globalThis.__rue_dom 暴露统一代理。
- 工具函数导出：对适配器方法进行薄封装，便于以函数式调用和 tree-shaking。
*/
import { CUSTOM_ELEMENT_SYNC_PROPS_KEY } from './custom-elements.shared'

/** Rue DOMAdapter 使用的最小节点形态。 */
export interface DomNodeLike {
  /** 当前节点的下一个兄弟节点。 */
  nextSibling?: DomNodeLike | null
  /** 当前节点的第一个子节点。 */
  firstChild?: DomNodeLike | null
}

/** Rue DOMAdapter 使用的最小元素形态。 */
export interface DomElementLike extends DomNodeLike {
  /** 元素 HTML 内容；非浏览器宿主可以按需实现。 */
  innerHTML?: any
}

/** 文档片段节点的抽象类型。 */
export interface DomFragmentLike extends DomNodeLike {}

/** 文本节点的抽象类型。 */
export interface DomTextLike extends DomNodeLike {}

/** DOM 宿主适配器接口，封装浏览器或自定义宿主的全部节点操作。 */
export interface DOMAdapter {
  /** 创建注释节点
   * @param data 注释文本内容
   * @returns 抽象的注释节点
   */
  createComment(data: string): DomNodeLike
  /** 创建文本节点
   * @param data 文本内容
   * @returns 抽象的文本节点
   */
  createTextNode(data: string): DomTextLike
  /** 创建元素节点
   * @param tag 标签名（支持 SVG 标签）
   * @param parent 父元素；共享的 HTML/SVG 标签依赖它决定命名空间
   * @returns 抽象的元素节点
   */
  createElement(tag: string, parent?: DomElementLike | null): DomElementLike
  /** 创建文本包装元素
   * @param parent 父元素，用于判断是否在 SVG 环境
   * @returns 在 SVG 中返回 <text>，HTML 中返回 <span>
   */
  createTextWrapper(parent: DomElementLike): DomElementLike
  /** 设置行内样式
   * @param el 目标元素
   * @param style 字符串形式、部分 CSSStyleDeclaration，或 null/undefined 清空
   */
  setStyle(
    el: DomElementLike,
    style: string | Partial<CSSStyleDeclaration> | null | undefined,
  ): void
  /** 样式增量补丁
   * @param el 目标元素
   * @param oldStyle 旧样式对象
   * @param newStyle 新样式对象
   */
  patchStyle(
    el: DomElementLike,
    oldStyle: Partial<CSSStyleDeclaration> | undefined,
    newStyle: Partial<CSSStyleDeclaration> | undefined,
  ): void
  /** 设置节点文本内容
   * @param el 目标节点
   * @param val 值，null/undefined/boolean 将写为空字符串
   */
  settextContent(el: DomNodeLike, val: any): void
  /** 创建文档片段
   * @returns 抽象的文档片段节点
   */
  createDocumentFragment(): DomFragmentLike
  /** 追加子节点
   * @param parent 父节点
   * @param child 子节点
   */
  appendChild(parent: DomNodeLike, child: DomNodeLike): void
  /** 移除子节点
   * @param parent 父节点
   * @param child 子节点
   */
  removeChild(parent: DomNodeLike, child: DomNodeLike): void
  /** 在参照节点前插入
   * @param parent 父节点
   * @param child 插入的子节点
   * @param ref 参照节点，可为 null 表示尾部
   */
  insertBefore(parent: DomNodeLike, child: DomNodeLike, ref: DomNodeLike | null): void
  /** 用新节点替换旧节点
   * @param parent 父节点
   * @param newChild 新子节点
   * @param oldChild 旧子节点
   */
  replaceChild(parent: DomNodeLike, newChild: DomNodeLike, oldChild: DomNodeLike): void
  /** 使用选择器查询元素
   * @param selector CSS 选择器
   * @returns 抽象的元素或 null
   */
  querySelector(selector: string): DomElementLike | null
  /** 设置属性
   * @param el 目标元素
   * @param name 属性名
   * @param value 属性值（统一转字符串）
   */
  setAttribute(el: DomElementLike, name: string, value: any): void
  /** 移除属性
   * @param el 目标元素
   * @param name 属性名
   */
  removeAttribute(el: DomElementLike, name: string): void
  /** 添加事件监听
   * @param el 目标元素
   * @param eventName 事件名
   * @param listener 事件处理函数
   */
  addEventListener(el: DomElementLike, eventName: string, listener: DOMEventHandler): void
  /** 移除事件监听
   * @param el 目标元素
   * @param eventName 事件名
   * @param listener 事件处理函数
   */
  removeEventListener(el: DomElementLike, eventName: string, listener: DOMEventHandler): void
  /** 设置类名
   * @param el 目标元素
   * @param value 类名值，null/undefined 会清空
   */
  setClassName(el: DomElementLike, value: any): void
  /** 设置 innerHTML
   * @param el 目标元素（HTMLElement）
   * @param html HTML 字符串
   */
  setInnerHTML(el: DomElementLike, html: string): void
  /** 设置表单值
   * @param el 目标元素
   * @param value 值，兼容 select[multiple] 与普通可写 value
   */
  setValue(el: DomElementLike, value: any): void
  /** 设置选中状态
   * @param el 目标元素
   * @param checked 是否选中
   */
  setChecked(el: DomElementLike, checked: boolean): void
  /** 设置禁用状态
   * @param el 目标元素
   * @param disabled 是否禁用
   */
  setDisabled(el: DomElementLike, disabled: boolean): void
  /** 获取标签名
   * @param el 目标元素
   * @returns 标签名（原生 tagName）
   */
  getTagName(el: DomElementLike): string
  /** 判断父子包含关系
   * @param parent 父节点
   * @param child 子节点
   * @returns 是否包含
   */
  contains(parent: DomNodeLike, child: DomNodeLike): boolean
  /** 获取父节点
   * @param node 当前节点
   * @returns 父节点或 null
   */
  getParentNode(node: DomNodeLike): DomNodeLike | null
  /** 判断是否为文档片段
   * @param node 当前节点
   * @returns 是否为 DocumentFragment
   */
  isFragment(node: DomNodeLike): boolean
  /** 收集片段的所有子节点
   * @param node 当前节点或片段
   * @returns 若为片段返回其子节点数组，否则返回自身数组
   */
  collectFragmentChildren(node: DomNodeLike): DomNodeLike[]
  /** 应用 ref
   * @param el 目标元素
   * @param ref 函数或 {current: T} 对象
   */
  applyRef(el: DomElementLike, ref: any): void
  /** 清理 ref
   * @param ref 函数或 {current: T} 对象
   */
  clearRef(ref: any): void
}

// SVG 标签命名空间与白名单：用于 createElement 的分支创建
const SVG_NS = 'http://www.w3.org/2000/svg'
const SVG_TAGS = new Set([
  'animate',
  'animateMotion',
  'animateTransform',
  'circle',
  'clipPath',
  'defs',
  'desc',
  'ellipse',
  'feBlend',
  'feColorMatrix',
  'feComponentTransfer',
  'feComposite',
  'feConvolveMatrix',
  'feDiffuseLighting',
  'feDisplacementMap',
  'feDistantLight',
  'feDropShadow',
  'feFlood',
  'feFuncA',
  'feFuncB',
  'feFuncG',
  'feFuncR',
  'feGaussianBlur',
  'feImage',
  'feMerge',
  'feMergeNode',
  'feMorphology',
  'feOffset',
  'fePointLight',
  'feSpecularLighting',
  'feSpotLight',
  'feTile',
  'feTurbulence',
  'filter',
  'foreignObject',
  'g',
  'image',
  'line',
  'linearGradient',
  'marker',
  'mask',
  'metadata',
  'mpath',
  'path',
  'pattern',
  'polygon',
  'polyline',
  'radialGradient',
  'rect',
  'set',
  'stop',
  'svg',
  'switch',
  'symbol',
  'text',
  'textPath',
  'tspan',
  'use',
  'view',
])
const SVG_CONTEXTUAL_TAGS = new Set(['a', 'script', 'style', 'title'])

const getElementTagName = (parent: DomElementLike | null | undefined) => {
  const p = parent as any
  return typeof p?.tagName === 'string' ? p.tagName.toLowerCase() : ''
}

const applyStyleProperty = (style: CSSStyleDeclaration, key: string, value: any) => {
  if (key.startsWith('--')) {
    if (value == null || value === '') {
      style.removeProperty(key)
      return
    }
    style.setProperty(key, String(value))
    return
  }

  ;(style as any)[key] = value == null ? '' : value
}

const applyStyleObject = (
  elementStyle: CSSStyleDeclaration,
  style: Partial<CSSStyleDeclaration> | Record<string, any>,
) => {
  for (const [key, value] of Object.entries(style)) {
    applyStyleProperty(elementStyle, key, value)
  }
}

const isSVGNamespaceParent = (parent: DomElementLike | null | undefined) => {
  const p = parent as any
  // foreignObject 重新切回 HTML 解析上下文，子节点不能继续继承 SVG namespace。
  if (getElementTagName(parent) === 'foreignobject') {
    return false
  }
  return p?.namespaceURI === SVG_NS || p instanceof SVGElement
}

const getActiveRuntimeContainer = (): DomElementLike | null => {
  const globalRecord = globalThis as typeof globalThis & {
    __rue_active?: { getCurrentContainer?: () => DomElementLike | null | undefined }
    __rue?: { getCurrentContainer?: () => DomElementLike | null | undefined }
    __rue_vapor_preferred?: { getCurrentContainer?: () => DomElementLike | null | undefined }
    __rue_vapor?: { getCurrentContainer?: () => DomElementLike | null | undefined }
  }
  const runtime =
    globalRecord.__rue_active ??
    globalRecord.__rue ??
    globalRecord.__rue_vapor_preferred ??
    globalRecord.__rue_vapor

  if (!runtime || typeof runtime.getCurrentContainer !== 'function') {
    return null
  }

  const container = runtime.getCurrentContainer()
  return container ?? null
}

const resolveCreateElementParent = (parent?: DomElementLike | null) =>
  parent === undefined ? getActiveRuntimeContainer() : (parent ?? null)

const RUE_PENDING_SELECT_VALUE = Symbol('rue.pendingSelectValue')
const RUE_TEXT_CONTROL_COMPOSING_KEY = '__rue_is_composing__'
const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
])
let trackedTextControl: {
  tagName?: unknown
  type?: unknown
  ownerDocument?: Document | null
} | null = null
let textControlTrackingInstalled = false
let trackedTextControlRestoreRequestId = 0
let textControlRestoreSuppressedByPointer = false
let trackedTextControlIdentity: {
  dataTestId?: string
  id?: string
  name?: string
  placeholder?: string
  tagName: string
  type?: string
} | null = null

const isTextControlElement = (
  value: unknown,
): value is { tagName?: unknown; type?: unknown; ownerDocument?: Document | null } => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const tagName =
    typeof (value as { tagName?: unknown }).tagName === 'string'
      ? ((value as { tagName?: string }).tagName as string).toUpperCase()
      : ''

  if (tagName === 'TEXTAREA') {
    return true
  }

  if (tagName !== 'INPUT') {
    return false
  }

  const inputType =
    typeof (value as { type?: unknown }).type === 'string'
      ? ((value as { type?: string }).type as string).toLowerCase()
      : 'text'

  return !NON_TEXT_INPUT_TYPES.has(inputType)
}

const rememberTrackedTextControl = (event: Event) => {
  if (isTextControlElement(event.target)) {
    textControlRestoreSuppressedByPointer = false
    trackedTextControl = event.target
    const target = event.target as {
      getAttribute?: (name: string) => string | null
      id?: string
      name?: string
      placeholder?: string
      tagName?: string
      type?: string
    }
    trackedTextControlIdentity = {
      dataTestId: target.getAttribute?.('data-testid') ?? undefined,
      id: typeof target.id === 'string' && target.id ? target.id : undefined,
      name: typeof target.name === 'string' && target.name ? target.name : undefined,
      placeholder:
        typeof target.placeholder === 'string' && target.placeholder
          ? target.placeholder
          : undefined,
      tagName: typeof target.tagName === 'string' ? target.tagName.toUpperCase() : 'INPUT',
      type: typeof target.type === 'string' && target.type ? target.type.toLowerCase() : undefined,
    }
  }
}

const setTrackedTextControlComposing = (event: Event, composing: boolean) => {
  if (!isTextControlElement(event.target)) {
    return
  }

  textControlRestoreSuppressedByPointer = false
  trackedTextControl = event.target
  ;(event.target as unknown as Record<string, unknown>)[RUE_TEXT_CONTROL_COMPOSING_KEY] = composing
}

const updateTextControlRestoreSuppressionFromPointer = (event: Event) => {
  textControlRestoreSuppressedByPointer = !isTextControlElement(event.target)
}

const clearTrackedTextControl = (event: Event) => {
  if (!trackedTextControl || event.target !== trackedTextControl) {
    return
  }

  const ownerDocument = trackedTextControl.ownerDocument
  if (ownerDocument?.activeElement !== trackedTextControl) {
    trackedTextControl = null
  }
}

const escapeSelectorValue = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

const resolveTrackedTextControlWithin = (parent: DomNodeLike | null | undefined) => {
  if (!parent) {
    return null
  }

  const contains = (parent as { contains?: (node: unknown) => boolean }).contains
  if (
    isTextControlElement(trackedTextControl) &&
    typeof contains === 'function' &&
    contains.call(parent, trackedTextControl)
  ) {
    return trackedTextControl
  }

  const querySelector = (parent as { querySelector?: (selector: string) => Element | null })
    .querySelector
  if (typeof querySelector !== 'function' || !trackedTextControlIdentity) {
    return null
  }

  const { dataTestId, id, name, placeholder, tagName, type } = trackedTextControlIdentity
  const selectors = [
    dataTestId ? `[data-testid="${escapeSelectorValue(dataTestId)}"]` : null,
    id ? `#${escapeSelectorValue(id)}` : null,
    name ? `${tagName.toLowerCase()}[name="${escapeSelectorValue(name)}"]` : null,
    placeholder
      ? `${tagName.toLowerCase()}[placeholder="${escapeSelectorValue(placeholder)}"]`
      : null,
    type ? `${tagName.toLowerCase()}[type="${escapeSelectorValue(type)}"]` : tagName.toLowerCase(),
  ]

  for (const selector of selectors) {
    if (!selector) {
      continue
    }

    const matched = querySelector.call(parent, selector)
    if (isTextControlElement(matched)) {
      trackedTextControl = matched
      return matched
    }
  }

  return null
}

const isConnectedNodeLike = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const isConnected = (value as { isConnected?: unknown }).isConnected
  if (typeof isConnected === 'boolean') {
    return isConnected
  }

  const ownerDocument = (value as { ownerDocument?: Document | null }).ownerDocument
  const contains = ownerDocument?.contains
  if (typeof contains === 'function') {
    return contains.call(ownerDocument, value as Node)
  }

  return true
}

const ensureTextControlTracking = () => {
  if (textControlTrackingInstalled) {
    return
  }

  const ownerDocument = globalThis.document
  if (!ownerDocument) {
    return
  }

  textControlTrackingInstalled = true
  ownerDocument.addEventListener(
    'pointerdown',
    updateTextControlRestoreSuppressionFromPointer,
    true,
  )
  ownerDocument.addEventListener('mousedown', updateTextControlRestoreSuppressionFromPointer, true)
  ownerDocument.addEventListener('focusin', rememberTrackedTextControl, true)
  ownerDocument.addEventListener('input', rememberTrackedTextControl, true)
  ownerDocument.addEventListener(
    'compositionstart',
    event => setTrackedTextControlComposing(event, true),
    true,
  )
  ownerDocument.addEventListener('compositionupdate', rememberTrackedTextControl, true)
  ownerDocument.addEventListener(
    'compositionend',
    event => setTrackedTextControlComposing(event, false),
    true,
  )
  ownerDocument.addEventListener('focusout', clearTrackedTextControl, true)
}

const getSelectOwner = (node: any): HTMLSelectElement | null => {
  const parent = node?.parentElement ?? null
  if (!parent || typeof parent.tagName !== 'string') {
    return null
  }

  const parentTag = parent.tagName.toUpperCase()
  if (parentTag === 'SELECT') {
    return parent as HTMLSelectElement
  }
  if (parentTag === 'OPTGROUP') {
    const select = parent.parentElement
    if (select && typeof select.tagName === 'string' && select.tagName.toUpperCase() === 'SELECT') {
      return select as HTMLSelectElement
    }
  }

  return null
}

const syncPendingSelectValue = (select: any) => {
  if (!select || typeof select.tagName !== 'string' || select.tagName.toUpperCase() !== 'SELECT') {
    return
  }

  const pendingValue = select[RUE_PENDING_SELECT_VALUE]
  if (pendingValue === undefined) {
    return
  }

  if (select.multiple && Array.isArray(pendingValue)) {
    for (let i = 0; i < select.options.length; i++) {
      const option = select.options[i]
      option.selected = pendingValue.indexOf(option.value) !== -1
    }
    return
  }

  select.value = pendingValue
}

/** 判断目标子树内是否存在正在输入或刚失焦的文本控件。 */
export const hasActiveTextControlWithin = (parent: DomNodeLike | null | undefined) => {
  ensureTextControlTracking()

  if (!parent) {
    return false
  }

  if (textControlRestoreSuppressedByPointer) {
    return false
  }

  const contains = (parent as { contains?: (node: unknown) => boolean }).contains
  if (typeof contains !== 'function') {
    return false
  }

  const active = globalThis.document?.activeElement
  if (isTextControlElement(active) && contains.call(parent, active)) {
    return true
  }

  const tracked = resolveTrackedTextControlWithin(parent)
  if (!isTextControlElement(tracked)) {
    return false
  }

  const ownerDocument = tracked.ownerDocument
  const currentActive = ownerDocument?.activeElement
  if (currentActive && currentActive !== tracked && currentActive !== ownerDocument?.body) {
    return false
  }

  return contains.call(parent, tracked)
}

/** 尝试在目标子树内恢复最近跟踪的文本控件焦点。 */
export const restoreTrackedTextControlWithin = (parent: DomNodeLike | null | undefined) => {
  ensureTextControlTracking()

  if (textControlRestoreSuppressedByPointer) {
    return false
  }

  const tracked = resolveTrackedTextControlWithin(parent)
  if (!parent || !isTextControlElement(tracked)) {
    return false
  }

  if (!isConnectedNodeLike(parent) || !isConnectedNodeLike(tracked)) {
    trackedTextControl = null
    return false
  }

  const contains = (parent as { contains?: (node: unknown) => boolean }).contains
  if (typeof contains !== 'function' || !contains.call(parent, tracked)) {
    return false
  }

  const ownerDocument = tracked.ownerDocument
  const activeElement = ownerDocument?.activeElement
  if (activeElement && activeElement !== tracked && activeElement !== ownerDocument?.body) {
    return false
  }

  if (activeElement === tracked) {
    return true
  }

  const focus = (tracked as { focus?: () => void }).focus
  if (typeof focus === 'function') {
    focus.call(tracked)
  }

  return ownerDocument?.activeElement === tracked
}

/** 在若干微任务/帧后重试恢复文本控件焦点，用于兼容异步重挂载。 */
export const scheduleTrackedTextControlRestoreWithin = (
  parent: DomNodeLike | null | undefined,
  attempts = 6,
) => {
  if (!parent || attempts <= 0 || !isConnectedNodeLike(parent)) {
    return
  }

  const requestId = ++trackedTextControlRestoreRequestId
  const enqueueMicrotask =
    typeof queueMicrotask === 'function'
      ? queueMicrotask
      : (task: () => void) => Promise.resolve().then(task)

  const attemptRestore = (remainingAttempts: number) => {
    if (requestId !== trackedTextControlRestoreRequestId || remainingAttempts <= 0) {
      return
    }

    if (textControlRestoreSuppressedByPointer) {
      return
    }

    if (!isConnectedNodeLike(parent)) {
      trackedTextControl = null
      return
    }

    restoreTrackedTextControlWithin(parent)

    if (!isTextControlElement(trackedTextControl)) {
      return
    }

    const ownerDocument = trackedTextControl.ownerDocument
    const activeElement = ownerDocument?.activeElement
    if (
      activeElement &&
      activeElement !== trackedTextControl &&
      activeElement !== ownerDocument?.body
    ) {
      return
    }

    if (remainingAttempts > 1) {
      globalThis.setTimeout(() => attemptRestore(remainingAttempts - 1), 16)
    }
  }

  enqueueMicrotask(() => attemptRestore(attempts))
}

const syncSelectValueForMutationParent = (parent: any) => {
  if (parent && typeof parent.tagName === 'string') {
    const parentTag = parent.tagName.toUpperCase()
    if (parentTag === 'SELECT') {
      syncPendingSelectValue(parent)
      return true
    }
    if (parentTag === 'OPTGROUP') {
      const owner = getSelectOwner(parent)
      if (owner) {
        syncPendingSelectValue(owner)
      }
      return true
    }
  }

  return false
}

const syncSelectValueAfterMutation = (parent: any, child?: any) => {
  if (syncSelectValueForMutationParent(parent)) {
    return
  }

  const owner = getSelectOwner(child)
  if (owner) {
    syncPendingSelectValue(owner)
  }
}

const RUE_HYDRATED_ADOPTED_NODE = '__rue_hydrated_adopted'
const RUE_HYDRATED_ADOPTED_TARGET = '__rue_hydrated_adopted_target'
const hydratedAdoptedRemovalSuppressions = new WeakSet<object>()
const hydratedAdoptedParents = new WeakSet<object>()
const freshDomParents = new WeakSet<object>()
const pendingHydratedAdoptedRemovals = new WeakMap<object, Set<any>>()
const hydratedNodeEventListeners = new WeakMap<object, Map<string, Set<DOMEventHandler>>>()
const hydratedEventTransferTargets = new WeakMap<object, Set<any>>()

const canUseFreshDOMMutationPath = (parent: any, ...nodes: any[]) => {
  if (
    !parent ||
    typeof parent !== 'object' ||
    !freshDomParents.has(parent) ||
    hydratedAdoptedParents.has(parent) ||
    parent[RUE_HYDRATED_ADOPTED_NODE] ||
    parent[RUE_HYDRATED_ADOPTED_TARGET]
  ) {
    return false
  }

  for (const node of nodes) {
    if (
      node &&
      typeof node === 'object' &&
      (node[RUE_HYDRATED_ADOPTED_NODE] ||
        node[RUE_HYDRATED_ADOPTED_TARGET] ||
        hydratedAdoptedParents.has(node))
    ) {
      return false
    }
  }

  return true
}

const resolveHydratedAdoptedTarget = <T>(node: T): T => {
  let current: any = node
  let depth = 0
  while (current?.[RUE_HYDRATED_ADOPTED_TARGET] && depth < 20) {
    current = current[RUE_HYDRATED_ADOPTED_TARGET]
    depth += 1
  }
  return current as T
}

const recordHydratedEventListener = (el: any, eventName: string, listener: DOMEventHandler) => {
  if (!el || typeof listener !== 'function') {
    return
  }
  let events = hydratedNodeEventListeners.get(el)
  if (!events) {
    events = new Map()
    hydratedNodeEventListeners.set(el, events)
  }
  let listeners = events.get(eventName)
  if (!listeners) {
    listeners = new Set()
    events.set(eventName, listeners)
  }
  listeners.add(listener)
}

const forgetHydratedEventListener = (el: any, eventName: string, listener: DOMEventHandler) => {
  const events = el ? hydratedNodeEventListeners.get(el) : undefined
  const listeners = events?.get(eventName)
  if (!listeners) {
    return
  }
  listeners.delete(listener)
  if (listeners.size === 0) {
    events!.delete(eventName)
  }
  if (events!.size === 0) {
    hydratedNodeEventListeners.delete(el)
  }
}

const addNativeDOMEventListener = (el: any, eventName: string, listener: DOMEventHandler) => {
  const boundListener = bindEventHandlerToCurrentRuntime(listener)
  const options = boundListener?.__rue_options
  if (options !== undefined) {
    el.addEventListener(eventName, boundListener, options)
    return
  }
  el.addEventListener(eventName, boundListener)
}

const removeNativeDOMEventListener = (el: any, eventName: string, listener: DOMEventHandler) => {
  const boundListener = getBoundEventHandlerForRemoval(listener)
  const options = boundListener?.__rue_options
  if (options !== undefined) {
    el.removeEventListener(eventName, boundListener, options)
    return
  }
  el.removeEventListener(eventName, boundListener)
}

const transferHydratedEventListeners = (oldNode: any, newNode: any) => {
  if (!oldNode || !newNode || oldNode === newNode) {
    return
  }
  const events = hydratedNodeEventListeners.get(newNode)
  if (!events) {
    return
  }

  let targets = hydratedEventTransferTargets.get(newNode)
  if (!targets) {
    targets = new Set()
    hydratedEventTransferTargets.set(newNode, targets)
  }
  targets.add(oldNode)

  for (const [eventName, listeners] of events) {
    for (const listener of listeners) {
      addNativeDOMEventListener(oldNode, eventName, listener)
      recordHydratedEventListener(oldNode, eventName, listener)
    }
  }
}

const sameNodeShape = (oldNode: any, newNode: any) =>
  !!oldNode &&
  !!newNode &&
  oldNode.nodeType === newNode.nodeType &&
  (oldNode.nodeType !== 1 || oldNode.tagName === newNode.tagName)

const syncElementAttributes = (oldNode: any, newNode: any) => {
  if (oldNode.nodeType !== 1 || typeof oldNode.getAttributeNames !== 'function') {
    return
  }
  for (const name of oldNode.getAttributeNames()) {
    if (!newNode.hasAttribute(name)) {
      oldNode.removeAttribute(name)
    }
  }
  for (const name of newNode.getAttributeNames()) {
    oldNode.setAttribute(name, newNode.getAttribute(name))
  }
}

const syncElementDomProperties = (oldNode: any, newNode: any) => {
  if (oldNode.nodeType !== 1 || newNode.nodeType !== 1) {
    return
  }
  if ('value' in oldNode && 'value' in newNode) {
    const nextValue = newNode.value ?? ''
    if (String(oldNode.value ?? '') !== String(nextValue)) {
      oldNode.value = nextValue
    }
  }
  if ('checked' in oldNode && 'checked' in newNode) {
    oldNode.checked = !!newNode.checked
  }
  if ('disabled' in oldNode && 'disabled' in newNode) {
    oldNode.disabled = !!newNode.disabled
  }
}

const markHydratedAdoptedNode = (node: any) => {
  if (node) {
    node[RUE_HYDRATED_ADOPTED_NODE] = true
    if (node.parentNode && typeof node.parentNode === 'object') {
      hydratedAdoptedParents.add(node.parentNode)
    }
  }
}

const isMorphableHydratedChild = (oldNode: any, newNode: any) => {
  if (!sameNodeShape(oldNode, newNode)) {
    return false
  }
  if (oldNode?.[RUE_HYDRATED_ADOPTED_NODE]) {
    return true
  }
  return oldNode.nodeType === 1 || oldNode.nodeType === 3
}

const findMatchingHydratedChild = (parent: any, newChild: any, before: any) => {
  let current = before
  while (current) {
    if (isMorphableHydratedChild(current, newChild)) {
      return current
    }
    current = current.nextSibling
  }
  return null
}

const isRueRuntimeAnchorComment = (node: any) =>
  node?.nodeType === 8 && String(node.nodeValue ?? '').startsWith('rue:')

const previousNonAnchorSibling = (node: any) => {
  let current = node?.previousSibling ?? null
  while (isRueRuntimeAnchorComment(current)) {
    current = current.previousSibling
  }
  return current
}

const morphHydratedNode = (oldNode: any, newNode: any) => {
  if (oldNode === newNode) {
    return true
  }
  if (!isMorphableHydratedChild(oldNode, newNode)) {
    return false
  }

  markHydratedAdoptedNode(oldNode)
  newNode[RUE_HYDRATED_ADOPTED_TARGET] = oldNode
  if (oldNode.nodeType === 1) {
    syncElementAttributes(oldNode, newNode)
    syncElementDomProperties(oldNode, newNode)
    transferHydratedEventListeners(oldNode, newNode)
    morphHydratedElementChildren(oldNode, newNode)
  } else {
    oldNode.textContent = newNode.textContent ?? ''
  }
  hydratedAdoptedRemovalSuppressions.add(oldNode)
  return true
}

const pairHydratedAnchorsWithExistingChildren = (oldNode: any, anchors: any[]) => {
  let cursor = oldNode.firstChild
  for (const anchor of anchors) {
    while (isRueRuntimeAnchorComment(cursor)) {
      cursor = cursor.nextSibling
    }
    if (!cursor) {
      oldNode.appendChild(anchor)
      continue
    }

    const paired = cursor
    const next = paired.nextSibling
    markHydratedAdoptedNode(paired)
    oldNode.insertBefore(anchor, next)
    cursor = next
  }

  while (cursor) {
    const next = cursor.nextSibling
    if (!isRueRuntimeAnchorComment(cursor)) {
      oldNode.removeChild(cursor)
    }
    cursor = next
  }
}

const morphHydratedElementChildren = (oldNode: any, newNode: any) => {
  const newChildren = Array.from(newNode.childNodes ?? []) as any[]
  if (newChildren.length > 0 && newChildren.every(isRueRuntimeAnchorComment)) {
    pairHydratedAnchorsWithExistingChildren(oldNode, newChildren)
    return
  }
  let cursor = oldNode.firstChild
  for (const newChild of newChildren) {
    if (cursor === newChild) {
      const adopted = findMatchingHydratedChild(oldNode, newChild, cursor.nextSibling)
      if (adopted && morphHydratedNode(adopted, newChild)) {
        oldNode.insertBefore(adopted, cursor)
        oldNode.removeChild(newChild)
        cursor = adopted.nextSibling
        continue
      }
      cursor = cursor.nextSibling
      continue
    }

    if (morphHydratedNode(cursor, newChild)) {
      cursor = cursor.nextSibling
      continue
    }

    const adopted = findMatchingHydratedChild(oldNode, newChild, cursor)
    if (adopted && morphHydratedNode(adopted, newChild)) {
      oldNode.insertBefore(adopted, cursor)
      cursor = adopted.nextSibling
      continue
    }

    oldNode.insertBefore(newChild, cursor)
    cursor = newChild.nextSibling
  }

  while (cursor) {
    const next = cursor.nextSibling
    oldNode.removeChild(cursor)
    cursor = next
  }
}

const tryMorphHydratedAdoptedNode = (oldNode: any, newNode: any) => {
  if (oldNode === newNode) {
    return false
  }
  if (!oldNode?.[RUE_HYDRATED_ADOPTED_NODE]) {
    return false
  }
  return morphHydratedNode(oldNode, newNode)
}

const findHydratedReplacementSibling = (parent: any, oldNode: any) => {
  if (!parent || !oldNode?.[RUE_HYDRATED_ADOPTED_NODE]) {
    return null
  }
  for (const node of Array.from(parent.childNodes ?? []) as any[]) {
    if (
      node !== oldNode &&
      !node?.[RUE_HYDRATED_ADOPTED_NODE] &&
      node.nodeType === oldNode.nodeType &&
      (node.nodeType !== 1 || node.tagName === oldNode.tagName)
    ) {
      return node
    }
  }
  return null
}

const findHydratedAdoptedDescendant = (node: any): any => {
  if (!node) return null
  if (node[RUE_HYDRATED_ADOPTED_NODE]) return node
  for (const child of Array.from(node.childNodes ?? []) as any[]) {
    const found = findHydratedAdoptedDescendant(child)
    if (found) return found
  }
  return null
}

const findHydratedAdoptedSiblingFor = (parent: any, newNode: any) => {
  if (!parent || !newNode) return null
  if (freshDomParents.has(parent) && !hydratedAdoptedParents.has(parent)) {
    return null
  }
  for (const node of Array.from(parent.childNodes ?? []) as any[]) {
    if (
      node !== newNode &&
      node?.[RUE_HYDRATED_ADOPTED_NODE] &&
      node.nodeType === newNode.nodeType &&
      (node.nodeType !== 1 || node.tagName === newNode.tagName)
    ) {
      return node
    }
  }
  return null
}

const takePendingHydratedRemoval = (parent: any, newNode: any) => {
  const pending = parent ? pendingHydratedAdoptedRemovals.get(parent) : undefined
  if (!pending) {
    return null
  }
  for (const oldNode of Array.from(pending)) {
    if (sameNodeShape(oldNode, newNode)) {
      pending.delete(oldNode)
      if (pending.size === 0) {
        pendingHydratedAdoptedRemovals.delete(parent)
      }
      return oldNode
    }
  }
  return null
}

const queueHydratedAdoptedRemoval = (parent: any, child: any) => {
  let pending = pendingHydratedAdoptedRemovals.get(parent)
  if (!pending) {
    pending = new Set()
    pendingHydratedAdoptedRemovals.set(parent, pending)
  }
  if (pending.has(child)) {
    return true
  }
  pending.add(child)
  return true
}

/** 基于浏览器 document 的默认 DOMAdapter 实现。 */
export class BrowserDOMAdapter implements DOMAdapter {
  /** 注释节点：委托原生 document.createComment */
  createComment(data: string) {
    return document.createComment(data) as any
  }
  /** 文本节点：委托原生 document.createTextNode */
  createTextNode(data: string) {
    return document.createTextNode(data) as any
  }
  /** 元素节点：非冲突 SVG 标签直接走 createElementNS，共享标签依赖父上下文决定 namespace */
  createElement(tag: string, parent?: DomElementLike | null) {
    const element =
      SVG_TAGS.has(tag) || (SVG_CONTEXTUAL_TAGS.has(tag) && isSVGNamespaceParent(parent))
        ? document.createElementNS(SVG_NS, tag)
        : document.createElement(tag)
    freshDomParents.add(element)
    return element as any
  }
  /**
   * 文本包装器。
   *
   * 这里要区分三种情况：
   * 1. HTML 父节点：继续返回 <span>，和原来一样。
   * 2. 普通 SVG 容器（如 <g>、<svg>）：返回 <text>，因为它本身就是一段 SVG 文本的承载节点。
   * 3. 已经处在 SVG 文本容器内部（<text> / <tspan>）：必须返回 <tspan>，不能再返回 <text>。
   *
   * 这条分支是本次修复的关键。
   * 之前统一在 SVG 下返回 <text>，会把：
   *
   * <text>{expr}ms</text>
   *
   * 渲染成：
   *
   * <text><text>0</text>ms</text>
   *
   * 这在 SVG 里语义是错的，浏览器兼容表现也会很怪，看起来像“表达式空了”或文字布局异常。
   * 正确做法是在 text 内部用 tspan 包住动态片段，得到：
   *
   * <text><tspan>0</tspan>ms</text>
   */
  createTextWrapper(parent: DomElementLike) {
    // 这里读取父节点 tagName，而不是只判断“是不是 SVGElement”，
    // 因为 <g> 和 <text> 都是 SVGElement，但它们需要的文本子节点类型并不一样；
    // 同时 foreignObject 虽然位于 SVG 中，但它的子节点应该重新回到 HTML namespace。
    const tagName = getElementTagName(parent)
    return (
      isSVGNamespaceParent(parent)
        ? this.createElement(tagName === 'text' || tagName === 'tspan' ? 'tspan' : 'text', parent)
        : this.createElement('span')
    ) as any
  }
  /** 设置行内样式：支持字符串/对象，null/undefined 清空 */
  setStyle(el: DomElementLike, style: string | Partial<CSSStyleDeclaration> | null | undefined) {
    el = resolveHydratedAdoptedTarget(el)
    if (typeof style === 'string') {
      ;(el as any).setAttribute('style', style)
    } else if (style && typeof style === 'object') {
      applyStyleObject((el as any).style, style)
    } else {
      ;(el as any).removeAttribute('style')
    }
  }
  /** 文本内容：空值/布尔值写空，其余转字符串 */
  settextContent(el: DomNodeLike, val: any) {
    el = resolveHydratedAdoptedTarget(el)
    ;(el as any).textContent = val == null || typeof val === 'boolean' ? '' : String(val)
  }
  /** 创建文档片段：用于批量插入提升性能 */
  createDocumentFragment() {
    const fragment = document.createDocumentFragment()
    freshDomParents.add(fragment)
    return fragment as any
  }
  /** 追加子节点：parent.appendChild(child) */
  appendChild(parent: DomNodeLike, child: DomNodeLike) {
    if (canUseFreshDOMMutationPath(parent, child)) {
      ;(parent as any).appendChild(child)
      syncSelectValueForMutationParent(parent)
      return child as any
    }

    parent = resolveHydratedAdoptedTarget(parent)
    child = resolveHydratedAdoptedTarget(child)
    if (!parent) {
      return child as any
    }

    const adopted = findHydratedAdoptedSiblingFor(parent as any, child as any)
    if (adopted && tryMorphHydratedAdoptedNode(adopted, child as any)) {
      syncSelectValueAfterMutation(parent as any, adopted)
      return adopted as any
    }
    const pending = takePendingHydratedRemoval(parent as any, child as any)
    if (pending && tryMorphHydratedAdoptedNode(pending, child as any)) {
      syncSelectValueAfterMutation(parent as any, pending)
      return pending as any
    }
    const carriesHydratedAdoptedChild =
      !!(child as any)?.[RUE_HYDRATED_ADOPTED_NODE] || hydratedAdoptedParents.has(child as object)
    ;(parent as any).appendChild(child)
    if (carriesHydratedAdoptedChild && typeof parent === 'object') {
      hydratedAdoptedParents.add(parent as object)
    }
    syncSelectValueAfterMutation(parent as any, child as any)
    return child as any
  }
  /** 移除子节点：parent.removeChild(child) */
  removeChild(parent: DomNodeLike, child: DomNodeLike) {
    if (canUseFreshDOMMutationPath(parent, child)) {
      ;(parent as any).removeChild(child)
      return
    }

    parent = resolveHydratedAdoptedTarget(parent)
    child = resolveHydratedAdoptedTarget(child)
    if (child && hydratedAdoptedRemovalSuppressions.delete(child as object)) {
      return
    }
    const replacement = findHydratedReplacementSibling(parent as any, child as any)
    if (replacement && tryMorphHydratedAdoptedNode(child as any, replacement)) {
      ;(parent as any).removeChild(replacement)
      hydratedAdoptedRemovalSuppressions.delete(child as object)
      syncSelectValueAfterMutation(parent as any, child as any)
      return
    }
    if ((child as any)?.[RUE_HYDRATED_ADOPTED_NODE] && queueHydratedAdoptedRemoval(parent, child)) {
      return
    }
    ;(parent as any).removeChild(child)
  }
  /** 插入子节点：parent.insertBefore(child, ref) */
  insertBefore(parent: DomNodeLike, child: DomNodeLike, ref: DomNodeLike | null) {
    if (canUseFreshDOMMutationPath(parent, child, ref)) {
      ;(parent as any).insertBefore(child, ref)
      syncSelectValueForMutationParent(parent)
      return
    }

    parent = resolveHydratedAdoptedTarget(parent)
    child = resolveHydratedAdoptedTarget(child)
    ref = ref ? resolveHydratedAdoptedTarget(ref) : ref
    const paired = ref ? previousNonAnchorSibling(ref as any) : null
    if (paired?.[RUE_HYDRATED_ADOPTED_NODE]) {
      if (tryMorphHydratedAdoptedNode(paired, child as any)) {
        syncSelectValueAfterMutation(parent as any, paired)
        return
      }
      ;(parent as any).removeChild(paired)
    }
    const adopted = findHydratedAdoptedSiblingFor(parent as any, child as any)
    if (adopted && adopted !== ref && tryMorphHydratedAdoptedNode(adopted, child as any)) {
      syncSelectValueAfterMutation(parent as any, adopted)
      return
    }
    const pending = takePendingHydratedRemoval(parent as any, child as any)
    if (pending && tryMorphHydratedAdoptedNode(pending, child as any)) {
      syncSelectValueAfterMutation(parent as any, pending)
      return
    }
    if (ref && tryMorphHydratedAdoptedNode(ref, child)) {
      syncSelectValueAfterMutation(parent as any, ref as any)
      return
    }
    const carriesHydratedAdoptedChild =
      !!(child as any)?.[RUE_HYDRATED_ADOPTED_NODE] || hydratedAdoptedParents.has(child as object)
    ;(parent as any).insertBefore(child, ref)
    if (carriesHydratedAdoptedChild && typeof parent === 'object') {
      hydratedAdoptedParents.add(parent as object)
    }
    syncSelectValueAfterMutation(parent as any, child as any)
  }
  /** 替换子节点：parent.replaceChild(newChild, oldChild) */
  replaceChild(parent: DomNodeLike, newChild: DomNodeLike, oldChild: DomNodeLike) {
    if (canUseFreshDOMMutationPath(parent, newChild, oldChild)) {
      ;(parent as any).replaceChild(newChild, oldChild)
      syncSelectValueForMutationParent(parent)
      return
    }

    parent = resolveHydratedAdoptedTarget(parent)
    newChild = resolveHydratedAdoptedTarget(newChild)
    oldChild = resolveHydratedAdoptedTarget(oldChild)
    if (tryMorphHydratedAdoptedNode(oldChild, newChild)) {
      syncSelectValueAfterMutation(parent as any, oldChild as any)
      return
    }
    ;(parent as any).replaceChild(newChild, oldChild)
    syncSelectValueAfterMutation(parent as any, newChild as any)
  }
  /** 选择器查询：document.querySelector(selector) */
  querySelector(selector: string) {
    return document.querySelector(selector) as any
  }
  /** 设置属性：值统一转字符串 */
  setAttribute(el: DomElementLike, name: string, value: any) {
    el = resolveHydratedAdoptedTarget(el)
    ;(el as any).setAttribute(name, String(value))
  }
  /** 移除属性 */
  removeAttribute(el: DomElementLike, name: string) {
    el = resolveHydratedAdoptedTarget(el)
    ;(el as any).removeAttribute(name)
  }
  /** 添加事件监听：支持由 listener.__rue_options 携带的原生监听选项 */
  addEventListener(el: DomElementLike, eventName: string, listener: DOMEventHandler) {
    el = resolveHydratedAdoptedTarget(el)
    if (typeof listener !== 'function') {
      return
    }

    addNativeDOMEventListener(el as any, eventName, listener)
    recordHydratedEventListener(el as any, eventName, listener)
    const targets = hydratedEventTransferTargets.get(el as object)
    if (targets) {
      for (const target of targets) {
        addNativeDOMEventListener(target, eventName, listener)
        recordHydratedEventListener(target, eventName, listener)
      }
    }
  }
  /** 移除事件监听：移除时复用 listener.__rue_options 里的 capture 信息 */
  removeEventListener(el: DomElementLike, eventName: string, listener: DOMEventHandler) {
    el = resolveHydratedAdoptedTarget(el)
    if (typeof listener !== 'function') {
      return
    }

    removeNativeDOMEventListener(el as any, eventName, listener)
    forgetHydratedEventListener(el as any, eventName, listener)
    const targets = hydratedEventTransferTargets.get(el as object)
    if (targets) {
      for (const target of targets) {
        removeNativeDOMEventListener(target, eventName, listener)
        forgetHydratedEventListener(target, eventName, listener)
      }
    }
  }
  /** 设置类名：SVG 用属性 'class'，HTML 用 className；null/undefined 会清空 */
  setClassName(el: DomElementLike, value: any) {
    el = resolveHydratedAdoptedTarget(el)
    const className = value == null ? '' : String(value)
    if ((el as any) instanceof SVGElement) {
      ;(el as any).setAttribute('class', className)
    } else {
      ;(el as any as HTMLElement).className = className
    }
  }
  /** 设置 innerHTML：仅 HTMLElement 生效 */
  setInnerHTML(el: DomElementLike, html: string) {
    el = resolveHydratedAdoptedTarget(el)
    if (html === '' && findHydratedAdoptedDescendant(el as any)) {
      return
    }
    ;(el as any as HTMLElement).innerHTML = html
  }
  /** 样式增量补丁：移除旧键，批量赋新样式 */
  patchStyle(
    el: DomElementLike,
    oldStyle: Partial<CSSStyleDeclaration> | undefined,
    newStyle: Partial<CSSStyleDeclaration> | undefined,
  ) {
    el = resolveHydratedAdoptedTarget(el)
    const prev = oldStyle || {}
    const next = newStyle || {}
    for (const k of Object.keys(prev)) {
      if (!(k in next)) applyStyleProperty((el as any).style, k, '')
    }
    applyStyleObject((el as any).style, next)
  }
  /** 设置表单值：兼容 select[multiple]、select 与可写 value 元素 */
  setValue(el: DomElementLike, value: any) {
    el = resolveHydratedAdoptedTarget(el)
    const anyEl = el as any
    const tag = (anyEl.tagName || '').toUpperCase()
    if (tag === 'SELECT') {
      anyEl[RUE_PENDING_SELECT_VALUE] = value
      if (anyEl.multiple && Array.isArray(value)) {
        for (let i = 0; i < anyEl.options.length; i++) {
          const opt = anyEl.options[i]
          opt.selected = (value as string[]).indexOf(opt.value) !== -1
        }
      } else {
        anyEl.value = value
      }
      return
    }
    if (tag === 'OPTION') {
      anyEl.value = value
      const owner = getSelectOwner(anyEl)
      if (owner) {
        syncPendingSelectValue(owner)
      }
      return
    }
    if (tag === 'PROGRESS') {
      anyEl.setAttribute('value', String(value))
      return
    }
    if (anyEl.value !== undefined) {
      const nextValue = value == null ? '' : value
      if (String(anyEl.value ?? '') !== String(nextValue)) {
        anyEl.value = nextValue
      }
    } else {
      anyEl.setAttribute('value', String(value))
    }
  }
  /** 设置选中状态：优先属性，其次属性开关 */
  setChecked(el: DomElementLike, checked: boolean) {
    el = resolveHydratedAdoptedTarget(el)
    const anyEl = el as any
    if (anyEl.checked !== undefined) {
      anyEl.checked = checked
    } else {
      if (checked) anyEl.setAttribute('checked', '')
      else anyEl.removeAttribute('checked')
    }
  }
  /** 设置禁用状态：优先属性，其次属性开关 */
  setDisabled(el: DomElementLike, disabled: boolean) {
    el = resolveHydratedAdoptedTarget(el)
    const anyEl = el as any
    if (anyEl.disabled !== undefined) {
      anyEl.disabled = disabled
    } else {
      if (disabled) anyEl.setAttribute('disabled', '')
      else anyEl.removeAttribute('disabled')
    }
  }
  /** 获取标签名：返回原生 tagName */
  getTagName(el: DomElementLike) {
    el = resolveHydratedAdoptedTarget(el)
    return (el as any as HTMLElement).tagName
  }
  /** 包含关系判断：优先原生 contains，缺省 false */
  contains(parent: DomNodeLike, child: DomNodeLike) {
    parent = resolveHydratedAdoptedTarget(parent)
    child = resolveHydratedAdoptedTarget(child)
    if (!parent) {
      return false
    }

    return (parent as any).contains?.(child as any) ?? false
  }
  /** 父节点获取：不存在返回 null */
  getParentNode(node: DomNodeLike) {
    node = resolveHydratedAdoptedTarget(node)
    return (node as any).parentNode || null
  }
  /** 是否为文档片段：nodeType === 11 */
  isFragment(node: DomNodeLike) {
    node = resolveHydratedAdoptedTarget(node)
    if (!node) return false
    return (node as any).nodeType === 11
  }
  /** 片段子节点收集：Fragment 返回所有子节点，否则返回自身 */
  collectFragmentChildren(node: DomNodeLike) {
    node = resolveHydratedAdoptedTarget(node)
    if (this.isFragment(node)) {
      return Array.from((node as any as DocumentFragment).childNodes) as any
    }
    return [node]
  }
  /** 应用 ref：函数立即调用，对象写入 current */
  applyRef(el: DomElementLike, ref: any) {
    el = resolveHydratedAdoptedTarget(el)
    if (typeof ref === 'function') {
      ;(ref as Function)(el)
    } else if (ref && typeof ref === 'object' && 'current' in ref) {
      ;(ref as any).current = el
    }
  }
  /** 清理 ref：函数传入 null，对象置为 undefined */
  clearRef(ref: any) {
    if (typeof ref === 'function') {
      ;(ref as Function)(null)
    } else if (ref && typeof ref === 'object' && 'current' in ref) {
      ;(ref as any).current = undefined
    }
  }
}

const RUE_DOM_ADAPTER_GLOBAL_KEY = '__rue_dom_adapter__'
const RUE_DEFAULT_BROWSER_DOM_ADAPTER_GLOBAL_KEY = '__rue_default_browser_dom_adapter__'
const RUE_DOM_BRIDGE_CONSUMERS_GLOBAL_KEY = '__rue_dom_bridge_consumers__'

type DOMBridgeConsumer = object & {
  setDOMAdapter?: (bridge: GlobalDOMBridge) => void
}

type RueDOMGlobalRecord = typeof globalThis & {
  [RUE_DOM_ADAPTER_GLOBAL_KEY]?: DOMAdapter
  [RUE_DEFAULT_BROWSER_DOM_ADAPTER_GLOBAL_KEY]?: DOMAdapter
  [RUE_DOM_BRIDGE_CONSUMERS_GLOBAL_KEY]?: Set<WeakRef<DOMBridgeConsumer>>
}

const domGlobal = globalThis as RueDOMGlobalRecord
const DEFAULT_BROWSER_DOM_ADAPTER =
  domGlobal[RUE_DEFAULT_BROWSER_DOM_ADAPTER_GLOBAL_KEY] ?? new BrowserDOMAdapter()
domGlobal[RUE_DEFAULT_BROWSER_DOM_ADAPTER_GLOBAL_KEY] = DEFAULT_BROWSER_DOM_ADAPTER

// 当前适配器：默认使用浏览器实现，可在运行时替换。
// 使用 globalThis 保存真实 adapter，保证 runtime/server、runtime/vapor 等
// 被打成独立 bundle 的入口在 SSR 期间仍然共享同一宿主。
let CURRENT_ADAPTER: DOMAdapter =
  domGlobal[RUE_DOM_ADAPTER_GLOBAL_KEY] ?? DEFAULT_BROWSER_DOM_ADAPTER
domGlobal[RUE_DOM_ADAPTER_GLOBAL_KEY] = CURRENT_ADAPTER

const getCurrentDOMAdapter = () => domGlobal[RUE_DOM_ADAPTER_GLOBAL_KEY] ?? CURRENT_ADAPTER
type DOMHostOperationContext = {
  adapter: DOMAdapter
  freshBrowser: boolean
}
let activeDOMHostOperationContext: DOMHostOperationContext | undefined
let domAdapterGeneration = 0

const getDOMAdapterForOperation = () =>
  activeDOMHostOperationContext?.adapter ?? getCurrentDOMAdapter()

const isHydrationHostBoundary = (parent: DomNodeLike | null | undefined) => {
  if (!parent) return false
  if (typeof Node === 'undefined' || !(parent instanceof Node)) return true

  let node: any = parent
  let depth = 0
  while (node && depth < 64) {
    if (node[RUE_HYDRATED_ADOPTED_NODE] || node[RUE_HYDRATED_ADOPTED_TARGET]) return true
    node = node.parentNode
    depth += 1
  }

  if (freshDomParents.has(parent as object) && !hydratedAdoptedParents.has(parent as object)) {
    return false
  }
  return (parent as any).firstChild != null
}

/** 在一次同步 mount/reconcile 内绑定稳定宿主操作；嵌套边界复用同一解析结果。 */
export const withDOMHostOperations = <T>(
  parent: DomNodeLike | null | undefined,
  run: () => T,
): T => {
  if (activeDOMHostOperationContext) return run()

  const adapter = getCurrentDOMAdapter()
  const generation = domAdapterGeneration
  const previous = activeDOMHostOperationContext
  activeDOMHostOperationContext = {
    adapter,
    freshBrowser: adapter === DEFAULT_BROWSER_DOM_ADAPTER && !isHydrationHostBoundary(parent),
  }

  try {
    return run()
  } finally {
    if (generation === domAdapterGeneration) {
      activeDOMHostOperationContext = previous
    }
  }
}

const setCurrentDOMAdapter = (adapter: DOMAdapter) => {
  domAdapterGeneration += 1
  activeDOMHostOperationContext = undefined
  CURRENT_ADAPTER = adapter
  domGlobal[RUE_DOM_ADAPTER_GLOBAL_KEY] = adapter
}

type GlobalDOMBridge = {
  createElement: (tag: string, parent?: DomElementLike | null) => DomElementLike
  createTextNode: (data: string) => DomTextLike
  createDocumentFragment: () => DomFragmentLike
  isFragment: (node: DomNodeLike) => boolean
  collectFragmentChildren: (node: DomNodeLike) => DomNodeLike[]
  setTextContent: (el: DomNodeLike, val: any) => void
  appendChild: (parent: DomNodeLike, child: DomNodeLike) => void
  insertBefore: (parent: DomNodeLike, child: DomNodeLike, ref: DomNodeLike | null) => void
  removeChild: (parent: DomNodeLike, child: DomNodeLike) => void
  contains: (parent: DomNodeLike, child: DomNodeLike) => boolean
  setClassName: (el: DomElementLike, value: any) => void
  patchStyle: (
    el: DomElementLike,
    oldStyle: Record<string, string>,
    newStyle: Record<string, string>,
  ) => void
  setInnerHTML: (el: DomElementLike, html: string) => void
  setValue: (el: DomElementLike, value: any) => void
  setChecked: (el: DomElementLike, checked: boolean) => void
  setDisabled: (el: DomElementLike, disabled: boolean) => void
  clearRef: (ref: any) => void
  applyRef: (el: DomElementLike, ref: any) => void
  setAttribute: (el: DomElementLike, name: string, value: any) => void
  removeAttribute: (el: DomElementLike, name: string) => void
  getTagName: (el: DomElementLike) => string
  addEventListener: (el: DomElementLike, eventName: string, listener: DOMEventHandler) => void
  removeEventListener: (el: DomElementLike, eventName: string, listener: DOMEventHandler) => void
  hasValueProperty: (el: DomElementLike) => boolean
  isSelectMultiple: (el: DomElementLike) => boolean
  querySelector: (selector: string) => DomElementLike | null
}

const getDOMBridgeConsumers = () => (domGlobal[RUE_DOM_BRIDGE_CONSUMERS_GLOBAL_KEY] ??= new Set())

// Wasm caches bridge function references. Keep those functions adapter-specific for the hot path,
// then rebind each live runtime only when the host adapter actually changes.
export const registerDOMBridgeConsumer = (consumer: DOMBridgeConsumer) => {
  const consumers = getDOMBridgeConsumers()
  for (const consumerRef of consumers) {
    const registeredConsumer = consumerRef.deref()
    if (!registeredConsumer) {
      consumers.delete(consumerRef)
    } else if (registeredConsumer === consumer) {
      return
    }
  }
  consumers.add(new WeakRef(consumer))
}

const syncDOMBridgeConsumers = (bridge: GlobalDOMBridge) => {
  const consumers = getDOMBridgeConsumers()
  for (const consumerRef of consumers) {
    const consumer = consumerRef.deref()
    if (!consumer) {
      consumers.delete(consumerRef)
      continue
    }
    consumer.setDOMAdapter?.(bridge)
  }
}

const createGlobalDOMBridge = (): GlobalDOMBridge => {
  const adapter = getCurrentDOMAdapter()
  return {
    createElement: (tag: string, parent?: DomElementLike | null) =>
      adapter.createElement(tag, parent),
    createTextNode: (data: string) => adapter.createTextNode(data),
    createDocumentFragment: () => adapter.createDocumentFragment(),
    isFragment: (node: DomNodeLike) => adapter.isFragment(node),
    collectFragmentChildren: (node: DomNodeLike) => adapter.collectFragmentChildren(node),
    setTextContent: (el: DomNodeLike, val: any) => adapter.settextContent(el, val),
    appendChild: (parent: DomNodeLike, child: DomNodeLike) => adapter.appendChild(parent, child),
    insertBefore: (parent: DomNodeLike, child: DomNodeLike, ref: DomNodeLike | null) =>
      adapter.insertBefore(parent, child, ref),
    removeChild: (parent: DomNodeLike, child: DomNodeLike) => adapter.removeChild(parent, child),
    contains: (parent: DomNodeLike, child: DomNodeLike) => adapter.contains(parent, child),
    setClassName: (el: DomElementLike, value: string) => adapter.setClassName(el, value),
    patchStyle: (
      el: DomElementLike,
      oldStyle: Record<string, string>,
      newStyle: Record<string, string>,
    ) => adapter.patchStyle(el, oldStyle as any, newStyle as any),
    setInnerHTML: (el: DomElementLike, html: string) => adapter.setInnerHTML(el, html),
    setValue: (el: DomElementLike, value: any) => adapter.setValue(el, value),
    setChecked: (el: DomElementLike, checked: boolean) => adapter.setChecked(el, checked),
    setDisabled: (el: DomElementLike, disabled: boolean) => adapter.setDisabled(el, disabled),
    clearRef: (ref: any) => adapter.clearRef(ref),
    applyRef: (el: DomElementLike, ref: any) => adapter.applyRef(el, ref),
    setAttribute: (el: DomElementLike, name: string, value: any) =>
      adapter.setAttribute(el, name, value),
    removeAttribute: (el: DomElementLike, name: string) => adapter.removeAttribute(el, name),
    getTagName: (el: DomElementLike) => adapter.getTagName(el),
    addEventListener: (el: DomElementLike, eventName: string, listener: DOMEventHandler) =>
      adapter.addEventListener(el, eventName, listener),
    removeEventListener: (el: DomElementLike, eventName: string, listener: DOMEventHandler) =>
      adapter.removeEventListener(el, eventName, listener),
    hasValueProperty: (el: DomElementLike) => (el as any).value !== undefined,
    isSelectMultiple: (el: DomElementLike) =>
      (adapter.getTagName(el) || '').toUpperCase() === 'SELECT' && !!(el as any).multiple,
    querySelector: (selector: string) => adapter.querySelector(selector),
  }
}

const syncGlobalDOMBridge = () => {
  const bridge = createGlobalDOMBridge()
  ;(globalThis as any).__rue_dom = bridge
  return bridge
}

/** 设置当前 DOM 适配器
 * 替换底层实现并刷新全局 __rue_dom 代理映射
 * @param adapter 新的 DOMAdapter 实例
 */
export const setDOMAdapter = (adapter: DOMAdapter) => {
  setCurrentDOMAdapter(adapter)
  // 在全局注入轻量代理，便于调试与非模块环境访问
  syncDOMBridgeConsumers(syncGlobalDOMBridge())
}
/** 获取当前 DOM 适配器
 * @returns 当前的 DOMAdapter 实例
 */
export const getDOMAdapter = () => getCurrentDOMAdapter()

// 启动时即注入一次全局代理，保证在未调用 setDOMAdapter 前也可使用
syncGlobalDOMBridge()

// 便捷导出：函数式封装 CURRENT_ADAPTER，简化调用与测试替换
/** 创建注释节点（便捷函数）
 * @param data 注释文本
 */
export const createComment = (data: string) => getDOMAdapterForOperation().createComment(data)
/** 创建文本节点（便捷函数）
 * @param data 文本内容
 */
export const createTextNode = (data: string) =>
  activeDOMHostOperationContext?.freshBrowser
    ? (document.createTextNode(data) as any)
    : getDOMAdapterForOperation().createTextNode(data)
/** 创建元素（便捷函数）
 * @param tag 标签名
 */
export const createElement = (tag: string, parent?: DomElementLike | null) => {
  const resolvedParent = resolveCreateElementParent(parent)
  if (!activeDOMHostOperationContext?.freshBrowser) {
    return getDOMAdapterForOperation().createElement(tag, resolvedParent)
  }
  const element =
    SVG_TAGS.has(tag) || (SVG_CONTEXTUAL_TAGS.has(tag) && isSVGNamespaceParent(resolvedParent))
      ? document.createElementNS(SVG_NS, tag)
      : document.createElement(tag)
  freshDomParents.add(element)
  return element as any
}
/** 创建文本包装元素（便捷函数）
 * @param parent 父元素
 */
export const createTextWrapper = (parent: DomElementLike) =>
  getDOMAdapterForOperation().createTextWrapper(parent)
/** 设置行内样式（便捷函数） */
export const setStyle = (
  el: DomElementLike,
  style: string | Partial<CSSStyleDeclaration> | null | undefined,
) => {
  getDOMAdapterForOperation().setStyle(el, style)
}
/** 设置节点文本内容（便捷函数） */
export const settextContent = (el: DomNodeLike, val: any) => {
  if (activeDOMHostOperationContext?.freshBrowser) {
    ;(el as any).textContent = val == null || typeof val === 'boolean' ? '' : String(val)
    return
  }
  getDOMAdapterForOperation().settextContent(el, val)
}
/** 创建文档片段（便捷函数） */
export const createDocumentFragment = () => {
  if (!activeDOMHostOperationContext?.freshBrowser) {
    return getDOMAdapterForOperation().createDocumentFragment()
  }
  const fragment = document.createDocumentFragment()
  freshDomParents.add(fragment)
  return fragment as any
}
/** 追加子节点（便捷函数） */
export const appendChild = (parent: DomNodeLike, child: DomNodeLike) => {
  if (activeDOMHostOperationContext?.freshBrowser) {
    ;(parent as any).appendChild(child)
    syncSelectValueForMutationParent(parent)
    return
  }
  getDOMAdapterForOperation().appendChild(parent, child)
}
/** 移除子节点（便捷函数） */
export const removeChild = (parent: DomNodeLike, child: DomNodeLike) => {
  getDOMAdapterForOperation().removeChild(parent, child)
}
/** 插入子节点（便捷函数） */
export const insertBefore = (parent: DomNodeLike, child: DomNodeLike, ref: DomNodeLike | null) => {
  if (activeDOMHostOperationContext?.freshBrowser) {
    ;(parent as any).insertBefore(child, ref)
    syncSelectValueForMutationParent(parent)
    return
  }
  getDOMAdapterForOperation().insertBefore(parent, child, ref)
}
/** 替换子节点（便捷函数） */
export const replaceChild = (parent: DomNodeLike, newChild: DomNodeLike, oldChild: DomNodeLike) => {
  getDOMAdapterForOperation().replaceChild(parent, newChild, oldChild)
}
/** 选择器查询（便捷函数） */
export const querySelector = (selector: string) =>
  getDOMAdapterForOperation().querySelector(selector)
/** 设置属性（便捷函数） */
export const setAttribute = (el: DomElementLike, name: string, value: any) => {
  if (activeDOMHostOperationContext?.freshBrowser) {
    ;(el as any).setAttribute(name, String(value))
    return
  }
  getDOMAdapterForOperation().setAttribute(el, name, value)
}
/** 移除属性（便捷函数） */
export const removeAttribute = (el: DomElementLike, name: string) => {
  if (activeDOMHostOperationContext?.freshBrowser) {
    ;(el as any).removeAttribute(name)
    return
  }
  getDOMAdapterForOperation().removeAttribute(el, name)
}

const isCustomElementLike = (el: DomElementLike) => {
  const tagName = (el as { tagName?: unknown }).tagName
  return typeof tagName === 'string' && tagName.includes('-')
}

const isObjectOrFunctionValue = (value: unknown) =>
  (typeof value === 'object' || typeof value === 'function') && value != null

const shouldUseDomProperty = (el: DomElementLike, key: string, value: unknown) => {
  if (!isCustomElementLike(el)) {
    return false
  }
  if (key === 'props' || key === '__rue_slots' || key.startsWith('__rue_context_')) {
    return true
  }
  if (key in (el as object)) {
    return true
  }
  return isObjectOrFunctionValue(value)
}

const notifyCustomElementPropertyChanged = (el: DomElementLike) => {
  const sync = (el as Record<string, unknown>)[CUSTOM_ELEMENT_SYNC_PROPS_KEY]
  if (typeof sync === 'function') {
    sync.call(el)
  }
}

/** 设置 DOM property；Rue Custom Element 会同步收集最新 property props。 */
export const setProperty = (el: DomElementLike, name: string, value: any) => {
  const target = el as Record<string, unknown>
  if (value === undefined || value === null || value === false) {
    try {
      delete target[name]
    } catch {
      target[name] = undefined
    }
    notifyCustomElementPropertyChanged(el)
    return
  }

  target[name] = value
  notifyCustomElementPropertyChanged(el)
}

/** 添加事件监听（便捷函数） */
export const addEventListener = (
  el: DomElementLike,
  eventName: string,
  listener: DOMEventHandler,
) => getDOMAdapterForOperation().addEventListener(el, eventName, listener)
/** 移除事件监听（便捷函数） */
export const removeEventListener = (
  el: DomElementLike,
  eventName: string,
  listener: DOMEventHandler,
) => getDOMAdapterForOperation().removeEventListener(el, eventName, listener)
/** 设置类名（便捷函数） */
export const setClassName = (el: DomElementLike, value: any) => {
  if (activeDOMHostOperationContext?.freshBrowser) {
    const className = value == null ? '' : String(value)
    if (el instanceof SVGElement) (el as any).setAttribute('class', className)
    else (el as any as HTMLElement).className = className
    return
  }
  getDOMAdapterForOperation().setClassName(el, value)
}
/** 设置 innerHTML（便捷函数） */
export const setInnerHTML = (el: DomElementLike, html: string) =>
  getDOMAdapterForOperation().setInnerHTML(el, html)
/** 设置表单值（便捷函数） */
export const setValue = (el: DomElementLike, value: any) =>
  getDOMAdapterForOperation().setValue(el, value)
/** 设置选中状态（便捷函数） */
export const setChecked = (el: DomElementLike, checked: boolean) =>
  getDOMAdapterForOperation().setChecked(el, checked)
/** 设置禁用状态（便捷函数） */
export const setDisabled = (el: DomElementLike, disabled: boolean) =>
  getDOMAdapterForOperation().setDisabled(el, disabled)
/** 获取标签名（便捷函数） */
export const getTagName = (el: DomElementLike) => getDOMAdapterForOperation().getTagName(el)

type SpreadAttributesRecord = {
  keys: string[]
  values: Record<string, any>
  source?: object
  signature: string
}

type SpreadAttributesState = {
  cursor: number
  resetScheduled: boolean
  merged: Record<string, any>
  records: SpreadAttributesRecord[]
  sources: WeakMap<object, SpreadAttributesRecord>
}

const spreadAttributesCache = new WeakMap<object, SpreadAttributesState>()

const isEventPropName = (name: string) =>
  name.length > 2 && name.startsWith('on') && /[A-Z]/.test(name[2] ?? '')

const toEventName = (name: string) => name.slice(2).toLowerCase()

const normalizeAttributeName = (name: string) =>
  name === 'className' ? 'class' : name === 'htmlFor' ? 'for' : name

const extractDangerouslySetInnerHTML = (value: unknown) =>
  value && typeof value === 'object' && '__html' in (value as Record<string, unknown>)
    ? (value as Record<string, unknown>).__html
    : undefined

const removeSpreadAttribute = (el: DomElementLike, key: string, value: any) => {
  if (key === 'children' || key === 'key' || key === 'ref') return
  if (key === 'dangerouslySetInnerHTML') {
    setInnerHTML(el, '')
    return
  }
  if (shouldUseDomProperty(el, key, value)) {
    setProperty(el, key, undefined)
    return
  }
  if (isEventPropName(key) && typeof value === 'function') {
    removeEventListener(el, toEventName(key), value)
    return
  }
  if (key === 'className') {
    setClassName(el, '')
    return
  }
  if (key === 'style') {
    setStyle(el, undefined)
    return
  }
  if (key === 'value') {
    setValue(el, '')
    return
  }
  if (key === 'checked') {
    setChecked(el, false)
    return
  }
  if (key === 'disabled') {
    setDisabled(el, false)
    return
  }
  if (key === 'tabIndex') {
    ;(el as any).tabIndex = -1
    removeAttribute(el, 'tabindex')
    return
  }
  removeAttribute(el, normalizeAttributeName(key))
}

const setSpreadAttribute = (el: DomElementLike, key: string, value: any, previous: any) => {
  if (key === 'children' || key === 'key' || key === 'ref') return
  if (key === 'dangerouslySetInnerHTML') {
    const html = extractDangerouslySetInnerHTML(value)
    if (html !== undefined && html !== null) {
      setInnerHTML(el, String(html))
    } else if (previous !== undefined && previous !== null) {
      setInnerHTML(el, '')
    }
    return
  }
  if (isEventPropName(key)) {
    const eventName = toEventName(key)
    if (typeof previous === 'function' && previous !== value) {
      removeEventListener(el, eventName, previous)
    }
    if (typeof value === 'function' && previous !== value) {
      addEventListener(el, eventName, value)
    }
    return
  }
  if (shouldUseDomProperty(el, key, value) || shouldUseDomProperty(el, key, previous)) {
    setProperty(el, key, value)
    return
  }
  if (value === undefined || value === null || value === false) {
    removeSpreadAttribute(el, key, previous)
    return
  }
  if (key === 'className') {
    setClassName(el, String(value))
    return
  }
  if (key === 'style') {
    setStyle(el, value)
    return
  }
  if (key === 'value') {
    setValue(el, value)
    return
  }
  if (key === 'checked') {
    setChecked(el, !!value)
    return
  }
  if (key === 'disabled') {
    setDisabled(el, !!value)
    return
  }
  if (key === 'tabIndex') {
    ;(el as any).tabIndex = value
    return
  }
  setAttribute(el, normalizeAttributeName(key), value === true ? 'true' : value)
}

const getSpreadAttributesState = (el: DomElementLike) => {
  let state = spreadAttributesCache.get(el as object)
  if (!state) {
    state = {
      cursor: 0,
      resetScheduled: false,
      merged: {},
      records: [],
      sources: new WeakMap(),
    }
    spreadAttributesCache.set(el as object, state)
  }

  if (!state.resetScheduled) {
    state.resetScheduled = true
    queueMicrotask(() => {
      if (state.cursor < state.records.length) {
        state.records = state.records.slice(0, state.cursor)
        state.sources = createSpreadSources(state.records)
        applySpreadAttributes(el, state, mergeSpreadAttributeRecords(state.records))
      }
      state.cursor = 0
      state.resetScheduled = false
    })
  }

  return state
}

const createSpreadSignature = (keys: string[]) => keys.slice().sort().join('\u0000')

const toSpreadRecordValues = (props: Record<string, any>, keys: string[]) => {
  const values: Record<string, any> = {}
  keys.forEach(key => {
    values[key] = props[key]
  })
  return values
}

const findUniqueSpreadRecordBySignature = (
  records: SpreadAttributesRecord[],
  signature: string,
) => {
  let match: SpreadAttributesRecord | undefined

  for (const record of records) {
    if (record.signature !== signature) continue
    if (match) return undefined
    match = record
  }

  return match
}

const resolveSpreadAttributesRecord = (
  state: SpreadAttributesState,
  source: Record<string, any>,
  keys: string[],
) => {
  const sourceObject = source && typeof source === 'object' ? source : undefined
  const signature = createSpreadSignature(keys)
  let record = sourceObject ? state.sources.get(sourceObject) : undefined

  if (!record && state.cursor >= state.records.length) {
    record = { keys: [], values: {}, source: sourceObject, signature }
    state.records.push(record)
  }

  if (!record) {
    record = findUniqueSpreadRecordBySignature(state.records, signature)
  }

  if (!record) {
    record = state.records[state.cursor]
  }

  if (!record) {
    record = { keys: [], values: {}, source: sourceObject, signature }
    state.records.push(record)
  }

  if (sourceObject) {
    record.source = sourceObject
    state.sources.set(sourceObject, record)
  }
  state.cursor += 1
  return record
}

const mergeSpreadAttributeRecords = (records: SpreadAttributesRecord[]) => {
  const merged: Record<string, any> = {}
  records.forEach(record => {
    Object.keys(record.values).forEach(key => {
      merged[key] = record.values[key]
    })
  })
  return merged
}

const createSpreadSources = (records: SpreadAttributesRecord[]) => {
  const sources = new WeakMap<object, SpreadAttributesRecord>()
  records.forEach(record => {
    if (record.source) {
      sources.set(record.source, record)
    }
  })
  return sources
}

const applySpreadAttributes = (
  el: DomElementLike,
  state: SpreadAttributesState,
  merged: Record<string, any>,
) => {
  const previous = state.merged

  Object.keys(previous).forEach(key => {
    if (!(key in merged)) {
      removeSpreadAttribute(el, key, previous[key])
    }
  })

  Object.keys(merged).forEach(key => {
    const value = merged[key]
    if (previous[key] !== value) {
      setSpreadAttribute(el, key, value, previous[key])
    }
  })

  state.merged = { ...merged }
}

/** 批量透传 JSX spread 属性，供 Vapor 编译产物使用。 */
export const spreadAttributes = (
  el: DomElementLike,
  props: Record<string, any> | null | undefined,
) => {
  const next = props && typeof props === 'object' ? props : {}
  const state = getSpreadAttributesState(el)
  const keys = Object.keys(next)
  const record = resolveSpreadAttributesRecord(state, next, keys)
  record.keys = keys
  record.values = toSpreadRecordValues(next, keys)
  record.signature = createSpreadSignature(keys)

  applySpreadAttributes(el, state, mergeSpreadAttributeRecords(state.records))
}

/** 将一组 DOM props 应用到已有元素上，供 hydration / 手动接管路径复用。 */
export const applyDomProps = (
  el: DomElementLike,
  props: Record<string, any> | null | undefined,
  previous?: Record<string, any> | null | undefined,
) => {
  const next = props && typeof props === 'object' ? props : {}
  const prev = previous && typeof previous === 'object' ? previous : {}

  Object.keys(prev).forEach(key => {
    if (!(key in next)) {
      removeSpreadAttribute(el, key, prev[key])
    }
  })

  Object.keys(next).forEach(key => {
    const value = next[key]
    if (prev[key] !== value) {
      setSpreadAttribute(el, key, value, prev[key])
    }
  })
}
/** 判断包含关系（便捷函数） */
export const contains = (parent: DomNodeLike, child: DomNodeLike) =>
  getDOMAdapterForOperation().contains(parent, child)
/** 获取父节点（便捷函数） */
export const getParentNode = (node: DomNodeLike) => getDOMAdapterForOperation().getParentNode(node)
/** 样式增量补丁（便捷函数） */
export const patchStyle = (
  el: DomElementLike,
  oldStyle: Partial<CSSStyleDeclaration> | undefined,
  newStyle: Partial<CSSStyleDeclaration> | undefined,
) => getDOMAdapterForOperation().patchStyle(el, oldStyle, newStyle)
/** 判断是否为片段（便捷函数） */
export const isFragment = (node: DomNodeLike) => getDOMAdapterForOperation().isFragment(node)
/** 收集片段子节点（便捷函数） */
export const collectFragmentChildren = (node: DomNodeLike) =>
  getDOMAdapterForOperation().collectFragmentChildren(node)
/** 应用 ref（便捷函数） */
export const applyRef = (el: DomElementLike, ref: any) =>
  getDOMAdapterForOperation().applyRef(el, ref)
/** 清理 ref（便捷函数） */
export const clearRef = (ref: any) => getDOMAdapterForOperation().clearRef(ref)

/** DOM 事件监听选项，兼容 capture boolean 和标准 AddEventListenerOptions。 */
export type DOMEventListenerOptions = boolean | AddEventListenerOptions | undefined

/** Rue 编译事件处理器，可携带原生 addEventListener options。 */
export type DOMEventHandler = ((evt: any) => void) & {
  /** 由事件修饰符生成的原生监听配置。 */
  __rue_options?: DOMEventListenerOptions
}

const runtimeBoundEventHandlers = new WeakMap<DOMEventHandler, DOMEventHandler>()

const getActiveRuntimeForDOMEvent = () => {
  const globalRecord = globalThis as typeof globalThis & {
    __rue?: unknown
    __rue_active?: unknown
    __rue_vapor?: unknown
    __rue_vapor_preferred?: unknown
  }
  return (
    globalRecord.__rue_active ||
    globalRecord.__rue_vapor_preferred ||
    globalRecord.__rue ||
    globalRecord.__rue_vapor
  )
}

const runWithCapturedRuntime = <T>(runtime: unknown, runner: () => T): T => {
  if (!runtime || (typeof runtime !== 'object' && typeof runtime !== 'function')) {
    return runner()
  }

  const globalRecord = globalThis as typeof globalThis & {
    __rue_active?: unknown
  }
  const hadActiveRuntime = Object.prototype.hasOwnProperty.call(globalRecord, '__rue_active')
  const previousRuntime = globalRecord.__rue_active

  globalRecord.__rue_active = runtime
  try {
    return runner()
  } finally {
    if (hadActiveRuntime) {
      globalRecord.__rue_active = previousRuntime
    } else {
      delete globalRecord.__rue_active
    }
  }
}

const bindEventHandlerToCurrentRuntime = (listener: DOMEventHandler): DOMEventHandler => {
  const runtime = getActiveRuntimeForDOMEvent()
  if (!runtime) return listener

  const cached = runtimeBoundEventHandlers.get(listener)
  if (cached && (cached as any).__rue_runtime === runtime) {
    return cached
  }

  const bound = function (this: unknown, event: any) {
    return runWithCapturedRuntime(runtime, () => listener.call(this, event))
  } as DOMEventHandler
  bound.__rue_options = listener.__rue_options
  ;(bound as any).__rue_runtime = runtime
  runtimeBoundEventHandlers.set(listener, bound)
  return bound
}

const getBoundEventHandlerForRemoval = (listener: DOMEventHandler): DOMEventHandler => {
  return runtimeBoundEventHandlers.get(listener) ?? listener
}
