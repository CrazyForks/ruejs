use crate::runtime::dom_adapter::DomAdapter;
use js_sys::{Object, Reflect};
use wasm_bindgen::JsValue;

use super::MountInputType;
use super::compat_state::MountedCompatPatchKind;
use super::mounted::{MountedPatchSubtree, MountedPatchSubtreeType};

const PORTABLE_COMPONENT_ID_KEY: &str = "__rue_component_type_id";

fn same_component_type(old_render: &JsValue, new_render: &JsValue) -> bool {
    if old_render.eq(new_render) {
        return true;
    }

    let old_id = Reflect::get(old_render, &JsValue::from_str(PORTABLE_COMPONENT_ID_KEY))
        .unwrap_or(JsValue::UNDEFINED);
    let new_id = Reflect::get(new_render, &JsValue::from_str(PORTABLE_COMPONENT_ID_KEY))
        .unwrap_or(JsValue::UNDEFINED);

    if old_id.is_undefined() || old_id.is_null() || new_id.is_undefined() || new_id.is_null() {
        return false;
    }

    Object::is(&old_id, &new_id)
}

pub(super) fn patch_subtree_matches_input_type<A: DomAdapter>(
    node: &MountedPatchSubtree<A>,
    input_type: &MountInputType<A>,
) -> bool {
    match (&node.r#type, node.compat.kind.as_ref(), input_type) {
        (
            MountedPatchSubtreeType::Compat,
            Some(MountedCompatPatchKind::Fragment),
            MountInputType::Fragment,
        ) => true,
        (
            MountedPatchSubtreeType::Compat,
            Some(MountedCompatPatchKind::Element(old_tag)),
            MountInputType::Element(new_tag),
        ) => old_tag == new_tag,
        (
            MountedPatchSubtreeType::Component(old_render),
            _,
            MountInputType::Component(new_render),
        ) => same_component_type(old_render, new_render),
        _ => false,
    }
}

#[cfg(feature = "dev")]
pub(super) fn patch_subtree_debug_name<A: DomAdapter>(node: &MountedPatchSubtree<A>) -> String {
    match (&node.r#type, node.compat.kind.as_ref()) {
        (MountedPatchSubtreeType::Compat, Some(MountedCompatPatchKind::Fragment)) => {
            "Fragment".to_string()
        }
        (MountedPatchSubtreeType::Compat, Some(MountedCompatPatchKind::Element(tag))) => {
            format!("Element({})", tag)
        }
        (MountedPatchSubtreeType::Component(_), _) => "Component".to_string(),
        (MountedPatchSubtreeType::Compat, None) => "Compat".to_string(),
    }
}
