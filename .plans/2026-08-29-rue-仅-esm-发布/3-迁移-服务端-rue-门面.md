# 任务 3: 迁移服务端与 Rue 门面

批次：【批次 3】 依赖批次 2

状态：未开始

目的：将 `@rue-js/server-renderer` 与 `@rue-js/rue` 的根入口和全部有效子路径切换为 ESM-only。

来源任务：无

预计会话范围：处理依赖 Runtime 的服务端层与最终 Rue 门面，是单一连续依赖链。

## 文件

- 新建：`scripts/__tests__/rue-server-esm-package-contract.spec.ts`
- 修改：`packages/server-renderer/package.json`
- 修改：`packages/server-renderer/index.js`
- 修改：`packages/rue/package.json`
- 修改：`packages/rue/index.js`
- 修改：`scripts/__tests__/runtime-vapor-artifacts.spec.ts`
- 删除：`packages/rue/index.mjs`
- 测试：`scripts/__tests__/rue-server-esm-package-contract.spec.ts`

## 上下文

- Rue 的 Node import 当前经 `index.mjs -> index.js -> rue.cjs*.js`；新 `index.js` 应转发 `rue.esm-bundler.js`，bundler 默认仍保留 runtime ESM 入口。
- Rue 的 `./jsx-runtime` 和 `./jsx-dev-runtime` 指向从未打包的目录，应删除，使用独立 JSX 包。

## 测试计划

- 行为：Server Renderer 的根与 3 个子入口、Rue 的根与 4 个有效子入口仅解析到 ESM。
- 失败验证测试：`rue-server-esm-package-contract.spec.ts` 的导出、解析、构建与 dry-run pack 契约。
- 失败验证命令：`node scripts/build.js '^server-renderer$' '^rue$' && pnpm exec vitest run scripts/__tests__/rue-server-esm-package-contract.spec.ts --project unit`
- 预期失败原因：两包的导出和构建配置仍含 CJS，Rue Node import 仍通过 CJS 桥接。
- 通过验证命令：`node scripts/build.js '^server-renderer$' '^rue$' && pnpm exec vitest run scripts/__tests__/rue-server-esm-package-contract.spec.ts scripts/__tests__/runtime-vapor-artifacts.spec.ts --project unit`
- 模拟策略：不使用 mock；直接导入 SSR 与 Rue 公开入口并检查真实 pack。

## 步骤

1. 写入两包失败的 ESM 发布契约。
2. 转换两个 `index.js`、清单和全部子路径，移除 CJS 格式与条件。
3. 删除 Rue `index.mjs` 桥接和无效 JSX 兼容子路径，更新 Rue compiled 断言。
4. 完整重建两包并运行聚焦测试。

## 验证

- 运行：`node scripts/build.js '^server-renderer$' '^rue$' && pnpm exec vitest run scripts/__tests__/rue-server-esm-package-contract.spec.ts scripts/__tests__/runtime-vapor-artifacts.spec.ts --project unit`
- 预期：构建和测试退出 0，两包 dist/pack 无 CJS，Node ESM 可解析全部有效入口。
- 所需证据：实施前失败、实施后通过计数、打包文件列表和导出差异审查。

## 完成

当 Server Renderer/Rue 的全部有效入口、构建格式和 npm pack 均无 CJS，且无效 JSX 别名已显式移除时才能标记完成。
