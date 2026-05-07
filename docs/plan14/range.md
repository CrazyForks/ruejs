# Range Slider

## AI 提示词
请为 Rue Design 规划 Range Slider 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [Range 文档源](../../packages/rue-design/src/components/range/doc.md)。

- 公共导出名：`Range`
- 组件实现文件：[packages/rue-design/src/components/range/index.tsx](../../packages/rue-design/src/components/range/index.tsx)
- 单元测试：[packages/rue-design/src/components/range/__tests__/Range.spec.tsx](../../packages/rue-design/src/components/range/__tests__/Range.spec.tsx)
- Demo 页面：[app/pages/design/Range.tsx](../../app/pages/design/Range.tsx)
- Actual 测试：[packages/runtime/__tests__/range.actual.spec.tsx](../../packages/runtime/__tests__/range.actual.spec.tsx)
- 路由：`/design/range`
- 组件模式：原生 input 薄封装

### 组件特定要求
1. 强制保留 `type="range"` 语义，`min`、`max`、`value`、`step`、`disabled` 等属性直通。
2. 只围绕 color / size 修饰规划 props。
3. demo 至少覆盖基础 slider、不同颜色尺寸和数值显示联动示例。

### 计划输出格式
1. 实现文件清单
3. demo 覆盖清单
4. 单测
5. actual 测试
