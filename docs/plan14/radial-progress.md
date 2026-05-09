# Radial Progress

## AI 提示词

请为 Rue Design 规划 Radial Progress 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [Radial Progress 文档源](../../packages/rue-design/src/components/radial-progress/doc.md)。

- 公共导出名：`RadialProgress`
- 组件实现文件：[packages/rue-design/src/components/radial-progress/index.tsx](../../packages/rue-design/src/components/radial-progress/index.tsx)
- 单元测试：[packages/rue-design/src/components/radial-progress/**tests**/RadialProgress.spec.tsx](../../packages/rue-design/src/components/radial-progress/__tests__/RadialProgress.spec.tsx)
- Demo 页面：[app/pages/design/RadialProgress.tsx](../../app/pages/design/RadialProgress.tsx)
- Actual 测试：[packages/runtime/**tests**/radial-progress.actual.spec.tsx](../../packages/runtime/__tests__/radial-progress.actual.spec.tsx)
- 路由：`/design/radial-progress`
- 组件模式：CSS 变量辅助封装

### 组件特定要求

1. 规划时要明确 `--value`、`--size`、`--thickness` 这些 CSS 变量的暴露方式，以及 `aria-valuenow` / `role="progressbar"` 的必备约束。
2. 不要把它做成带动画逻辑的进度系统，只处理结构、文本和变量映射。
3. demo 至少覆盖基础值、尺寸和厚度变化。

### 计划输出格式

1. 实现文件清单
2. demo 覆盖清单
3. 单测
4. actual 测试
