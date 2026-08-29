# 任务 8: 删除内部 CJS 构建流程

批次：【批次 8】 依赖批次 7

状态：未开始

目的：在全部包迁移后删除共享构建器、根脚本和 Text/SFC 准备流程的 Rue 内部 CJS 路径。

来源任务：无

预计会话范围：只清理 Rue 工作区发布工厂与其直接消费者，不改 RSC/Text 的第三方 CJS 兼容实现。

## 文件

- 新建：`scripts/__tests__/esm-only-package-builder.spec.ts`
- 修改：`scripts/vite-package-builder.js`
- 修改：`scripts/build.js`
- 修改：`scripts/ensure-text-test-dependencies.js`
- 修改：`scripts/pre-dev-sfc.js`
- 修改：`packages/text/__tests__/fixture-dev-server.ts`
- 修改：`packages/text/__tests__/app-page-probe.test.ts`
- 修改：`packages/global.d.ts`
- 修改：`vite.config.ts`
- 修改：`packages/rue-ssr-binary-demo/vite.config.ts`
- 修改：`packages/runtime/__benchmarks__/js-framework/vite.config.ts`
- 修改：`package.json`
- 测试：`scripts/__tests__/esm-only-package-builder.spec.ts`

## 上下文

- 共享构建器当前默认 ESM+CJS，并有 CJS 输出目录、prod 变体、platform、minify 与 `__CJS__` 分支。
- 根准备脚本、Text fixture 和 SFC preflight 直接检查/构建 CJS，包迁移后会反复误判需要重建。

## 测试计划

- 行为：共享工厂只接受 Rue 发布所需 ESM/browser/global 格式，所有准备流程只等待 ESM 产物且第二次运行不重建。
- 失败验证测试：`esm-only-package-builder.spec.ts` 覆盖默认格式、CJS 拒绝和 ESM 子路径输出；黑盒连续运行 Text 准备两次。
- 失败验证命令：`pnpm exec vitest run scripts/__tests__/esm-only-package-builder.spec.ts --project unit`
- 预期失败原因：构建器仍接受/生成 CJS，准备脚本仍等待已删除的 CJS 文件。
- 通过验证命令：`pnpm exec vitest run scripts/__tests__/esm-only-package-builder.spec.ts --project unit && pnpm run prepare-unit-test-artifacts`
- 模拟策略：构建器测试使用真实临时包，Text 准备使用真实工作区产物，不 mock 文件系统。

## 步骤

1. 先新增失败的 ESM-only 构建器契约。
2. 从共享工厂删除 CJS 默认/映射/请求/输出分支和未使用的 `__CJS__` 定义。
3. 将根 `prepare-unit-test-artifacts`、SFC build/preflight 和 Text 产物检查改为 ESM，删除 `build-all-cjs` 并用 ESM 对应脚本替代。
4. 将 Text fixture 的 Server Renderer 准备改为 ESM，同步更新内部假栈文件名。
5. 运行构建器测试、产物准备和连续两次 Text 准备黑盒检查。

## 验证

- 运行：`pnpm exec vitest run scripts/__tests__/esm-only-package-builder.spec.ts --project unit && pnpm run prepare-unit-test-artifacts`
- 运行：`node scripts/ensure-text-test-dependencies.js && node scripts/ensure-text-test-dependencies.js`
- 预期：命令退出 0，构建器拒绝 CJS，第二次 Text 准备不输出重建提示。
- 所需证据：实施前失败、构建器测试数、准备命令退出码和第二次运行无重建提示。

## 完成

当 Rue 内部分发构建器不再支持 CJS，所有直接工作流仅依赖 ESM 产物，且聚焦验证通过时才能标记完成。
