# 使用 Rue 与 TypeScript {#using-rue-with-typescript}

像 TypeScript 这样的类型系统可以通过在构建时进行静态分析来检测许多常见错误。这减少了生产环境中运行时错误的机会，也使我们能够更有信心地重构大规模应用程序中的代码。TypeScript 还通过 IDE 中的基于类型的自动完成改善了开发者体验。

Rue 本身是用 TypeScript 编写的，并提供一流的 TypeScript 支持。所有官方 Rue 包都带有捆绑的类型声明，应该可以开箱即用。

## 项目设置 {#project-setup}

[`create-rue`](https://github.com/@rue-js/ruejs/create-rue)，官方项目脚手架工具，提供用于脚手架基于 [Vite](https://vitejs.dev/) 的、支持 TypeScript 的 Rue 项目的选项。

### 概述 {#overview}

使用基于 Vite 的设置，开发服务器和打包器仅进行转译，不执行任何类型检查。这确保即使使用 TypeScript，Vite 开发服务器也能保持极快的速度。

- 在开发期间，我们建议依赖良好的 [IDE 设置](#ide-support)来获取类型错误的即时反馈。

- 对于 TS/TSX 项目，以及本仓库当前的命令行类型检查脚本，我们统一使用 `tsgo`。你可以在并行于 Vite 开发服务器的情况下在监视模式下运行 `rue-tsc`，或使用像 [vite-plugin-checker](https://vite-plugin-checker.netlify.app/) 这样的 Vite 插件，它在单独的 worker 线程中运行检查。

### IDE 支持 {#ide-support}

- [Visual Studio Code](https://code.visualstudio.com/)（VS Code）因其出色的 TypeScript 开箱即用支持而强烈推荐。

- [WebStorm](https://www.jetbrains.com/webstorm/) 也为 TypeScript 提供开箱即用支持。

### 配置 `tsconfig.json` {#configuring-tsconfig-json}

通过 `create-rue` 脚手架的项目包含预配置的 `tsconfig.json`。基本配置抽象在 [`rue-tsconfig`](https://github.com/@rue-js/ruejs/tsconfig) 包中。在项目内部，我们使用[项目引用](https://www.typescriptlang.org/docs/handbook/project-references.html)来确保在不同环境中运行的代码（例如应用代码和测试代码应有不同的全局变量）具有正确的类型。

手动配置 `tsconfig.json` 时，一些值得注意的选项包括：

- [`compilerOptions.isolatedModules`](https://www.typescriptlang.org/tsconfig#isolatedModules) 设置为 `true`，因为 Vite 使用 [esbuild](https://esbuild.github.io/) 转译 TypeScript，并受限于单文件转译。[`compilerOptions.verbatimModuleSyntax`](https://www.typescriptlang.org/tsconfig#verbatimModuleSyntax) 是 `isolatedModules` 的[超集](https://github.com/microsoft/TypeScript/issues/53601)，也是一个不错的选择——这是 [`rue-tsconfig`](https://github.com/@rue-js/ruejs/tsconfig) 使用的。

- 如果你在构建工具中配置了解析器别名，例如 `create-rue` 项目中默认配置的 `@/*` 别名，你也需要通过 [`compilerOptions.paths`](https://www.typescriptlang.org/tsconfig#paths) 为 TypeScript 配置它。

- 如果你打算将 TSX 与 Rue 一起使用，将 [`compilerOptions.jsx`](https://www.typescriptlang.org/tsconfig#jsx) 设置为 `"preserve"`，并将 [`compilerOptions.jsxImportSource`](https://www.typescriptlang.org/tsconfig#jsxImportSource) 设置为 `"@rue-js/rue"`。

另请参阅：

- [官方 TypeScript 编译器选项文档](https://www.typescriptlang.org/docs/handbook/compiler-options.html)
- [esbuild TypeScript 编译注意事项](https://esbuild.github.io/content-types/#typescript-caveats)

### 关于 Rue CLI 和 `ts-loader` 的说明 {#note-on-rue-cli-and-ts-loader}

在基于 webpack 的设置（如 Rue CLI）中，通常将类型检查作为模块转换管道的一部分执行，例如使用 `ts-loader`。然而，这不是一个干净的解决方案，因为类型系统需要整个模块图的知识来执行类型检查。单个模块的转换步骤根本不是完成此任务的正确位置。它导致以下问题：

- `ts-loader` 只能对转换后的代码进行类型检查。这与我们在 IDE、`tsgo` 或 `rue-tsc` 看到的错误不一致，后者直接映射回源代码。

- 类型检查可能很慢。当它与代码转换在同一线程/进程中执行时，会显著影响整个应用程序的构建速度。

- 我们已经在 IDE 中的单独进程中运行类型检查，因此开发者体验变慢的成本根本不是一个好的权衡。

如果你当前通过 Rue CLI 使用 Rue 3 + TypeScript，我们强烈建议迁移到 Vite。我们也在研究启用仅转译 TS 支持的 CLI 选项，以便你可以根据场景切换到 `rue-tsc` 或 `tsgo` 进行类型检查。

## 一般使用说明 {#general-usage-notes}

### `defineComponent()` {#definecomponent}

为了让 TypeScript 正确推断组件选项内部的类型，我们需要使用 [`defineComponent()`](/api/api/general#definecomponent) 定义组件：

```ts
import { defineComponent } from '@rue-js/rue'
import type { FC } from '@rue-js/rue'

const App: FC = defineComponent({
  // 启用类型推断
  props: {
    name: String,
    msg: { type: String, required: true },
  },
  data() {
    return {
      count: 1,
    }
  },
  mounted() {
    this.name // 类型: string | undefined
    this.msg // 类型: string
    this.count // 类型: number
  },
})
```

如果你仍然需要显式声明运行时 `props` 选项，`defineComponent()` 也能为这些选项提供类型推断：

```ts
import { defineComponent } from '@rue-js/rue'
import type { FC } from '@rue-js/rue'

const App: FC = defineComponent({
  // 启用类型推断
  props: {
    message: String,
  },
  mounted() {
    this.message // 类型: string | undefined
  },
})
```

另请参阅：

- [关于 webpack Treeshaking 的说明](/api/api/general#note-on-webpack-treeshaking)
- [`defineComponent` 的类型测试](https://github.com/@rue-js/ruejs/core/blob/main/packages-private/dts-test/defineComponent.test-d.tsx)

:::tip
`defineComponent()` 也为用纯 JavaScript 定义的组件启用类型推断。
:::

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

泛型组件在渲染函数 / JSX 组件中受支持，详见 [`defineComponent()` 的函数签名](/api/api/general#function-signature)。

## API 特定配方 {#api-specific-recipes}

- [TS 与 Composition API](/guide/guide/typescript/composition-api)
