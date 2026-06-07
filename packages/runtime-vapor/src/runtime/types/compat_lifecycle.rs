/*
Compat 生命周期策略

旧式 Element/Fragment mounted 结构与默认 Vapor/Component 的清理边界不同。
这里把“是否释放自身资源、是否递归 children、何时触发 hook”的规则集中起来，
避免 mounted.rs 和 render_lifecycle.rs 写满 compat 分支。
*/
use crate::runtime::dom_adapter::DomAdapter;

use super::compat_state::{MountedCompatLifecycleKind, MountedCompatPatchKind};
use super::mounted::{
    MountLifecycleKind, MountLifecycleRecord, MountedPatchSubtree, MountedPatchSubtreeType,
    MountedSubtreeChild,
};

#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
pub(super) fn lifecycle_invokes_mount_owned_resources_before_unmount(
    kind: &MountedCompatLifecycleKind,
) -> bool {
    matches!(kind, MountedCompatLifecycleKind::Fragment)
}

#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
pub(super) fn lifecycle_recurses_before_unmount_children(
    kind: &MountedCompatLifecycleKind,
) -> bool {
    matches!(kind, MountedCompatLifecycleKind::Fragment | MountedCompatLifecycleKind::Element)
}

#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
pub(super) fn lifecycle_recurses_unmounted_children(kind: &MountedCompatLifecycleKind) -> bool {
    matches!(kind, MountedCompatLifecycleKind::Fragment | MountedCompatLifecycleKind::Element)
}

#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
pub(super) fn patch_lifecycle_record<A: DomAdapter>(
    node: &MountedPatchSubtree<A>,
) -> Option<MountLifecycleRecord>
where
    A::Element: Clone,
{
    let (kind, cleanup_bucket, effect_scope_id) = match (&node.r#type, node.compat.kind.as_ref()) {
        (MountedPatchSubtreeType::Compat, Some(MountedCompatPatchKind::Fragment)) => (
            MountLifecycleKind::Compat(MountedCompatLifecycleKind::Fragment),
            node.compat.mount_cleanup_bucket.clone(),
            node.compat.mount_effect_scope_id,
        ),
        (MountedPatchSubtreeType::Compat, Some(MountedCompatPatchKind::Element(_))) => {
            (MountLifecycleKind::Compat(MountedCompatLifecycleKind::Element), None, None)
        }
        (MountedPatchSubtreeType::Component(_), _) | (MountedPatchSubtreeType::Compat, None) => {
            return None;
        }
    };

    Some(MountLifecycleRecord {
        kind,
        cleanup_bucket,
        effect_scope_id,
        component_before_unmount_hooks: Vec::new(),
        component_unmounted_hooks: Vec::new(),
        component_activated_hooks: Vec::new(),
        component_deactivated_hooks: Vec::new(),
        component_inst_index: None,
        children: node
            .compat
            .children
            .iter()
            .filter_map(MountedSubtreeChild::lifecycle_record)
            .collect(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::runtime::js_adapter::JsDomAdapter;
    use crate::runtime::types::{ComponentProps, MountedPatchSubtree};
    use wasm_bindgen::JsValue;
    use wasm_bindgen_test::*;

    #[wasm_bindgen_test]
    fn compat_lifecycle_record_filters_non_subtree_children() {
        let node = MountedPatchSubtree::<JsDomAdapter>::new_compat(
            MountedCompatPatchKind::Fragment,
            ComponentProps::new(),
            vec![
                MountedSubtreeChild::Text("text".to_string()),
                MountedSubtreeChild::Bool(false),
                MountedSubtreeChild::Null,
            ],
            None,
            None,
            Vec::new(),
            None,
            None,
        );

        let record = patch_lifecycle_record(&node).expect("compat lifecycle record");
        assert!(record.children.is_empty());
    }

    #[wasm_bindgen_test]
    fn compat_lifecycle_record_covers_element_component_and_empty_compat_branches() {
        assert!(lifecycle_invokes_mount_owned_resources_before_unmount(
            &MountedCompatLifecycleKind::Fragment
        ));
        assert!(!lifecycle_invokes_mount_owned_resources_before_unmount(
            &MountedCompatLifecycleKind::Element
        ));
        assert!(lifecycle_recurses_before_unmount_children(&MountedCompatLifecycleKind::Element));
        assert!(lifecycle_recurses_unmounted_children(&MountedCompatLifecycleKind::Fragment));

        let element = MountedPatchSubtree::<JsDomAdapter>::new_compat(
            MountedCompatPatchKind::Element("article".to_string()),
            ComponentProps::new(),
            Vec::new(),
            None,
            None,
            Vec::new(),
            None,
            None,
        );
        let record = patch_lifecycle_record(&element).expect("element lifecycle record");
        assert!(matches!(
            record.kind,
            MountLifecycleKind::Compat(MountedCompatLifecycleKind::Element)
        ));
        assert!(record.cleanup_bucket.is_none());
        assert!(record.effect_scope_id.is_none());

        let component = MountedPatchSubtree::<JsDomAdapter>::new_component(
            JsValue::from_str("render"),
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
        assert!(patch_lifecycle_record(&component).is_none());

        let mut empty_compat = MountedPatchSubtree::<JsDomAdapter>::new_compat(
            MountedCompatPatchKind::Fragment,
            ComponentProps::new(),
            Vec::new(),
            None,
            None,
            Vec::new(),
            None,
            None,
        );
        empty_compat.compat.kind = None;
        assert!(patch_lifecycle_record(&empty_compat).is_none());
    }
}
