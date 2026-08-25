# 任务 7: 迁移 computed Hook 并收窄 Rust 原语

批次：【批次 7】 依赖批次 6

状态：未开始

目的：把 computed Hook 的包装与槽位语义迁到 JS，仅在 Rust 图中保留惰性失效所需的最小原语。

来源任务：无

预计会话范围：只处理 computed Hook 与其直接依赖的 reactive 原语，不重写整个响应式图。

## 文件

- 新建：`packages/runtime-vapor/js-reactive/hooks/computed.js`
- 修改：`packages/runtime-vapor/js-reactive/hooks/index.js`
- 修改：`packages/runtime-vapor/js-reactive/facade.js`
- 修改：`packages/runtime-vapor/src/reactive/computed.rs`
- 修改：`packages/runtime-vapor/src/reactive/signal.rs`
- 测试：`packages/runtime/__tests__/runtimeVapor.js-computed-hook-parity.spec.ts`
- 测试：`packages/runtime-vapor/tests/test_computed.rs`

## 上下文

- Rust 仍负责依赖图、脏标记和惰性求值；JS 负责 Hook 槽位、wrapper 身份与公开 computed API。
- 只暴露 JS 实现实际需要的窄原语，不增加通用回调/配置扩展点。

## 测试计划

- 行为：computed 的惰性、缓存、链式依赖、动态依赖切换、错误恢复与销毁在 JS/Rust Hook 后端一致。
- 失败验证测试：新增 computed Hook 差分测试，并在 Rust test 中锁定新增窄原语的脏标记与缓存行为。
- 失败验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/runtimeVapor.js-computed-hook-parity.spec.ts`
- 预期失败原因：JS Hook 层尚无 computed 槽位，现有 Rust 接口未必提供所需的最小失效能力。
- 通过验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/runtimeVapor.js-computed-hook-parity.spec.ts && cargo test --manifest-path packages/runtime-vapor/Cargo.toml test_computed`
- 模拟策略：真实 Wasm reactive 图；getter 调用次数以测试计数器观测，不模拟图失效。

## 步骤

1. 写惰性、缓存、动态依赖和错误恢复的失败差分测试。
2. 确认差异来自 JS computed Hook/窄原语缺失。
3. 先收窄并测试 Rust 原语，再在 JS 槽位上实现 computed 包装。
4. 验证 wrapper GC、dispose 和链式 computed。
5. 运行完整 reactive Rust tests 与 JS Hook 回归。

## 验证

- 运行：通过验证命令与 `cargo test --manifest-path packages/runtime-vapor/Cargo.toml --test reactive`。
- 预期：getter 次数、值和失效顺序一致；Rust 新接口只覆盖 JS Hook 所需能力。
- 所需证据：失败/通过输出、getter 计数、导出接口 diff 和 Rust 测试结果。

## 完成

只有 `src/hook/computed.rs` 的公开职责已由 JS 等价承载、Rust 图仍通过全部测试且新增边界最小化时才算完成。
