use crate::runtime::Rue;
use crate::runtime::types::compat_state::MountedCompatPatchKind;
use crate::runtime::types::{
    MountInput, MountInputChild, MountedPatchSubtree, MountedSubtreeChild,
    MountedSubtreeState,
};
use crate::runtime::dom_adapter::DomAdapter;
use wasm_bindgen::JsValue;

pub(super) fn mount_fragment<A: DomAdapter>(
    rue: &mut Rue<A>,
    input: &MountInput<A>,
) -> Option<MountedSubtreeState<A>>
where
    A::Element: Clone + From<JsValue> + Into<JsValue>,
{
    let mut frag = match rue.get_dom_adapter_mut() {
        Some(adapter) => adapter.create_document_fragment(),
        None => {
            rue.handle_error(JsValue::from_str("runtime:mount Fragment no adapter"));
            return None;
        }
    };

    let mut mounted_children = Vec::new();
    for child in input.children.iter() {
        match child {
            MountInputChild::Input(node) => {
                if let Some(mounted_child) = rue.mount_from_input(node) {
                    if let Some(child_el) = mounted_child.host_cloned() {
                        if let Some(adapter) = rue.get_dom_adapter_mut() {
                            adapter.append_child(&mut frag, &child_el);
                        }
                    }
                    mounted_children.push(MountedSubtreeChild::Subtree(mounted_child));
                }
            }
            MountInputChild::Text(text) => {
                if let Some(adapter) = rue.get_dom_adapter_mut() {
                    let tn = adapter.create_text_node(text);
                    adapter.append_child(&mut frag, &tn);
                    mounted_children.push(MountedSubtreeChild::Subtree(MountedSubtreeState::Text(
                        crate::runtime::types::MountedTextSubtree {
                            host: Some(tn),
                            key: None,
                            cleanup_bucket: None,
                            effect_scope_id: None,
                        },
                    )));
                }
            }
        }
    }

    let fragment_nodes = if let Some(adapter) = rue.get_dom_adapter() {
        if adapter.is_fragment(&frag) {
            adapter.collect_fragment_children(&frag)
        } else {
            Vec::new()
        }
    } else {
        Vec::new()
    };

    Some(MountedSubtreeState::Patch(MountedPatchSubtree::new_compat(
        MountedCompatPatchKind::Fragment,
        input.props.clone(),
        mounted_children,
        Some(frag),
        input.key.clone(),
        fragment_nodes,
        input.mount_cleanup_bucket.clone(),
        input.mount_effect_scope_id,
    )))
}
