# Label

## AI 提示词
请为 Rue Design 规划 Label 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [Label 文档源](../../packages/rue-design/src/components/label/doc.md)。

- 公共导出名：`Label`
- 组件实现文件：[packages/rue-design/src/components/label/index.tsx](../../packages/rue-design/src/components/label/index.tsx)
- 单元测试：[packages/rue-design/src/components/label/__tests__/Label.spec.tsx](../../packages/rue-design/src/components/label/__tests__/Label.spec.tsx)
- Demo 页面：[app/pages/design/Label.tsx](../../app/pages/design/Label.tsx)
- Actual 测试：[packages/runtime/__tests__/label.actual.spec.tsx](../../packages/runtime/__tests__/label.actual.spec.tsx)
- 路由：`/design/label`
- 组件模式：compound 结构封装

### 组件特定要求
1. 需要同时规划常规 `label` 模式和 `floating-label` 模式，不要只做单一壳子。
2. API 草案要说明如何承载内部 `span` 文本和输入控件，而不是只暴露 className。
3. demo 至少覆盖带前置文本的 input label 和浮动 label 两类场景。

### 计划输出格式
1. 实现文件清单
3. demo 覆盖清单
4. 单测
5. actual 测试
