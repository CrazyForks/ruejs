# 任务 4: 迁移 JSX 运行时

批次：【批次 4】 依赖批次 3

状态：未开始

目的：将 `@rue-js/jsx-runtime` 和 `@rue-js/jsx-dev-runtime` 转为 ESM-only，保持自动 JSX 转换入口可用。

来源任务：无

预计会话范围：两个包结构对称、依赖相同，共用一个 JSX 消费者验证故放在同一任务。

## 文件

- 新建：`scripts/__tests__/jsx-esm-package-contract.spec.ts`
- 修改：`packages/jsx-runtime/package.json`
- 修改：`packages/jsx-runtime/index.js`
- 修改：`packages/jsx-dev-runtime/package.json`
- 修改：`packages/jsx-dev-runtime/index.js`
- 测试：`scripts/__tests__/jsx-esm-package-contract.spec.ts`

## 上下文

- 两个包都依赖已迁移的 Rue，当前 `index.js` 是 NODE_ENV CJS 切换器，只配置 `esm-bundler,cjs`。

## 测试计划

- 行为：生产与开发 JSX runtime 包仅发布 ESM，真实 TSX 消费者可解析 `jsx/jsxs/jsxDEV/Fragment`。
- 失败验证测试：`jsx-esm-package-contract.spec.ts` 的两包清单、pack 和 Vite TSX 消费者契约。
- 失败验证命令：`node scripts/build.js '^jsx-runtime$' '^jsx-dev-runtime$' && pnpm exec vitest run scripts/__tests__/jsx-esm-package-contract.spec.ts --project unit`
- 预期失败原因：两包仍包含 CJS 门面、require 条件与 CJS pack 文件。
- 通过验证命令：`node scripts/build.js '^jsx-runtime$' '^jsx-dev-runtime$' && pnpm exec vitest run scripts/__tests__/jsx-esm-package-contract.spec.ts --project unit`
- 模拟策略：不使用 mock；构建实际 TSX 消费者。

## 步骤

1. 先增加失败的两包发布与 TSX 消费者契约。
2. 将两包声明为 `type: module`，转换 ESM 门面并删除 require/CJS 格式。
3. 完整重建两包，运行真实 TSX 消费者测试。

## 验证

- 运行：`node scripts/build.js '^jsx-runtime$' '^jsx-dev-runtime$' && pnpm exec vitest run scripts/__tests__/jsx-esm-package-contract.spec.ts --project unit`
- 预期：构建与测试退出 0，两个 pack 无 CJS，TSX 消费者构建成功。
- 所需证据：修改前失败、通过测试数、两个 pack 列表与消费者构建输出。

## 完成

仅当两个 JSX 包无 CJS 契约且真实 TSX 消费者通过时才能标记完成。
