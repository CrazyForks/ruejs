# 任务 2: 编译组件仅同步响应式 props

批次：【批次 2】 依赖批次：批次 1

状态：未开始

目的：同身份 fine-grained 组件更新只同步稳定 props，让已挂载局部 effect 更新 DOM，不再调用组件函数或 patch 返回根。

来源任务：`.plans/2026-08-28-编译渲染边界瘦身/3-收紧组件重渲染标记.md`

预计会话范围：只修改组件更新分支和生命周期入队，不改 Element/Fragment 兼容 patch；以组件调用次数、DOM/Hook 身份和 props 更新为单一验证故事。

## 文件

- 修改：`packages/runtime-vapor/src/js-runtime/instance.ts`
- 修改：`packages/runtime-vapor/src/js-runtime/patch/component.ts`
- 修改：`packages/runtime-vapor/src/js-runtime/types.ts`
- 新建：`packages/runtime/__tests__/compiledComponentUpdate.spec.tsx`
- 测试：`packages/runtime/__tests__/component.renderable.spec.tsx`
- 测试：`packages/runtime/__tests__/runtimeVapor.js-lifecycle-parity.spec.ts`

## 上下文

- `instance.update()` 已通过稳定 `propsRO` 的 signal 写入触发 setup 内属性、文本、slot 和组件 props effect。
- `patchComponent()` 当前在同身份更新时仍执行 `renderComponent()` 或 render effect；fine-grained 且无组件级控制流 marker 时应只更新 props。
- `rerender` 模式及带 render effect 的 fine-grained 组件继续走现有重执行路径；组件类型/key 或模式变化继续视为替换边界。

## 测试计划

- 行为：动态 prop 更新后 DOM 值变化，但父/子编译组件函数与 `useSetup` 各只执行一次，根节点、输入焦点、selection、Teleport 内容和子组件实例保持；生命周期每次有效更新只触发一次。
- 失败验证测试：新增真实 TSX 编译测试记录 render/setup 次数、节点身份、焦点、嵌套状态和 mounted/updated/unmounted 次数；增加控制流 marker 与 `h()` 反例。
- 失败验证命令：`pnpm exec vitest run packages/runtime/__tests__/compiledComponentUpdate.spec.tsx`
- 预期失败原因：当前 `patchComponent` 同步 props 后仍调用组件函数并把新 Vapor handle 交给 subtree patch。
- 通过验证命令：`pnpm exec vitest run packages/runtime/__tests__/compiledComponentUpdate.spec.tsx packages/runtime/__tests__/component.renderable.spec.tsx packages/runtime/__tests__/runtimeVapor.js-lifecycle-parity.spec.ts`
- 模拟策略：使用 jsdom、真实 SWC 转换、真实 runtime 和响应式调度；只用计数器观察公开行为，不 mock patcher。

## 步骤

1. 写 fine-grained 正例和 `rerender`/控制流反例，确认现状出现多余 render 或身份变化。
2. 将组件更新模式保存到 mounted component，并把 same-component 判定纳入模式一致性。
3. 为无 render effect 的 fine-grained 分支调用 `components.update()`，按现有 pending lifecycle 规则触发 before_update/updated，但不调用组件函数和 subtree patch。
4. 保留 render effect、手写 `h()`、类型/key 变化和显式 invalidate 的现有更新/替换语义。
5. 验证 props 删除/新增、同步与异步调度、焦点、Teleport、Context 和卸载 cleanup。

## 验证

- 运行：`pnpm --filter @rue-js/runtime-vapor run check && pnpm --filter @rue-js/runtime-vapor run build`
- 运行：`pnpm exec vitest run packages/runtime/__tests__/compiledComponentUpdate.spec.tsx packages/runtime/__tests__/component.renderable.spec.tsx packages/runtime/__tests__/runtimeVapor.js-lifecycle-parity.spec.ts`
- 预期：编译组件 render/setup 次数保持 1；prop 驱动 DOM 更新；反例仍重执行；身份、焦点、生命周期和清理断言通过。
- 所需证据：失败/通过输出、每个场景的 render/setup/lifecycle 计数、DOM identity 与 selection 断言、测试数量和退出码。

## 完成

完成时明确列出“仅同步 props”和“仍需重执行”的判定表，并证明没有靠关闭必要控制流更新获得通过。
