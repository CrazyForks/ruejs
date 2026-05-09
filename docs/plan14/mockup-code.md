# Code Mockup

## AI 提示词

请为 Rue Design 规划 Code Mockup 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [Code Mockup 文档源](../../packages/rue-design/src/components/mockup-code/doc.md)。

- 公共导出名：`MockupCode`
- 组件实现文件：[packages/rue-design/src/components/mockup-code/index.tsx](../../packages/rue-design/src/components/mockup-code/index.tsx)
- 单元测试：[packages/rue-design/src/components/mockup-code/**tests**/MockupCode.spec.tsx](../../packages/rue-design/src/components/mockup-code/__tests__/MockupCode.spec.tsx)
- Demo 页面：[app/pages/design/MockupCode.tsx](../../app/pages/design/MockupCode.tsx)
- Actual 测试：[packages/runtime/**tests**/mockup-code.actual.spec.tsx](../../packages/runtime/__tests__/mockup-code.actual.spec.tsx)
- 路由：`/design/mockup-code`
- 组件模式：展示容器封装

### 组件特定要求

1. 重点是 `mockup-code` 容器与内部 `pre[data-prefix]` 结构的规划，不要抽成代码高亮系统。
2. demo 至少覆盖基础前缀、多行和高亮行示例。
3. 单测要验证容器类名和子内容透传。

### 计划输出格式

1. 实现文件清单
2. demo 覆盖清单
3. 单测
4. actual 测试
