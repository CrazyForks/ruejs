# 组合式 API：辅助函数 {#composition-api-helpers}

## useEffect() {#useeffect}

在组件挂载后执行副作用，并在需要时清理上一次执行产生的资源。以下三种依赖模式适用于经 Rue 编译器转换的组件。

- **类型**

  ```ts
  function useEffect(
    callback: () => void | (() => void),
    dependencies?: readonly unknown[] | null,
  ): void
  ```

  这里列出编译模式的依赖参数签名；本节不涉及其他运行时模式或额外 options 的行为。

- **三种依赖模式**

  | 调用形式                      | 执行时机                                                             |
  | ----------------------------- | -------------------------------------------------------------------- |
  | `useEffect(fn)`               | 挂载时执行，并自动追踪回调执行期间的响应式读取；这些依赖变化时重跑。 |
  | `useEffect(fn, [])`           | 每次组件挂载只执行一次，回调内的响应式读取不会触发重跑。             |
  | `useEffect(fn, [dep1, dep2])` | 挂载时执行，此后只在声明的依赖值变化时重跑。                         |

  省略数组是 **Rue 自动追踪扩展**，不表示 React 中省略数组时的每次渲染后执行。空数组与显式依赖数组提供 **React 迁移兼容语义**。传入 `null` 按空数组处理。

  显式依赖表达式由编译器延迟读取，例如 `[count.get()]` 会订阅 `count`，不会把 setup 阶段的值固定下来。依赖快照按长度及逐项 `Object.is` 比较；Signal / Ref 句柄作为依赖时读取当前值，函数作为依赖时保留引用，不会被当成 getter 调用。

  显式数组模式只追踪依赖表达式中的响应式读取。回调及 cleanup 中未列出的响应式读取不会增加依赖，也不会单独触发重跑。

- **示例：自动追踪**

  以下示例中的 Hook 均写在编译组件函数内。

  ```tsx
  import { signal, useEffect } from '@rue-js/rue'

  const count = signal(0)
  useEffect(() => {
    console.log(count.get())
  })
  // count.set(1) 会触发重跑。
  ```

- **示例：挂载时执行一次**

  ```tsx
  import { useEffect, useRef } from '@rue-js/rue'

  const inputRef = useRef<HTMLInputElement>()
  useEffect(() => {
    inputRef.current?.focus()
  }, [])
  // 在组件返回的 JSX 中使用 <input ref={inputRef} />。
  ```

- **示例：显式依赖与隔离**

  ```tsx
  import { signal, useEffect } from '@rue-js/rue'

  const count = signal(0)
  const label = signal('计数')
  useEffect(() => {
    console.log(label.get(), count.get())
  }, [count.get()])
  // label.set('总数') 不触发重跑。
  // count.set(1) 触发重跑，此时回调会读到最新 label。
  ```

- **cleanup 与 React 迁移**

  回调可返回一个 cleanup 函数。副作用重跑前先执行上一轮 cleanup，组件销毁时执行最后一轮 cleanup 并停止订阅。空数组模式的 cleanup 只在组件销毁时执行；显式依赖快照未变化时，不重跑回调，也不执行 cleanup。

  从 React 迁移时，可以保留空数组或显式数组的意图，并将依赖改成 Rue 的响应式读法。例如将订阅某个 ID 的 effect 写成：

  ```tsx
  import { signal, useEffect } from '@rue-js/rue'

  const channelId = signal('general')
  useEffect(() => {
    const channel = new BroadcastChannel(channelId.get())
    return () => channel.close()
  }, [channelId.get()])
  ```

  `channelId` 变化时先关闭旧频道，再打开新频道；组件销毁时关闭当前频道。若选择省略依赖数组，则转为 Rue 自动追踪，应重新核对回调中哪些响应式读取需要触发副作用。

## 模板 Refs {#template-refs-helper-note}

在当前的 JSX / TSX 写法中，推荐直接使用 `useRef()` 来持有元素或组件实例引用，而不是依赖额外的模板 ref 辅助函数。

- **类型**

  ```ts
  function useRef<T = any>(initial?: T): { current: T | undefined }
  ```

- **示例**

  ```tsx
  import { useEffect, useRef } from '@rue-js/rue'

  const inputRef = useRef<HTMLInputElement>()

  useEffect(() => {
    inputRef.current?.focus?.()
  }, [])

  return <input ref={inputRef} />
  ```

- **另请参阅**
  - [指南 - 模板 Refs](/guide/guide/essentials/template-refs)
  - [指南 - 为模板 Refs 添加类型](/guide/guide/typescript/composition-api#typing-template-refs) <sup class="vt-badge ts" />
  - [指南 - 为组件模板 Refs 添加类型](/guide/guide/typescript/composition-api#typing-component-template-refs) <sup class="vt-badge ts" />

## useId() <sup class="vt-badge" data-text="3.5+" /> {#useid}

用于生成每个应用程序唯一的 ID，用于无障碍属性或表单元素。

- **类型**

  ```ts
  function useId(): string
  ```

- **示例**

  ```tsx
  import { useId } from '@rue-js/rue'

  const id = useId()

  return (
    <form>
      <label htmlFor={id}>Name:</label>
      <input id={id} type="text" />
    </form>
  )
  ```

- **详情**

  `useId()` 生成的 ID 是每个应用程序唯一的。它可以用于生成表单元素和无障碍属性的 ID。在同一组件中多次调用将生成不同的 ID；同一组件的多个实例调用 `useId()` 也将具有不同的 ID。

  如果您在同一页面上有多个 Rue 应用程序实例，可以通过 [`app.config.idPrefix`](/api/api/application#app-config-idprefix) 为每个应用程序提供 ID 前缀来避免 ID 冲突。

  :::warning 注意
  不应在 `computed()` 属性内部调用 `useId()`，因为它可能导致实例冲突。相反，在 `computed()` 外部声明 ID 并在计算函数中引用它。
  :::
