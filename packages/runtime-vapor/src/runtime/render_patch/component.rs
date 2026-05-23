use super::super::Rue;
use super::super::types::{
    MountInput, MountInputType, MountedPatchSubtree, MountedPatchSubtreeType, MountedSubtreeState,
};
use crate::hook::reactive::props_reactive_js;
use crate::reactive::context::{CONTEXT_OWNER_PARENT_PROP, CONTEXT_PARENT_INSTANCE_PROP};
use crate::reactive::core::{pop_effect_scope, push_effect_scope};
use crate::runtime::dom_adapter::DomAdapter;
use crate::runtime::shared_runtime_bridge;
use js_sys::{Array, Function, Object, Promise, Reflect};
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use wasm_bindgen::closure::Closure;

fn debug_record_component_patch(record: &Object) {
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
    array.push(record);
    let _ = Reflect::set(&global, &key, &array.into());
}

fn active_element() -> Option<JsValue> {
    let global = js_sys::global();
    let document = Reflect::get(&global, &JsValue::from_str("document")).ok()?;
    if document.is_undefined() || document.is_null() {
        return None;
    }

    let active = Reflect::get(&document, &JsValue::from_str("activeElement")).ok()?;
    if active.is_undefined() || active.is_null() {
        return None;
    }

    Some(active)
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

fn has_active_composing_descendant(root: &JsValue) -> bool {
    let Some(active) = active_element() else {
        return false;
    };

    let contains = Reflect::get(root, &JsValue::from_str("contains")).unwrap_or(JsValue::UNDEFINED);
    let Some(contains_fn) = contains.dyn_ref::<Function>() else {
        return false;
    };

    let contains_active =
        contains_fn.call1(root, &active).ok().and_then(|value| value.as_bool()).unwrap_or(false);
    if !contains_active {
        return false;
    }

    Reflect::get(&active, &JsValue::from_str("__rue_is_composing__"))
        .unwrap_or(JsValue::FALSE)
        .as_bool()
        .unwrap_or(false)
}

impl<A: DomAdapter> Rue<A>
where
    A::Element: Clone,
{
    fn comp_prepare_instance(
        &mut self,
        old_inst_index: Option<usize>,
        new: &MountInput<A>,
    ) -> (JsValue, Object, usize)
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        let existing_idx = old_inst_index;
        let (stored_props_ro, stored_host, stored_hooks) = if let Some(idx) = existing_idx {
            if let Some(inst) = self.instance_store.get(&idx) {
                (Some(inst.props_ro.clone()), Some(inst.host.clone()), Some(inst.hooks.0.clone()))
            } else {
                (None, None, None)
            }
        } else {
            (None, None, None)
        };

        let props_ro = stored_props_ro.unwrap_or_else(|| {
            let props_js = self.props_with_children_input_to_jsobject(new);
            shared_runtime_bridge::props_reactive(&props_js)
                .unwrap_or_else(|| props_reactive_js(props_js.clone(), Some(true)))
        });
        let host: Object =
            stored_host.filter(|h| h.is_object()).map(Object::from).unwrap_or_else(Object::new);
        let parent_instance = crate::get_current_instance();
        let _ = Reflect::set(&host, &JsValue::from_str("propsRO"), &props_ro);
        let _ =
            Reflect::set(&host, &JsValue::from_str(CONTEXT_OWNER_PARENT_PROP), &parent_instance);
        let _ =
            Reflect::set(&host, &JsValue::from_str(CONTEXT_PARENT_INSTANCE_PROP), &parent_instance);
        Self::reset_hook_index(&host);

        let hooks = stored_hooks.unwrap_or_default();
        let idx = if let Some(i) = existing_idx {
            i
        } else {
            let new_idx = self.instance_store.len();
            let new_inst = super::super::instance::ComponentInternalInstance::<A> {
                parent: None,
                is_mounted: true,
                hooks: super::super::instance::LifecycleHooks(hooks.clone()),
                props_ro: props_ro.clone(),
                host: host.clone().into(),
                render_scope_id: None,
                error: None,
                error_handlers: Vec::new(),
                index: new_idx,
                _marker: std::marker::PhantomData,
            };
            self.instance_store.insert(new_idx, new_inst);
            new_idx
        };

        if let Some(inst_ref) = self.instance_store.get_mut(&idx) {
            inst_ref.props_ro = props_ro.clone();
            inst_ref.host = host.clone().into();
            inst_ref.hooks = super::super::instance::LifecycleHooks(hooks.clone());
            inst_ref.is_mounted = true;
        }
        self.sync_props_children_input(&props_ro, &new.props, &new.children);
        self.instance_stack.push(idx);
        if let Some(top_idx) = self.instance_stack.last() {
            if let Some(inst_ref) = self.instance_store.get_mut(top_idx) {
                crate::reactive::context::set_current_instance_ci(inst_ref);
            }
        }
        self.call_hooks("before_update");
        (props_ro, host, idx)
    }

    fn comp_execute_and_collect(
        &mut self,
        render_fn: &JsValue,
        props_ro: &JsValue,
        host: &Object,
        idx: usize,
        parent_context: Option<&A::Element>,
    ) -> JsValue
    where
        <A as DomAdapter>::Element: Into<JsValue> + Clone,
    {
        let func = render_fn.dyn_ref::<Function>().unwrap();
        shared_runtime_bridge::begin_component_render(&host.clone().into());
        let render_scope_id = self.renew_component_render_scope(idx);
        push_effect_scope(render_scope_id);
        let prev_container = self.current_container.clone();
        let mut did_push_current_container = false;
        if let Some(parent) = parent_context {
            self.current_container = Some(parent.clone());
            let parent_value: JsValue = parent.clone().into();
            shared_runtime_bridge::push_current_container(&parent_value);
            did_push_current_container = true;
        }
        let ret = match func.call1(&JsValue::UNDEFINED, props_ro) {
            Ok(v) => v,
            Err(e) => {
                if did_push_current_container {
                    shared_runtime_bridge::pop_current_container();
                }
                self.current_container = prev_container;
                let _ = pop_effect_scope();
                shared_runtime_bridge::end_component_render();
                self.handle_error(e.clone());
                self.instance_stack.pop();
                if let Some(top_idx) = self.instance_stack.last() {
                    if let Some(inst_ref) = self.instance_store.get_mut(top_idx) {
                        crate::reactive::context::set_current_instance_ci(inst_ref);
                    } else {
                        crate::set_current_instance(JsValue::UNDEFINED);
                    }
                } else {
                    crate::set_current_instance(JsValue::UNDEFINED);
                }
                wasm_bindgen::throw_val(e.clone());
            }
        };
        if did_push_current_container {
            shared_runtime_bridge::pop_current_container();
        }
        self.current_container = prev_container;
        let _ = pop_effect_scope();
        shared_runtime_bridge::end_component_render();
        let pending = crate::runtime::take_pending_hooks();
        if let Some(top_idx) = self.instance_stack.last() {
            if let Some(inst) = self.instance_store.get_mut(top_idx) {
                for (name, f) in pending.into_iter() {
                    let list = inst.hooks.0.entry(name).or_insert_with(Vec::new);
                    list.push(f);
                }
            }
        }
        ret
    }

    fn comp_make_sub_from_ret(
        &mut self,
        ret: &JsValue,
        strict_component_returns: bool,
    ) -> Option<MountInput<A>>
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        if let Some(input) = self.component_return_value_to_input(ret, strict_component_returns) {
            Some(input)
        } else if ret.is_object() {
            #[cfg(feature = "compat")]
            let error = JsValue::from_str(
                "Unsupported object returns are no longer accepted on the default component path. Return a raw node, fragment, or mount handle instead.",
            );
            #[cfg(not(feature = "compat"))]
            let error = JsValue::from_str(
                "Unsupported object returns are no longer accepted on the default component path. Return a host-node bridge, portable handle, or mount handle instead.",
            );
            self.handle_error(error.clone());
            None
        } else {
            let el: A::Element = ret.clone().into();
            Some(MountInput {
                r#type: MountInputType::<A>::Vapor,
                props: super::super::types::ComponentProps::new(),
                children: vec![],
                key: None,
                strict_component_returns: false,
                mount_cleanup_bucket: None,
                mount_effect_scope_id: None,
                el_hint: Some(el),
            })
        }
    }

    fn comp_mount_or_patch_subtree(
        &mut self,
        old: &mut MountedPatchSubtree<A>,
        parent: &mut A::Element,
        new_sub: MountInput<A>,
    ) -> Option<MountedSubtreeState<A>>
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        if let Some(old_sub) = old.comp_subtree.as_deref_mut() {
            let should_hold_composing_subtree = old_sub.host_cloned().is_some_and(|host| {
                let host_js: JsValue = host.into();
                has_active_composing_descendant(&host_js)
            });
            if should_hold_composing_subtree {
                return Some(old_sub.clone());
            }

            let focus_snapshot = old_sub.host_cloned().and_then(|host| {
                let host_js: JsValue = host.into();
                capture_focus_snapshot(&host_js)
            });

            if matches!(old_sub, MountedSubtreeState::Vapor(_))
                && old_sub.matches_input_type(&new_sub.r#type)
                && matches!(new_sub.r#type, MountInputType::<A>::Vapor)
                && new_sub
                    .el_hint
                    .as_ref()
                    .zip(old_sub.host())
                    .map(|(new_host, old_host)| {
                        let new_host_js: JsValue = new_host.clone().into();
                        let old_host_js: JsValue = old_host.clone().into();
                        Object::is(&old_host_js, &new_host_js)
                    })
                    .unwrap_or(false)
            {
                return Some(old_sub.clone());
            }

            self.patch(old_sub, &new_sub, parent);
            if let (Some(snapshot), Some(next_host)) =
                (focus_snapshot.as_ref(), old_sub.host_cloned())
            {
                let next_host_js: JsValue = next_host.into();
                if let Some(target) = descendant_by_path(&next_host_js, &snapshot.path)
                    .filter(|target| focus_target_matches(snapshot, target))
                {
                    restore_focus_snapshot(snapshot, &target);
                }
            }
            Some(old_sub.clone())
        } else if let Some(mounted_subtree) = self.mount_from_input(&new_sub, Some(parent)) {
            if let Some(el_new) = mounted_subtree.host_cloned() {
                let anchor_opt = self.current_anchor.clone();
                let mut dest_parent =
                    self.resolve_dest_parent(parent, old.el.clone(), anchor_opt.clone());
                self.clear_fragment_nodes(&mut dest_parent, &old.fragment_nodes);

                if let Some(a) = self.get_dom_adapter_mut() {
                    if let Some(ref el_old) = old.el {
                        let old_el_js: JsValue = el_old.clone().into();
                        let old_class = Reflect::get(&old_el_js, &JsValue::from_str("className"))
                            .unwrap_or(JsValue::UNDEFINED);
                        let old_class_string = old_class.as_string().unwrap_or_default();
                        if old_class_string.contains("sidebar-playground") {
                            let record = Object::new();
                            let dest_parent_js: JsValue = dest_parent.clone().into();
                            let new_el_js: JsValue = el_new.clone().into();
                            let anchor_value = anchor_opt
                                .clone()
                                .map(|anchor| {
                                    let value: JsValue = anchor.into();
                                    value
                                })
                                .unwrap_or(JsValue::NULL);
                            let _ = Reflect::set(
                                &record,
                                &JsValue::from_str("instIndex"),
                                &old.comp_inst_index
                                    .map(|idx| JsValue::from_f64(idx as f64))
                                    .unwrap_or(JsValue::NULL),
                            );
                            let _ = Reflect::set(
                                &record,
                                &JsValue::from_str("oldClass"),
                                &JsValue::from_str(&old_class_string),
                            );
                            let _ = Reflect::set(
                                &record,
                                &JsValue::from_str("parentClass"),
                                &Reflect::get(&dest_parent_js, &JsValue::from_str("className"))
                                    .unwrap_or(JsValue::UNDEFINED),
                            );
                            let _ = Reflect::set(
                                &record,
                                &JsValue::from_str("newClass"),
                                &Reflect::get(&new_el_js, &JsValue::from_str("className"))
                                    .unwrap_or(JsValue::UNDEFINED),
                            );
                            let _ = Reflect::set(
                                &record,
                                &JsValue::from_str("anchorPresent"),
                                &JsValue::from_bool(
                                    !anchor_value.is_null() && !anchor_value.is_undefined(),
                                ),
                            );
                            debug_record_component_patch(&record);
                        }
                        if a.contains(&dest_parent, el_old) {
                            let mut p2 = dest_parent.clone();
                            a.remove_child(&mut p2, el_old);
                        }
                    }
                    if let Some(anchor) = anchor_opt {
                        if a.contains(&dest_parent, &anchor) {
                            a.insert_before(&mut dest_parent, &el_new, &anchor);
                        } else {
                            a.append_child(&mut dest_parent, &el_new);
                        }
                    } else {
                        a.append_child(&mut dest_parent, &el_new);
                    }
                }
            }
            Some(mounted_subtree)
        } else {
            None
        }
    }

    fn comp_finalize(&mut self) -> std::collections::HashMap<String, Vec<JsValue>> {
        let hooks = self
            .instance_stack
            .last()
            .and_then(|top_idx| self.instance_store.get(top_idx))
            .map(|ci| ci.hooks.0.clone())
            .unwrap_or_default();
        self.call_hooks("updated");
        self.instance_stack.pop();
        if let Some(top_idx) = self.instance_stack.last() {
            if let Some(inst_ref) = self.instance_store.get_mut(top_idx) {
                crate::reactive::context::set_current_instance_ci(inst_ref);
            } else {
                crate::set_current_instance(JsValue::UNDEFINED);
            }
        } else {
            crate::set_current_instance(JsValue::UNDEFINED);
        }
        hooks
    }

    pub(super) fn patch_component_same(
        &mut self,
        old: &mut MountedPatchSubtree<A>,
        new: &MountInput<A>,
        parent: &mut A::Element,
    ) where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        let render_fn = match &new.r#type {
            MountInputType::Component(render_fn) => render_fn,
            _ => unreachable!(),
        };
        let (props_ro, host, idx) = self.comp_prepare_instance(old.comp_inst_index, new);
        let ret = self.comp_execute_and_collect(render_fn, &props_ro, &host, idx, Some(parent));
        let new_sub_opt = self.comp_make_sub_from_ret(&ret, new.strict_component_returns);
        let mut mounted_subtree = old.comp_subtree.as_deref().cloned();
        if let Some(new_sub) = new_sub_opt {
            crate::set_current_instance(host.clone().into());
            mounted_subtree = self.comp_mount_or_patch_subtree(old, parent, new_sub);
        }
        let hooks = self.comp_finalize();
        old.key = new.key.clone();
        old.comp_inst_index = Some(idx);
        old.component_before_unmount_hooks =
            hooks.get("before_unmount").cloned().unwrap_or_default();
        old.component_unmounted_hooks = hooks.get("unmounted").cloned().unwrap_or_default();

        if let Some(subtree) = mounted_subtree {
            old.el = subtree.host_cloned();
            old.fragment_nodes = subtree.fragment_nodes_cloned();
            old.comp_subtree = Some(Box::new(subtree));
        }

        old.r#type = MountedPatchSubtreeType::Component(render_fn.clone());
    }
}
