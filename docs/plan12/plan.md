# Plan 12

Plan 12 不再把目标定义成“继续压 compat boundary”，而是把“彻底删除 virtual DOM 语义与相关 compat 子系统”当成一次明确的 major-breaking vapor-only migration。

## 当前判断

- [Plan 11](../plan11/plan.md) 已经把 runtime-vapor 的 compat 边界拉直，所以剩余工作不再主要是 Rust 局部收口，而是跨包删除旧公开契约。
- 当前仓内仍可量化看到两组残留面，以及一组已经收口的底层成果：
   1. [packages/runtime-vapor/src](../../packages/runtime-vapor/src)、[packages/runtime-vapor/tests](../../packages/runtime-vapor/tests) 与 [packages/runtime-vapor/Cargo.toml](../../packages/runtime-vapor/Cargo.toml) 已经完成 Phase 1 收口：`compat` feature 已删除，`createElement` 公开入口与 compat parser 已删除，默认 wasm 回归通过，pkg-node 产物也已去掉旧导出。
   2. [packages/runtime-vapor/src/runtime/transport.rs](../../packages/runtime-vapor/src/runtime/transport.rs)、[packages/runtime-vapor/src/runtime/types/mounted.rs](../../packages/runtime-vapor/src/runtime/types/mounted.rs)、[packages/runtime-vapor/src/hook/reactive.rs](../../packages/runtime-vapor/src/hook/reactive.rs) 这一层仍把默认 transport、mounted snapshot 和 renderable identity 绑定在 mount-handle / host-node 语义上。
   3. [packages/runtime/src](../../packages/runtime/src)、[packages/rue/src](../../packages/rue/src)、[packages/jsx-runtime/src](../../packages/jsx-runtime/src)、[packages/jsx-dev-runtime/src](../../packages/jsx-dev-runtime/src)、[packages/router/src](../../packages/router/src) 以及 swc/vite、custom-elements、hooks 一组公开入口和仓内消费者里，仍有大约 20 个文件直接持有 VDOM / mount-handle / compat-anchor 语义。
- 因此，Plan 12 的大头不是继续删单点 helper，而是同时处理五层东西：
   1. runtime-vapor 的 compat feature 外壳与 compat-only mounted snapshot。
   2. JS <-> Wasm 默认 transport 与 renderable identity/comparator。
   3. JS runtime / rue / jsx-runtime / jsx-dev-runtime 的旧公开输入输出契约。
   4. compiler / router / custom-elements / hooks / app / docs 对旧契约的仓内消费面。
   5. build / docs / tests / release 口径的最终清场。

## 工作量判断

- 如果接受一次明确的 breaking change，不再维持旧 `h/createElement/jsx-runtime` 语义，且优先保证仓内主干、测试和文档迁移完成，整体工作量大致是 4 个阶段、约 3 到 5 周的集中工程量。
- 如果还要求在同一轮里把对外迁移说明、示例、fixture、历史文档与发布口径都完整收束，实际更接近 4 到 6 周。
- 最大阶段仍然不是 Rust 侧单点 helper 删除，而是 [packages/runtime/src/rue.ts](../../packages/runtime/src/rue.ts) / [packages/runtime/src/vapor-runtime.ts](../../packages/runtime/src/vapor-runtime.ts) 这组 JS runtime 公开面断尾，因为这里同时控制了类型、render entry、anchor owner、mount-handle 和 JSX/runtime 导出；隐藏风险则是 [packages/runtime-vapor/src/runtime/transport.rs](../../packages/runtime-vapor/src/runtime/transport.rs) 与 [packages/runtime-vapor/src/hook/reactive.rs](../../packages/runtime-vapor/src/hook/reactive.rs) 仍跟旧协议绑在一起，不能等到最后再处理。

## Plan 12 目标

1. 删除 [packages/runtime-vapor](../../packages/runtime-vapor) 中以 `compat` feature 为边界保留的旧输入、旧 patch、旧 real-dom root shape、compat-only mounted snapshot 与对应测试。
2. 明确 vapor-only 默认 transport / mounted snapshot / renderable identity 契约，不再让默认主路径混入 compat vnode-like / raw element / mount-handle 兼容语义。
3. 删除 [packages/runtime/src/rue.ts](../../packages/runtime/src/rue.ts) 里 `RueMountHandle` / `RenderOutput` / compat anchor owner 这类过渡期公开契约。
4. 让 [packages/rue/src/index.ts](../../packages/rue/src/index.ts)、[packages/runtime/src/index.ts](../../packages/runtime/src/index.ts)、[packages/jsx-runtime/src/index.ts](../../packages/jsx-runtime/src/index.ts)、[packages/jsx-dev-runtime/src/index.ts](../../packages/jsx-dev-runtime/src/index.ts) 与 [packages/rue/jsx.d.ts](../../packages/rue/jsx.d.ts) 不再默认暴露 VDOM-first 语义。
5. 迁移仓内 compiler、router、custom-elements、hooks、app、docs/examples 到 vapor-only / renderable-only 的最终形态。
6. 删除 build、docs、tests、release 里仍把 compat 或 virtual DOM 当作活动系统的叙述与检查脚本。

## 非目标

1. 不在 Plan 12 中继续维护双模 compat/no-compat 构建。
2. 不尝试保留旧 `h/createElement/jsx-runtime` 作为长期兼容层。
3. 不把“对外零 breaking change”作为目标。若需要这条约束，Plan 12 的工作量会明显增大，并应单独立项。

## 新增前置约束

1. Phase 1 必须先冻结 runtime-vapor 的 vapor-only mounted snapshot 与默认 transport 边界，否则 Phase 2 无法判断 `RueMountHandle` 是否还能作为纯内部协议存在。
2. Phase 2 必须先冻结 `render` / `renderBetween` / `renderAnchor` / `renderStatic` 的 owner/cleanup 契约，以及 JSX output contract；否则 Phase 3 的 compiler/router/custom-elements 迁移目标会来回变化。
3. Phase 3 里 compiler 的 slot / children 输出协议需要先定，再批量迁仓内消费者；不能依赖“runtime 之后会继续兜底清洗旧 shape”。

## 阶段拆分

1. [Phase 1: 删除 runtime-vapor 的 compat 特性壳](./1.md)
   先删 Rust 内核里的 compat feature、compat-only mounted state 与 compat-only 测试，同时冻结 vapor-only 默认 transport / mounted snapshot 边界，让底层引擎只剩单模主干。当前这一阶段已经完成，可转入 JS runtime 公开契约清理。
2. [Phase 2: 删除 JS runtime 的 VDOM / mount-handle 公开契约](./2.md)
   再处理 [packages/runtime/src/rue.ts](../../packages/runtime/src/rue.ts)、[packages/runtime/src/vapor-runtime.ts](../../packages/runtime/src/vapor-runtime.ts)、[packages/rue/src/index.ts](../../packages/rue/src/index.ts)、[packages/jsx-runtime/src/index.ts](../../packages/jsx-runtime/src/index.ts)、[packages/jsx-dev-runtime/src/index.ts](../../packages/jsx-dev-runtime/src/index.ts) 这些对外面，并同步改 owner/cleanup 与 renderable identity 语义。
3. [Phase 3: 迁移 compiler、router 与仓内消费者](./3.md)
   把 swc/vite 插件、router、custom-elements、hooks、app fixtures/examples 从旧公开契约迁到新 contract。
4. [Phase 4: 构建、测试、文档与发布清场](./4.md)
   最后删除 `__COMPAT__`、compat policy 文档、兼容脚本、过时 API docs 与测试口径，完成发布前收尾。

## 建议执行顺序

1. 先做 Phase 1。runtime-vapor 不先变成单模内核，Phase 2 仍会被迫继续公开 `RueMountHandle` 一类桥接形状，也无法判断默认 transport 是否还要保留内部 handle protocol。
2. Phase 2 接着做，而且必须和 Phase 1 紧挨着；这是整个计划里风险最高、也是收益最大的阶段，尤其要先冻结 owner/cleanup 与 JSX output contract。
3. Phase 3 依赖 Phase 2 的新 contract，不能倒过来做，否则 router/compiler/custom-elements 迁移目标会反复变化。
4. Phase 4 放最后，因为它主要负责删除已经不再需要的 build/docs/test/release 外壳，并把对外文档口径统一改掉。

## 里程碑口径

- M1（已完成）: [packages/runtime-vapor/src](../../packages/runtime-vapor/src) 与 [packages/runtime-vapor/Cargo.toml](../../packages/runtime-vapor/Cargo.toml) 下不再存在 compat feature 参与的输入、patch、real-dom、types、默认 feature 主路径，且 vapor-only mounted snapshot 与默认 transport 已经稳定。
- M2: [packages/runtime/src/rue.ts](../../packages/runtime/src/rue.ts)、[packages/runtime/src/vapor-runtime.ts](../../packages/runtime/src/vapor-runtime.ts) 与 [packages/runtime-vapor/src/hook/reactive.rs](../../packages/runtime-vapor/src/hook/reactive.rs) 不再依赖 `RueMountHandle`、`compatMountHandleOwner`、`pendingCompatAnchorRenders` 或旧 mount-handle / host-node identity 作为默认公开契约。
- M3: [packages/jsx-runtime/src/index.ts](../../packages/jsx-runtime/src/index.ts)、[packages/jsx-dev-runtime/src/index.ts](../../packages/jsx-dev-runtime/src/index.ts)、[packages/rue/src/index.ts](../../packages/rue/src/index.ts)、[packages/router/src/index.ts](../../packages/router/src/index.ts)、swc/vite compiler、custom-elements 与 hooks 不再依赖 VDOM-style `h(...)` / mount-handle / runtime compat 清洗边界维持行为。
- M4: docs、tests、build 与 release 口径都不再把 compat 或 virtual DOM 当成活动系统，也不再把 `RenderOutput` / `RueMountHandle` / `h` 当作默认对外 contract。

## 退出标准

Plan 12 结束时，应至少满足下面五点：

1. [packages/runtime-vapor/src](../../packages/runtime-vapor/src)、[packages/runtime-vapor/tests](../../packages/runtime-vapor/tests) 与 [packages/runtime-vapor/Cargo.toml](../../packages/runtime-vapor/Cargo.toml) 不再保留 compat feature 壳、compat-only mounted state 与 compat 专属测试面。
2. [packages/runtime-vapor/src/runtime/transport.rs](../../packages/runtime-vapor/src/runtime/transport.rs)、[packages/runtime-vapor/src/runtime/types/mounted.rs](../../packages/runtime-vapor/src/runtime/types/mounted.rs) 与 [packages/runtime-vapor/src/hook/reactive.rs](../../packages/runtime-vapor/src/hook/reactive.rs) 已经切到 vapor-only 默认 contract，不再把 compat vnode-like / mount-handle / host-node 兼容语义当成默认主路径。
3. [packages/runtime/src/rue.ts](../../packages/runtime/src/rue.ts) / [packages/runtime/src/vapor-runtime.ts](../../packages/runtime/src/vapor-runtime.ts) 不再接受或传播 VDOM-style mount handle 公开对象，并且 `render` / `renderBetween` / `renderAnchor` / `renderStatic` 的 owner/cleanup 语义已经稳定。
4. [packages/rue/src/index.ts](../../packages/rue/src/index.ts)、[packages/runtime/src/index.ts](../../packages/runtime/src/index.ts)、[packages/jsx-runtime/src/index.ts](../../packages/jsx-runtime/src/index.ts)、[packages/jsx-dev-runtime/src/index.ts](../../packages/jsx-dev-runtime/src/index.ts) 与 [packages/rue/jsx.d.ts](../../packages/rue/jsx.d.ts) 的默认公开面已经切到 vapor-only / renderable-only 口径。
5. 仓内 compiler、router、custom-elements、hooks、docs/examples/tests/build/release 都已经跟随新口径完成迁移，不再需要 compat policy 或 virtual DOM 术语作为活动说明。