import {
  attachDOMHostResult,
  captureDOMHostOperations as captureAdapterHostOperations,
  getDOMHostAdapter,
  getRememberedDOMHostAdapter,
  isFreshBrowserDOMHost,
  withDOMHostOperations as withAdapterHostOperations,
} from './dom-host-operations'

type BrowserDOMNode = Node & {
  namespaceURI?: string | null
  localName?: string | null
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const parentContexts = new WeakMap<Node, Node>()
let activeParent: Node | null | undefined
let activeHydrationAppendChild: ((parent: Node, child: Node) => void) | undefined
let activeHydrationInsertBefore:
  | ((parent: Node, child: Node, reference: Node | null) => void)
  | undefined

export type StaticTemplateGetter = () => HTMLTemplateElement

const browserDOMHostAdapter = {
  createComment: (data: string) => document.createComment(data),
  createTextNode: (data: string) => document.createTextNode(data),
  createDocumentFragment: () => document.createDocumentFragment(),
  createElement: (tag: string, parent?: BrowserDOMNode | null) => {
    const useSVGNamespace =
      tag === 'svg' ||
      (parent?.namespaceURI === SVG_NAMESPACE && parent.localName !== 'foreignObject')
    return useSVGNamespace
      ? document.createElementNS(SVG_NAMESPACE, tag)
      : document.createElement(tag)
  },
  appendChild: (parent: Node, child: Node) => parent.appendChild(child),
  removeChild: (parent: Node, child: Node) => parent.removeChild(child),
  insertBefore: (parent: Node, child: Node, reference: Node | null) =>
    parent.insertBefore(child, reference),
  getParentNode: (node: Node) => node.parentNode,
}

const hostAdapter = () => getDOMHostAdapter(browserDOMHostAdapter)
const hostAdapterFor = (parent?: object | null) => {
  if (isFreshBrowserDOMHost()) return browserDOMHostAdapter
  if (typeof Node !== 'undefined' && parent instanceof Node) return browserDOMHostAdapter
  const activeAdapter = hostAdapter()
  const serverRenderingCount = (globalThis as Record<string, unknown>).__rue_is_server_rendering__
  if (
    activeAdapter !== browserDOMHostAdapter &&
    typeof serverRenderingCount === 'number' &&
    serverRenderingCount > 0
  ) {
    return activeAdapter
  }
  return parent == null ? activeAdapter : (getRememberedDOMHostAdapter(parent) ?? activeAdapter)
}

const SERVER_TEMPLATE_VOID_TAGS = new Set([
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

const decodeTemplateText = (value: string): string =>
  value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_match, entity: string) => {
    const normalized = entity.toLowerCase()
    if (normalized === 'amp') return '&'
    if (normalized === 'lt') return '<'
    if (normalized === 'gt') return '>'
    if (normalized === 'quot') return '"'
    if (normalized === 'apos') return "'"
    if (normalized === 'nbsp') return '\u00a0'
    const radix = normalized.startsWith('#x') ? 16 : 10
    const digits = normalized.slice(radix === 16 ? 2 : 1)
    return String.fromCodePoint(Number.parseInt(digits, radix))
  })

const cloneServerTemplate = (html: string, adapter: typeof browserDOMHostAdapter): unknown => {
  const fragment = adapter.createDocumentFragment() as any
  const stack: any[] = [fragment]
  const tokens = html.match(/<!--[\s\S]*?-->|<![^>]*>|<\/?[^>]+>|[^<]+/g) ?? []
  for (const token of tokens) {
    if (token.startsWith('<!--')) {
      adapter.appendChild(stack.at(-1), adapter.createComment(token.slice(4, -3)))
      continue
    }
    if (token.startsWith('</')) {
      if (stack.length > 1) stack.pop()
      continue
    }
    if (token.startsWith('<!')) continue
    if (token.startsWith('<')) {
      const match = /^<\s*([^\s/>]+)([\s\S]*?)\/?\s*>$/.exec(token)
      if (!match) continue
      const tag = match[1]
      const element = adapter.createElement(tag, stack.at(-1)) as any
      const attributes = match[2]
      const attributePattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
      let attribute: RegExpExecArray | null
      while ((attribute = attributePattern.exec(attributes))) {
        element.setAttribute(
          attribute[1],
          decodeTemplateText(attribute[2] ?? attribute[3] ?? attribute[4] ?? ''),
        )
      }
      adapter.appendChild(stack.at(-1), element)
      if (!token.endsWith('/>') && !SERVER_TEMPLATE_VOID_TAGS.has(tag.toLowerCase())) {
        stack.push(element)
      }
      continue
    }
    if (token) adapter.appendChild(stack.at(-1), adapter.createTextNode(decodeTemplateText(token)))
  }
  return fragment
}

export const createComment = (data: string): Comment =>
  hostAdapterFor(resolveParentContext(activeParent)).createComment(data) as Comment

export const createTextNode = (data: string): Text =>
  hostAdapterFor(resolveParentContext(activeParent)).createTextNode(data) as Text

const resolveParentContext = (parent: Node | null | undefined): Node | null | undefined => {
  let current = parent
  const visited = new Set<Node>()
  while (current != null && parentContexts.has(current) && !visited.has(current)) {
    visited.add(current)
    current = parentContexts.get(current)
  }
  return current
}

/** Resolve a staging fragment back to the stable browser parent that owns it. */
export const resolveDOMHostParentContext = (
  parent: Node | null | undefined,
): Node | null | undefined => resolveParentContext(parent)

export const createDocumentFragment = (parent?: Node | null): DocumentFragment => {
  const context = resolveParentContext(parent ?? activeParent)
  const fragment = hostAdapterFor(context).createDocumentFragment() as DocumentFragment
  if (context != null) parentContexts.set(fragment, context)
  return fragment
}

export const createElement = (tag: string, parent?: Node | null): Element => {
  const compiledParent = resolveParentContext(parent ?? activeParent) as
    | BrowserDOMNode
    | null
    | undefined
  return hostAdapterFor(compiledParent).createElement(tag, compiledParent) as Element
}

export const appendChild = (parent: Node, child: Node): void => {
  if (activeHydrationAppendChild) return activeHydrationAppendChild(parent, child)
  hostAdapterFor(parent).appendChild(parent, child)
}

export const removeChild = (parent: Node, child: Node): void => {
  hostAdapterFor(parent).removeChild(parent, child)
}

export const insertBefore = (parent: Node, child: Node, reference: Node | null): void => {
  if (activeHydrationInsertBefore) {
    return activeHydrationInsertBefore(parent, child, reference)
  }
  hostAdapterFor(parent).insertBefore(parent, child, reference)
}

export const withHydrationDOMMutations = <T>(
  append: (parent: Node, child: Node) => void,
  insert: (parent: Node, child: Node, reference: Node | null) => void,
  run: () => T,
): T => {
  const previousAppend = activeHydrationAppendChild
  const previousInsert = activeHydrationInsertBefore
  activeHydrationAppendChild = append
  activeHydrationInsertBefore = insert
  try {
    return run()
  } finally {
    activeHydrationAppendChild = previousAppend
    activeHydrationInsertBefore = previousInsert
  }
}

export const template = (html: string): StaticTemplateGetter => {
  let cachedHTML: HTMLTemplateElement | undefined
  let cachedSVG: HTMLTemplateElement | undefined
  let cachedServerTemplate: HTMLTemplateElement | undefined
  return () => {
    const adapter = hostAdapterFor(resolveParentContext(activeParent))
    if (adapter !== browserDOMHostAdapter && !isFreshBrowserDOMHost()) {
      if (!cachedServerTemplate) {
        const content = {
          cloneNode: () => {
            return cloneServerTemplate(html, adapter as typeof browserDOMHostAdapter)
          },
        }
        cachedServerTemplate = { content } as unknown as HTMLTemplateElement
      }
      return cachedServerTemplate
    }
    const context = resolveParentContext(activeParent) as BrowserDOMNode | null | undefined
    const useSVGNamespace =
      context?.namespaceURI === SVG_NAMESPACE && context.localName !== 'foreignObject'
    if (useSVGNamespace) {
      if (!cachedSVG) {
        cachedSVG = document.createElement('template')
        const svg = document.createElementNS(SVG_NAMESPACE, 'svg')
        svg.innerHTML = html
        cachedSVG.content.append(...Array.from(svg.childNodes))
      }
      return cachedSVG
    }
    if (!cachedHTML) {
      cachedHTML = document.createElement('template')
      cachedHTML.innerHTML = html
    }
    return cachedHTML
  }
}

/** Browser compiled output is already bound to the native DOM host. */
export const withDOMHostOperations = <T>(parent: Node | null | undefined, run: () => T): T => {
  const previous = activeParent
  activeParent = resolveParentContext(parent)
  try {
    return withAdapterHostOperations(activeParent, () => attachDOMHostResult(parent, run()))
  } finally {
    activeParent = previous
  }
}

export const captureDOMHostOperations = <Args extends unknown[], T>(
  parent: Node | null | undefined,
  run: (...args: Args) => T,
): ((...args: Args) => T) => captureAdapterHostOperations(resolveParentContext(parent), run)
