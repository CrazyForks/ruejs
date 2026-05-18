use super::super::Rue;
use super::super::types::compat_state::MountedCompatPatchKind;
use super::super::types::{
    MountInput, MountInputType, MountedPatchSubtree, MountedPatchSubtreeType, MountedSubtreeState,
};
use crate::runtime::dom_adapter::DomAdapter;
use wasm_bindgen::JsValue;

pub(super) enum CompatPatchBoundaryOutcome<A: DomAdapter> {
    NotCompat,
    Handled,
    Replaced(MountedSubtreeState<A>),
}

enum CompatPatchSameOutcome<A: DomAdapter> {
    NotHandled,
    Handled,
    Replaced(MountedSubtreeState<A>),
}

impl<A: DomAdapter> Rue<A>
where
    A::Element: Clone,
{
    pub(super) fn patch_compat_boundary(
        &mut self,
        old: &mut MountedSubtreeState<A>,
        new: &MountInput<A>,
        parent: &mut A::Element,
    ) -> CompatPatchBoundaryOutcome<A>
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        let MountedSubtreeState::Patch(node) = old else {
            return CompatPatchBoundaryOutcome::NotCompat;
        };

        if !matches!(node.r#type, MountedPatchSubtreeType::Compat) {
            return CompatPatchBoundaryOutcome::NotCompat;
        }

        let old_host = node.el.clone();
        match self.patch_compat_same(node, new, parent) {
            CompatPatchSameOutcome::Handled => CompatPatchBoundaryOutcome::Handled,
            CompatPatchSameOutcome::Replaced(mounted) => {
                CompatPatchBoundaryOutcome::Replaced(mounted)
            }
            CompatPatchSameOutcome::NotHandled => {
                match self.patch_rebuild_same(old_host, new, parent) {
                    Some(mounted) => CompatPatchBoundaryOutcome::Replaced(mounted),
                    None => CompatPatchBoundaryOutcome::Handled,
                }
            }
        }
    }

    fn patch_props_only(
        &mut self,
        el: &mut A::Element,
        old: &super::super::props::Props,
        new: &super::super::props::Props,
    ) {
        let mut res_patch: Option<Result<(), JsValue>> = None;
        let mut res_post: Option<Result<(), JsValue>> = None;
        if let Some(adapter) = self.get_dom_adapter_mut() {
            let mut el_clone = el.clone();
            res_patch = Some(super::super::props::patch_props(adapter, &mut el_clone, old, new));
            res_post = Some(super::super::props::post_patch_element(adapter, &mut el_clone, new));
        }
        if let Some(Err(e)) = res_patch {
            self.handle_error(e);
        }
        if let Some(Err(e)) = res_post {
            self.handle_error(e);
        }
    }

    fn patch_rebuild_same(
        &mut self,
        old_host: Option<A::Element>,
        new: &MountInput<A>,
        parent: &mut A::Element,
    ) -> Option<MountedSubtreeState<A>>
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        if let Some(mounted) = self.mount_from_input(new, Some(parent)) {
            let Some(el_new) = mounted.host_cloned() else {
                return Some(mounted);
            };
            let anchor_opt = self.current_anchor.clone();
            if let Some(adapter) = self.get_dom_adapter_mut() {
                if let Some(ref el_old) = old_host {
                    adapter.insert_before(parent, &el_new, el_old);
                    let mut p = parent.clone();
                    adapter.remove_child(&mut p, el_old);
                } else if let Some(anchor) = anchor_opt {
                    if adapter.contains(parent, &anchor) {
                        adapter.insert_before(parent, &el_new, &anchor);
                    } else {
                        adapter.append_child(parent, &el_new);
                    }
                } else {
                    adapter.append_child(parent, &el_new);
                }
            }
            Some(mounted)
        } else {
            None
        }
    }

    fn patch_compat_same(
        &mut self,
        old: &mut MountedPatchSubtree<A>,
        new: &MountInput<A>,
        parent: &mut A::Element,
    ) -> CompatPatchSameOutcome<A>
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        match (old.compat_kind(), &new.r#type) {
            (Some(MountedCompatPatchKind::Fragment), MountInputType::Fragment) => {
                match self.patch_fragment_same(old, new, parent) {
                    Some(mounted) => CompatPatchSameOutcome::Replaced(mounted),
                    None => CompatPatchSameOutcome::Handled,
                }
            }
            (Some(MountedCompatPatchKind::Element(_)), MountInputType::Element(_)) => {
                self.patch_element_same(old, new, parent)
            }
            _ => CompatPatchSameOutcome::NotHandled,
        }
    }

    fn patch_element_same(
        &mut self,
        old: &mut MountedPatchSubtree<A>,
        new: &MountInput<A>,
        parent: &mut A::Element,
    ) -> CompatPatchSameOutcome<A>
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        if let Some(el_old) = old.el.clone() {
            let mut el = el_old.clone();
            self.patch_props_only(&mut el, old.compat_props(), &new.props);
            let mounted_children = {
                let old_children = old.compat_children_mut();
                self.patch_children_keyed(&mut el, old_children, &new.children)
            };
            old.replace_compat_patch_inputs(new.props.clone(), mounted_children);
            old.el = Some(el_old);
            old.key = new.key.clone();
            old.set_compat_mount_metadata(
                new.mount_cleanup_bucket.clone(),
                new.mount_effect_scope_id,
            );
            if let MountInputType::Element(tag) = &new.r#type {
                old.set_compat_patch_kind(MountedCompatPatchKind::Element(tag.clone()));
            }
            CompatPatchSameOutcome::Handled
        } else {
            match self.patch_rebuild_same(old.el.clone(), new, parent) {
                Some(mounted) => CompatPatchSameOutcome::Replaced(mounted),
                None => CompatPatchSameOutcome::Handled,
            }
        }
    }

    fn patch_fragment_same(
        &mut self,
        old: &MountedPatchSubtree<A>,
        new: &MountInput<A>,
        parent: &mut A::Element,
    ) -> Option<MountedSubtreeState<A>>
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        if let Some(mounted) = self.mount_from_input(new, Some(parent)) {
            let Some(el_new) = mounted.host_cloned() else {
                return Some(mounted);
            };
            let anchor_opt = self.current_anchor.clone();
            let mut dest_parent =
                self.resolve_dest_parent(parent, old.el.clone(), anchor_opt.clone());
            let insert_anchor = if let Some(ref el_old) = old.el {
                if let Some(adapter) = self.get_dom_adapter() {
                    if !adapter.is_fragment(el_old) && adapter.contains(&dest_parent, el_old) {
                        Some(el_old.clone())
                    } else {
                        anchor_opt.clone()
                    }
                } else {
                    anchor_opt.clone().or_else(|| Some(el_old.clone()))
                }
            } else {
                anchor_opt.clone()
            };
            let lifecycle = old.lifecycle_record();
            self.invoke_before_unmount_record(&lifecycle);
            self.clear_fragment_nodes(&mut dest_parent, &old.fragment_nodes);
            self.insert_fragment_children(&mut dest_parent, &el_new, &insert_anchor);
            if let Some(ref el_old) = old.el {
                self.clear_old_el_if_present(&mut dest_parent, el_old);
            }
            self.invoke_unmounted_record(&lifecycle);
            Some(mounted)
        } else {
            None
        }
    }

    pub(super) fn replace_compat_patch(
        &mut self,
        old: &MountedPatchSubtree<A>,
        new_el: &A::Element,
        dest_parent: &mut A::Element,
        insert_anchor: &Option<A::Element>,
    ) -> bool
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        match old.compat_kind() {
            Some(MountedCompatPatchKind::Fragment) => {
                self.replace_fragment(old, new_el, dest_parent, insert_anchor);
                true
            }
            Some(MountedCompatPatchKind::Element(_)) => {
                self.replace_element(old.el.as_ref(), new_el, dest_parent);
                true
            }
            _ => false,
        }
    }

    fn replace_fragment(
        &mut self,
        old: &MountedPatchSubtree<A>,
        new_el: &A::Element,
        dest_parent: &mut A::Element,
        insert_anchor: &Option<A::Element>,
    ) where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        self.clear_fragment_nodes(dest_parent, &old.fragment_nodes);
        if let Some(adapter) = self.get_dom_adapter() {
            if adapter.is_fragment(new_el) {
                self.insert_fragment_children_preferring_end(dest_parent, new_el, insert_anchor);
            } else if let Some(adapter2) = self.get_dom_adapter_mut() {
                if let Some(ref el_old) = old.el {
                    if adapter2.contains(dest_parent, el_old) {
                        adapter2.insert_before(dest_parent, new_el, el_old);
                        let mut p2 = dest_parent.clone();
                        adapter2.remove_child(&mut p2, el_old);
                    } else {
                        let kids = adapter2.collect_fragment_children(dest_parent);
                        for n in kids.iter() {
                            let mut p2 = dest_parent.clone();
                            adapter2.remove_child(&mut p2, n);
                        }
                        adapter2.append_child(dest_parent, new_el);
                    }
                } else {
                    adapter2.append_child(dest_parent, new_el);
                }
            }
        }
    }

    fn replace_element(
        &mut self,
        old_host: Option<&A::Element>,
        new_el: &A::Element,
        dest_parent: &mut A::Element,
    ) {
        self.replace_non_fragment_with_fallback(old_host, new_el, dest_parent);
    }
}
