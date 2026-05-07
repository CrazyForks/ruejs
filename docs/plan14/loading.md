# Loading

## AI 提示词
请为 Rue Design 规划 Loading 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [Loading 文档源](../../packages/rue-design/src/components/loading/doc.md)。

- 公共导出名：`Loading`
- 组件实现文件：[packages/rue-design/src/components/loading/index.tsx](../../packages/rue-design/src/components/loading/index.tsx)
- 单元测试：[packages/rue-design/src/components/loading/__tests__/Loading.spec.tsx](../../packages/rue-design/src/components/loading/__tests__/Loading.spec.tsx)
- Demo 页面：[app/pages/design/Loading.tsx](../../app/pages/design/Loading.tsx)
- Actual 测试：[packages/runtime/__tests__/loading.actual.spec.tsx](../../packages/runtime/__tests__/loading.actual.spec.tsx)
- 路由：`/design/loading`
- 组件模式：视觉类薄封装

### 组件特定要求
1. 只围绕 `loading` 的 style / size 修饰规划 API，不引入加载状态状态机。
2. 保持 `span` 或同级轻量宿主，允许 `className` 透传。
3. demo 至少覆盖不同 loading style 与 size 组合。

### 计划输出格式
1. 实现文件清单
3. demo 覆盖清单
4. 单测
5. actual 测试
