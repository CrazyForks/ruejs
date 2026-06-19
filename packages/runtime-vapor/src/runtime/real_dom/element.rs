/*
默认 Element / Fragment 挂载

兼容包移除后，createElement 仍需要把基础 JSX/TSX 元素落到默认 MountInput
路径。这里只负责初始创建与插入；后续更新沿用当前 Vapor/host-node 的整体替换策略。
*/
use super::super::Rue;
use super::super::types::{
    ComponentProps, MountInput, MountInputChild, MountedSubtreeState, MountedVaporSubtree,
    MountedVaporSubtreeType,
};
use crate::runtime::dom_adapter::DomAdapter;
use crate::runtime::props::{Props as RuntimeProps, patch_props, post_patch_element};
use wasm_bindgen::JsValue;

fn runtime_props_from_component_props(props: &ComponentProps) -> RuntimeProps {
    props.iter().map(|(key, value)| (key.clone(), value.clone())).collect()
}

fn apply_initial_props<A: DomAdapter>(
    rue: &mut Rue<A>,
    el: &mut A::Element,
    new_props: &RuntimeProps,
) {
    if let Some(adapter) = rue.get_dom_adapter_mut() {
        if let Err(error) = patch_props(adapter, el, &RuntimeProps::new(), new_props) {
            rue.handle_error(error);
        }
    } else {
        rue.handle_error(JsValue::from_str("runtime:mount Element patch_props no adapter"));
    }
}

fn post_patch<A: DomAdapter>(rue: &mut Rue<A>, el: &mut A::Element, new_props: &RuntimeProps) {
    if let Some(adapter) = rue.get_dom_adapter_mut() {
        if let Err(error) = post_patch_element(adapter, el, new_props) {
            rue.handle_error(error);
        }
    } else {
        rue.handle_error(JsValue::from_str("runtime:mount Element post_patch no adapter"));
    }
}

fn append_mounted_child_host<A: DomAdapter>(
    rue: &mut Rue<A>,
    parent: &mut A::Element,
    child_host: &A::Element,
) where
    A::Element: From<JsValue> + Into<JsValue> + Clone,
{
    if rue.get_dom_adapter().map(|adapter| adapter.is_fragment(child_host)).unwrap_or(false) {
        rue.insert_fragment_children(parent, child_host, &None);
    } else if let Some(adapter) = rue.get_dom_adapter_mut() {
        adapter.append_child(parent, child_host);
    }
}

fn mount_child<A: DomAdapter>(rue: &mut Rue<A>, parent: &mut A::Element, child: &MountInputChild<A>)
where
    A::Element: From<JsValue> + Into<JsValue> + Clone,
{
    match child {
        MountInputChild::Text(text) => {
            if let Some(adapter) = rue.get_dom_adapter_mut() {
                let text_node = adapter.create_text_node(text);
                adapter.append_child(parent, &text_node);
            }
        }
        MountInputChild::Input(input) => {
            if let Some(mounted_child) = rue.mount_from_input(input, Some(parent)) {
                if let Some(child_host) = mounted_child.host_cloned() {
                    append_mounted_child_host(rue, parent, &child_host);
                }
            }
        }
    }
}

fn mount_children<A: DomAdapter>(rue: &mut Rue<A>, parent: &mut A::Element, input: &MountInput<A>)
where
    A::Element: From<JsValue> + Into<JsValue> + Clone,
{
    for child in input.children.iter() {
        mount_child(rue, parent, child);
    }
}

pub(crate) fn mount_element<A: DomAdapter>(
    rue: &mut Rue<A>,
    input: &MountInput<A>,
    tag: &str,
    parent_context: Option<&A::Element>,
) -> Option<MountedSubtreeState<A>>
where
    A::Element: From<JsValue> + Into<JsValue> + Clone,
{
    let mut el = match rue.get_dom_adapter_mut() {
        Some(adapter) => adapter.create_element_in_parent(tag, parent_context),
        None => {
            rue.handle_error(JsValue::from_str("runtime:mount Element no adapter"));
            return None;
        }
    };

    let new_props = runtime_props_from_component_props(&input.props);
    apply_initial_props(rue, &mut el, &new_props);
    if !new_props.contains_key("dangerouslySetInnerHTML") {
        mount_children(rue, &mut el, input);
    }
    post_patch(rue, &mut el, &new_props);

    Some(MountedSubtreeState::Vapor(MountedVaporSubtree {
        r#type: MountedVaporSubtreeType::Vapor,
        host: Some(el),
        key: input.key.clone(),
        fragment_nodes: Vec::new(),
        props: input.props.clone(),
        cleanup_bucket: input.mount_cleanup_bucket.clone(),
        effect_scope_id: input.mount_effect_scope_id,
    }))
}

pub(crate) fn mount_fragment<A: DomAdapter>(
    rue: &mut Rue<A>,
    input: &MountInput<A>,
    parent_context: Option<&A::Element>,
) -> Option<MountedSubtreeState<A>>
where
    A::Element: From<JsValue> + Into<JsValue> + Clone,
{
    let mut fragment = match rue.get_dom_adapter_mut() {
        Some(adapter) => adapter.create_document_fragment(),
        None => {
            rue.handle_error(JsValue::from_str("runtime:mount Fragment no adapter"));
            return None;
        }
    };

    mount_children(rue, &mut fragment, input);
    let fragment_nodes = rue
        .get_dom_adapter()
        .filter(|adapter| adapter.is_fragment(&fragment))
        .map(|adapter| adapter.collect_fragment_children(&fragment))
        .unwrap_or_default();

    let _ = parent_context;
    Some(MountedSubtreeState::Vapor(MountedVaporSubtree {
        r#type: MountedVaporSubtreeType::Vapor,
        host: Some(fragment),
        key: input.key.clone(),
        fragment_nodes,
        props: input.props.clone(),
        cleanup_bucket: input.mount_cleanup_bucket.clone(),
        effect_scope_id: input.mount_effect_scope_id,
    }))
}
