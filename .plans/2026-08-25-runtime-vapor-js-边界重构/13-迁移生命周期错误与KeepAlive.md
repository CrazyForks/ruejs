# 任务 13: 迁移生命周期、错误与 KeepAlive

批次：【批次 13】 依赖批次 12

状态：未开始

目的：迁移组件生命周期注册/派发、错误捕获、render debug、KeepAlive 激活与停用语义。

来源任务：无

预计会话范围：只处理实例级控制流和共享 runtime bridge，不加入 app/plugin/SSR 公共控制面。

## 文件

- 新建：`packages/runtime-vapor/js-runtime/lifecycle.js`
- 新建：`packages/runtime-vapor/js-runtime/errors.js`
- 新建：`packages/runtime-vapor/js-runtime/keep-alive.js`
- 修改：`packages/runtime-vapor/js-runtime/instance.js`
- 修改：`packages/runtime-vapor/runtime-entry-wrap.js`
- 测试：`packages/runtime/__tests__/runtimeVapor.js-lifecycle-parity.spec.ts`
- 测试：`packages/runtime/__tests__/runtimeVapor.js-error-keepalive-parity.spec.ts`
- 测试：`packages/runtime/__tests__/errorCaptured.vapor.spec.tsx`

## 上下文

- 对照 Rust bridge 的 `on_*`、`on_error`、`keep_alive_lifecycle`、`render_lifecycle.rs` 与 `shared_runtime_bridge.rs`。
- shared bridge 的实例身份和嵌套恢复必须延续现有约束；错误传播顺序、一次性清理和激活/停用不得依赖 Wasm 全局。

## 测试计划

- 行为：生命周期顺序、嵌套当前实例、错误冒泡/截断、render-triggered 和 KeepAlive 周期与 Rust 后端一致。
- 失败验证测试：新增事件序列差分测试，JS 后端当前无生命周期与错误派发时失败。
- 失败验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/runtimeVapor.js-lifecycle-parity.spec.ts packages/runtime/__tests__/runtimeVapor.js-error-keepalive-parity.spec.ts`
- 预期失败原因：JS Runtime 组件实例尚未实现这些控制流。
- 通过验证命令：`pnpm exec vitest run --project unit-jsdom packages/runtime/__tests__/runtimeVapor.js-lifecycle-parity.spec.ts packages/runtime/__tests__/runtimeVapor.js-error-keepalive-parity.spec.ts packages/runtime/__tests__/errorCaptured.vapor.spec.tsx packages/runtime/__tests__/keepAlive.renderable.spec.tsx packages/runtime/__tests__/renderable-lifecycle.spec.ts`
- 模拟策略：使用真实组件树与同步事件日志；仅 server-prefetch 的异步完成点使用可控 Promise。

## 步骤

1. 写正常、嵌套、抛错、捕获、激活/停用和卸载序列的失败测试。
2. 确认 Rust 参考序列，定位 JS 缺失能力。
3. 实现生命周期注册/派发、错误边界和 KeepAlive 状态转换。
4. 将 current instance 接入现有 shared bridge，确保 finally 恢复。
5. 运行现有 errorCaptured、KeepAlive 和 renderable 生命周期回归。

## 验证

- 运行：通过验证命令。
- 预期：所有事件序列与错误传播结果一致，停用实例不误触发 mount/unmount。
- 所需证据：失败/通过日志、事件序列、捕获结果和 shared bridge 身份检查。

## 完成

只有 Rust lifecycle bridge 的可观察行为全部由 JS 实现且错误/嵌套路径无上下文泄漏时才算完成。
