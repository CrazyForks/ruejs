# 文档 MDX Tabs 计划

目标：让 docs 文档站支持 `.mdx`，并用 MDX 组件把 quick-start 的 npm/pnpm/yarn/bun 命令展示为标签页。

范围：覆盖 docs 文件发现、搜索索引、Vite MDX 编译、文档详情页渲染、静态构建 `pnpm run app-static-build`、以及 `docs/guide/quick-start` 的 MDX 迁移。现有 `.md` 文档继续可用。

范围外：不重写文档站布局、不迁移全部 docs、不改变 Rue 核心运行时或路由语义。

假设：当前 docs 管线由 `scripts/generate-doc-search-index.js` 生成路由，`scripts/app-static-build.mjs` 静态渲染文档 HTML，详情页通过 `app/pages/site/docDetailCache.ts` 加载 `.md`。`rustcodegraph` 未初始化，本计划基于文件搜索得到的上下文。

## 设计决策

- 采用 Vite + `@mdx-js/rollup` 编译 `.mdx`，配置 `jsxImportSource: '@rue-js'`，而不是在浏览器运行 MDX 编译器。
- 保留 `.md` 的 Satteri HTML 路径；`.mdx` 走 Rue 组件路径，保证 MDX 组件可测试、可 SSR。
- quick-start 使用 MDX `<CodeTabs>` / `<CodeTab>` 包裹 fenced code blocks，保留搜索索引可提取的命令文本。
- `.mdx` 文档静态构建走应用 SSR 路径并保留客户端运行时；纯 `.md` 文档继续可走 static-doc zero-JS 路径。

## 架构说明

- 文档来源解析需要在搜索索引与静态构建中复用，统一识别 `.md` / `.mdx`，并禁止同一 docId 同时存在两种扩展。
- MDX 组件只放在 `app/pages/site` 文档站边界内，不进入核心框架包。
- 详情页需要同时支持 HTML 字符串和 MDX 组件，`GuideDocDetail`、`ApiDocDetail`、`PageDocDetail` 的行为保持一致。

## 开发策略

- 对会改变行为的代码，使用失败验证-通过验证-重构。
- 在实施步骤前规划失败验证命令和预期失败。
- 将实施步骤限制在失败测试所证明的行为范围内。
- 测试真实行为，不验证模拟对象或实现细节。

## 批次策略

- 批次 1 可并行执行文档来源/搜索索引和 Vite MDX 编译底座。
- 批次 2 在批次 1 后接入详情页渲染和静态构建。
- 批次 3 在底层能力完成后迁移 quick-start 并跑完整静态构建回归。
