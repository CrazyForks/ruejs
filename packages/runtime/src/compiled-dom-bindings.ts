import { effect, onOwnerCleanup } from './internal-reactive'
import {
  addHydrationEventListener,
  applyHydrationRef,
  clearHydrationRef,
  removeHydrationEventListener,
} from './compiler-runtime/dom.hydrate'

type SpreadValue = Record<string, unknown> | null | undefined

const eventName = (key: string): string | undefined =>
  /^on[A-Z]/.test(key) ? key.slice(2).toLowerCase() : undefined

/** Apply a compiler-owned native spread binding without a generic DOM adapter. */
export const _$compiledSpreadAttributes = (
  element: Element,
  read: () => SpreadValue,
  excluded: readonly string[] = [],
): (() => void) => {
  const excludedKeys = new Set(excluded)
  const previous = new Map<string, unknown>()
  const listeners = new Map<string, EventListener>()

  const apply = () => {
    const source = read() ?? {}
    const next = new Map<string, unknown>()
    for (const key of Object.keys(source)) {
      if (!excludedKeys.has(key) && key !== 'key') next.set(key, source[key])
    }

    for (const [key, previousValue] of previous) {
      if (next.has(key)) continue
      const event = eventName(key)
      const listener = listeners.get(key)
      if (event && listener) {
        removeHydrationEventListener(element, event, listener)
        listeners.delete(key)
      } else if (key === 'ref') clearHydrationRef(element, previousValue)
      else if (key === 'className') element.removeAttribute('class')
      else if (key === 'style') (element as HTMLElement).removeAttribute('style')
      else if (key === 'dangerouslySetInnerHTML') element.innerHTML = ''
      else element.removeAttribute(key)
    }

    for (const [key, value] of next) {
      if (Object.is(previous.get(key), value) && previous.has(key)) continue
      const event = eventName(key)
      if (event) {
        const oldListener = listeners.get(key)
        if (oldListener) removeHydrationEventListener(element, event, oldListener)
        if (typeof value === 'function') {
          const listener = value as EventListener
          addHydrationEventListener(element, event, listener)
          listeners.set(key, listener)
        } else listeners.delete(key)
      } else if (key === 'ref') {
        if (previous != null) clearHydrationRef(element, previous)
        if (value != null) applyHydrationRef(element, value)
      } else if (key === 'className') {
        if (value == null || value === false) element.removeAttribute('class')
        else element.setAttribute('class', String(value))
      } else if (key === 'style' && value && typeof value === 'object') {
        Object.assign((element as HTMLElement).style, value)
      } else if (key === 'dangerouslySetInnerHTML') {
        const html =
          value != null && typeof value === 'object' && '__html' in value
            ? (value as Record<string, unknown>).__html
            : undefined
        element.innerHTML = html == null ? '' : String(html)
      } else if (key in element && key !== 'list' && key !== 'form') {
        Reflect.set(element, key, value ?? '')
      } else if (value == null || value === false) element.removeAttribute(key)
      else element.setAttribute(key, value === true ? '' : String(value))
    }
    previous.clear()
    for (const entry of next) previous.set(...entry)
  }
  const stop = effect(apply)

  onOwnerCleanup(() => {
    stop.dispose()
    for (const [key, listener] of listeners) {
      const event = eventName(key)
      if (event) removeHydrationEventListener(element, event, listener)
    }
    const ref = previous.get('ref')
    if (ref != null) clearHydrationRef(element, ref)
  })
  return apply
}
