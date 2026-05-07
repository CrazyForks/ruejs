# Navbar

## AI 提示词
请为 Rue Design 规划 Navbar 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [Navbar 文档源](../../packages/rue-design/src/components/navbar/doc.md)。

- 公共导出名：`Navbar`
- 组件实现文件：[packages/rue-design/src/components/navbar/index.tsx](../../packages/rue-design/src/components/navbar/index.tsx)
- 单元测试：[packages/rue-design/src/components/navbar/__tests__/Navbar.spec.tsx](../../packages/rue-design/src/components/navbar/__tests__/Navbar.spec.tsx)
- Demo 页面：[app/pages/design/Navbar.tsx](../../app/pages/design/Navbar.tsx)
- Actual 测试：[packages/runtime/__tests__/navbar.actual.spec.tsx](../../packages/runtime/__tests__/navbar.actual.spec.tsx)
- 路由：`/design/navbar`
- 组件模式：compound 结构封装

### 组件特定要求
1. API 草案应体现 `navbar-start`、`navbar-center`、`navbar-end` 三区结构。
2. 不要扩展出复杂导航数据模型，保持布局类组件定位。
3. demo 至少覆盖基本三段式布局和带按钮/菜单的组合示例。

### 计划输出格式
1. 实现文件清单
3. demo 覆盖清单
4. 单测
5. actual 测试
