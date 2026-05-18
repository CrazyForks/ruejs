# Phase 4: 纯 compat 模块外提准备

当类型层、patch 边界和输入桥接都已经拉直后，剩下最适合收尾的是纯 compat 模块本身。现阶段最典型的是 [packages/runtime-vapor/src/runtime/real_dom/element.rs](../../packages/runtime-vapor/src/runtime/real_dom/element.rs) 和 [packages/runtime-vapor/src/runtime/real_dom/fragment.rs](../../packages/runtime-vapor/src/runtime/real_dom/fragment.rs)：它们已经可以被视为 compat-only surface，问题在于调用者和导出面还没有被完全压缩。

## 目标

1. 把 pure compat 模块的拥有权和调用边界显式化。
2. 避免 no-compat 构建路径继续穿过 real_dom compat 模块。
3. 为后续将 compat 保留在独立子系统、或进一步拆到独立包，准备清晰尾单。

## 主要文件

- [packages/runtime-vapor/src/runtime/real_dom/element.rs](../../packages/runtime-vapor/src/runtime/real_dom/element.rs)
- [packages/runtime-vapor/src/runtime/real_dom/fragment.rs](../../packages/runtime-vapor/src/runtime/real_dom/fragment.rs)
- [packages/runtime-vapor/src/runtime/real_dom/compat.rs](../../packages/runtime-vapor/src/runtime/real_dom/compat.rs)
- [packages/runtime-vapor/src/runtime/real_dom/mod.rs](../../packages/runtime-vapor/src/runtime/real_dom/mod.rs)
- [packages/runtime-vapor/src/runtime/real_dom/vapor.rs](../../packages/runtime-vapor/src/runtime/real_dom/vapor.rs)
- [packages/runtime-vapor/src/runtime/render_patch/compat.rs](../../packages/runtime-vapor/src/runtime/render_patch/compat.rs)
- [packages/runtime-vapor/src/runtime/render_patch/mod.rs](../../packages/runtime-vapor/src/runtime/render_patch/mod.rs)
- [packages/runtime-vapor/src/runtime/bridge/mod.rs](../../packages/runtime-vapor/src/runtime/bridge/mod.rs)
- [packages/runtime-vapor/src/runtime/types/compat.rs](../../packages/runtime-vapor/src/runtime/types/compat.rs)

## 当前收口

1. real_dom 侧已经把 compat-only 挂载分发压到 [packages/runtime-vapor/src/runtime/real_dom/compat.rs](../../packages/runtime-vapor/src/runtime/real_dom/compat.rs)，[packages/runtime-vapor/src/runtime/real_dom/mod.rs](../../packages/runtime-vapor/src/runtime/real_dom/mod.rs) 只保留 common-path `mount_core_input` 与单一 `mount_from_input` 入口。
2. [packages/runtime-vapor/src/runtime/real_dom/element.rs](../../packages/runtime-vapor/src/runtime/real_dom/element.rs) 与 [packages/runtime-vapor/src/runtime/real_dom/fragment.rs](../../packages/runtime-vapor/src/runtime/real_dom/fragment.rs) 的挂载入口已收紧为 compat boundary 内部可见，不再对 runtime 主路径开放。
3. `vaporElement` legacy wrapper 检测已经从 [packages/runtime-vapor/src/runtime/real_dom/vapor.rs](../../packages/runtime-vapor/src/runtime/real_dom/vapor.rs) 主路径抽到 [packages/runtime-vapor/src/runtime/real_dom/compat.rs](../../packages/runtime-vapor/src/runtime/real_dom/compat.rs)，common-path 不再直接理解这类 compat object shape。
4. compat patch 分发也已经压到 [packages/runtime-vapor/src/runtime/render_patch/compat.rs](../../packages/runtime-vapor/src/runtime/render_patch/compat.rs)，[packages/runtime-vapor/src/runtime/render_patch/mod.rs](../../packages/runtime-vapor/src/runtime/render_patch/mod.rs) 只保留 type/key 判断、core patch 路径和显式 compat boundary 调用。
5. compat-only 类型继续从 [packages/runtime-vapor/src/runtime/types.rs](../../packages/runtime-vapor/src/runtime/types.rs) 下沉到 [packages/runtime-vapor/src/runtime/types/compat.rs](../../packages/runtime-vapor/src/runtime/types/compat.rs)：`MountedCompatPatchKind`、`MountedCompatPatchState`、`MountedElement` 及其 compat-only helper 已经由 compat 子模块拥有，主文件仅保留 re-export 与薄委托。
6. `types.rs` 公共壳上的具体 compat 公开变体也进一步被折叠：`MountLifecycleKind::Fragment/Element` 已改成 `MountLifecycleKind::Compat(MountedCompatLifecycleKind)`，`MountedState::Element` 已改成 `MountedState::Compat(MountedCompatRootState)`，`MountedPatchSubtreeType::Compat(kind)` 也已经收缩成无负载的 `MountedPatchSubtreeType::Compat`，具体 Fragment/Element kind 与 tag 信息由 [packages/runtime-vapor/src/runtime/types/compat.rs](../../packages/runtime-vapor/src/runtime/types/compat.rs) 中的 compat patch state 持有。
7. runtime 顶层已经不再 re-export mounted/lifecycle 内部状态族；这些类型现在只在 [packages/runtime-vapor/src/runtime/types.rs](../../packages/runtime-vapor/src/runtime/types.rs) 内保持 crate-private 可见，`Rue` 的内部 map/instance/runtime bookkeeping 字段也收紧为 crate-private。对外若只需要观测挂载记录，当前仅保留了最小只读计数访问器，而不再直接暴露 `container_map` / `anchor_map` / `range_map` 本体。
8. mounted/lifecycle 状态族已经从 [packages/runtime-vapor/src/runtime/types.rs](../../packages/runtime-vapor/src/runtime/types.rs) 物理拆到新的 [packages/runtime-vapor/src/runtime/types/mounted.rs](../../packages/runtime-vapor/src/runtime/types/mounted.rs)。`types.rs` 现在只保留 MountInput/public 输入壳与 crate-private re-export 边界，compat 子模块继续经由父模块拿内部类型，因此这一步先完成物理隔离，而不额外制造一轮 import churn。
9. `types.rs` 壳层里剩余那组 compat wrapper 也已经不再通过父模块代持 re-export；compat 专用调用点现在直接依赖 [packages/runtime-vapor/src/runtime/types/compat.rs](../../packages/runtime-vapor/src/runtime/types/compat.rs)，进一步把 `types.rs` 收敛回 MountInput/public 输入壳。
10. 分散在多个回归文件里的 compat boundary 用例现已按边界整理到 [docs/plan11/runtime-vapor-compat-boundary-checklist.md](../../docs/plan11/runtime-vapor-compat-boundary-checklist.md)，后续继续外提 compat 子系统时可以按边界挑选最小验证集，而不必先按文件猜测 coverage。

## 剩余尾单

1. [packages/runtime-vapor/src/runtime/types.rs](../../packages/runtime-vapor/src/runtime/types.rs) 里的 mounted/lifecycle 状态族已经物理下沉完成；若继续外提 compat 子系统，下一步更合适的目标将不是再做一轮 API 收口，而是评估壳层里剩余的 generic compat wrapper 自身是否还能从 `types.rs` 再拆到更窄的内部模块，或者把 compat boundary 进一步组织成更独立的 internal-only 子系统。
2. compat 相关测试虽然已经有了按边界归组的清单，但 fixture 仍分散在 `runtime_wasm_rue`、`runtime_vapor_only_*` 与若干 component/replace 回归文件中；若下一阶段继续做独立外提，可以再补一轮 shared fixture 收束。
3. bridge 层当前已经没有额外的 pure compat `real_dom` 直接调用者；后续若继续精简，对象是 compat patch/type 边界，而不是再回头重做输入桥接。

## 重点工作

1. 缩小 real_dom compat 模块的直接调用者，只允许显式 compat boundary 访问这些模块。
2. 整理 real_dom 与 bridge 层的 re-export，让无 compat 构建不再暴露无意义入口。
3. 将剩余 compat-only helper、测试、fixture 明确归档，避免以后再次回流到 runtime 主干。
4. 形成一份可执行的尾单：哪些逻辑还能继续留在仓库内 feature 下，哪些已经满足独立外提条件。

## 完成标准

1. pure compat 模块的调用者被压缩到明确边界，不再散落在 runtime 主路径。
2. no-compat 构建路径不再穿过 element.rs / fragment.rs 这类 compat-only surface。
3. 剩余未外提的 compat 逻辑具有明确归属与后续处理顺序。

## 依赖关系

- 依赖 Phase 2 和 Phase 3 先把 compat patch 与 compat bridge 收束完毕。
- 如果 Phase 1 没有把类型层拉直，这一阶段会重新遭遇双模 shape 回流。

## 阶段产物

- 一组可独立维护的 compat-only 模块边界，以及一个独立的 mounted/lifecycle internal-only 子模块。
- 一份继续外提 compat 子系统时可直接执行的尾单。
