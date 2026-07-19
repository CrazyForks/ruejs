# 路由

Rue 提供 `@rue-js/router` 作为官方路由方案，默认使用 Hash 模式，支持命名参数、子路由、命名路由、重定向与导航守卫。

可交互示例：访问 [路由 Demo](/examples/router-demo/guide/router/overview)，可以直接体验嵌套路由、命名路由、`replace` 和 `beforeEnter` 守卫。

- 创建并安装 Router
- 定义路由与参数匹配
- 在视图中渲染与导航
- 使用运行时 API 获取当前路由

```tsx
import { type FC, useApp } from '@rue-js/rue'
import { createRouter, createWebHashHistory, RouterView, RouterLink } from '@rue-js/router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/docs/:id(\\d+)', component: DocDetail, persist: true }, // 命名参数 + 状态保持
  ],
  viewTransitions: true,
})

const RootApp: FC = () => (
  <div>
    <nav className="space-x-2">
      <RouterLink to="/">首页</RouterLink>
      <RouterLink to="/docs/123">文档 123</RouterLink>
    </nav>
    <RouterView />
  </div>
)

useApp(RootApp).use(router).mount('#app')
```

## 历史模式

- `createWebHashHistory()`：基于 `location.hash` 的浏览器历史实现。无 `#` 时会自动跳转到 `#/`，并标准化位置字符串。
- `push('/path')` 与 `replace('/path')` 会更新 `hash`，并向 Router 同步标记 `push` / `replace` 来源；浏览器回退与前进标记为 `pop`。
- `router.push()` 与 `router.replace()` 返回 Promise；成功时结果为 `undefined`，被取消、竞争掉或重复导航时会返回导航失败对象。

## 路由记录与参数匹配

- 路由记录类型：`{ path, name?, component?, redirect?, children?, meta?, beforeEnter?, persist?, persistKey? }`
- 路径可包含命名参数与可选正则：`/users/:id(\\d+)`、`/docs/:slug`
- 匹配时会将捕获到的参数解码并传递给组件的 `props.params`

示例：

```tsx
const routes = [
  { path: '/users/:id(\\d+)', component: UserDetail },
  { path: '/docs/:slug', component: DocDetail },
]

const UserDetail: FC<{ params: { id: string } }> = ({ params }) => <div>用户编号：{params.id}</div>
```

## 命名路由与重定向

- 为路由记录声明 `name` 后，可通过 `router.push({ name, params })` 或 `RouterLink` 对象导航
- `redirect` 适合做默认子路由跳转，支持字符串路径、`{ path }`、`{ name, params }` 或函数返回这些对象
- 默认子路由常见写法是 `path: ''`

示例：

```tsx
const routes = [
  {
    path: '/guide/:section',
    component: GuideLayout,
    children: [
      { path: '', redirect: { name: 'guide-overview' } },
      { path: 'overview', name: 'guide-overview', component: GuideOverview },
      { path: ':topic', name: 'guide-topic', component: GuideTopic },
    ],
  },
]

await router.push({ name: 'guide-topic', params: { section: 'router', topic: 'guards' } })
```

## 嵌套路由

- 子路由通过 `children` 定义，子路径默认相对父级路径拼接
- 父组件中的 `RouterView` 会继续渲染下一层命中的子路由
- 当前 `route.matched` 会包含从父到子的完整命中链

示例：

```tsx
import { type FC } from '@rue-js/rue'
import { RouterView } from '@rue-js/router'

const GuideLayout: FC<{ params: { section: string } }> = props => (
  <section>
    <h1>栏目：{props.params.section}</h1>
    <RouterView />
  </section>
)

const GuideTopic: FC<{ params: { section: string; topic: string } }> = props => (
  <article>
    主题：{props.params.section}/{props.params.topic}
  </article>
)

const routes = [
  {
    path: '/guide/:section',
    component: GuideLayout,
    children: [{ path: ':topic', component: GuideTopic }],
  },
]
```

## 视图渲染：RouterView

- `RouterView` 会在固定的锚点区间内渲染当前匹配层级的组件
- 当无匹配时清空渲染区间；相同组件连续命中时避免重复渲染
- 匹配到的组件会收到 `{ params }` 作为 props

示例：

```tsx
const App: FC = () => (
  <main>
    <RouterView />
  </main>
)
```

## 链接导航：RouterLink

- `RouterLink` 渲染为 `<a>` 元素，默认拦截左键点击并执行导航
- `to` 可传路径字符串，或 `{ path }`、`{ name, params }` 形式的对象；`replace` 为 `true` 时使用替换而非新增历史记录
- 其他传入的属性会透传给渲染的 `<a>`（例如 `className`）
- 默认在 hover / focus 时预取命中路由的懒组件；`prefetch` 可设为 `false | 'hover' | 'tap' | 'viewport' | 'load'`
- Data Saver、2g 或 slow-2g 下，hover / viewport / load 会自动降级为 tap，避免浪费带宽

示例：

```tsx
<RouterLink to="/posts/42" className="btn">查看文章</RouterLink>
<RouterLink to={{ name: 'guide-topic', params: { section: 'router', topic: 'guards' } }}>
  守卫章节
</RouterLink>
<RouterLink to="/settings" replace>返回设置</RouterLink>
<RouterLink to="/reports" prefetch="viewport">报表</RouterLink>
```

## 运行时 API

- `useRouter()`：获取当前上下文的 Router（容器优先，其次为活动路由）
- `useRoute()`：获取当前路由匹配结果的信号（`SignalHandle<Route>`）
- `router.prefetch(to)`：只解析目标并加载 matched 懒组件，不运行守卫、不写 history、不提交导航

示例：

```tsx
import { useRoute } from '@rue-js/router'

const Current: FC = () => {
  const route = useRoute()
  return <div>当前路径：{route.get()?.path}</div>
}
```

## 导航生命周期与可访问性

Router 会在 `document` 上发出稳定的 DOM 事件：

- `rue:before-navigation`：守卫与懒组件准备之前
- `rue:after-navigation`：成功提交后，或失败结束时；失败细节在 `event.detail.failure`
- `rue:page-load`：新 RouterView DOM 刷新、滚动处理和播报完成后

detail 包含 `{ to, from, type, failure? }`，其中 `type` 为 `push | replace | pop`。成功导航会更新隐藏的 `aria-live="assertive"` route announcer；只有当用户没有聚焦交互元素时，Router 才会聚焦新的 `main` 区域。

## 滚动恢复

默认情况下，新 push / replace 导航回到顶部，pop 导航恢复之前保存的位置，URL hash 优先定位到解码后的 `id` 或 `name` 元素。可用 `scrollBehavior` 覆盖：

```tsx
const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to?.meta.preserveScroll) return false
    return { left: 0, top: 0 }
  },
})
```

回调可返回 `false`、`{ left, top, behavior? }`、CSS 选择器、DOM 元素或 Promise。

## 视图过渡

`viewTransitions` 默认关闭。启用后，Router 只把通过守卫且完成懒加载的成功提交放入 `document.startViewTransition()` 回调。不支持 API、API 抛错或用户启用 reduced motion 时会直接提交。

```tsx
createRouter({
  history: createWebHistory(),
  routes,
  viewTransitions: true,
  // 如确有特殊需求，可覆盖默认的 reduced-motion 保护：
  // viewTransitions: { skipWhenReducedMotion: false },
})
```

## 路由状态保持

为路由记录声明 `persist: true` 后，RouterView 会通过 KeepAlive 保留该页面的组件实例与 DOM 区间。返回时本地 state 不会重置，但新的 route params 会更新到原实例。

```tsx
const routes = [
  { path: '/editor/:id', component: EditorPage, persist: true },
  { path: '/preview/:id', component: PreviewPage, persist: true, persistKey: 'preview' },
]
```

`persistKey` 用于显式稳定缓存身份；默认使用编译后的完整路由路径。普通嵌套布局在 child route 切换时本就不会重挂载，不必额外标记 `persist`。

## 导航守卫

- `router.beforeEach()`：注册全局前置守卫
- `route.beforeEnter`：注册路由独享守卫
- `router.afterEach()`：注册导航结束后的后置钩子，第三个参数会拿到失败结果或错误对象
- 守卫可返回同步值或 Promise
- 守卫返回 `false` 会取消导航；返回字符串或 location 对象会重定向到新地址
- 可通过 `isNavigationFailure()` 与 `NavigationFailureType` 判断 `push/replace` 的失败结果
- 守卫直接 `throw` 或返回 rejected Promise 时，`push/replace` 会 reject，同一次导航的 `afterEach` 会收到该错误对象

示例：

```tsx
import {
  createRouter,
  createWebHashHistory,
  isNavigationFailure,
  NavigationFailureType,
} from '@rue-js/router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/login', component: LoginPage },
    {
      path: '/admin',
      component: AdminPage,
      meta: { requiresAuth: true },
      beforeEnter: to => {
        if (to?.meta.requiresAuth && !hasAdminRole()) {
          return '/login'
        }
      },
    },
  ],
})

router.beforeEach(to => {
  if (to?.meta.requiresAuth && !isAuthenticated()) {
    return { name: 'login' }
  }
})

router.afterEach((to, from, failure) => {
  console.log('navigated:', from?.path, '->', to?.path, failure)
})

const result = await router.push('/admin')

if (isNavigationFailure(result, NavigationFailureType.aborted)) {
  console.log('navigation aborted')
}
```

## 在应用中使用

- 在应用入口创建并挂载，安装路由作为插件

示例应用入口：

```tsx
import { type FC, useApp } from '@rue-js/rue'
import { RouterView } from '@rue-js/router'
import router from './router'
import SiteLayout from './pages/site/components/Layout'

const RootApp: FC = () => (
  <SiteLayout>
    <RouterView />
  </SiteLayout>
)

useApp(RootApp).use(router).mount('#app')
```

## 最佳实践

- 路由优先级按定义顺序匹配，通用规则放在靠后位置
- 对需要约束格式的参数使用正则（如 `/orders/:id(\\d+)`）
- 使用 `replace` 避免在设置类页面产生过多历史栈记录
- 在组件中通过 `props.params` 读取参数，避免自行解析路径
