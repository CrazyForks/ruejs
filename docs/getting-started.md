# 快速上手

初始化一个 Rue 项目并创建页面：

```bash
pnpm create vite@latest my-app -- --template vanilla
cd my-app
pnpm add @rue-js/rue @rue-js/router
```

在 `app.tsx` 中创建应用：

```tsx
import {
  type FC,
  useApp,
  installBrowserErrorBridge,
  installErrorConsole,
  installDevErrorOverlay,
} from '@rue-js/rue'
import { RouterView } from '@rue-js/router'
import router from './router'

// 接入浏览器错误并启用控制台报告，仅在开发环境显示遮罩
installBrowserErrorBridge()
installErrorConsole()
if (import.meta.env.DEV && !import.meta.env.SSR) {
  installDevErrorOverlay()
}

const App: FC = () => {
  return (
    <div>
      <h1>我的 Rue 应用</h1>
      <RouterView />
    </div>
  )
}

// 创建并挂载应用
useApp(App).use(router).mount('#app')
```

在 `router/index.ts` 中配置路由：

```ts
import { createRouter } from '@rue-js/router'
import Home from '../pages/Home'
import About from '../pages/About'

export default createRouter({
  history: 'hash',
  routes: [
    { path: '/', component: Home },
    { path: '/about', component: About },
  ],
})
```
