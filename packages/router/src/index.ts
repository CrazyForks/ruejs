/*
路由架构概述
- 历史驱动：通过 HistoryLike 抽象适配不同历史实现（支持 Web Hash / Web History）。
- 信号状态：currentPath/route 使用响应式 signal 保存当前路径与匹配结果。
- 路由匹配：编译 path 模式为正则与参数键列表，实现 params 提取。
- 容器绑定：每个应用容器绑定一个 Router，支持通过 attachRouter/useRouter 访问。
- 视图渲染：RouterView 在单锚点前渲染匹配到的组件；RouterLink 处理导航行为与 children 归一化。
*/
import {
  type FC,
  type BlockInstance,
  createContext,
  h,
  signal,
  getCurrentContainer,
  type RenderTarget,
  type SignalHandle,
  render,
  renderAnchor,
  untrack,
  useContext,
  vapor,
  watchEffect,
  useSetup,
} from '@rue-js/rue'

/** 路由静态记录：
 * - path：形如 '/users/:id(\\d+)' 的匹配模式（支持命名参数与可选正则）
 * - component：匹配成功时渲染的组件（接收 { params }）
 * - name：命名路由，可通过 router.push({ name, params }) 导航
 * - redirect：重定向目标，可用于默认子路由重定向
 * - children：子路由配置，路径会相对父级拼接
 * - meta：路由元信息，匹配后会按父 -> 子合并到当前 route.meta
 * - beforeEnter：路由独享守卫，返回 false 取消，返回 string 重定向
 */
type Awaitable<T> = T | Promise<T>
export type RouteMeta = Record<string, unknown>
export type RouteName = string
export type RouteParamValue = string | number | boolean | null | undefined
export type RouteParamsInput = Record<string, RouteParamValue>
export type PathRouteLocation = { path: string }
export type NamedRouteLocation = { name: RouteName; params?: RouteParamsInput }
export type RouteLocationRaw = string | PathRouteLocation | NamedRouteLocation
export type NavigationGuardResult = void | boolean | RouteLocationRaw
export type RouteRecordRedirect = RouteLocationRaw | ((to: Route) => RouteLocationRaw)
export const NavigationFailureType = {
  aborted: 'aborted',
  cancelled: 'cancelled',
  duplicated: 'duplicated',
} as const
export type NavigationFailureType =
  (typeof NavigationFailureType)[keyof typeof NavigationFailureType]
export type RouteRecord = {
  path: string
  name?: RouteName
  component?: FC<any>
  redirect?: RouteRecordRedirect
  children?: RouteRecord[]
  meta?: RouteMeta
  beforeEnter?: NavigationGuard
}
export type RouteRecordRaw = RouteRecord
/** 路由参数对象：命名参数的解码后字串映射 */
export type RouteParams = Record<string, string>
/** 当前路由匹配结果：
 * - record：命中的最深层路由记录
 * - matched：从父到子的命中链，供嵌套 RouterView 按层级渲染
 * - params：从路径中提取的参数
 * - meta：由 matched 链按顺序合并后的元信息
 * - path：当前匹配的原始路径
 * - 为 null 表示无匹配（RouterView 将清空渲染区域）
 */
export type Route = {
  record: RouteRecord
  name?: RouteName
  matched: RouteRecord[]
  params: RouteParams
  meta: RouteMeta
  path: string
} | null
export type NavigationFailure = {
  type: NavigationFailureType
  to: Route
  from: Route
}
export type NavigationGuard = (to: Route, from: Route) => Awaitable<NavigationGuardResult>
export type AfterEachFailure = NavigationFailure | Error
export type AfterEachGuard = (to: Route, from: Route, failure?: AfterEachFailure) => void
export const isNavigationFailure = (
  value: unknown,
  type?: NavigationFailureType,
): value is NavigationFailure => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const failure = value as Partial<NavigationFailure>
  const knownType = failure.type
  if (
    knownType !== NavigationFailureType.aborted &&
    knownType !== NavigationFailureType.cancelled &&
    knownType !== NavigationFailureType.duplicated
  ) {
    return false
  }

  return type ? knownType === type : true
}
/** Router 核心接口：
 * - currentPath：当前历史位置（字符串）信号
 * - route：当前匹配结果信号（Route 或 null）
 * - push/replace/back：导航 API，委托给历史实现
 * - beforeEach：注册全局前置守卫
 * - afterEach：注册全局后置守卫
 * - routes：注册的路由表（顺序即匹配优先级）
 * - history：历史实现（HistoryLike）
 * - install：把 Router 绑定到当前容器上下文
 */
export type Router = {
  currentPath: SignalHandle<string>
  route: SignalHandle<Route>
  push: (p: RouteLocationRaw) => Promise<NavigationFailure | undefined>
  replace: (p: RouteLocationRaw) => Promise<NavigationFailure | undefined>
  back: () => void
  beforeEach: (guard: NavigationGuard) => () => void
  afterEach: (guard: AfterEachGuard) => () => void
  routes: RouteRecord[]
  history: HistoryLike
  install: (app: unknown, options: unknown[]) => void
}

/** 历史实现抽象：
 * - location：返回当前位置的字符串（不含井号的路径）
 * - push/replace：更新位置并通知监听者
 * - listen：订阅位置变化（用于驱动信号）
 * - back：可选，后退一步（Web 环境委托给 window.history）
 */
export type HistoryLike = {
  location: () => string
  push: (p: string) => void
  replace: (p: string) => void
  listen: (cb: () => void) => void
  back?: () => void
  createHref?: (p: string) => string
}

const __routerByContainer = new WeakMap<HTMLElement, Router>()
const __routerResolvePathByInstance = new WeakMap<Router, (to: RouteLocationRaw) => string>()
let __activeRouter: Router | null = null
const RouterViewDepthContext = createContext(0)

type CompiledRouteRecord = Omit<RouteRecord, 'children'> & {
  children?: CompiledRouteRecord[]
  _fullPath: string
  _c: { re: RegExp; keys: string[] }
}

type RouteBranch = {
  record: CompiledRouteRecord
  matched: CompiledRouteRecord[]
}

type GuardDecision =
  | { kind: 'allow' }
  | { kind: 'abort' }
  | { kind: 'cancelled' }
  | { kind: 'error'; error: Error }
  | { kind: 'redirect'; path: string }

type NavigationResolution =
  | { kind: 'allow'; path: string; route: Route }
  | { kind: 'abort'; path: string; route: Route }
  | { kind: 'cancelled'; path: string; route: Route }
  | { kind: 'error'; path: string; route: Route; error: Error }

type PendingNavigation = {
  id: number
  path: string
  route: Route
  from: Route
  notify: boolean
  resolve?: (result: NavigationFailure | undefined) => void
}

const resolveRecordParams = (
  record: RouteRecord,
  params: RouteParams,
  previousRecord: RouteRecord | null,
  previousParams: RouteParams | null,
) => {
  const recordKeys = ((record as Partial<CompiledRouteRecord>)._c?.keys ?? []) as string[]

  if (!recordKeys.length) {
    if (previousRecord === record && previousParams && !Object.keys(previousParams).length) {
      return previousParams
    }
    return {} as RouteParams
  }

  let changed = previousRecord !== record || !previousParams
  const nextParams: RouteParams = {}

  recordKeys.forEach(key => {
    const value = params[key]
    if (value == null) {
      changed = changed || previousParams?.[key] != null
      return
    }

    nextParams[key] = value
    if (!changed && previousParams?.[key] !== value) {
      changed = true
    }
  })

  if (!changed && previousParams) {
    const previousKeys = Object.keys(previousParams)
    if (previousKeys.length !== recordKeys.length) {
      changed = true
    }
  }

  return !changed && previousParams ? previousParams : nextParams
}

const normalizeRoutePath = (path: string) => {
  const raw = String(path || '')
  if (!raw) return '/'

  const withoutHash = raw.startsWith('#') ? raw.replace(/^#/, '') : raw
  const withLeadingSlash = withoutHash.startsWith('/') ? withoutHash : `/${withoutHash}`
  const compact = withLeadingSlash.replace(/\/+/g, '/')

  if (compact === '/') {
    return compact
  }

  return compact.endsWith('/') ? compact.slice(0, -1) : compact
}

const joinRoutePath = (parentPath: string, path: string) => {
  if (!path) {
    return parentPath || '/'
  }

  if (path.startsWith('/')) {
    return normalizeRoutePath(path)
  }

  if (!parentPath || parentPath === '/') {
    return normalizeRoutePath(`/${path}`)
  }

  return normalizeRoutePath(`${parentPath}/${path}`)
}

const isPathRouteLocation = (value: unknown): value is PathRouteLocation => {
  return !!value && typeof value === 'object' && 'path' in (value as Record<string, unknown>)
}

const isNamedRouteLocation = (value: unknown): value is NamedRouteLocation => {
  return !!value && typeof value === 'object' && 'name' in (value as Record<string, unknown>)
}

const toNavigationError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error
  }

  return new Error(String(error))
}

/** 将 Router 绑定到当前容器并设置为活动路由 */
export const attachRouter = (router: Router) => {
  const c = getCurrentContainer() as HTMLElement | null
  if (c) __routerByContainer.set(c, router)
  __activeRouter = router
}

/** 创建基于 hash 的 Web 历史实现 */
export const createWebHashHistory = () => {
  const g = globalThis as any
  const normalize = (path: string) => {
    const next = String(path || '')
    if (!next) return '/'
    if (next.startsWith('/')) return next
    if (next.startsWith('#/')) return next.slice(1)
    if (next.startsWith('#')) return '/' + next.slice(1)
    return '/' + next
  }
  if (g && g.location) {
    // 没有 hash 时，默认跳到根路径 '/'
    if (!g.location.hash) g.location.hash = '#/'
  }
  // 规范化 location：取 hash 去掉 '#'，空串回退到 '/'
  const loc = () => {
    const s = g && g.location && g.location.hash ? String(g.location.hash).replace(/^#/, '') : ''
    return s || '/'
  }
  // 注册 hashchange 事件监听（浏览器环境）
  const listen = (cb: () => void) => {
    if (g && g.addEventListener) g.addEventListener('hashchange', cb)
  }
  return {
    location: loc,
    push: (p: string) => {
      const next = normalize(p)
      if (next === loc()) return
      if (g && g.location) {
        // 兼容传入 '#/path' 或 '/path' 两种形式
        g.location.hash = next
      }
      if (g && g.dispatchEvent && g.HashChangeEvent) {
        // 主动触发事件，确保响应式链路立刻更新
        g.dispatchEvent(new g.HashChangeEvent('hashchange'))
      }
    },
    replace: (p: string) => {
      const next = normalize(p)
      if (next === loc()) return
      const href = '#' + next
      if (g && g.location && typeof g.location.replace === 'function') {
        // 使用 location.replace 避免新增历史栈记录
        g.location.replace(href)
      }
      if (g && g.dispatchEvent && g.HashChangeEvent) {
        g.dispatchEvent(new g.HashChangeEvent('hashchange'))
      }
    },
    listen,
    back: () => {
      // 优先使用原生历史回退
      if (g && g.history && typeof g.history.back === 'function') g.history.back()
    },
    createHref: (p: string) => '#' + normalize(p),
  } as HistoryLike
}

/** 创建基于 history API 的 Web 历史实现 */
export const createWebHistory = () => {
  const g = globalThis as any
  const normalize = (path: string) => {
    const next = String(path || '')
    if (!next) return '/'
    if (next.startsWith('/')) return next
    return '/' + next
  }
  const loc = () => {
    const pathname = g && g.location ? String(g.location.pathname || '') : ''
    return pathname || '/'
  }
  const listen = (cb: () => void) => {
    if (g && g.addEventListener) g.addEventListener('popstate', cb)
  }
  const notify = () => {
    if (g && g.dispatchEvent && g.PopStateEvent) {
      g.dispatchEvent(new g.PopStateEvent('popstate'))
    }
  }
  return {
    location: loc,
    push: (p: string) => {
      const next = normalize(p)
      if (next === loc()) return
      if (g && g.history && typeof g.history.pushState === 'function') {
        g.history.pushState(null, '', next)
      } else if (g && g.location) {
        g.location.pathname = next
      }
      notify()
    },
    replace: (p: string) => {
      const next = normalize(p)
      if (next === loc()) return
      if (g && g.history && typeof g.history.replaceState === 'function') {
        g.history.replaceState(null, '', next)
      } else if (g && g.location && typeof g.location.replace === 'function') {
        g.location.replace(next)
      }
      notify()
    },
    listen,
    back: () => {
      if (g && g.history && typeof g.history.back === 'function') g.history.back()
    },
    createHref: (p: string) => normalize(p),
  } as HistoryLike
}

/** 创建 Router
 * - 编译所有路由规则为正则与键列表
 * - 监听历史变化更新 currentPath 与 route
 * @param options {history, routes}
 * @returns Router 实例
 */
export const createRouter = (options: { history: HistoryLike; routes: RouteRecord[] }): Router => {
  /** 编译路径模式为正则与参数键 */
  const compilePath = (path: string) => {
    const keys: string[] = []
    const reStr =
      '^' +
      path.replace(/\/:([^/()]+)(?:\(([^)]+)\))?/g, (_m, name, pattern) => {
        // 累积命名参数键
        keys.push(name)
        // 若提供子模式，则使用该模式作为捕获组，否则匹配非 '/' 的片段
        const group = pattern ? `(${pattern})` : '([^/]+)'
        return `/${group}`
      }) +
      '$'
    // 生成完整正则与对应键列表
    return { re: new RegExp(reStr), keys }
  }

  const routeByName = new Map<RouteName, CompiledRouteRecord>()

  const normalizeParamsInput = (params?: RouteParamsInput): RouteParams => {
    const nextParams: RouteParams = {}

    if (!params) {
      return nextParams
    }

    Object.keys(params).forEach(key => {
      const value = params[key]
      if (value == null) {
        return
      }

      nextParams[key] = String(value)
    })

    return nextParams
  }

  const stringifyRoutePath = (path: string, params?: RouteParamsInput) => {
    const normalizedParams = normalizeParamsInput(params)

    return normalizeRoutePath(
      path.replace(/\/:([^/()]+)(?:\(([^)]+)\))?/g, (_m, name) => {
        const value = normalizedParams[name]
        if (value == null) {
          throw new Error(`Missing required param "${name}" for route path ${path}`)
        }

        return `/${encodeURIComponent(value)}`
      }),
    )
  }

  const resolveLocationPath = (to: RouteLocationRaw, inheritedParams?: RouteParamsInput) => {
    if (typeof to === 'string') {
      return normalizeRoutePath(to)
    }

    if (isPathRouteLocation(to)) {
      return normalizeRoutePath(to.path)
    }

    if (isNamedRouteLocation(to)) {
      const target = routeByName.get(to.name)
      if (!target) {
        throw new Error('No route matched name ' + to.name)
      }

      return stringifyRoutePath(target._fullPath, {
        ...normalizeParamsInput(inheritedParams),
        ...normalizeParamsInput(to.params),
      })
    }

    return normalizeRoutePath(String(to || ''))
  }

  const resolveRouteRedirect = (to: Route) => {
    if (!to) {
      return { kind: 'none' } as const
    }

    for (let i = to.matched.length - 1; i >= 0; i -= 1) {
      const redirect = to.matched[i].redirect
      if (!redirect) {
        continue
      }

      try {
        const target = typeof redirect === 'function' ? redirect(to) : redirect
        return { kind: 'redirect', path: resolveLocationPath(target, to.params) } as const
      } catch (error) {
        return { kind: 'error', error: toNavigationError(error) } as const
      }
    }

    return { kind: 'none' } as const
  }

  const compileRecords = (records: RouteRecord[], parentPath = ''): CompiledRouteRecord[] =>
    records.map(record => {
      const fullPath = joinRoutePath(parentPath, record.path)
      const children = record.children ? compileRecords(record.children, fullPath) : undefined

      const compiledRecord: CompiledRouteRecord = {
        ...record,
        children,
        _fullPath: fullPath,
        _c: compilePath(fullPath),
      }

      if (compiledRecord.name) {
        if (routeByName.has(compiledRecord.name)) {
          throw new Error('Duplicate route name ' + compiledRecord.name)
        }

        routeByName.set(compiledRecord.name, compiledRecord)
      }

      return compiledRecord
    })

  const collectBranches = (records: CompiledRouteRecord[]) => {
    const branches: RouteBranch[] = []

    const visit = (record: CompiledRouteRecord, matched: CompiledRouteRecord[]) => {
      const nextMatched = [...matched, record]

      if (record.children?.length) {
        record.children.forEach(child => visit(child, nextMatched))
      }

      branches.push({ record, matched: nextMatched })
    }

    records.forEach(record => visit(record, []))
    return branches
  }

  const compiled = compileRecords(options.routes)
  const branches = collectBranches(compiled)

  /** 匹配路径并提取参数 */
  const match = (path: string): Route => {
    const normalizedPath = normalizeRoutePath(path)

    for (let i = 0; i < branches.length; i++) {
      const branch = branches[i]
      const r = branch.record
      // 顺序匹配，命中即返回（后续规则不再检查）
      const m = r._c.re.exec(normalizedPath)
      if (m) {
        const params: RouteParams = {}
        // 将捕获组与命名键对应并解码
        r._c.keys.forEach((k: string, idx: number) => {
          params[k] = decodeURIComponent(m[idx + 1] || '')
        })

        const matched = branch.matched as RouteRecord[]
        const meta = matched.reduce<RouteMeta>((acc, record) => {
          if (record.meta) {
            Object.assign(acc, record.meta)
          }
          return acc
        }, {})

        return { record: r, name: r.name, matched, params, meta, path: normalizedPath }
      }
    }
    // 未命中返回 null（交由视图层决定如何处理）
    return null
  }

  const resolveInitialRoute = (
    rawPath: string,
    redirectDepth = 0,
  ): { path: string; route: Route } => {
    if (redirectDepth > 20) {
      throw new Error('Too many redirects while navigating to ' + rawPath)
    }

    const path = normalizeRoutePath(rawPath)
    const targetRoute = match(path)
    const redirect = resolveRouteRedirect(targetRoute)
    if (redirect.kind === 'redirect') {
      return resolveInitialRoute(redirect.path, redirectDepth + 1)
    }

    if (redirect.kind === 'error') {
      throw redirect.error
    }

    return { path, route: targetRoute }
  }

  const initialRouteState = resolveInitialRoute(options.history.location())

  // currentPath：受历史驱动的源信号；第三参 true 表示同步更新立即通知观察者
  const currentPath = signal(initialRouteState.path, {}, true)

  const beforeGuards: NavigationGuard[] = []
  const afterGuards: AfterEachGuard[] = []
  let pendingNavigation: PendingNavigation | null = null
  let navigationRequestId = 0

  const createNavigationFailure = (
    type: NavigationFailureType,
    to: Route,
    from: Route,
  ): NavigationFailure => ({ type, to, from })

  const runAfterGuards = (to: Route, from: Route, failure?: AfterEachFailure) => {
    for (let i = 0; i < afterGuards.length; i++) {
      afterGuards[i](to, from, failure)
    }
  }

  const isStaleNavigation = (requestId: number) => requestId !== navigationRequestId

  const resolveGuardDecision = (result: NavigationGuardResult, to: Route): GuardDecision => {
    if (result === false) {
      return { kind: 'abort' }
    }

    if (result === undefined || result === true) {
      return { kind: 'allow' }
    }

    try {
      return { kind: 'redirect', path: resolveLocationPath(result, to?.params) }
    } catch (error) {
      return { kind: 'error', error: toNavigationError(error) }
    }
  }

  const runBeforeGuards = async (
    to: Route,
    from: Route,
    requestId: number,
  ): Promise<GuardDecision> => {
    for (let i = 0; i < beforeGuards.length; i++) {
      let result: NavigationGuardResult
      try {
        result = await beforeGuards[i](to, from)
      } catch (error) {
        if (isStaleNavigation(requestId)) {
          return { kind: 'cancelled' }
        }

        return { kind: 'error', error: toNavigationError(error) }
      }

      if (isStaleNavigation(requestId)) {
        return { kind: 'cancelled' }
      }

      const decision = resolveGuardDecision(result, to)
      if (decision.kind !== 'allow') {
        return decision
      }
    }

    if (!to) {
      return { kind: 'allow' }
    }

    for (let i = 0; i < to.matched.length; i++) {
      const record = to.matched[i]
      if (!record.beforeEnter) {
        continue
      }

      let result: NavigationGuardResult
      try {
        result = await record.beforeEnter(to, from)
      } catch (error) {
        if (isStaleNavigation(requestId)) {
          return { kind: 'cancelled' }
        }

        return { kind: 'error', error: toNavigationError(error) }
      }

      if (isStaleNavigation(requestId)) {
        return { kind: 'cancelled' }
      }

      const decision = resolveGuardDecision(result, to)
      if (decision.kind !== 'allow') {
        return decision
      }
    }

    return { kind: 'allow' }
  }

  const resolveNavigation = (
    rawPath: RouteLocationRaw,
    from: Route,
    requestId: number,
    redirectDepth = 0,
  ): Promise<NavigationResolution> => {
    const execute = async (): Promise<NavigationResolution> => {
      if (redirectDepth > 20) {
        return {
          kind: 'error',
          path: typeof rawPath === 'string' ? normalizeRoutePath(rawPath) : currentPath.get(),
          route: from,
          error: new Error('Too many redirects while navigating to ' + String(rawPath)),
        }
      }

      let path: string
      try {
        path = resolveLocationPath(rawPath)
      } catch (error) {
        return {
          kind: 'error',
          path: currentPath.get(),
          route: null,
          error: toNavigationError(error),
        }
      }

      const targetRoute = match(path)
      const redirect = resolveRouteRedirect(targetRoute)
      if (redirect.kind === 'redirect') {
        return resolveNavigation(redirect.path, from, requestId, redirectDepth + 1)
      }

      if (redirect.kind === 'error') {
        return { kind: 'error', path, route: targetRoute, error: redirect.error }
      }

      const decision = await runBeforeGuards(targetRoute, from, requestId)

      if (decision.kind === 'redirect') {
        return resolveNavigation(decision.path, from, requestId, redirectDepth + 1)
      }

      if (decision.kind === 'abort') {
        return { kind: 'abort', path, route: targetRoute }
      }

      if (decision.kind === 'cancelled') {
        return { kind: 'cancelled', path, route: targetRoute }
      }

      if (decision.kind === 'error') {
        return { kind: 'error', path, route: targetRoute, error: decision.error }
      }

      return { kind: 'allow', path, route: targetRoute }
    }

    return execute()
  }

  const commitNavigation = (path: string, nextRoute: Route, from: Route) => {
    currentPath.set(path)
    route.set(nextRoute)
    runAfterGuards(nextRoute, from)
  }

  const settlePendingNavigation = () => {
    const nextPending = pendingNavigation
    if (!nextPending) {
      return false
    }

    const currentLocation = normalizeRoutePath(options.history.location())
    if (currentLocation !== nextPending.path) {
      return false
    }

    pendingNavigation = null

    if (nextPending.notify) {
      commitNavigation(nextPending.path, nextPending.route, nextPending.from)
    }

    nextPending.resolve?.(undefined)
    return true
  }

  const navigate = async (
    rawPath: RouteLocationRaw,
    method: 'push' | 'replace',
  ): Promise<NavigationFailure | undefined> => {
    const from = route.get()
    const requestId = ++navigationRequestId
    const resolution = await resolveNavigation(rawPath, from, requestId)

    if (resolution.kind === 'error') {
      runAfterGuards(resolution.route, from, resolution.error)
      throw resolution.error
    }

    if (resolution.kind === 'cancelled') {
      const failure = createNavigationFailure(
        NavigationFailureType.cancelled,
        resolution.route,
        from,
      )
      runAfterGuards(resolution.route, from, failure)
      return failure
    }

    if (resolution.kind === 'abort') {
      const failure = createNavigationFailure(NavigationFailureType.aborted, resolution.route, from)
      runAfterGuards(resolution.route, from, failure)
      return failure
    }

    if (resolution.path === currentPath.get()) {
      const failure = createNavigationFailure(
        NavigationFailureType.duplicated,
        resolution.route,
        from,
      )
      runAfterGuards(resolution.route, from, failure)
      return failure
    }

    return await new Promise<NavigationFailure | undefined>(resolve => {
      pendingNavigation = {
        id: requestId,
        path: resolution.path,
        route: resolution.route,
        from,
        notify: true,
        resolve,
      }

      options.history[method](resolution.path)
      settlePendingNavigation()
    })
  }

  // route：派生信号，保存当前路径对应的匹配结果
  const matchRoute = initialRouteState.route
  if (null === matchRoute) {
    throw new Error('No route matched path ' + currentPath.get())
  }
  const route = signal<Route>(matchRoute, {}, true)

  if (initialRouteState.path !== normalizeRoutePath(options.history.location())) {
    options.history.replace(initialRouteState.path)
  }

  // 监听历史变化同步信号
  options.history.listen(() => {
    void (async () => {
      const p = normalizeRoutePath(options.history.location())

      if (settlePendingNavigation()) {
        return
      }

      // 去重：避免重复设置导致无意义的通知
      if (p === currentPath.get()) {
        return
      }

      const from = route.get()
      const requestId = ++navigationRequestId
      const resolution = await resolveNavigation(p, from, requestId)

      if (resolution.kind === 'error') {
        runAfterGuards(resolution.route, from, resolution.error)

        if (!from) {
          return
        }

        pendingNavigation = {
          id: requestId,
          path: from.path,
          route: from,
          from,
          notify: false,
        }
        options.history.replace(from.path)
        settlePendingNavigation()
        return
      }

      if (resolution.kind === 'cancelled') {
        const failure = createNavigationFailure(
          NavigationFailureType.cancelled,
          resolution.route,
          from,
        )
        runAfterGuards(resolution.route, from, failure)
        return
      }

      if (resolution.kind === 'abort') {
        if (!from) {
          return
        }

        const failure = createNavigationFailure(
          NavigationFailureType.aborted,
          resolution.route,
          from,
        )
        runAfterGuards(resolution.route, from, failure)

        pendingNavigation = {
          id: requestId,
          path: from.path,
          route: from,
          from,
          notify: false,
        }
        options.history.replace(from.path)
        settlePendingNavigation()
        return
      }

      if (resolution.path !== p) {
        pendingNavigation = {
          id: requestId,
          path: resolution.path,
          route: resolution.route,
          from,
          notify: true,
        }
        options.history.replace(resolution.path)
        settlePendingNavigation()
        return
      }

      commitNavigation(resolution.path, resolution.route, from)
    })()
  })

  const router: Router = {
    currentPath,
    route,
    push: (p: RouteLocationRaw) => navigate(p, 'push'),
    replace: (p: RouteLocationRaw) => navigate(p, 'replace'),
    back: () => {
      // 优先使用 HistoryLike.back；否则退回到全局 history
      if (options.history.back) return options.history.back()
      const gg = globalThis as any
      if (gg.history && typeof gg.history.back === 'function') gg.history.back()
    },
    beforeEach: (guard: NavigationGuard) => {
      beforeGuards.push(guard)
      return () => {
        const idx = beforeGuards.indexOf(guard)
        if (idx >= 0) beforeGuards.splice(idx, 1)
      }
    },
    afterEach: (guard: AfterEachGuard) => {
      afterGuards.push(guard)
      return () => {
        const idx = afterGuards.indexOf(guard)
        if (idx >= 0) afterGuards.splice(idx, 1)
      }
    },
    routes: options.routes,
    history: options.history,
    /** 插件安装：绑定当前 Router 到容器上下文 */
    install: (_app: unknown, _options: unknown[]) => {
      // 将当前 Router 记录到容器映射，并设为活动路由
      attachRouter(router)
    },
  }

  __routerResolvePathByInstance.set(router, (to: RouteLocationRaw) => resolveLocationPath(to))

  return router
}

/** 获取当前上下文的 Router（优先容器绑定，其次活动路由） */
export const useRouter = (): Router => {
  const c = getCurrentContainer() as HTMLElement | null
  const r = (c ? __routerByContainer.get(c) || null : null) || __activeRouter
  if (!r) throw new Error('Router not installed for current application/container')
  return r
}

const insertNodeAtTarget = (target: RenderTarget, node: Node) => {
  switch (target.kind) {
    case 'container':
      ;(target.container as Node).appendChild(node)
      return
    case 'between':
      ;(target.parent as Node).insertBefore(node, target.end as Node)
      return
    case 'anchor':
    case 'static':
      ;(target.parent as Node).insertBefore(node, target.anchor as Node)
      return
  }
}

const createRouteComponentBlock = (
  component: RouteRecord['component'],
  params: RouteParams,
  nextDepth: number,
): BlockInstance => {
  let host: HTMLSpanElement | null = null

  return {
    kind: 'block',
    mount(target) {
      const routeHost = document.createElement('span')
      routeHost.style.display = 'contents'
      host = routeHost
      insertNodeAtTarget(target, routeHost)

      if (!component) {
        render(null as any, routeHost as any)
        return
      }

      render(
        h(
          RouterViewDepthContext.Provider as any,
          { value: nextDepth },
          h(component, { params }) as any,
        ) as any,
        routeHost as any,
      )
    },
    unmount() {
      if (!host) {
        return
      }

      render(null as any, host as any)

      const parent = host.parentNode
      if (parent) {
        parent.removeChild(host)
      }

      host = null
    },
  }
}

/** RouterView：根据当前上下文深度，在单个尾锚点前渲染匹配链上的对应组件 */
export const RouterView: FC = () => {
  const depth = useContext(RouterViewDepthContext)

  const { container } = useSetup(() => {
    const r = useRouter()
    const container = document.createElement('span')
    container.style.display = 'contents'
    const anchorEl = document.createComment('rue-router-view-anchor')
    container.appendChild(anchorEl)
    let previousRecord: RouteRecord | null = null
    let previousParams: RouteParams | null = null

    watchEffect(() => {
      const data = r.route.get()
      const record = data?.matched?.[depth] || null
      const parent = (anchorEl as any).parentNode || container

      untrack(() => {
        if (!record || !data || !record.component) {
          previousRecord = null
          previousParams = null
          renderAnchor(null as any, parent, anchorEl)
          return
        }

        const recordParams = resolveRecordParams(
          record,
          data.params,
          previousRecord,
          previousParams,
        )
        if (previousRecord === record && previousParams === recordParams) {
          return
        }
        previousRecord = record
        previousParams = recordParams

        renderAnchor(
          createRouteComponentBlock(record.component, recordParams, depth + 1) as any,
          parent,
          anchorEl,
        )
      })
    })

    return { container }
  })

  return vapor(() => container)
}

type RouterLinkProps = { to: RouteLocationRaw; replace?: boolean } & Record<string, unknown>

type RouterLinkFastPath = FC<RouterLinkProps> & {
  __rueHref: (to: unknown) => string
  __rueOnClick: (e: MouseEvent, to: unknown, replace?: unknown) => void
}

const resolveRouterLocationPath = (router: Router | null, to: unknown) => {
  if (!router) {
    if (typeof to === 'string') {
      return normalizeRoutePath(to)
    }

    if (isPathRouteLocation(to)) {
      return normalizeRoutePath(to.path)
    }

    throw new Error('Router not installed for current application/container')
  }

  const resolvePath = __routerResolvePathByInstance.get(router)
  if (!resolvePath) {
    throw new Error('Router path resolver not available for current application/container')
  }

  return resolvePath(to as RouteLocationRaw)
}

const routerLinkHref = (to: unknown) => {
  const path = resolveRouterLocationPath(__activeRouter, to)
  const createHref = __activeRouter?.history?.createHref
  return createHref ? createHref(path) : path || '/'
}

const routerLinkNavigate = (to: unknown, replace?: unknown) => {
  const router = __activeRouter
  if (!router) throw new Error('Router not installed for current application/container')

  const target = to as RouteLocationRaw
  const nav = replace ? router.replace : router.push
  void nav(target)
}

const routerLinkOnClick = (e: MouseEvent, to: unknown, replace?: unknown) => {
  if (
    (e as any).defaultPrevented ||
    e.button !== 0 ||
    e.metaKey ||
    e.ctrlKey ||
    e.shiftKey ||
    e.altKey
  ) {
    return
  }
  e.preventDefault()
  routerLinkNavigate(to, replace)
}

/** RouterLink：渲染链接并处理导航 */
const RouterLinkImpl: FC<RouterLinkProps> = props => {
  const r = useRouter()
  const to = (props as any).to as RouteLocationRaw
  const replace = !!(props as any).replace
  const { children, to: _to, replace: _replace, ...rest } = props as any

  const click = (e: MouseEvent) => {
    if (
      (e as any).defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return
    }
    e.preventDefault()
    const nav = replace ? r.replace : r.push
    void nav(to)
  }

  const childList = Array.isArray(children)
    ? (children as any[])
    : children != null
      ? [children]
      : []

  return h('a', { href: routerLinkHref(to), onClick: click, ...rest }, ...childList)
}

export const RouterLink = Object.assign(RouterLinkImpl, {
  __rueHref: routerLinkHref,
  __rueOnClick: routerLinkOnClick,
}) as RouterLinkFastPath

/** 获取当前路由信号 */
export const useRoute = () => {
  const c = getCurrentContainer() as HTMLElement | null
  const r = (c ? __routerByContainer.get(c) || null : null) || __activeRouter
  if (!r) throw new Error('Router not installed for current application/container')

  return r.route
}
