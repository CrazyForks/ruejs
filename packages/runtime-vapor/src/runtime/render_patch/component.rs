/*
组件 patch

同一组件类型更新时复用组件实例、propsRO 和 hook 状态，同时为本轮 render 重新建立 effect scope。
这能避免组件函数重跑后旧 watch/useEffect 残留，也保留 useState/useRef 等 Hook 插槽的稳定性。
*/
use super::super::Rue;
use super::super::types::{
    MountInput, MountInputType, MountedPatchSubtree, MountedPatchSubtreeType, MountedSubtreeState,
};
use crate::hook::reactive::props_reactive_js;
use crate::reactive::context::{CONTEXT_OWNER_PARENT_PROP, CONTEXT_PARENT_INSTANCE_PROP};
use crate::reactive::core::{
    begin_render_debug_owner, end_render_debug_owner, pop_effect_scope, push_effect_scope,
};
use crate::runtime::dom_adapter::DomAdapter;
use crate::runtime::shared_runtime_bridge;
use js_sys::{Array, Function, Object, Promise, Reflect};
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use wasm_bindgen::closure::Closure;

#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
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

#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
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

#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
fn component_render_fn_from_input<A: DomAdapter>(new: &MountInput<A>) -> &JsValue {
    match &new.r#type {
        MountInputType::Component(render_fn) => render_fn,
        _ => unreachable!(),
    }
}

#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
fn apply_component_subtree_snapshot<A: DomAdapter>(
    old: &mut MountedPatchSubtree<A>,
    mounted_subtree: Option<MountedSubtreeState<A>>,
) where
    A::Element: Clone,
{
    if let Some(subtree) = mounted_subtree {
        old.el = subtree.host_cloned();
        old.fragment_nodes = subtree.fragment_nodes_cloned();
        old.comp_subtree = Some(Box::new(subtree));
    }
}

impl<A: DomAdapter> Rue<A>
where
    A::Element: Clone,
{
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
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
            // 同一组件类型更新时优先复用旧实例，保留 Hook 状态与 lifecycle hooks。
            if let Some(inst) = self.instance_store.get(&idx) {
                (Some(inst.props_ro.clone()), Some(inst.host.clone()), Some(inst.hooks.0.clone()))
            } else {
                (None, None, None)
            }
        } else {
            (None, None, None)
        };

        let props_ro = match stored_props_ro {
            Some(props_ro) => props_ro,
            None => {
                // 首次 patch/无旧实例时才创建 propsRO；后续通过 sync_props_children_input 原地同步。
                let props_js = self.props_with_children_input_to_jsobject(new);
                match shared_runtime_bridge::props_reactive(&props_js) {
                    Some(props_ro) => props_ro,
                    None => props_reactive_js(props_js.clone(), Some(true)),
                }
            }
        };
        let host: Object = match stored_host {
            Some(host) if host.is_object() => Object::from(host),
            _ => Object::new(),
        };
        let parent_instance = crate::get_current_instance();
        // host 是 Hook/上下文使用的组件宿主对象；每轮 render 前都刷新父实例引用。
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
            // 没有旧实例时补建一个实例，保证后续 patch/unmount 能通过 index 找回生命周期状态。
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
            // instance_store 是权威状态；即使 host/propsRO 复用，也要把最新引用写回。
            inst_ref.props_ro = props_ro.clone();
            inst_ref.host = host.clone().into();
            inst_ref.hooks = super::super::instance::LifecycleHooks(hooks.clone());
            inst_ref.is_mounted = true;
        }
        // propsRO 对象保持引用稳定，字段内容按新输入同步，避免子 effect 因 props 对象换引用而失效。
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

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
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
        // 将组件实例压入 render debug owner 栈，绑定本轮 render 内创建的 effect。
        let host_value: JsValue = host.clone().into();
        begin_render_debug_owner(&host_value);
        shared_runtime_bridge::begin_component_render(&host_value);
        // 每轮组件 render 都创建新 render scope，并释放旧 scope（由 renew 内部处理）。
        // 这样组件函数里新建的 useEffect/watch 不会在多次更新后叠加。
        let render_scope_id = self.renew_component_render_scope(idx);
        push_effect_scope(render_scope_id);
        let prev_container = self.current_container.clone();
        let mut did_push_current_container = false;
        if let Some(parent) = parent_context {
            // 组件 render 内可能创建嵌套 Vapor/anchor，需要能拿到当前真实父容器。
            self.current_container = Some(parent.clone());
            let parent_value: JsValue = parent.clone().into();
            shared_runtime_bridge::push_current_container(&parent_value);
            did_push_current_container = true;
        }
        let ret = match func.call1(&JsValue::UNDEFINED, props_ro) {
            Ok(v) => v,
            Err(e) => {
                // 出错也必须恢复容器栈、effect scope 和当前实例，否则后续渲染上下文会错位。
                if did_push_current_container {
                    shared_runtime_bridge::pop_current_container();
                }
                self.current_container = prev_container;
                let _ = pop_effect_scope();
                shared_runtime_bridge::end_component_render();
                end_render_debug_owner();
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
        // render 正常结束后恢复外层容器与 scope，再收集 render 期间注册的生命周期 hooks。
        self.current_container = prev_container;
        let _ = pop_effect_scope();
        shared_runtime_bridge::end_component_render();
        end_render_debug_owner();
        let pending = crate::runtime::take_pending_hooks();
        if let Some(top_idx) = self.instance_stack.last() {
            if let Some(inst) = self.instance_store.get_mut(top_idx) {
                for (name, f) in pending.into_iter() {
                    // pending hooks 来自重入时无法借用 runtime 的注册调用，此处合并回当前实例。
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
            // 默认组件路径拒绝未知对象返回，避免把普通数据误当 DOM/handle。
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
            // 原始非对象返回值在 wasm 边界通常代表宿主节点值，按 Vapor host node 处理。
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

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
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
                // 输入法 composition 进行中时暂不 patch，避免打断用户正在输入的组合文本。
                return Some(old_sub.clone());
            }

            // 记录旧焦点位置，patch 后尝试在新子树中按路径恢复焦点和选区。
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
                // 新旧 Vapor 指向同一个 host node，说明 JS 侧已经复用节点；Rust snapshot 直接保留即可。
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
            // 旧组件 snapshot 没有子树时，先挂载新子树，再按旧 el/anchor 位置插回 DOM。
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
                            let anchor_value = match anchor_opt.clone() {
                                Some(anchor) => anchor.into(),
                                None => JsValue::NULL,
                            };
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

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
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
        let render_fn = component_render_fn_from_input(new);
        let (props_ro, host, idx) = self.comp_prepare_instance(old.comp_inst_index, new);
        let ret = self.comp_execute_and_collect(render_fn, &props_ro, &host, idx, Some(parent));
        let new_sub_opt = self.comp_make_sub_from_ret(&ret, new.strict_component_returns);
        let mut mounted_subtree = old.comp_subtree.as_deref().cloned();
        if let Some(new_sub) = new_sub_opt {
            // patch 子树期间仍属于当前组件 render，保持调试 owner 一致。
            begin_render_debug_owner(&host.clone().into());
            crate::set_current_instance(host.clone().into());
            mounted_subtree = self.comp_mount_or_patch_subtree(old, parent, new_sub);
            end_render_debug_owner();
        }
        let hooks = self.comp_finalize();
        old.key = new.key.clone();
        old.comp_inst_index = Some(idx);
        old.component_before_unmount_hooks =
            hooks.get("before_unmount").cloned().unwrap_or_default();
        old.component_unmounted_hooks = hooks.get("unmounted").cloned().unwrap_or_default();
        // 更新 KeepAlive hooks snapshot，缓存 range 后续激活/停用会读取这里的最新回调。
        old.component_activated_hooks = hooks.get("activated").cloned().unwrap_or_default();
        old.component_deactivated_hooks = hooks.get("deactivated").cloned().unwrap_or_default();

        apply_component_subtree_snapshot(old, mounted_subtree);

        old.r#type = MountedPatchSubtreeType::Component(render_fn.clone());
    }
}

#[cfg(test)]
mod component_plan999_tests {
    use super::*;
    use crate::runtime::instance::{ComponentInternalInstance, LifecycleHooks};
    use crate::runtime::js_adapter::JsDomAdapter;
    use crate::runtime::{ComponentProps, MountInputChild, push_pending_hook, take_pending_hooks};
    use wasm_bindgen_futures::JsFuture;
    use wasm_bindgen_test::*;

    fn set_fn(obj: &Object, name: &str, args: &str, body: &str) {
        Reflect::set(obj, &JsValue::from_str(name), &Function::new_with_args(args, body).into())
            .unwrap();
    }

    fn make_adapter() -> (JsDomAdapter, JsValue) {
        let adapter = Object::new();
        for (name, args, body) in [
            ("createElement", "tag", "return { tag, children: [], nodeType: 1 }"),
            ("createTextNode", "text", "return { tag: '#text', text, children: [], nodeType: 3 }"),
            (
                "createDocumentFragment",
                "",
                "return { tag: 'fragment', children: [], nodeType: 11 }",
            ),
            ("isFragment", "el", "return !!el && el.tag === 'fragment'"),
            ("collectFragmentChildren", "el", "return Array.from(el && el.children || [])"),
            ("setTextContent", "el,text", "el.text = text"),
            (
                "appendChild",
                "parent, child",
                "parent.children = parent.children || []; parent.children.push(child); child.parentNode = parent",
            ),
            (
                "insertBefore",
                "parent, child, before",
                "parent.children = parent.children || []; const i = parent.children.indexOf(before); if (i >= 0) parent.children.splice(i, 0, child); else parent.children.push(child); child.parentNode = parent",
            ),
            (
                "removeChild",
                "parent, child",
                "parent.children = (parent.children || []).filter(x => x !== child); if (child) child.parentNode = null",
            ),
            (
                "contains",
                "parent, child",
                "return parent === child || (parent.children || []).includes(child)",
            ),
            ("setClassName", "el,value", "el.className = value; el.class = value"),
            ("patchStyle", "el,oldStyle,newStyle", "el.style = newStyle"),
            ("setInnerHTML", "el,html", "el.children = []; el.text = html"),
            ("setValue", "el,value", "el.value = value"),
            ("setChecked", "el,value", "el.checked = !!value"),
            ("setDisabled", "el,value", "el.disabled = !!value"),
            ("clearRef", "ref", "return"),
            ("applyRef", "el,ref", "return"),
            ("setAttribute", "el,key,value", "el.attrs = el.attrs || {}; el.attrs[key] = value"),
            ("removeAttribute", "el,key", "if (el.attrs) delete el.attrs[key]"),
            ("getTagName", "el", "return el.tag || ''"),
            ("addEventListener", "el,event,handler", "return"),
            ("removeEventListener", "el,event,handler", "return"),
            ("hasValueProperty", "el", "return 'value' in el"),
            ("isSelectMultiple", "el", "return !!el.multiple"),
            ("querySelector", "selector", "return null"),
        ] {
            Reflect::set(
                &adapter,
                &JsValue::from_str(name),
                &Function::new_with_args(args, body).into(),
            )
            .unwrap();
        }
        let adapter_js: JsValue = adapter.into();
        (JsDomAdapter::new(adapter_js.clone()), adapter_js)
    }

    fn component_input(render: &Function) -> MountInput<JsDomAdapter> {
        let mut props = ComponentProps::new();
        props.insert("label".to_string(), JsValue::from_str("first"));
        MountInput::new_normalized(
            MountInputType::Component(render.clone().into()),
            props,
            vec![MountInputChild::Text("child".to_string())],
        )
    }

    fn text_input(text: &str) -> MountInput<JsDomAdapter> {
        MountInput::new_normalized(
            MountInputType::Text(text.to_string()),
            ComponentProps::new(),
            Vec::new(),
        )
    }

    fn call_adapter0(adapter_js: &JsValue, name: &str) -> JsValue {
        let func = Reflect::get(&adapter_js, &JsValue::from_str(name)).unwrap();
        func.unchecked_ref::<Function>().call0(&adapter_js).unwrap()
    }

    fn call_adapter1(adapter_js: &JsValue, name: &str, arg: &JsValue) -> JsValue {
        let func = Reflect::get(&adapter_js, &JsValue::from_str(name)).unwrap();
        func.unchecked_ref::<Function>().call1(&adapter_js, arg).unwrap()
    }

    fn append_child(adapter_js: &JsValue, parent: &JsValue, child: &JsValue) {
        let func = Reflect::get(&adapter_js, &JsValue::from_str("appendChild")).unwrap();
        let _ = func.unchecked_ref::<Function>().call2(&adapter_js, parent, child);
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
        }
        Reflect::set(parent, &JsValue::from_str("children"), &arr.into()).unwrap();
    }

    #[wasm_bindgen_test]
    fn component_debug_record_respects_global_flag_and_reuses_array() {
        let global = js_sys::global();
        let enabled_key = JsValue::from_str("__rue_debug_component_patch_enabled__");
        let records_key = JsValue::from_str("__rue_debug_component_patch__");
        Reflect::delete_property(&global, &enabled_key).unwrap();
        Reflect::delete_property(&global, &records_key).unwrap();

        debug_record_component_patch(&Object::new());
        assert!(Reflect::get(&global, &records_key).unwrap().is_undefined());

        Reflect::set(&global, &enabled_key, &JsValue::TRUE).unwrap();
        let seed = Array::new();
        let seeded_record = Object::new();
        seed.push(&seeded_record);
        Reflect::set(&global, &records_key, &seed.into()).unwrap();
        let record = Object::new();

        debug_record_component_patch(&record);

        let records = Array::from(&Reflect::get(&global, &records_key).unwrap());
        assert_eq!(records.length(), 2);
        assert!(Object::is(&records.get(1), &record.into()));
        Reflect::delete_property(&global, &enabled_key).unwrap();
        Reflect::delete_property(&global, &records_key).unwrap();
    }

    #[wasm_bindgen_test]
    fn component_focus_helpers_cover_childnodes_paths_and_matching() {
        let root = node("form");
        let input = node("input");
        Reflect::set(&input, &JsValue::from_str("type"), &JsValue::from_str("text")).unwrap();
        Reflect::set(&input, &JsValue::from_str("selectionStart"), &JsValue::from_f64(4.0))
            .unwrap();
        Reflect::set(&input, &JsValue::from_str("selectionEnd"), &JsValue::from_f64(6.0)).unwrap();
        Reflect::set(
            &input,
            &JsValue::from_str("selectionDirection"),
            &JsValue::from_str("forward"),
        )
        .unwrap();
        set_children(&root, &[input.clone()]);

        assert_eq!(child_values(&root).len(), 1);
        assert_eq!(find_descendant_path(&root, &root), Some(Vec::new()));
        assert_eq!(find_descendant_path(&root, &input), Some(vec![0]));
        assert!(Object::is(&descendant_by_path(&root, &[0]).unwrap(), &input));
        assert!(descendant_by_path(&root, &[1]).is_none());

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

        let global = js_sys::global();
        Reflect::delete_property(&global, &JsValue::from_str("document")).unwrap();
        assert!(active_element().is_none());

        let document = Object::new();
        Reflect::set(&document, &JsValue::from_str("activeElement"), &input).unwrap();
        Reflect::set(&global, &JsValue::from_str("document"), &document).unwrap();
        let snapshot = capture_focus_snapshot(&root).expect("active descendant should be captured");
        assert!(focus_target_matches(&snapshot, &input));

        let other_tag = node("select");
        Reflect::set(&other_tag, &JsValue::from_str("type"), &JsValue::from_str("text")).unwrap();
        assert!(!focus_target_matches(&snapshot, &other_tag));
        let other_type = node("input");
        Reflect::set(&other_type, &JsValue::from_str("type"), &JsValue::from_str("password"))
            .unwrap();
        assert!(!focus_target_matches(&snapshot, &other_type));

        Reflect::set(&document, &JsValue::from_str("activeElement"), &JsValue::NULL).unwrap();
        assert!(capture_focus_snapshot(&root).is_none());
        Reflect::delete_property(&global, &JsValue::from_str("document")).unwrap();
    }

    #[wasm_bindgen_test(async)]
    async fn component_restore_focus_snapshot_runs_async_focus_and_selection_path() {
        let target = node("input");
        set_fn(&Object::from(target.clone()), "focus", "", "this.focused = true");
        let other = node("other");
        let document = Object::new();
        Reflect::set(&document, &JsValue::from_str("activeElement"), &other).unwrap();
        Reflect::set(&target, &JsValue::from_str("ownerDocument"), &document).unwrap();

        let snapshot = ReplaceFocusSnapshot {
            path: Vec::new(),
            tag_name: Some("INPUT".to_string()),
            input_type: Some("text".to_string()),
            selection_start: Some(2),
            selection_end: Some(7),
            selection_direction: Some("backward".to_string()),
        };
        restore_focus_snapshot(&snapshot, &target);
        JsFuture::from(Promise::resolve(&JsValue::UNDEFINED)).await.unwrap();

        assert_eq!(
            Reflect::get(&target, &JsValue::from_str("focused")).unwrap().as_bool(),
            Some(true)
        );
        assert_eq!(
            Reflect::get(&target, &JsValue::from_str("selectionStart")).unwrap().as_f64(),
            Some(2.0)
        );
        assert_eq!(
            Reflect::get(&target, &JsValue::from_str("selectionEnd")).unwrap().as_f64(),
            Some(7.0)
        );
        assert_eq!(
            Reflect::get(&target, &JsValue::from_str("selectionDirection")).unwrap().as_string(),
            Some("backward".to_string())
        );
    }

    #[wasm_bindgen_test]
    fn component_active_composition_helper_covers_missing_false_and_true_paths() {
        let global = js_sys::global();
        Reflect::delete_property(&global, &JsValue::from_str("document")).unwrap();
        let root = node("div");
        assert!(!has_active_composing_descendant(&root));

        let active = node("input");
        let document = Object::new();
        Reflect::set(&document, &JsValue::from_str("activeElement"), &active).unwrap();
        Reflect::set(&global, &JsValue::from_str("document"), &document).unwrap();
        assert!(!has_active_composing_descendant(&root));

        let root_obj = Object::from(root.clone());
        set_fn(&root_obj, "contains", "node", "return false");
        assert!(!has_active_composing_descendant(&root));

        set_fn(&root_obj, "contains", "node", "return true");
        assert!(!has_active_composing_descendant(&root));

        Reflect::set(&active, &JsValue::from_str("__rue_is_composing__"), &JsValue::TRUE).unwrap();
        assert!(has_active_composing_descendant(&root));
        Reflect::delete_property(&global, &JsValue::from_str("document")).unwrap();
    }

    #[wasm_bindgen_test(async)]
    async fn component_helpers_cover_null_children_empty_arrays_and_restore_noop() {
        let child_nodes_root = Object::new();
        Reflect::set(&child_nodes_root, &JsValue::from_str("children"), &JsValue::NULL).unwrap();
        Reflect::set(&child_nodes_root, &JsValue::from_str("childNodes"), &Array::new().into())
            .unwrap();
        assert!(child_values(&child_nodes_root.into()).is_empty());

        let empty_children = Object::new();
        Reflect::set(&empty_children, &JsValue::from_str("children"), &Array::new().into())
            .unwrap();
        assert!(child_values(&empty_children.into()).is_empty());

        assert!(child_values(&Object::new().into()).is_empty());

        let target = node("input");
        let document = Object::new();
        Reflect::set(&document, &JsValue::from_str("activeElement"), &target).unwrap();
        Reflect::set(&target, &JsValue::from_str("ownerDocument"), &document).unwrap();
        let snapshot = ReplaceFocusSnapshot {
            path: Vec::new(),
            tag_name: None,
            input_type: None,
            selection_start: None,
            selection_end: None,
            selection_direction: None,
        };

        restore_focus_snapshot(&snapshot, &target);
        JsFuture::from(Promise::resolve(&JsValue::UNDEFINED)).await.unwrap();
        assert!(Reflect::get(&target, &JsValue::from_str("focused")).unwrap().is_undefined());
    }

    #[wasm_bindgen_test]
    fn component_prepare_instance_covers_new_missing_and_primitive_host_paths() {
        let mut rue = Rue::<JsDomAdapter>::new();
        let render = Function::new_no_args("return null");
        let input = component_input(&render);

        let (_props_ro, host, idx) = rue.comp_prepare_instance(None, &input);
        assert_eq!(idx, 0);
        assert!(host.is_object());
        assert!(rue.instance_store.contains_key(&idx));
        rue.comp_finalize();

        if let Some(inst) = rue.instance_store.get_mut(&idx) {
            inst.host = JsValue::from_str("primitive-host");
        }
        let (_props_ro, host, reused_idx) = rue.comp_prepare_instance(Some(idx), &input);
        assert_eq!(reused_idx, idx);
        assert!(host.is_object());
        rue.comp_finalize();

        let (_props_ro, _host, missing_idx) = rue.comp_prepare_instance(Some(99), &input);
        assert_eq!(missing_idx, 99);
        assert!(!rue.instance_store.contains_key(&missing_idx));
        rue.comp_finalize();
    }

    #[wasm_bindgen_test]
    fn component_execute_collect_skips_pending_merge_when_stack_instance_is_missing() {
        take_pending_hooks();
        let mut rue = Rue::<JsDomAdapter>::new();
        let render = Function::new_no_args("return 'host-value'");
        let input = component_input(&render);
        let (props_ro, host, idx) = rue.comp_prepare_instance(None, &input);
        rue.instance_store.remove(&idx);
        push_pending_hook("updated", Function::new_no_args("return").into());

        let ret = rue.comp_execute_and_collect(&render.clone().into(), &props_ro, &host, idx, None);

        assert_eq!(ret.as_string().as_deref(), Some("host-value"));
        assert!(take_pending_hooks().is_empty());
        rue.comp_finalize();
    }

    #[wasm_bindgen_test]
    #[should_panic]
    fn component_execute_error_restores_missing_parent_instance_to_undefined() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.instance_stack.push(404);
        let render_ok = Function::new_no_args("return null");
        let input = component_input(&render_ok);
        let (props_ro, host, idx) = rue.comp_prepare_instance(None, &input);
        let render_throw =
            Function::new_no_args("throw new Error('component patch missing parent')");

        let _ = rue.comp_execute_and_collect(&render_throw.into(), &props_ro, &host, idx, None);
    }

    #[wasm_bindgen_test]
    fn component_mount_or_patch_subtree_covers_empty_snapshot_reinsert_paths() {
        let global = js_sys::global();
        Reflect::set(
            &global,
            &JsValue::from_str("__rue_debug_component_patch_enabled__"),
            &JsValue::TRUE,
        )
        .unwrap();
        Reflect::delete_property(&global, &JsValue::from_str("__rue_debug_component_patch__"))
            .unwrap();

        let (adapter, adapter_js) = make_adapter();
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter);

        let mut parent: JsValue = call_adapter0(&adapter_js, "createDocumentFragment");
        let old_el = node("div");
        Reflect::set(
            &old_el,
            &JsValue::from_str("className"),
            &JsValue::from_str("sidebar-playground old"),
        )
        .unwrap();
        let anchor = call_adapter1(&adapter_js, "createElement", &JsValue::from_str("anchor"));
        append_child(&adapter_js, &parent, &old_el);
        append_child(&adapter_js, &parent, &anchor);
        rue.current_anchor = Some(anchor.clone());

        let render = Function::new_no_args("return null");
        let mut old = MountedPatchSubtree::new_component(
            render.clone().into(),
            Some(old_el.clone()),
            None,
            Vec::new(),
            Vec::new(),
            Vec::new(),
            Vec::new(),
            Vec::new(),
            None,
            Some(7),
        );

        let mounted = rue.comp_mount_or_patch_subtree(&mut old, &mut parent, text_input("fresh"));
        assert!(mounted.is_some());
        let records = Array::from(
            &Reflect::get(&global, &JsValue::from_str("__rue_debug_component_patch__")).unwrap(),
        );
        assert!(records.length() >= 1);

        let detached_anchor =
            call_adapter1(&adapter_js, "createElement", &JsValue::from_str("detached"));
        let mut parent_missing_anchor = call_adapter0(&adapter_js, "createDocumentFragment");
        let old_missing_anchor = node("div");
        append_child(&adapter_js, &parent_missing_anchor, &old_missing_anchor);
        rue.current_anchor = Some(detached_anchor);
        let mut old = MountedPatchSubtree::new_component(
            render.clone().into(),
            Some(old_missing_anchor),
            None,
            Vec::new(),
            Vec::new(),
            Vec::new(),
            Vec::new(),
            Vec::new(),
            None,
            None,
        );
        assert!(
            rue.comp_mount_or_patch_subtree(
                &mut old,
                &mut parent_missing_anchor,
                text_input("append")
            )
            .is_some()
        );

        let mut parent_no_anchor = call_adapter0(&adapter_js, "createDocumentFragment");
        let old_no_anchor = node("div");
        append_child(&adapter_js, &parent_no_anchor, &old_no_anchor);
        rue.current_anchor = None;
        let mut old = MountedPatchSubtree::new_component(
            render.into(),
            Some(old_no_anchor),
            None,
            Vec::new(),
            Vec::new(),
            Vec::new(),
            Vec::new(),
            Vec::new(),
            None,
            None,
        );
        assert!(
            rue.comp_mount_or_patch_subtree(&mut old, &mut parent_no_anchor, text_input("tail"))
                .is_some()
        );

        let mut rue_without_adapter = Rue::<JsDomAdapter>::new();
        let mut parent_without_adapter = Object::new().into();
        let mut old_without_adapter = MountedPatchSubtree::new_component(
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
        assert!(
            rue_without_adapter
                .comp_mount_or_patch_subtree(
                    &mut old_without_adapter,
                    &mut parent_without_adapter,
                    text_input("none"),
                )
                .is_none()
        );

        Reflect::delete_property(&global, &JsValue::from_str("__rue_debug_component_patch__"))
            .unwrap();
        Reflect::delete_property(
            &global,
            &JsValue::from_str("__rue_debug_component_patch_enabled__"),
        )
        .unwrap();
    }

    #[wasm_bindgen_test]
    #[should_panic]
    fn patch_component_same_panics_when_new_input_is_not_component() {
        let mut rue = Rue::<JsDomAdapter>::new();
        let mut parent = Object::new().into();
        let render = Function::new_no_args("return null");
        let mut old = MountedPatchSubtree::new_component(
            render.into(),
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

        rue.patch_component_same(&mut old, &text_input("wrong"), &mut parent);
    }

    #[wasm_bindgen_test]
    fn component_prepare_instance_accepts_manually_seeded_instance() {
        let mut rue = Rue::<JsDomAdapter>::new();
        let props_ro = Object::new();
        let host = Object::new();
        let idx = 3;
        rue.instance_store.insert(
            idx,
            ComponentInternalInstance::<JsDomAdapter> {
                parent: None,
                is_mounted: false,
                hooks: LifecycleHooks(std::collections::HashMap::new()),
                props_ro: props_ro.clone().into(),
                host: host.clone().into(),
                render_scope_id: None,
                error: None,
                error_handlers: Vec::new(),
                index: idx,
                _marker: std::marker::PhantomData,
            },
        );
        let render = Function::new_no_args("return null");
        let (_props_ro, reused_host, reused_idx) =
            rue.comp_prepare_instance(Some(idx), &component_input(&render));

        assert_eq!(reused_idx, idx);
        assert!(Object::is(&reused_host.into(), &host.into()));
        rue.comp_finalize();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use js_sys::{Array, Function, Object, Promise, Reflect};
    use wasm_bindgen_futures::JsFuture;
    use wasm_bindgen_test::*;

    fn set_fn(obj: &Object, name: &str, args: &str, body: &str) {
        let _ = Reflect::set(
            obj,
            &JsValue::from_str(name),
            &Function::new_with_args(args, body).into(),
        );
    }

    fn node(tag: &str) -> JsValue {
        let obj = Object::new();
        Reflect::set(&obj, &JsValue::from_str("tag"), &JsValue::from_str(tag)).unwrap();
        Reflect::set(&obj, &JsValue::from_str("tagName"), &JsValue::from_str(&tag.to_uppercase()))
            .unwrap();
        Reflect::set(&obj, &JsValue::from_str("children"), &Array::new().into()).unwrap();
        obj.into()
    }

    #[wasm_bindgen_test]
    fn component_debug_record_appends_only_when_enabled() {
        let global = js_sys::global();
        Reflect::delete_property(&global, &JsValue::from_str("__rue_debug_component_patch__"))
            .unwrap();
        Reflect::set(
            &global,
            &JsValue::from_str("__rue_debug_component_patch_enabled__"),
            &JsValue::FALSE,
        )
        .unwrap();

        debug_record_component_patch(&Object::new());
        assert!(
            Reflect::get(&global, &JsValue::from_str("__rue_debug_component_patch__"))
                .unwrap_or(JsValue::UNDEFINED)
                .is_undefined()
        );

        let existing = Array::new();
        existing.push(&JsValue::from_str("seed"));
        Reflect::set(
            &global,
            &JsValue::from_str("__rue_debug_component_patch__"),
            &existing.into(),
        )
        .unwrap();
        Reflect::set(
            &global,
            &JsValue::from_str("__rue_debug_component_patch_enabled__"),
            &JsValue::TRUE,
        )
        .unwrap();
        let record = Object::new();
        Reflect::set(&record, &JsValue::from_str("kind"), &JsValue::from_str("component")).unwrap();

        debug_record_component_patch(&record);

        let records = Array::from(
            &Reflect::get(&global, &JsValue::from_str("__rue_debug_component_patch__")).unwrap(),
        );
        assert_eq!(records.length(), 2);
        assert_eq!(records.get(0).as_string().as_deref(), Some("seed"));
        assert_eq!(
            Reflect::get(&records.get(1), &JsValue::from_str("kind"))
                .unwrap()
                .as_string()
                .as_deref(),
            Some("component")
        );

        Reflect::delete_property(&global, &JsValue::from_str("__rue_debug_component_patch__"))
            .unwrap();
        Reflect::delete_property(
            &global,
            &JsValue::from_str("__rue_debug_component_patch_enabled__"),
        )
        .unwrap();
    }

    #[wasm_bindgen_test(async)]
    async fn component_focus_helpers_cover_empty_child_nodes_and_restore() {
        let no_collection = Object::new();
        Reflect::set(
            &no_collection,
            &JsValue::from_str("children"),
            &JsValue::from_str("not-array-like"),
        )
        .unwrap();
        assert!(child_values(&no_collection.into()).is_empty());

        let input = node("input");
        Reflect::set(&input, &JsValue::from_str("type"), &JsValue::from_str("text")).unwrap();
        let root = Object::new();
        let child_nodes = Array::new();
        child_nodes.push(&JsValue::NULL);
        child_nodes.push(&input);
        Reflect::set(&root, &JsValue::from_str("childNodes"), &child_nodes.into()).unwrap();
        assert_eq!(child_values(&root.clone().into()).len(), 1);
        assert_eq!(find_descendant_path(&root.clone().into(), &input), Some(vec![0]));
        assert!(descendant_by_path(&root.clone().into(), &[0]).is_some());
        assert!(descendant_by_path(&root.clone().into(), &[1]).is_none());

        let document = Object::new();
        Reflect::set(&document, &JsValue::from_str("activeElement"), &input).unwrap();
        let global = js_sys::global();
        Reflect::set(&global, &JsValue::from_str("document"), &document).unwrap();
        Reflect::set(&input, &JsValue::from_str("selectionStart"), &JsValue::from_f64(1.0))
            .unwrap();
        Reflect::set(&input, &JsValue::from_str("selectionEnd"), &JsValue::from_f64(2.0)).unwrap();
        Reflect::set(
            &input,
            &JsValue::from_str("selectionDirection"),
            &JsValue::from_str("forward"),
        )
        .unwrap();

        let snapshot = capture_focus_snapshot(&root.clone().into()).unwrap();
        assert!(focus_target_matches(&snapshot, &input));
        let select = node("select");
        assert!(!focus_target_matches(&snapshot, &select));

        let target = node("input");
        Reflect::set(&target, &JsValue::from_str("type"), &JsValue::from_str("text")).unwrap();
        Reflect::set(&target, &JsValue::from_str("ownerDocument"), &document).unwrap();
        set_fn(&Object::from(target.clone()), "focus", "", "this.focused = true");
        Reflect::set(&document, &JsValue::from_str("activeElement"), &select).unwrap();
        restore_focus_snapshot(&snapshot, &target);
        JsFuture::from(Promise::resolve(&JsValue::UNDEFINED)).await.unwrap();

        assert_eq!(
            Reflect::get(&target, &JsValue::from_str("selectionStart")).unwrap().as_f64(),
            Some(1.0)
        );
        assert_eq!(
            Reflect::get(&target, &JsValue::from_str("selectionEnd")).unwrap().as_f64(),
            Some(2.0)
        );
        assert_eq!(
            Reflect::get(&target, &JsValue::from_str("selectionDirection"))
                .unwrap()
                .as_string()
                .as_deref(),
            Some("forward")
        );
        assert_eq!(
            Reflect::get(&target, &JsValue::from_str("focused")).unwrap().as_bool(),
            Some(true)
        );

        Reflect::delete_property(&global, &JsValue::from_str("document")).unwrap();
        assert!(active_element().is_none());
    }
}
