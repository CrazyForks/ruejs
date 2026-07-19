export type RoutePrefetchStrategy = false | 'hover' | 'tap' | 'viewport' | 'load'

type PrefetchConnection = {
  saveData?: boolean
  effectiveType?: string
}

const getConnection = (): PrefetchConnection | undefined => {
  if (typeof navigator === 'undefined') {
    return undefined
  }
  return (navigator as Navigator & { connection?: PrefetchConnection }).connection
}

export const shouldDegradeRoutePrefetch = () => {
  const connection = getConnection()
  return (
    connection?.saveData === true ||
    connection?.effectiveType === '2g' ||
    connection?.effectiveType === 'slow-2g'
  )
}

export const resolveRoutePrefetchStrategy = (
  strategy: RoutePrefetchStrategy | undefined,
): RoutePrefetchStrategy => {
  const normalized = strategy === undefined ? 'hover' : strategy
  if (normalized === false || normalized === 'tap') {
    return normalized
  }
  return shouldDegradeRoutePrefetch() ? 'tap' : normalized
}

export const shouldPrefetchRouteForEvent = (
  eventType: string,
  strategy: RoutePrefetchStrategy | undefined,
) => {
  const effectiveStrategy = resolveRoutePrefetchStrategy(strategy)
  if (effectiveStrategy === 'hover') {
    return eventType === 'pointerenter' || eventType === 'focus'
  }
  if (effectiveStrategy === 'tap') {
    return eventType === 'pointerdown' || eventType === 'touchstart'
  }
  return false
}

type ViewportPrefetchCallback = () => void

const viewportCallbacks = new Map<Element, ViewportPrefetchCallback>()
let sharedViewportObserver: IntersectionObserver | null = null

const getSharedViewportObserver = () => {
  if (sharedViewportObserver || typeof IntersectionObserver === 'undefined') {
    return sharedViewportObserver
  }

  sharedViewportObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) {
        continue
      }
      const callback = viewportCallbacks.get(entry.target)
      if (!callback) {
        continue
      }
      viewportCallbacks.delete(entry.target)
      sharedViewportObserver?.unobserve(entry.target)
      callback()
    }
    if (viewportCallbacks.size === 0) {
      sharedViewportObserver?.disconnect()
      sharedViewportObserver = null
    }
  })

  return sharedViewportObserver
}

const bindViewportPrefetch = (element: Element, callback: ViewportPrefetchCallback) => {
  const observer = getSharedViewportObserver()
  if (!observer) {
    return () => {}
  }

  viewportCallbacks.set(element, callback)
  observer.observe(element)

  return () => {
    if (!viewportCallbacks.delete(element)) {
      return
    }
    observer.unobserve(element)
    if (viewportCallbacks.size === 0) {
      observer.disconnect()
      if (sharedViewportObserver === observer) {
        sharedViewportObserver = null
      }
    }
  }
}

const bindLoadPrefetch = (callback: () => void) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {}
  }

  if (document.readyState === 'complete') {
    queueMicrotask(callback)
    return () => {}
  }

  const onLoad = () => callback()
  window.addEventListener('load', onLoad, { once: true })
  return () => window.removeEventListener('load', onLoad)
}

export const bindRoutePrefetchTrigger = (
  element: Element,
  strategy: RoutePrefetchStrategy | undefined,
  callback: () => void,
) => {
  const effectiveStrategy = resolveRoutePrefetchStrategy(strategy)
  if (effectiveStrategy === 'viewport') {
    return bindViewportPrefetch(element, callback)
  }
  if (effectiveStrategy === 'load') {
    return bindLoadPrefetch(callback)
  }
  return () => {}
}
