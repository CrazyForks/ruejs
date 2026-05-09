# Hero

## AI 提示词

请为 Rue Design 规划 Hero 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [Hero 文档源](../../packages/rue-design/src/components/hero/doc.md)。

- 公共导出名：`Hero`
- 组件实现文件：[packages/rue-design/src/components/hero/index.tsx](../../packages/rue-design/src/components/hero/index.tsx)
- 单元测试：[packages/rue-design/src/components/hero/**tests**/Hero.spec.tsx](../../packages/rue-design/src/components/hero/__tests__/Hero.spec.tsx)
- Demo 页面：[app/pages/design/Hero.tsx](../../app/pages/design/Hero.tsx)
- Actual 测试：[packages/runtime/**tests**/hero.actual.spec.tsx](../../packages/runtime/__tests__/hero.actual.spec.tsx)
- 路由：`/design/hero`
- 组件模式：compound 结构封装

### 组件特定要求

1. 规划 root、`hero-content`、`hero-overlay` 的组合方式，优先采用子组件或具名 part helper。
2. 不要引入独立的视觉主题系统；颜色、图片和布局示例全部从 `doc.md` 反推。
3. demo 至少覆盖纯内容 hero 和带 overlay / figure 的 hero。

### 计划输出格式

1. 实现文件清单
2. demo 覆盖清单
3. 单测
4. actual 测试
