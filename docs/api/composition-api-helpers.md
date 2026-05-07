# 组合式 API：辅助函数 {#composition-api-helpers}

## useAttrs() {#useattrs}

返回 [Setup Context](/api/composition-api-setup#setup-context) 中的 `attrs` 对象，其中包括当前组件的[透传属性](/guide/components/attrs#fallthrough-attributes)。它适用于那些需要读取 `attrs`，但没有直接持有 `context` 对象的组件写法。

- **类型**

  ```ts
  function useAttrs(): Record<string, unknown>
  ```

## useSlots() {#useslots}

返回 [Setup Context](/api/composition-api-setup#setup-context) 中的 `slots` 对象，其中包括父级传递的可调用插槽函数。它适用于那些需要读取插槽，但没有直接持有 `context` 对象的组件写法。

如果你的构建链路支持编译期宏，也可以使用 [`defineSlots()`](/api/sfc-script-setup#defineslots)。

- **类型**

  ```ts
  function useSlots(): Record<string, (...args: any[]) => RenderOutput>

  type RenderOutput = RenderableOutput
  ```

## useModel() {#usemodel}

这是模型双向绑定的底层辅助函数。如果你的构建链路支持编译期宏，也可以改用 [`defineModel()`](/api/sfc-script-setup#definemodel)。

- 仅在 3.4+ 中可用

- **类型**

  ```ts
  function useModel(props: Record<string, any>, key: string, options?: DefineModelOptions): ModelRef

  type DefineModelOptions<T = any> = {
    get?: (v: T) => any
    set?: (v: T) => any
  }

  type ModelRef<T, M extends PropertyKey = string, G = T, S = T> = Ref<G, S> &
    [ModelRef<T, M, G, S>, Record<M, true | undefined>]
  ```

- **示例**

  ```js
  export default {
    props: ['count'],
    emits: ['update:count'],
    setup(props) {
      const msg = useModel(props, 'count')
      msg.value = 1
    },
  }
  ```

- **详情**

  `useModel()` 可用于对象形式组件或其他显式持有 `props` 的场景。它期望 `props` 对象作为第一个参数，模型名称作为第二个参数。可选的第三个参数可用于声明结果模型 ref 的自定义 getter 和 setter。请注意，与 `defineModel()` 不同，你需要自己声明 props 和 emits。

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
  - [指南 - 模板 Refs](/guide/essentials/template-refs)
  - [指南 - 为模板 Refs 添加类型](/guide/typescript/composition-api#typing-template-refs) <sup class="vt-badge ts" />
  - [指南 - 为组件模板 Refs 添加类型](/guide/typescript/composition-api#typing-component-template-refs) <sup class="vt-badge ts" />

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

  如果您在同一页面上有多个 Rue 应用程序实例，可以通过 [`app.config.idPrefix`](/api/application#app-config-idprefix) 为每个应用程序提供 ID 前缀来避免 ID 冲突。

  :::warning 注意
  不应在 `computed()` 属性内部调用 `useId()`，因为它可能导致实例冲突。相反，在 `computed()` 外部声明 ID 并在计算函数中引用它。
  :::
