# Runtime Vapor JS 边界重构计划

目标：把 `runtime-vapor` 的 Rust Hook 与 Runtime 外壳整体迁回 JavaScript，只保留适合 Wasm 的响应式图内核，并消除浏览器双 Wasm 实例。

范围：迁移 `src/hook`、`src/runtime` 的行为；复用当前 `pkg-vapor`、`reactive.vapor.js`、`vapor-core` 与 compiled-row 快路径；统一三份 reactive wrapper；分阶段切换 Vapor、完整浏览器和 Node 入口；删除 Rust 外壳并回归功能、产物与性能。

范围外：不重做 SWC 列表编译、DOM 热路径、compiled-row patch、性能运行器或最终 release 预算；这些近期改动均视为受保护基线。

假设：当前工作区中的独立 `pkg-vapor`、`vapor-core.ts`、wrapper GC 和列表快路径是性能计划批次 1 至 9 的有效成果；边界计划完成后，再执行 `.plans/2026-08-25-性能架构优化/10-固化全链路性能预算.md`。

## 设计决策

- 不回滚现有三产物拆分，也不永久保留两套浏览器 Wasm；迁移期保留 `pkg`/`pkg-vapor`/`pkg-node`，删完 Rust 外壳后让完整与 Vapor 浏览器入口共享 `pkg-vapor`。
- JS Runtime 放在 `packages/runtime-vapor` 内，避免反向依赖 `packages/runtime`；`vapor-core` 继续负责上层轻量句柄与 DOM host 注入，不复制编译器快路径。
- 三份 reactive 入口先抽为可注入 Wasm 内核的共享 façade，再迁移 Hook；生产入口只在差分测试通过后分阶段切换。
- `computed` 保留必要的 Rust 图失效原语，其余 Hook 语义移至 JS；Node 继续使用独立 `pkg-node`。

## 架构说明

- JS façade 负责值包装、Hook 上下文、effect 调度和公开 API；Rust 只负责 signal/computed/effect 图的低层依赖追踪。
- JS Runtime 依次覆盖输入协议、DOM 容器、锚点/范围、owned mount、组件、生命周期和应用控制；每层均以现有 Rust 行为为差分参考。
- 边界计划不得与性能计划任务 10 并行执行；最终任务只交付回归证据与新基线，不修改性能预算。

## 开发策略

- 对会改变行为的代码，使用失败验证-通过验证-重构。
- 在实施步骤前规划失败验证命令和预期失败。
- 将实施步骤限制在失败测试所证明的行为范围内。
- 测试真实行为，不验证模拟对象或实现细节。
