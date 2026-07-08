import { createContext, useContext } from '@rue-js/rue'

export type StaticRenderContextValue = {
  url: string
}

export const staticRenderRouteKey = '__RUE_STATIC_RENDER_ROUTE__'
export const StaticRenderContext = createContext<StaticRenderContextValue | null>(null)

export const useStaticRenderContext = () => useContext(StaticRenderContext)

export const readStaticRenderRoute = () => {
  const route = (globalThis as Record<string, unknown>)[staticRenderRouteKey]
  return typeof route === 'string' ? route : ''
}

export const resolveStaticRenderPath = (url: string | null | undefined) => {
  if (!url) {
    return ''
  }

  try {
    const parsed = new URL(url, 'https://rue.local')
    const hashPath = parsed.hash.startsWith('#/') ? parsed.hash.slice(1) : ''
    return hashPath || parsed.pathname || '/'
  } catch {
    const path = url.split(/[?#]/, 1)[0]
    return path || '/'
  }
}
