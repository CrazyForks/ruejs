use super::super::Rue;
use super::super::types::{MountInput, MountedPatchSubtree, MountedSubtreeState};
use crate::runtime::dom_adapter::DomAdapter;
use js_sys::{Array, Function, Object, Reflect};
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;

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

fn debug_record_sidebar_replace(
    kind: &str,
    parent: &JsValue,
    old_host: &JsValue,
    new_host: &JsValue,
) {
    let old_class = js_string_prop(old_host, "className").unwrap_or_default();
    if !old_class.contains("sidebar-playground") {
        return;
    }

    let global = js_sys::global();
    let enabled =
        Reflect::get(&global, &JsValue::from_str("__rue_debug_component_patch_enabled__"))
            .unwrap_or(JsValue::FALSE);
    if !enabled.as_bool().unwrap_or(false) {
        return;
    }

    let key = JsValue::from_str("__rue_debug_component_patch__");
    let existing = Reflect::get(&global, &key).unwrap_or(JsValue::UNDEFINED);
    let array = if Array::is_array(&existing) { Array::from(&existing) } else { Array::new() };
    let record = Object::new();
    let _ = Reflect::set(&record, &JsValue::from_str("kind"), &JsValue::from_str(kind));
    let _ = Reflect::set(&record, &JsValue::from_str("oldClass"), &JsValue::from_str(&old_class));
    let _ = Reflect::set(&record, &JsValue::from_str("parentClass"), &js_prop(parent, "className"));
    let _ = Reflect::set(&record, &JsValue::from_str("newClass"), &js_prop(new_host, "className"));
    array.push(&record);
    let _ = Reflect::set(&global, &key, &array.into());
}

fn normalized_tag_name(value: &JsValue) -> Option<String> {
    js_string_prop(value, "tagName")
        .or_else(|| js_string_prop(value, "tag"))
        .map(|tag| tag.to_ascii_uppercase())
}

fn normalized_input_type(value: &JsValue) -> Option<String> {
    js_string_prop(value, "type").map(|kind| kind.to_ascii_lowercase())
}

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

fn restore_focus_snapshot(snapshot: &ReplaceFocusSnapshot, target: &JsValue) {
    let focus = js_prop(target, "focus");
    if let Some(function) = focus.dyn_ref::<Function>() {
        let _ = function.call0(target);
    }

    if let Some(start) = snapshot.selection_start {
        let _ = Reflect::set(
            target,
            &JsValue::from_str("selectionStart"),
            &JsValue::from_f64(start as f64),
        );
    }
    if let Some(end) = snapshot.selection_end {
        let _ = Reflect::set(
            target,
            &JsValue::from_str("selectionEnd"),
            &JsValue::from_f64(end as f64),
        );
    }
    if let Some(direction) = snapshot.selection_direction.as_ref() {
        let _ = Reflect::set(
            target,
            &JsValue::from_str("selectionDirection"),
            &JsValue::from_str(direction),
        );
    }
}

impl<A: DomAdapter> Rue<A>
where
    A::Element: Clone,
{
    fn replace_vapor_like(
        &mut self,
        old_host: Option<&A::Element>,
        old_fragment_nodes: &[A::Element],
        new_el: &A::Element,
        parent: &mut A::Element,
        insert_anchor: &Option<A::Element>,
    ) where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        let focus_snapshot = old_host.and_then(|host| {
            let host_js: JsValue = host.clone().into();
            capture_focus_snapshot(&host_js)
        });
        let focus_target = focus_snapshot.as_ref().and_then(|snapshot| {
            let new_root: JsValue = new_el.clone().into();
            descendant_by_path(&new_root, &snapshot.path)
                .filter(|target| focus_target_matches(snapshot, target))
        });
        let cleared = self.clear_fragment_nodes(parent, old_fragment_nodes);
        if !cleared {
            if let Some(adapter) = self.get_dom_adapter_mut() {
                if let Some(el_old) = old_host {
                    if adapter.contains(parent, el_old) {
                        let parent_js: JsValue = parent.clone().into();
                        let old_host_js: JsValue = el_old.clone().into();
                        let new_host_js: JsValue = new_el.clone().into();
                        debug_record_sidebar_replace(
                            "replace_vapor_like",
                            &parent_js,
                            &old_host_js,
                            &new_host_js,
                        );
                        adapter.insert_before(parent, new_el, el_old);
                        let mut p2 = parent.clone();
                        adapter.remove_child(&mut p2, el_old);
                        if let (Some(snapshot), Some(target)) =
                            (focus_snapshot.as_ref(), focus_target.as_ref())
                        {
                            restore_focus_snapshot(snapshot, target);
                        }
                        return;
                    }
                }
            }
        }
        if let Some(adapter2) = self.get_dom_adapter() {
            if adapter2.is_fragment(new_el) {
                self.insert_fragment_children_preferring_end(parent, new_el, insert_anchor);
            } else {
                self.insert_with_end_anchor_opt(parent, new_el, insert_anchor);
            }
        }
        if let (Some(snapshot), Some(target)) = (focus_snapshot.as_ref(), focus_target.as_ref()) {
            restore_focus_snapshot(snapshot, target);
        }
    }

    fn replace_component(
        &mut self,
        old: &MountedPatchSubtree<A>,
        new_el: &A::Element,
        dest_parent: &mut A::Element,
        _parent: &mut A::Element,
        insert_anchor: &Option<A::Element>,
    ) where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        let cleared = self.clear_fragment_nodes(dest_parent, &old.fragment_nodes);
        #[cfg(feature = "dev")]
        {
            if crate::log::want_log("debug", "replace_component: cleared old frag node") {
                crate::log::log(
                    "debug",
                    &format!("replace_component: cleared old frag nodes: {:?}", cleared),
                );
            }
        }
        if let Some(adapter) = self.get_dom_adapter() {
            if adapter.is_fragment(new_el) {
                if let Some(ref el_old) = old.el {
                    let effective_anchor = self.current_anchor.clone().or(insert_anchor.clone());
                    let mut real_parent =
                        self.resolve_dest_parent(dest_parent, None, effective_anchor.clone());
                    self.clear_current_named_range_if_present(&mut real_parent);
                    self.clear_old_el_if_present(&mut real_parent, el_old);
                    self.insert_fragment_children_preferring_end(
                        &mut real_parent,
                        new_el,
                        &effective_anchor,
                    );
                } else {
                    self.clear_current_named_range_if_present(dest_parent);
                    self.insert_fragment_children_preferring_end(
                        dest_parent,
                        new_el,
                        insert_anchor,
                    );
                }
            } else {
                let effective_anchor = self.current_anchor.clone().or(insert_anchor.clone());
                let mut real_parent =
                    self.resolve_dest_parent(dest_parent, old.el.clone(), effective_anchor.clone());

                if !cleared {
                    if let Some(adapter2) = self.get_dom_adapter_mut() {
                        if let Some(ref el_old) = old.el {
                            if adapter2.contains(&real_parent, el_old) {
                                let parent_js: JsValue = real_parent.clone().into();
                                let old_host_js: JsValue = el_old.clone().into();
                                let new_host_js: JsValue = new_el.clone().into();
                                debug_record_sidebar_replace(
                                    "replace_component",
                                    &parent_js,
                                    &old_host_js,
                                    &new_host_js,
                                );
                                adapter2.insert_before(&mut real_parent, new_el, el_old);
                                let mut p2 = real_parent.clone();
                                adapter2.remove_child(&mut p2, el_old);
                                return;
                            }
                        }
                    }
                }
                self.insert_with_end_anchor_opt(&mut real_parent, new_el, &effective_anchor);
                if let Some(ref el_old) = old.el {
                    self.clear_old_el_if_present(&mut real_parent, el_old);
                }
            }
        }
    }

    pub(super) fn replace_non_fragment_with_fallback(
        &mut self,
        old_host: Option<&A::Element>,
        new_el: &A::Element,
        dest_parent: &mut A::Element,
    ) {
        if let Some(adapter) = self.get_dom_adapter_mut() {
            if let Some(el_old) = old_host {
                if adapter.contains(dest_parent, el_old) {
                    adapter.insert_before(dest_parent, new_el, el_old);
                    let mut p2 = dest_parent.clone();
                    adapter.remove_child(&mut p2, el_old);
                } else {
                    let kids = adapter.collect_fragment_children(dest_parent);
                    for n in kids.iter() {
                        let mut p2 = dest_parent.clone();
                        adapter.remove_child(&mut p2, n);
                    }
                    adapter.append_child(dest_parent, new_el);
                }
            } else {
                adapter.append_child(dest_parent, new_el);
            }
        }
    }

    fn replace_text(
        &mut self,
        old_host: Option<&A::Element>,
        new_el: &A::Element,
        dest_parent: &mut A::Element,
    ) {
        self.replace_non_fragment_with_fallback(old_host, new_el, dest_parent);
    }

    pub(super) fn patch_replace(
        &mut self,
        old: &mut MountedSubtreeState<A>,
        new: &MountInput<A>,
        parent: &mut A::Element,
    ) where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        let lifecycle = old.lifecycle_record();
        let eager_unmounted = matches!(old, MountedSubtreeState::Vapor(_));
        self.invoke_before_unmount_record(&lifecycle);
        if eager_unmounted {
            let anchor_opt = self.current_anchor.clone();
            let mut preclear_parent =
                self.resolve_dest_parent(parent, old.host_cloned(), anchor_opt.clone());
            self.clear_fragment_nodes(&mut preclear_parent, old.fragment_nodes());
            self.invoke_unmounted_record(&lifecycle);
        }
        if let Some(mounted) = self.mount_from_input(new, Some(parent)) {
            let Some(el_new) = mounted.host_cloned() else {
                *old = mounted;
                if !eager_unmounted {
                    self.invoke_unmounted_record(&lifecycle);
                }
                return;
            };
            let anchor_opt = self.current_anchor.clone();
            let mut dest_parent =
                self.resolve_dest_parent(parent, old.host_cloned(), anchor_opt.clone());
            let insert_anchor = old.host_cloned().or(anchor_opt.clone());
            #[cfg(not(feature = "compat"))]
            match old {
                MountedSubtreeState::Vapor(vapor) => {
                    self.replace_vapor_like(
                        vapor.host.as_ref(),
                        vapor.fragment_nodes.as_slice(),
                        &el_new,
                        &mut dest_parent,
                        &insert_anchor,
                    );
                }
                MountedSubtreeState::Patch(node) => {
                    self.replace_component(node, &el_new, &mut dest_parent, parent, &insert_anchor);
                }
                MountedSubtreeState::Text(text) => {
                    self.replace_text(text.host.as_ref(), &el_new, &mut dest_parent);
                }
            }
            #[cfg(feature = "compat")]
            match old {
                MountedSubtreeState::Vapor(vapor) => {
                    self.replace_vapor_like(
                        vapor.host.as_ref(),
                        vapor.fragment_nodes.as_slice(),
                        &el_new,
                        &mut dest_parent,
                        &insert_anchor,
                    );
                }
                MountedSubtreeState::Patch(node) => {
                    if !self.replace_compat_patch(node, &el_new, &mut dest_parent, &insert_anchor) {
                        if matches!(
                            node.r#type,
                            super::super::types::MountedPatchSubtreeType::Component(_)
                        ) {
                            self.replace_component(
                                node,
                                &el_new,
                                &mut dest_parent,
                                parent,
                                &insert_anchor,
                            );
                        } else {
                            unreachable!("mounted patch state should not contain phantom nodes")
                        }
                    }
                }
                MountedSubtreeState::Text(text) => {
                    self.replace_text(text.host.as_ref(), &el_new, &mut dest_parent);
                }
            }
            *old = mounted;
        }
        if !eager_unmounted {
            self.invoke_unmounted_record(&lifecycle);
        }
    }
}
