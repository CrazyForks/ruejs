# 静态构建能力下沉 计划

目标：将 `app-static-build` 中可复用的静态构建能力下沉到 `@rue-js/server-renderer/static`，应用层只保留业务适配。

范围：新增 Node 构建期静态渲染子入口，沉淀路由规范化、HTML 注入、客户端运行时裁剪、静态预览、服务端路由渲染、客户端快照、并发路由流水线和报告能力；重构 Rue 文档站脚本与 `examples/static-render` 使用该入口。

范围外：不改变 Rue runtime 渲染语义，不重写文档 markdown/MDX 内容生成，不迁移 `packages/text` 的独立预渲染体系。

假设：`packages/server-renderer/src/index.ts` 当前只转发 `@rue-js/runtime/server`；`scripts/app-static-build.mjs` 同时包含通用静态构建能力和文档站业务；`examples/static-render` 已复制一套较小静态输出与预览流程。

## 设计决策

- 比较三路：留在应用、放 `scripts/shared`、下沉 `server-renderer/static`；选择第三路承载框架能力。
- `server-renderer` 主入口保持轻量转发；静态能力走 Node 构建期子入口，避免污染主 SSR API。
- 文档搜索索引、Satteri markdown、高亮、主题默认值和站点路由补充继续留在 Rue 文档站适配层。

## 架构说明

- 新子入口采用 ESM JS 加 `.d.ts`，便于 Node 脚本无需预构建直接导入。
- `jsdom` 只在静态 DOM 能力被调用时动态加载，并作为可选同伴依赖表达。
- 通用流水线接收应用提供的 Vite 构建、路由来源、业务预渲染钩子和 HTML 策略。

## 开发策略

- 对会改变行为的代码，使用失败验证-通过验证-重构。
- 在实施步骤前规划失败验证命令和预期失败。
- 将实施步骤限制在失败测试所证明的行为范围内。
- 测试真实行为，不验证模拟对象或实现细节。
