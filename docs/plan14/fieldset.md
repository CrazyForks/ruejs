# Fieldset

## AI 提示词
请为 Rue Design 规划 Fieldset 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [Fieldset 文档源](../../packages/rue-design/src/components/fieldset/doc.md)。

- 公共导出名：`Fieldset`
- 组件实现文件：[packages/rue-design/src/components/fieldset/index.tsx](../../packages/rue-design/src/components/fieldset/index.tsx)
- 单元测试：[packages/rue-design/src/components/fieldset/__tests__/Fieldset.spec.tsx](../../packages/rue-design/src/components/fieldset/__tests__/Fieldset.spec.tsx)
- Demo 页面：[app/pages/design/Fieldset.tsx](../../app/pages/design/Fieldset.tsx)
- Actual 测试：[packages/runtime/__tests__/fieldset.actual.spec.tsx](../../packages/runtime/__tests__/fieldset.actual.spec.tsx)
- 路由：`/design/fieldset`
- 组件模式：compound 结构封装

### 组件特定要求
1. API 草案里要显式表达 `fieldset` root、`fieldset-legend` 和 `label` 描述文本的关系。
2. 只围绕文档里的结构模式规划，不额外发明表单 schema 或校验状态系统。
3. demo 应覆盖纯展示和内嵌输入元素两类场景。

### 计划输出格式
1. 实现文件清单
3. demo 覆盖清单
4. 单测
5. actual 测试
