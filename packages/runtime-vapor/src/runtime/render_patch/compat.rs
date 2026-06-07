/*
Compat patch 边界

负责处理旧式 Element/Fragment snapshot 的同类型 patch、children 更新和必要替换。
主 patch 流程先询问这里，只有不是 compat 分支时才继续走默认 component/text/vapor 逻辑。
*/
use super::super::Rue;
use super::super::types::compat_state::MountedCompatPatchKind;
use super::super::types::{
    MountInput, MountInputType, MountedPatchSubtree, MountedPatchSubtreeType, MountedSubtreeState,
};
use crate::runtime::dom_adapter::DomAdapter;
use js_sys::{Function, Object, Promise, Reflect};
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use wasm_bindgen::closure::Closure;

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

#[derive(Clone)]
struct ReplaceFocusSnapshot {
    path: Vec<u32>,
    tag_name: Option<String>,
    input_type: Option<String>,
    selection_start: Option<u32>,
    selection_end: Option<u32>,
    selection_direction: Option<String>,
}

fn js_prop(value: &JsValue, name: &str) -> JsValue {
    Reflect::get(value, &JsValue::from_str(name)).unwrap_or(JsValue::UNDEFINED)
}

fn js_string_prop(value: &JsValue, name: &str) -> Option<String> {
    js_prop(value, name).as_string()
}

fn js_u32_prop(value: &JsValue, name: &str) -> Option<u32> {
    js_prop(value, name).as_f64().map(|number| number as u32)
}

fn normalized_tag_name(value: &JsValue) -> Option<String> {
    js_string_prop(value, "tagName")
        .or_else(|| js_string_prop(value, "tag"))
        .map(|tag| tag.to_ascii_uppercase())
}

fn normalized_input_type(value: &JsValue) -> Option<String> {
    js_string_prop(value, "type").map(|kind| kind.to_ascii_lowercase())
}

#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
fn child_values(value: &JsValue) -> Vec<JsValue> {
    for key in ["children", "childNodes"] {
        let collection = js_prop(value, key);
        if collection.is_undefined() || collection.is_null() {
            continue;
        }

        if let Some(length) = js_prop(&collection, "length").as_f64() {
            let mut items = Vec::with_capacity(length as usize);
            for index in 0..(length as u32) {
                let child = Reflect::get(&collection, &JsValue::from_f64(index as f64))
                    .unwrap_or(JsValue::UNDEFINED);
                if !child.is_undefined() && !child.is_null() {
                    items.push(child);
                }
            }
            return items;
        }
    }

    Vec::new()
}

fn find_descendant_path(root: &JsValue, target: &JsValue) -> Option<Vec<u32>> {
    if Object::is(root, target) {
        return Some(Vec::new());
    }

    for (index, child) in child_values(root).into_iter().enumerate() {
        if let Some(mut path) = find_descendant_path(&child, target) {
            let mut full_path = Vec::with_capacity(path.len() + 1);
            full_path.push(index as u32);
            full_path.append(&mut path);
            return Some(full_path);
        }
    }

    None
}

#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
fn descendant_by_path(root: &JsValue, path: &[u32]) -> Option<JsValue> {
    let mut current = root.clone();
    for index in path {
        let children = child_values(&current);
        let next = children.get(*index as usize)?.clone();
        current = next;
    }
    Some(current)
}

fn active_element() -> Option<JsValue> {
    let global = js_sys::global();
    let document = js_prop(&global, "document");
    if document.is_undefined() || document.is_null() {
        return None;
    }

    let active = js_prop(&document, "activeElement");
    if active.is_undefined() || active.is_null() {
        return None;
    }

    Some(active)
}

#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
fn capture_focus_snapshot(root: &JsValue) -> Option<ReplaceFocusSnapshot> {
    let active = active_element()?;
    let path = find_descendant_path(root, &active)?;

    Some(ReplaceFocusSnapshot {
        path,
        tag_name: normalized_tag_name(&active),
        input_type: normalized_input_type(&active),
        selection_start: js_u32_prop(&active, "selectionStart"),
        selection_end: js_u32_prop(&active, "selectionEnd"),
        selection_direction: js_string_prop(&active, "selectionDirection"),
    })
}

#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
fn focus_target_matches(snapshot: &ReplaceFocusSnapshot, target: &JsValue) -> bool {
    if let Some(expected_tag) = snapshot.tag_name.as_ref() {
        if normalized_tag_name(target).as_ref() != Some(expected_tag) {
            return false;
        }
    }

    if let Some(expected_type) = snapshot.input_type.as_ref() {
        if normalized_input_type(target).as_ref() != Some(expected_type) {
            return false;
        }
    }

    true
}

#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
fn restore_focus_snapshot(snapshot: &ReplaceFocusSnapshot, target: &JsValue) {
    let snapshot = snapshot.clone();
    let target = target.clone();
    let restore = Closure::wrap(Box::new(move |_v: JsValue| {
        let owner_document = js_prop(&target, "ownerDocument");
        let active_element = js_prop(&owner_document, "activeElement");
        if !Object::is(&active_element, &target) {
            let focus = js_prop(&target, "focus");
            if let Some(function) = focus.dyn_ref::<Function>() {
                let _ = function.call0(&target);
            }
        }

        if let Some(start) = snapshot.selection_start {
            let _ = Reflect::set(
                &target,
                &JsValue::from_str("selectionStart"),
                &JsValue::from_f64(start as f64),
            );
        }
        if let Some(end) = snapshot.selection_end {
            let _ = Reflect::set(
                &target,
                &JsValue::from_str("selectionEnd"),
                &JsValue::from_f64(end as f64),
            );
        }
        if let Some(direction) = snapshot.selection_direction.as_ref() {
            let _ = Reflect::set(
                &target,
                &JsValue::from_str("selectionDirection"),
                &JsValue::from_str(direction),
            );
        }
    }) as Box<dyn FnMut(JsValue)>);
    let _ = Promise::resolve(&JsValue::UNDEFINED).then(&restore);
    restore.forget();
}

impl<A: DomAdapter> Rue<A>
where
    A::Element: Clone,
{
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
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

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
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

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
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
            let focus_snapshot = old_host.as_ref().and_then(|host| {
                let host_js: JsValue = host.clone().into();
                capture_focus_snapshot(&host_js)
            });
            let focus_target = focus_snapshot.as_ref().and_then(|snapshot| {
                let new_root: JsValue = el_new.clone().into();
                descendant_by_path(&new_root, &snapshot.path)
                    .filter(|target| focus_target_matches(snapshot, target))
            });
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
            if let (Some(snapshot), Some(target)) = (focus_snapshot.as_ref(), focus_target.as_ref())
            {
                restore_focus_snapshot(snapshot, target);
            }
            Some(mounted)
        } else {
            None
        }
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
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

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
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

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
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
            let focus_snapshot = old.el.as_ref().and_then(|host| {
                let host_js: JsValue = host.clone().into();
                capture_focus_snapshot(&host_js)
            });
            let focus_target = focus_snapshot.as_ref().and_then(|snapshot| {
                let new_root: JsValue = el_new.clone().into();
                descendant_by_path(&new_root, &snapshot.path)
                    .filter(|target| focus_target_matches(snapshot, target))
            });
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
            if let (Some(snapshot), Some(target)) = (focus_snapshot.as_ref(), focus_target.as_ref())
            {
                restore_focus_snapshot(snapshot, target);
            }
            Some(mounted)
        } else {
            None
        }
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
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

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
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

#[cfg(test)]
#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
mod tests {
    use super::*;
    use crate::runtime::js_adapter::JsDomAdapter;
    use crate::runtime::types::{
        ComponentProps, MountInputChild, MountedPatchSubtree, MountedSubtreeState,
        MountedTextSubtree,
    };
    use js_sys::{Array, Object};
    use wasm_bindgen_futures::JsFuture;
    use wasm_bindgen_test::*;

    fn set_fn(obj: &Object, name: &str, args: &str, body: &str) {
        Reflect::set(obj, &JsValue::from_str(name), &Function::new_with_args(args, body).into())
            .unwrap();
    }

    fn adapter() -> JsDomAdapter {
        let obj = Object::new();
        set_fn(&obj, "createElement", "tag", "return { tag, children: [], nodeType: 1 }");
        set_fn(
            &obj,
            "createTextNode",
            "text",
            "return { tag: '#text', text, children: [], nodeType: 3 }",
        );
        set_fn(
            &obj,
            "createDocumentFragment",
            "",
            "return { tag: 'fragment', children: [], nodeType: 11 }",
        );
        set_fn(&obj, "isFragment", "el", "return !!el && el.tag === 'fragment'");
        set_fn(&obj, "collectFragmentChildren", "el", "return Array.from(el && el.children || [])");
        set_fn(&obj, "setTextContent", "el,text", "el.text = text");
        set_fn(
            &obj,
            "appendChild",
            "p,c",
            "p.children = p.children || []; \
             const items = c && c.tag === 'fragment' ? Array.from(c.children || []) : [c]; \
             for (const item of items) { if (!item) continue; p.children.push(item); item.parentNode = p; }",
        );
        set_fn(
            &obj,
            "insertBefore",
            "p,c,b",
            "p.children = p.children || []; \
             const items = c && c.tag === 'fragment' ? Array.from(c.children || []) : [c]; \
             for (const item of items) { if (!item) continue; const i = p.children.indexOf(b); \
               i >= 0 ? p.children.splice(i, 0, item) : p.children.push(item); item.parentNode = p; }",
        );
        set_fn(
            &obj,
            "removeChild",
            "p,c",
            "p.children = (p.children || []).filter(x => x !== c); if (c) c.parentNode = null",
        );
        set_fn(&obj, "contains", "p,c", "return p === c || (p.children || []).includes(c)");
        set_fn(&obj, "setClassName", "el,v", "el.className = v");
        set_fn(&obj, "patchStyle", "el,old,next", "return");
        set_fn(&obj, "setInnerHTML", "el,html", "el.children = []; el.text = html");
        set_fn(&obj, "setValue", "el,v", "el.value = v");
        set_fn(&obj, "setChecked", "el,b", "el.checked = !!b");
        set_fn(&obj, "setDisabled", "el,b", "el.disabled = !!b");
        set_fn(&obj, "clearRef", "r", "return");
        set_fn(&obj, "applyRef", "el,r", "return");
        set_fn(
            &obj,
            "setAttribute",
            "el,k,v",
            "el.attrs = el.attrs || {}; el.attrs[k] = v; el[k] = v",
        );
        set_fn(&obj, "removeAttribute", "el,k", "if (el.attrs) delete el.attrs[k]");
        set_fn(&obj, "getTagName", "el", "return el.tag || ''");
        set_fn(&obj, "addEventListener", "el,evt,h", "return");
        set_fn(&obj, "removeEventListener", "el,evt,h", "return");
        set_fn(&obj, "hasValueProperty", "el", "return 'value' in el");
        set_fn(&obj, "isSelectMultiple", "el", "return el.tag === 'SELECT' && !!el.multiple");
        set_fn(&obj, "querySelector", "sel", "return { tag: sel, children: [], nodeType: 1 }");
        JsDomAdapter::new(obj.into())
    }

    fn node(tag: &str) -> JsValue {
        let obj = Object::new();
        Reflect::set(&obj, &JsValue::from_str("tag"), &JsValue::from_str(tag)).unwrap();
        Reflect::set(&obj, &JsValue::from_str("tagName"), &JsValue::from_str(tag)).unwrap();
        Reflect::set(&obj, &JsValue::from_str("children"), &Array::new().into()).unwrap();
        obj.into()
    }

    fn set_children(parent: &JsValue, children: &[JsValue]) {
        let arr = Array::new();
        for child in children {
            arr.push(child);
            Reflect::set(child, &JsValue::from_str("parentNode"), parent).unwrap();
        }
        Reflect::set(parent, &JsValue::from_str("children"), &arr.into()).unwrap();
    }

    fn tags(parent: &JsValue) -> Vec<String> {
        let children =
            Reflect::get(parent, &JsValue::from_str("children")).unwrap_or(Array::new().into());
        Array::from(&children)
            .iter()
            .map(|child| {
                let tag = Reflect::get(&child, &JsValue::from_str("tag"))
                    .unwrap_or(JsValue::UNDEFINED)
                    .as_string()
                    .unwrap_or_default();
                if tag == "#text" {
                    Reflect::get(&child, &JsValue::from_str("text"))
                        .unwrap_or(JsValue::UNDEFINED)
                        .as_string()
                        .unwrap_or_default()
                } else {
                    tag
                }
            })
            .collect()
    }

    fn element_input(tag: &str, text: &str) -> MountInput<JsDomAdapter> {
        MountInput::new_normalized(
            MountInputType::Element(tag.to_string()),
            ComponentProps::new(),
            vec![MountInputChild::Text(text.to_string())],
        )
    }

    fn element_input_with_props(
        tag: &str,
        props: ComponentProps,
        children: Vec<MountInputChild<JsDomAdapter>>,
    ) -> MountInput<JsDomAdapter> {
        MountInput::new_normalized(MountInputType::Element(tag.to_string()), props, children)
    }

    fn fragment_input(text: &str) -> MountInput<JsDomAdapter> {
        MountInput::new_normalized(
            MountInputType::Fragment,
            ComponentProps::new(),
            vec![MountInputChild::Text(text.to_string())],
        )
    }

    fn text_input(text: &str) -> MountInput<JsDomAdapter> {
        MountInput::new_normalized(
            MountInputType::Text(text.to_string()),
            ComponentProps::new(),
            Vec::new(),
        )
    }

    fn compat_state(
        kind: MountedCompatPatchKind,
        el: Option<JsValue>,
        fragment_nodes: Vec<JsValue>,
    ) -> MountedSubtreeState<JsDomAdapter> {
        MountedSubtreeState::Patch(MountedPatchSubtree::new_compat(
            kind,
            ComponentProps::new(),
            Vec::new(),
            el,
            None,
            fragment_nodes,
            None,
            None,
        ))
    }

    #[wasm_bindgen_test]
    fn compat_boundary_handles_element_patch_fragment_patch_and_not_compat() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let mut parent = node("parent");
        let old_el = node("div");
        set_children(&parent, &[old_el.clone()]);
        let mut old = compat_state(
            MountedCompatPatchKind::Element("div".to_string()),
            Some(old_el.clone()),
            Vec::new(),
        );

        match rue.patch_compat_boundary(&mut old, &element_input("div", "next"), &mut parent) {
            CompatPatchBoundaryOutcome::Handled => {}
            _ => panic!("same element compat patch should be handled"),
        }
        assert_eq!(tags(&old_el), vec!["next"]);

        let old_child = node("old");
        let fragment = node("fragment");
        set_children(&fragment, &[old_child.clone()]);
        set_children(&parent, &[old_child.clone()]);
        let mut old_fragment =
            compat_state(MountedCompatPatchKind::Fragment, Some(fragment), vec![old_child.clone()]);
        match rue.patch_compat_boundary(&mut old_fragment, &fragment_input("fresh"), &mut parent) {
            CompatPatchBoundaryOutcome::Replaced(_) => {}
            _ => panic!("same fragment compat patch should rebuild and replace"),
        }
        assert_eq!(tags(&parent), vec!["fresh"]);

        let mut old_text = MountedSubtreeState::Text(MountedTextSubtree {
            host: None,
            key: None,
            cleanup_bucket: None,
            effect_scope_id: None,
        });
        match rue.patch_compat_boundary(&mut old_text, &element_input("div", "x"), &mut parent) {
            CompatPatchBoundaryOutcome::NotCompat => {}
            _ => panic!("text nodes are not compat patch boundaries"),
        }

        let component = Function::new_no_args("return null");
        let mut old_component = MountedSubtreeState::Patch(MountedPatchSubtree::new_component(
            component.clone().into(),
            None,
            None,
            Vec::new(),
            Vec::new(),
            Vec::new(),
            Vec::new(),
            Vec::new(),
            None,
            None,
        ));
        let component_input = MountInput::new_normalized(
            MountInputType::Component(component.into()),
            ComponentProps::new(),
            Vec::new(),
        );
        match rue.patch_compat_boundary(&mut old_component, &component_input, &mut parent) {
            CompatPatchBoundaryOutcome::NotCompat => {}
            _ => panic!("component patch nodes are not compat patch boundaries"),
        }
    }

    #[wasm_bindgen_test]
    fn compat_replace_helpers_cover_fragment_and_element_cleanup_paths() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let mut parent = node("parent");
        let old_child = node("old");
        let old_fragment_host = node("fragment");
        let new_fragment_host = node("fragment");
        let new_child = node("new");
        set_children(&old_fragment_host, &[old_child.clone()]);
        set_children(&new_fragment_host, &[new_child.clone()]);
        set_children(&parent, &[old_child.clone()]);

        let old_fragment = match compat_state(
            MountedCompatPatchKind::Fragment,
            Some(old_fragment_host),
            vec![old_child.clone()],
        ) {
            MountedSubtreeState::Patch(node) => node,
            _ => unreachable!(),
        };
        assert!(rue.replace_compat_patch(&old_fragment, &new_fragment_host, &mut parent, &None));
        assert_eq!(tags(&parent), vec!["new"]);

        let old_el = node("old_el");
        let new_el = node("new_el");
        set_children(&parent, &[old_el.clone()]);
        let old_element = match compat_state(
            MountedCompatPatchKind::Element("old_el".to_string()),
            Some(old_el),
            Vec::new(),
        ) {
            MountedSubtreeState::Patch(node) => node,
            _ => unreachable!(),
        };
        assert!(rue.replace_compat_patch(&old_element, &new_el, &mut parent, &None));
        assert_eq!(tags(&parent), vec!["new_el"]);
    }

    #[wasm_bindgen_test]
    fn compat_mismatch_rebuild_covers_old_host_anchor_and_none_paths() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let mut parent = node("parent");

        let old_el = node("old_el");
        set_children(&parent, &[old_el.clone()]);
        let mut old = compat_state(
            MountedCompatPatchKind::Element("div".to_string()),
            Some(old_el),
            Vec::new(),
        );
        match rue.patch_compat_boundary(&mut old, &fragment_input("rebuilt"), &mut parent) {
            CompatPatchBoundaryOutcome::Replaced(_) => {}
            _ => panic!("element-to-fragment compat mismatch should rebuild"),
        }
        assert_eq!(tags(&parent), vec!["rebuilt"]);

        let anchor = node("anchor");
        set_children(&parent, &[anchor.clone()]);
        rue.current_anchor = Some(anchor.clone());
        let mut missing_old =
            compat_state(MountedCompatPatchKind::Element("span".to_string()), None, Vec::new());
        match rue.patch_compat_boundary(
            &mut missing_old,
            &element_input("span", "anchored"),
            &mut parent,
        ) {
            CompatPatchBoundaryOutcome::Replaced(_) => {}
            _ => panic!("missing old element should insert before current anchor"),
        }
        assert_eq!(tags(&parent), vec!["span", "anchor"]);

        let detached_anchor = node("detached");
        set_children(&parent, &[]);
        rue.current_anchor = Some(detached_anchor);
        let mut detached_old =
            compat_state(MountedCompatPatchKind::Element("button".to_string()), None, Vec::new());
        match rue.patch_compat_boundary(
            &mut detached_old,
            &element_input("button", "detached"),
            &mut parent,
        ) {
            CompatPatchBoundaryOutcome::Replaced(_) => {}
            _ => panic!("detached anchor should append rebuilt element"),
        }
        assert_eq!(tags(&parent), vec!["button"]);

        rue.current_anchor = None;
        set_children(&parent, &[]);
        let mut append_old =
            compat_state(MountedCompatPatchKind::Element("section".to_string()), None, Vec::new());
        match rue.patch_compat_boundary(
            &mut append_old,
            &element_input("section", "plain"),
            &mut parent,
        ) {
            CompatPatchBoundaryOutcome::Replaced(_) => {}
            _ => panic!("missing old element without anchor should append rebuilt element"),
        }
        assert_eq!(tags(&parent), vec!["section"]);

        let mut rue_without_adapter = Rue::<JsDomAdapter>::new();
        let phantom_input = MountInput {
            r#type: MountInputType::_Phantom(std::marker::PhantomData),
            props: ComponentProps::new(),
            children: Vec::new(),
            key: None,
            strict_component_returns: false,
            mount_cleanup_bucket: None,
            mount_effect_scope_id: None,
            el_hint: None,
        };
        let mut unmatched =
            compat_state(MountedCompatPatchKind::Element("div".to_string()), None, Vec::new());
        match rue_without_adapter.patch_compat_boundary(&mut unmatched, &phantom_input, &mut parent)
        {
            CompatPatchBoundaryOutcome::Handled => {}
            _ => panic!("unmountable mismatch should still be treated as handled"),
        }
    }

    #[wasm_bindgen_test]
    fn compat_fragment_replace_covers_non_fragment_branches() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let mut parent = node("parent");

        let old_host = node("old_host");
        let new_el = node("new_el");
        set_children(&parent, &[old_host.clone()]);
        let old_fragment =
            match compat_state(MountedCompatPatchKind::Fragment, Some(old_host), Vec::new()) {
                MountedSubtreeState::Patch(node) => node,
                _ => unreachable!(),
            };
        assert!(rue.replace_compat_patch(&old_fragment, &new_el, &mut parent, &None));
        assert_eq!(tags(&parent), vec!["new_el"]);

        let stale_old = node("stale_old");
        let leftover = node("leftover");
        let replacement = node("replacement");
        set_children(&parent, &[leftover]);
        let stale_fragment =
            match compat_state(MountedCompatPatchKind::Fragment, Some(stale_old), Vec::new()) {
                MountedSubtreeState::Patch(node) => node,
                _ => unreachable!(),
            };
        assert!(rue.replace_compat_patch(&stale_fragment, &replacement, &mut parent, &None));
        assert_eq!(tags(&parent), vec!["replacement"]);

        let appended = node("appended");
        set_children(&parent, &[]);
        let no_host_fragment =
            match compat_state(MountedCompatPatchKind::Fragment, None, Vec::new()) {
                MountedSubtreeState::Patch(node) => node,
                _ => unreachable!(),
            };
        assert!(rue.replace_compat_patch(&no_host_fragment, &appended, &mut parent, &None));
        assert_eq!(tags(&parent), vec!["appended"]);
    }

    #[wasm_bindgen_test]
    fn compat_js_helpers_cover_child_paths_and_focus_snapshot_matching() {
        let empty_children = Object::new();
        Reflect::set(&empty_children, &JsValue::from_str("children"), &Array::new().into())
            .unwrap();
        assert!(child_values(&empty_children.into()).is_empty());

        assert!(child_values(&Object::new().into()).is_empty());

        let root = node("form");
        let input = node("input");
        Reflect::set(&input, &JsValue::from_str("type"), &JsValue::from_str("text")).unwrap();
        Reflect::set(&input, &JsValue::from_str("selectionStart"), &JsValue::from_f64(1.0))
            .unwrap();
        Reflect::set(&input, &JsValue::from_str("selectionEnd"), &JsValue::from_f64(2.0)).unwrap();
        Reflect::set(
            &input,
            &JsValue::from_str("selectionDirection"),
            &JsValue::from_str("forward"),
        )
        .unwrap();
        set_children(&root, &[input.clone()]);

        assert_eq!(child_values(&root).len(), 1);
        assert_eq!(find_descendant_path(&root, &input), Some(vec![0]));
        assert!(find_descendant_path(&root, &node("missing")).is_none());
        assert!(Object::is(&descendant_by_path(&root, &[0]).unwrap(), &input));
        assert!(descendant_by_path(&root, &[99]).is_none());

        let child_nodes_root = Object::new();
        let child_nodes = Array::new();
        child_nodes.push(&JsValue::NULL);
        child_nodes.push(&input);
        Reflect::set(&child_nodes_root, &JsValue::from_str("childNodes"), &child_nodes.into())
            .unwrap();
        assert_eq!(child_values(&child_nodes_root.into()).len(), 1);

        let no_collection = Object::new();
        Reflect::set(
            &no_collection,
            &JsValue::from_str("children"),
            &JsValue::from_str("not-array-like"),
        )
        .unwrap();
        assert!(child_values(&no_collection.into()).is_empty());

        let object_collection = Object::new();
        let object_collection_root = Object::new();
        Reflect::set(
            &object_collection_root,
            &JsValue::from_str("children"),
            &object_collection.into(),
        )
        .unwrap();
        assert!(child_values(&object_collection_root.into()).is_empty());

        let tag_only = Object::new();
        Reflect::set(&tag_only, &JsValue::from_str("tag"), &JsValue::from_str("textarea")).unwrap();
        assert_eq!(normalized_tag_name(&tag_only.into()), Some("TEXTAREA".to_string()));

        let document = Object::new();
        Reflect::set(&document, &JsValue::from_str("activeElement"), &input).unwrap();
        let global = js_sys::global();
        Reflect::set(&global, &JsValue::from_str("document"), &document).unwrap();
        let snapshot = capture_focus_snapshot(&root).expect("active input should be captured");
        assert!(focus_target_matches(&snapshot, &input));

        let other = node("select");
        Reflect::set(&other, &JsValue::from_str("type"), &JsValue::from_str("text")).unwrap();
        assert!(!focus_target_matches(&snapshot, &other));
        let other_type = node("input");
        Reflect::set(&other_type, &JsValue::from_str("type"), &JsValue::from_str("password"))
            .unwrap();
        assert!(!focus_target_matches(&snapshot, &other_type));

        let loose_snapshot = ReplaceFocusSnapshot {
            path: Vec::new(),
            tag_name: None,
            input_type: None,
            selection_start: None,
            selection_end: None,
            selection_direction: None,
        };
        assert!(focus_target_matches(&loose_snapshot, &other_type));

        let matched_snapshot = ReplaceFocusSnapshot {
            path: Vec::new(),
            tag_name: Some("INPUT".to_string()),
            input_type: Some("text".to_string()),
            selection_start: None,
            selection_end: None,
            selection_direction: None,
        };
        assert!(focus_target_matches(&matched_snapshot, &input));

        Reflect::set(&document, &JsValue::from_str("activeElement"), &JsValue::NULL).unwrap();
        assert!(capture_focus_snapshot(&root).is_none());
        Reflect::delete_property(&global, &JsValue::from_str("document")).unwrap();
    }

    #[wasm_bindgen_test(async)]
    async fn compat_focus_restore_runs_async_selection_path() {
        let target = node("input");
        Reflect::set(&target, &JsValue::from_str("type"), &JsValue::from_str("text")).unwrap();
        set_fn(&Object::from(target.clone()), "focus", "", "this.focused = true");

        let other = node("other");
        let document = Object::new();
        Reflect::set(&document, &JsValue::from_str("activeElement"), &other).unwrap();
        Reflect::set(&target, &JsValue::from_str("ownerDocument"), &document).unwrap();

        let snapshot = ReplaceFocusSnapshot {
            path: Vec::new(),
            tag_name: Some("INPUT".to_string()),
            input_type: Some("text".to_string()),
            selection_start: Some(3),
            selection_end: Some(5),
            selection_direction: Some("backward".to_string()),
        };
        restore_focus_snapshot(&snapshot, &target);
        JsFuture::from(Promise::resolve(&JsValue::UNDEFINED)).await.unwrap();

        assert_eq!(
            Reflect::get(&target, &JsValue::from_str("selectionStart")).unwrap().as_f64(),
            Some(3.0)
        );
        assert_eq!(
            Reflect::get(&target, &JsValue::from_str("selectionEnd")).unwrap().as_f64(),
            Some(5.0)
        );
        assert_eq!(
            Reflect::get(&target, &JsValue::from_str("selectionDirection")).unwrap().as_string(),
            Some("backward".to_string())
        );
        assert_eq!(
            Reflect::get(&target, &JsValue::from_str("focused")).unwrap().as_bool(),
            Some(true)
        );
    }

    #[wasm_bindgen_test(async)]
    async fn compat_focus_restore_skips_focus_when_target_already_active_or_focus_missing() {
        let target = node("input");
        Reflect::set(&target, &JsValue::from_str("type"), &JsValue::from_str("text")).unwrap();

        let document = Object::new();
        Reflect::set(&document, &JsValue::from_str("activeElement"), &target).unwrap();
        Reflect::set(&target, &JsValue::from_str("ownerDocument"), &document).unwrap();

        let snapshot = ReplaceFocusSnapshot {
            path: Vec::new(),
            tag_name: Some("INPUT".to_string()),
            input_type: Some("text".to_string()),
            selection_start: None,
            selection_end: None,
            selection_direction: None,
        };
        restore_focus_snapshot(&snapshot, &target);
        JsFuture::from(Promise::resolve(&JsValue::UNDEFINED)).await.unwrap();
        assert!(
            Reflect::get(&target, &JsValue::from_str("focused"))
                .unwrap_or(JsValue::UNDEFINED)
                .is_undefined()
        );

        let other = node("other");
        Reflect::set(&document, &JsValue::from_str("activeElement"), &other).unwrap();
        restore_focus_snapshot(&snapshot, &target);
        JsFuture::from(Promise::resolve(&JsValue::UNDEFINED)).await.unwrap();
        assert!(
            Reflect::get(&target, &JsValue::from_str("focused"))
                .unwrap_or(JsValue::UNDEFINED)
                .is_undefined()
        );
    }

    #[wasm_bindgen_test]
    fn compat_direct_rebuild_same_covers_insert_anchor_append_and_none_paths() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let mut parent = node("parent");

        let old_input = node("input");
        Reflect::set(&old_input, &JsValue::from_str("type"), &JsValue::from_str("text")).unwrap();
        Reflect::set(&old_input, &JsValue::from_str("selectionStart"), &JsValue::from_f64(4.0))
            .unwrap();
        Reflect::set(&old_input, &JsValue::from_str("selectionEnd"), &JsValue::from_f64(6.0))
            .unwrap();
        set_children(&parent, &[old_input.clone()]);

        let document = Object::new();
        Reflect::set(&document, &JsValue::from_str("activeElement"), &old_input).unwrap();
        let global = js_sys::global();
        Reflect::set(&global, &JsValue::from_str("document"), &document).unwrap();

        let mut input_props = ComponentProps::new();
        input_props.insert("type".to_string(), JsValue::from_str("text"));
        let mounted = rue.patch_rebuild_same(
            Some(old_input),
            &element_input_with_props("input", input_props, Vec::new()),
            &mut parent,
        );
        assert!(mounted.is_some());
        assert_eq!(tags(&parent), vec!["input"]);

        let anchor = node("anchor");
        set_children(&parent, &[anchor.clone()]);
        rue.current_anchor = Some(anchor.clone());
        let mounted = rue.patch_rebuild_same(None, &element_input("span", "anchored"), &mut parent);
        assert!(mounted.is_some());
        assert_eq!(tags(&parent), vec!["span", "anchor"]);

        let detached_anchor = node("detached-anchor");
        set_children(&parent, &[]);
        rue.current_anchor = Some(detached_anchor);
        let mounted =
            rue.patch_rebuild_same(None, &element_input("button", "detached"), &mut parent);
        assert!(mounted.is_some());
        assert_eq!(tags(&parent), vec!["button"]);

        rue.current_anchor = None;
        set_children(&parent, &[]);
        let mounted = rue.patch_rebuild_same(None, &element_input("section", "plain"), &mut parent);
        assert!(mounted.is_some());
        assert_eq!(tags(&parent), vec!["section"]);

        let phantom_input = MountInput {
            r#type: MountInputType::_Phantom(std::marker::PhantomData),
            props: ComponentProps::new(),
            children: Vec::new(),
            key: None,
            strict_component_returns: false,
            mount_cleanup_bucket: None,
            mount_effect_scope_id: None,
            el_hint: None,
        };
        assert!(rue.patch_rebuild_same(None, &phantom_input, &mut parent).is_none());

        let empty_component = MountInput::new_normalized(
            MountInputType::Component(Function::new_no_args("return null").into()),
            ComponentProps::new(),
            Vec::new(),
        );
        assert!(rue.patch_rebuild_same(None, &empty_component, &mut parent).is_some());

        Reflect::delete_property(&global, &JsValue::from_str("document")).unwrap();
    }

    #[wasm_bindgen_test]
    fn compat_direct_fragment_same_covers_hostless_and_unmountable_paths() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let mut parent = node("parent");

        let old_host = node("old-host");
        set_children(&parent, &[old_host.clone()]);
        let old_with_host =
            match compat_state(MountedCompatPatchKind::Fragment, Some(old_host), Vec::new()) {
                MountedSubtreeState::Patch(node) => node,
                _ => unreachable!(),
            };
        let mounted =
            rue.patch_fragment_same(&old_with_host, &fragment_input("before-old"), &mut parent);
        assert!(mounted.is_some());
        assert_eq!(tags(&parent), vec!["before-old"]);

        let anchor = node("anchor");
        set_children(&parent, &[anchor.clone()]);
        rue.current_anchor = Some(anchor.clone());

        let old = match compat_state(MountedCompatPatchKind::Fragment, None, Vec::new()) {
            MountedSubtreeState::Patch(node) => node,
            _ => unreachable!(),
        };
        let mounted = rue.patch_fragment_same(&old, &fragment_input("fresh"), &mut parent);
        assert!(mounted.is_some());
        assert_eq!(tags(&parent), vec!["fresh", "anchor"]);

        let phantom_input = MountInput {
            r#type: MountInputType::_Phantom(std::marker::PhantomData),
            props: ComponentProps::new(),
            children: Vec::new(),
            key: None,
            strict_component_returns: false,
            mount_cleanup_bucket: None,
            mount_effect_scope_id: None,
            el_hint: None,
        };
        assert!(rue.patch_fragment_same(&old, &phantom_input, &mut parent).is_none());

        Reflect::delete_property(&js_sys::global(), &JsValue::from_str("document")).unwrap();
        let mut rue_without_adapter = Rue::<JsDomAdapter>::new();
        let mut no_adapter_old = old.clone();
        let mut no_adapter_parent = node("no-adapter-parent");
        match rue_without_adapter.patch_compat_same(
            &mut no_adapter_old,
            &fragment_input("no-adapter"),
            &mut no_adapter_parent,
        ) {
            CompatPatchSameOutcome::Handled => {}
            _ => panic!("fragment same with unmountable input should be handled"),
        }

        let mut missing_element = match compat_state(
            MountedCompatPatchKind::Element("div".to_string()),
            None,
            Vec::new(),
        ) {
            MountedSubtreeState::Patch(node) => node,
            _ => unreachable!(),
        };
        match rue.patch_element_same(&mut missing_element, &phantom_input, &mut parent) {
            CompatPatchSameOutcome::Handled => {}
            _ => panic!("missing element with unmountable input should be handled"),
        }

        let empty_component = MountInput::new_normalized(
            MountInputType::Component(Function::new_no_args("return null").into()),
            ComponentProps::new(),
            Vec::new(),
        );
        assert!(rue.patch_fragment_same(&old, &empty_component, &mut parent).is_some());
    }

    #[wasm_bindgen_test]
    fn compat_private_outcome_edges_cover_not_handled_and_hostless_returns() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let mut parent = node("parent");

        let old_el = node("old-el");
        set_children(&parent, &[old_el.clone()]);
        let mut old_boundary = compat_state(
            MountedCompatPatchKind::Element("div".to_string()),
            Some(old_el),
            Vec::new(),
        );
        match rue.patch_compat_boundary(&mut old_boundary, &text_input("text"), &mut parent) {
            CompatPatchBoundaryOutcome::Replaced(_) => {}
            _ => panic!("mismatched compat boundary should rebuild through fallback"),
        }

        let mut element_without_host = match compat_state(
            MountedCompatPatchKind::Element("span".to_string()),
            None,
            Vec::new(),
        ) {
            MountedSubtreeState::Patch(node) => node,
            _ => unreachable!(),
        };
        match rue.patch_element_same(
            &mut element_without_host,
            &element_input("span", "fresh"),
            &mut parent,
        ) {
            CompatPatchSameOutcome::Replaced(_) => {}
            _ => panic!("hostless same element should rebuild"),
        }

        let mut mismatch = match compat_state(
            MountedCompatPatchKind::Element("button".to_string()),
            None,
            Vec::new(),
        ) {
            MountedSubtreeState::Patch(node) => node,
            _ => unreachable!(),
        };
        match rue.patch_compat_same(&mut mismatch, &fragment_input("fragment"), &mut parent) {
            CompatPatchSameOutcome::NotHandled => {}
            _ => panic!("element/fragment mismatch should report not handled"),
        }

        let old_fragment_without_host =
            match compat_state(MountedCompatPatchKind::Fragment, None, Vec::new()) {
                MountedSubtreeState::Patch(node) => node,
                _ => unreachable!(),
            };
        let mounted = rue.patch_fragment_same(
            &old_fragment_without_host,
            &fragment_input("fresh"),
            &mut parent,
        );
        assert!(mounted.is_some());

        let empty_component = MountInput::new_normalized(
            MountInputType::Component(Function::new_no_args("return null").into()),
            ComponentProps::new(),
            Vec::new(),
        );
        let mounted =
            rue.patch_fragment_same(&old_fragment_without_host, &empty_component, &mut parent);
        assert!(mounted.is_some());

        let phantom_input = MountInput {
            r#type: MountInputType::_Phantom(std::marker::PhantomData),
            props: ComponentProps::new(),
            children: Vec::new(),
            key: None,
            strict_component_returns: false,
            mount_cleanup_bucket: None,
            mount_effect_scope_id: None,
            el_hint: None,
        };
        assert!(
            rue.patch_fragment_same(&old_fragment_without_host, &phantom_input, &mut parent)
                .is_none()
        );
    }

    #[wasm_bindgen_test]
    fn compat_direct_fragment_same_restores_focus_to_matching_child() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let mut parent = node("parent");

        let old_fragment = node("fragment");
        let old_input = node("input");
        Reflect::set(&old_input, &JsValue::from_str("type"), &JsValue::from_str("text")).unwrap();
        Reflect::set(&old_input, &JsValue::from_str("selectionStart"), &JsValue::from_f64(1.0))
            .unwrap();
        set_children(&old_fragment, &[old_input.clone()]);
        set_children(&parent, &[old_input.clone()]);

        let document = Object::new();
        Reflect::set(&document, &JsValue::from_str("activeElement"), &old_input).unwrap();
        let global = js_sys::global();
        Reflect::set(&global, &JsValue::from_str("document"), &document).unwrap();

        let old = match compat_state(
            MountedCompatPatchKind::Fragment,
            Some(old_fragment),
            vec![old_input],
        ) {
            MountedSubtreeState::Patch(node) => node,
            _ => unreachable!(),
        };
        let mut input_props = ComponentProps::new();
        input_props.insert("type".to_string(), JsValue::from_str("text"));
        let new_fragment = MountInput::new_normalized(
            MountInputType::Fragment,
            ComponentProps::new(),
            vec![MountInputChild::Input(element_input_with_props(
                "input",
                input_props,
                Vec::new(),
            ))],
        );

        let mounted = rue.patch_fragment_same(&old, &new_fragment, &mut parent);
        assert!(mounted.is_some());

        Reflect::delete_property(&global, &JsValue::from_str("document")).unwrap();
    }

    #[wasm_bindgen_test]
    fn compat_element_same_records_patch_props_error() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let mut parent = node("parent");
        let old_el = node("div");
        set_children(&parent, &[old_el.clone()]);
        let mut old = match compat_state(
            MountedCompatPatchKind::Element("div".to_string()),
            Some(old_el),
            Vec::new(),
        ) {
            MountedSubtreeState::Patch(node) => node,
            _ => unreachable!(),
        };

        let throwing_style = Object::new();
        let define = Function::new_with_args(
            "target",
            "Object.defineProperty(target, 'color', { enumerable: true, get() { throw new Error('style failed'); } }); return target;",
        );
        let style = define.call1(&JsValue::UNDEFINED, &throwing_style).unwrap();
        let mut props = ComponentProps::new();
        props.insert("style".to_string(), style);
        let new = element_input_with_props("div", props, Vec::new());

        match rue.patch_element_same(&mut old, &new, &mut parent) {
            CompatPatchSameOutcome::Handled => {}
            _ => panic!("element patch should stay handled after prop error"),
        }
        assert!(rue.last_error.is_some());
    }

    #[wasm_bindgen_test]
    fn compat_replace_patch_returns_false_for_compat_without_kind() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let mut parent = node("parent");
        let new_el = node("new");
        let component = MountedPatchSubtree::<JsDomAdapter>::new_component(
            Function::new_no_args("return null").into(),
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

        assert!(!rue.replace_compat_patch(&component, &new_el, &mut parent, &None));
    }
}
