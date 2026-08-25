# 任务 3: 迁移 Hook 上下文与槽位

批次：【批次 3】 依赖批次 2

状态：未开始

目的：在 JS façade 中实现与 Rust `src/hook` 等价的 setup 上下文、Hook 槽位顺序和嵌套恢复。

来源任务：无

预计会话范围：只建立 Hook 执行上下文和槽位基础，不迁移具体 state/effect/computed 语义，不切换生产入口。

## 文件

- 新建：`packages/runtime-vapor/js-reactive/hooks/context.js`
- 新建：`packages/runtime-vapor/js-reactive/hooks/index.js`
- 修改：`packages/runtime-vapor/js-reactive/facade.js`
- 测试：`packages/runtime/__tests__/runtimeVapor.js-hook-context-parity.spec.ts`

## 上下文

- 对照 `packages/runtime-vapor/src/hook/use_setup.rs`、`src/reactive/context.rs` 和现有 Hook 测试。
- 上下文必须支持正常返回、嵌套 setup、抛错恢复、重复 render 的稳定槽位；不得依赖 `packages/runtime`，也不得使用进程级不可恢复状态。

## 测试计划

- 行为：JS 上下文在嵌套、抛错和重复执行时与 Rust 后端拥有相同当前实例和槽位语义。
- 失败验证测试：新增差分用例，选择 JS 后端时执行 `useSetup`、嵌套 setup 和错误恢复。
- 失败验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/runtimeVapor.js-hook-context-parity.spec.ts`
- 预期失败原因：JS façade 尚无 Hook 上下文与槽位实现。
- 通过验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/runtimeVapor.js-hook-context-parity.spec.ts packages/runtime/__tests__/runtimeVapor.hook-contract.spec.ts`
- 模拟策略：使用真实 façade 与同步 setup 函数；不模拟 Hook 存储。

## 步骤

1. 为嵌套、抛错恢复、槽位稳定和 setup 外调用写失败差分测试。
2. 确认 JS 后端因缺少上下文失败，Rust 参考后端通过。
3. 实现局部栈式上下文和每实例槽位游标，finally 恢复父上下文。
4. 通过 façade 暴露内部 Hook 执行入口，不改生产入口选择。
5. 运行任务 1 至 2 的相关回归。

## 验证

- 运行：通过验证命令。
- 预期：Rust/JS 两后端所有上下文事件序列一致，setup 抛错后无残留当前实例。
- 所需证据：失败与通过输出、差分事件序列、测试数及共享 façade diff。

## 完成

只有 Hook 上下文可被后续具体 Hook 复用、异常路径清理可靠且未切换任何生产入口时才算完成。
