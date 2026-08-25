# 任务 16: 删除 Rust 外壳并统一浏览器内核

批次：【批次 16】 依赖批次 15

状态：未开始

目的：删除 `src/runtime`、`src/hook` 与 stub，移除完整浏览器 `pkg`，让完整/Vapor 入口共享唯一 `pkg-vapor` 内核。

来源任务：无

预计会话范围：执行已验证代码的删除、Cargo/build 收口和产物契约更新；Node 继续保留 `pkg-node`，不调整最终性能预算。

## 文件

- 删除：`packages/runtime-vapor/src/runtime/`
- 删除：`packages/runtime-vapor/src/hook/`
- 删除：`packages/runtime-vapor/src/runtime_stub.rs`
- 修改：`packages/runtime-vapor/src/lib.rs`
- 修改：`packages/runtime-vapor/Cargo.toml`
- 修改：`packages/runtime-vapor/package.json`
- 修改：`packages/runtime-vapor/scripts/run-wasm-pack.mjs`
- 修改：`packages/runtime-vapor/index.js`
- 修改：`packages/runtime-vapor/reactive.js`
- 修改：`packages/runtime-vapor/vapor-bridge.js`
- 修改：`scripts/build.js`
- 修改：`scripts/__tests__/runtime-vapor-artifacts.spec.ts`
- 测试：`packages/runtime-vapor/tests/runtime_wasm_rue.rs`
- 测试：`packages/runtime-vapor/tests/test_hook_wrappers.rs`

## 上下文

- 只有任务 15 已证明所有生产入口使用 JS 外壳后才能删除 Rust 文件。
- 最终浏览器完整与 Vapor 入口必须导入同一 `pkg-vapor` 模块实例；混合 bundle 从“两份 Wasm 并拒绝执行”改为“一份 canonical Wasm 且可互操作”。Node 仍用 `pkg-node`。
- Rust runtime/hook tests 必须逐项映射到现有 JS 差分测试后才能删除或改写；不得无证据丢弃覆盖。

## 测试计划

- 行为：浏览器完整+Vapor 混合 bundle 只含一个同 hash 的 Wasm 内核并可共同执行，Rust 只剩 reactive 图导出。
- 失败验证测试：先修改 artifact 测试期待单 canonical 内核、无 runtime/hook WasmRue 导出和混用成功；当前三产物结构应失败。
- 失败验证命令：`pnpm exec vitest run --project unit scripts/__tests__/runtime-vapor-artifacts.spec.ts`
- 预期失败原因：当前仍构建 `pkg` 与 `pkg-vapor` 两个浏览器 Wasm，guard 会拒绝混用，Rust 外壳仍参与编译。
- 通过验证命令：`pnpm run prepare-unit-test-artifacts && pnpm exec vitest run --project unit scripts/__tests__/runtime-vapor-artifacts.spec.ts && pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/vaporEntry.interop.spec.tsx packages/runtime/__tests__/runtimeVapor.js-*.spec.ts`
- 模拟策略：直接检查真实构建产物、Wasm 导出表、hash 和混合入口运行；不模拟 bundler 或 Wasm。

## 步骤

1. 建立 Rust test 到 JS 差分/现有 runtime test 的覆盖映射，补足缺项。
2. 先把 artifact 契约改为最终单浏览器内核并确认失败。
3. 删除 Rust runtime/hook/stub，收窄 `lib.rs` 与 Cargo feature，移除完整浏览器 `pkg` 构建。
4. 让 `index.js`、`reactive.js` 与 Vapor 入口共享 `pkg-vapor`；把 identity guard 收口为同内核验证。
5. 重建产物并运行完整入口、混合 bundle、Rust reactive 和 JS 差分回归。

## 验证

- 运行：通过验证命令、`cargo test --manifest-path packages/runtime-vapor/Cargo.toml` 与 `pnpm run check`。
- 预期：浏览器 bundle 只有一份 canonical Wasm；混用成功；Node 独立；Rust 中无 `src/runtime`、`src/hook` 或 WasmRue 外壳符号。
- 所需证据：失败/通过 artifact 输出、Wasm hash/导出表、删除映射、Rust/JS 测试数及代码搜索零命中。

## 完成

只有每个被删除 Rust 行为都有 JS 测试映射、浏览器双 Wasm 已消除、Node 保持可用且 reactive Rust tests 全通过时才算完成。
