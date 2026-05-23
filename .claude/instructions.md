# Rue

**Scope**: 整个 Rue 仓库。

## Project Structure

| Directory                  | Purpose                                  |
| -------------------------- | ---------------------------------------- |
| `/packages/`               | 核心包、运行时、路由、设计系统与构建插件 |
| `/app/`                    | 文档站和示例页面                         |
| `/docs/`                   | 文档内容                                 |
| `/scripts/`                | 构建、发布、兼容性与开发脚本             |
| `/packages/runtime-vapor/` | Rust / Wasm 运行时实现                   |

## Key Packages

| Package                   | Purpose                       |
| ------------------------- | ----------------------------- |
| `@rue-js/rue`             | 框架主入口与 JSX/TSX 开发 API |
| `@rue-js/runtime`         | 运行时导出与渲染桥接          |
| `@rue-js/runtime-vapor`   | Vapor / Wasm 底层实现         |
| `@rue-js/router`          | 官方路由                      |
| `@rue-js/design`          | 设计系统与组件库              |
| `@rue-js/vite-plugin-rue` | Vite 集成                     |
| `@rue-js/swc-plugin-rue`  | SWC JSX 转换插件              |

## Requirements

- **Node**: Must be installed.
- **Package Manager**: Use `pnpm` for this repository.
- **Rue Codegen**: When generating Rue code or translating from Vue 3 / React, use `/rue` guidance and keep output in Rue idioms.

## Verification

- Prefer `pnpm run check` for type verification.
- Prefer `pnpm run test`, `pnpm run test-unit`, or `pnpm run test-e2e` based on the touched area.

## Commands

| Command           | Purpose                                                   |
| ----------------- | --------------------------------------------------------- |
| `/rue`            | Rue code generation and Vue 3 / React difference guidance |
| `/compat-cleanup` | Check for removed compat symbols and migration leftovers  |
| `/vapor-debug`    | Debug Vapor / Wasm traps and decode runtime-vapor stacks  |

## Building

- Use local build commands only when the touched area requires them.
- Common commands: `pnpm run dev`, `pnpm run build`, `pnpm run release-check`.
