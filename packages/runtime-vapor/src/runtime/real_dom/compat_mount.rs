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
) -> Option<MountedSubtreeState<A>>
where
    A::Element: Clone + From<JsValue> + Into<JsValue>,
{
    match &input.r#type {
        MountInputType::Fragment => fragment::mount_fragment(rue, input),
        MountInputType::Element(tag) => element::mount_element(rue, input, tag),
        _ => super::mount_core_input(rue, input),
    }
}