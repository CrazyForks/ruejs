# 后悔药 Rue.js

> The Wasm Framework For Native DOM

语言：[English](./README.md) | 简体中文

[![Website](https://img.shields.io/badge/website-ruejs.huododo.com-0f766e)](https://ruejs.huododo.com)
[![npm version](https://img.shields.io/npm/v/%40rue-js%2Frue.svg?style=flat)](https://www.npmjs.com/package/@rue-js/rue)
[![Build and Test](https://github.com/hunzhiwange/ruejs/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/hunzhiwange/ruejs/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Rue.js（发音 /ruː/，中文名后悔药.js）是一个面向 JSX/TSX 的轻量前端框架，追求简单直观的开发体验，同时提供默认细粒度响应式渲染路径、路由、基于 Rust / WebAssembly 的运行时扩展，以及 Rust 实现的响应式系统与原生 DOM 编译能力。

它适合希望保留 React 风格 JSX 开发方式，同时获得 Vue 式响应式 API 与更贴近真实 DOM 更新模型的项目。

## 特性

- 轻量、直观的 API，适合渐进式接入
- 默认细粒度响应式渲染路径，围绕真实 DOM 做最小更新
- JSX / TSX 一等支持，无需额外模板语法
- 类似 Vue 的响应式 API，支持 `ref`、`reactive`、`computed`
- 提供基于 Rust / WebAssembly 的运行时，可扩展编译渲染能力
- 提供 Rust 实现的响应式系统，覆盖信号、依赖追踪与调度能力
- 提供 Rust / Wasm 原生 DOM 编译器，将 JSX 转换为更贴近真实 DOM 的产物
- 官方路由、设计组件库与构建插件协同工作
- 提供 Text.js 全栈应用框架，覆盖 App Router、SSR、API 路由与 Workers 部署
- 提供 `@rue-js/runtime-vapor` 与 `@rue-js/swc-plugin-rue` Rust 侧核心能力

## 快速开始

Rue 提供官方脚手架，也支持接入现有 Vite 项目。

### 创建新项目

前置条件：Node.js >= 22.12.0

```sh
pnpm create rue@latest
npm create rue@latest
bun create rue@latest
yarn dlx create-rue@latest
```

进入项目后安装依赖并启动开发服务器：

```sh
cd your-project-name
pnpm install
pnpm run dev
```

### 接入现有项目

```sh
pnpm add @rue-js/rue @rue-js/router
```

在 Vite 配置中启用 Rue 的 JSX：

```ts
// vite.config.ts
import { defineConfig } from 'vite'

export default defineConfig({
  esbuild: { jsxImportSource: '@rue-js/rue' },
})
```

## 示例

下面是一个最小 Rue 应用示例：

```tsx
import { type FC, ref, useApp, useError } from '@rue-js/rue'

const Counter: FC = () => {
  const count = ref(0)

  return <button onClick={() => count.value++}>点击次数：{count.value}</button>
}

useError({ overlay: true, console: true })
useApp(Counter).mount('#app')
```

如果你需要页面级路由，可以继续接入 `@rue-js/router`：

```ts
import { useComponent } from '@rue-js/rue'
import { createRouter } from '@rue-js/router'

export default createRouter({
  history: 'hash',
  routes: [
    { path: '/', component: useComponent(() => import('./pages/Home')) },
    { path: '/about', component: useComponent(() => import('./pages/About')) },
  ],
})
```

## Text.js

Text.js 是 Rue 生态中的全栈应用框架。它基于 Vite、Rue、RSC 与文件系统路由，把 App Router、Pages Router、SSR、静态生成、API 路由、中间件和 Cloudflare Workers 部署整合成一条轻量开发路径。

它面向已经熟悉 Next.js 应用模型的开发者，同时保留 Rue 的 JSX / TSX 运行时与 Vite-first 工具链。常用 CLI 命令包括 `text dev`、`text build`、`text deploy`、`text typegen` 和 `text check`。

## 文档

- [介绍](./docs/intro.md)
- [安装](./docs/installation.md)
- [快速开始](./docs/getting-started.md)
- [路由](./docs/routing.md)
- [指南](./docs/guide)
- [API](./docs/api)

仓库中也包含可直接运行的文档站与示例页面，位于 [app](./app) 和 [app/pages](./app/pages) 下。

## Packages

这是一个基于 pnpm workspace 的 monorepo，主要包包括：

- `@rue-js/rue`：框架核心与 JSX 入口
- `@rue-js/router`：官方路由
- `@rue-js/text`：Text.js 全栈应用框架与 CLI
- `@rue-js/runtime-vapor`：Rust / WebAssembly 运行时实现
- `@rue-js/design`：设计系统与组件库
- `@rue-js/vite-plugin-rue`：Vite 集成
- `@rue-js/swc-plugin-rue`：SWC JSX 转换插件
- `@rue-js/jsx-runtime` / `@rue-js/jsx-dev-runtime`：JSX 运行时入口

## 本地开发

本仓库使用 `pnpm` 管理依赖。

```sh
make dev
pnpm install
pnpm run app-dev
pnpm run app-build
pnpm run app-preview
pnpm run dev
```

常用命令：

```sh
pnpm run build
pnpm run test
pnpm run check
pnpm run release-check
```

如果你在开发 `runtime-vapor`，还可以进入对应包执行 Rust / Wasm 相关命令：

```sh
cd packages/runtime-vapor
npm test
```

## 贡献

欢迎通过 Issue 和 Pull Request 参与 Rue 的开发。提交改动前，建议至少运行以下检查：

```sh
pnpm run check
pnpm run test
```

如果改动涉及构建、发布或 Wasm 运行时，请补充对应包级验证。

## 许可证

[MIT](./LICENSE)
