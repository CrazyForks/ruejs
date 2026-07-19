import { attachRouter, createMemoryHistory, type RouteRecordRaw } from '@rue-js/router'
import { h, type FC } from '@rue-js/rue'
import { renderToString } from '@rue-js/server-renderer'
import { RootApp } from './app'
import { createAppRouter, routes } from './router'
import { StaticRenderContext, staticRenderRouteKey } from './staticRenderContext'

const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, '')

const joinRoutePath = (parent: string, child: string) => {
  if (child.startsWith('/')) return child
  const parentPath = parent === '/' ? '' : trimSlashes(parent)
  const childPath = trimSlashes(child)
  const joined = [parentPath, childPath].filter(Boolean).join('/')
  return joined ? `/${joined}` : '/'
}

const isConcreteRoutePath = (path: string) => {
  return path !== '' && !path.includes(':') && !path.includes('*') && !path.includes('(')
}

type StaticRouteInfo = {
  staticRoutes: Set<string>
  appClientRoutes: Set<string>
}

const createStaticRouteInfo = (): StaticRouteInfo => ({
  staticRoutes: new Set(),
  appClientRoutes: new Set(),
})

type RouteClientMode = 'none' | 'app'

const resolveClientMode = (route: RouteRecordRaw, inherited: RouteClientMode) => {
  const mode = route.meta?.clientMode
  return mode === 'app' || mode === 'none' ? mode : inherited
}

const collectStaticRouteInfo = (
  routeRecords: readonly RouteRecordRaw[],
  parentPath = '',
  output = createStaticRouteInfo(),
  clientMode: RouteClientMode = 'none',
) => {
  for (const route of routeRecords) {
    const path = joinRoutePath(parentPath, route.path)
    const nextClientMode = resolveClientMode(route, clientMode)

    if (isConcreteRoutePath(path)) {
      output.staticRoutes.add(path)
      if (nextClientMode === 'app') {
        output.appClientRoutes.add(path)
      }
    }
    if (route.children?.length) {
      collectStaticRouteInfo(route.children, path, output, nextClientMode)
    }
  }
  return output
}

const staticRouteInfo = collectStaticRouteInfo(routes)

export const staticRoutes = [...staticRouteInfo.staticRoutes].sort()
export const appClientRoutes = [...staticRouteInfo.appClientRoutes].sort()

export const render = async (url: string) => {
  const router = createAppRouter(createMemoryHistory('/'))
  const StaticRootApp: FC = () =>
    h(StaticRenderContext.Provider as any, { value: { url } }, h(RootApp, null))

  await router.push(url)
  await router.isReady()
  attachRouter(router)

  const globalScope = globalThis as Record<string, unknown>
  const previousStaticRenderRoute = globalScope[staticRenderRouteKey]
  globalScope[staticRenderRouteKey] = url

  try {
    return await renderToString(StaticRootApp)
  } finally {
    if (previousStaticRenderRoute === undefined) {
      delete globalScope[staticRenderRouteKey]
    } else {
      globalScope[staticRenderRouteKey] = previousStaticRenderRoute
    }
  }
}
