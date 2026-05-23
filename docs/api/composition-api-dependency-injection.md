# 组合式 API：<br>Context {#composition-api-dependency-injection}

Rue 当前通过 Context API 在组件树中共享数据，而不是提供一组单独的依赖注入函数。

## createContext() {#create-context}

创建一个上下文对象，供 Provider 和消费者共享同一份类型化的值。

- **类型**

  ```ts
  function createContext<T>(defaultValue: T): RueContext<T>
  ```

- **详情**

  `createContext()` 接收一个默认值，并返回包含 `Provider` 的 Context 对象。

  当组件树中没有匹配的 Provider 时，`useContext()` 会回退到这份默认值。

  通常建议在模块顶层创建并导出 Context，确保提供者和消费者复用同一个 Context 对象。

  如果默认值的推导类型过窄，可以显式传入泛型参数。

- **示例**

  ```tsx
  import { createContext, ref } from '@rue-js/rue'

  export const CountContext = createContext({
    count: ref(0),
    increment: () => {},
  })
  ```

- **另请参阅**
  - [指南 - Create Context](/guide/guide/components/create-context)
  - [指南 - 为 Context 添加类型](/guide/guide/typescript/composition-api#typing-provide-inject) <sup class="vt-badge ts" />

## useContext() {#use-context}

读取最近的 Context Provider 值；如果没有匹配的 Provider，则返回 `createContext()` 时传入的默认值。

- **类型**

  ```ts
  function useContext<T>(context: RueContext<T>): T
  ```

- **详情**

  `useContext()` 接收一个由 `createContext()` 返回的 Context 对象。

  Rue 会沿当前组件的祖先链查找最近的 `Context.Provider`，并返回它的 `value`。

  如果父链中有多个相同 Context 的 Provider，离当前组件最近的那个优先。

  `useContext()` 依赖当前组件实例，因此应在组件函数或组合式函数的同步执行阶段调用。

- **示例**

  ```tsx
  import { useContext } from '@rue-js/rue'
  import { CountContext } from './count-context'

  function CounterLabel() {
    const { count, increment } = useContext(CountContext)

    return <button onClick={increment}>Count: {count.value}</button>
  }
  ```

- **另请参阅**
  - [指南 - Create Context](/guide/guide/components/create-context)
  - [指南 - 为 Context 添加类型](/guide/guide/typescript/composition-api#typing-provide-inject) <sup class="vt-badge ts" />

## Context.Provider {#context-provider}

向后代组件提供一份 Context 值。

- **类型**

  ```ts
  interface ContextProviderProps<T> {
    value: T
    children?: unknown
  }
  ```

- **详情**

  每个由 `createContext()` 返回的 Context 对象都带有一个 `Provider` 组件。

  你可以通过 `<SomeContext.Provider value={...}>` 包裹一段子树，让其中的后代通过 `useContext(SomeContext)` 读取该值。

  Provider 可以嵌套使用，内部 Provider 会覆盖外层同一个 Context 的值。

- **示例**

  ```tsx
  import { ref } from '@rue-js/rue'
  import { CountContext } from './count-context'

  function CountProvider(props: { children?: any }) {
    const count = ref(0)

    const increment = () => {
      count.value += 1
    }

    return (
      <CountContext.Provider value={{ count, increment }}>{props.children}</CountContext.Provider>
    )
  }
  ```
