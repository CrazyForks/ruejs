# 任务 8: 延迟组件 mounted 并回收实例

批次：【批次 8】 依赖批次 7

状态：未开始

目的：让组件行在 Fragment commit 后恢复完整上下文执行 mounted，并在最终销毁时回收组件实例与 wrapper。

来源任务：无

预计会话范围：聚焦组件 build/commitMounted/dispose、pending 队列重入、实例 ID 与 registry 回收；不处理 Promise、Teleport 或 Transition。

## 文件

- 修改：`packages/runtime-vapor/src/runtime/core.rs`
- 修改：`packages/runtime-vapor/src/runtime/real_dom/component.rs`
- 修改：`packages/runtime-vapor/src/runtime/render_lifecycle.rs`
- 修改：`packages/runtime-vapor/src/runtime/types/mounted.rs`
- 修改：`packages/runtime-vapor/src/reactive/context.rs`
- 修改：`packages/runtime-vapor/src/runtime/bridge/mod.rs`
- 修改：`packages/runtime/src/vapor-helpers-vapor.ts`
- 修改：`packages/swc-plugin-rue/src/element_list.rs`
- 测试：`packages/runtime/__tests__/complexListRows.performance.spec.tsx`
- 测试：`packages/runtime/__tests__/renderable-lifecycle.spec.ts`

## 上下文

- 当前 `mount_component` 在挂载过程内立即执行 mounted，并在其后收集 mounted 中新注册的 unmounted hook；简单延迟回调会丢失实例栈、容器、owner 和错误上下文。
- 组件 ID 当前使用 `instance_store.len()`，并且卸载时未删除 instance/wrapper；回收后必须改为单调 ID。

## 测试计划

- 行为：ref 创建期未连接，mounted 时已连接；子先于父且行间源码顺序不变；mounted 中注册的 unmounted 可清理；回调同步删除 owner 时安全；清空后 instance store/CI wrappers/pending queue 恢复基线。
- 失败验证测试：`component rows commit mounted with instance context and release registries`。
- 失败验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/complexListRows.performance.spec.tsx -t "component rows commit mounted with instance context and release registries"`
- 预期失败原因：mounted 在 detached Fragment 中过早执行，实例与 wrapper 在卸载后仍保留。
- 通过验证命令：`pnpm --filter @rue-js/runtime-vapor test && pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/complexListRows.performance.spec.tsx packages/runtime/__tests__/renderable-lifecycle.spec.ts`
- 模拟策略：真实函数组件、hooks、嵌套组件与同步重入；仅记录连接状态、hook 序列和 test/dev registry 计数。

## 步骤

1. 添加连接状态、子/父顺序、mounted 内注册 cleanup、同步重入和 registry 回收红测。
2. 将组件创建拆为 build 和 commitMounted；pending 项保存实例 ID、owner generation、容器和必要上下文。
3. commitMounted 恢复实例/容器/owner/错误上下文，按子树和行源码顺序 flush，回调后重新校验 owner generation。
4. 将组件 ID 改为单调分配；最终 dispose 删除 instance store、CI wrapper、hook/render scope 和宿主链接，patch 复用不删除。
5. abort 不运行 mounted，但清理已创建 scope/实例/子树；已 disposed owner 的 pending mounted 必须跳过。
6. 对组件列表 hydration 补充采用或显式 fallback 回归，不依赖普通 island 测试代替。

## 验证

- 运行：`pnpm --filter @rue-js/runtime-vapor test && cargo test --manifest-path packages/swc-plugin-rue/Cargo.toml && pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/complexListRows.performance.spec.tsx packages/runtime/__tests__/renderable-lifecycle.spec.ts packages/runtime/__tests__/useComponent.lazyHydration.spec.tsx`
- 预期：退出码 0；mounted 只在连接后执行一次，重入安全，卸载后组件/队列注册表恢复基线。
- 所需证据：hook/ref 序列、上下文断言、重入过程、instance/wrapper/scope/pending 前后计数和完整退出码。

## 完成

完成时组件行保持 Rue 生命周期与上下文语义，且最终卸载不保留实例、wrapper 或 pending 记录。
