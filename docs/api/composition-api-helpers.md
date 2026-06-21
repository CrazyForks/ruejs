# 组合式 API：辅助函数 {#composition-api-helpers}

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
