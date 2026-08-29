# 任务 6: 迁移 Design 根与子路径

批次：【批次 6】 依赖批次 5

状态：未开始

目的：将 `@rue-js/design` 的根入口、组件通配子路径和分块产物全部转为 ESM-only。

来源任务：无

预计会话范围：Design 有独立的多入口构建与打包契约，需单独一个聚焦会话。

## 文件

- 修改：`packages/rue-design/package.json`
- 修改：`packages/rue-design/index.js`
- 修改：`scripts/__tests__/rue-design-subpath-build.spec.ts`
- 修改：`scripts/__tests__/rue-design-package-contract.spec.ts`
- 测试：`scripts/__tests__/rue-design-subpath-build.spec.ts`
- 测试：`scripts/__tests__/rue-design-package-contract.spec.ts`

## 上下文

- Design 同时生成根 CJS 和 `dist/components/cjs/*`，通配导出对 import/require 分流；现有两个契约测试明确要求 CJS。

## 测试计划

- 行为：Design 根与所有组件子路径仅生成和打包 ESM，代表性组件仍可独立导入和 tree-shake。
- 失败验证测试：先将现有两个测试改为 ESM-only 产物、解析和 pack 期望。
- 失败验证命令：`pnpm exec vitest run scripts/__tests__/rue-design-subpath-build.spec.ts scripts/__tests__/rue-design-package-contract.spec.ts --project unit`
- 预期失败原因：现有构建仍产生 CJS 根、组件目录和 require 解析结果。
- 通过验证命令：`node scripts/build.js '^rue-design$' && pnpm exec vitest run scripts/__tests__/rue-design-subpath-build.spec.ts scripts/__tests__/rue-design-package-contract.spec.ts --project unit`
- 模拟策略：不使用 mock；使用真实多入口构建、npm pack 和 Vite 消费者。

## 步骤

1. 先改写现有测试为 ESM-only 期望并确认失败。
2. 转换 Design 门面和根导出，从根与 `subpathEntries` 格式中删除 CJS。
3. 将组件通配导出改为 types/import/default 全部指向 `dist/components/esm/*.js`。
4. 重建 Design，验证 pack 无 `components/cjs` 且代表性子路径构建成功。

## 验证

- 运行：`node scripts/build.js '^rue-design$' && pnpm exec vitest run scripts/__tests__/rue-design-subpath-build.spec.ts scripts/__tests__/rue-design-package-contract.spec.ts --project unit`
- 预期：构建和两个测试退出 0，pack 仅含 ESM 组件分块，未知子路径仍被拒绝。
- 所需证据：失败/通过计数、pack 列表、ESM 分块列表和代表性子路径消费者输出。

## 完成

当 Design 根与全部组件子路径无 CJS 导出/产物，且两个契约测试通过时才能标记完成。
