/*
Compat 子树匹配

封装旧式 mounted subtree 与新 MountInput 的类型匹配逻辑。
组件函数可能经过 portable id 包装，因此这里除了引用相等，也会比较内部组件类型 id。
*/
use crate::runtime::dom_adapter::DomAdapter;
use js_sys::{Object, Reflect};
use wasm_bindgen::JsValue;

use super::MountInputType;
use super::compat_state::MountedCompatPatchKind;
use super::mounted::{MountedPatchSubtree, MountedPatchSubtreeType};

const PORTABLE_COMPONENT_ID_KEY: &str = "__rue_component_type_id";

#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
fn same_component_type(old_render: &JsValue, new_render: &JsValue) -> bool {
    if old_render.eq(new_render) {
        return true;
    }

    let old_id = Reflect::get(old_render, &JsValue::from_str(PORTABLE_COMPONENT_ID_KEY))
        .unwrap_or(JsValue::UNDEFINED);
    let new_id = Reflect::get(new_render, &JsValue::from_str(PORTABLE_COMPONENT_ID_KEY))
        .unwrap_or(JsValue::UNDEFINED);

    !(old_id.is_undefined() || old_id.is_null() || new_id.is_undefined() || new_id.is_null())
        && Object::is(&old_id, &new_id)
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::runtime::js_adapter::JsDomAdapter;
    use crate::runtime::types::ComponentProps;
    use js_sys::{Function, Object, Reflect};
    use wasm_bindgen::JsValue;
    use wasm_bindgen_test::*;

    #[wasm_bindgen_test]
    fn compat_subtree_matches_fragment_element_and_rejects_mismatches() {
        let fragment = MountedPatchSubtree::<JsDomAdapter>::new_compat(
            MountedCompatPatchKind::Fragment,
            ComponentProps::new(),
            Vec::new(),
            None,
            None,
            Vec::new(),
            None,
            None,
        );
        assert!(patch_subtree_matches_input_type(&fragment, &MountInputType::Fragment));
        assert!(!patch_subtree_matches_input_type(
            &fragment,
            &MountInputType::Element("div".to_string())
        ));

        let div = MountedPatchSubtree::<JsDomAdapter>::new_compat(
            MountedCompatPatchKind::Element("div".to_string()),
            ComponentProps::new(),
            Vec::new(),
            None,
            None,
            Vec::new(),
            None,
            None,
        );
        assert!(patch_subtree_matches_input_type(
            &div,
            &MountInputType::Element("div".to_string())
        ));
        assert!(!patch_subtree_matches_input_type(
            &div,
            &MountInputType::Element("span".to_string())
        ));
        assert!(!patch_subtree_matches_input_type(&div, &MountInputType::Fragment));
    }

    #[wasm_bindgen_test]
    fn compat_subtree_matches_component_by_reference_or_portable_id() {
        let render = Function::new_no_args("return null");
        let component = MountedPatchSubtree::<JsDomAdapter>::new_component(
            render.clone().into(),
            None,
            None,
            Vec::new(),
            Vec::new(),
            Vec::new(),
            Vec::new(),
            Vec::new(),
            None,
            None,
        );
        assert!(patch_subtree_matches_input_type(
            &component,
            &MountInputType::Component(render.clone().into())
        ));

        let shared_id = Object::new();
        let old_render = Function::new_no_args("return null");
        let new_render = Function::new_no_args("return null");
        let old_render_value: JsValue = old_render.clone().into();
        let new_render_value: JsValue = new_render.clone().into();
        Reflect::set(&old_render_value, &JsValue::from_str(PORTABLE_COMPONENT_ID_KEY), &shared_id)
            .unwrap();
        Reflect::set(&new_render_value, &JsValue::from_str(PORTABLE_COMPONENT_ID_KEY), &shared_id)
            .unwrap();
        let portable = MountedPatchSubtree::<JsDomAdapter>::new_component(
            old_render_value,
            None,
            None,
            Vec::new(),
            Vec::new(),
            Vec::new(),
            Vec::new(),
            Vec::new(),
            None,
            None,
        );
        assert!(patch_subtree_matches_input_type(
            &portable,
            &MountInputType::Component(new_render_value)
        ));

        let unrelated = Function::new_no_args("return null");
        assert!(!patch_subtree_matches_input_type(
            &portable,
            &MountInputType::Component(unrelated.into())
        ));
    }

    #[wasm_bindgen_test]
    fn compat_subtree_rejects_missing_null_and_distinct_portable_ids() {
        let old_render = Function::new_no_args("return null");
        let new_render = Function::new_no_args("return null");
        let old_render_value: JsValue = old_render.clone().into();
        let new_render_value: JsValue = new_render.clone().into();
        let portable = MountedPatchSubtree::<JsDomAdapter>::new_component(
            old_render_value.clone(),
            None,
            None,
            Vec::new(),
            Vec::new(),
            Vec::new(),
            Vec::new(),
            Vec::new(),
            None,
            None,
        );

        assert!(!patch_subtree_matches_input_type(
            &portable,
            &MountInputType::Component(new_render_value.clone())
        ));

        Reflect::set(
            &old_render_value,
            &JsValue::from_str(PORTABLE_COMPONENT_ID_KEY),
            &JsValue::NULL,
        )
        .unwrap();
        Reflect::set(
            &new_render_value,
            &JsValue::from_str(PORTABLE_COMPONENT_ID_KEY),
            &Object::new(),
        )
        .unwrap();
        assert!(!patch_subtree_matches_input_type(
            &portable,
            &MountInputType::Component(new_render_value.clone())
        ));

        let old_id = Object::new();
        let new_id = Object::new();
        Reflect::set(&old_render_value, &JsValue::from_str(PORTABLE_COMPONENT_ID_KEY), &old_id)
            .unwrap();
        Reflect::set(&new_render_value, &JsValue::from_str(PORTABLE_COMPONENT_ID_KEY), &new_id)
            .unwrap();
        assert!(!patch_subtree_matches_input_type(
            &portable,
            &MountInputType::Component(new_render_value)
        ));
    }
}
