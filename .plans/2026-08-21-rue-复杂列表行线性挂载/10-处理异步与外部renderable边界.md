# 任务 10: 处理异步与外部 renderable 边界

批次：【批次 10】 依赖批次 9

状态：未开始

目的：为 Promise、Teleport、Transition、KeepAlive 和 Suspense 明确 owned 策略或安全 fallback，阻止迟到提交和外部宿主泄漏。

来源任务：无

预计会话范围：只处理已识别的异步或外部宿主边界及取消语义；不要求所有边界强行进入行 owner 快路径。

## 文件

- 修改：`packages/runtime/src/rue.ts`
- 修改：`packages/runtime/src/vapor-runtime.ts`
- 修改：`packages/runtime/src/vapor-helpers.ts`
- 修改：`packages/runtime/src/vapor-helpers-vapor.ts`
- 修改：`packages/runtime/src/components/Teleport.ts`
- 修改：`packages/runtime/src/components/Transition.ts`
- 修改：`packages/runtime/src/components/KeepAlive.ts`
- 修改：`packages/runtime/src/components/Suspense.ts`
- 修改：`packages/swc-plugin-rue/src/element_list.rs`
- 测试：`packages/runtime/__tests__/renderable-lifecycle.spec.ts`
- 测试：`packages/runtime/__tests__/complexListRows.performance.spec.tsx`

## 上下文

- Promise 解析、Transition 延迟离场和 Suspense pending 都可能在 owner 已删除或复用后回调，必须校验 owner generation 并可取消。
- Teleport 的 DOM 不在列表 containment 内；KeepAlive 的 deactivate 也不等价于最终 dispose。若现有协议无法完整表达，保留显式全局 fallback 比半拥有更安全。

## 测试计划

- 行为：Promise 在删除/复用后 resolve 或 reject 不提交旧结果；Teleport 清理外部目标；Transition 延迟回调不复活行；KeepAlive 区分 deactivate/dispose；Suspense pending 删除后无残留。
- 失败验证测试：`async and external row renderables cancel or fallback safely`。
- 失败验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/renderable-lifecycle.spec.ts -t "async and external row renderables cancel or fallback safely"`
- 预期失败原因：当前 owner generation、外部宿主和延迟回调之间没有统一取消或明确 fallback 契约。
- 通过验证命令：`cargo test --manifest-path packages/swc-plugin-rue/Cargo.toml && pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/renderable-lifecycle.spec.ts packages/runtime/__tests__/complexListRows.performance.spec.tsx packages/runtime/__tests__/useComponent.lazyHydration.spec.tsx`
- 模拟策略：真实 Promise/microtask、Teleport target 和内建组件；测试时只控制 resolve 时机和记录生命周期，不替换调度器。

## 步骤

1. 为五类边界分别添加删除、同 key 复用、清空、外层卸载和迟到回调红测。
2. 为每类边界记录明确决策：完整 owned、带 generation 的可取消 owned，或现有全局安全 fallback；不允许隐式落入同步 leaf。
3. Promise/Suspense pending 保存 owner generation，resolve/reject 前验证存活性；dispose/abort 移除 pending 和回调引用。
4. Teleport owned 时登记外部 target cleanup；否则保留现有组件路径并验证卸载，不使用列表 containment 推断归属。
5. Transition 与 KeepAlive 保持 deactivate、leave、abort 和最终 dispose 的既有顺序；不能完整保持时关闭该快路径。
6. 两 runtime helper 和 hydration 后端对能力不足返回同一显式 fallback，避免环境间语义漂移。

## 验证

- 运行：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/renderable-lifecycle.spec.ts packages/runtime/__tests__/complexListRows.performance.spec.tsx packages/runtime/__tests__/useComponent.lazyHydration.spec.tsx && pnpm run check`
- 预期：退出码 0；每个异步/外部边界都有受测 owned 策略或显式 fallback，无迟到 DOM、外部节点、pending 或 cleanup 泄漏。
- 所需证据：五类决策表、generation/取消断言、外部 target 前后 DOM、pending/registry 计数、生命周期序列和退出码。

## 完成

完成时所有已识别异步与外部 renderable 都有明确安全边界，不会被同步 owner 优化静默破坏。
