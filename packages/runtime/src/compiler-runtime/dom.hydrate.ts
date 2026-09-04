import * as browserDOM from './dom.browser'
import {
  adoptHydratedNode as adoptDOMNode,
  attachDOMHostResult,
  withDOMHostOperations as withAdapterHostOperations,
} from '../dom'

const adoptedTargets = new WeakMap<Node, Node>()
const hydrationListeners = new WeakMap<Node, Map<string, Set<EventListener>>>()
const hydrationRefs = new WeakMap<Node, Set<unknown>>()
let hydrationStagingDepth = 0

export const withHydrationStaging = <T>(run: () => T): T => {
  hydrationStagingDepth += 1
  try {
    return run()
  } finally {
    hydrationStagingDepth -= 1
  }
}

export const markHydrationStaging = (fragment: DocumentFragment): void => {
  if (hydrationStagingDepth > 0) {
    ;(fragment as DocumentFragment & { __rue_hydrated_adopted?: boolean }).__rue_hydrated_adopted =
      true
  }
}

export const isHydrationStagingActive = (): boolean => hydrationStagingDepth > 0

const applyRef = (node: Node | null, ref: unknown) => {
  if (typeof ref === 'function') ref(node)
  else if (ref && typeof ref === 'object' && 'current' in ref) {
    ;(ref as { current: unknown }).current = node
  }
}

export const addHydrationEventListener = (
  node: Node,
  event: string,
  listener: EventListener,
): void => {
  ;(node as EventTarget).addEventListener(event, listener)
  let events = hydrationListeners.get(node)
  if (!events) hydrationListeners.set(node, (events = new Map()))
  let listeners = events.get(event)
  if (!listeners) events.set(event, (listeners = new Set()))
  listeners.add(listener)
}

export const removeHydrationEventListener = (
  node: Node,
  event: string,
  listener: EventListener,
): void => {
  ;(node as EventTarget).removeEventListener(event, listener)
  adoptedTargets.get(node)?.removeEventListener(event, listener)
  hydrationListeners.get(node)?.get(event)?.delete(listener)
}

export const applyHydrationRef = (node: Node, ref: unknown): void => {
  applyRef(node, ref)
  let refs = hydrationRefs.get(node)
  if (!refs) hydrationRefs.set(node, (refs = new Set()))
  refs.add(ref)
}

export const clearHydrationRef = (node: Node, ref: unknown): void => {
  hydrationRefs.get(node)?.delete(ref)
  applyRef(null, ref)
}

const transferHydrationMetadata = (clientNode: Node): void => {
  const adopted = (clientNode as Node & { __rue_hydrated_adopted_target?: Node })
    .__rue_hydrated_adopted_target
  if (adopted) {
    adoptedTargets.set(clientNode, adopted)
    for (const [event, listeners] of hydrationListeners.get(clientNode) ?? []) {
      for (const listener of listeners) adopted.addEventListener(event, listener)
    }
    for (const ref of hydrationRefs.get(clientNode) ?? []) applyRef(adopted, ref)
  }
  for (const child of Array.from(clientNode.childNodes)) transferHydrationMetadata(child)
}

/** Explicit DOM boundary used only by hydrate-target compiler output. */
export const createComment = (data: string): Comment => browserDOM.createComment(data)
export const createTextNode = (data: string): Text => browserDOM.createTextNode(data)
export const createElement = (tag: string, parent?: Node | null): Element =>
  browserDOM.createElement(tag, parent)
export const appendChild = (parent: Node, child: Node): void =>
  browserDOM.appendChild(parent, child)
export const removeChild = (parent: Node, child: Node): void =>
  browserDOM.removeChild(parent, child)
export const insertBefore = (parent: Node, child: Node, reference: Node | null): void =>
  browserDOM.insertBefore(parent, child, reference)
export const template = (html: string): browserDOM.StaticTemplateGetter => browserDOM.template(html)
export const withDOMHostOperations = <T>(parent: Node | null | undefined, run: () => T): T =>
  withAdapterHostOperations(parent, () => attachDOMHostResult(parent, run()))

export const adoptHydratedNode = (serverNode: Node, clientNode: Node): boolean => {
  const adopted = adoptDOMNode(serverNode, clientNode)
  if (adopted) transferHydrationMetadata(clientNode)
  return adopted
}
