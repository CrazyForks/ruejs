# 任务 11: 迁移 Owned Mount 与代际管理

批次：【批次 11】 依赖批次 10

状态：未开始

目的：在 JS Runtime 实现 owned mount 的创建、更新、移动、清空、释放及代际防陈旧访问协议。

来源任务：无

预计会话范围：只迁移 owned mount 资源模型，列表编译器和行快路径保持不变。

## 文件

- 新建：`packages/runtime-vapor/js-runtime/owned-mount.js`
- 修改：`packages/runtime-vapor/js-runtime/create-rue.js`
- 修改：`packages/runtime-vapor/js-runtime/render/range.js`
- 测试：`packages/runtime/__tests__/runtimeVapor.js-owned-mount-parity.spec.ts`
- 测试：`packages/runtime/__tests__/vaporKeyedList.fast-path.spec.ts`
- 测试：`packages/runtime/__tests__/complexListRows.performance.spec.tsx`

## 上下文

- 对照 `src/runtime/types/mounted.rs`、`types.rs` 及 owned mount bridge；现有 compiled-row 在 owned 能力不可用时会 fallback。
- JS 实现必须完整提供现行五阶段调用协议与 generation 校验，使快路径无需修改即可启用；不得编辑 compiler、列表 helper 或性能断言门槛。

## 测试计划

- 行为：owned mount 创建到释放的状态转换、range 所有权、移动顺序和陈旧 generation 错误与 Rust 后端一致。
- 失败验证测试：新增状态机差分测试，并要求现有 keyed list 在 JS 后端走同一 owned 快路径。
- 失败验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/runtimeVapor.js-owned-mount-parity.spec.ts`
- 预期失败原因：JS Runtime 尚无 owned mount 表和 generation 管理。
- 通过验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/runtimeVapor.js-owned-mount-parity.spec.ts packages/runtime/__tests__/vaporKeyedList.fast-path.spec.ts packages/runtime/__tests__/complexListRows.performance.spec.tsx`
- 模拟策略：状态机使用真实 JS Runtime 和 DOM；不模拟列表 helper，只注入任务 9 的真实 host。

## 步骤

1. 为五阶段协议、移动、重复释放和陈旧句柄写失败差分测试。
2. 确认 JS 后端缺少 owned mount，而 Rust 参考通过。
3. 实现槽表、generation、range 所有权和幂等清理。
4. 让现有 compiled-row 能力检测自然选择 JS owned 路径，不改其代码。
5. 运行复杂列表与 proxy drift 回归。

## 验证

- 运行：通过验证命令与 `pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/vaporKeyedList.proxyDrift.spec.ts`。
- 预期：状态转换一致，陈旧句柄被拒绝，列表结构与性能计数门槛保持。
- 所需证据：失败/通过输出、状态转换表、host 操作计数和列表测试结果。

## 完成

只有 JS owned mount 可无修改承接当前列表快路径、资源释放有代际保护且不存在双重所有权时才算完成。
