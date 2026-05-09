# Validator

## AI 提示词

请为 Rue Design 规划 Validator 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [Validator 文档源](../../packages/rue-design/src/components/validator/doc.md)。

- 公共导出名：`Validator`
- 组件实现文件：[packages/rue-design/src/components/validator/index.tsx](../../packages/rue-design/src/components/validator/index.tsx)
- 单元测试：[packages/rue-design/src/components/validator/**tests**/Validator.spec.tsx](../../packages/rue-design/src/components/validator/__tests__/Validator.spec.tsx)
- Demo 页面：[app/pages/design/Validator.tsx](../../app/pages/design/Validator.tsx)
- Actual 测试：[packages/runtime/**tests**/validator.actual.spec.tsx](../../packages/runtime/__tests__/validator.actual.spec.tsx)
- 路由：`/design/validator`
- 组件模式：compound 辅助封装

### 组件特定要求

1. 需要同时规划 `validator` 本体和 `validator-hint` 辅助节点的表达方式。
2. 只围绕 input / select / textarea 的 class 辅助与 hint 展示规划，不引入校验规则引擎。
3. demo 至少覆盖必填、错误提示和不同宿主元素的示例。

### 计划输出格式

1. 实现文件清单
2. demo 覆盖清单
3. 单测
4. actual 测试
