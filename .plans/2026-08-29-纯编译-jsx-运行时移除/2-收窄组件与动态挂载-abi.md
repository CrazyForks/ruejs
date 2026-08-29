# 任务 2: 收窄组件与动态挂载 ABI

批次：【批次 2】 依赖批次：批次 1

状态：未开始

目的：用组件、Fragment、动态标签的窄挂载原语替代 runtime 内部与公共 `h/createElement` 通用树工厂。

来源任务：无

预计会话范围：围绕 runtime/runtime-vapor 的 mount handle、owner、Context 和内置组件完成一次 ABI 收窄；不迁移 router、i18n、rue-design、应用或 Text。

## 文件

- 删除：`packages/runtime/src/jsx.ts`
- 修改：`packages/runtime/src/index.ts`
- 修改：`packages/runtime/src/rue.ts`
- 修改：`packages/runtime/src/context.ts`
- 修改：`packages/runtime/src/island.ts`
- 修改：`packages/runtime/src/hooks/useComponent.ts`
- 修改：`packages/runtime/src/components/Component.ts`
- 修改：`packages/runtime/src/components/Suspense.ts`
- 修改：`packages/runtime/src/components/Teleport.ts`
- 修改：`packages/runtime/src/components/TransitionGroup.ts`
- 修改：`packages/runtime-vapor/src/js-runtime/create-rue.ts`
- 修改：`packages/runtime-vapor/src/js-runtime/create-vapor-rue.ts`
- 新建：`packages/runtime/src/compiled-dynamic.ts`
- 修改：`packages/runtime/__tests__/compiledComponentUpdate.spec.tsx`
- 修改：`packages/runtime/__tests__/compiledRenderBoundary.spec.tsx`
- 修改：`packages/runtime/__tests__/context.spec.tsx`

## 上下文

- `createCompiledComponent(type, props)` 已生成 fine-grained portable component handle；当前 `createElement/h` 同时处理字符串、函数、children 规范化、Context 和 repeatable handle，是需要拆掉的兼容汇合点。
- 新的 dynamic helper 只承担编译器无法静态决定的标签/组件选择，必须复用现有 mount handle、owner、key、Context 和清理协议，不能重新定义通用 VNode/Renderable 树结构。

## 测试计划

- 行为：静态组件、动态组件、动态原生标签、Fragment、Context、异步组件和内置组件在无 `h/createElement` 工厂时保持挂载、更新、身份与清理语义。
- 失败验证测试：扩展 compiled component/update/boundary/context 测试，直接断言窄 helper 的输入协议及动态类型切换，不再通过 `h()` 构造首次输出。
- 失败验证命令：`pnpm exec vitest run packages/runtime/__tests__/compiledComponentUpdate.spec.tsx packages/runtime/__tests__/compiledRenderBoundary.spec.tsx packages/runtime/__tests__/context.spec.tsx`
- 预期失败原因：当前 Context、内置组件、动态组件和 lazy/island 路径仍直接调用 `h/createElement`。
- 通过验证命令：`pnpm exec vitest run packages/runtime/__tests__/compiledComponentUpdate.spec.tsx packages/runtime/__tests__/compiledRenderBoundary.spec.tsx packages/runtime/__tests__/context.spec.tsx packages/runtime/__tests__/useComponent.spec.ts`
- 模拟策略：使用真实 jsdom、runtime-vapor owner 与 mount handle；只模拟异步 loader 的完成时机。

## 步骤

1. 先为窄组件/动态/Fragment helper 写失败验证，覆盖 identity、Context parent、children/slot 和 disposal。
2. 从现有 `createCompiledComponent` 与 mount handle 协议提取最小 dynamic mount 实现；字符串和组件分支保持显式，禁止提供 `(...children)` 通用建树签名。
3. 把 Context、Island、useComponent、Suspense、Teleport、TransitionGroup、`<Component>` 内部调用迁移到窄协议。
4. 移除 `installJSXCreateElement` 初始化副作用、runtime `jsx/jsxs/jsxDEV/Fragment` 兼容实现和 `h = createElement`。
5. 收窄 runtime 与 runtime-vapor 出口，使编译 helper 仍可按 `compiled`/`vapor` tier 注入，但主入口不再导出通用工厂。
6. 运行聚焦生命周期、Context、异步和动态切换测试后再整理重复逻辑。

## 验证

- 运行：`pnpm exec vitest run packages/runtime/__tests__/compiledComponentUpdate.spec.tsx packages/runtime/__tests__/compiledRenderBoundary.spec.tsx packages/runtime/__tests__/context.spec.tsx packages/runtime/__tests__/useComponent.spec.ts`
- 运行：`pnpm run check`
- 预期：聚焦行为通过；runtime 源码无可执行 `h()` 调用、`jsx/jsxs/jsxDEV` 实现或 JSX factory 安装副作用。
- 所需证据：失败验证、动态切换 DOM 快照、Context/生命周期顺序、卸载清理断言、类型检查退出码 0。

## 完成

完成时列出保留的窄编译 helper、删除的公共/内部通用工厂符号及对应行为证据；不得用改名方式保留 `h` 的二合一字符串/组件协议。
