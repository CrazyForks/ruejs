type CompiledDOMNode = Node & {
  namespaceURI?: string | null
  localName?: string | null
}

type CompiledDOMAdapter = {
  createComment(data: string): Node
  createTextNode(data: string): Node
  createElement(tag: string, parent?: Node | null): Node
  appendChild(parent: Node, child: Node): void
  removeChild(parent: Node, child: Node): void
  insertBefore(parent: Node, child: Node, reference: Node | null): void
}

type CompiledDOMContext = CompiledDOMAdapter | null

export type StaticTemplateGetter = () => HTMLTemplateElement

const DOM_ADAPTER_KEY = '__rue_dom_adapter__'
const DEFAULT_BROWSER_ADAPTER_KEY = '__rue_default_browser_dom_adapter__'
const COMPILED_OPERATION_ADAPTER_KEY = '__rue_compiled_dom_operation_adapter__'
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

const nodeContexts = new WeakMap<object, CompiledDOMContext>()
let activeContext: CompiledDOMContext | undefined

const readInstalledAdapter = (parent: Node | null | undefined): CompiledDOMContext => {
  if (parent != null && typeof Node !== 'undefined' && parent instanceof Node) return null
  const globalRecord = globalThis as typeof globalThis & Record<string, unknown>
  const adapter = globalRecord[DOM_ADAPTER_KEY] as CompiledDOMAdapter | undefined
  const defaultBrowserAdapter = globalRecord[DEFAULT_BROWSER_ADAPTER_KEY]
  return adapter && adapter !== defaultBrowserAdapter ? adapter : null
}

const rememberContext = <T>(node: T): T => {
  if (activeContext && node != null && typeof node === 'object') {
    nodeContexts.set(node as object, activeContext)
  }
  return node
}

const currentAdapter = (): CompiledDOMAdapter | null => activeContext ?? null

/** Bind compiled DOM operations to the adapter active at the mount boundary. */
export const withDOMHostOperations = <T>(parent: Node | null | undefined, run: () => T): T => {
  if (activeContext !== undefined) return run()

  const inherited =
    parent != null && typeof parent === 'object' ? nodeContexts.get(parent as object) : undefined
  activeContext = inherited !== undefined ? inherited : readInstalledAdapter(parent)
  const globalRecord = globalThis as typeof globalThis & Record<string, unknown>
  const hadOperationAdapter = Object.prototype.hasOwnProperty.call(
    globalRecord,
    COMPILED_OPERATION_ADAPTER_KEY,
  )
  const previousOperationAdapter = globalRecord[COMPILED_OPERATION_ADAPTER_KEY]
  globalRecord[COMPILED_OPERATION_ADAPTER_KEY] =
    activeContext ?? globalRecord[DEFAULT_BROWSER_ADAPTER_KEY] ?? null
  try {
    return run()
  } finally {
    if (hadOperationAdapter) {
      globalRecord[COMPILED_OPERATION_ADAPTER_KEY] = previousOperationAdapter
    } else {
      delete globalRecord[COMPILED_OPERATION_ADAPTER_KEY]
    }
    activeContext = undefined
  }
}

export const createComment = (data: string): Node => {
  const adapter = currentAdapter()
  return rememberContext(adapter ? adapter.createComment(data) : document.createComment(data))
}

export const createTextNode = (data: string): Node => {
  const adapter = currentAdapter()
  return rememberContext(adapter ? adapter.createTextNode(data) : document.createTextNode(data))
}

export const createElement = (tag: string, parent?: Node | null): Node => {
  const adapter = currentAdapter()
  if (adapter) return rememberContext(adapter.createElement(tag, parent))

  const compiledParent = parent as CompiledDOMNode | null | undefined
  const useSVGNamespace =
    tag === 'svg' ||
    (compiledParent?.namespaceURI === SVG_NAMESPACE && compiledParent.localName !== 'foreignObject')
  return rememberContext(
    useSVGNamespace ? document.createElementNS(SVG_NAMESPACE, tag) : document.createElement(tag),
  )
}

export const appendChild = (parent: Node, child: Node): void => {
  const adapter = currentAdapter()
  if (adapter) adapter.appendChild(parent, child)
  else parent.appendChild(child)
}

export const removeChild = (parent: Node, child: Node): void => {
  const adapter = currentAdapter()
  if (adapter) adapter.removeChild(parent, child)
  else parent.removeChild(child)
}

export const insertBefore = (parent: Node, child: Node, reference: Node | null): void => {
  const adapter = currentAdapter()
  if (adapter) adapter.insertBefore(parent, child, reference)
  else parent.insertBefore(child, reference)
}

/** Create a lazy, module-reusable getter for compiler-hoisted static HTML. */
export const template = (html: string): StaticTemplateGetter => {
  let cached: HTMLTemplateElement | undefined

  return () => {
    if (!cached) {
      cached = document.createElement('template')
      cached.innerHTML = html
    }
    return cached
  }
}
