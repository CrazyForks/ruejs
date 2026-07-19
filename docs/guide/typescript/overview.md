# 使用 Rue 与 TypeScript {#using-rue-with-typescript}

像 TypeScript 这样的类型系统可以通过在构建时进行静态分析来检测许多常见错误。这减少了生产环境中运行时错误的机会，也使我们能够更有信心地重构大规模应用程序中的代码。TypeScript 还通过 IDE 中的基于类型的自动完成改善了开发者体验。

Rue 本身是用 TypeScript 编写的，并提供一流的 TypeScript 支持。所有官方 Rue 包都带有捆绑的类型声明，应该可以开箱即用。

## 项目设置 {#project-setup}

[`create-rue`](https://github.com/hunzhiwange/create-rue) 是创建 [Vite](https://vite.dev/) + Rue 项目的官方脚手架，并提供 TypeScript 选项：

```bash
npm create rue@latest
```

如果要在现有的 Vite + TypeScript 项目中接入 Rue，可以安装 Rue 及其 Vite 插件：

```bash
pnpm add @rue-js/rue
pnpm add -D @rue-js/vite-plugin-rue typescript
```

然后在 Vite 配置中启用 Rue 的 JSX / TSX 转换：

```ts
import { defineConfig } from 'vite'
import rue from '@rue-js/vite-plugin-rue'

export default defineConfig({
  plugins: [rue()],
})
```

### 概述 {#overview}

使用基于 Vite 的设置，开发服务器和打包器仅进行转译，不执行任何类型检查。这确保即使使用 TypeScript，Vite 开发服务器也能保持极快的速度。

- 在开发期间，我们建议依赖良好的 [IDE 设置](#ide-support)来获取类型错误的即时反馈。

- 对于 TS/TSX 项目，本仓库使用 TypeScript 7 的 `tsc` 进行类型检查。你可以运行 `tsc --noEmit` 做一次检查，或在 Vite 开发服务器之外运行 `tsc --noEmit --watch` 持续检查。

### IDE 支持 {#ide-support}

- [Visual Studio Code](https://code.visualstudio.com/)（VS Code）因其出色的 TypeScript 开箱即用支持而强烈推荐。

- [WebStorm](https://www.jetbrains.com/webstorm/) 也为 TypeScript 提供开箱即用支持。

### 配置 `tsconfig.json` {#configuring-tsconfig-json}

下面是一份适合 Rue TSX 项目的基础配置：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "@rue-js",
    "strict": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

其中需要特别注意：

- [`compilerOptions.jsx`](https://www.typescriptlang.org/tsconfig#jsx) 应设为 `"react-jsx"`，并将 [`compilerOptions.jsxImportSource`](https://www.typescriptlang.org/tsconfig#jsxImportSource) 设为 `"@rue-js"`，让 TypeScript 使用 Rue 提供的 JSX runtime 和类型声明。

- [`compilerOptions.isolatedModules`](https://www.typescriptlang.org/tsconfig#isolatedModules) 建议设为 `true`，以便尽早发现不适用于 Vite 单文件转换流程的写法。

- 如果你在 Vite 中配置了解析器别名，也需要通过 [`compilerOptions.paths`](https://www.typescriptlang.org/tsconfig#paths) 为 TypeScript 配置对应的路径。

另请参阅：

- [官方 TypeScript 编译器选项文档](https://www.typescriptlang.org/docs/handbook/compiler-options.html)
- [Vite 的 TypeScript 说明](https://vite.dev/guide/features.html#typescript)

## 一般使用说明 {#general-usage-notes}

### 函数组件与 Props 类型 {#typing-function-components}

Rue 组件是普通的 TSX 函数。使用 `FC<Props>` 可以声明组件的 props，并直接获得参数和 JSX 调用处的类型检查：

```tsx
import { type FC, ref } from '@rue-js/rue'

interface CounterProps {
  label: string
  initialValue?: number
}

const Counter: FC<CounterProps> = ({ label, initialValue = 0 }) => {
  const count = ref(initialValue)

  return (
    <button onClick={() => count.value++}>
      {label}: {count.value}
    </button>
  )
}
```

更多 props、事件回调和 DOM 引用的类型写法见 [TypeScript 与 Composition API](/guide/guide/typescript/composition-api)。

### 与 TSX 一起使用 {#usage-with-tsx}

Rue 支持使用 JSX / TSX 编写组件。直接在组件函数中声明响应式状态时，TypeScript 可以对表达式、props 和事件回调提供完整的类型检查：

```tsx
import { type FC, ref } from '@rue-js/rue'

const Counter: FC = () => {
  const count = ref(1)

  return <div>{count.value.toFixed(2)}</div>
}
```

详细信息在[渲染函数与 JSX](/guide/guide/extras/render-function#jsx-tsx)指南中介绍。

### JSX 表达式中的 TypeScript {#typescript-in-jsx}

JSX 表达式遵循标准 TypeScript 语义。这在需要执行类型缩窄或类型转换时很有用。

```tsx
let x: string | number = 1
```

这可以通过内联类型转换来解决：

```tsx
let x: string | number = 1
;<div>{(x as number).toFixed(2)}</div>
```

## 泛型组件 {#generic-components}

泛型组件可以直接使用 TypeScript 的泛型函数定义：

```tsx
interface ListProps<T> {
  items: T[]
  renderItem: (item: T) => JSX.Element
}

function List<T>({ items, renderItem }: ListProps<T>) {
  return <ul>{items.map(item => <li>{renderItem(item)}</li>)}</ul>
}
```

## API 特定配方 {#api-specific-recipes}

- [TS 与 Composition API](/guide/guide/typescript/composition-api)
