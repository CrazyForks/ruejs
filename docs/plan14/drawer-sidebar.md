# Drawer Sidebar

## AI 提示词
请为 Rue Design 规划 Drawer Sidebar 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [Drawer Sidebar 文档源](../../packages/rue-design/src/components/drawer-sidebar/doc.md)。

- 公共导出名：`DrawerSidebar`
- 组件实现文件：[packages/rue-design/src/components/drawer-sidebar/index.tsx](../../packages/rue-design/src/components/drawer-sidebar/index.tsx)
- 单元测试：[packages/rue-design/src/components/drawer-sidebar/__tests__/DrawerSidebar.spec.tsx](../../packages/rue-design/src/components/drawer-sidebar/__tests__/DrawerSidebar.spec.tsx)
- Demo 页面：[app/pages/design/Drawer.tsx](../../app/pages/design/Drawer.tsx)
- Actual 测试：[packages/runtime/__tests__/drawer.actual.spec.tsx](../../packages/runtime/__tests__/drawer.actual.spec.tsx)
- 路由：`/design/drawer`
- 组件模式：compound 结构封装

### 组件特定要求
1. `drawer`、`drawer-toggle`、`drawer-content`、`drawer-side`、`drawer-overlay` 这些 part 关系要在 API 草案里显式体现。
2. 优先规划 `Root/Toggle/Content/Side/Overlay` 这类 compound API，而不是把所有结构塞进一个巨型 props 对象。
3. demo 需要覆盖基础抽屉、响应式常开、关闭态 tooltip/收缩态等文档示例。
4. 侧边栏 slug 已经是 `drawer`，不要把实现命名和路由 slug 混在一起。

### 计划输出格式
1. 实现文件清单
3. demo 覆盖清单
4. 单测
5. actual 测试
