# Input

## AI 提示词

请为 Rue Design 规划 Input 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [Input 文档源](../../packages/rue-design/src/components/input/doc.md)。

- 公共导出名：`Input`
- 组件实现文件：[packages/rue-design/src/components/input/index.tsx](../../packages/rue-design/src/components/input/index.tsx)
- 单元测试：[packages/rue-design/src/components/input/**tests**/Input.spec.tsx](../../packages/rue-design/src/components/input/__tests__/Input.spec.tsx)
- Demo 页面：[app/pages/design/Input.tsx](../../app/pages/design/Input.tsx)
- Actual 测试：[packages/runtime/**tests**/input.actual.spec.tsx](../../packages/runtime/__tests__/input.actual.spec.tsx)
- 路由：`/design/input`
- 组件模式：原生 input / shell 混合封装

### 组件特定要求

1. 规划时要同时覆盖单个 `<input>` 模式和文档里“父元素带 `input` 类、内部有多个元素”的 shell 模式。
2. 保留 `type`、`placeholder`、`disabled`、`value`、`onInput` / `onChange` 等原生属性直通。
3. 只把 `input` 的 style / color / size 修饰封成 props，不要引入表单状态管理。

### 计划输出格式

1. 实现文件清单
2. demo 覆盖清单
3. 单测
4. actual 测试
