# 任务 5: 迁移状态、缓存与回调 Hook

批次：【批次 5】 依赖批次 4

状态：未开始

目的：在 JS Hook 槽位上实现 `useState`、`useSignal`、`useRef`、`useMemo` 和 `useCallback`。

来源任务：无

预计会话范围：只迁移同步状态类 Hook；effect、computed 与 Runtime 生命周期另行处理。

## 文件

- 新建：`packages/runtime-vapor/js-reactive/hooks/state.js`
- 修改：`packages/runtime-vapor/js-reactive/hooks/index.js`
- 修改：`packages/runtime-vapor/js-reactive/facade.js`
- 测试：`packages/runtime/__tests__/runtimeVapor.js-state-hooks-parity.spec.ts`

## 上下文

- 对照 `src/hook/use_state.rs`、`use_signal.rs`、`use_ref.rs`、`use_memo.rs`、`use_callback.rs` 和对应 Rust tests。
- 函数式 state updater、依赖数组比较、初始值惰性求值、槽位类型稳定和 dispose 后行为必须保持。

## 测试计划

- 行为：相同 Hook 调用序列在 JS/Rust 两后端产生相同值、身份、更新次数和错误。
- 失败验证测试：新增参数化差分测试，包含函数式更新、空依赖、依赖变化、重复 render 和 Hook 顺序错误。
- 失败验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/runtimeVapor.js-state-hooks-parity.spec.ts`
- 预期失败原因：JS Hook 槽位已有基础设施但尚无状态类 Hook。
- 通过验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/runtimeVapor.js-state-hooks-parity.spec.ts packages/runtime/__tests__/runtimeVapor.js-hook-context-parity.spec.ts`
- 模拟策略：使用真实 signal 内核；render 次序由测试后端工具驱动，不模拟 Hook 返回值。

## 步骤

1. 写状态、缓存、回调及错误边界的失败差分测试。
2. 确认 Rust 参考通过、JS 后端按缺失能力失败。
3. 在任务 3 的槽位系统上实现五类 Hook，统一依赖比较。
4. 验证多实例隔离、dispose 和异常恢复。
5. 运行现有 Rust `use_state`、`use_signal`、memo 覆盖测试。

## 验证

- 运行：通过验证命令与 `cargo test --manifest-path packages/runtime-vapor/Cargo.toml use_state`。
- 预期：差分结果一致，初始化只发生一次，更新和 memo 失效次数精确匹配。
- 所需证据：预期失败、通过测试数、调用计数和相关 Rust 测试输出。

## 完成

只有五类 Hook 的公开行为与 Rust 一致、复用统一槽位且不存在跨实例状态污染时才算完成。
