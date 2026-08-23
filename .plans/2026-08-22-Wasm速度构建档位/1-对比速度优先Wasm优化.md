# 任务 1: 对比速度优先 Wasm 优化

批次：【批次 1】 无

状态：未开始

目的：在不改运行时逻辑的前提下，对比 `z/-Oz` 与 `3/-O4`，只在速度收益足以覆盖体积代价时保留候选配置。

来源任务：无

预计会话范围：一个会话内完成基线构建、两行配置修改、候选构建、固定基准与体积对比；不接触编译器、DOM helper 或 benchmark 框架目录。

## 文件

- 修改：`packages/runtime-vapor/Cargo.toml`
- 验证：`packages/runtime-vapor/scripts/benchmark-reactive-graph.mjs`
- 验证：`packages/runtime/__tests__/jsFrameworkBenchmark.list-performance.spec.tsx`
- 验证：`scripts/runtime-size-audit.js`

## 上下文

- 当前 `[profile.release]` 为 `opt-level = "z"`，release `wasm-opt` 为 `-Oz`。
- 候选仅把两处改为 `opt-level = 3` 与 `-O4`；`lto`、`codegen-units`、panic、strip 和 Wasm feature 参数保持不变。
- 不与 `.plans/2026-08-22-keyed选中类名共享Effect` 同时执行；两者会共用生成的 Wasm 和性能验证资源。

## 验证计划

- 行为：候选构建必须通过现有响应式和列表语义测试，且在同机交替测量中改善热路径。
- 基线验证：先用原配置输出 `temp/wasm-opt-ab/baseline-reactive.json`，记录 `pnpm run size-runtime` 输出，并运行一次 1k 列表性能用例。
- 候选验证命令：`pnpm --filter @rue-js/runtime-vapor run build && node packages/runtime-vapor/scripts/benchmark-reactive-graph.mjs --output temp/wasm-opt-ab/candidate-reactive.json --compare temp/wasm-opt-ab/baseline-reactive.json && pnpm run size-runtime`
- 回归验证命令：`pnpm run prepare-unit-test-artifacts && RUE_PERF_TEST=1 RUE_PERF_ROW_COUNT=1000 pnpm vitest run --project unit-jsdom packages/runtime/__tests__/jsFrameworkBenchmark.list-performance.spec.tsx --reporter=verbose`
- 模拟策略：使用真实 release Wasm、真实 Rue runtime 与 jsdom；不 mock 编译器、signal、effect 或 DOM。

## 步骤

1. 确认工作树中 `Cargo.toml` 两个目标参数未被其他任务修改，构建原配置并保存基线 JSON、Wasm 文件字节数和 `size-runtime` 输出。
2. 连续运行基线至少三轮，记录各场景中位数；关闭其他高负载任务，避免单次结果决定结论。
3. 只把 release `opt-level` 改为 `3`、release `wasm-opt` 改为 `-O4`，重新生成 runtime-vapor 与单元测试产物。
4. 运行候选三轮，再交替补跑一轮基线/候选；比较响应式图热路径、1k 列表创建时间、原始 Wasm 与 Brotli 体积。
5. 若响应式图加权中位数至少改善 8%、列表创建不回退超过 3%、Brotli 增长不超过 15%，保留候选；否则仅恢复本任务修改的两行配置。
6. 无论保留或恢复，都运行回归命令、`cargo fmt --manifest-path packages/runtime-vapor/Cargo.toml -- --check` 和 `git diff --check`，在最终回复报告数据与决策。

## 验证

- 运行：`pnpm --filter @rue-js/runtime-vapor run check && pnpm --filter @rue-js/runtime-vapor run test && pnpm run prepare-unit-test-artifacts && pnpm vitest run --project unit-jsdom packages/runtime/__tests__/jsFrameworkBenchmark.list-performance.spec.tsx`
- 预期：Rust 检查、Wasm 测试和列表语义全部通过；候选只有满足速度、回退和体积三项门槛才留在 `Cargo.toml`。
- 所需证据：原配置与候选各至少三轮数据、两份基准 JSON、前后 Wasm/Brotli 字节数、配置保留或恢复的明确结论、全部验证退出码 0、`git diff --check` 通过。

## 完成

`packages/runtime-vapor/Cargo.toml` 最终状态与 A/B 证据一致：通过门槛则使用 `3/-O4`，未通过则保持 `z/-Oz`；没有任何运行时逻辑或公开 API 变化。
