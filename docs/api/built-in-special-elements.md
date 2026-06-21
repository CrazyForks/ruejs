# 内置特殊元素 {#built-in-special-elements}

:::info 不是组件
`<Component>`、`<Slot>` 和 `<Template>` 是模板语法中的特殊元素，不会按普通组件解析。模板编译器会把它们转换为对应的运行时能力，因此在模板中通常用小写字母书写。

在 JSX / TSX 中，Rue 另外提供了与之对应的运行时导出：`Component`、`Slot` 和 `Template`。它们表达的是同一套语义，只是调用方式更接近普通组件，并且需要从 `@rue-js/rue` 显式导入后才能使用。
:::

## `<Component>` {#component}

用于渲染动态组件或元素的"元组件"。

- **Props**

  ```ts
  interface DynamicComponentProps {
    is?: string | Component | null
    [key: string]: unknown
  }
  ```

- **详情**

  实际要渲染的组件由 `is` prop 决定。

  当 `is` 是字符串时，Rue 会先尝试把它解析为当前运行时中已注册的组件；如果未命中，就将它当作原生 HTML 标签名处理。

  `is` 也可以直接绑定到组件定义本身，此时不会经过名称注册表。

  当 `is` 为 `null` 或 `undefined` 时，`<Component>` 不渲染任何内容。

  除 `is` 之外的所有 props 和子节点都会原样透传给最终解析出的组件或元素。

  在 JSX / TSX 中，应使用大写的 `Component`，并从 `@rue-js/rue` 显式导入；小写 `<Component>` 仅用于模板语法。

- **示例**

  使用变量渲染组件：

  ```tsx
  import { Component } from '@rue-js/rue'
  import Foo from './Foo'
  import Bar from './Bar'

  // 渲染 Foo
  <Component is={Foo} />

  // 条件渲染
  <Component is={Math.random() > 0.5 ? Foo : Bar} />
  ```

  渲染 HTML 元素：

  ```tsx
  import { Component } from '@rue-js/rue'
  ;<Component is={href ? 'a' : 'span'} />
  ```

  [内置组件](/api/api/built-in-components)都可以传递给 `is`，但如果您想通过名称传递，则必须注册它们。例如：

  ```tsx
  import { Component, Transition, TransitionGroup } from '@rue-js/rue'
  ;<Component is={isGroup ? TransitionGroup : Transition}>...</Component>
  ```

  如果通过字符串名称传递内置组件或用户组件，则它们需要先在当前运行时中注册；如果直接把组件对象传给 `is`，则不需要注册。

  当 `is` 最终解析为原生表单元素时，仍应按原生元素的属性和事件自行处理数据同步，而不是依赖组件式的 `v-model` 约定。例如：

  ```tsx
  import { Component, ref } from '@rue-js/rue'

  const tag = ref<'input' | 'textarea'>('input')
  const username = ref('')

  <Component
    is={tag.value}
    value={username.value}
    onInput={e => {
      username.value = (e.target as HTMLInputElement | HTMLTextAreaElement).value
    }}
  />
  ```

  在 JSX / TSX 中直接使用时，对应的运行时组件名为 `Component`。

- **另请参阅** [动态组件](/guide/guide/essentials/component-basics#dynamic-components)

## `<Slot>` {#slot}

表示模板中的插槽内容出口。

- **Props**

  ```ts
  interface SlotProps {
    name?: string
    props?: Record<string, unknown>
    source?: Record<string, unknown> | null
    children?: RenderableOutput
  }
  ```

- **详情**

  `<Slot>` 元素可以使用 `name` 属性指定插槽名称。不传时渲染默认插槽。

  对于具名插槽和作用域插槽，Rue 会优先从内部的 slot bag 中读取内容；如果没有，再兼容读取同名普通 prop。默认插槽则优先读取内部 `default` 槽位，回退到 `children`。

  如果匹配的插槽不存在，或者插槽值为空，`<Slot>` 会渲染自身的后备内容。

  当匹配到的是作用域插槽函数时，Rue 会用 `props` 中提供的对象作为参数调用它。

  该元素本身将被其匹配的插槽内容替换。

  Rue 模板中的 `<Slot>` 元素被编译为 JavaScript，因此不应与[原生 `<Slot>` 元素](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/slot)混淆。

  在模板里，传给 `<Slot>` 的额外属性会被编译器整理为作用域插槽参数；在 JSX / TSX 中直接使用运行时 `Slot` 组件时，需要显式通过 `props` 传入这些参数。

  在 JSX / TSX 中，应使用大写的 `Slot`，并从 `@rue-js/rue` 显式导入；小写 `<Slot>` 仅用于模板语法。

- **示例**

  默认插槽与后备内容：

  ```tsx
  import { Slot } from '@rue-js/rue'
  ;<Slot>
    <p>fallback content</p>
  </Slot>
  ```

  具名插槽：

  ```tsx
  import { Slot } from '@rue-js/rue'
  ;<Slot name="header" />
  ```

  作用域插槽：

  ```tsx
  import { Slot } from '@rue-js/rue'
  ;<Slot name="item" props={{ item: post, index }} />
  ```

- **另请参阅** [组件 - 插槽](/guide/guide/components/slots)

## `<Template>` / `<Template>` {#template}

`<Template>` 在模板中用作不产生额外 DOM 元素的占位符；在 JSX / TSX 中，对应的运行时组件名为 `Template`。

- **Props**

  ```ts
  type TemplateProps = {
    children?: RenderableOutput
    [key: string]: unknown
  }
  ```

- **详情**

  只有当 `<Template>` 与以下指令之一一起使用时，才会触发特殊处理：
  - `v-if`、`v-else-if` 或 `v-else` 的 Rue 等效实现
  - 列表渲染的 Rue 等效实现
  - 插槽的 Rue 等效实现

  如果这些指令都不存在，编译器应保留它并将其视为[原生 `<Template>` 元素](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/template)。

  带有列表渲染的 `<Template>` 也可以具有 [key 属性](/api/api/built-in-special-attributes#key)。除这一类控制边界的语义外，其余属性和指令在没有实际元素节点时都会被忽略。

  在 JSX / TSX 中直接使用 `Template` 时，它会只渲染子节点本身，不引入额外包装元素；除 `children` 之外的其他 props 在运行时会被忽略。

  在 JSX / TSX 中，应使用大写的 `Template`，并从 `@rue-js/rue` 显式导入；小写 `<Template>` 仅用于模板语法。

- **示例**

  在 JSX / TSX 中分组多个子节点而不引入包装元素：

  ```tsx
  import { Template } from '@rue-js/rue'
  ;<Template>
    <h1>Title</h1>
    <p>Content</p>
  </Template>
  ```

  与列表渲染组合使用：

  ```tsx
  import { Template } from '@rue-js/rue'

  {
    todos.map(todo => (
      <Template key={todo.id}>
        <li>{todo.text}</li>
        <li className="divider" />
      </Template>
    ))
  }
  ```

- **另请参阅**
  - [指南 - 条件渲染中的 `<Template>`](/guide/guide/essentials/conditional#v-if-on-template)
  - [指南 - 列表渲染中的 `<Template>`](/guide/guide/essentials/list#v-for-on-template)
  - [指南 - 具名插槽](/guide/guide/components/slots#named-slots)
