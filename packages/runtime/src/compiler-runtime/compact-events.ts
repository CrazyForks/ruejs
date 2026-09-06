import { resolveDOMHostParentContext } from './dom.browser'
import { hasActiveDOMHostOperations, isFreshBrowserDOMHost } from './dom-host-operations'

type CompiledDelegatedHandler = () => unknown
type CompiledDelegatedHandlerRead = () => CompiledDelegatedHandler | null | undefined

type DelegatedTarget = EventTarget & { parentNode?: Node | null }
type DelegatedRegistration = {
  read: CompiledDelegatedHandlerRead
  root: EventTarget
}

const handlers = new Map<string, WeakMap<EventTarget, DelegatedRegistration>>()
const roots = new WeakMap<EventTarget, Map<string, EventListener>>()

const readHandler = (target: EventTarget, type: string): DelegatedRegistration | undefined =>
  handlers.get(type)?.get(target)

const eventPath = (event: Event, root: EventTarget): EventTarget[] => {
  const composed = typeof event.composedPath === 'function' ? event.composedPath() : []
  if (composed.length > 0 && composed.includes(root)) return composed

  const path: EventTarget[] = []
  let current = event.target as DelegatedTarget | null
  while (current != null) {
    path.push(current)
    if (current === root) break
    current = current.parentNode as DelegatedTarget | null
  }
  return path
}

const dispatch = (root: EventTarget, type: string, event: Event): void => {
  for (const target of eventPath(event, root)) {
    const registration = readHandler(target, type)
    if (registration?.root === root) {
      const handler = registration.read()
      if (typeof handler === 'function') handler()
    }
    if (target === root || event.cancelBubble) break
  }
}

const canListen = (value: unknown): value is EventTarget =>
  value != null && typeof (value as EventTarget).addEventListener === 'function'

/** Register a compiler-proven zero-argument bubbling handler on a shared mount root. */
export const _$compiledDelegateEvent = (
  root: EventTarget | null | undefined,
  target: EventTarget,
  type: string,
  read: CompiledDelegatedHandlerRead,
): (() => void) => {
  // Hydration records native target listeners so it can transfer them from the speculative client
  // node to the adopted SSR node. A WeakMap-only delegated registration cannot be transferred.
  if (hasActiveDOMHostOperations() && !isFreshBrowserDOMHost() && canListen(target)) {
    const listener: EventListener = () => {
      const handler = read()
      if (typeof handler === 'function') handler()
    }
    target.addEventListener(type, listener)
    return () => target.removeEventListener(type, listener)
  }

  const resolvedRoot =
    typeof Node !== 'undefined' && root instanceof Node ? resolveDOMHostParentContext(root) : root
  // An unassociated staging fragment is emptied when its children are committed, so a listener
  // installed on it would become unreachable. Mapped list fragments resolve to their stable host;
  // otherwise keep the listener on the target that actually moves into the document.
  const detachedStagingRoot =
    typeof DocumentFragment !== 'undefined' &&
    root instanceof DocumentFragment &&
    resolvedRoot === root
  const listenerRoot =
    detachedStagingRoot && canListen(target)
      ? target
      : canListen(resolvedRoot)
        ? resolvedRoot
        : canListen(target)
          ? target
          : null
  if (listenerRoot == null) return () => {}

  let typeHandlers = handlers.get(type)
  if (typeHandlers == null) {
    typeHandlers = new WeakMap()
    handlers.set(type, typeHandlers)
  }
  const registration: DelegatedRegistration = { read, root: listenerRoot }
  typeHandlers.set(target, registration)
  const dispose = (): void => {
    if (typeHandlers.get(target) === registration) typeHandlers.delete(target)
  }

  let rootListeners = roots.get(listenerRoot)
  if (!rootListeners) {
    rootListeners = new Map()
    roots.set(listenerRoot, rootListeners)
  }
  if (rootListeners.has(type)) return dispose

  const listener: EventListener = event => dispatch(listenerRoot, type, event)
  rootListeners.set(type, listener)
  listenerRoot.addEventListener(type, listener)
  return dispose
}
