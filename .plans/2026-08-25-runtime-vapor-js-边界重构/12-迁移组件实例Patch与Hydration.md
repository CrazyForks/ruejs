# 任务 12: 迁移组件实例、Patch 与 Hydration

批次：【批次 12】 依赖批次 11

状态：未开始

目的：迁移组件实例、props 更新、组件 patch、现有节点接管和 JS Hook carrier 集成。

来源任务：无

预计会话范围：只覆盖组件创建/更新/卸载与 hydration adoption；生命周期钩子派发和 app/plugin 留给后续任务。

## 文件

- 新建：`packages/runtime-vapor/js-runtime/instance.js`
- 新建：`packages/runtime-vapor/js-runtime/component.js`
- 新建：`packages/runtime-vapor/js-runtime/patch/component.js`
- 修改：`packages/runtime-vapor/js-runtime/create-rue.js`
- 修改：`packages/runtime-vapor/js-reactive/hooks/context.js`
- 测试：`packages/runtime/__tests__/runtimeVapor.js-component-parity.spec.ts`
- 测试：`packages/runtime/__tests__/runtimeVapor.js-hydration-adoption.spec.ts`
- 测试：`packages/runtime/__tests__/component-props-reactivity.spec.tsx`

## 上下文

- 对照 `src/runtime/instance.rs`、`real_dom/component.rs`、`render_patch/component.rs` 和 transport/props。
- 每个组件实例必须承载任务 3 的 Hook 上下文；props 更新不应重建稳定 Hook 槽位。Hydration 只覆盖现有 Runtime 已支持的 DOM adoption。

## 测试计划

- 行为：创建、props patch、子树替换、卸载、输入状态保留和现有 DOM adoption 与 Rust 后端一致。
- 失败验证测试：新增组件事件/DOM 差分及 hydration adoption 测试，JS 后端缺少实例和 component patch 时失败。
- 失败验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/runtimeVapor.js-component-parity.spec.ts packages/runtime/__tests__/runtimeVapor.js-hydration-adoption.spec.ts`
- 预期失败原因：JS Runtime 尚未建立组件实例与 patch 路径。
- 通过验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/runtimeVapor.js-component-parity.spec.ts packages/runtime/__tests__/runtimeVapor.js-hydration-adoption.spec.ts packages/runtime/__tests__/component-props-reactivity.spec.tsx packages/runtime/__tests__/input.actual.spec.tsx`
- 模拟策略：使用真实 jsdom、真实 Hook façade 和组件函数；不模拟组件树。

## 步骤

1. 写组件更新、子树替换、Hook 槽位保持和 adoption 的失败差分测试。
2. 确认 JS 后端能力缺失而 Rust 参考通过。
3. 实现实例结构、component render/patch/unmount，并绑定 Hook carrier。
4. 实现现有 DOM adoption 和输入状态保留的现有契约。
5. 运行 renderable、props、input 与 range 回归。

## 验证

- 运行：通过验证命令与 `pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/component.renderable.spec.tsx packages/runtime/__tests__/file-input.actual.spec.tsx`。
- 预期：组件 DOM、props 响应、Hook 身份和输入状态与参考一致。
- 所需证据：失败/通过输出、组件事件日志、DOM 快照和 hydration/input 结果。

## 完成

只有组件实例的完整创建更新释放闭环由 JS 承载，Hook 与 hydration 行为不漂移时才算完成。
