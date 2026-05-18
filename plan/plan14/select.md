# Select

## AI 提示词

请为 Rue Design 规划 Select 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [Select 文档源](../../packages/rue-design/src/components/select/doc.md)。

- 公共导出名：`Select`
- 组件实现文件：[packages/rue-design/src/components/select/index.tsx](../../packages/rue-design/src/components/select/index.tsx)
- 单元测试：[packages/rue-design/src/components/select/**tests**/Select.spec.tsx](../../packages/rue-design/src/components/select/__tests__/Select.spec.tsx)
- Demo 页面：[app/pages/design/Select.tsx](../../app/pages/design/Select.tsx)
- Actual 测试：[packages/runtime/**tests**/select.actual.spec.tsx](../../packages/runtime/__tests__/select.actual.spec.tsx)
- 路由：`/design/select`
- 组件模式：原生 select 薄封装

### 组件特定要求

1. 保留 `value`、`multiple`、`disabled`、`onChange` 等原生 select 属性直通。
2. 只围绕 style / color / size 修饰规划 props。
3. demo 至少覆盖基础 select、颜色尺寸变体和禁用态示例。

### 计划输出格式

1. 实现文件清单
2. demo 覆盖清单
3. 单测
4. actual 测试
