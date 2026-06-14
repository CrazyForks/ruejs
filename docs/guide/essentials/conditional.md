# 条件渲染 {#conditional-rendering}

Rue 在 JSX / TSX 中支持两类条件渲染写法：一类是原生 JSX 表达式，例如 `&&`、三元运算符和提前返回；另一类是 Rue 编译阶段支持的 `v-if`、`v-else-if`、`v-else` 和 `v-show` 指令。

如果你更习惯 JavaScript 表达式，可以继续使用 JSX 写法；如果你更习惯模板式结构，可以使用 Rue 指令写法。下面会把两种写法放在一起对比。

## 条件渲染 {#v-if}

`v-if` 根据表达式决定是否渲染当前元素。只有当条件表达式返回真值时，块才会被渲染；条件为假时，对应节点不会保留在 DOM 中。

Rue 指令写法：

```tsx
import { ref } from '@rue-js/rue'
import type { FC } from '@rue-js/rue'

const App: FC = () => {
  const awesome = ref(true)

  return (
    <div>
      <h1 v-if={awesome.value}>Rue 太棒了！</h1>
    </div>
  )
}
```

JSX 等价写法：

```tsx
import { ref } from '@rue-js/rue'
import type { FC } from '@rue-js/rue'

const App: FC = () => {
  const awesome = ref(true)

  return <div>{awesome.value && <h1>Rue 太棒了！</h1>}</div>
}
```

## else 块 {#v-else}

`v-else` 用于声明 `v-if` 的兜底分支，不需要传入表达式。它必须紧跟在 `v-if` 或 `v-else-if` 后面，中间只能有空白文本。

Rue 指令写法：

```tsx
import { ref } from '@rue-js/rue'
import type { FC } from '@rue-js/rue'

const App: FC = () => {
  const awesome = ref(true)

  return (
    <div>
      <button onClick={() => (awesome.value = !awesome.value)}>切换</button>
      <h1 v-if={awesome.value}>Rue 太棒了！</h1>
      <h1 v-else>哦，不 😢</h1>
    </div>
  )
}
```

JSX 等价写法：

```tsx
import { ref } from '@rue-js/rue'
import type { FC } from '@rue-js/rue'

const App: FC = () => {
  const awesome = ref(true)

  return (
    <div>
      <button onClick={() => (awesome.value = !awesome.value)}>切换</button>
      {awesome.value ? <h1>Rue 太棒了！</h1> : <h1>哦，不 😢</h1>}
    </div>
  )
}
```

## else-if 块 {#v-else-if}

`v-else-if` 用于声明中间条件分支，也必须紧跟在 `v-if` 或另一个 `v-else-if` 后面。

Rue 指令写法：

```tsx
import { ref } from '@rue-js/rue'
import type { FC } from '@rue-js/rue'

const App: FC = () => {
  const type = ref('A')

  return (
    <div>
      <div v-if={type.value === 'A'}>A</div>
      <div v-else-if={type.value === 'B'}>B</div>
      <div v-else-if={type.value === 'C'}>C</div>
      <div v-else>不是 A/B/C</div>
    </div>
  )
}
```

JSX 等价写法：

```tsx
import { ref } from '@rue-js/rue'
import type { FC } from '@rue-js/rue'

const App: FC = () => {
  const type = ref('A')

  return (
    <div>
      {type.value === 'A' ? (
        <div>A</div>
      ) : type.value === 'B' ? (
        <div>B</div>
      ) : type.value === 'C' ? (
        <div>C</div>
      ) : (
        <div>不是 A/B/C</div>
      )}
    </div>
  )
}
```

## 在片段上条件渲染 {#v-if-on-template}

如果你想切换多个元素，可以使用 fragment（片段）作为隐式包装器；也可以使用 Rue 的 `Template` 配合 `v-if`，避免引入额外 DOM 包装节点。

Rue 指令写法：

```tsx
import { Template, ref } from '@rue-js/rue'
import type { FC } from '@rue-js/rue'

const App: FC = () => {
  const ok = ref(true)

  return (
    <div>
      <Template v-if={ok.value}>
        <h1>标题</h1>
        <p>段落 1</p>
        <p>段落 2</p>
      </Template>
    </div>
  )
}
```

JSX 等价写法：

```tsx
import { ref } from '@rue-js/rue'
import type { FC } from '@rue-js/rue'

const App: FC = () => {
  const ok = ref(true)

  return (
    <div>
      {ok.value && (
        <>
          <h1>标题</h1>
          <p>段落 1</p>
          <p>段落 2</p>
        </>
      )}
    </div>
  )
}
```

## `display` 切换 {#v-show}

条件性显示元素的另一个选项是 `v-show`。它会根据表达式切换元素的 `display` 样式，但不会销毁节点。

Rue 指令写法：

```tsx
import { ref } from '@rue-js/rue'
import type { FC } from '@rue-js/rue'

const App: FC = () => {
  const ok = ref(true)

  return <h1 v-show={ok.value}>你好！</h1>
}
```

JSX 等价写法：

```tsx
import { ref } from '@rue-js/rue'
import type { FC } from '@rue-js/rue'

const App: FC = () => {
  const ok = ref(true)

  return <h1 style={{ display: ok.value ? 'block' : 'none' }}>你好！</h1>
}
```

区别是元素始终会被渲染并保留在 DOM 中；我们通过 CSS 的 `display` 属性来切换可见性。

或者你可以创建一个 `vShow` 工具函数：

```tsx
function vShow(visible: boolean) {
  return { display: visible ? '' : 'none' }
}

// 使用
;<h1 style={vShow(ok.value)}>你好！</h1>
```

如果元素上已经有 `style`，Rue 会在编译时合并 `v-show` 需要的显示状态：

```tsx
<section v-show={ok.value} style={{ color: 'tomato' }}>
  内容
</section>
```

## 条件渲染 vs 显示切换 {#v-if-vs-v-show}

使用条件渲染（`v-if`、`&&` 或三元运算符）是"真正的"条件渲染，因为它确保在切换期间正确销毁和重新创建条件块内的事件监听器和子组件。

条件渲染也是**惰性的**：如果初始渲染时条件为假，它将不会执行任何操作——条件块在条件首次变为真之前不会被渲染。

相比之下，显示切换（`v-show` 或手动 `display`）要简单得多——无论初始条件如何，元素始终被渲染，只是基于 CSS 进行切换。

一般来说，条件渲染有更高的切换开销，而显示切换有更高的初始渲染开销。因此，如果你需要频繁切换某些内容，优先使用 `v-show`；如果条件在运行时不太可能改变，优先使用 `v-if`。

## 提前返回 {#early-return}

除了在 JSX 内部写条件，你也可以在组件函数中提前返回不同的 JSX。这个写法适合页面级状态，例如登录拦截、加载中或错误状态：

```tsx
const App: FC = () => {
  if (!user.value) {
    return <div>请先登录</div>
  }

  return <div>欢迎，{user.value.name}</div>
}
```

## 条件渲染与列表渲染 {#v-if-with-v-for}

在 JSX 中，条件和列表渲染的顺序完全由你控制。建议在列表渲染之前先进行过滤，或者在列表外层进行条件判断。

### 先过滤，再渲染

```tsx
// 推荐：先过滤，再渲染
const filteredItems = computed(() => items.value.filter(item => item.isComplete))

return (
  <ul>
    {filteredItems.value.map(item => (
      <li key={item.id}>{item.name}</li>
    ))}
  </ul>
)
```

### 条件包裹列表

Rue 指令写法：

```tsx
return (
  <ul v-if={shouldShowList.value}>
    {items.value.map(item => (
      <li key={item.id}>{item.name}</li>
    ))}
  </ul>
)
```

JSX 等价写法：

```tsx
return (
  shouldShowList.value && (
    <ul>
      {items.value.map(item => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  )
)
```

::: warning 注意
不推荐把复杂条件逻辑直接塞进列表渲染内部，因为这会让更新边界和代码可读性都变差。参考上面的示例来组织你的代码。
:::
