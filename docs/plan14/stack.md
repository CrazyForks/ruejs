# Stack

## AI 提示词

请为 Rue Design 规划 Stack 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [Stack 文档源](../../packages/rue-design/src/components/stack/doc.md)。

- 公共导出名：`Stack`
- 组件实现文件：[packages/rue-design/src/components/stack/index.tsx](../../packages/rue-design/src/components/stack/index.tsx)
- 单元测试：[packages/rue-design/src/components/stack/**tests**/Stack.spec.tsx](../../packages/rue-design/src/components/stack/__tests__/Stack.spec.tsx)
- Demo 页面：[app/pages/design/Stack.tsx](../../app/pages/design/Stack.tsx)
- Actual 测试：[packages/runtime/**tests**/stack.actual.spec.tsx](../../packages/runtime/__tests__/stack.actual.spec.tsx)
- 路由：`/design/stack`
- 组件模式：容器类封装

### 组件特定要求

1. 只围绕 `stack` 与对齐 modifier 规划 props，子元素结构保持开放。
2. demo 至少覆盖默认堆叠和不同对齐 modifier。
3. 不引入额外层级管理或动画逻辑。

### 计划输出格式

1. 实现文件清单
2. demo 覆盖清单
3. 单测
4. actual 测试
