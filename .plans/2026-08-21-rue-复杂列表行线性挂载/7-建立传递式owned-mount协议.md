# 任务 7: 建立传递式 owned mount 协议

批次：【批次 7】 依赖批次 3,4,6

状态：未开始

目的：建立 build/commitMounted/update/dispose/abort 句柄协议，让原生条件、fragment 和嵌套列表传递归属行 owner。

来源任务：无

预计会话范围：建立 Rust/Wasm 句柄存储、generation、当前 owned collector 和原生结构通路；组件 mounted 和不透明返回留给后续任务。

## 文件

- 修改：`packages/runtime-vapor/src/runtime/core.rs`
- 修改：`packages/runtime-vapor/src/runtime/types/mounted.rs`
- 修改：`packages/runtime-vapor/src/runtime/bridge/mod.rs`
- 修改：`packages/runtime-vapor/src/runtime/bridge/render_anchor.rs`
- 修改：`packages/runtime-vapor/src/runtime/bridge/render_between.rs`
- 修改：`packages/runtime-vapor/src/runtime/render/range.rs`
- 修改：`packages/runtime-vapor/src/runtime/render/range_ops.rs`
- 修改：`packages/runtime/src/rue.ts`
- 修改：`packages/runtime/src/vapor-runtime.ts`
- 修改：`packages/runtime/src/vapor-helpers.ts`
- 修改：`packages/runtime/src/vapor-helpers-vapor.ts`
- 修改：`packages/swc-plugin-rue/src/element_list.rs`
- 测试：`packages/runtime/__tests__/complexListRows.performance.spec.tsx`
- 测试：`packages/runtime/__tests__/renderable-lifecycle.spec.ts`

## 上下文

- 只持有行直接子树不足；组件内部、条件和嵌套列表触发的 render 必须在当前 collector 中登记，否则 containment drain 仍会扫描全局 `range_map`。
- 句柄必须使用 generation 防止 stale/ABA 操作，abort 不提交 mounted，dispose 必须幂等。

## 测试计划

- 行为：原生条件/fragment/嵌套列表初始单次 commit；更新只更新本行；删除/清空递归清除；全局 map 不随行数增长；失败 build 执行 abort 且无残留。
- 失败验证测试：`native structural rows retain transitive owned mounts`。
- 失败验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/complexListRows.performance.spec.tsx -t "native structural rows retain transitive owned mounts"`
- 预期失败原因：当前结构行只能注册全局 anchor/range map，且没有可取回 mounted snapshot 的不透明句柄。
- 通过验证命令：`pnpm --filter @rue-js/runtime-vapor test && cargo test --manifest-path packages/swc-plugin-rue/Cargo.toml && pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/complexListRows.performance.spec.tsx packages/runtime/__tests__/renderable-lifecycle.spec.ts`
- 模拟策略：真实 Wasm renderer、条件切换、嵌套 fragment/列表和现有 adapter，不 mock renderer。

## 步骤

1. 添加五阶段协议、stale generation、嵌套列表、更新、删除和 abort 红测。
2. 在 Rue 内建立 owned mount 槽位与单调 generation ID，JS 只持有不透明 token，每次操作校验 generation。
3. 建立可重入的 current owned collector 栈，使用 `finally` 等价边界保证异常时恢复；任何嵌套 renderAnchor/renderBetween 在 collector 激活时成为子 handle，不进入全局 map。
4. 两个 runtime 后端提供同一 JS 协议；不具备 owned 能力的后端显式 fallback，不伪造句柄。
5. owner dispose 调用句柄生命周期清理，不使用全局 containment scan 寻找已归属子树。
6. hydration 时若尚不能保证标记采用，必须显式走现有 fallback 并由回归锁定。

## 验证

- 运行：`pnpm --filter @rue-js/runtime-vapor test && cargo test --manifest-path packages/swc-plugin-rue/Cargo.toml && pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/complexListRows.performance.spec.tsx packages/runtime/__tests__/renderable-lifecycle.spec.ts`
- 预期：退出码 0；原生结构行只使用 owned handle，传递子树、stale token、abort 和 hydration fallback 正确。
- 所需证据：红转绿、owned/global mount 计数、generation 拒绝、递归销毁顺序、abort 零残留和两后端差分结果。

## 完成

完成时原生结构行拥有不依赖全局身份或 containment 扫描的传递式 mounted 所有权。
