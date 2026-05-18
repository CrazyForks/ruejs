use crate::runtime::Rue;
use crate::runtime::dom_adapter::DomAdapter;
use crate::runtime::props::{Props as RuntimeProps, patch_props, post_patch_element};
use crate::runtime::types::compat_state::MountedCompatPatchKind;
use crate::runtime::types::{
    MountInput, MountInputChild, MountedPatchSubtree, MountedSubtreeChild, MountedSubtreeState,
    MountedTextSubtree,
};
use wasm_bindgen::JsValue;

/// 通过 DomAdapter 根据标签创建元素
fn build_element<A: DomAdapter>(
    rue: &mut Rue<A>,
    tag: &String,
    parent_context: Option<&A::Element>,
) -> Option<A::Element> {
    match rue.get_dom_adapter_mut() {
        Some(a) => Some(a.create_element_in_parent(tag.as_str(), parent_context)),
        None => {
            rue.handle_error(JsValue::from_str("runtime:create_real_dom Element no adapter"));
            None
        }
    }
}

fn collect_input_props<A: DomAdapter>(input: &MountInput<A>) -> RuntimeProps {
    let mut new_props: RuntimeProps = RuntimeProps::new();
    for (k, v) in input.props.iter() {
        new_props.insert(k.clone(), v.clone());
    }
    new_props
}

/// 应用初始属性（与空映射 diff）到元素
fn apply_initial_props<A: DomAdapter>(
    rue: &mut Rue<A>,
    el: &mut A::Element,
    new_props: &RuntimeProps,
) {
    if let Some(a) = rue.get_dom_adapter_mut() {
        let empty = RuntimeProps::new();
        if let Err(e) = patch_props(a, el, &empty, new_props) {
            rue.handle_error(e);
        }
    } else {
        rue.handle_error(JsValue::from_str(
            "runtime:create_real_dom Element patch_props no adapter",
        ));
    }
}

fn mount_children<A: DomAdapter>(
    rue: &mut Rue<A>,
    el: &mut A::Element,
    input: &MountInput<A>,
) -> Vec<MountedSubtreeChild<A>>
where
    A::Element: From<JsValue> + Into<JsValue> + Clone,
{
    let mut mounted_children = Vec::new();
    for child in input.children.iter() {
        match child {
            MountInputChild::Text(text) => {
                if let Some(adapter) = rue.get_dom_adapter_mut() {
                    let tn = adapter.create_text_node(text);
                    adapter.append_child(el, &tn);
                    mounted_children.push(MountedSubtreeChild::Subtree(MountedSubtreeState::Text(
                        MountedTextSubtree {
                            host: Some(tn),
                            key: None,
                            cleanup_bucket: None,
                            effect_scope_id: None,
                        },
                    )));
                }
            }
            MountInputChild::Input(node) => {
                if let Some(mounted_child) = rue.mount_from_input(node, Some(el)) {
                    if let Some(child_el) = mounted_child.host_cloned() {
                        if let Some(adapter) = rue.get_dom_adapter_mut() {
                            adapter.append_child(el, &child_el);
                        }
                    }
                    mounted_children.push(MountedSubtreeChild::Subtree(mounted_child));
                }
            }
        }
    }

    mounted_children
}

pub(super) fn mount_element<A: DomAdapter>(
    rue: &mut Rue<A>,
    input: &MountInput<A>,
    tag: &String,
    parent_context: Option<&A::Element>,
) -> Option<MountedSubtreeState<A>>
where
    A::Element: Clone + From<JsValue> + Into<JsValue>,
{
    let mut el = match build_element(rue, tag, parent_context) {
        Some(e) => e,
        None => return None,
    };
    let new_props = collect_input_props(input);
    apply_initial_props(rue, &mut el, &new_props);
    let mounted_children = if !new_props.contains_key("dangerouslySetInnerHTML") {
        mount_children(rue, &mut el, input)
    } else {
        Vec::new()
    };
    post_patch(rue, &mut el, &new_props);

    Some(MountedSubtreeState::Patch(MountedPatchSubtree::new_compat(
        MountedCompatPatchKind::Element(tag.clone()),
        input.props.clone(),
        mounted_children,
        Some(el),
        input.key.clone(),
        Vec::new(),
        None,
        None,
    )))
}

/// 元素级别后置补丁：执行元素特定的最终处理
fn post_patch<A: DomAdapter>(rue: &mut Rue<A>, el: &mut A::Element, new_props: &RuntimeProps) {
    if let Some(a) = rue.get_dom_adapter_mut() {
        if let Err(e) = post_patch_element(a, el, new_props) {
            rue.handle_error(e);
        }
    } else {
        rue.handle_error(JsValue::from_str(
            "runtime:create_real_dom Element post_patch no adapter",
        ));
    }
}
