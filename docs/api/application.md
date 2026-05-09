# 应用 API {#application-api}

## useApp() {#useapp}

创建一个应用实例。

Rue 当前公开的应用创建入口是 `useApp()`。如果你熟悉 Vue 的 `createApp()`，可以把它理解为 Rue 中对应的应用创建 API。

- **类型**

  ```ts
  function useApp(
    AppOrOptions:
      | ComponentInstance
      | {
          setup?: () => any
          render?: (ctx: any) => RenderableOutput
        },
    runtime?: Rue,
  ): App
  ```

- **详情**

  第一个参数可以是根组件，也可以是一个包含 `setup` 与 `render` 的轻量配置对象。第二个参数可选，用于传入自定义 Rue 运行时实例。

  `useApp()` 返回的应用实例目前提供以下方法：
  - `app.use()`：安装插件
  - `app.component()`：注册运行时全局组件
  - `app.mount()`：挂载应用
  - `app.unmount()`：卸载应用

- **示例**

  使用导入的根组件：

  ```tsx
  import { useApp } from '@rue-js/rue'
  import App from './App'

  const app = useApp(App)
  ```

  使用内联根组件：

  ```tsx
  import { type FC, useApp } from '@rue-js/rue'

  const App: FC = () => {
    return <div>Hello Rue</div>
  }

  const app = useApp(App)
  ```

  使用 `setup + render` 选项对象：

  ```tsx
  import { useApp } from '@rue-js/rue'

  const app = useApp({
    setup() {
      return { message: 'Hello Rue' }
    },
    render(ctx) {
      return <div>{ctx.message}</div>
    },
  })
  ```

- **参阅** [指南 - 创建一个 Rue 应用](/guide/essentials/application)

## app.mount() {#app-mount}

将应用实例挂载到容器元素中。

- **类型**

  ```ts
  interface App {
    mount(rootContainer: Element | string): void
  }
  ```

- **详情**

  参数可以是一个实际的 DOM 元素或一个 CSS 选择器字符串。

  当传入选择器时，Rue 会使用第一个匹配到的元素作为容器；如果找不到匹配元素，则不会执行挂载。

  挂载时会清空容器的文本内容，然后把根组件渲染到容器中，并在元素容器上追加 `data-rue-app` 属性，便于调试和定位。

  `mount()` 当前不返回根组件实例。

- **示例**

  ```tsx
  import { useApp } from '@rue-js/rue'
  import App from './App'

  useApp(App).mount('#app')
  ```

  也可以挂载到实际的 DOM 元素：

  ```tsx
  const container = document.getElementById('app')

  if (container) {
    useApp(App).mount(container)
  }
  ```

## app.unmount() {#app-unmount}

卸载已挂载的应用实例。

- **类型**

  ```ts
  interface App {
    unmount(): void
  }
  ```

- **详情**

  `unmount()` 会从上一次 `mount()` 使用的容器中卸载应用，并清除应用内部保存的容器引用。

- **示例**

  ```tsx
  import { useApp } from '@rue-js/rue'
  import App from './App'

  const app = useApp(App)

  app.mount('#app')
  app.unmount()
  ```

## app.use() {#app-use}

安装一个插件。

- **类型**

  ```ts
  interface App {
    use(plugin: Plugin, ...options: any[]): this
  }
  ```

- **详情**

  `app.use()` 会把插件透传给当前运行时的插件系统，并返回应用实例本身，因此可以链式调用。

  这也是安装路由等应用级能力的标准方式。

- **示例**

  ```tsx
  import { useApp } from '@rue-js/rue'
  import router from './router'
  import App from './App'

  useApp(App).use(router).mount('#app')
  ```

## app.component() {#app-component}

注册运行时全局组件。

- **类型**

  ```ts
  interface App {
    component(name: string, component: ComponentInstance): this
  }
  ```

- **详情**

  `app.component()` 当前用于注册运行时组件名，使组件能够通过名称在运行时解析，例如用于 `<component is="Foo" />` 一类的动态组件场景。

  与 Vue 风格的 `app.component(name)` 读取模式不同，Rue 当前只支持注册，不提供同名查询重载。

- **示例**

  ```tsx
  import { useApp } from '@rue-js/rue'
  import App from './App'
  import CardView from './CardView'

  useApp(App).component('CardView', CardView).mount('#app')
  ```
