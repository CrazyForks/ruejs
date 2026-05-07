use crate::runtime::dom_adapter::DomAdapter;

use super::compat_state::{MountedCompatPatchKind, MountedCompatRootState, MountedElement};
use super::mounted::{
    MountLifecycleRecord, MountedBlock, MountedPatchSubtree, MountedPatchSubtreeType,
    MountedState, MountedSubtreeState,
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