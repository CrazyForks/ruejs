//! 真实 DOM 创建的入口与分发（中文增强版）
//!
//! - 按 MountInputType 分发到具体构建函数
//! - 无 DomAdapter 时走降级路径（fallback）
//! - 复用已缓存元素，避免重复创建
//! - 组件场景预计算 props（含 children）以便 JS 调用
//! - 保留 Vapor setup 直接返回块根节点的语义，不与组件默认返回协议混用
use super::Rue;
use super::types::{MountInput, MountInputType, MountedSubtreeState};
use crate::runtime::dom_adapter::DomAdapter;
use wasm_bindgen::JsValue;
#[cfg(feature = "compat")]
mod compat_mount;
#[cfg(feature = "compat")]
mod compat_vapor_wrapper;
mod component;
pub(crate) mod convert;
pub(crate) mod helpers;
mod text;
mod vapor;

fn mount_core_input<A: DomAdapter>(
    rue: &mut Rue<A>,
    input: &MountInput<A>,
) -> Option<MountedSubtreeState<A>>
where
    A::Element: Clone + From<JsValue> + Into<JsValue>,
{
    match &input.r#type {
        MountInputType::Text(_) => text::mount_text(rue, input),
        #[cfg(feature = "compat")]
        MountInputType::Fragment => None,
        MountInputType::Vapor => vapor::mount_vapor(rue, input),
        MountInputType::VaporWithSetup(setup) => vapor::mount_vapor_with_setup(rue, input, setup),
        MountInputType::Component(render_fn) => component::mount_component(rue, input, render_fn),
        #[cfg(feature = "compat")]
        MountInputType::Element(_) => None,
        MountInputType::_Phantom(_) => None,
    }
}

impl<A: DomAdapter> Rue<A>
where
    A::Element: Clone,
{
    pub(crate) fn mount_from_input(&mut self, input: &MountInput<A>) -> Option<MountedSubtreeState<A>>
    where
        A::Element: From<JsValue> + Into<JsValue>,
    {
        if self.get_dom_adapter_mut().is_none() {
            return None;
        }

        #[cfg(feature = "compat")]
        {
            return compat_mount::mount_compat_input(self, input);
        }

        #[cfg(not(feature = "compat"))]
        {
            mount_core_input(self, input)
        }
    }
}
