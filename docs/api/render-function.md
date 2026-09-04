# 编译渲染边界 {#render-function-apis}

Rue 不提供通用的手写建树 API。应用中的 JSX / TSX 必须先经过 Rue 编译器，再交给运行时挂载。编译器会根据源码结构生成窄 DOM、组件和动态挂载操作；这些生成的 helper 不是应用 API。

## 编译要求 {#compiler-requirement}

TypeScript 只负责类型检查并保留 JSX：

```json
{
  "compilerOptions": {
    "jsx": "preserve"
  }
}
```

Vite 项目必须在转换链中启用 Rue 插件：

```ts
import { defineConfig } from 'vite'
import rue from '@rue-js/vite-plugin-rue'

export default defineConfig({
  plugins: [rue()],
})
```

如果转换结束后仍有 JSX AST，构建会报告包含文件与语法位置的错误。由 TypeScript 或其他工具直接降低 JSX 的 automatic 模式不属于受支持的执行路径。

## 静态和组件输出 {#creating-render-output}

使用 TSX 描述原生节点和已知组件：

```tsx
import type { FC } from '@rue-js/rue'
import UserCard from './UserCard'

const Profile: FC<{ name: string }> = props => (
  <section className="profile">
    <h2>{props.name}</h2>
    <UserCard name={props.name} />
  </section>
)
```

组件 children 通过 `props.children` 接收；具名内容和 render prop 应建模为显式 props。

## 动态组件 {#dynamic-components}

运行时才知道标签或组件身份时，使用 `<Component is={...}>`：

```tsx
import { Component, type FC } from '@rue-js/rue'

const DynamicSurface: FC<{ as: string | FC; title: string }> = props => (
  <Component is={props.as} className="surface">
    {props.title}
  </Component>
)
```

`is` 可以是原生标签名、组件函数或已注册组件名。普通静态元素和已知组件仍应直接写成 TSX，让编译器选择更窄的输出。

## 命令式挂载 {#imperative-mount}

需要挂载到既有容器时，先让 TSX 经过 Rue 编译，再将产物交给 `render`：

```tsx
import { render } from '@rue-js/rue'
import App from './App'

render(<App />, document.querySelector('#app')!)
```

另请参阅：[编译 JSX 与动态渲染](/guide/guide/extras/render-function)和[渲染机制](/guide/guide/extras/rendering-mechanism)。
