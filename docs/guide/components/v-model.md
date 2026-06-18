# 组件 v-model {#component-v-model}

## 基本用法 {#basic-usage}

在 Rue 中，`v-model` 的概念通过受控组件模式实现。这使用 props 和回调函数来创建双向绑定。

### 实现自定义输入组件

```tsx [Child.tsx]
import { ref } from '@rue-js/rue'

interface ChildProps {
  modelValue?: number
  onUpdateModelValue?: (value: number) => void
}

function Child(props: ChildProps) {
  const modelValue = props.modelValue ?? 0

  function update() {
    props.onUpdateModelValue?.(modelValue + 1)
  }

  return (
    <div>
      <div>Parent bound value is: {modelValue}</div>
      <button onClick={update}>Increment</button>
    </div>
  )
}
```

父组件可以通过 `v-model` 绑定一个值：

```tsx [Parent.tsx]
import { ref } from '@rue-js/rue'

function Parent() {
  const countModel = ref(0)

  return <Child v-model={countModel.value} />
}
```

这意味着你也可以将这个模式绑定到原生输入元素，使其可以直接包装原生输入元素：

```tsx
interface CustomInputProps {
  modelValue?: string
  onUpdateModelValue?: (value: string) => void
}

function CustomInput(props: CustomInputProps) {
  return (
    <input
      value={props.modelValue ?? ''}
      onInput={e => props.onUpdateModelValue?.(e.currentTarget.value)}
    />
  )
}
```

### 本地访问器

如果组件内部想像读写本地状态一样操作 model，可以把 props 和更新回调包装成一个小访问器：

```tsx
interface CustomInputProps {
  modelValue?: string
  onUpdateModelValue?: (value: string) => void
}

function CustomInput(props: CustomInputProps) {
  const model = {
    get value() {
      return props.modelValue ?? ''
    },
    set value(value: string) {
      props.onUpdateModelValue?.(value)
    },
  }

  return <input value={model.value} onInput={e => (model.value = e.currentTarget.value)} />
}
```

## 带参数的 v-model {#v-model-arguments}

`v-model` 在组件上也可以接受一个参数：

```tsx
function Parent() {
  const bookTitle = ref('')

  return <MyComponent v-model:title={bookTitle.value} />
}
```

在子组件中，我们可以通过使用不同的 prop 名来支持相应的参数：

```tsx [MyComponent.tsx]
interface MyComponentProps {
  title?: string
  onUpdateTitle?: (value: string) => void
}

function MyComponent(props: MyComponentProps) {
  return (
    <input
      type="text"
      value={props.title ?? ''}
      onInput={e => props.onUpdateTitle?.(e.currentTarget.value)}
    />
  )
}
```

如果需要使 prop 为必需或提供默认值：

```tsx
interface MyComponentProps {
  title: string
  onUpdateTitle: (value: string) => void
}

function MyComponent(props: MyComponentProps) {
  return (
    <input
      type="text"
      value={props.title}
      onInput={e => props.onUpdateTitle(e.currentTarget.value)}
    />
  )
}
```

## 多个 v-model 绑定 {#multiple-v-model-bindings}

通过利用我们之前学习的带参数的 `v-model` 功能，我们现在可以在单个组件实例上创建多个 `v-model` 绑定。

每个 `v-model` 将同步到不同的 prop：

```tsx
function Parent() {
  const first = ref('')
  const last = ref('')

  return <UserName v-model:first-name={first.value} v-model:last-name={last.value} />
}
```

```tsx
interface UserNameProps {
  firstName?: string
  lastName?: string
  onUpdateFirstName?: (value: string) => void
  onUpdateLastName?: (value: string) => void
}

function UserName(props: UserNameProps) {
  return (
    <>
      <input
        type="text"
        value={props.firstName ?? ''}
        onInput={e => props.onUpdateFirstName?.(e.currentTarget.value)}
      />
      <input
        type="text"
        value={props.lastName ?? ''}
        onInput={e => props.onUpdateLastName?.(e.currentTarget.value)}
      />
    </>
  )
}
```

## 处理 v-model 修饰符 {#handling-v-model-modifiers}

当我们学习表单输入绑定时，我们看到 `v-model` 有[内置修饰符](/guide/guide/essentials/forms#modifiers) - `.trim`、`.number` 和 `.lazy`。Rue 会为这些内置修饰符自动生成 `modelModifiers` / `xxxModifiers`；自定义修饰符也可以使用同一 props 协议，但需要显式传入对应的 modifiers prop。

让我们创建一个示例自定义修饰符 `capitalize`，它将 `v-model` 绑定提供的字符串的首字母大写：

```tsx
interface MyComponentProps {
  modelValue?: string
  modelModifiers?: { capitalize?: boolean }
  onUpdateModelValue?: (value: string) => void
}

function MyComponent(props: MyComponentProps) {
  function emitValue(value: string) {
    if (props.modelModifiers?.capitalize) {
      value = value.charAt(0).toUpperCase() + value.slice(1)
    }
    props.onUpdateModelValue?.(value)
  }

  return (
    <input
      type="text"
      value={props.modelValue ?? ''}
      onInput={e => emitValue(e.currentTarget.value)}
    />
  )
}
```

现在我们可以使用修饰符了：

```tsx
function Parent() {
  const myText = ref('')

  return <MyComponent v-model={myText.value} modelModifiers={{ capitalize: true }} />
}
```

### 带参数的 v-model 修饰符 {#modifiers-for-v-model-with-arguments}

对于同时带有参数和修饰符的 `v-model` 绑定，生成的 prop 名称将是 `arg + "Modifiers"`。例如：

```tsx
function Parent() {
  const myText = ref('')

  return <MyComponent v-model:title={myText.value} titleModifiers={{ capitalize: true }} />
}
```

子组件声明：

```tsx
interface MyComponentProps {
  title?: string
  titleModifiers?: { capitalize?: boolean }
  onUpdateTitle?: (value: string) => void
}

function MyComponent(props: MyComponentProps) {
  console.log(props.titleModifiers) // { capitalize: true }

  function emitValue(value: string) {
    if (props.titleModifiers?.capitalize) {
      value = value.charAt(0).toUpperCase() + value.slice(1)
    }
    props.onUpdateTitle?.(value)
  }

  return (
    <input type="text" value={props.title ?? ''} onInput={e => emitValue(e.currentTarget.value)} />
  )
}
```

这是使用不同参数的多个 `v-model` 和不同修饰符的另一个示例：

```tsx
function Parent() {
  const first = ref('')
  const last = ref('')

  return (
    <UserName
      v-model:first-name={first.value}
      firstNameModifiers={{ capitalize: true }}
      v-model:last-name={last.value}
      lastNameModifiers={{ uppercase: true }}
    />
  )
}
```

```tsx
interface UserNameProps {
  firstName?: string
  lastName?: string
  firstNameModifiers?: { capitalize?: boolean }
  lastNameModifiers?: { uppercase?: boolean }
  onUpdateFirstName?: (value: string) => void
  onUpdateLastName?: (value: string) => void
}

function UserName(props: UserNameProps) {
  console.log(props.firstNameModifiers) // { capitalize: true }
  console.log(props.lastNameModifiers) // { uppercase: true }

  // ... 实现逻辑
}
```
