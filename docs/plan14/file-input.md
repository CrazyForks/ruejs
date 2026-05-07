# File Input

## AI 提示词
请为 Rue Design 规划 File Input 组件的完整落地方案直接实现代码。严格遵循 [plan.md](./plan.md) 的通用约束，并对齐 [File Input 文档源](../../packages/rue-design/src/components/file-input/doc.md)。

- 公共导出名：`FileInput`
- 组件实现文件：[packages/rue-design/src/components/file-input/index.tsx](../../packages/rue-design/src/components/file-input/index.tsx)
- 单元测试：[packages/rue-design/src/components/file-input/__tests__/FileInput.spec.tsx](../../packages/rue-design/src/components/file-input/__tests__/FileInput.spec.tsx)
- Demo 页面：[app/pages/design/FileInput.tsx](../../app/pages/design/FileInput.tsx)
- Actual 测试：[packages/runtime/__tests__/file-input.actual.spec.tsx](../../packages/runtime/__tests__/file-input.actual.spec.tsx)
- 路由：`/design/file-input`
- 组件模式：原生 input 薄封装

### 组件特定要求
1. 强制保留 `type="file"` 语义，其他 attrs 如 `multiple`、`accept`、`disabled` 直通。
2. 只封装 `file-input` 的 style / color / size 修饰，不做上传逻辑。
3. demo 应覆盖基础样式、颜色、尺寸和禁用态等文档示例。

### 计划输出格式
1. 实现文件清单
3. demo 覆盖清单
4. 单测
5. actual 测试
