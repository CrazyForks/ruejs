# Rating

## AI 提示词

请为 Rue Design 规划 Rating 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [Rating 文档源](../../packages/rue-design/src/components/rating/doc.md)。

- 公共导出名：`Rating`
- 组件实现文件：[packages/rue-design/src/components/rating/index.tsx](../../packages/rue-design/src/components/rating/index.tsx)
- 单元测试：[packages/rue-design/src/components/rating/**tests**/Rating.spec.tsx](../../packages/rue-design/src/components/rating/__tests__/Rating.spec.tsx)
- Demo 页面：[app/pages/design/Rating.tsx](../../app/pages/design/Rating.tsx)
- Actual 测试：[packages/runtime/**tests**/rating.actual.spec.tsx](../../packages/runtime/__tests__/rating.actual.spec.tsx)
- 路由：`/design/rating`
- 组件模式：group + item 结构封装

### 组件特定要求

1. 规划 root 与 item 关系，以及 `rating-half`、`rating-hidden`、size 修饰的表达方式。
2. 要保留原生 radio 组语义，不额外引入评分状态管理。
3. demo 至少覆盖基础评分、half 评分和清空评分示例。

### 计划输出格式

1. 实现文件清单
2. demo 覆盖清单
3. 单测
4. actual 测试
