# 全局 API：通用 {#global-api-general}

## version {#version} @todo

暴露当前版本的 Rue。

- **类型：** `string`

- **示例**

  ```js
  import { version } from '@rue-js/rue'

  console.log(version)
  ```

## nextTick() {#nexttick} @todo

等待下一次 DOM 更新刷新的工具。

- **类型**

  ```ts
  function nextTick(callback?: () => void): Promise<void>
  ```

- **详情**

  当你在 Vue 中更改响应式状态时，产生的 DOM 更新不会同步应用。相反，Vue 会将它们缓冲到"下一 tick"，以确保每个组件只更新一次，无论你做了多少状态更改。

  `nextTick()` 可以在状态更改后立即使用，以等待 DOM 更新完成。你可以传递一个回调作为参数，或等待返回的 Promise。

- **示例**

  <div class="composition-api">

  ```js
  import { ref, nextTick } from '@rue-js/rue'

  const count = ref(0)

  async function increment() {
    count.value++

    // DOM 尚未更新
    console.log(document.getElementById('counter').textContent) // 0

    await nextTick()
    // DOM 现在已更新
    console.log(document.getElementById('counter').textContent) // 1
  }
  ```

  </div>
  <div class="options-api">

  ```js
  import { nextTick } from '@rue-js/rue'

  export default {
    data() {
      return {
        count: 0,
      }
    },
    methods: {
      async increment() {
        this.count++

        // DOM 尚未更新
        console.log(document.getElementById('counter').textContent) // 0

        await nextTick()
        // DOM 现在已更新
        console.log(document.getElementById('counter').textContent) // 1
      },
    },
  }
  ```

  </div>

- **另请参阅** [`this.$nextTick()`](/api/component-instance#nexttick)

## useComponent() {#usecomponent}

定义一个仅在渲染时延迟加载的异步组件。参数既可以是加载函数，也可以是包含 `loader` 的选项对象。

- **类型**

  ```ts
  function useComponent(loader: AsyncComponentLoader, options?: UseComponentOptions): Component
  function useComponent(options: AsyncComponentOptions): Component

  type AsyncComponentLoader = () => Promise<{ default: Component } | Component>

  interface UseComponentOptions {
    loading?: Component
    error?: Component
    loadingComponent?: Component
    errorComponent?: Component
    delay?: number
    timeout?: number
    suspensible?: boolean
    onError?: (error: Error, retry: () => void, fail: () => void, attempts: number) => any
  }

  interface AsyncComponentOptions extends UseComponentOptions {
    loader: AsyncComponentLoader
  }
  ```

- **详情**

  `useComponent()` 返回一个包装组件。它只会在实际渲染时触发 `loader`，并接受两种成功返回值：

  1. 组件本身
  2. 形如 `{ default: Component }` 的 ES 模块对象

  当前实现的行为如下：

  - `loadingComponent` 只有在异步加载仍未完成时才会渲染。
  - 旧写法中的 `loading` / `error` 仍然可用，分别对应 `loadingComponent` / `errorComponent`。
  - 如果提供了 `loadingComponent` 但没有显式传入 `delay`，默认会等待 `200ms` 后再显示，避免极快请求导致的闪烁。
  - 如果使用旧写法 `useComponent(loader, { loading })`，则默认立即显示 loading，不会套用 `200ms` 延迟。
  - 如果没有提供 `loadingComponent`，加载期间默认不渲染任何占位内容。
  - `timeout` 默认为 `Infinity`。超时后会进入错误分支，并向 `errorComponent` 传入错误对象。
  - `onError` 会收到 `error`、`retry`、`fail` 和当前重试次数 `attempts`。当前实现要求在回调中显式调用 `retry()` 或 `fail()`；如果都不调用，则会按 `fail()` 处理。
  - `suspensible` 默认为 `true`。当组件位于 `<Suspense>` 内部时，pending Promise 会登记到最近的 Suspense 边界；设置为 `false` 可退出该行为。

- **示例**

  ```tsx
  import { useComponent } from '@rue-js/rue'

  const AsyncUserCard = useComponent({
    loader: () => import('./UserCard.tsx'),
    loadingComponent: () => <p>Loading user card...</p>,
    errorComponent: ({ error }) => <p>Load failed: {error.message}</p>,
    timeout: 3000,
    onError(error, retry, fail, attempts) {
      if (/fetch|network/i.test(error.message) && attempts < 3) {
        retry()
        return
      }
      fail()
    },
  })
  ```

  ```tsx
  import { useComponent } from '@rue-js/rue'

  const AsyncUserCard = useComponent(() => import('./UserCard.tsx'), {
    loading: () => <p>Loading user card...</p>,
    error: ({ error }) => <p>Load failed: {error.message}</p>,
    suspensible: false,
  })
  ```

- **另请参阅** [指南 - 异步组件](/guide/components/async)
