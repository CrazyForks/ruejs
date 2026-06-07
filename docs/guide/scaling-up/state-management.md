# 状态管理 {#state-management}

## 什么是状态管理？ {#what-is-state-management}

从技术上讲，每个 Rue 组件实例已经"管理"着自己的响应式状态。以一个简单的计数器组件为例：

```tsx
import { ref, type FC } from '@rue-js/rue'

export const Counter: FC = () => {
  // 状态
  const count = ref(0)

  // 动作
  const increment = () => {
    count.value++
  }

  // 视图
  return () => <div>{count.value}</div>
}
```

这是一个自包含的单元，包含以下部分：

- **状态**，驱动我们应用的事实来源；
- **视图**，**状态**的声明式映射；
- **动作**，**状态**可能根据来自**视图**的用户输入而改变的方式。

这是"单向数据流"概念的简单表示：

状态驱动视图，视图响应用户输入触发动作，而动作再反过来修改状态。

然而，当我们有**多个组件共享一个公共状态**时，这种简单性开始瓦解：

1. 多个视图可能依赖于同一部分状态。
2. 来自不同视图的动作可能需要改变同一部分状态。

对于情况一，一个可能的变通方法是将共享状态"提升"到共同的祖先组件，然后作为 props 向下传递。然而，这在具有深层层次的组件树中很快就会变得繁琐，导致另一个被称为 [Prop Drilling](/guide/guide/components/create-context#why-context) 的问题。

对于情况二，我们经常发现自己求助于诸如通过模板 refs 直接访问父/子实例，或尝试通过触发的事件来改变和同步多个状态副本等解决方案。这两种模式都很脆弱，很快会导致无法维护的代码。

一个更简单、更直接的解决方案是将共享状态从组件中提取出来，并在全局单例中管理。这样，我们的组件树就变成了一个大的"视图"，任何组件都可以访问状态或触发动作，无论它们在树中的哪个位置！

## 使用响应式 API 进行简单的状态管理 {#simple-state-management-with-reactivity-api}

如果你有一块应该由多个实例共享的状态，你可以使用 [`reactive()`](/api/api/reactivity-core#reactive) 创建一个响应式对象，然后将其导入多个组件：

```ts [store.ts]
import { reactive } from '@rue-js/rue'

export const store = reactive({
  count: 0,
})
```

```tsx [ComponentA.tsx]
import { type FC } from '@rue-js/rue'
import { store } from './store'

export const ComponentA: FC = () => {
  return () => <div>来自 A：{store.count}</div>
}
```

```tsx [ComponentB.tsx]
import { type FC } from '@rue-js/rue'
import { store } from './store'

export const ComponentB: FC = () => {
  return () => <div>来自 B：{store.count}</div>
}
```

现在，每当 `store` 对象发生变化时，`<ComponentA>` 和 `<ComponentB>` 都会自动更新它们的视图——我们现在有了单一的事实来源。

然而，这也意味着任何导入 `store` 的组件都可以随意改变它：

```tsx
<button onClick={() => store.count++}>来自 B：{store.count}</button>
```

虽然这在简单情况下有效，但长期而言，任何组件都可以任意改变的全局状态并不是非常可维护的。为了确保改变状态的逻辑像状态本身一样集中，建议在 store 上定义表达动作意图的方法名：

```ts{5-7} [store.ts]
import { reactive } from '@rue-js/rue'

export const store = reactive({
  count: 0,
  increment() {
    this.count++
  }
})
```

```tsx{2}
<button onClick={() => store.increment()}>
  来自 B：{store.count}
</button>
```

:::tip
注意点击处理器使用 `store.increment()` 并带括号——这是必要的，以使用正确的 `this` 上下文调用该方法，因为它不是组件方法。
:::

虽然这里我们使用单个响应式对象作为 store，但你也可以使用其他 [响应式 API](/api/api/reactivity-core)（如 `ref()` 或 `computed()`）创建共享的响应式状态，甚至从 [Composable](/guide/guide/reusability/composables) 返回全局状态：

```ts
import { ref } from '@rue-js/rue'

// 全局状态，在模块作用域中创建
const globalCount = ref(1)

export function useCount() {
  // 本地状态，每个组件创建
  const localCount = ref(1)

  return {
    globalCount,
    localCount,
  }
}
```

Rue 的响应式系统与组件模型解耦，这使其极具灵活性。

## Rue Store {#rue-store}

虽然手动组织共享状态在简单场景下已经足够，但在大型生产应用中，我们通常还会需要：

- 更明确的 store 边界与团队协作约定
- 可复用的 actions / getters 组织方式
- 应用级的 store root 与插件扩展能力
- 订阅、批量更新、重置等统一的状态操作入口

Rue 提供了官方状态管理库 `@rue-js/store`。它建立在 Rue 自身的响应式系统之上，延续 `ref()`、`reactive()` 和 `computed()` 的使用体验，同时提供更适合中大型应用的集中式状态管理模式。

`@rue-js/store` 的核心特性包括：

- 使用 `createStore()` 创建应用级 store root，并通过 `app.use()` 安装
- 使用 `defineStore()` 定义 store，同时支持函数式写法与对象配置式写法
- 通过 `$patch()`、`$set()`、`$reset()`、`$subscribe()` 统一管理状态变更
- 支持 `root.use()` 注册 store 插件，便于扩展调试、同步和持久化能力

## 使用 Rue Store 与 Rue

首先，在应用入口创建并安装 store root：

```tsx [main.tsx]
import { type FC, useApp } from '@rue-js/rue'
import { createStore } from '@rue-js/store'
import { Counter } from './Counter'

const Root: FC = () => <Counter />

const store = createStore()

useApp(Root).use(store).mount('#app')
```

然后定义一个函数式 store：

```ts [stores/counter.ts]
import { computed, ref } from '@rue-js/rue'
import { defineStore } from '@rue-js/store'

export const useCounterStore = defineStore('counter', () => {
  const count = ref(0)
  const doubleCount = computed(() => count.value * 2)

  function increment(step = 1) {
    count.value += step
  }

  return { count, doubleCount, increment }
})
```

在组件中直接使用它：

```tsx [Counter.tsx]
import { type FC } from '@rue-js/rue'
import { useCounterStore } from './stores/counter'

export const Counter: FC = () => {
  const counter = useCounterStore()

  return () => (
    <div>
      <p>计数：{counter.count}</p>
      <p>双倍：{counter.doubleCount}</p>
      <button onClick={() => counter.increment()}>增加</button>
    </div>
  )
}
```

### 对象配置式 Store、状态操作与异步

除了函数式写法，`defineStore()` 也支持对象配置式写法，这在需要显式组织 `state`、`getters` 和 `actions` 时尤其有用：

```ts [stores/user.ts]
import { defineStore } from '@rue-js/store'

type User = {
  id: string
  name: string
}

export const useUserStore = defineStore('user', {
  state: () => ({
    user: null as User | null,
    loading: false,
    error: null as unknown,
  }),
  getters: {
    isReady(state) {
      return !state.loading && !!state.user
    },
  },
  actions: {
    async fetchUser(this: any, id: string) {
      this.loading = true
      this.error = null

      try {
        const response = await fetch(`/api/users/${id}`)
        this.user = await response.json()
      } catch (error) {
        this.error = error
      } finally {
        this.loading = false
      }
    },
    clear(this: any) {
      this.$reset()
    },
  },
})
```

当你需要一次性更新多个字段时，可以使用 `$patch()`；需要按路径更新深层字段时，可以使用 `$set()`；如果想监听状态变化，则可以使用 `$subscribe()`：

```ts
const userStore = useUserStore()

userStore.$patch({
  loading: true,
  error: null,
})

userStore.$subscribe((mutation, state) => {
  console.log(mutation.storeId, state)
})
```
