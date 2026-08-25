# 任务 14: 迁移应用、插件、SSR 与控制面

批次：【批次 14】 依赖批次 13

状态：未开始

目的：补齐 createRue 的 app/plugin、emitted、current container、server prefetch 和公开控制方法。

来源任务：无

预计会话范围：完成 JS Runtime 剩余公共方法，使其达到入口切换条件；不切换入口、不删除 Rust。

## 文件

- 新建：`packages/runtime-vapor/js-runtime/app.js`
- 新建：`packages/runtime-vapor/js-runtime/plugins.js`
- 修改：`packages/runtime-vapor/js-runtime/create-rue.js`
- 修改：`packages/runtime-vapor/js-runtime/types.js`
- 测试：`packages/runtime/__tests__/runtimeVapor.js-public-api-parity.spec.ts`
- 测试：`packages/runtime/__tests__/useVaporApp.spec.tsx`
- 测试：`packages/runtime/__tests__/server.ssr.spec.ts`

## 上下文

- 对照 `src/runtime/core.rs`、`globals.rs`、`transport.rs` 及 bridge 的 `create_rue`、`emitted`、`get_current_container`、`on_server_prefetch`、`use_plugin`。
- 只实现当前导出与调用方实际需要的控制面，不增加后端选择 flag 或通用扩展注册表。

## 测试计划

- 行为：JS Runtime 的公开方法集合、返回值、插件顺序、emitted 查询、容器作用域和 SSR prefetch 与 Rust 参考一致。
- 失败验证测试：新增公开 API 差分矩阵，包含重复 plugin、异步 prefetch、未挂载查询和卸载后错误。
- 失败验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/runtimeVapor.js-public-api-parity.spec.ts packages/runtime/__tests__/useVaporApp.spec.tsx packages/runtime/__tests__/server.ssr.spec.ts`
- 预期失败原因：JS Runtime 尚未实现应用控制面和 SSR 协调。
- 通过验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/runtimeVapor.js-public-api-parity.spec.ts packages/runtime/__tests__/useVaporApp.spec.tsx packages/runtime/__tests__/server.ssr.spec.ts`
- 模拟策略：插件与组件使用真实 Runtime；SSR 只模拟不可用的浏览器 DOM 边界，保留真实 Promise 聚合。

## 步骤

1. 写公开方法矩阵与 app/plugin/SSR 的失败差分测试。
2. 确认 Rust 参考通过、JS 方法缺失或结果不同。
3. 实现当前 app 状态、插件安装、emitted/current container 和 server prefetch。
4. 对齐类型与显式错误，不保留无调用方的 Rust 内部结构。
5. 运行任务 8 至 13 的 JS Runtime 全部差分测试。

## 验证

- 运行：通过验证命令及 `pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/runtimeVapor.js-*.spec.ts`。
- 预期：JS Runtime 目标方法矩阵完整，所有差分用例通过，生产入口仍指向现有 Rust 实现。
- 所需证据：失败/通过输出、公开方法矩阵、插件/SSR 事件序列和入口 diff。

## 完成

只有 JS Runtime 达到分阶段入口切换所需的完整公开行为，且没有推测性 API 时才算完成。
