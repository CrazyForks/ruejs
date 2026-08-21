# 任务 4: 拆分直接挂载与 effect 合并

批次：【批次 3】 依赖批次 2 的任务 2

状态：未开始

目的：让无 ref、无结构子树的 spread/显式标量调用行进入 owner 直接批量路径，同时保留必要 watcher。

来源任务：无

预计会话范围：聚焦 SWC 能力判定和既有 directRoot 协议；不处理 ref、组件、含 JSX 的条件或可能返回任意 renderable 的调用。

## 文件

- 修改：`packages/swc-plugin-rue/src/element_list.rs`
- 修改：`packages/swc-plugin-rue/src/element_expr.rs`
- 修改：`packages/swc-plugin-rue/src/vapor/mod.rs`
- 修改：`packages/swc-plugin-rue/src/element_list_tests.rs`
- 修改：`packages/swc-plugin-rue/tests/complex_list_rows.rs`
- 测试：`packages/runtime/__tests__/complexListRows.performance.spec.tsx`

## 上下文

- 当前 `use_direct_root_mount` 与 `coalesce_row_bindings` 共用判定，导致 spread 或任意调用不能合并 watcher 时重新进入外层 renderAnchor。
- Solid 式 owner 允许一行持有多个 fine-grained effect；直接挂载不要求合并 effect。只允许编译期可确定为叶子属性/文本的表达式，未知 renderable 继续交给后续 owned mount。

## 测试计划

- 行为：spread 与 `String/Number/Boolean` 显式标量化调用生成 directRoot，watcher/调用次数和属性删除语义不变；ref、JSX 条件、组件和不透明调用不误入叶子路径。
- 失败验证测试：`complex_list_rows.rs::leaf_spread_and_scalar_calls_direct_mount_without_forced_coalescing`。
- 失败验证命令：`cargo test --manifest-path packages/swc-plugin-rue/Cargo.toml --test complex_list_rows leaf_spread_and_scalar_calls_direct_mount_without_forced_coalescing -- --exact`
- 预期失败原因：当前直接挂载与 effect 合并绑定为同一布尔条件。
- 通过验证命令：`cargo test --manifest-path packages/swc-plugin-rue/Cargo.toml --test complex_list_rows && pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/complexListRows.performance.spec.tsx`
- 模拟策略：真实 SWC 输出与 jsdom；不 mock watcher，只计数调用与目标 DOM 行为。

## 步骤

1. 添加 spread、显式标量调用和四类负例的 codegen/行为红测。
2. 将“可直接挂载”“可批量构建”“可合并 effect”拆成独立能力判定。
3. 对可直挂但不可合并的行保留原 watcher，并由 `VaporListItemOwner` scope 持有。
4. 验证同 key 替换、spread key 删除、事件替换、调用顺序及删除后停止更新。
5. 运行完整 SWC plugin 与复杂矩阵普通模式回归。

## 验证

- 运行：`cargo test --manifest-path packages/swc-plugin-rue/Cargo.toml && pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/complexListRows.performance.spec.tsx`
- 预期：退出码 0；spread/标量调用直挂，watcher 没有被错误合并，其它复杂路径保持保守。
- 所需证据：codegen 红转绿、watcher/调用次数、DOM 更新和删除断言、完整 SWC 测试退出码。

## 完成

完成时叶子复杂表达式拥有 Solid 式“owner 内多个 fine-grained effect”，不会因为不能合并 effect 而失去 direct/batch 能力。
