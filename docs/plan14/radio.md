# Radio

## AI 提示词

请为 Rue Design 规划 Radio 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [Radio 文档源](../../packages/rue-design/src/components/radio/doc.md)。

- 公共导出名：`Radio`
- 组件实现文件：[packages/rue-design/src/components/radio/index.tsx](../../packages/rue-design/src/components/radio/index.tsx)
- 单元测试：[packages/rue-design/src/components/radio/**tests**/Radio.spec.tsx](../../packages/rue-design/src/components/radio/__tests__/Radio.spec.tsx)
- Demo 页面：[app/pages/design/Radio.tsx](../../app/pages/design/Radio.tsx)
- Actual 测试：[packages/runtime/**tests**/radio.actual.spec.tsx](../../packages/runtime/__tests__/radio.actual.spec.tsx)
- 路由：`/design/radio`
- 组件模式：原生 input 薄封装

### 组件特定要求

1. 保留 `name`、`checked`、`value`、`disabled`、`onChange` 等原生 radio 属性直通。
2. 只围绕 color / size 修饰规划 props。
3. demo 至少覆盖颜色组、尺寸组和同 name 的单选交互。

### 计划输出格式

1. 实现文件清单
2. demo 覆盖清单
3. 单测
4. actual 测试
