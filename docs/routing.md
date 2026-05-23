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
    { path: '/docs/:id(\\d+)', component: DocDetail }, // 命名参数 + 正则
  ],
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
- `push('/path')` 与 `replace('/path')` 会更新 `hash`，并主动触发 `hashchange` 事件，确保响应式状态立即同步。
- `router.push()` 与 `router.replace()` 返回 Promise；成功时结果为 `undefined`，被取消、竞争掉或重复导航时会返回导航失败对象。

## 路由记录与参数匹配

- 路由记录类型：`{ path, name?, component?, redirect?, children?, meta?, beforeEnter? }`
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

示例：

```tsx
<RouterLink to="/posts/42" className="btn">查看文章</RouterLink>
<RouterLink to={{ name: 'guide-topic', params: { section: 'router', topic: 'guards' } }}>
  守卫章节
</RouterLink>
<RouterLink to="/settings" replace>返回设置</RouterLink>
```

## 运行时 API

- `useRouter()`：获取当前上下文的 Router（容器优先，其次为活动路由）
- `useRoute()`：获取当前路由匹配结果的信号（`SignalHandle<Route>`）

示例：

```tsx
import { useRoute } from '@rue-js/router'

const Current: FC = () => {
  const route = useRoute()
  return <div>当前路径：{route.get()?.path}</div>
}
```

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
