// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { type FC, nextTick, useApp } from '@rue-js/rue'

import {
  NavigationFailureType,
  RouterLink,
  RouterView,
  createMemoryHistory,
  createRouter,
  useAsyncRouteComponent,
  isNavigationFailure,
  type RouteRecord,
  useRoute,
  useRouter,
} from '../src'

const flushRender = async () => {
  await nextTick()
  await Promise.resolve()
  await Promise.resolve()
  await new Promise(resolve => setTimeout(resolve, 0))
}

const EmptyPage: FC = () => null

afterEach(() => {
  document.body.innerHTML = ''
})

describe('rue router', () => {
  it('matches nested named routes, decodes params, and merges route meta', async () => {
    const router = createRouter({
      history: createMemoryHistory('/guide/router/overview'),
      routes: [
        {
          path: '/guide/:section',
          name: 'guide',
          component: EmptyPage,
          meta: {
            layout: 'guide',
            scope: 'parent',
          },
          children: [
            {
              path: ':topic',
              name: 'guide-topic',
              component: EmptyPage,
              meta: {
                scope: 'child',
                title: 'Topic',
              },
            },
          ],
        },
      ],
    })

    expect(router.currentPath.get()).toBe('/guide/router/overview')
    expect(router.route.get()?.name).toBe('guide-topic')
    expect(router.route.get()?.params).toEqual({
      section: 'router',
      topic: 'overview',
    })
    expect(router.route.get()?.matched.map((record: RouteRecord) => record.path)).toEqual([
      '/guide/:section',
      ':topic',
    ])
    expect(router.route.get()?.meta).toEqual({
      layout: 'guide',
      scope: 'child',
      title: 'Topic',
    })

    await expect(
      router.push({
        name: 'guide-topic',
        params: {
          section: 'api docs',
          topic: 'guards/redirects',
        },
      }),
    ).resolves.toBeUndefined()

    expect(router.currentPath.get()).toBe('/guide/api%20docs/guards%2Fredirects')
    expect(router.route.get()?.params).toEqual({
      section: 'api docs',
      topic: 'guards/redirects',
    })
  })

  it('preserves query strings in history while matching routes by pathname', async () => {
    const router = createRouter({
      history: createMemoryHistory('/products?tab=all'),
      routes: [
        { path: '/', name: 'home', component: EmptyPage },
        { path: '/products', name: 'products', component: EmptyPage },
        { path: '/products/:id(\\d+)', name: 'product-detail', component: EmptyPage },
      ],
    })

    expect(router.currentPath.get()).toBe('/products')
    expect(router.route.get()?.name).toBe('products')
    expect(router.history.location()).toBe('/products?tab=all')

    await expect(router.push('/products?q=router&tab=router&page=1')).resolves.toBeUndefined()

    expect(router.currentPath.get()).toBe('/products')
    expect(router.route.get()?.name).toBe('products')
    expect(router.history.location()).toBe('/products?q=router&tab=router&page=1')

    const duplicated = await router.push('/products?q=router&tab=router&page=1')
    expect(isNavigationFailure(duplicated, NavigationFailureType.duplicated)).toBe(true)

    await expect(router.push('/products/42?preview=1#details')).resolves.toBeUndefined()

    expect(router.currentPath.get()).toBe('/products/42')
    expect(router.route.get()?.name).toBe('product-detail')
    expect(router.route.get()?.params).toEqual({ id: '42' })
    expect(router.history.location()).toBe('/products/42?preview=1#details')
  })

  it('reports duplicated and aborted navigation failures through guards', async () => {
    const events: string[] = []
    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [
        { path: '/', name: 'home', component: EmptyPage },
        { path: '/login', name: 'login', component: EmptyPage },
        {
          path: '/admin',
          name: 'admin',
          component: EmptyPage,
          meta: {
            requiresAuth: true,
          },
        },
        {
          path: '/settings',
          name: 'settings',
          component: EmptyPage,
          beforeEnter: () => false,
        },
      ],
    })

    router.beforeEach((to, from) => {
      events.push(`before:${from?.path}->${to?.path}`)

      if (to?.meta.requiresAuth) {
        return { name: 'login' }
      }
      return undefined
    })

    router.afterEach((to, from, failure) => {
      const result = !failure ? 'ok' : isNavigationFailure(failure) ? failure.type : failure.message

      events.push(`after:${from?.path}->${to?.path}:${result}`)
    })

    await expect(router.push('/admin')).resolves.toBeUndefined()
    expect(router.currentPath.get()).toBe('/login')
    expect(router.route.get()?.name).toBe('login')

    const duplicated = await router.push('/login')
    expect(isNavigationFailure(duplicated, NavigationFailureType.duplicated)).toBe(true)

    const aborted = await router.push('/settings')
    expect(isNavigationFailure(aborted, NavigationFailureType.aborted)).toBe(true)
    expect(router.currentPath.get()).toBe('/login')

    expect(events).toEqual([
      'before:/->/admin',
      'before:/->/login',
      'after:/->/login:ok',
      'before:/login->/login',
      'after:/login->/login:duplicated',
      'before:/login->/settings',
      'after:/login->/settings:aborted',
    ])
  })

  it('loads lazy route components before committing navigation and reuses resolved modules', async () => {
    let loadCount = 0
    let resolveLazyPage: ((value: { default: FC }) => void) | undefined

    const LazyPage = useAsyncRouteComponent(() => {
      loadCount += 1

      return new Promise(resolve => {
        resolveLazyPage = resolve
      })
    })

    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [
        { path: '/', component: EmptyPage },
        { path: '/lazy', component: LazyPage },
      ],
    })

    const navigation = router.push('/lazy')
    await Promise.resolve()
    await Promise.resolve()

    expect(loadCount).toBe(1)
    expect(router.currentPath.get()).toBe('/')

    resolveLazyPage?.({ default: EmptyPage })

    await expect(navigation).resolves.toBeUndefined()
    expect(router.currentPath.get()).toBe('/lazy')

    await router.push('/')
    await router.push('/lazy')

    expect(loadCount).toBe(1)
  })

  it('cancels stale lazy route navigations before they commit', async () => {
    let resolveSlowPage: ((value: { default: FC }) => void) | undefined

    const SlowPage = useAsyncRouteComponent(
      () =>
        new Promise(resolve => {
          resolveSlowPage = resolve
        }),
    )

    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [
        { path: '/', component: EmptyPage },
        { path: '/slow', component: SlowPage },
        { path: '/fast', component: EmptyPage },
      ],
    })

    const slowNavigation = router.push('/slow')
    await Promise.resolve()
    await Promise.resolve()

    expect(router.currentPath.get()).toBe('/')

    await expect(router.push('/fast')).resolves.toBeUndefined()
    expect(router.currentPath.get()).toBe('/fast')

    resolveSlowPage?.({ default: EmptyPage })

    const slowFailure = await slowNavigation
    expect(isNavigationFailure(slowFailure, NavigationFailureType.cancelled)).toBe(true)
    expect(slowFailure?.to?.path).toBe('/slow')
    expect(slowFailure?.from?.path).toBe('/')
    expect(router.currentPath.get()).toBe('/fast')
    expect(router.history.location()).toBe('/fast')
  })

  it('renders RouterView and navigates with RouterLink inside an app', async () => {
    const HomePage: FC = () => <p data-testid="page">Home</p>
    const PostPage: FC<{ params: { id: string } }> = ({ params }) => (
      <p data-testid="page">Post {params.id}</p>
    )
    const RouteReader: FC = () => {
      const route = useRoute()
      const router = useRouter()

      return (
        <p data-testid="current">
          {route.get()?.path} / {router.currentPath.get()}
        </p>
      )
    }
    const App: FC = () => (
      <main>
        <RouteReader />
        <RouterLink data-testid="post-link" to={{ name: 'post', params: { id: 7 } }}>
          Open Post
        </RouterLink>
        <RouterLink data-testid="home-link" to="/" replace>
          Home
        </RouterLink>
        <RouterLink data-testid="home-query-link" to="/?panel=search">
          Home Query
        </RouterLink>
        <RouterView />
      </main>
    )

    const router = createRouter({
      history: createMemoryHistory('/'),
      routes: [
        { path: '/', name: 'home', component: HomePage },
        { path: '/posts/:id(\\d+)', name: 'post', component: PostPage },
      ],
    })
    const container = document.createElement('div')
    document.body.appendChild(container)

    useApp(App).use(router).mount(container)
    await flushRender()

    const postLink = container.querySelector('[data-testid="post-link"]') as HTMLAnchorElement
    expect(postLink.getAttribute('href')).toBe('/posts/7')
    expect(container.querySelector('[data-testid="page"]')?.textContent).toBe('Home')
    expect(container.querySelector('[data-testid="current"]')?.textContent).toBe('/ / /')

    postLink.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        button: 0,
        cancelable: true,
      }),
    )
    await router.isReady()
    await flushRender()

    expect(router.currentPath.get()).toBe('/posts/7')
    expect(container.querySelector('[data-testid="page"]')?.textContent).toBe('Post 7')
    expect(container.querySelector('[data-testid="current"]')?.textContent).toBe(
      '/posts/7 / /posts/7',
    )

    const homeLink = container.querySelector('[data-testid="home-link"]') as HTMLAnchorElement
    homeLink.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        button: 0,
        cancelable: true,
      }),
    )
    await router.isReady()
    await flushRender()

    expect(router.currentPath.get()).toBe('/')
    expect(container.querySelector('[data-testid="page"]')?.textContent).toBe('Home')

    const homeQueryLink = container.querySelector(
      '[data-testid="home-query-link"]',
    ) as HTMLAnchorElement
    expect(homeQueryLink.getAttribute('href')).toBe('/?panel=search')

    homeQueryLink.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        button: 0,
        cancelable: true,
      }),
    )
    await router.isReady()
    await flushRender()

    expect(router.currentPath.get()).toBe('/')
    expect(router.history.location()).toBe('/?panel=search')
    expect(container.querySelector('[data-testid="page"]')?.textContent).toBe('Home')
  })
})
