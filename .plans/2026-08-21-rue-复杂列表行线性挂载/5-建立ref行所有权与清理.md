# 任务 5: 建立 ref 行所有权与清理

批次：【批次 4】 依赖批次 3

状态：未开始

目的：让单根原生 ref 行可在 owner 内批量构建，保持 Rue 创建期赋值语义，并在单行删除时精确清理。

来源任务：无

预计会话范围：只接入 ref watcher/cleanup 到行 owner；不处理组件 mounted 或结构条件子树。

## 文件

- 修改：`packages/swc-plugin-rue/src/attrs.rs`
- 修改：`packages/swc-plugin-rue/src/vapor/mod.rs`
- 修改：`packages/swc-plugin-rue/src/element_list.rs`
- 修改：`packages/swc-plugin-rue/src/attrs_tests.rs`
- 修改：`packages/swc-plugin-rue/src/element_list_tests.rs`
- 修改：`packages/runtime/src/vapor-helpers.ts`
- 修改：`packages/runtime/src/vapor-helpers-vapor.ts`
- 测试：`packages/runtime/__tests__/complexListRows.performance.spec.tsx`
- 测试：`packages/swc-plugin-rue/tests/complex_list_rows.rs`

## 上下文

- `_$vaporBindUseRef` 当前在 Vapor setup 中赋值，因此元素尚未连接，行为与 Solid ref 一致；不得改成 commit 后赋值。
- stop 当前可能注册到外层组件。列表 directRoot 必须把 ref watcher/cleanup 登记到对应 `VaporListItemOwner`，否则删除单行会遗留 ref。

## 测试计划

- 行为：10k ref 行只做一次列表父节点写入；首次回调保持未连接状态与源码顺序；同 key 更新不重复绑定未变 ref；删除和清空逐行清理一次且 watcher 停止。
- 失败验证测试：`complexListRows.performance.spec.tsx` 中 `ref rows preserve creation timing and clean through row owner`。
- 失败验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/complexListRows.performance.spec.tsx -t "ref rows preserve creation timing and clean through row owner"`
- 预期失败原因：当前 ref 行不直挂；若只放宽判定，stop 仍归属外层组件而无法随单行删除。
- 通过验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/complexListRows.performance.spec.tsx && cargo test --manifest-path packages/swc-plugin-rue/Cargo.toml --test complex_list_rows`
- 模拟策略：真实函数 ref 和对象 ref；只记录连接状态、顺序和次数。

## 步骤

1. 添加 ref 创建期时序、同 key 更新、单行删除、清空和构建异常红测。
2. 让列表编译上下文把 ref stop 登记到当前行 owner，而非只调用外层 `onBeforeUnmount`。
3. owner dispose 逆序停止 ref watcher并清空旧 ref，保证重复 dispose 幂等。
4. 初始批量构建按源码顺序赋值 ref；Fragment commit 不重复绑定，异常则清理已赋值 ref。
5. 运行 ref、列表、hydration 和非列表 ref 回归，确认普通 JSX 输出不变。

## 验证

- 运行：`cargo test --manifest-path packages/swc-plugin-rue/Cargo.toml && pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/complexListRows.performance.spec.tsx packages/runtime/__tests__/island.spec.tsx packages/runtime/__tests__/useComponent.lazyHydration.spec.tsx`
- 预期：退出码 0；ref 时序、更新、异常回滚和单行清理通过，非列表 ref 与 hydration 不变。
- 所需证据：红灯 owner 清理、绿灯单次父节点写入、ref 连接状态/调用序列、删除后零调用、完整回归退出码。

## 完成

完成时 ref 是行 owner 的创建期资源，保持 Rue/Solid 语义，并可在移动、删除、清空或异常时精确销毁。
