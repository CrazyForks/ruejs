# 任务 9: 删除 JSX 包与工具链引用

批次：【批次 5】 依赖批次：批次 4

状态：未开始

目的：物理删除两个 JSX runtime 包，并清理 workspace、TypeScript、构建、发布、体积与示例依赖。

来源任务：无

预计会话范围：以包图和配置清理为主，不再修改组件行为；对遗漏引用 fail closed。

## 文件

- 删除：`packages/jsx-runtime/package.json`
- 删除：`packages/jsx-runtime/src/index.ts`
- 删除：`packages/jsx-dev-runtime/package.json`
- 删除：`packages/jsx-dev-runtime/src/index.ts`
- 修改：`package.json`
- 修改：`pnpm-lock.yaml`
- 修改：`pnpm-workspace.yaml`
- 修改：`tsconfig.json`
- 修改：`tsconfig.build.json`
- 修改：`scripts/build.js`
- 修改：`scripts/vite-package-builder.js`
- 修改：`scripts/ensure-text-test-dependencies.js`
- 修改：`scripts/install-local-js-framework-benchmark.mjs`
- 修改：`scripts/runtime-size-audit.js`
- 修改：`scripts/runtime-size-budget.json`
- 修改：`scripts/__tests__/jsx-esm-package-contract.spec.ts`
- 修改：`scripts/__tests__/workspace-modern-baseline.spec.ts`
- 修改：`scripts/__tests__/runtime-size-audit.spec.ts`
- 修改：`scripts/__tests__/runtime-tree-shaking.spec.ts`
- 修改：`examples/shared/rue-vite.mjs`
- 修改：`examples/vite-express-ssr/tsconfig.json`
- 修改：`examples/static-render/tsconfig.json`
- 修改：`examples/server-islands/package.json`
- 修改：`examples/text-static-export/package.json`
- 修改：`examples/text-blog-ssr/package.json`

## 上下文

- TypeScript 当前为 `react-jsx + jsxImportSource: @rue-js`，这会在类型检查阶段要求 `@rue-js/jsx-runtime`；必须统一改为 `jsx: preserve` 并继续显式包含 `packages/rue/jsx.d.ts`。
- 删除包前，任务 3–8 应已清空执行时调用；本任务不提供 stub package、exports 重定向或 lockfile 残留。

## 测试计划

- 行为：无 JSX runtime 包时安装、类型检查、声明构建、包构建、示例配置和体积审计仍成功，workspace 不再发布或解析旧包名。
- 失败验证测试：先把 package contract 改为断言两个包目录/依赖/alias/预算不存在，并增加全仓配置负向扫描。
- 失败验证命令：`pnpm exec vitest run scripts/__tests__/jsx-esm-package-contract.spec.ts scripts/__tests__/workspace-modern-baseline.spec.ts scripts/__tests__/runtime-size-audit.spec.ts scripts/__tests__/runtime-tree-shaking.spec.ts`
- 预期失败原因：两个包、根依赖、tsconfig paths、构建 aliases、size preset 和示例依赖仍存在。
- 通过验证命令：`pnpm install --lockfile-only && pnpm run check && pnpm run build-dts && pnpm exec vitest run scripts/__tests__/jsx-esm-package-contract.spec.ts scripts/__tests__/workspace-modern-baseline.spec.ts scripts/__tests__/runtime-size-audit.spec.ts scripts/__tests__/runtime-tree-shaking.spec.ts`
- 模拟策略：使用真实 pnpm workspace、TypeScript 和 Vite bundle，不 mock 模块解析。

## 步骤

1. 先反转 package contract：从验证 runtime 包导出改为验证包、workspace 依赖、alias、预算全部不存在。
2. 把根、Text 和示例 tsconfig 改为 `jsx: preserve`，保留 JSX namespace 类型输入并验证不解析 runtime 子路径。
3. 删除两个 package 目录，以及根/子包依赖、workspace allowBuild、build target、alias、ensure/install 脚本引用。
4. 删除 `jsx-runtime-only` 体积预设，把 compiled/client/server 预算改为负向禁止旧模块路径。
5. 更新 lockfile并运行类型/声明/脚本测试，最后执行全仓精确名称扫描。

## 验证

- 运行：`pnpm install --lockfile-only`
- 运行：`pnpm run check && pnpm run build-dts`
- 运行：`pnpm exec vitest run scripts/__tests__/jsx-esm-package-contract.spec.ts scripts/__tests__/workspace-modern-baseline.spec.ts scripts/__tests__/runtime-size-audit.spec.ts scripts/__tests__/runtime-tree-shaking.spec.ts`
- 运行：`rg -n '@rue-js/jsx-runtime|@rue-js/jsx-dev-runtime|packages/jsx-runtime|packages/jsx-dev-runtime|jsxImportSource' --glob '!docs/search-index.json' .`
- 预期：命令退出码 0；两个目录不存在；精确名称搜索为空；TypeScript 不请求 automatic runtime。
- 所需证据：反转后的失败测试、lockfile diff、类型/声明构建成功、包图与搜索空结果。

## 完成

完成时报告删除的包、依赖与配置项，确认是否还有仅作为历史 fixture 的字符串；计划目标要求最终也清理这些 fixture，不得保留可解析旧包名。
