# Window Mockup

## AI 提示词
请为 Rue Design 规划 Window Mockup 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [Window Mockup 文档源](../../packages/rue-design/src/components/mockup-window/doc.md)。

- 公共导出名：`MockupWindow`
- 组件实现文件：[packages/rue-design/src/components/mockup-window/index.tsx](../../packages/rue-design/src/components/mockup-window/index.tsx)
- 单元测试：[packages/rue-design/src/components/mockup-window/__tests__/MockupWindow.spec.tsx](../../packages/rue-design/src/components/mockup-window/__tests__/MockupWindow.spec.tsx)
- Demo 页面：[app/pages/design/MockupWindow.tsx](../../app/pages/design/MockupWindow.tsx)
- Actual 测试：[packages/runtime/__tests__/mockup-window.actual.spec.tsx](../../packages/runtime/__tests__/mockup-window.actual.spec.tsx)
- 路由：`/design/mockup-window`
- 组件模式：展示容器封装

### 组件特定要求
1. 重点是 `mockup-window` 根容器及内部内容区域，不需要附加窗口行为。
2. demo 至少覆盖基础 window mockup 和带不同内容的示例。
3. 保持 API 极简，只处理类名和 children 透传。

### 计划输出格式
1. 实现文件清单
3. demo 覆盖清单
4. 单测
5. actual 测试
