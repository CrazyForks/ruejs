# 任务 1: 校正嵌套 effect 调度

批次：【批次 1】 无

状态：已完成

目的：保证同步调度下活动 effect 祖先不会重入，并且被延迟的更新只产生一次有效后续执行。

来源任务：无

预计会话范围：只处理 runtime-vapor 活动 effect 栈、pending 队列和对应 Rust/Wasm 测试，避免把框架级问题转嫁给 rue-design 组件。

## 文件

- 修改：`packages/runtime-vapor/src/reactive/core.rs`
- 测试：`packages/runtime-vapor/tests/test_nested_effect.rs`
- 测试：`packages/rue-design/src/components/input/__tests__/Input.spec.tsx`
- 测试：`packages/rue-design/src/components/transfer/__tests__/Transfer.spec.tsx`

## 上下文

- `run_effect_body` 维护 `CURRENT_EFFECT` 与活动 effect 上下文。
- `schedule_effect_run` 在 sync 模式下必须区分安全的同步执行与活动链重入，并对延迟执行去重。
- 现有三个 rue-design 失败用例是本任务的集成失败基线，不得修改或放宽。

## 测试计划

- 行为：嵌套 effect 写入活动祖先依赖时延迟且仅重跑一次，普通事件更新仍保持组件状态和 DOM 一致。
- 失败验证测试：现有 `nested_effect_defers_active_ancestor_reentry`、Input 受控可见性用例、Transfer 分页与渲染期写入用例。
- 失败验证命令：`pnpm exec vitest run packages/rue-design/src/components/input/__tests__/Input.spec.tsx packages/rue-design/src/components/transfer/__tests__/Transfer.spec.tsx --project rue-design-jsdom`
- 预期失败原因：活动祖先延迟后的 pending/依赖状态导致重复或丢失的后续渲染，三个集成断言失败。
- 通过验证命令：`pnpm --filter @rue-js/runtime-vapor test && pnpm run prepare-unit-test-artifacts && pnpm exec vitest run packages/rue-design/src/components/input/__tests__/Input.spec.tsx packages/rue-design/src/components/transfer/__tests__/Transfer.spec.tsx --project rue-design-jsdom`
- 模拟策略：使用现有 Wasm 响应式实现和 jsdom DOM，不新增 mock。

## 步骤

1. 用现有失败用例和最小底层用例确认重复调度或丢失更新的准确时序。
2. 运行失败验证命令并记录三个稳定失败。
3. 最小修改活动 effect/pending 调度实现，保留已有祖先重入保护。
4. 运行 runtime-vapor 测试和两个 rue-design 聚焦测试。
5. 审查差异，确认没有修改断言、跳过测试或扩大组件 API。

## 验证

- 运行：`pnpm --filter @rue-js/runtime-vapor test`
- 运行：`pnpm run prepare-unit-test-artifacts && pnpm exec vitest run packages/rue-design/src/components/input/__tests__/Input.spec.tsx packages/rue-design/src/components/transfer/__tests__/Transfer.spec.tsx --project rue-design-jsdom`
- 预期：Wasm 测试通过；22 个聚焦组件测试全部通过，三个失败归零。
- 所需证据：失败基线、两个命令退出码为 0、聚焦测试通过数量、最终差异审查。

## 完成

- `run_effect_body` 记录活动 effect 栈；sync 调度仅延迟自身/祖先重入和跨组件 owner 的嵌套渲染，普通兄弟 effect 继续同步执行。
- Input 的诊断性 `useSetup` 改动已撤回，原组件实现通过，确认问题由底层调度修复。
- Transfer 证实存在独立组件问题：移除重复首屏微任务；渲染期选择写入继续阻断但不再误报全局错误。
- runtime-vapor Node/Wasm 测试通过；Input、Transfer、复杂列表及协议聚焦测试 77 个通过、1 个既有跳过。
