# 创建 Rue 应用 {#creating-a-rue-application}

## 应用实例 {#the-application-instance}

每个 Rue 应用都通过 [`useApp`](/api/api/application#useapp) 函数创建一个新的**应用实例**：

```tsx
import { type FC, useApp } from '@rue-js/rue'

const App: FC = () => {
  return <div>Hello Rue!</div>
}

const app = useApp(App)
```

## 根组件 {#the-root-component}

传递给 `useApp` 的 `App` 是根组件。每个应用都需要一个"根组件"，它可以包含其他组件作为其子组件。

如果应用使用 JSX/TSX，我们通常从另一个文件导入根组件：

```tsx
import { useApp } from '@rue-js/rue'
import App from './App'

const app = useApp(App)
```

虽然本指南中的许多示例只需要单个组件，但大多数真实应用都是由嵌套的可重用组件组成的树。例如，一个待办事项应用的组件树可能如下所示：

```
App (根组件)
├─ TodoList
│  └─ TodoItem
│     ├─ TodoDeleteButton
│     └─ TodoEditButton
└─ TodoFooter
   ├─ TodoClearButton
   └─ TodoStatistics
```

在本指南的后续部分中，我们将讨论如何定义和组合多个组件。在此之前，我们将专注于单个组件内部的内容。

## 挂载应用 {#mounting-the-app}

应用实例在调用 `.mount()` 方法之前不会渲染任何内容。它需要一个"容器"参数，可以是实际的 DOM 元素或选择器字符串：

```html
<div id="app"></div>
```

```tsx
app.mount('#app')
```

应用的根组件内容将渲染在容器元素内部。容器元素本身不被视为应用的一部分。

`.mount()` 方法应在所有应用配置和资源注册完成后调用。与资源注册方法不同，`.mount()` 返回 `void`，不返回应用实例或根组件实例。

同一个应用实例重复挂载到同一个容器时，Rue 会将后续调用视为幂等操作，不会重新渲染或重复触发生命周期。应用挂载后会独占该容器；如果要将应用迁移到其他容器，或让另一个应用使用当前容器，请先调用 `.unmount()`。重复调用 `.unmount()` 同样是安全的幂等操作。

## 应用配置 {#app-configurations}

通过 `onError` 订阅 Rue 运行时错误。浏览器错误桥接、控制台报告和开发遮罩可分别安装，它们共享 Rue 错误链，不局限于单个应用实例：

```tsx
import { installBrowserErrorBridge, installErrorConsole, installDevErrorOverlay } from '@rue-js/rue'

const stopBridge = installBrowserErrorBridge()
const stopConsole = installErrorConsole()
const stopOverlay =
  import.meta.env.DEV && !import.meta.env.SSR ? installDevErrorOverlay() : undefined

// 在宿主页面销毁或热更新卸载时调用
function disposeErrorHandling() {
  stopOverlay?.()
  stopConsole()
  stopBridge()
}
```

每个安装函数都返回幂等清理函数；浏览器桥接重复安装时共享监听器，最后一个引用释放后才移除监听器。遮罩清理时也会移除现有遮罩。错误上报订阅使用 `onError`。

应用实例还提供了一些用于注册应用范围资源的方法。例如，注册一个插件：

```tsx
import { useApp } from '@rue-js/rue'
import router from './router'

const rustPlugin = createPlugin()

useApp(App).use(router).mount('#app')
```

这使得 `router` 和 `rustPlugin` 可以在我们的整个应用中使用。我们将在本指南的后续部分讨论组件和其他类型资源的注册。你还可以在其 [API 参考](/api/api/application) 中浏览应用实例 API 的完整列表。

确保在挂载应用之前应用所有应用配置！

## 多个应用实例 {#multiple-application-instances}

在同一页面上不限于单个应用实例。`useApp` API 允许多个 Rue 应用在同一页面上共存，每个都有自己的配置和全局资源范围：

```tsx
const app1 = useApp(App1)
app1.mount('#container-1')

const app2 = useApp(App2)
app2.mount('#container-2')
```

如果你使用 Rue 来增强服务器渲染的 HTML，并且只需要 Rue 控制大页面的特定部分，请避免在整个页面上挂载单个 Rue 应用实例。相反，创建多个小型应用实例，并将它们挂载在它们负责的各个元素上。

## 快速开始示例 {#quick-start-example}

以下是一个完整的 Rue 应用示例：

```tsx
// main.tsx
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

// 根组件
const App: FC = () => {
  return (
    <div className="app">
      <header>
        <h1>我的 Rue 应用</h1>
      </header>
      <main>
        <RouterView />
      </main>
    </div>
  )
}

// 创建并挂载应用
useApp(App).use(router).mount('#app')
```

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>Rue App</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```
