# Checkbox

## AI 提示词

请为 Rue Design 规划 Checkbox 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [Checkbox 文档源](../../packages/rue-design/src/components/checkbox/doc.md)。

- 公共导出名：`Checkbox`
- 组件实现文件：[packages/rue-design/src/components/checkbox/index.tsx](../../packages/rue-design/src/components/checkbox/index.tsx)
- 单元测试：[packages/rue-design/src/components/checkbox/**tests**/Checkbox.spec.tsx](../../packages/rue-design/src/components/checkbox/__tests__/Checkbox.spec.tsx)
- Demo 页面：[app/pages/design/Checkbox.tsx](../../app/pages/design/Checkbox.tsx)
- Actual 测试：[packages/runtime/**tests**/checkbox.actual.spec.tsx](../../packages/runtime/__tests__/checkbox.actual.spec.tsx)
- 路由：`/design/checkbox`
- 组件模式：原生 input 薄封装

### 组件特定要求

1. 保留 `checked`、`disabled`、`value`、`name`、`onChange` 等原生 input 属性直通。
2. 只把 `checkbox` 的 color / size 等 `doc.md` 中真实存在的修饰封成 props。
3. 不要引入额外状态管理或自定义 CSS。

### 计划输出格式

1. 实现文件清单
2. demo 覆盖清单
3. 单测
4. actual 测试
