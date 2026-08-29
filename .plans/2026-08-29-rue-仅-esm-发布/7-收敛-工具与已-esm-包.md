# 任务 7: 收敛工具与已 ESM 包

批次：【批次 7】 依赖批次 6

状态：未开始

目的：收敛 Vite/RSC/Text/SWC 工具包，并验证 Runtime Vapor 与私有 SSR 示例等已 ESM 工作区。

来源任务：无

预计会话范围：这些包不使用共享双格式构建，只需收敛清单边界和非 JS 资产分类。

## 文件

- 新建：`scripts/__tests__/tooling-esm-package-contract.spec.ts`
- 修改：`packages/vite-plugin-rue/package.json`
- 修改：`packages/swc-plugin-rue/package.json`
- 测试：`packages/rue-rsc/package.json`
- 测试：`packages/text/package.json`
- 测试：`packages/runtime-vapor/package.json`
- 测试：`packages/rue-ssr-binary-demo/package.json`
- 测试：`scripts/__tests__/tooling-esm-package-contract.spec.ts`

## 上下文

- Vite 插件本体是 `.mjs`，但 exports 仍含 `require` 条件且未声明 `type: module`。SWC 包的 main 是 Wasm，不应伪造 JS ESM 入口。
- RSC 的 CJS 转换和 Text 的 CJS 用户配置测试是互操作功能，不是 Rue 包的 CJS 发布产物。

## 测试计划

- 行为：Vite/RSC/Text/Runtime Vapor 等 JS 包没有 CJS 导出或 pack 产物；SWC 以 Wasm main 通过非 JS 资产契约。
- 失败验证测试：`tooling-esm-package-contract.spec.ts` 的分类清单、exports 和 dry-run pack 契约。
- 失败验证命令：`pnpm exec vitest run scripts/__tests__/tooling-esm-package-contract.spec.ts --project unit`
- 预期失败原因：Vite 插件仍有 require 条件，SWC 清单/脚本未与 ESM 统一契约对齐。
- 通过验证命令：`pnpm exec vitest run scripts/__tests__/tooling-esm-package-contract.spec.ts --project unit && pnpm --filter @rue-js/runtime-vapor run check && pnpm --filter @rue-js/rsc run build && pnpm --dir packages/text build`
- 模拟策略：不使用 mock；直接检查各包 dry-run pack 和实际构建。

## 步骤

1. 建立工具包和非 JS 资产的失败契约。
2. 为 Vite 插件增加 `type: module`并删除 exports.require，保持 `.mjs` 入口不变。
3. 为 SWC 包声明 module 语义，将 postbuild 的 Node 内联脚本改为 ESM 语法，保持 Wasm main。
4. 验证 RSC、Text、Runtime Vapor 和私有示例无 CJS 发布回归，不删除互操作功能。

## 验证

- 运行：`pnpm exec vitest run scripts/__tests__/tooling-esm-package-contract.spec.ts --project unit && pnpm --filter @rue-js/runtime-vapor run check && pnpm --filter @rue-js/rsc run build && pnpm --dir packages/text build`
- 预期：所有命令退出 0，JS 工具包 pack 无 CJS，SWC pack 包含 Wasm 且无伪 JS 入口。
- 所需证据：修改前失败、契约通过数、四条构建/检查的退出码和 pack 列表。

## 完成

当工具包无 CJS 发布条件/产物，SWC 保持正确 Wasm 契约，已 ESM 包构建无回归时才能标记完成。
