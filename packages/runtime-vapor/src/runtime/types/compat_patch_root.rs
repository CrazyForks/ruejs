/*
Compat 根 mounted 转换

把旧根状态（MountedElement/Fragment/Block 等）转换成新的 MountedState/MountedSubtreeState。
这是 compat 层迁移到默认 mounted snapshot 体系时的适配边界。
*/
use crate::runtime::dom_adapter::DomAdapter;

use super::compat_state::{MountedCompatPatchKind, MountedCompatRootState, MountedElement};
use super::mounted::{
    MountLifecycleRecord, MountedBlock, MountedPatchSubtree, MountedPatchSubtreeType, MountedState,
    MountedSubtreeState,
};

pub(super) fn mounted_element_into_patch_state<A: DomAdapter>(
    element: MountedElement<A>,
) -> MountedSubtreeState<A>
where
    A::Element: Clone,
{
    MountedSubtreeState::Patch(MountedPatchSubtree::new_compat(
        MountedCompatPatchKind::Element(element.tag),
        element.props,
        element.children,
        element.host,
        element.key,
        Vec::new(),
        None,
        None,
    ))
}

pub(super) fn patch_root_kind<A: DomAdapter>(
    node: &MountedPatchSubtree<A>,
) -> Option<MountedCompatPatchKind> {
    match &node.r#type {
        MountedPatchSubtreeType::Compat => node.compat.kind.clone(),
        MountedPatchSubtreeType::Component(_) => None,
    }
}

pub(super) fn into_patch_root_state<A: DomAdapter>(
    node: MountedPatchSubtree<A>,
    kind: MountedCompatPatchKind,
    lifecycle: MountLifecycleRecord,
) -> MountedState<A>
where
    A::Element: Clone,
{
    match kind {
        MountedCompatPatchKind::Fragment => MountedState::Block(MountedBlock {
            host: node.el,
            fragment_nodes: node.fragment_nodes,
            lifecycle,
        }),
        MountedCompatPatchKind::Element(tag) => {
            MountedState::Compat(MountedCompatRootState::Element(MountedElement {
                tag,
                key: node.key,
                host: node.el,
                props: node.compat.props,
                children: node.compat.children,
                lifecycle,
            }))
        }
    }
}

pub(super) fn compat_root_into_patch_state<A: DomAdapter>(
    root: MountedCompatRootState<A>,
) -> MountedSubtreeState<A>
where
    A::Element: Clone,
{
    match root {
        MountedCompatRootState::Element(element) => mounted_element_into_patch_state(element),
    }
}

pub(super) fn compat_root_into_dom_identity<A: DomAdapter>(
    root: MountedCompatRootState<A>,
) -> (MountLifecycleRecord, Option<A::Element>, Vec<A::Element>) {
    match root {
        MountedCompatRootState::Element(element) => (element.lifecycle, element.host, Vec::new()),
    }
}

pub(super) fn compat_root_into_lifecycle<A: DomAdapter>(
    root: MountedCompatRootState<A>,
) -> MountLifecycleRecord {
    match root {
        MountedCompatRootState::Element(element) => element.lifecycle,
    }
}

/// 从 compat root 提取生命周期快照，供 KeepAlive 激活/停用缓存 range。
pub(super) fn compat_root_lifecycle_record<A: DomAdapter>(
    root: &MountedCompatRootState<A>,
) -> MountLifecycleRecord {
    match root {
        MountedCompatRootState::Element(element) => element.lifecycle.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::super::mounted::MountLifecycleKind;
    use super::*;
    use crate::runtime::js_adapter::JsDomAdapter;
    use crate::runtime::types::ComponentProps;
    use wasm_bindgen::JsValue;
    use wasm_bindgen_test::*;

    fn lifecycle(effect_scope_id: Option<usize>) -> MountLifecycleRecord {
        MountLifecycleRecord {
            kind: MountLifecycleKind::Other,
            cleanup_bucket: None,
            effect_scope_id,
            component_before_unmount_hooks: Vec::new(),
            component_unmounted_hooks: Vec::new(),
            component_activated_hooks: Vec::new(),
            component_deactivated_hooks: Vec::new(),
            component_inst_index: None,
            children: Vec::new(),
        }
    }

    #[wasm_bindgen_test]
    fn compat_root_element_round_trips_through_patch_state_and_identity() {
        let root = MountedCompatRootState::<JsDomAdapter>::Element(MountedElement {
            tag: "div".to_string(),
            key: Some("root-key".to_string()),
            host: Some(JsValue::from_str("host")),
            props: ComponentProps::new(),
            children: Vec::new(),
            lifecycle: lifecycle(Some(3)),
        });

        let patch = compat_root_into_patch_state(root);
        let MountedSubtreeState::Patch(node) = patch else {
            panic!("compat root should become a patch subtree");
        };
        assert!(
            matches!(patch_root_kind(&node), Some(MountedCompatPatchKind::Element(tag)) if tag == "div")
        );
        assert_eq!(node.key.as_deref(), Some("root-key"));

        let round_trip = into_patch_root_state(
            node,
            MountedCompatPatchKind::Element("section".to_string()),
            lifecycle(Some(4)),
        );
        let MountedState::Compat(MountedCompatRootState::Element(element)) = round_trip else {
            panic!("element patch root should become compat root state");
        };
        assert_eq!(element.tag, "section");
        assert_eq!(element.lifecycle.effect_scope_id, Some(4));
    }

    #[wasm_bindgen_test]
    fn compat_root_fragment_becomes_block_and_identity_helpers_return_empty_fragments() {
        let patch = MountedPatchSubtree::<JsDomAdapter>::new_compat(
            MountedCompatPatchKind::Fragment,
            ComponentProps::new(),
            Vec::new(),
            Some(JsValue::from_str("fragment-host")),
            None,
            vec![JsValue::from_str("a"), JsValue::from_str("b")],
            None,
            None,
        );
        let state = into_patch_root_state(patch, MountedCompatPatchKind::Fragment, lifecycle(None));
        let MountedState::Block(block) = state else {
            panic!("fragment patch root should become block state");
        };
        assert_eq!(block.fragment_nodes.len(), 2);

        let root = MountedCompatRootState::<JsDomAdapter>::Element(MountedElement {
            tag: "span".to_string(),
            key: None,
            host: None,
            props: ComponentProps::new(),
            children: Vec::new(),
            lifecycle: lifecycle(Some(9)),
        });
        let (record, host, fragments) = compat_root_into_dom_identity(root);
        assert_eq!(record.effect_scope_id, Some(9));
        assert!(host.is_none());
        assert!(fragments.is_empty());

        let root = MountedCompatRootState::<JsDomAdapter>::Element(MountedElement {
            tag: "i".to_string(),
            key: None,
            host: None,
            props: ComponentProps::new(),
            children: Vec::new(),
            lifecycle: lifecycle(Some(10)),
        });
        assert_eq!(compat_root_into_lifecycle(root).effect_scope_id, Some(10));
    }
}
