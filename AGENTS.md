# Rue

Rue 是一个面向 JSX/TSX 的轻量前端框架，追求简单直观的开发体验，同时提供默认 Block / Vapor 渲染路径、响应式能力、路由和基于 Rust / WebAssembly 的运行时扩展。

## Monorepo Overview

- **Core Framework**: `packages/rue`, `packages/runtime`, `packages/shared`, `packages/jsx-runtime`, `packages/jsx-dev-runtime`
- **Rendering / Runtime**: `packages/runtime-vapor` 提供 Rust / Wasm 侧运行时实现
- **Ecosystem**: `packages/router`, `packages/vite-plugin-rue`, `packages/swc-plugin-rue`, `packages/rue-design`
- **Docs / App**: `docs/` 为文档内容，`app/` 为站点与示例页面
- **Build Tooling**: `scripts/` 包含构建、发布、兼容性检查和 Wasm 相关脚本

## Common Commands

- `pnpm install`: 安装工作区依赖
- `pnpm run dev`: 启动 Rue 开发流程
- `pnpm run build`: 构建核心包
- `pnpm run check`: 运行 TypeScript 检查
- `pnpm run test`: 运行兼容性检查和 Vitest
- `pnpm run test-unit`: 仅运行单元测试
- `pnpm run test-e2e`: 构建后运行 E2E 测试
- `pnpm run release-check`: 发布前检查

## Working Areas

- 修改核心运行时或 JSX 行为时，优先查看 `packages/runtime` 与 `packages/rue`
- 修改路由能力时，查看 `packages/router`
- 修改构建产物、格式或包输出时，查看 `scripts/build.js` 与相关脚本
- 修改 Vapor / Wasm 能力时，重点关注 `packages/runtime-vapor` 及其配套测试
