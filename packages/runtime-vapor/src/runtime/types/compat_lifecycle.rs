use crate::runtime::dom_adapter::DomAdapter;

use super::compat_state::{MountedCompatLifecycleKind, MountedCompatPatchKind};
use super::mounted::{
    MountLifecycleKind, MountLifecycleRecord, MountedPatchSubtree, MountedPatchSubtreeType,
    MountedSubtreeChild,
};

pub(super) fn lifecycle_invokes_mount_owned_resources_before_unmount(
    kind: &MountedCompatLifecycleKind,
) -> bool {
    matches!(kind, MountedCompatLifecycleKind::Fragment)
}

pub(super) fn lifecycle_recurses_before_unmount_children(
    kind: &MountedCompatLifecycleKind,
) -> bool {
    matches!(kind, MountedCompatLifecycleKind::Fragment | MountedCompatLifecycleKind::Element)
}

pub(super) fn lifecycle_recurses_unmounted_children(kind: &MountedCompatLifecycleKind) -> bool {
    matches!(kind, MountedCompatLifecycleKind::Fragment | MountedCompatLifecycleKind::Element)
}

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
        component_inst_index: None,
        children: node
            .compat
            .children
            .iter()
            .filter_map(MountedSubtreeChild::lifecycle_record)
            .collect(),
    })
}
