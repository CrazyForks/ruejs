# Phase 2: Patch 边界收口

Phase 2 处理的是 compat patch 本体，而不是 no-compat 残渣。这里的重点是把 Fragment / Element 相关 patch 行为压回显式 compat boundary，让 vapor-only patch 路径重新变成直线。

## 目标

1. 把 compat patch 的分派、替换和 children 更新逻辑集中到少量边界 helper。
2. 让 no-compat patch 路径不再在通用 children / replace 逻辑里横向感知 compat 类型。
3. 为后续 pure compat 模块外提，缩小 render_patch 对 compat 结构的直接依赖面。

## 主要文件

- [packages/runtime-vapor/src/runtime/render_patch/mod.rs](../../packages/runtime-vapor/src/runtime/render_patch/mod.rs)
- [packages/runtime-vapor/src/runtime/render_patch/replace.rs](../../packages/runtime-vapor/src/runtime/render_patch/replace.rs)
- [packages/runtime-vapor/src/runtime/render_patch/children.rs](../../packages/runtime-vapor/src/runtime/render_patch/children.rs)
- [packages/runtime-vapor/src/runtime/render/mod.rs](../../packages/runtime-vapor/src/runtime/render/mod.rs)

## 重点工作

1. 盘点 render_patch 层里哪些分支只是 compat dispatch，哪些仍然混在通用替换和 children patch 内。
2. 把 compat 的 replace / children patch 抽成专门入口，让 mod.rs 主要承担分派，而不是同时携带 compat 行为细节。
3. 确认组件切换、fragment 根切换、区间替换这些路径都通过同一层 compat boundary 进入，而不是在多个 patch helper 里重复判断。
4. 对照现有 compat 测试，避免边界调整后把历史兼容行为改坏但没有被覆盖到。

## 完成标准

1. no-compat patch 路径不再直接判断 compat Fragment / Element 语义。
2. compat patch 行为集中在少数具名 helper 或子模块里，render_patch 主体结构恢复清晰分层。
3. 组件根切换与 fragment 范围替换仍然保留明确测试覆盖。

## 依赖关系

- 依赖 Phase 1 先稳定 core 类型边界。
- 可与 Phase 3 并行，但不能重新引入未定型的 compat shape。

## 阶段产物

- 一条清晰的 compat patch 入口链路。
- 一条不被 compat 分支污染的 vapor-only patch 主路径。
