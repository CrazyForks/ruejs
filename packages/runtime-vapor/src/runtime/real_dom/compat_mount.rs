/*
Compat 真实 DOM 挂载入口

在启用 compat feature 时，把旧式 Element/Fragment MountInput 转到真实 DOM 创建逻辑。
默认 Vapor 主路径不依赖这里。
*/
use super::super::types::{MountInput, MountInputType, MountedSubtreeState};
use super::Rue;
use crate::runtime::dom_adapter::DomAdapter;
use wasm_bindgen::JsValue;

#[path = "element.rs"]
mod element;
#[path = "fragment.rs"]
mod fragment;

pub(super) fn mount_compat_input<A: DomAdapter>(
    rue: &mut Rue<A>,
    input: &MountInput<A>,
    parent_context: Option<&A::Element>,
) -> Option<MountedSubtreeState<A>>
where
    A::Element: Clone + From<JsValue> + Into<JsValue>,
{
    match &input.r#type {
        MountInputType::Fragment => fragment::mount_fragment(rue, input, parent_context),
        MountInputType::Element(tag) => element::mount_element(rue, input, tag, parent_context),
        _ => super::mount_core_input(rue, input, parent_context),
    }
}
