# 任务 15: 分阶段切换 Vapor、完整与 Node 入口

批次：【批次 15】 依赖批次 14

状态：未开始

目的：先切换精简 Vapor，再切换完整浏览器与 Node 的 Hook/Runtime 外壳到 JS，并在每阶段独立回归。

来源任务：无

预计会话范围：只改入口接线、导出和类型；迁移期继续保留 `pkg`、`pkg-vapor`、`pkg-node` 及现有混用拒绝，不删除 Rust 代码。

## 文件

- 修改：`packages/runtime-vapor/vapor.js`
- 修改：`packages/runtime-vapor/vapor.node.js`
- 修改：`packages/runtime-vapor/index.js`
- 修改：`packages/runtime-vapor/index.node.js`
- 修改：`packages/runtime-vapor/reactive.js`
- 修改：`packages/runtime-vapor/reactive.vapor.js`
- 修改：`packages/runtime-vapor/reactive.node.js`
- 修改：`packages/runtime-vapor/vapor.d.ts`
- 修改：`packages/runtime-vapor/index.d.ts`
- 修改：`packages/runtime-vapor/reactive.d.ts`
- 修改：`packages/runtime-vapor/package.json`
- 修改：`packages/runtime/src/vapor-runtime.ts`
- 测试：`packages/runtime/__tests__/runtimeVapor.js-vapor-entry-switch.spec.ts`
- 测试：`packages/runtime/__tests__/runtimeVapor.js-full-node-entry-switch.spec.ts`

## 上下文

- `vapor-core.ts` 已是精简上层入口，必须保留其 DOM host/scope 组合；生产环境不增加可选 Rust/JS backend flag。
- 先让 `vapor.js` 使用 JS façade + `pkg-vapor` 内核，Vapor 全套通过后再切完整浏览器和 Node。此任务中混用 `pkg`/`pkg-vapor` 仍按当前 guard 拒绝。

## 测试计划

- 行为：每个生产入口实际构造 JS Hook/Runtime 外壳，同时保持公开导出、DOM、SSR、Node 和当前产物身份契约。
- 失败验证测试：先新增入口来源测试，要求可观测后端标记来自构建期内部测试钩子且生产导出无该标记；当前入口仍构造 Rust 外壳而失败。
- 失败验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/runtimeVapor.js-vapor-entry-switch.spec.ts packages/runtime/__tests__/runtimeVapor.js-full-node-entry-switch.spec.ts`
- 预期失败原因：生产入口尚未接入 JS Runtime/Hook façade。
- 通过验证命令：`pnpm run prepare-unit-test-artifacts && pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/runtimeVapor.js-vapor-entry-switch.spec.ts packages/runtime/__tests__/vaporEntry.interop.spec.tsx && pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/runtimeVapor.js-full-node-entry-switch.spec.ts packages/runtime/__tests__/runtimeVapor.js-*.spec.ts`
- 模拟策略：使用真实构建入口和真实 Wasm；内部来源断言只在测试构建注入，不能成为公开后端开关。

## 步骤

1. 写 Vapor、完整浏览器和 Node 入口来源失败测试。
2. 仅切换 Vapor 入口，运行 Vapor 差分、app、列表、错误和产物测试。
3. Vapor 通过后切换完整浏览器入口，运行完整 DOM/组件回归。
4. 最后切换 Node 入口并运行 SSR/Node 回归；更新类型与 package exports。
5. 确认三套 Wasm 产物和当前混用拒绝仍存在，为下一任务提供安全切点。

## 验证

- 运行：通过验证命令、`pnpm run check` 与 `pnpm exec vitest run --project unit scripts/__tests__/runtime-vapor-artifacts.spec.ts`。
- 预期：所有入口使用 JS 外壳且行为通过；Rust runtime/hook 文件仍在；产物结构暂与任务 1 一致。
- 所需证据：两个阶段各自的失败/通过输出、入口来源、类型检查、测试数和产物身份。

## 完成

只有 Vapor、完整浏览器、Node 三阶段分别获得回归证据且没有同时改变 Wasm 产物结构时才算完成。
