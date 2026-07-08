import { resolveStaticRenderPath } from '../../staticRenderContext'

const normalizeDocRouteSegment = (value: string | undefined) => {
  return String(value || '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
}

const readStaticDocRouteSegment = (url: string | null | undefined, uiBase: string) => {
  const path = resolveStaticRenderPath(url)
  const normalizedPath = path.length > 1 ? path.replace(/\/+$/g, '') : path
  const prefix = `${uiBase}/`

  if (!normalizedPath.startsWith(prefix)) {
    return ''
  }

  return decodeURIComponent(normalizedPath.slice(prefix.length))
}

export const readDocRouteSegment = ({
  propPath,
  routePath,
  currentRoutePath,
  staticRenderUrl,
  uiBase,
}: {
  propPath?: string
  routePath?: string
  currentRoutePath?: string
  staticRenderUrl?: string | null
  uiBase: string
}) => {
  const propSegment = normalizeDocRouteSegment(propPath)
  if (propSegment) {
    return propSegment
  }

  const routeSegment = normalizeDocRouteSegment(routePath)
  if (routeSegment) {
    return routeSegment
  }

  const currentRouteSegment = normalizeDocRouteSegment(
    readStaticDocRouteSegment(currentRoutePath, uiBase),
  )
  if (currentRouteSegment) {
    return currentRouteSegment
  }

  return normalizeDocRouteSegment(readStaticDocRouteSegment(staticRenderUrl, uiBase))
}
