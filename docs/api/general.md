# 全局 API：通用 {#global-api-general}

## version {#version}

暴露当前版本的 Rue。

- **类型：** `string`

- **详情**

  `version` 是一个在构建时注入的只读字符串。在已发布产物中，它通常与当前安装的 `@rue-js/rue` 版本一致。

  这个值适合用于日志、调试面板、错误上报或问题排查时输出运行时框架版本。它表示的是 Rue 自身版本，不代表你的应用版本，也不会随着响应式更新发生变化。

- **示例**

  ```js
  import { version } from '@rue-js/rue'

  console.log(version)
  ```

## nextTick() {#nexttick}

等待当前已排队的默认响应式 flush 完成。

- **类型**

  ```ts
  function nextTick(): Promise<void>
  function nextTick<T>(callback: () => T | Promise<T>): Promise<T>
  ```

- **详情**

  当你修改响应式状态时，Rue 不会在同一同步调用栈里立刻更新 DOM。相反，默认调度的更新会被合并到当前这一轮 flush 中，以避免重复渲染。

  `nextTick()` 适合放在状态变更之后，用来等待这轮 flush 完成，再去读取更新后的 DOM，或继续执行依赖最新视图状态的逻辑。

  同一轮里多次调用 `nextTick()` 会共享同一个等待中的 Promise。如果当前没有待处理的默认响应式 flush，`nextTick()` 会退化为一个已 resolve 的 Promise，因此也可以安全地用来串联后续步骤。

  `nextTick()` 等待的是 Rue 默认调度的响应式 flush，而不是网络请求、图片加载或自定义 scheduler 安排的异步任务。

- **示例**

  ```tsx
  import { type FC, nextTick, ref, useRef } from '@rue-js/rue'

  const NextTickDemo: FC = () => {
    const count = ref(0)
    const beforeDomText = ref('尚未读取')
    const afterDomText = ref('尚未读取')
    const counterRef = useRef<HTMLSpanElement>()

    const inspectUpdate = async () => {
      count.value += 1

      beforeDomText.value = counterRef.current?.textContent ?? '(missing)'
      await nextTick()
      afterDomText.value = counterRef.current?.textContent ?? '(missing)'
    }

    return (
      <div className="card bg-base-100 shadow">
        <div className="card-body gap-4">
          <p>
            当前 DOM：<span ref={counterRef}>{count.value}</span>
          </p>
          <button className="btn btn-primary" onClick={() => void inspectUpdate()}>
            自增并读取 DOM
          </button>
          <p>同步读取：{beforeDomText.value}</p>
          <p>nextTick 后：{afterDomText.value}</p>
        </div>
      </div>
    )
  }
  ```

  交互式示例：[/examples/next-tick](/examples/next-tick)

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

- **另请参阅** [指南 - 异步组件](/guide/guide/components/async)
