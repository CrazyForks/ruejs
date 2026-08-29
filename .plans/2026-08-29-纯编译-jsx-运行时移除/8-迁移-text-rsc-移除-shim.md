# 任务 8: 迁移 Text/RSC 并移除 shim

批次：【批次 4】 依赖批次：批次 3

状态：未开始

目的：在 Text/RSC 插件链接入 server JSX target，删除 JSX runtime shim 与 `globalThis` createElement bridge。

来源任务：无

预计会话范围：只迁移 Text/rue-rsc 的插件配置、模块图和兼容测试；服务端 codegen 协议已由任务 7 固定。

## 文件

- 删除：`packages/text/src/shims/jsx-runtime-compat.ts`
- 删除：`packages/text/src/shims/jsx-dev-runtime-compat.ts`
- 修改：`packages/text/src/server/app-context-runtime.ts`
- 修改：`packages/text/src/index.ts`
- 修改：`packages/text/src/build/client-build-config.ts`
- 修改：`packages/text/src/cli.ts`
- 修改：`packages/text/vite.config.ts`
- 修改：`packages/text/tsconfig.json`
- 修改：`packages/rue-rsc/src/plugin.ts`
- 修改：`packages/rue-rsc/src/__tests__/plugin.spec.ts`
- 修改：`packages/text/__tests__/jsx-runtime-compat.test.ts`
- 修改：`packages/text/__tests__/pages-router.test.ts`
- 修改：`packages/text/__tests__/app-router.test.ts`
- 修改：`packages/text/__tests__/link-navigation.test.ts`

## 上下文

- 当前 RSC 环境跳过 Rue transform，Text alias 两个 runtime 子路径并通过 `Symbol.for('text.rueContextRuntime')` 选择 createElement。
- 接入顺序必须是 RSC directive/client-reference 分析在前、任务 7 的 server lowering 在后；client/SSR 图按各自 target 编译，不能破坏 stream 与 proxy 边界。

## 测试计划

- 行为：RSC/SSR 原生元素、组件、Fragment、Context、client reference 与 stream 输出保持一致，模块图无 JSX runtime alias/shim/global bridge。
- 失败验证测试：把 compat 测试改为 server compile 集成测试；扩展 plugin/app/pages 测试断言 transform 顺序、directive prologue 和模块图负依赖。
- 失败验证命令：`pnpm --dir packages/text exec vitest run __tests__/jsx-runtime-compat.test.ts __tests__/app-router.test.ts __tests__/pages-router.test.ts __tests__/link-navigation.test.ts && pnpm exec vitest run packages/rue-rsc/src/__tests__/plugin.spec.ts`
- 预期失败原因：Text/RSC 尚未调用 server target，仍解析 shim 和全局 createElement bridge。
- 通过验证命令：`pnpm --dir packages/text test-unit && pnpm exec vitest run packages/rue-rsc/src/__tests__/plugin.spec.ts`
- 模拟策略：使用现有 RSC plugin harness、模块 runner 与流测试；只模拟模块加载/网络边界。

## 步骤

1. 先反转 compat/插件测试，使它们要求 server target、无 alias 和无全局 bridge。
2. 在 RSC 指令与 client-reference 变换完成后调用任务 7 的 server target；SSR/client 环境选择对应 target。
3. 删除两个 Text shim、app-context runtime 的 createElement 协议和相关 alias/dedupe/optimizeDeps/externals项。
4. 更新 CLI、Text 配置和 rue-rsc 常量/测试，保证模块图不再请求两个旧包。
5. 运行 Text unit 与 rue-rsc plugin 测试，检查 stream、Context、导航和 client reference 行为。

## 验证

- 运行：`pnpm --dir packages/text test-unit`
- 运行：`pnpm exec vitest run packages/rue-rsc/src/__tests__/plugin.spec.ts`
- 运行：`rg -n 'jsx-runtime|jsx-dev-runtime|rueContextRuntime|jsxDEV|\bjsx\s*\(' packages/text/src packages/rue-rsc/src`
- 预期：测试退出码 0；搜索无 runtime shim/调用或全局 bridge；RSC/SSR 输出与迁移前一致。
- 所需证据：实现前 alias/bridge 命中、插件顺序断言、Text/RSC 测试汇总、迁移后搜索空结果。

## 完成

完成时报告 RSC 插件顺序、删除的 shim/bridge 与服务端集成证据；不得新增等价的 Text 私有 JSX runtime。
