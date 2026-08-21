# 任务 7: 让行 owner 持有组件与不透明 renderable

批次：【批次 6】 依赖批次 4、5

状态：未开始

目的：让组件和可返回任意 renderable 的调用使用行 owned mounted handle，并在一次 DOM commit 后提交 mounted 生命周期。

来源任务：无

预计会话范围：聚焦组件/任意 renderable 的 build、owned update/dispose、批量 commit、mounted 时序和异常回滚；不扩大编译期纯度推断。

## 文件

- 修改：`packages/runtime/src/vapor-helpers.ts`
- 修改：`packages/runtime/src/vapor-helpers-vapor.ts`
- 修改：`packages/runtime/src/vapor-runtime.ts`
- 修改：`packages/runtime-vapor/src/runtime/core.rs`
- 修改：`packages/runtime-vapor/src/runtime/bridge/mod.rs`
- 修改：`packages/runtime-vapor/src/runtime/render/anchor.rs`
- 修改：`packages/runtime-vapor/src/runtime/render/range.rs`
- 修改：`packages/runtime-vapor/src/runtime/render_lifecycle.rs`
- 修改：`packages/runtime-vapor/src/runtime/real_dom/component.rs`
- 修改：`packages/swc-plugin-rue/src/element_list.rs`
- 测试：`packages/runtime/__tests__/complexListRows.performance.spec.tsx`
- 测试：`packages/runtime/__tests__/renderable-lifecycle.spec.ts`
- 测试：`packages/swc-plugin-rue/tests/complex_list_rows.rs`

## 上下文

- 组件可能多根、注册 hooks、替换根；不透明调用可能返回 primitive、DOM、组件、数组或 Promise，不能使用 leaf 假设。
- 与 Solid 的每项 root 类似，组件实例及其 mounted subtree 必须是行 owner 的后代；但 Rue mounted 只能在批量 Fragment 进入真实父节点后执行，ref 仍保持创建期时序。

## 测试计划

- 行为：组件/不透明行只做一次列表父节点写入；调用每行一次且从左到右；ref 创建期未连接，mounted 时已连接；更新、替换、删除、异常回滚和清空各清理一次；全局 map 不随行数增长。
- 失败验证测试：`complexListRows.performance.spec.tsx` 中 `component and opaque rows are descendants of the row owner`。
- 失败验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/complexListRows.performance.spec.tsx -t "component and opaque rows are descendants of the row owner"`
- 预期失败原因：当前组件/不透明值逐行调用全局 renderBetween，mounted state 不由行 owner 直接持有，且 mounted 可能在 detached Fragment 中过早提交。
- 通过验证命令：`pnpm --filter @rue-js/runtime-vapor test && pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/complexListRows.performance.spec.tsx packages/runtime/__tests__/renderable-lifecycle.spec.ts`
- 模拟策略：真实函数组件、hooks、不同 renderable 返回和一次抛错；只记录 hook/调用顺序。

## 步骤

1. 添加连接状态、源码顺序、owner 后代、异常回滚和生命周期恰好一次红测。
2. 复用任务 6 的 owned mounted handle，让组件和不透明值创建在对应行 owner scope 内。
3. 初始所有行先构建进批量 Fragment；记录 pending mounted，真实 DOM commit 后按源码顺序 flush。
4. 保持创建期 ref；异常时逆序 dispose 已构建 owner、清理 ref、不提交 mounted、不留下 DOM/handle。
5. SWC 将组件与不透明 renderable 标记为 owned batch mount，不推断调用纯度或返回形状。
6. 运行组件、renderable、runtime-vapor、SWC 和复杂矩阵回归。

## 验证

- 运行：`pnpm --filter @rue-js/runtime-vapor test && cargo test --manifest-path packages/swc-plugin-rue/Cargo.toml && pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/complexListRows.performance.spec.tsx packages/runtime/__tests__/renderable-lifecycle.spec.ts`
- 预期：退出码 0；组件/不透明行单次 commit，owner 后代、ref/mounted 时序、回滚和卸载全部通过。
- 所需证据：父节点写入、owned/global mount、hook/ref/call 序列、异常后零残留、三套回归退出码。

## 完成

完成时组件和任意 renderable 保留 Rue runtime patch/lifecycle 语义，同时作为行 owner 子树直接更新和销毁。
