import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  attachRouter,
  createRouter,
  isNavigationFailure,
  NavigationFailureType,
  RouterView,
  type HistoryLike,
} from '@rue-js/router'

import { render, setReactiveScheduling, type FC } from '../src'

setReactiveScheduling('sync')

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const mountContainer = () => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return container
}

const normalizePath = (path: string) => {
  const next = String(path || '')
  if (!next) return '/'
  if (next.startsWith('/')) return next
  if (next.startsWith('#/')) return next.slice(1)
  if (next.startsWith('#')) return '/' + next.slice(1)
  return '/' + next
}

const createMemoryHistory = (initialPath: string) => {
  let currentPath = normalizePath(initialPath)
  const listeners = new Set<() => void>()

  const history = {
    pushes: [] as string[],
    replaces: [] as string[],
    location: () => currentPath,
    push: (path: string) => {
      currentPath = normalizePath(path)
      history.pushes.push(currentPath)
      listeners.forEach(listener => listener())
    },
    replace: (path: string) => {
      currentPath = normalizePath(path)
      history.replaces.push(currentPath)
      listeners.forEach(listener => listener())
    },
    listen: (cb: () => void) => {
      listeners.add(cb)
    },
    back: () => {},
  }

  return history as HistoryLike & { pushes: string[]; replaces: string[] }
}

const createDeferred = <T = void,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })

  return { promise, resolve, reject }
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('router advanced features', () => {
  it('redirects default child routes to named targets and resolves named route navigation', async () => {
    const Layout: FC<{ params: { section: string } }> = props => (
      <section data-testid="redirect-layout">
        layout:{props.params.section}
        <RouterView />
      </section>
    )

    const Overview: FC<{ params: { section: string } }> = props => (
      <article data-testid="redirect-overview">overview:{props.params.section}</article>
    )

    const Topic: FC<{ params: { section: string; topic: string } }> = props => (
      <article data-testid="redirect-topic">
        topic:{props.params.section}/{props.params.topic}
      </article>
    )

    const history = createMemoryHistory('/guide/router')
    const router = createRouter({
      history,
      routes: [
        {
          path: '/guide/:section',
          component: Layout,
          children: [
            { path: '', redirect: { name: 'guide-overview' } },
            { path: 'overview', name: 'guide-overview', component: Overview },
            { path: ':topic', name: 'guide-topic', component: Topic },
          ],
        },
      ],
    })

    attachRouter(router)

    const container = mountContainer()
    render(<RouterView />, container)

    await flush()

    expect(history.replaces).toEqual(['/guide/router/overview'])
    expect(router.route.get()?.path).toBe('/guide/router/overview')
    expect(router.route.get()?.name).toBe('guide-overview')
    expect(container.querySelector('[data-testid="redirect-overview"]')?.textContent).toContain(
      'overview:router',
    )

    const namedResult = await router.push({
      name: 'guide-topic',
      params: { section: 'router', topic: 'guards' },
    })

    expect(namedResult).toBeUndefined()
    expect(history.pushes).toEqual(['/guide/router/guards'])
    expect(router.route.get()?.path).toBe('/guide/router/guards')
    expect(router.route.get()?.name).toBe('guide-topic')
    expect(container.querySelector('[data-testid="redirect-topic"]')?.textContent).toContain(
      'topic:router/guards',
    )
  })

  it('renders default child routes through nested RouterView instances', async () => {
    const Layout: FC<{ params: { section: string } }> = props => (
      <section data-testid="default-layout">
        layout:{props.params.section}
        <RouterView />
      </section>
    )

    const IndexRoute: FC<{ params: { section: string } }> = props => (
      <article data-testid="default-child">index:{props.params.section}</article>
    )

    const history = createMemoryHistory('/guide/router')
    const router = createRouter({
      history,
      routes: [
        { path: '/', component: () => <div>home</div> },
        {
          path: '/guide/:section',
          component: Layout,
          children: [{ path: '', component: IndexRoute }],
        },
      ],
    })

    attachRouter(router)

    const container = mountContainer()
    render(<RouterView />, container)

    await flush()

    expect(container.querySelector('[data-testid="default-layout"]')?.textContent).toContain(
      'layout:router',
    )
    expect(container.querySelector('[data-testid="default-child"]')?.textContent).toContain(
      'index:router',
    )
    expect(router.route.get()?.matched.map((record: { path: string }) => record.path)).toEqual([
      '/guide/:section',
      '',
    ])
  })

  it('renders absolute child routes through the parent layout chain', async () => {
    const Layout: FC = () => (
      <section data-testid="absolute-layout">
        layout
        <RouterView />
      </section>
    )

    const AbsoluteChild: FC = () => <article data-testid="absolute-child">absolute</article>

    const history = createMemoryHistory('/reports')
    const router = createRouter({
      history,
      routes: [
        {
          path: '/admin',
          component: Layout,
          children: [{ path: '/reports', component: AbsoluteChild }],
        },
      ],
    })

    attachRouter(router)

    const container = mountContainer()
    render(<RouterView />, container)

    await flush()

    expect(container.querySelector('[data-testid="absolute-layout"]')?.textContent).toContain(
      'layout',
    )
    expect(container.querySelector('[data-testid="absolute-child"]')?.textContent).toContain(
      'absolute',
    )
    expect(router.route.get()?.path).toBe('/reports')
    expect(router.route.get()?.matched.map((record: { path: string }) => record.path)).toEqual([
      '/admin',
      '/reports',
    ])
  })

  it('renders nested child routes through nested RouterView instances', async () => {
    const Layout: FC<{ params: { section: string } }> = props => (
      <section data-testid="nested-layout">
        layout:{props.params.section}
        <RouterView />
      </section>
    )

    const Topic: FC<{ params: { section: string; topic: string } }> = props => (
      <article data-testid="nested-topic">
        topic:{props.params.section}/{props.params.topic}
      </article>
    )

    const history = createMemoryHistory('/guide/router/guards')
    const router = createRouter({
      history,
      routes: [
        { path: '/', component: () => <div>home</div> },
        {
          path: '/guide/:section',
          component: Layout,
          children: [{ path: ':topic', component: Topic }],
        },
      ],
    })

    attachRouter(router)

    const container = mountContainer()
    render(<RouterView />, container)

    await flush()

    expect(container.querySelector('[data-testid="nested-layout"]')?.textContent).toContain(
      'layout:router',
    )
    expect(container.querySelector('[data-testid="nested-topic"]')?.textContent).toContain(
      'topic:router/guards',
    )

    router.push('/guide/router/nested')
    await flush()

    expect(container.querySelectorAll('[data-testid="nested-layout"]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-testid="nested-topic"]')).toHaveLength(1)
    expect(container.querySelector('[data-testid="nested-topic"]')?.textContent).toContain(
      'topic:router/nested',
    )
  })

  it('runs global guards, route guards, and after hooks with vue-router-style redirects', async () => {
    const blockedEnter = vi.fn(() => false)
    const beforeEach = vi.fn((to: any) => {
      if (to?.meta?.requiresAuth) {
        return '/login'
      }

      return undefined
    })
    const afterEach = vi.fn()

    const history = createMemoryHistory('/public')
    const router = createRouter({
      history,
      routes: [
        { path: '/public', component: () => <section data-testid="guard-route">public</section> },
        { path: '/login', component: () => <section data-testid="guard-route">login</section> },
        {
          path: '/secure',
          component: () => <section data-testid="guard-route">secure</section>,
          meta: { requiresAuth: true },
        },
        {
          path: '/blocked',
          component: () => <section data-testid="guard-route">blocked</section>,
          beforeEnter: blockedEnter,
        },
      ],
    })

    router.beforeEach(beforeEach)
    router.afterEach(afterEach)
    attachRouter(router)

    const container = mountContainer()
    render(<RouterView />, container)

    await flush()

    expect(container.textContent).toContain('public')

    const secureResult = await router.push('/secure')

    expect(secureResult).toBeUndefined()
    expect(history.pushes).toEqual(['/login'])
    expect(router.route.get()?.path).toBe('/login')
    expect(beforeEach.mock.calls.map(args => args[0]?.path)).toEqual(['/secure', '/login'])
    expect(afterEach).toHaveBeenCalledTimes(1)
    expect(afterEach.mock.calls[0][0]?.path).toBe('/login')
    expect(afterEach.mock.calls[0][1]?.path).toBe('/public')
    expect(afterEach.mock.calls[0][2]).toBeUndefined()

    const blockedFailure = await router.push('/blocked')

    expect(blockedEnter).toHaveBeenCalledTimes(1)
    expect(isNavigationFailure(blockedFailure, NavigationFailureType.aborted)).toBe(true)
    expect(history.pushes).toEqual(['/login'])
    expect(router.route.get()?.path).toBe('/login')
    expect(afterEach).toHaveBeenCalledTimes(2)
    expect(afterEach.mock.calls[1][0]?.path).toBe('/blocked')
    expect(afterEach.mock.calls[1][1]?.path).toBe('/login')
    expect(isNavigationFailure(afterEach.mock.calls[1][2], NavigationFailureType.aborted)).toBe(
      true,
    )
  })

  it('waits for async guards and returns aborted navigation failures', async () => {
    const gate = createDeferred<false>()
    const afterEach = vi.fn()
    const beforeEach = vi.fn(async (to: any) => {
      if (to?.path === '/protected') {
        return gate.promise
      }

      return undefined
    })

    const history = createMemoryHistory('/public')
    const router = createRouter({
      history,
      routes: [
        { path: '/public', component: () => <section>public</section> },
        { path: '/protected', component: () => <section>protected</section> },
      ],
    })

    router.beforeEach(beforeEach)
    router.afterEach(afterEach)
    attachRouter(router)

    const navigation = router.push('/protected')

    await flush()

    expect(history.pushes).toEqual([])
    expect(router.route.get()?.path).toBe('/public')

    gate.resolve(false)

    const failure = await navigation

    expect(isNavigationFailure(failure, NavigationFailureType.aborted)).toBe(true)
    expect(failure?.to?.path).toBe('/protected')
    expect(failure?.from?.path).toBe('/public')
    expect(router.route.get()?.path).toBe('/public')
    expect(afterEach).toHaveBeenCalledTimes(1)
    expect(isNavigationFailure(afterEach.mock.calls[0][2], NavigationFailureType.aborted)).toBe(
      true,
    )
  })

  it('returns cancelled and duplicated failures for async navigation races', async () => {
    const gate = createDeferred<void>()
    const afterEach = vi.fn()
    const beforeEach = vi.fn(async (to: any) => {
      if (to?.path === '/slow') {
        await gate.promise
      }

      return undefined
    })

    const history = createMemoryHistory('/public')
    const router = createRouter({
      history,
      routes: [
        { path: '/public', component: () => <section>public</section> },
        { path: '/slow', component: () => <section>slow</section> },
        { path: '/fast', component: () => <section>fast</section> },
      ],
    })

    router.beforeEach(beforeEach)
    router.afterEach(afterEach)
    attachRouter(router)

    const slowNavigation = router.push('/slow')

    await flush()

    expect(history.pushes).toEqual([])
    expect(router.route.get()?.path).toBe('/public')

    const fastResult = await router.push('/fast')

    expect(fastResult).toBeUndefined()
    expect(router.route.get()?.path).toBe('/fast')
    expect(history.pushes).toEqual(['/fast'])
    expect(afterEach).toHaveBeenCalledTimes(1)
    expect(afterEach.mock.calls[0][2]).toBeUndefined()

    gate.resolve()

    const slowFailure = await slowNavigation

    expect(isNavigationFailure(slowFailure, NavigationFailureType.cancelled)).toBe(true)
    expect(slowFailure?.to?.path).toBe('/slow')
    expect(slowFailure?.from?.path).toBe('/public')
    expect(router.route.get()?.path).toBe('/fast')
    expect(afterEach).toHaveBeenCalledTimes(2)
    expect(isNavigationFailure(afterEach.mock.calls[1][2], NavigationFailureType.cancelled)).toBe(
      true,
    )

    const duplicateFailure = await router.push('/fast')

    expect(isNavigationFailure(duplicateFailure, NavigationFailureType.duplicated)).toBe(true)
    expect(duplicateFailure?.to?.path).toBe('/fast')
    expect(duplicateFailure?.from?.path).toBe('/fast')
    expect(afterEach).toHaveBeenCalledTimes(3)
    expect(isNavigationFailure(afterEach.mock.calls[2][2], NavigationFailureType.duplicated)).toBe(
      true,
    )
  })

  it('rejects navigation when a global guard throws and passes the error to afterEach', async () => {
    const failure = new Error('global guard exploded')
    const afterEach = vi.fn()
    const beforeEach = vi.fn((to: any) => {
      if (to?.path === '/broken') {
        throw failure
      }

      return undefined
    })

    const history = createMemoryHistory('/public')
    const router = createRouter({
      history,
      routes: [
        { path: '/public', component: () => <section>public</section> },
        { path: '/broken', component: () => <section>broken</section> },
      ],
    })

    router.beforeEach(beforeEach)
    router.afterEach(afterEach)

    await expect(router.push('/broken')).rejects.toBe(failure)

    expect(history.pushes).toEqual([])
    expect(router.route.get()?.path).toBe('/public')
    expect(afterEach).toHaveBeenCalledTimes(1)
    expect(afterEach.mock.calls[0][0]?.path).toBe('/broken')
    expect(afterEach.mock.calls[0][1]?.path).toBe('/public')
    expect(afterEach.mock.calls[0][2]).toBe(failure)
  })

  it('rejects navigation when beforeEnter returns a rejected promise and passes the error to afterEach', async () => {
    const failure = new Error('beforeEnter rejected')
    const afterEach = vi.fn()
    const beforeEnter = vi.fn(async () => Promise.reject(failure))

    const history = createMemoryHistory('/public')
    const router = createRouter({
      history,
      routes: [
        { path: '/public', component: () => <section>public</section> },
        { path: '/broken', component: () => <section>broken</section>, beforeEnter },
      ],
    })

    router.afterEach(afterEach)

    await expect(router.push('/broken')).rejects.toBe(failure)

    expect(beforeEnter).toHaveBeenCalledTimes(1)
    expect(history.pushes).toEqual([])
    expect(router.route.get()?.path).toBe('/public')
    expect(afterEach).toHaveBeenCalledTimes(1)
    expect(afterEach.mock.calls[0][0]?.path).toBe('/broken')
    expect(afterEach.mock.calls[0][1]?.path).toBe('/public')
    expect(afterEach.mock.calls[0][2]).toBe(failure)
  })
})
