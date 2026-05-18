# Swap

## AI 提示词

请为 Rue Design 规划 Swap 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [Swap 文档源](../../packages/rue-design/src/components/swap/doc.md)。

- 公共导出名：`Swap`
- 组件实现文件：[packages/rue-design/src/components/swap/index.tsx](../../packages/rue-design/src/components/swap/index.tsx)
- 单元测试：[packages/rue-design/src/components/swap/**tests**/Swap.spec.tsx](../../packages/rue-design/src/components/swap/__tests__/Swap.spec.tsx)
- Demo 页面：[app/pages/design/Swap.tsx](../../app/pages/design/Swap.tsx)
- Actual 测试：[packages/runtime/**tests**/swap.actual.spec.tsx](../../packages/runtime/__tests__/swap.actual.spec.tsx)
- 路由：`/design/swap`
- 组件模式：compound 结构封装

### 组件特定要求

1. 要明确 root 与 `swap-on` / `swap-off` / `swap-indeterminate` 的结构关系，以及 checkbox 模式和 class mode 的边界。
2. 规划 `swap-active`、`swap-rotate`、`swap-flip` 等修饰时，不要引入额外状态同步系统。
3. demo 至少覆盖 checkbox 控制和 class 控制两种方式。

### 计划输出格式

1. 实现文件清单
2. demo 覆盖清单
3. 单测
4. actual 测试
