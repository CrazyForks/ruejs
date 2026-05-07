# Steps

## AI 提示词
请为 Rue Design 规划 Steps 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [Steps 文档源](../../packages/rue-design/src/components/steps/doc.md)。

- 公共导出名：`Steps`
- 组件实现文件：[packages/rue-design/src/components/steps/index.tsx](../../packages/rue-design/src/components/steps/index.tsx)
- 单元测试：[packages/rue-design/src/components/steps/__tests__/Steps.spec.tsx](../../packages/rue-design/src/components/steps/__tests__/Steps.spec.tsx)
- Demo 页面：[app/pages/design/Steps.tsx](../../app/pages/design/Steps.tsx)
- Actual 测试：[packages/runtime/__tests__/steps.actual.spec.tsx](../../packages/runtime/__tests__/steps.actual.spec.tsx)
- 路由：`/design/steps`
- 组件模式：group + item 结构封装

### 组件特定要求
1. 规划 root 与 `step` item 的表达方式，以及方向 / 颜色修饰如何落在容器或 item 上。
2. 如需 `Step` 子组件，保持轻量，不要引入流程状态机。
3. demo 至少覆盖水平、垂直和激活态步骤。

### 计划输出格式
1. 实现文件清单
3. demo 覆盖清单
4. 单测
5. actual 测试
