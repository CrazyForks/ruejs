# Toggle

## AI 提示词

请为 Rue Design 规划 Toggle 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [Toggle 文档源](../../packages/rue-design/src/components/toggle/doc.md)。

- 公共导出名：`Toggle`
- 组件实现文件：[packages/rue-design/src/components/toggle/index.tsx](../../packages/rue-design/src/components/toggle/index.tsx)
- 单元测试：[packages/rue-design/src/components/toggle/**tests**/Toggle.spec.tsx](../../packages/rue-design/src/components/toggle/__tests__/Toggle.spec.tsx)
- Demo 页面：[app/pages/design/Toggle.tsx](../../app/pages/design/Toggle.tsx)
- Actual 测试：[packages/runtime/**tests**/toggle.actual.spec.tsx](../../packages/runtime/__tests__/toggle.actual.spec.tsx)
- 路由：`/design/toggle`
- 组件模式：原生 input 薄封装

### 组件特定要求

1. 保留 checkbox 语义和 `checked`、`disabled`、`onChange` 等原生属性直通。
2. 只围绕 color / size 修饰规划 props。
3. demo 至少覆盖颜色、尺寸和禁用态示例。

### 计划输出格式

1. 实现文件清单
2. demo 覆盖清单
3. 单测
4. actual 测试
