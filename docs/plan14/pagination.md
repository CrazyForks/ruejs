# Pagination

## AI 提示词
请为 Rue Design 规划 Pagination 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [Pagination 文档源](../../packages/rue-design/src/components/pagination/doc.md)。

- 公共导出名：`Pagination`
- 组件实现文件：[packages/rue-design/src/components/pagination/index.tsx](../../packages/rue-design/src/components/pagination/index.tsx)
- 单元测试：[packages/rue-design/src/components/pagination/__tests__/Pagination.spec.tsx](../../packages/rue-design/src/components/pagination/__tests__/Pagination.spec.tsx)
- Demo 页面：[app/pages/design/Pagination.tsx](../../app/pages/design/Pagination.tsx)
- Actual 测试：[packages/runtime/__tests__/pagination.actual.spec.tsx](../../packages/runtime/__tests__/pagination.actual.spec.tsx)
- 路由：`/design/pagination`
- 组件模式：基于 join 的语义封装

### 组件特定要求
1. 规划时要说明 Pagination 是否直接复用 Join/Button 结构，还是提供轻量 `Pagination.Item` 子组件。
2. 不做分页逻辑本身，只封装结构、方向和 item 样式语义。
3. demo 至少覆盖基础分页、方向切换和禁用/当前页示例。

### 计划输出格式
1. 实现文件清单
3. demo 覆盖清单
4. 单测
5. actual 测试
