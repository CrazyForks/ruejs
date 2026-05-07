# Phone Mockup

## AI 提示词
请为 Rue Design 规划 Phone Mockup 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [Phone Mockup 文档源](../../packages/rue-design/src/components/mockup-phone/doc.md)。

- 公共导出名：`MockupPhone`
- 组件实现文件：[packages/rue-design/src/components/mockup-phone/index.tsx](../../packages/rue-design/src/components/mockup-phone/index.tsx)
- 单元测试：[packages/rue-design/src/components/mockup-phone/__tests__/MockupPhone.spec.tsx](../../packages/rue-design/src/components/mockup-phone/__tests__/MockupPhone.spec.tsx)
- Demo 页面：[app/pages/design/MockupPhone.tsx](../../app/pages/design/MockupPhone.tsx)
- Actual 测试：[packages/runtime/__tests__/mockup-phone.actual.spec.tsx](../../packages/runtime/__tests__/mockup-phone.actual.spec.tsx)
- 路由：`/design/mockup-phone`
- 组件模式：compound 结构封装

### 组件特定要求
1. 要表达 root、`mockup-phone-camera`、`mockup-phone-display` 的结构关系。
2. 组件是纯展示容器，不要加入设备交互或 viewport 模拟。
3. demo 至少覆盖显示区承载任意内容的示例。

### 计划输出格式
1. 实现文件清单
3. demo 覆盖清单
4. 单测
5. actual 测试
