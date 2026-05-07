use crate::runtime::dom_adapter::DomAdapter;

use super::compat_state::MountedCompatPatchKind;
use super::mounted::{MountedPatchSubtree, MountedPatchSubtreeType};
use super::MountInputType;

pub(super) fn patch_subtree_matches_input_type<A: DomAdapter>(
    node: &MountedPatchSubtree<A>,
    input_type: &MountInputType<A>,
) -> bool {
    match (&node.r#type, node.compat.kind.as_ref(), input_type) {
        (MountedPatchSubtreeType::Compat, Some(MountedCompatPatchKind::Fragment), MountInputType::Fragment) => {
            true
        }
        (
            MountedPatchSubtreeType::Compat,
            Some(MountedCompatPatchKind::Element(old_tag)),
            MountInputType::Element(new_tag),
        ) => old_tag == new_tag,
        (MountedPatchSubtreeType::Component(old_render), _, MountInputType::Component(new_render)) => {
            old_render.eq(new_render)
        }
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