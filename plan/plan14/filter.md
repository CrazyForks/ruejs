# Filter

## AI 提示词

请为 Rue Design 规划 Filter 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [Filter 文档源](../../packages/rue-design/src/components/filter/doc.md)。

- 公共导出名：`Filter`
- 组件实现文件：[packages/rue-design/src/components/filter/index.tsx](../../packages/rue-design/src/components/filter/index.tsx)
- 单元测试：[packages/rue-design/src/components/filter/**tests**/Filter.spec.tsx](../../packages/rue-design/src/components/filter/__tests__/Filter.spec.tsx)
- Demo 页面：[app/pages/design/Filter.tsx](../../app/pages/design/Filter.tsx)
- Actual 测试：[packages/runtime/**tests**/filter.actual.spec.tsx](../../packages/runtime/__tests__/filter.actual.spec.tsx)
- 路由：`/design/filter`
- 组件模式：compound 结构封装

### 组件特定要求

1. API 草案要体现 root 和 `filter-reset` 的关系，并保留 radio/input 直通能力。
2. 规划时要明确 `<form class="filter">` 和 `<div class="filter">` 两种模式的边界。
3. demo 至少覆盖 reset 项、分组选项和 aria-label 用法。

### 计划输出格式

1. 实现文件清单
2. demo 覆盖清单
3. 单测
4. actual 测试
