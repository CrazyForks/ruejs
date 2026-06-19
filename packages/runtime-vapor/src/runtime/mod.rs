/*
Runtime 模块出口

这一层是 Vapor wasm 运行时的宿主侧核心：
- bridge：暴露给 JS 的 WasmRue API 与输入队列
- render/real_dom/render_patch：挂载、更新、替换与 DOM 操作
- transport/types：默认 MountInput 协议与 mounted snapshot
- props/lifecycle/shared bridge：属性补丁、生命周期和 JS 共享运行时协作

对外只导出少量稳定类型，其余模块尽量保持 crate 内部使用。
*/
mod bridge;
mod core;
mod dom_adapter;
mod error_strings;
mod globals;
mod input_props;
mod instance;
mod js_adapter;
mod props;
mod real_dom;
mod render;
mod render_lifecycle;
mod render_patch;
mod shared_runtime_bridge;
mod transport;
mod types;

pub use bridge::{WasmRue, createRue};
pub use core::Rue;
pub use dom_adapter::DomAdapter;
pub use globals::{MOUNT_INPUT_REGISTRY, push_pending_hook, take_pending_hooks};
pub use globals::{is_runtime_crashed, last_hook_error, mark_crashed_from_hook};
pub use instance::*;
pub use js_adapter::JsDomAdapter;
pub use props::*;
pub use types::{
    ComponentProps, FC, MountInput, MountInputChild, MountInputType, PropsWithChildren,
};

#[doc(hidden)]
pub fn coverage_touch_real_dom_component_edges() -> bool {
    real_dom::component::coverage_touch_internal_edges()
}
