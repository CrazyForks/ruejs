# Rue

Rue 是一个面向 JSX/TSX 的轻量前端框架，追求简单直观的开发体验，同时提供响应式能力、路由和基于 Rust / WebAssembly 的运行时扩展。

## 工作流

1. 搜索与理解
   - 代码导航优先使用 `./skills/rustcodegraph/SKILL.md` skill；未索引、文档/配置或图未覆盖时使用 `rg` 与文件读取。
   - 实现前用代码搜索验证假设。
2. 定义范围
   - 明确当前任务的修改边界，不顺手改无关模块。
3. 最小实现
   - 沿用现有模式；当复制小段局部逻辑更清晰时允许复制。
4. 风险匹配验证
   - 文档变更做轻量检查。
   - 代码或高风险变更执行相关检查与聚焦场景。

## Monorepo Overview

- **Core Framework**: `packages/rue`, `packages/runtime`, `packages/shared`
- **Rendering / Runtime**: `packages/runtime-vapor` 提供 Rust / Wasm 侧运行时实现
- **Ecosystem**: `packages/router`, `packages/vite-plugin-rue`, `packages/swc-plugin-rue`, `packages/rue-design`
- **Docs / App**: `docs/` 为文档内容，`app/` 为站点与示例页面
- **Build Tooling**: `scripts/` 包含构建、发布和 Wasm 相关脚本

## Common Commands

- `pnpm install`: 安装工作区依赖
- `pnpm run dev`: 启动 Rue 开发流程
- `pnpm run build`: 构建核心包
- `pnpm run check`: 运行 TypeScript 检查
- `pnpm run test`: 运行 Vitest
- `pnpm run test-unit`: 仅运行单元测试
- `pnpm run test-e2e`: 构建后运行 E2E 测试
- `pnpm run release-check`: 发布前检查

## Working Areas

- 修改核心运行时或 JSX 行为时，优先查看 `packages/runtime` 与 `packages/rue`
- 修改路由能力时，查看 `packages/router`
- 修改构建产物、格式或包输出时，查看 `scripts/build.js` 与相关脚本
- 修改 Vapor / Wasm 能力时，重点关注 `packages/runtime-vapor` 及其配套测试
