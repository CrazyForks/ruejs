import { resolveDOMHostParentContext } from './dom.browser'

type CompiledDelegatedHandler = () => unknown
type CompiledDelegatedHandlerRead = () => CompiledDelegatedHandler | null | undefined

type DelegatedTarget = EventTarget & { parentNode?: Node | null }

const handlers = new Map<string, WeakMap<EventTarget, CompiledDelegatedHandlerRead>>()
const roots = new WeakMap<EventTarget, Map<string, EventListener>>()

const readHandler = (target: EventTarget, type: string): CompiledDelegatedHandlerRead | undefined =>
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
    const read = readHandler(target, type)
    if (read) {
      const handler = read()
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
  let typeHandlers = handlers.get(type)
  if (typeHandlers == null) {
    typeHandlers = new WeakMap()
    handlers.set(type, typeHandlers)
  }
  typeHandlers.set(target, read)
  const dispose = (): void => {
    if (typeHandlers.get(target) === read) typeHandlers.delete(target)
  }

  const resolvedRoot =
    typeof Node !== 'undefined' && root instanceof Node ? resolveDOMHostParentContext(root) : root
  const listenerRoot = canListen(resolvedRoot) ? resolvedRoot : canListen(target) ? target : null
  if (listenerRoot == null) return dispose

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
