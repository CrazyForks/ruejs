# runtime-vapor compat 逐步删除计划

## 结论

可以逐步删除，但不建议直接一次性删除。

当前 `packages/runtime-vapor` 已经具备拆分基础：默认 Vapor/Text/Component 主路径在 `--no-default-features --features runtime` 下可以 `cargo check` 通过，说明主源码路径基本不依赖 compat。剩余工作主要集中在测试矩阵、公开 wasm bridge API、旧 Element/Fragment 挂载与 patch 状态清理。

预计完整开发周期：7-10 个工作日。

如果只做到“默认构建不再启用 compat，但保留显式 compat feature”，预计 2-3 个工作日。

## 范围

本计划只处理：

- `packages/runtime-vapor/src/runtime`
- `packages/runtime-vapor/tests`
- `packages/runtime-vapor/Cargo.toml`
- `packages/runtime-vapor/package.json` 中相关构建脚本
- 必要时调整调用 `@rue-js/runtime-vapor` 的 runtime 包装层

不处理：

- `packages/text` 的 Text.js compatibility 体系
- 文档中的 Text.js 兼容说明
- 非 runtime-vapor 的独立兼容扫描工具

## 当前状态

已确认：

- `cargo check --manifest-path packages/runtime-vapor/Cargo.toml` 通过。
- `cargo check --manifest-path packages/runtime-vapor/Cargo.toml --no-default-features --features runtime` 通过。
- `pnpm run check:compat-cleanup` 通过。

当前阻塞：

- `cargo test --manifest-path packages/runtime-vapor/Cargo.toml --no-default-features --features runtime` 失败。
- 失败原因主要是测试代码还无条件构造 `MountInputType::Fragment`、`MountInputType::Element`、`MountedSubtreeChild` 等 compat-only 类型。
- `Cargo.toml` 当前仍然是 `default = ["runtime", "compat"]`。
- `createElement` wasm bridge 目前只在 `compat` feature 下导出，公开 API 需要先确认替代路径。

## 删除策略

采用“三段式”迁移：

1. 先让无 compat 成为可测路径。
2. 再让无 compat 成为默认构建路径。
3. 最后删除 compat 实现文件和类型。

这样可以把风险从“运行时行为突然断裂”变成“每个阶段都有明确测试边界”。

## 阶段 1：修复无 compat 测试矩阵

预计：1-2 个工作日。

任务：

- 给 compat-only 测试补齐 `#[cfg(feature = "compat")]`。
- 将默认路径测试改用 `Text`、`Vapor`、`VaporWithSetup`、`Component`、mount handle，不再构造 `Element/Fragment`。
- 拆分目前混合测试中的 compat 分支，避免无 compat 构建编译到旧类型。
- 新增或调整 CI 命令，至少覆盖：
  - `cargo check --no-default-features --features runtime`
  - `cargo test --no-default-features --features runtime`
  - `cargo test`

验收：

- 无 compat 的 `cargo test` 通过。
- 默认 compat 的 `cargo test` 仍通过。
- 不改变 JS 层行为。

## 阶段 2：默认关闭 compat feature

预计：1 个工作日。

任务：

- 修改 `packages/runtime-vapor/Cargo.toml`：
  - 从 `default = ["runtime", "compat"]`
  - 改为 `default = ["runtime"]`
- 增加显式 compat 构建脚本，例如：
  - `build-compat`
  - `build-node-compat`
  - `test-compat`
- 检查 `ensure-runtime-vapor-build.js`、`build.js`、`release.js` 是否依赖默认 compat 产物。
- 明确 npm 包默认入口是否继续使用无 compat runtime。

验收：

- 默认构建产物不带 compat。
- 显式 compat 构建仍可用，方便回滚。
- `pnpm run test` 不因默认 feature 切换失败。

## 阶段 3：收口公开 bridge API

预计：1-2 个工作日。

任务：

- 评估 `createElement` wasm bridge 是否还需要作为公开 wasm API 保留。
- 如果 JS runtime 已完全使用 repeatable mount handle，则删除或迁移 Rust `createElement` compat 出口。
- 确认 `createComponent` 非函数 fallback 不再回落到 `createElement`。
- 收紧 `renderAnchor`、`renderBetween`、`renderStatic` 的输入面：
  - 默认只接受 tagged mount handle、portable component/vapor handle、host-node bridge。
  - 不再接受旧 vnode object、raw array、raw node 作为 compat 输入。

验收：

- `@rue-js/rue`、`@rue-js/rue/vapor` 的公开 API 测试通过。
- 旧 compat 输入在默认路径给出明确错误，而不是静默误挂载。
- 组件、slot、KeepAlive、Suspense、Transition 相关测试通过。

## 阶段 4：删除真实 DOM compat 挂载层

预计：1-2 个工作日。

任务：

- 删除或清空以下 compat-only 文件：
  - `runtime/real_dom/compat_mount.rs`
  - `runtime/real_dom/compat_vapor_wrapper.rs`
  - `runtime/real_dom/element.rs`
  - `runtime/real_dom/fragment.rs`
- 移除 `MountInputType::Element`、`MountInputType::Fragment`。
- 删除 `vnode_helpers.rs` 中旧 vnode object 到 `MountInput` 的转换逻辑。
- 删除 `real_dom/convert.rs` 中 compat object、array fragment、legacy wrapper 相关分支。

验收：

- `cargo check`、`cargo test` 通过。
- JS 单测通过。
- 默认渲染、Vapor setup、组件返回值、host-node bridge 行为正常。

## 阶段 5：删除 patch/types compat 状态

预计：2-3 个工作日。

任务：

- 删除：
  - `runtime/render_patch/compat.rs`
  - `runtime/types/compat_state.rs`
  - `runtime/types/compat_subtree.rs`
  - `runtime/types/compat_lifecycle.rs`
  - `runtime/types/compat_patch_root.rs`
- 简化 `MountedPatchSubtreeType`，只保留 `Component`。
- 简化 `MountedState`，删除 `Compat` root。
- 简化 lifecycle record 逻辑，删除 compat Fragment/Element 递归策略。
- 删除 `MountedSubtreeChild`，或改为默认路径真正需要的结构。
- 清理 render patch children 中针对 compat Fragment/Element 的 patch/reorder/replace 逻辑。

验收：

- Rust tests 通过。
- JS/Vitest 单测通过。
- E2E 测试通过。
- 搜索不到 runtime-vapor 内部 compat-only 类型和分支。

## 阶段 6：清理构建、文档和保护网

预计：0.5-1 个工作日。

任务：

- 删除显式 compat 构建脚本，或标记为临时 fallback 后再移除。
- 扩展 `scripts/check-compat-cleanup.js`，把 runtime-vapor 内部旧类型也纳入禁止列表。
- 更新迁移/发布说明。
- 检查 wasm 包大小变化。

验收：

- `pnpm run check:compat-cleanup` 通过。
- `pnpm run test` 通过。
- `pnpm run build` 通过。
- release-check 相关流程通过。

## 风险点

- `createElement` wasm bridge 是最大公开 API 风险，需要先确认没有外部直接调用。
- `renderAnchor` 当前在 compat 构建下放宽输入，删除后可能影响旧编译产物或手写调用。
- `MountedState::Compat` 删除会影响 KeepAlive range lifecycle、anchor map 清理、fragment replacement 等边界。
- 测试中还有大量 compat 覆盖用例，必须先拆分，否则无法可靠判断默认路径是否健康。

## 推荐排期

保守排期：

- 第 1-2 天：修无 compat 测试矩阵。
- 第 3 天：默认关闭 compat feature，保留显式 compat fallback。
- 第 4-5 天：收口 bridge API 和 JS runtime 调用。
- 第 6-7 天：删除 real_dom compat 挂载层。
- 第 8-9 天：删除 render_patch/types compat 状态。
- 第 10 天：全量测试、构建、文档和体积检查。

更现实的整体预估：1.5-2 周。

如果中途发现外部包仍直接依赖 `@rue-js/runtime-vapor` 的 compat `createElement` 行为，需要额外预留 2-3 天做迁移和兼容发布说明。

## 第一刀建议

先不要直接删实现文件。

第一刀应该是让下面命令通过：

```sh
cargo test --manifest-path packages/runtime-vapor/Cargo.toml --no-default-features --features runtime
```

这个命令通过后，再切默认 feature。这样最稳，也最容易回滚。
