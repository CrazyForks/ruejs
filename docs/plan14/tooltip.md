# Tooltip

## AI 提示词
请为 Rue Design 规划 Tooltip 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [Tooltip 文档源](../../packages/rue-design/src/components/tooltip/doc.md)。

- 公共导出名：`Tooltip`
- 组件实现文件：[packages/rue-design/src/components/tooltip/index.tsx](../../packages/rue-design/src/components/tooltip/index.tsx)
- 单元测试：[packages/rue-design/src/components/tooltip/__tests__/Tooltip.spec.tsx](../../packages/rue-design/src/components/tooltip/__tests__/Tooltip.spec.tsx)
- Demo 页面：[app/pages/design/Tooltip.tsx](../../app/pages/design/Tooltip.tsx)
- Actual 测试：[packages/runtime/__tests__/tooltip.actual.spec.tsx](../../packages/runtime/__tests__/tooltip.actual.spec.tsx)
- 路由：`/design/tooltip`
- 组件模式：数据属性辅助封装

### 组件特定要求
1. 规划时要明确 `data-tip` 与 placement / color / open 修饰的映射方式。
2. 保持 tooltip 作为包裹式容器，不要引入额外 hover 状态机。
3. demo 至少覆盖基础 tooltip、位置变体和强制打开示例。

### 计划输出格式
1. 实现文件清单
3. demo 覆盖清单
4. 单测
5. actual 测试
