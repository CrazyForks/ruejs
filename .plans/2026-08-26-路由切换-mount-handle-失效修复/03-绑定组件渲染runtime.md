# 任务 03：绑定组件渲染 runtime

批次：【批次 3】 依赖批次 1、2

状态：已完成

目的：保证响应式或路由异步触发的组件渲染始终在其所属 runtime 中创建和重放 mount handle。

来源任务：用户复测反馈 stale mount handle 15。

预计会话范围：仅修改 runtime-vapor 组件 render 的 runtime 上下文和多 runtime 回归测试，不放宽 stale handle 协议。

## 文件

- 修改：`packages/runtime-vapor/js-runtime/instance.ts`
- 测试：`packages/runtime/__tests__/runtimeVapor.js-component-parity.spec.ts`
- 测试：`packages/runtime/__tests__/routerView.renderable.spec.tsx`

## 上下文

- repeatable factory 已生成新编号，但 `getRue()` 在路由 effect 的异步 rerender 中会回退到全局默认 runtime。
- handle 被注册到另一个 runtime 的 `mountInputs` 后，当前组件所属 runtime 会将它判定为 unknown。
- `RuntimeState.runtime` 已保存 owning runtime；组件 render 期间需要临时设置 `globalThis.__rue_active` 并在嵌套调用后恢复。

## 测试计划

- 行为：全局默认 runtime 与组件所属 runtime 不同时，组件内部使用高层 `h` 创建 subtree 仍注册到所属 runtime。
- 失败验证测试：`keeps the owning runtime active while a component creates its subtree`。
- 失败验证命令：`pnpm exec vitest run packages/runtime/__tests__/runtimeVapor.js-component-parity.spec.ts --reporter=dot`
- 预期失败原因：高层工厂使用错误的全局 runtime，目标 runtime 抛出 stale or unknown mount handle。
- 通过验证命令：`pnpm exec vitest run packages/runtime/__tests__/runtimeVapor.js-component-parity.spec.ts packages/runtime/__tests__/routerView.renderable.spec.tsx packages/runtime/__tests__/runtimeVapor.js-input-protocol.spec.ts --reporter=dot`
- 模拟策略：创建两个真实 runtime 实例，使用真实高层 `h` 与 runtime-vapor 组件渲染，不模拟协议。

## 步骤

1. 新增多 runtime 失败测试并确认出现精确 stale mount handle。
2. 在组件 render 和结果归一化范围内激活 `state.runtime`。
3. 无论成功或抛错都恢复此前的 active runtime。
4. 运行 component parity、路由和 mount input 协议测试。
5. 运行类型检查与全量 `npm run test`，审查 raw stale handle 仍被拒绝。

## 验证

- 运行：`pnpm exec vitest run packages/runtime/__tests__/runtimeVapor.js-component-parity.spec.ts packages/runtime/__tests__/routerView.renderable.spec.tsx packages/runtime/__tests__/runtimeVapor.js-input-protocol.spec.ts --reporter=dot`
- 预期：多 runtime 组件渲染与路由回访通过，raw stale handle 仍报协议错误。
- 所需证据：修复前精确失败、聚焦测试退出码 0、类型检查和全量测试退出码 0、`git diff --check` 通过。

## 完成

- 修复前，多 runtime 回归测试在组件所属 runtime 中精确抛出 `stale or unknown mount handle 1`；编号来自错误的全局默认 runtime。
- 组件执行及其结果归一化期间会临时激活 `state.runtime`，并在成功或异常后恢复原有 `__rue_active` 所有权状态。
- 聚焦验证通过：4 个测试文件、48 个测试，覆盖 component parity、路由回访、mount input 协议与 context。
- `pnpm run check` 通过。
- `npm run test` 通过：391 个测试文件，1911 个测试通过、1 个 expected fail、6 个 skipped。
- 目标文件的 `git diff --check` 通过；仓库中另外 4 个既有修改文件仍有 EOF 空行提示，本任务未改动这些无关差异。
