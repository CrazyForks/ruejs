# Textarea

## AI 提示词
请为 Rue Design 规划 Textarea 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [Textarea 文档源](../../packages/rue-design/src/components/textarea/doc.md)。

- 公共导出名：`Textarea`
- 组件实现文件：[packages/rue-design/src/components/textarea/index.tsx](../../packages/rue-design/src/components/textarea/index.tsx)
- 单元测试：[packages/rue-design/src/components/textarea/__tests__/Textarea.spec.tsx](../../packages/rue-design/src/components/textarea/__tests__/Textarea.spec.tsx)
- Demo 页面：[app/pages/design/Textarea.tsx](../../app/pages/design/Textarea.tsx)
- Actual 测试：[packages/runtime/__tests__/textarea.actual.spec.tsx](../../packages/runtime/__tests__/textarea.actual.spec.tsx)
- 路由：`/design/textarea`
- 组件模式：原生 textarea 薄封装

### 组件特定要求
1. 保留 `value`、`rows`、`disabled`、`placeholder`、`onInput` / `onChange` 等原生属性直通。
2. 只围绕 style / color / size 修饰规划 props。
3. demo 至少覆盖基础 textarea、颜色尺寸和禁用态示例。

### 计划输出格式
1. 实现文件清单
3. demo 覆盖清单
4. 单测
5. actual 测试
