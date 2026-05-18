# Indicator

## AI 提示词

请为 Rue Design 规划 Indicator 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [Indicator 文档源](../../packages/rue-design/src/components/indicator/doc.md)。

- 公共导出名：`Indicator`
- 组件实现文件：[packages/rue-design/src/components/indicator/index.tsx](../../packages/rue-design/src/components/indicator/index.tsx)
- 单元测试：[packages/rue-design/src/components/indicator/**tests**/Indicator.spec.tsx](../../packages/rue-design/src/components/indicator/__tests__/Indicator.spec.tsx)
- Demo 页面：[app/pages/design/Indicator.tsx](../../app/pages/design/Indicator.tsx)
- Actual 测试：[packages/runtime/**tests**/indicator.actual.spec.tsx](../../packages/runtime/__tests__/indicator.actual.spec.tsx)
- 路由：`/design/indicator`
- 组件模式：compound 结构封装

### 组件特定要求

1. API 草案要体现 root 与 `indicator-item` 的层级关系，以及 placement 修饰的挂载位置。
2. 组件本身应保持无状态，只处理结构和类名组合。
3. demo 至少覆盖默认角标和不同 placement 组合。

### 计划输出格式

1. 实现文件清单
2. demo 覆盖清单
3. 单测
4. actual 测试
