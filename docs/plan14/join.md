# Join

## AI 提示词
请为 Rue Design 规划 Join 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [Join 文档源](../../packages/rue-design/src/components/join/doc.md)。

- 公共导出名：`Join`
- 组件实现文件：[packages/rue-design/src/components/join/index.tsx](../../packages/rue-design/src/components/join/index.tsx)
- 单元测试：[packages/rue-design/src/components/join/__tests__/Join.spec.tsx](../../packages/rue-design/src/components/join/__tests__/Join.spec.tsx)
- Demo 页面：[app/pages/design/Join.tsx](../../app/pages/design/Join.tsx)
- Actual 测试：[packages/runtime/__tests__/join.actual.spec.tsx](../../packages/runtime/__tests__/join.actual.spec.tsx)
- 路由：`/design/join`
- 组件模式：容器类封装

### 组件特定要求
1. 规划 root 与 `join-item` 的关系，明确是通过子组件还是通过 child class 约定表达。
2. 覆盖横向、纵向和响应式 join 示例，不引入额外状态逻辑。
3. demo 里要体现按钮、输入框等不同 item 类型的组合方式。

### 计划输出格式
1. 实现文件清单
3. demo 覆盖清单
4. 单测
5. actual 测试
