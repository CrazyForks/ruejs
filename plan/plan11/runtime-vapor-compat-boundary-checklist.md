# Runtime Vapor Compat Boundary Checklist

这份清单不再按测试文件名看回归，而是按 compat boundary 本身归组。目标是让后续继续拆 compat 子系统时，可以先判断“动到了哪条边界”，再选择最小验证集。

共享的 JS fixture 现在集中在 [packages/runtime-vapor/tests/common/mod.rs](../../packages/runtime-vapor/tests/common/mod.rs)，包括 linked adapter、fragment-consuming adapter、`tick`、range/anchor/container setup 和常用 children helper。

## 1. Whole-Root Replace Boundary

边界含义：compat 根在 Fragment 和 Element 之间整块切换时，旧根必须被完整清理，新根必须只留下当前这一份 DOM 身份。

- 覆盖文件：[packages/runtime-vapor/tests/runtime_compat_replace_boundary.rs](../../packages/runtime-vapor/tests/runtime_compat_replace_boundary.rs)
- 关键用例：
  - `render_between_fragment_replace_with_element_keeps_single_new_root`
  - `render_between_element_replace_with_fragment_clears_old_root`
  - `render_anchor_fragment_replace_with_element_keeps_single_new_root`
  - `render_anchor_element_replace_with_fragment_clears_old_root`
  - `render_container_fragment_replace_with_element_keeps_single_new_root`
  - `render_container_element_replace_with_fragment_clears_old_root`
  - `render_container_element_patch_updates_in_place`

## 2. Fragment Same-Type Patch Boundary

边界含义：Fragment -> Fragment 走同类型 patch 时，区间更新必须继续围绕显式 end anchor 运作，不能错误复用已被消费的旧 fragment 节点。

- 覆盖文件：[packages/runtime-vapor/tests/runtime_fragment_patch_anchor_order.rs](../../packages/runtime-vapor/tests/runtime_fragment_patch_anchor_order.rs)
- 关键用例：
  - `render_between_fragment_patch_keeps_children_before_end_anchor`

## 3. Component Root Boundary Inside Compat Paths

边界含义：组件根仍可能落回 compat Fragment 或 compat Element；组件切换时要保证旧 subtree 被正确替换，而不是在 patch 边界上留下重复节点。

- 覆盖文件：[packages/runtime-vapor/tests/runtime_component_switch.rs](../../packages/runtime-vapor/tests/runtime_component_switch.rs)
- 关键用例：
  - `render_between_component_switching_function_replaces_subtree`
- 覆盖文件：[packages/runtime-vapor/tests/runtime_component_fragment_switch.rs](../../packages/runtime-vapor/tests/runtime_component_fragment_switch.rs)
- 关键用例：
  - `render_between_component_switch_fragment_root_in_range`

## 4. Wasm Compat Input And Legacy Wrapper Surface

边界含义：wasm 入口在 compat 构建下仍接受历史 vnode/object/array fragment 形状，但 legacy vapor wrapper 必须被限制在显式 compat boundary 内。

- 覆盖文件：[packages/runtime-vapor/tests/runtime_wasm_rue.rs](../../packages/runtime-vapor/tests/runtime_wasm_rue.rs)
- 关键用例：
  - `wasm_render_accepts_raw_vnode_object_input`
  - `wasm_render_accepts_raw_array_fragment_input`
  - `wasm_vapor_wasm_rejects_legacy_vapor_wrapper_return`
  - `wasm_create_element_function_component_executes_on_render_not_on_create`
  - `wasm_create_element_flattens_nested_array_children`

## 5. Vapor-Only Guardrails Against Compat Leaks

边界含义：no-compat 构建必须拒绝历史 compat surface，确保 compat wrapper 不会沿公共入口重新漏回 vapor-only 主路径。

- 覆盖文件：[packages/runtime-vapor/tests/runtime_vapor_only_input_surface.rs](../../packages/runtime-vapor/tests/runtime_vapor_only_input_surface.rs)
- 关键用例：
  - `vapor_only_render_accepts_host_node_bridge`
  - `vapor_only_render_rejects_raw_element_input`
- 覆盖文件：[packages/runtime-vapor/tests/runtime_vapor_only_component_return_surface.rs](../../packages/runtime-vapor/tests/runtime_vapor_only_component_return_surface.rs)
- 关键用例：
  - `vapor_only_component_accepts_host_node_bridge_return`
  - `vapor_only_component_rejects_array_fragment_return`
  - `vapor_only_component_rejects_bare_raw_host_node_return`

## 6. Public MountInput Entry Surface

边界含义：默认公开入口已经改成 MountInput-first；这组回归确保公开面不需要重新退回历史 compat vnode 树对象。

- 覆盖文件：[packages/runtime-vapor/tests/runtime_mount_input.rs](../../packages/runtime-vapor/tests/runtime_mount_input.rs)
- 关键用例：
  - `render_input_mounts_element_tree_without_vnode`
  - `render_anchor_input_records_anchor_mount_without_vnode`
  - `render_between_input_records_range_mount_without_vnode`
  - `render_static_input_removes_anchor_without_vnode`

## Recommended Validation Sets

最小 compat boundary 回归：

1. `pnpm --filter @rue-js/runtime-vapor run build-dev`
2. `wasm-pack test --node --features dev --features log --test runtime_compat_replace_boundary`
3. `wasm-pack test --node --features dev --features log --test runtime_wasm_rue`

最小 vapor-only guardrail 回归：

1. `pnpm --filter @rue-js/runtime-vapor run build-vapor-dev`
2. `wasm-pack test --node --no-default-features --features runtime --features dev --features log --test runtime_vapor_only_input_surface`
3. `wasm-pack test --node --no-default-features --features runtime --features dev --features log --test runtime_vapor_only_component_return_surface`

涉及 mounted/root state 或公开输入壳时，额外补跑：

1. `wasm-pack test --node --features dev --features log --test runtime_mount_input`
2. `wasm-pack test --node --features dev --features log --test runtime_fragment_patch_anchor_order`
3. `wasm-pack test --node --features dev --features log --test runtime_component_switch`
4. `wasm-pack test --node --features dev --features log --test runtime_component_fragment_switch`
