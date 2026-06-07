import {
  attachRouter,
  createMemoryHistory,
  createRouter,
  createWebHistory,
  defineAsyncRouteComponent,
  type HistoryLike,
  type RouteRecordRaw,
} from '@rue-js/router'
import { App } from './App'

export const staticRoutes = ['/', '/about', '/counter']

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: defineAsyncRouteComponent(() => import('./pages/Home')),
  },
  {
    path: '/about',
    name: 'about',
    component: defineAsyncRouteComponent(() => import('./pages/About')),
  },
  {
    path: '/counter',
    name: 'counter',
    component: defineAsyncRouteComponent(() => import('./pages/Counter')),
  },
  {
    path: '/:path(.*)',
    name: 'not-found',
    component: defineAsyncRouteComponent(() => import('./pages/NotFound')),
    meta: { status: 404 },
  },
]

export const createApp = (history: HistoryLike = createWebHistory()) => {
  const router = createRouter({ history, routes })
  attachRouter(router)

  return { app: App, router }
}

export const createServerApp = (url = '/') => createApp(createMemoryHistory(url))
