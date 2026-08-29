# 任务 1: 封闭编译器 JSX 出口

批次：【批次 1】 依赖批次：无

状态：未开始

目的：让 Rue 编译器完整消费 JSX，并在任何残留 JSX 上失败，彻底禁止 SWC automatic runtime 生成 `jsx/jsxs/jsxDEV`。

来源任务：无

预计会话范围：只修改 SWC 编译覆盖、Vite/静态编译驱动和对应契约测试；不改 runtime API、业务组件或包清单。

## 文件

- 修改：`packages/swc-plugin-rue/src/lib.rs`
- 修改：`packages/swc-plugin-rue/src/vapor/visitor.rs`
- 修改：`packages/swc-plugin-rue/src/element_expr.rs`
- 修改：`packages/swc-plugin-rue/tests/import_injection_minimal.rs`
- 修改：`packages/swc-plugin-rue/src/lib_tests.rs`
- 修改：`packages/vite-plugin-rue/index.mjs`
- 修改：`packages/vite-plugin-rue/transform-worker.mjs`
- 修改：`packages/vite-plugin-rue/__tests__/transform.failureHandling.spec.ts`
- 新建：`packages/vite-plugin-rue/__tests__/transform.compilerOnly.spec.ts`

## 上下文

- 当前组件 JSX 已生成 `_$createComponent`，安全元素生成 compiled DOM helper；但 SWC 配置仍启用 `runtime: automatic`，且 Vite 对 RSC 图和两个 rue-design 目录直接跳过。
- 本任务先消除编译器内部漏网与 automatic 兜底；RSC 的服务端目标在任务 7 接入，此处对尚未接入的 RSC 调用保持明确拒绝，不静默返回原源码。

## 测试计划

- 行为：各种 JSX 所在位置均被 Rue 降级；输出不含 JSX AST、`jsx/jsxs/jsxDEV` 调用或 `@rue-js/*jsx-runtime` 导入；不支持形状给出可定位错误。
- 失败验证测试：新增模块级变量、对象字段、参数默认值、嵌套闭包、异步函数、Fragment、成员组件与开发模式样例；新增残留 JSX/跳过目录/RSC 图失败测试。
- 失败验证命令：`cargo test -p swc_plugin_rue --test import_injection_minimal && pnpm exec vitest run packages/vite-plugin-rue/__tests__/transform.compilerOnly.spec.ts packages/vite-plugin-rue/__tests__/transform.failureHandling.spec.ts`
- 预期失败原因：当前 automatic transform 会掩盖残留 JSX并生成 runtime import，部分环境与目录直接跳过 Rue 编译。
- 通过验证命令：`cargo test -p swc_plugin_rue && pnpm exec vitest run packages/vite-plugin-rue/__tests__/transform.compilerOnly.spec.ts packages/vite-plugin-rue/__tests__/transform.failureHandling.spec.ts packages/vite-plugin-rue/__tests__/transform.footerDeepCompile.spec.ts`
- 模拟策略：使用真实 SWC AST、wasm 插件驱动和 Vite transform hook；仅用自定义 executor 构造确定性的残留输出。

## 步骤

1. 先写覆盖所有 JSX 容器位置和残留输出的失败测试。
2. 扩展 Vapor visitor，使非 `return`/箭头根位置的 JSX 也走现有 element/component/fragment lowering。
3. 从 inline 与 worker SWC 配置移除 React automatic transform，保证插件之后不会再生成 JSX runtime 调用。
4. 为 Vite 与 `compileRueStatic` 增加共享的残留 JSX AST 校验和带文件位置的编译错误。
5. 删除 rue-design 路径静默跳过；RSC 图在服务端编译目标接入前必须显式报出未配置目标。
6. 运行完整 Rust 编译器测试和 Vite 聚焦测试，确认错误路径与成功路径均稳定。

## 验证

- 运行：`cargo test -p swc_plugin_rue`
- 运行：`pnpm exec vitest run packages/vite-plugin-rue/__tests__/transform.compilerOnly.spec.ts packages/vite-plugin-rue/__tests__/transform.failureHandling.spec.ts packages/vite-plugin-rue/__tests__/transform.footerDeepCompile.spec.ts`
- 预期：全部退出码 0；成功输出没有 JSX/runtime 调用；不支持输入不再落到 Vite/esbuild 自动 JSX。
- 所需证据：新增样例实现前的 runtime import/残留 JSX失败、实现后的无残留断言、错误消息中的文件和位置、命令退出码 0。

## 完成

完成时报告扩展的 JSX 容器形状、删除的 automatic 配置、残留校验位置和聚焦测试数量；不得引入新的 JSX runtime 别名。
