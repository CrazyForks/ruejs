# Text.js

[![npm version](https://img.shields.io/npm/v/%40rue-js%2Ftext.svg?style=flat)](https://www.npmjs.com/package/@rue-js/text)
[![Build and Test](https://github.com/hunzhiwange/ruejs/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/hunzhiwange/ruejs/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Text.js 是 Rue 生态中的全栈应用框架包。它面向已经熟悉 Next.js 应用模型的开发者，基于 Vite、Rue、RSC 与文件系统路由，提供 App Router / Pages Router、SSR、静态生成、API 路由、中间件以及 Cloudflare Workers 部署能力。

这个项目参考了 Vercel 的 [Next.js](https://github.com/vercel/next.js) 项目与其应用路由设计，并基于 Cloudflare 的 [vinext](https://github.com/cloudflare/vinext) 项目继续演进。

## 特性

- 基于文件系统的 App Router 与 Pages Router
- 支持 Rue JSX / TSX、服务端渲染与客户端交互
- 支持 React Server Components 风格的服务端组件工作流
- 支持 `middleware.ts`、API routes、redirects、rewrites、headers 等应用级能力
- 内置 `text dev`、`text build`、`text start`、`text deploy` 等 CLI 命令
- 可通过 `text deploy` 部署到 Cloudflare Workers
- 提供兼容 Next.js 常见入口的 shims，例如 `text/navigation`、`text/link`、`text/image`、`text/headers`、`text/cache`

## 安装

前置条件：Node.js >= 22。

```sh
pnpm add @rue-js/text @rue-js/rue vite
```

在项目的 `package.json` 中添加脚本：

```json
{
  "scripts": {
    "dev": "text dev",
    "build": "text build",
    "start": "text start",
    "deploy": "text deploy"
  }
}
```

## 快速开始

创建 `app/page.tsx`：

```tsx
export default function Page() {
  return <main>Hello Text.js</main>
}
```

启动开发服务器：

```sh
pnpm run dev
```

Text.js 会自动配置 Vite 与 Rue 相关插件。多数项目不需要手动维护 `vite.config.ts`。

## 路由示例

### App Router

```tsx
// app/layout.tsx
export default function RootLayout({
  children,
}: {
  children: import('@rue-js/rue').RenderableOutput
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
```

```tsx
// app/blog/[slug]/page.tsx
export default function BlogPage({ params }: { params: { slug: string } }) {
  return <article>{params.slug}</article>
}
```

### API Route

```ts
// app/api/hello/route.ts
export function GET() {
  return Response.json({ message: 'Hello from Text.js' })
}
```

## CLI

```sh
text dev       # 启动开发服务器
text build     # 构建生产产物
text start     # 启动生产服务器
text preview   # text start 的别名
text deploy    # 部署到 Cloudflare Workers
text typegen   # 生成 App Router 路由类型
text lint      # 调用项目中的 eslint / oxlint
text check     # 检查 Text.js 兼容性
text init      # 初始化部署相关配置
```

## 配置

Text.js 支持通过项目配置文件定义路由、部署与运行时行为。默认情况下可以直接从 `app/` 或 `pages/` 目录启动；需要更细的控制时，可以在项目中添加 Text.js 配置文件，并配合 `text init` / `text deploy` 生成 Cloudflare Workers 相关配置。

也可以显式在 Vite 配置中使用插件：

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import text from '@rue-js/text'

export default defineConfig({
  plugins: [text()],
})
```

## 与 Rue.js 的关系

Rue.js 是轻量 JSX / TSX 前端框架，提供响应式能力、渲染运行时与 JSX 入口。

Text.js 则是建立在 Rue 之上的应用框架，负责路由、服务端渲染、构建编排、部署适配和 Next.js 风格 API 兼容。开发 Text.js 时通常会同时用到 `@rue-js/rue`、`@rue-js/rsc`、`@rue-js/server-renderer` 与 `@rue-js/vite-plugin-rue`。

## 本地开发

在 Rue monorepo 中开发 Text.js：

```sh
pnpm install
pnpm --filter @rue-js/text run dev
pnpm --filter @rue-js/text run build
pnpm --filter @rue-js/text run test-unit
```

常用仓库级检查：

```sh
pnpm run check
pnpm run test
```

## 致谢

Text.js 的设计与实现参考了 [Next.js](https://github.com/vercel/next.js) 的大量应用框架能力，并基于 [Cloudflare vinext](https://github.com/cloudflare/vinext) 项目继续构建。感谢这些项目为全栈前端框架、边缘运行时和文件系统路由提供的基础与启发。

## 许可证

[MIT](./LICENSE)
