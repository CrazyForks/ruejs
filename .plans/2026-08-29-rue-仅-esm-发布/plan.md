# Rue.js 全工作区仅 ESM 发布计划

目标：将所有 `@rue-js/*` 工作区包统一为 ESM-only 发布，并升级到 Node 22.22.0+ 与 ES2022 基线。

范围：覆盖 15 个公开 `@rue-js/*` 包和 1 个私有示例包的清单、入口、导出条件、构建格式、Node/Vite 基线、打包契约与工作流；保留已有的 ESM browser/global CDN 产物。

范围外：不删除 RSC/Text 对用户或第三方 CJS 的互操作能力，不禁止 Vite 插件用户自选 CJS 库输出，不引入 React。

假设：“所有 rue-js 包”指 `packages/*/package.json` 中名称以 `@rue-js/` 开头的 16 个工作区；Vite catalog 已为 8.2.1，CI Node 已为 22.23.1。

## 设计决策

- 选择“先迁移包契约，后删除共享构建器 CJS 分支”，使每一个依赖层都可独立构建验证。
- 公开 JS 包统一使用 `type: module`、无 `require` 导出条件和无 CJS 打包产物；Wasm 包以非 JS 资产契约单独验证。
- `main` 可保留作为旧解析器的 ESM 回退，`exports` 是公开子路径的权威契约。

## 架构说明

- 依赖层为 `shared/runtime-vapor -> runtime -> server-renderer/rue -> JSX/router/store/i18n -> design/text/tooling`。
- `scripts/vite-package-builder.js` 是分发构建格式的唯一共享工厂；Text 准备、SFC 脚本与 Design 子路径测试是主要 CJS 消费者。

## 开发策略

- 对会改变行为的代码，使用失败验证-通过验证-重构。
- 在实施步骤前规划失败验证命令和预期失败。
- 将实施步骤限制在失败测试所证明的行为范围内。
- 测试真实行为，不验证模拟对象或实现细节。
