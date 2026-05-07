# Dropdown

## AI 提示词
请为 Rue Design 规划 Dropdown 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [Dropdown 文档源](../../packages/rue-design/src/components/dropdown/doc.md)。

- 公共导出名：`Dropdown`
- 组件实现文件：[packages/rue-design/src/components/dropdown/index.tsx](../../packages/rue-design/src/components/dropdown/index.tsx)
- 单元测试：[packages/rue-design/src/components/dropdown/__tests__/Dropdown.spec.tsx](../../packages/rue-design/src/components/dropdown/__tests__/Dropdown.spec.tsx)
- Demo 页面：[app/pages/design/Dropdown.tsx](../../app/pages/design/Dropdown.tsx)
- Actual 测试：[packages/runtime/__tests__/dropdown.actual.spec.tsx](../../packages/runtime/__tests__/dropdown.actual.spec.tsx)
- 路由：`/design/dropdown`
- 组件模式：compound 结构封装

### 组件特定要求
1. API 草案里要明确 root 与 `dropdown-content` 的关系，避免只做一个 className 拼接壳。
2. 需要考虑 `details/summary`、focus 模式、位置修饰和 hover/open/close 修饰的规划边界。
3. demo 至少覆盖基础用法、不同 placement、文档中的可交互展开方式。

### 计划输出格式
1. 实现文件清单
3. demo 覆盖清单
4. 单测
5. actual 测试
