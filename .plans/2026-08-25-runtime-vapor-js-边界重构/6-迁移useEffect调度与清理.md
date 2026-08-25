# 任务 6: 迁移 useEffect 调度与清理

批次：【批次 6】 依赖批次 5

状态：未开始

目的：将 `useEffect` 的依赖比较、执行调度、cleanup 与卸载语义迁移到 JS Hook 层。

来源任务：无

预计会话范围：只覆盖 Hook effect，不改底层 reactive effect 图或 Runtime 生命周期 API。

## 文件

- 新建：`packages/runtime-vapor/js-reactive/hooks/effect.js`
- 修改：`packages/runtime-vapor/js-reactive/hooks/index.js`
- 修改：`packages/runtime-vapor/js-reactive/facade.js`
- 测试：`packages/runtime/__tests__/runtimeVapor.js-use-effect-parity.spec.ts`

## 上下文

- 对照 `src/hook/use_effect.rs`、`tests/test_use_effect.rs` 和当前 runtime dispose 顺序。
- cleanup 必须在依赖变化前和卸载时恰好执行一次；effect 抛错不能破坏 Hook 上下文或吞掉后续 cleanup。

## 测试计划

- 行为：首次执行、依赖不变/变化、cleanup、抛错和卸载的事件序列与 Rust 后端一致。
- 失败验证测试：新增事件日志差分测试，JS 后端尚无 `useEffect` 时失败。
- 失败验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/runtimeVapor.js-use-effect-parity.spec.ts`
- 预期失败原因：JS Hook 层未实现 effect 槽位与 cleanup 调度。
- 通过验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/runtimeVapor.js-use-effect-parity.spec.ts packages/runtime/__tests__/runtimeVapor.js-state-hooks-parity.spec.ts`
- 模拟策略：底层 signal/effect 使用真实内核；仅以同步可控 flush 边界消除计时不确定性。

## 步骤

1. 为 effect/cleanup 全生命周期写失败事件序列测试。
2. 确认 JS 后端缺失，Rust 参考序列稳定。
3. 实现 effect 槽位、依赖比较、cleanup 替换和实例 dispose 集成。
4. 覆盖 effect 与 cleanup 分别抛错的恢复路径。
5. 运行 Hook 上下文、state 与现有 Rust effect 测试。

## 验证

- 运行：通过验证命令与 `cargo test --manifest-path packages/runtime-vapor/Cargo.toml test_use_effect`。
- 预期：所有事件序列一致，cleanup 无遗漏或重复，上下文在异常后已恢复。
- 所需证据：失败/通过日志、事件序列、执行次数和 Rust 测试退出码。

## 完成

只有 `useEffect` 的调度和清理语义可由 JS 独立承载，并且不改变底层图调度时才算完成。
