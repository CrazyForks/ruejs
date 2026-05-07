# FAB / Speed Dial

## AI 提示词
请为 Rue Design 规划 FAB / Speed Dial 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [FAB 文档源](../../packages/rue-design/src/components/fab/doc.md)。

- 公共导出名：`Fab`
- 组件实现文件：[packages/rue-design/src/components/fab/index.tsx](../../packages/rue-design/src/components/fab/index.tsx)
- 单元测试：[packages/rue-design/src/components/fab/__tests__/Fab.spec.tsx](../../packages/rue-design/src/components/fab/__tests__/Fab.spec.tsx)
- Demo 页面：[app/pages/design/Fab.tsx](../../app/pages/design/Fab.tsx)
- Actual 测试：[packages/runtime/__tests__/fab.actual.spec.tsx](../../packages/runtime/__tests__/fab.actual.spec.tsx)
- 路由：`/design/fab`
- 组件模式：compound 结构封装

### 组件特定要求
1. 规划 `fab-close`、`fab-main-action`、`fab-flower` 等结构或修饰时，优先用子组件或具名槽位表达。
2. demo 要覆盖单按钮、展开按钮、close/main action、flower 变体与 tooltip 版本。
3. actual 测试至少覆盖一次展开/收起或内容切换行为。

### 计划输出格式
1. 实现文件清单
3. demo 覆盖清单
4. 单测
5. actual 测试
