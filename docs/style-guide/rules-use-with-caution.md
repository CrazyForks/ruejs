# 优先级 D 规则：谨慎使用 {#priority-d-rules-use-with-caution}

Rue 的某些能力适用于罕见的边缘情况或遗留代码迁移。然而，如果过度使用，它们会使你的代码更难维护，甚至成为错误的来源。这些规则揭示了潜在的风险功能，描述了何时以及为什么应该避免使用它们。

## 在组件作用域样式中使用元素选择器 {#element-selectors-with-scoped}

**应避免在组件作用域样式中使用元素选择器。**

优先在组件样式中使用类选择器而不是元素选择器，因为它更稳定，也更容易控制样式影响范围。

::: details 详细解释
元素选择器会把样式绑定到具体 DOM 结构上，例如 `button`、`input` 或 `li`。当组件内部结构变化、或组件被嵌套在第三方内容附近时，这类选择器更容易产生意外影响。

类选择器（例如 `.btn-close`）能把样式意图直接写进标记中，也能让组件库使用者更容易覆盖或扩展样式。
:::

<div class="style-example style-example-bad">
<h3>Bad</h3>

```jsx
<button>×</button>

<style>
button {
  background-color: red;
}
</style>
```

</div>

<div class="style-example style-example-good">
<h3>Good</h3>

```jsx
<button class="btn btn-close">×</button>

<style>
.btn-close {
  background-color: red;
}
</style>
```

</div>

## 隐式父子通信 {#implicit-parent-child-communication}

**应优先使用 props 和事件进行父子组件通信，而不是直接访问父组件或修改 props。**

理想的 Rue 应用是 props 向下传递，事件向上传递。坚持这一约定使你的组件更容易理解。然而，存在一些边缘情况，prop 修改或直接访问父组件可以简化已经深度耦合的两个组件。

问题是，也有许多 _简单_ 的情况，这些模式可能提供便利。注意：不要被引诱用短期便利（编写更少的代码）来换取简单性（能够理解你的状态流）。

<div class="style-example style-example-bad">
<h3>Bad</h3>

```tsx
type Todo = {
  id: number
  text: string
}

type TodoItemProps = {
  todo: Todo
}

const TodoItem = ({ todo }: TodoItemProps) => (
  <input
    value={todo.text}
    onInput={event => {
      todo.text = event.currentTarget.value
    }}
  />
)
```

```tsx
type TodoItemProps = {
  todo: Todo
  todos: Todo[]
  setTodos: (todos: Todo[]) => void
}

const TodoItem = ({ todo, todos, setTodos }: TodoItemProps) => (
  <span>
    {todo.text}
    <button
      onClick={() => {
        setTodos(todos.filter(item => item.id !== todo.id))
      }}
    >
      ×
    </button>
  </span>
)
```

</div>

<div class="style-example style-example-good">
<h3>Good</h3>

```tsx
type Todo = {
  id: number
  text: string
}

type TodoItemProps = {
  todo: Todo
  onInput: (value: string) => void
}

const TodoItem = ({ todo, onInput }: TodoItemProps) => (
  <input value={todo.text} onInput={event => onInput(event.currentTarget.value)} />
)
```

```tsx
type TodoItemProps = {
  todo: Todo
  onDelete: () => void
}

const TodoItem = ({ todo, onDelete }: TodoItemProps) => (
  <span>
    {todo.text}
    <button onClick={onDelete}>×</button>
  </span>
)
```

</div>
