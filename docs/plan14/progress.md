# Progress

## AI 提示词
请为 Rue Design 规划 Progress 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [Progress 文档源](../../packages/rue-design/src/components/progress/doc.md)。

- 公共导出名：`Progress`
- 组件实现文件：[packages/rue-design/src/components/progress/index.tsx](../../packages/rue-design/src/components/progress/index.tsx)
- 单元测试：[packages/rue-design/src/components/progress/__tests__/Progress.spec.tsx](../../packages/rue-design/src/components/progress/__tests__/Progress.spec.tsx)
- Demo 页面：[app/pages/design/Progress.tsx](../../app/pages/design/Progress.tsx)
- Actual 测试：[packages/runtime/__tests__/progress.actual.spec.tsx](../../packages/runtime/__tests__/progress.actual.spec.tsx)
- 路由：`/design/progress`
- 组件模式：原生元素薄封装

### 组件特定要求
1. 保持 `progress` 原生元素语义，`value` 与 `max` 直通，不做进度状态管理。
2. 只围绕 color 修饰规划 props。
3. demo 至少覆盖基础进度条和不同颜色示例。

### 计划输出格式
1. 实现文件清单
3. demo 覆盖清单
4. 单测
5. actual 测试
