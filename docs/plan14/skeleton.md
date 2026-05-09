# Skeleton

## AI 提示词

请为 Rue Design 规划 Skeleton 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [Skeleton 文档源](../../packages/rue-design/src/components/skeleton/doc.md)。

- 公共导出名：`Skeleton`
- 组件实现文件：[packages/rue-design/src/components/skeleton/index.tsx](../../packages/rue-design/src/components/skeleton/index.tsx)
- 单元测试：[packages/rue-design/src/components/skeleton/**tests**/Skeleton.spec.tsx](../../packages/rue-design/src/components/skeleton/__tests__/Skeleton.spec.tsx)
- Demo 页面：[app/pages/design/Skeleton.tsx](../../app/pages/design/Skeleton.tsx)
- Actual 测试：[packages/runtime/**tests**/skeleton.actual.spec.tsx](../../packages/runtime/__tests__/skeleton.actual.spec.tsx)
- 路由：`/design/skeleton`
- 组件模式：视觉类薄封装

### 组件特定要求

1. 规划 root 的 `skeleton` 与 `skeleton-text` modifier，不要扩展成数据 loading 框架。
2. 允许 `h-*`、`w-*` 等尺寸类通过 `className` 透传。
3. demo 至少覆盖方块骨架和文本骨架场景。

### 计划输出格式

1. 实现文件清单
2. demo 覆盖清单
3. 单测
4. actual 测试
