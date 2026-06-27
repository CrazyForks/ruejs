import { mdToHtml } from './docMarkdown'

const docHtmlCache = new Map<string, string>()
const docPendingCache = new Map<string, Promise<string>>()
const staticDocHtmlByRouteKey = '__RUE_STATIC_DOC_HTML_BY_ROUTE__'

const normalizeStaticDocRoute = (route: string) => {
  const withoutHash = route.split('#')[0]
  const withoutSearch = withoutHash.split('?')[0]
  const normalized = withoutSearch.startsWith('/') ? withoutSearch : `/${withoutSearch}`
  return normalized.length > 1 ? normalized.replace(/\/+$/g, '') : '/'
}

export const readStaticDocHtmlByRoute = (route: string) => {
  const staticDocHtmlByRoute = (globalThis as any)[staticDocHtmlByRouteKey] as
    | Record<string, unknown>
    | undefined
  const html = staticDocHtmlByRoute?.[normalizeStaticDocRoute(route)]
  return typeof html === 'string' ? html : ''
}

export const createDocDetailUrl = (base: string, seg: string) => {
  return import.meta.env.DEV
    ? new URL(`${base}/${seg}.md?id=${Math.random()}`, import.meta.url)
    : `${base}/${seg}.md`
}

export const loadCachedDocHtml = async (scope: string, base: string, seg: string) => {
  const cacheKey = `${scope}:${base}:${seg}`
  const cachedHtml = docHtmlCache.get(cacheKey)

  if (cachedHtml) {
    return cachedHtml
  }

  const pendingHtml = docPendingCache.get(cacheKey)
  if (pendingHtml) {
    return pendingHtml
  }

  const nextRequest = (async () => {
    const res = await fetch(createDocDetailUrl(base, seg) as any)
    if (!res.ok) {
      throw new Error(`doc not found: ${seg}`)
    }

    const md = await res.text()
    const html = await mdToHtml(md)
    docHtmlCache.set(cacheKey, html)
    return html
  })()

  docPendingCache.set(cacheKey, nextRequest)

  try {
    return await nextRequest
  } finally {
    docPendingCache.delete(cacheKey)
  }
}
