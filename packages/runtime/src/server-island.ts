export const RUE_SERVER_ISLAND_ELEMENT = 'rue-server-island'

export interface RueServerIslandLoaderOptions {
  root?: ParentNode
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  onError?: (error: unknown, island: Element) => void
}

interface ServerIslandRequestRecord {
  controller: AbortController
  token: symbol
}

const SERVER_ISLAND_SELECTOR = RUE_SERVER_ISLAND_ELEMENT
const SERVER_ISLAND_PAYLOAD_SELECTOR =
  'script[type="application/json"][data-rue-server-island-payload]'

const containsIsland = (root: ParentNode, island: Element) =>
  island.isConnected && (root === island || (root as Node).contains(island))

const readRequest = (island: Element): { input: string; init: RequestInit } => {
  const method = (island.getAttribute('data-rue-method') || 'GET').toUpperCase()
  if (method === 'GET') {
    const url = island.getAttribute('data-rue-url')
    if (!url) throw new Error('Rue server island GET request is missing data-rue-url.')
    return {
      input: url,
      init: { method: 'GET', headers: { Accept: 'text/html' } },
    }
  }

  if (method === 'POST') {
    const endpoint = island.getAttribute('data-rue-endpoint')
    const payload = island.querySelector(SERVER_ISLAND_PAYLOAD_SELECTOR)?.textContent
    if (!endpoint) {
      throw new Error('Rue server island POST request is missing data-rue-endpoint.')
    }
    if (!payload) {
      throw new Error('Rue server island POST request is missing its JSON payload script.')
    }
    return {
      input: endpoint,
      init: {
        method: 'POST',
        body: payload,
        headers: { Accept: 'text/html', 'Content-Type': 'application/json' },
      },
    }
  }

  throw new Error(`Rue server island does not support request method ${method}.`)
}

const parseHtmlFragment = (html: string) => {
  const template = document.createElement('template')
  template.innerHTML = html
  return template.content
}

/**
 * Starts the dependency-free browser loader for deferred server-rendered fragments.
 * The returned cleanup function disconnects observation and aborts active requests.
 */
export const startRueServerIslandLoader = (
  options: RueServerIslandLoaderOptions = {},
): (() => void) => {
  const root = options.root ?? document
  const fetchRequest = options.fetch ?? globalThis.fetch?.bind(globalThis)
  if (!fetchRequest) throw new Error('Rue server island loader requires a fetch implementation.')

  const attempted = new WeakSet<Element>()
  const activeRequests = new Map<Element, ServerIslandRequestRecord>()
  let active = true

  const reportError = (error: unknown, island: Element, record: ServerIslandRequestRecord) => {
    if (!active || record.controller.signal.aborted) return
    if (activeRequests.get(island)?.token !== record.token) return
    island.setAttribute('data-rue-status', 'error')
    activeRequests.delete(island)
    options.onError?.(error, island)
  }

  const loadIsland = (island: Element) => {
    if (!active || attempted.has(island) || !containsIsland(root, island)) return
    attempted.add(island)
    const record: ServerIslandRequestRecord = {
      controller: new AbortController(),
      token: Symbol('rue.server-island.request'),
    }
    activeRequests.set(island, record)
    island.setAttribute('data-rue-status', 'loading')

    void (async () => {
      try {
        const request = readRequest(island)
        const response = await fetchRequest(request.input, {
          ...request.init,
          signal: record.controller.signal,
        })
        if (!response.ok) {
          throw new Error(`Rue server island request failed with HTTP ${response.status}.`)
        }
        const contentType = response.headers.get('content-type') || ''
        if (!/^text\/html(?:\s*;|$)/i.test(contentType)) {
          throw new Error(
            `Rue server island expected text/html but received ${contentType || 'none'}.`,
          )
        }
        const fragment = parseHtmlFragment(await response.text())
        if (!active || record.controller.signal.aborted) return
        if (activeRequests.get(island)?.token !== record.token) return
        if (!containsIsland(root, island)) return

        island.replaceChildren(fragment)
        island.setAttribute('data-rue-status', 'loaded')
        activeRequests.delete(island)
      } catch (error) {
        reportError(error, island, record)
      }
    })()
  }

  const scan = (target: ParentNode) => {
    if (target instanceof Element && target.matches(SERVER_ISLAND_SELECTOR)) {
      loadIsland(target)
    }
    for (const island of target.querySelectorAll(SERVER_ISLAND_SELECTOR)) {
      loadIsland(island)
    }
  }

  let removalSweepQueued = false
  const queueRemovalSweep = () => {
    if (removalSweepQueued) return
    removalSweepQueued = true
    queueMicrotask(() => {
      removalSweepQueued = false
      if (!active) return
      for (const [island, record] of activeRequests) {
        if (!containsIsland(root, island)) {
          activeRequests.delete(island)
          record.controller.abort()
        }
      }
    })
  }

  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element || node instanceof DocumentFragment) scan(node)
      }
      if (record.removedNodes.length > 0) queueRemovalSweep()
    }
  })
  observer.observe(root, { childList: true, subtree: true })
  scan(root)

  return () => {
    if (!active) return
    active = false
    observer.disconnect()
    for (const record of activeRequests.values()) record.controller.abort()
    activeRequests.clear()
  }
}
