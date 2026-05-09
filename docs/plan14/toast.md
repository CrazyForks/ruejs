# Toast

## AI 提示词

请为 Rue Design 规划 Toast 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [Toast 文档源](../../packages/rue-design/src/components/toast/doc.md)。

- 公共导出名：`Toast`
- 组件实现文件：[packages/rue-design/src/components/toast/index.tsx](../../packages/rue-design/src/components/toast/index.tsx)
- 单元测试：[packages/rue-design/src/components/toast/**tests**/Toast.spec.tsx](../../packages/rue-design/src/components/toast/__tests__/Toast.spec.tsx)
- Demo 页面：[app/pages/design/Toast.tsx](../../app/pages/design/Toast.tsx)
- Actual 测试：[packages/runtime/**tests**/toast.actual.spec.tsx](../../packages/runtime/__tests__/toast.actual.spec.tsx)
- 路由：`/design/toast`
- 组件模式：容器类封装

### 组件特定要求

1. 只围绕 `toast` 的 placement 修饰规划 props，不扩展成消息队列系统。
2. demo 至少覆盖不同位置与多条 toast 堆叠展示。
3. 单测验证 placement 类组合和 children 透传即可。

### 计划输出格式

1. 实现文件清单
2. demo 覆盖清单
3. 单测
4. actual 测试
