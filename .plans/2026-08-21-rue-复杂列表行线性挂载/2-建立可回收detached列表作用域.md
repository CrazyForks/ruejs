# 任务 2: 建立可回收的 detached 列表作用域

批次：【批次 2】 依赖批次 1

状态：未开始

目的：让每行使用 detached effectScope，每个列表只注册一次外层销毁，并清除已停止 scope 的历史元数据。

来源任务：无

预计会话范围：聚焦 `VaporListState` 创建/销毁和 JS effectScope handle 回收；不引入 owned mounted handle，不改变复杂行 SWC 能力分类。

## 文件

- 修改：`packages/runtime-vapor/reactive.js`
- 修改：`packages/runtime-vapor/reactive.node.js`
- 修改：`packages/runtime-vapor/reactive.d.ts`
- 修改：`packages/runtime/src/vapor-helpers.ts`
- 修改：`packages/runtime/src/vapor-helpers-vapor.ts`
- 修改：`packages/swc-plugin-rue/src/element_list.rs`
- 测试：`packages/runtime/__tests__/effectScope.spec.ts`
- 测试：`packages/runtime/__tests__/vaporKeyedList.fast-path.spec.ts`
- 测试：`packages/swc-plugin-rue/tests/complex_list_rows.rs`

## 上下文

- `effectScope(true)` 已由 JS 绑定到 Rust detached scope；列表不应为每个历史行向外层 scope 保留 cleanup 闭包。
- `stoppedScopeIds` 当前会保留所有已停止 ID；新设计必须让旧 handle 可观察 inactive，但不保留无界历史 ID。

## 测试计划

- 行为：每个列表表达式只创建一次状态并只注册一次 disposer；100 轮创建/清空后存活 scope、handle cache、stopped 元数据和外层 cleanup 恢复基线；外层卸载只清理当前行；无外层 scope 时可显式 dispose。
- 失败验证测试：`vaporKeyedList.fast-path.spec.ts` 中 `releases detached row scopes without historical metadata growth`。
- 失败验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/vaporKeyedList.fast-path.spec.ts -t "releases detached row scopes without historical metadata growth"`
- 预期失败原因：当前列表没有稳定状态级 disposer，已停止 scope ID 会长期保留。
- 通过验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/effectScope.spec.ts packages/runtime/__tests__/vaporKeyedList.fast-path.spec.ts && cargo test --manifest-path packages/swc-plugin-rue/Cargo.toml --test complex_list_rows`
- 模拟策略：真实 effectScope、watchEffect 和列表 helper；仅使用 test/dev 计数器观察元数据，不替换 scope 运行时。

## 步骤

1. 为单次注册、行删除、外层卸载和 100 轮 churn 添加红测。
2. 引入稳定 `VaporListState`，由 SWC 在组件实例的该列表表达式位置只创建一次，在创建时注册一次总 disposer，不再仅生成裸 `Map`。
3. 所有行 scope 使用 `effectScope(true)`；删除行由列表状态显式 stop，外层卸载遍历当前存活行。
4. 将 scope active 状态收敛到 handle 生命期，外部销毁能标记旧 handle inactive，不无界保留 stopped ID。
5. 验证多列表、重复更新、无外层 scope、手动 dispose 和异常构建都不重复注册 disposer 或遗留活动状态。

## 验证

- 运行：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/effectScope.spec.ts packages/runtime/__tests__/vaporKeyedList.fast-path.spec.ts packages/runtime/__tests__/complexListRows.performance.spec.tsx`
- 预期：退出码 0；每列表一个总 disposer，只清理存活行，100 轮 churn 后历史 scope 元数据不增长。
- 所需证据：红测输出、外层 cleanup 次数、scope/handle/stopped 基线前后计数、两个 helper 差分结果和退出码。

## 完成

完成时列表拥有稳定状态级销毁边界，detached 行 scope 无历史父 cleanup 或 stopped ID 增长。
