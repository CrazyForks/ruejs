# Theme Controller

## AI 提示词
请为 Rue Design 规划 Theme Controller 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [Theme Controller 文档源](../../packages/rue-design/src/components/theme/doc.md)。

- 公共导出名：`ThemeController`
- 组件实现文件：[packages/rue-design/src/components/theme/index.tsx](../../packages/rue-design/src/components/theme/index.tsx)
- 单元测试：[packages/rue-design/src/components/theme/__tests__/ThemeController.spec.tsx](../../packages/rue-design/src/components/theme/__tests__/ThemeController.spec.tsx)
- Demo 页面：[app/pages/design/ThemeController.tsx](../../app/pages/design/ThemeController.tsx)
- Actual 测试：[packages/runtime/__tests__/theme-controller.actual.spec.tsx](../../packages/runtime/__tests__/theme-controller.actual.spec.tsx)
- 路由：`/design/theme-controller`
- 组件模式：原生输入类辅助封装

### 组件特定要求
1. 重点是 `theme-controller` class 与 `value`、`checked` / radio / checkbox 模式的规划，不要扩展成持久化主题系统。
2. demo 至少覆盖 toggle、checkbox、swap 三类文档示例。
3. 需要在计划里显式处理目录名 `theme`、导出名 `ThemeController`、路由 slug `theme-controller` 的命名差异。

### 计划输出格式
1. 实现文件清单
3. demo 覆盖清单
4. 单测
5. actual 测试
