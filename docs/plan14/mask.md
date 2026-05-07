# Mask

## AI 提示词
请为 Rue Design 规划 Mask 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [Mask 文档源](../../packages/rue-design/src/components/mask/doc.md)。

- 公共导出名：`Mask`
- 组件实现文件：[packages/rue-design/src/components/mask/index.tsx](../../packages/rue-design/src/components/mask/index.tsx)
- 单元测试：[packages/rue-design/src/components/mask/__tests__/Mask.spec.tsx](../../packages/rue-design/src/components/mask/__tests__/Mask.spec.tsx)
- Demo 页面：[app/pages/design/Mask.tsx](../../app/pages/design/Mask.tsx)
- Actual 测试：[packages/runtime/__tests__/mask.actual.spec.tsx](../../packages/runtime/__tests__/mask.actual.spec.tsx)
- 路由：`/design/mask`
- 组件模式：视觉类薄封装

### 组件特定要求
1. 规划 shape 修饰和 `mask-half-*` 变体的 API 边界，避免过度抽象成图像处理组件。
2. 保持对 `img` 或任意宿主元素的轻量 class 包装思路。
3. demo 要覆盖不同形状和 half modifier 组合。

### 计划输出格式
1. 实现文件清单
3. demo 覆盖清单
4. 单测
5. actual 测试
