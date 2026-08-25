# 任务 2: 提取共享 reactive 门面

批次：【批次 2】 依赖批次 1

状态：未开始

目的：消除 `reactive.js`、`reactive.vapor.js`、`reactive.node.js` 的实现复制，以内核注入维持各入口当前身份与行为。

来源任务：无

预计会话范围：只重构 reactive wrapper 组装和注册表生命周期，不迁移 Hook 实现、不切换生产 Runtime 后端。

## 文件

- 新建：`packages/runtime-vapor/js-reactive/facade.js`
- 修改：`packages/runtime-vapor/reactive.js`
- 修改：`packages/runtime-vapor/reactive.vapor.js`
- 修改：`packages/runtime-vapor/reactive.node.js`
- 测试：`packages/runtime/__tests__/runtimeVapor.reactive-entry-parity.spec.ts`
- 测试：`packages/runtime-vapor/scripts/test-wrapper-registry-gc.mjs`

## 上下文

- 三个入口目前近似复制 wrapper、WeakRef 与 FinalizationRegistry 逻辑，但分别注入 `pkg`、`pkg-vapor`、`pkg-node`。
- 共享 façade 必须由入口显式注入内核，不能偷偷创建第二实例；迁移期浏览器完整与 Vapor 身份仍不同，Node 也保持独立。

## 测试计划

- 行为：重构前后三个入口的导出、值包装、订阅清理和注册表回收一致。
- 失败验证测试：先新增 `runtimeVapor.reactive-entry-parity.spec.ts`，要求三个入口通过同一契约，并要求 façade 工厂可注入测试内核；工厂尚不存在时失败。
- 失败验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/runtimeVapor.reactive-entry-parity.spec.ts`
- 预期失败原因：当前入口是三个独立实现，没有可注入的共享 façade。
- 通过验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/runtimeVapor.reactive-entry-parity.spec.ts && node --expose-gc packages/runtime-vapor/scripts/test-wrapper-registry-gc.mjs`
- 模拟策略：公开行为使用真实 Wasm；仅 façade 注入协议使用最小记录型内核，以验证调用形状而非替代真实回归。

## 步骤

1. 写共享契约与可注入 façade 的失败测试。
2. 确认失败来自缺少 façade，而非产物未构建。
3. 把 wrapper、WeakRef 和 FinalizationRegistry 逻辑移动到 `facade.js`，三个入口仅注入对应内核并再导出。
4. 运行三入口契约、GC 脚本和任务 1 的产物契约。
5. 仅在行为与实例身份不变时整理重复代码。

## 验证

- 运行：通过验证命令，并运行 `pnpm exec vitest run --project unit scripts/__tests__/runtime-vapor-artifacts.spec.ts`。
- 预期：三入口公开结果一致；GC 后注册表有界；完整/Vapor 浏览器仍保持任务 1 的不同身份。
- 所需证据：预期失败、通过测试数、GC 前后计数、入口导出快照和 diff 审查。

## 完成

只有三份入口薄化为内核注入、没有新增全局单例泄漏且任务 1 的现有边界完全保持时才算完成。
