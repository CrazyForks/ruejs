# 组件注册 {#component-registration}

> 本页面假设你已经阅读过[组件基础](/guide/guide/essentials/component-basics)。如果你是组件的新手，请先阅读那部分内容。

在 JSX / TSX 中，Rue 组件通常通过普通的 ES 模块导入来使用。只有当你需要通过字符串名称在运行时解析组件时，才需要把组件注册到当前应用的名称表中。

## 全局注册 {#global-registration}

我们可以使用 `app.component()` 方法把组件注册到当前 [Rue 应用](/guide/guide/essentials/application) 的运行时名称表中：

```tsx
import { Component, useApp } from '@rue-js/rue'
import App from './App'
import { MyComponent } from './MyComponent'

const app = useApp(App)

app.component(
  // 注册名称
  'MyComponent',
  // 实现
  MyComponent,
)
```

`.component()` 方法可以链式调用：

```tsx
app
  .component('ComponentA', ComponentA)
  .component('ComponentB', ComponentB)
  .component('ComponentC', ComponentC)
```

注册后的名称可以传给 [`Component`](/api/api/built-in-special-elements#component) 的 `is` prop，用于动态组件场景：

```tsx
<Component is="MyComponent" />
```

在 TSX 中，`<MyComponent />` 仍然需要通过普通 `import` 得到 `MyComponent` 标识符；运行时注册不会让未导入的 JSX 标签自动可用。

## 局部注册 {#local-registration}

虽然运行时名称注册很方便，但也有一些缺点：

1. 全局注册会阻止构建系统移除未使用的组件（即"tree-shaking"）。如果你全局注册了一个组件但最终在应用中任何地方都没有使用它，它仍会被包含在最终的包中。

2. 全局注册在大型应用中会使依赖关系不那么明确。这使得很难从使用子组件的父组件中找到子组件的实现。这会影响长期可维护性，类似于使用过多的全局变量。

在 Rue 中，组件是以函数形式定义的，直接在父组件中导入和使用即可。普通导入使依赖关系更加明确，并且更有利于 tree-shaking：

```tsx
import { ComponentA } from './ComponentA'

function ParentComponent() {
  return (
    <div>
      <ComponentA />
    </div>
  )
}
```

导入的组件只在当前模块作用域内可用。在这种情况下，`ComponentA` 只对当前文件可用，对没有导入它的其他组件不可用。

## 组件名称大小写 {#component-name-casing}

在本指南中，我们在注册组件时使用 PascalCase 命名。这是因为：

1. PascalCase 名称是有效的 JavaScript 标识符。这使得在 JavaScript 中导入和注册组件更容易。它还有助于 IDE 进行自动补全。

2. `<PascalCase />` 在 JSX / TSX 中更明显地表示这是一个 Rue 组件而不是原生 HTML 元素。它还能将 Rue 组件与自定义元素（Web Components）区分开来。

这是在使用 TSX 时的推荐风格。在 JSX/TSX 中，组件必须使用 PascalCase 命名。

```tsx
// 在 TSX 中，组件名必须使用 PascalCase
function MyComponent() {
  return <div>Hello</div>
}

// 使用组件
function Parent() {
  return <MyComponent />
}
```
