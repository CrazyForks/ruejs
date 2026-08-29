# 任务 7: 新增服务端 JSX 编译目标

批次：【批次 3】 依赖批次：批次 2

状态：未开始

目的：为 Rue SWC/Vite 编译器建立服务端 JSX target，生成 server-renderer 可消费的窄操作且不依赖 JSX runtime。

来源任务：无

预计会话范围：只定义和验证 SWC、Vite、server-renderer 之间的服务端编译协议；不接入 Text/RSC 配置，不删除 shim。

## 文件

- 修改：`packages/vite-plugin-rue/index.mjs`
- 修改：`packages/vite-plugin-rue/index.d.ts`
- 修改：`packages/swc-plugin-rue/src/lib.rs`
- 修改：`packages/swc-plugin-rue/src/imports.rs`
- 修改：`packages/server-renderer/src/index.ts`
- 删除：`packages/text/src/shims/jsx-runtime-compat.ts`
- 删除：`packages/text/src/shims/jsx-dev-runtime-compat.ts`
- 新建：`packages/swc-plugin-rue/tests/server_target.rs`
- 新建：`packages/vite-plugin-rue/__tests__/transform.serverTarget.spec.ts`
- 修改：`packages/server-renderer/__tests__/server-renderer.spec.tsx`

## 上下文

- 当前 compiler 只有浏览器 DOM/Vapor lowering；服务端目标必须生成 server-renderer 可消费的原生、组件与 Fragment 操作，禁止复用浏览器 DOM helper。
- `use client/use server` prologue 必须原样保留，以便任务 8 在 RSC 引用变换之后安全接入此目标。

## 测试计划

- 行为：server target 将原生元素、组件、Fragment、Context 和异步组件输入编译为窄 server 操作，输出不含浏览器 DOM helper、JSX AST 或 JSX runtime import。
- 失败验证测试：新增 Rust server target codegen、Vite `compileRueStatic({ target: 'server' })` 和 server-renderer 行为测试。
- 失败验证命令：`cargo test -p swc_plugin_rue --test server_target && pnpm exec vitest run packages/vite-plugin-rue/__tests__/transform.serverTarget.spec.ts packages/server-renderer/__tests__/server-renderer.spec.tsx`
- 预期失败原因：编译器配置没有 target，现有 lowering 固定生成浏览器 compiled/vapor helper。
- 通过验证命令：`cargo test -p swc_plugin_rue --test server_target && pnpm exec vitest run packages/vite-plugin-rue/__tests__/transform.serverTarget.spec.ts packages/server-renderer/__tests__/server-renderer.spec.tsx`
- 模拟策略：使用真实 SWC、静态编译 API 和 server renderer；只模拟异步组件 loader 的完成时机。

## 步骤

1. 先写原生元素、组件、Fragment、Context、异步结果和 directive prologue 的 server target 失败测试。
2. 为 SWC 插件配置增加显式 client/server target，并让 import routing 选择 server-renderer 窄入口。
3. 在 server-renderer 中暴露仅供编译产物使用的原生/组件/Fragment操作，复用现有转义、异步和 Context 语义。
4. 给 Vite transform 与 `compileRueStatic` 增加 typed target 选项，client 继续默认，server 输出执行同一残留 JSX 校验。
5. 运行 Rust codegen、Vite 静态编译和 server-renderer 聚焦测试，确认两种 target 不串包。

## 验证

- 运行：`cargo test -p swc_plugin_rue --test server_target`
- 运行：`pnpm exec vitest run packages/vite-plugin-rue/__tests__/transform.serverTarget.spec.ts packages/server-renderer/__tests__/server-renderer.spec.tsx`
- 预期：测试退出码 0；server output 无浏览器/JSX runtime 引用；client output 不引入 server helper。
- 所需证据：实现前 target 缺失失败、client/server import 快照、SSR 输出、directive prologue 与异步/Context 断言。

## 完成

完成时说明 server target 的输出协议、公开给编译器的窄入口和 client/server 隔离证据；不得在本任务提前改 Text/RSC 配置。
