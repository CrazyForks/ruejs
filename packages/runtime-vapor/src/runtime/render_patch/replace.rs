/*
整树替换 patch

当 key/type 改变或无法同类更新时，创建新子树并替换旧 DOM。
这里额外保存/恢复焦点与输入选择区间，避免用户正在输入时因替换丢失光标状态。
*/
use super::super::Rue;
use super::super::types::{MountInput, MountedPatchSubtree, MountedSubtreeState};
use crate::runtime::dom_adapter::DomAdapter;
#[cfg(any(feature = "dev", test))]
use js_sys::Array;
use js_sys::{Function, Object, Promise, Reflect};
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use wasm_bindgen::closure::Closure;

const RUE_HYDRATED_ADOPTED_NODE: &str = "__rue_hydrated_adopted";

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

fn js_bool_prop(value: &JsValue, name: &str) -> bool {
    js_prop(value, name).as_bool().unwrap_or(false)
}

fn is_hydrated_adopted_host(value: &JsValue) -> bool {
    js_bool_prop(value, RUE_HYDRATED_ADOPTED_NODE)
}

fn try_adopt_hydrated_replacement<A: DomAdapter>(
    adapter: &mut A,
    parent: &mut A::Element,
    old_host: &A::Element,
    new_el: &A::Element,
) -> bool
where
    A::Element: Clone + Into<JsValue>,
{
    let old_js: JsValue = old_host.clone().into();
    if !is_hydrated_adopted_host(&old_js) {
        return false;
    }

    let new_js: JsValue = new_el.clone().into();
    if normalized_tag_name(&old_js) != normalized_tag_name(&new_js) {
        return false;
    }
    if !adapter.contains(parent, old_host) {
        return false;
    }

    adapter.insert_before(parent, new_el, old_host);
    let mut p2 = parent.clone();
    adapter.remove_child(&mut p2, old_host);
    true
}

fn replace_mounted_root_host<A: DomAdapter>(
    mounted: &mut MountedSubtreeState<A>,
    host: &A::Element,
) where
    A::Element: Clone,
{
    match mounted {
        MountedSubtreeState::Text(text) => {
            text.host = Some(host.clone());
        }
        MountedSubtreeState::Vapor(vapor) => {
            vapor.host = Some(host.clone());
            vapor.fragment_nodes.clear();
        }
        MountedSubtreeState::Patch(node) => {
            node.el = Some(host.clone());
            node.fragment_nodes.clear();
            if let Some(subtree) = node.comp_subtree.as_deref_mut() {
                replace_mounted_root_host(subtree, host);
            }
        }
    }
}

#[cfg(any(feature = "dev", test))]
#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
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

#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
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

#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
fn find_descendant_path(root: &JsValue, target: &JsValue) -> Option<Vec<u32>> {
    if Object::is(root, target) {
        return Some(Vec::new());
    }

    // 用“子节点索引路径”记录焦点位置，而不是保存旧 DOM 引用。
    // 替换后旧引用会失效，但同构的新 DOM 可通过路径重新定位。
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
        // 等到本轮 DOM 替换完成后的微任务再恢复焦点，避免 focus 落到尚未插入的节点。
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
        // 先在新子树中找到可恢复焦点的目标，后续无论走 insert/remove 还是 fragment 插入都能复用。
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
                        // 旧节点仍在父节点内：优先在旧节点前插入新节点，再移除旧节点。
                        // 这个顺序比先删再插更容易保持 anchor/selection 的稳定。
                        #[cfg(any(feature = "dev", test))]
                        {
                            let parent_js: JsValue = parent.clone().into();
                            let old_host_js: JsValue = el_old.clone().into();
                            let new_host_js: JsValue = new_el.clone().into();
                            debug_record_sidebar_replace(
                                "replace_vapor_like",
                                &parent_js,
                                &old_host_js,
                                &new_host_js,
                            );
                        }
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
                // 新节点是 Fragment 时不能直接插入 fragment host；要展开并插入其 children。
                self.insert_fragment_children_preferring_end(parent, new_el, insert_anchor);
            } else {
                self.insert_with_end_anchor_opt(parent, new_el, insert_anchor);
            }
        }
        if let (Some(snapshot), Some(target)) = (focus_snapshot.as_ref(), focus_target.as_ref()) {
            restore_focus_snapshot(snapshot, target);
        }
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
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
        let focus_snapshot = old.el.as_ref().and_then(|host| {
            let host_js: JsValue = host.clone().into();
            capture_focus_snapshot(&host_js)
        });
        // 组件替换也要保留焦点，尤其是同位置表单控件被重建时。
        let focus_target = focus_snapshot.as_ref().and_then(|snapshot| {
            let new_root: JsValue = new_el.clone().into();
            descendant_by_path(&new_root, &snapshot.path)
                .filter(|target| focus_target_matches(snapshot, target))
        });
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
                    // 组件旧根存在而新根是 Fragment：先解析真实父级，再清掉旧根/命名区间。
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
                    if let (Some(snapshot), Some(target)) =
                        (focus_snapshot.as_ref(), focus_target.as_ref())
                    {
                        restore_focus_snapshot(snapshot, target);
                    }
                } else {
                    self.clear_current_named_range_if_present(dest_parent);
                    self.insert_fragment_children_preferring_end(
                        dest_parent,
                        new_el,
                        insert_anchor,
                    );
                    if let (Some(snapshot), Some(target)) =
                        (focus_snapshot.as_ref(), focus_target.as_ref())
                    {
                        restore_focus_snapshot(snapshot, target);
                    }
                }
            } else {
                let effective_anchor = self.current_anchor.clone().or(insert_anchor.clone());
                let mut real_parent =
                    self.resolve_dest_parent(dest_parent, old.el.clone(), effective_anchor.clone());

                if !cleared {
                    if let Some(adapter2) = self.get_dom_adapter_mut() {
                        if let Some(ref el_old) = old.el {
                            if adapter2.contains(&real_parent, el_old) {
                                // 普通元素替换优先用“新插旧前 + 删除旧节点”，保留父级 DOM 顺序。
                                #[cfg(any(feature = "dev", test))]
                                {
                                    let parent_js: JsValue = real_parent.clone().into();
                                    let old_host_js: JsValue = el_old.clone().into();
                                    let new_host_js: JsValue = new_el.clone().into();
                                    debug_record_sidebar_replace(
                                        "replace_component",
                                        &parent_js,
                                        &old_host_js,
                                        &new_host_js,
                                    );
                                }
                                adapter2.insert_before(&mut real_parent, new_el, el_old);
                                let mut p2 = real_parent.clone();
                                adapter2.remove_child(&mut p2, el_old);
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
                self.insert_with_end_anchor_opt(&mut real_parent, new_el, &effective_anchor);
                if let Some(ref el_old) = old.el {
                    self.clear_old_el_if_present(&mut real_parent, el_old);
                }
                if let (Some(snapshot), Some(target)) =
                    (focus_snapshot.as_ref(), focus_target.as_ref())
                {
                    restore_focus_snapshot(snapshot, target);
                }
            }
        }
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub(super) fn replace_non_fragment_with_fallback(
        &mut self,
        old_host: Option<&A::Element>,
        new_el: &A::Element,
        dest_parent: &mut A::Element,
    ) {
        if let Some(adapter) = self.get_dom_adapter_mut() {
            if let Some(el_old) = old_host {
                if adapter.contains(dest_parent, el_old) {
                    // 正常路径：旧节点仍在目标父级内，直接以旧节点为 anchor 替换。
                    adapter.insert_before(dest_parent, new_el, el_old);
                    let mut p2 = dest_parent.clone();
                    adapter.remove_child(&mut p2, el_old);
                } else {
                    // 兜底路径：旧 host 已不在父级内，清空父级 fragment children 后追加新节点。
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

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
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
        // 替换前先执行 before_unmount，确保旧子树的 effect/cleanup 在新子树创建前释放。
        self.invoke_before_unmount_record(&lifecycle);
        if eager_unmounted {
            // Vapor host 可能携带外部创建的节点；先清理其 fragment nodes 并立即发 unmounted，
            // 避免旧 Vapor effect 与新挂载交错运行。
            let anchor_opt = self.current_anchor.clone();
            let mut preclear_parent =
                self.resolve_dest_parent(parent, old.host_cloned(), anchor_opt.clone());
            self.clear_fragment_nodes(&mut preclear_parent, old.fragment_nodes());
            self.invoke_unmounted_record(&lifecycle);
        }
        if let Some(mounted) = self.mount_from_input(new, Some(parent)) {
            let Some(el_new) = mounted.host_cloned() else {
                // 某些 mounted snapshot 可能没有单一 host（例如空片段），此时只更新状态。
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
            // 根据旧 snapshot 类型选择替换策略：Vapor/Component/Text 的 DOM 定位信息不同。
            if let Some(old_host) = old.host_cloned() {
                if let Some(adapter) = self.get_dom_adapter_mut() {
                    if try_adopt_hydrated_replacement(
                        adapter,
                        &mut dest_parent,
                        &old_host,
                        &el_new,
                    ) {
                        let mut next_mounted = mounted;
                        replace_mounted_root_host(&mut next_mounted, &old_host);
                        *old = next_mounted;
                        return;
                    }
                }
            }
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
            *old = mounted;
        }
        if !eager_unmounted {
            self.invoke_unmounted_record(&lifecycle);
        }
    }
}

#[cfg(test)]
#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
mod tests {
    use super::*;
    use crate::runtime::js_adapter::JsDomAdapter;
    use crate::runtime::types::{
        ComponentProps, MountInputType, MountedTextSubtree, MountedVaporSubtree,
        MountedVaporSubtreeType,
    };
    use js_sys::{Array, Function, Object, Promise, Reflect};
    use wasm_bindgen_futures::JsFuture;
    use wasm_bindgen_test::*;

    fn set_prop(target: &Object, key: &str, value: &JsValue) {
        Reflect::set(target, &JsValue::from_str(key), value).unwrap();
    }

    fn set_fn(target: &Object, key: &str, args: &str, body: &str) {
        set_prop(target, key, &Function::new_with_args(args, body).into());
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
            "p.children = p.children || []; p.children.push(c); if (c) c.parentNode = p",
        );
        set_fn(
            &obj,
            "insertBefore",
            "p,c,b",
            "p.children = p.children || []; const idx = p.children.indexOf(b); \
             const at = idx >= 0 ? idx : p.children.length; p.children.splice(at, 0, c); \
             if (c) c.parentNode = p",
        );
        set_fn(
            &obj,
            "removeChild",
            "p,c",
            "p.children = (p.children || []).filter(x => x !== c); if (c) c.parentNode = null",
        );
        set_fn(
            &obj,
            "contains",
            "p,c",
            "function has(root,node){ return root === node || Array.from(root && root.children || []).some(ch => has(ch,node)); } return has(p,c)",
        );
        set_fn(&obj, "setClassName", "el,v", "el.className = v");
        set_fn(&obj, "patchStyle", "el,old,next", "return");
        set_fn(&obj, "setInnerHTML", "el,html", "el.children = []; el.text = html");
        set_fn(&obj, "setValue", "el,v", "el.value = v");
        set_fn(&obj, "setChecked", "el,b", "el.checked = !!b");
        set_fn(&obj, "setDisabled", "el,b", "el.disabled = !!b");
        set_fn(&obj, "clearRef", "r", "return");
        set_fn(&obj, "applyRef", "el,r", "return");
        set_fn(&obj, "setAttribute", "el,k,v", "el.attrs = el.attrs || {}; el.attrs[k] = v");
        set_fn(&obj, "removeAttribute", "el,k", "if (el.attrs) delete el.attrs[k]");
        set_fn(&obj, "getTagName", "el", "return el.tag || ''");
        set_fn(&obj, "addEventListener", "el,evt,h", "return");
        set_fn(&obj, "removeEventListener", "el,evt,h", "return");
        set_fn(&obj, "hasValueProperty", "el", "return 'value' in el");
        set_fn(&obj, "isSelectMultiple", "el", "return !!el && !!el.multiple");
        set_fn(&obj, "querySelector", "sel", "return null");
        JsDomAdapter::new(obj.into())
    }

    fn host(tag: &str) -> Object {
        let node = Object::new();
        set_prop(&node, "tag", &JsValue::from_str(tag));
        set_prop(&node, "tagName", &JsValue::from_str(&tag.to_ascii_uppercase()));
        set_prop(&node, "children", &Array::new().into());
        node
    }

    fn node(tag: &str) -> JsValue {
        host(tag).into()
    }

    fn set_children(parent: &JsValue, children: &[JsValue]) {
        let arr = Array::new();
        for (index, child) in children.iter().enumerate() {
            let previous = if index == 0 { JsValue::NULL } else { children[index - 1].clone() };
            let next = children.get(index + 1).cloned().unwrap_or(JsValue::NULL);
            arr.push(child);
            Reflect::set(child, &JsValue::from_str("parentNode"), parent).unwrap();
            Reflect::set(child, &JsValue::from_str("previousSibling"), &previous).unwrap();
            Reflect::set(child, &JsValue::from_str("nextSibling"), &next).unwrap();
        }
        Reflect::set(parent, &JsValue::from_str("children"), &arr.into()).unwrap();
    }

    fn child_tags(parent: &JsValue) -> Vec<String> {
        let children =
            Reflect::get(parent, &JsValue::from_str("children")).unwrap_or(Array::new().into());
        Array::from(&children)
            .iter()
            .map(|child| {
                Reflect::get(&child, &JsValue::from_str("tag"))
                    .unwrap_or(JsValue::UNDEFINED)
                    .as_string()
                    .unwrap_or_default()
            })
            .collect()
    }

    fn component_patch_without_el() -> MountedPatchSubtree<JsDomAdapter> {
        MountedPatchSubtree::new_component(
            Function::new_no_args("return null;").into(),
            None,
            None,
            Vec::new(),
            Vec::new(),
            Vec::new(),
            Vec::new(),
            Vec::new(),
            None,
            None,
        )
    }

    async fn tick() {
        JsFuture::from(Promise::resolve(&JsValue::UNDEFINED)).await.unwrap();
    }

    #[wasm_bindgen_test]
    fn focus_snapshot_helpers_find_descendant_paths_and_match_input_shape() {
        let root = host("section");
        let child = host("input");
        set_prop(&child, "type", &JsValue::from_str("text"));
        let children = Array::new();
        children.push(&child);
        set_prop(&root, "children", &children.into());

        let path = find_descendant_path(&root.clone().into(), &child.clone().into()).unwrap();
        assert_eq!(path, vec![0]);
        assert!(js_sys::Object::is(
            &descendant_by_path(&root.clone().into(), &path).unwrap(),
            &child.clone().into()
        ));
        assert!(descendant_by_path(&root.clone().into(), &[1]).is_none());

        let snapshot = ReplaceFocusSnapshot {
            path,
            tag_name: Some("INPUT".to_string()),
            input_type: Some("text".to_string()),
            selection_start: Some(1),
            selection_end: Some(2),
            selection_direction: Some("forward".to_string()),
        };
        assert!(focus_target_matches(&snapshot, &child.clone().into()));

        let wrong_type = host("input");
        set_prop(&wrong_type, "type", &JsValue::from_str("password"));
        assert!(!focus_target_matches(&snapshot, &wrong_type.into()));

        let wrong_tag = host("textarea");
        set_prop(&wrong_tag, "type", &JsValue::from_str("text"));
        assert!(!focus_target_matches(&snapshot, &wrong_tag.into()));
    }

    #[wasm_bindgen_test]
    fn child_values_covers_nullish_child_nodes_and_non_array_collections() {
        let root = Object::new();
        set_prop(&root, "children", &JsValue::NULL);
        let child_nodes = Array::new();
        let child = host("span");
        child_nodes.push(&JsValue::UNDEFINED);
        child_nodes.push(&JsValue::NULL);
        child_nodes.push(&child);
        set_prop(&root, "childNodes", &child_nodes.into());
        assert_eq!(child_values(&root.clone().into()).len(), 1);

        let non_array_children = Object::new();
        let no_length_root = Object::new();
        set_prop(&no_length_root, "children", &non_array_children.into());
        assert!(child_values(&no_length_root.into()).is_empty());

        assert!(child_values(&Object::new().into()).is_empty());
    }

    #[wasm_bindgen_test]
    fn helper_edges_cover_debug_records_missing_paths_and_inactive_document() {
        let parent = host("parent");
        set_prop(&parent, "className", &JsValue::from_str("parent-class"));
        let old_host = host("old");
        set_prop(&old_host, "className", &JsValue::from_str("sidebar-playground old"));
        let new_host = host("new");
        set_prop(&new_host, "className", &JsValue::from_str("new-class"));

        let global = js_sys::global();
        Reflect::delete_property(&global, &JsValue::from_str("__rue_debug_component_patch__"))
            .unwrap();
        Reflect::set(
            &global,
            &JsValue::from_str("__rue_debug_component_patch_enabled__"),
            &JsValue::FALSE,
        )
        .unwrap();
        debug_record_sidebar_replace(
            "disabled",
            &parent.clone().into(),
            &old_host.clone().into(),
            &new_host.clone().into(),
        );
        assert!(
            Reflect::get(&global, &JsValue::from_str("__rue_debug_component_patch__"))
                .unwrap_or(JsValue::UNDEFINED)
                .is_undefined()
        );

        Reflect::set(
            &global,
            &JsValue::from_str("__rue_debug_component_patch_enabled__"),
            &JsValue::TRUE,
        )
        .unwrap();
        debug_record_sidebar_replace(
            "enabled",
            &parent.clone().into(),
            &old_host.clone().into(),
            &new_host.clone().into(),
        );
        let records = Array::from(
            &Reflect::get(&global, &JsValue::from_str("__rue_debug_component_patch__")).unwrap(),
        );
        assert_eq!(records.length(), 1);
        assert_eq!(
            Reflect::get(&records.get(0), &JsValue::from_str("kind"))
                .unwrap()
                .as_string()
                .as_deref(),
            Some("enabled")
        );

        let root = host("root");
        let missing = host("missing");
        assert!(find_descendant_path(&root.into(), &missing.into()).is_none());

        let document = Object::new();
        set_prop(&document, "activeElement", &JsValue::UNDEFINED);
        Reflect::set(&global, &JsValue::from_str("document"), &document.into()).unwrap();
        assert!(active_element().is_none());

        let outside_active_document = Object::new();
        let outside_active = host("input");
        let empty_root = host("empty-root");
        set_prop(&outside_active_document, "activeElement", &outside_active.into());
        Reflect::set(&global, &JsValue::from_str("document"), &outside_active_document.into())
            .unwrap();
        assert!(capture_focus_snapshot(&empty_root.into()).is_none());

        let existing_records = Array::new();
        Reflect::set(
            &global,
            &JsValue::from_str("__rue_debug_component_patch__"),
            &existing_records.clone().into(),
        )
        .unwrap();
        Reflect::set(
            &global,
            &JsValue::from_str("__rue_debug_component_patch_enabled__"),
            &JsValue::TRUE,
        )
        .unwrap();
        debug_record_sidebar_replace(
            "existing-array",
            &parent.clone().into(),
            &old_host.clone().into(),
            &new_host.clone().into(),
        );
        let records_value =
            Reflect::get(&global, &JsValue::from_str("__rue_debug_component_patch__")).unwrap();
        let records_after_reuse = Array::from(&records_value);
        assert!(Array::is_array(&records_value));
        assert_eq!(records_after_reuse.length(), 1);

        Reflect::delete_property(&global, &JsValue::from_str("__rue_debug_component_patch__"))
            .unwrap();
        Reflect::delete_property(
            &global,
            &JsValue::from_str("__rue_debug_component_patch_enabled__"),
        )
        .unwrap();
        Reflect::delete_property(&global, &JsValue::from_str("document")).unwrap();
    }

    #[wasm_bindgen_test(async)]
    async fn capture_and_restore_focus_snapshot_preserves_selection_on_matching_new_target() {
        let document = Object::new();
        let root = host("section");
        let active = host("input");
        set_prop(&active, "type", &JsValue::from_str("text"));
        set_prop(&active, "selectionStart", &JsValue::from_f64(3.0));
        set_prop(&active, "selectionEnd", &JsValue::from_f64(5.0));
        set_prop(&active, "selectionDirection", &JsValue::from_str("backward"));
        set_prop(&active, "ownerDocument", &document.clone().into());
        set_prop(&document, "activeElement", &active.clone().into());
        set_prop(&js_sys::global(), "document", &document.clone().into());

        let children = Array::new();
        children.push(&active);
        set_prop(&root, "children", &children.into());
        let snapshot = capture_focus_snapshot(&root.clone().into()).unwrap();
        assert_eq!(snapshot.path, vec![0]);

        let new_target = host("input");
        set_prop(&new_target, "type", &JsValue::from_str("text"));
        set_prop(&new_target, "ownerDocument", &document.clone().into());
        set_prop(
            &new_target,
            "focus",
            &Function::new_no_args("this.ownerDocument.activeElement = this;").into(),
        );

        restore_focus_snapshot(&snapshot, &new_target.clone().into());
        tick().await;

        assert!(js_sys::Object::is(
            &Reflect::get(&document, &JsValue::from_str("activeElement")).unwrap(),
            &new_target.clone().into()
        ));
        assert_eq!(
            Reflect::get(&new_target, &JsValue::from_str("selectionStart")).unwrap().as_f64(),
            Some(3.0)
        );
        assert_eq!(
            Reflect::get(&new_target, &JsValue::from_str("selectionEnd")).unwrap().as_f64(),
            Some(5.0)
        );
        assert_eq!(
            Reflect::get(&new_target, &JsValue::from_str("selectionDirection"))
                .unwrap()
                .as_string()
                .as_deref(),
            Some("backward")
        );

        let already_active = host("input");
        set_prop(&already_active, "ownerDocument", &document.clone().into());
        set_prop(&document, "activeElement", &already_active.clone().into());
        restore_focus_snapshot(
            &ReplaceFocusSnapshot {
                path: Vec::new(),
                tag_name: None,
                input_type: None,
                selection_start: None,
                selection_end: None,
                selection_direction: None,
            },
            &already_active.into(),
        );
        tick().await;

        let missing_focus = host("input");
        set_prop(&missing_focus, "ownerDocument", &document.clone().into());
        restore_focus_snapshot(
            &ReplaceFocusSnapshot {
                path: Vec::new(),
                tag_name: None,
                input_type: None,
                selection_start: None,
                selection_end: None,
                selection_direction: None,
            },
            &missing_focus.into(),
        );
        tick().await;

        Reflect::delete_property(&js_sys::global(), &JsValue::from_str("document")).unwrap();
    }

    #[wasm_bindgen_test]
    fn replace_non_fragment_fallback_clears_stale_children_and_appends_without_old_host() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());

        let mut parent = node("parent");
        let stale_a = node("stale-a");
        let stale_b = node("stale-b");
        set_children(&parent, &[stale_a.clone(), stale_b.clone()]);
        let detached_old = node("old");
        let next = node("next");

        rue.replace_non_fragment_with_fallback(Some(&detached_old), &next, &mut parent);

        assert_eq!(child_tags(&parent), vec!["next"]);
        assert!(Reflect::get(&stale_a, &JsValue::from_str("parentNode")).unwrap().is_null());
        assert!(Reflect::get(&stale_b, &JsValue::from_str("parentNode")).unwrap().is_null());

        let mut empty_parent = node("empty-parent");
        let appended = node("appended");
        rue.replace_non_fragment_with_fallback(None, &appended, &mut empty_parent);
        assert_eq!(child_tags(&empty_parent), vec!["appended"]);
    }

    #[wasm_bindgen_test]
    fn replace_non_fragment_appends_when_old_host_is_absent() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());

        let mut parent = node("parent");
        let next = node("next");
        rue.replace_non_fragment_with_fallback(None, &next, &mut parent);

        assert_eq!(child_tags(&parent), vec!["next"]);
    }

    #[wasm_bindgen_test(async)]
    async fn replace_vapor_like_fallback_inserts_non_fragment_and_restores_focus() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());

        let mut parent = node("parent");
        let anchor = node("anchor");
        set_children(&parent, &[anchor.clone()]);

        let old_root = node("old-root");
        let old_input = node("input");
        set_prop(&Object::from(old_input.clone()), "type", &JsValue::from_str("text"));
        set_children(&old_root, &[old_input.clone()]);

        let document = Object::new();
        set_prop(&document, "activeElement", &old_input);
        set_prop(&js_sys::global(), "document", &document.clone().into());

        let new_root = node("section");
        let new_input = node("input");
        set_prop(&Object::from(new_input.clone()), "type", &JsValue::from_str("text"));
        set_prop(&Object::from(new_input.clone()), "ownerDocument", &document.clone().into());
        set_prop(
            &Object::from(new_input.clone()),
            "focus",
            &Function::new_no_args("this.ownerDocument.activeElement = this;").into(),
        );
        set_children(&new_root, &[new_input.clone()]);

        rue.replace_vapor_like(Some(&old_root), &[], &new_root, &mut parent, &Some(anchor.clone()));
        tick().await;

        assert_eq!(child_tags(&parent), vec!["section", "anchor"]);
        assert!(js_sys::Object::is(
            &Reflect::get(&document, &JsValue::from_str("activeElement")).unwrap(),
            &new_input
        ));
    }

    #[wasm_bindgen_test(async)]
    async fn replace_vapor_like_contained_old_host_restores_focus_before_return() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());

        let mut parent = node("parent");
        let old_root = node("old-root");
        let old_input = node("input");
        set_prop(&Object::from(old_input.clone()), "type", &JsValue::from_str("text"));
        set_children(&old_root, &[old_input.clone()]);
        set_children(&parent, &[old_root.clone()]);

        let document = Object::new();
        set_prop(&document, "activeElement", &old_input);
        set_prop(&js_sys::global(), "document", &document.clone().into());

        let new_root = node("section");
        let new_input = node("input");
        set_prop(&Object::from(new_input.clone()), "type", &JsValue::from_str("text"));
        set_prop(&Object::from(new_input.clone()), "ownerDocument", &document.clone().into());
        set_prop(
            &Object::from(new_input.clone()),
            "focus",
            &Function::new_no_args("this.ownerDocument.activeElement = this;").into(),
        );
        set_children(&new_root, &[new_input.clone()]);

        rue.replace_vapor_like(Some(&old_root), &[], &new_root, &mut parent, &None);
        tick().await;

        assert_eq!(child_tags(&parent), vec!["section"]);
        assert!(js_sys::Object::is(
            &Reflect::get(&document, &JsValue::from_str("activeElement")).unwrap(),
            &new_input
        ));
        Reflect::delete_property(&js_sys::global(), &JsValue::from_str("document")).unwrap();
    }

    #[wasm_bindgen_test]
    fn replace_vapor_like_inserts_non_fragment_without_old_host() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());

        let mut parent = node("parent");
        let anchor = node("anchor");
        set_children(&parent, &[anchor.clone()]);
        let next = node("next");

        rue.replace_vapor_like(None, &[], &next, &mut parent, &Some(anchor));

        assert_eq!(child_tags(&parent), vec!["next", "anchor"]);
    }

    #[wasm_bindgen_test]
    fn replace_vapor_like_expands_new_fragment_when_no_old_host_is_present() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());

        let mut parent = node("parent");
        let anchor = node("anchor");
        set_children(&parent, &[anchor.clone()]);

        let fragment = node("fragment");
        let first = node("first");
        let second = node("second");
        set_children(&fragment, &[first, second]);

        rue.replace_vapor_like(None, &[], &fragment, &mut parent, &Some(anchor));

        assert_eq!(child_tags(&parent), vec!["first", "second", "anchor"]);
    }

    #[wasm_bindgen_test]
    fn replace_vapor_like_clears_old_fragment_nodes_before_inserting_new_host() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());

        let mut parent = node("parent");
        let stale = node("stale");
        let anchor = node("anchor");
        set_children(&parent, &[stale.clone(), anchor.clone()]);
        let next = node("next");

        rue.replace_vapor_like(None, &[stale], &next, &mut parent, &Some(anchor));

        assert_eq!(child_tags(&parent), vec!["next", "anchor"]);
    }

    #[wasm_bindgen_test]
    fn replace_component_handles_missing_old_host_for_fragment_and_element_outputs() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let old = component_patch_without_el();

        let mut parent = node("parent");
        let anchor = node("anchor");
        set_children(&parent, &[anchor.clone()]);

        let fragment = node("fragment");
        let frag_child = node("frag-child");
        set_children(&fragment, &[frag_child]);
        let mut parent_for_component = parent.clone();
        rue.replace_component(
            &old,
            &fragment,
            &mut parent,
            &mut parent_for_component,
            &Some(anchor),
        );
        assert_eq!(child_tags(&parent), vec!["frag-child", "anchor"]);

        let mut second_parent = node("second-parent");
        let second_anchor = node("second-anchor");
        set_children(&second_parent, &[second_anchor.clone()]);
        let element = node("article");
        let mut second_parent_for_component = second_parent.clone();
        rue.replace_component(
            &old,
            &element,
            &mut second_parent,
            &mut second_parent_for_component,
            &Some(second_anchor),
        );
        assert_eq!(child_tags(&second_parent), vec!["article", "second-anchor"]);
    }

    #[wasm_bindgen_test(async)]
    async fn replace_component_contained_old_host_restores_focus_and_replaces_in_place() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());

        let mut parent = node("parent");
        let before = node("before");
        let old_root = node("old-root");
        let old_input = node("input");
        set_prop(&Object::from(old_input.clone()), "type", &JsValue::from_str("text"));
        set_children(&old_root, &[old_input.clone()]);
        let after = node("after");
        set_children(&parent, &[before.clone(), old_root.clone(), after.clone()]);

        let document = Object::new();
        set_prop(&document, "activeElement", &old_input);
        set_prop(&js_sys::global(), "document", &document.clone().into());

        let new_root = node("article");
        let new_input = node("input");
        set_prop(&Object::from(new_input.clone()), "type", &JsValue::from_str("text"));
        set_prop(&Object::from(new_input.clone()), "ownerDocument", &document.clone().into());
        set_prop(
            &Object::from(new_input.clone()),
            "focus",
            &Function::new_no_args("this.ownerDocument.activeElement = this;").into(),
        );
        set_children(&new_root, &[new_input.clone()]);

        let old = MountedPatchSubtree::new_component(
            Function::new_no_args("return null;").into(),
            Some(old_root.clone()),
            None,
            Vec::new(),
            Vec::new(),
            Vec::new(),
            Vec::new(),
            Vec::new(),
            None,
            None,
        );
        let mut parent_for_component = parent.clone();

        rue.replace_component(&old, &new_root, &mut parent, &mut parent_for_component, &None);
        tick().await;

        assert_eq!(child_tags(&parent), vec!["before", "article", "after"]);
        assert!(Reflect::get(&old_root, &JsValue::from_str("parentNode")).unwrap().is_null());
        assert!(js_sys::Object::is(
            &Reflect::get(&document, &JsValue::from_str("activeElement")).unwrap(),
            &new_input
        ));
        Reflect::delete_property(&js_sys::global(), &JsValue::from_str("document")).unwrap();
    }

    #[wasm_bindgen_test(async)]
    async fn replace_component_detached_old_host_uses_anchor_insert_and_focus_restore() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());

        let mut parent = node("parent");
        let anchor = node("anchor");
        set_children(&parent, &[anchor.clone()]);

        let old_root = node("old-root");
        let old_input = node("input");
        set_prop(&Object::from(old_input.clone()), "type", &JsValue::from_str("text"));
        set_children(&old_root, &[old_input.clone()]);

        let document = Object::new();
        set_prop(&document, "activeElement", &old_input);
        set_prop(&js_sys::global(), "document", &document.clone().into());

        let new_root = node("article");
        let new_input = node("input");
        set_prop(&Object::from(new_input.clone()), "type", &JsValue::from_str("text"));
        set_prop(&Object::from(new_input.clone()), "ownerDocument", &document.clone().into());
        set_prop(
            &Object::from(new_input.clone()),
            "focus",
            &Function::new_no_args("this.ownerDocument.activeElement = this;").into(),
        );
        set_children(&new_root, &[new_input.clone()]);

        let old = MountedPatchSubtree::new_component(
            Function::new_no_args("return null;").into(),
            Some(old_root),
            None,
            Vec::new(),
            Vec::new(),
            Vec::new(),
            Vec::new(),
            Vec::new(),
            None,
            None,
        );
        let mut parent_for_component = parent.clone();

        rue.replace_component(
            &old,
            &new_root,
            &mut parent,
            &mut parent_for_component,
            &Some(anchor),
        );
        tick().await;

        assert_eq!(child_tags(&parent), vec!["article", "anchor"]);
        assert!(js_sys::Object::is(
            &Reflect::get(&document, &JsValue::from_str("activeElement")).unwrap(),
            &new_input
        ));
        Reflect::delete_property(&js_sys::global(), &JsValue::from_str("document")).unwrap();
    }

    #[wasm_bindgen_test(async)]
    async fn replace_component_old_host_to_fragment_clears_host_and_restores_focus() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());

        let mut parent = node("parent");
        let old_root = node("old-root");
        let old_input = node("input");
        set_prop(&Object::from(old_input.clone()), "type", &JsValue::from_str("text"));
        set_children(&old_root, &[old_input.clone()]);
        let anchor = node("anchor");
        set_children(&parent, &[old_root.clone(), anchor.clone()]);

        let document = Object::new();
        set_prop(&document, "activeElement", &old_input);
        set_prop(&js_sys::global(), "document", &document.clone().into());

        let fragment = node("fragment");
        let new_input = node("input");
        set_prop(&Object::from(new_input.clone()), "type", &JsValue::from_str("text"));
        set_prop(&Object::from(new_input.clone()), "ownerDocument", &document.clone().into());
        set_prop(
            &Object::from(new_input.clone()),
            "focus",
            &Function::new_no_args("this.ownerDocument.activeElement = this;").into(),
        );
        set_children(&fragment, &[new_input.clone()]);

        let old = MountedPatchSubtree::new_component(
            Function::new_no_args("return null;").into(),
            Some(old_root.clone()),
            None,
            Vec::new(),
            Vec::new(),
            Vec::new(),
            Vec::new(),
            Vec::new(),
            None,
            None,
        );
        let mut parent_for_component = parent.clone();

        rue.replace_component(
            &old,
            &fragment,
            &mut parent,
            &mut parent_for_component,
            &Some(anchor),
        );
        tick().await;

        assert_eq!(child_tags(&parent), vec!["input", "anchor"]);
        assert!(Reflect::get(&old_root, &JsValue::from_str("parentNode")).unwrap().is_null());
        assert!(js_sys::Object::is(
            &Reflect::get(&document, &JsValue::from_str("activeElement")).unwrap(),
            &new_input
        ));
        Reflect::delete_property(&js_sys::global(), &JsValue::from_str("document")).unwrap();
    }

    #[wasm_bindgen_test]
    fn patch_replace_updates_state_when_new_text_mount_has_no_host() {
        let mut rue = Rue::<JsDomAdapter>::new();
        let mut old = MountedSubtreeState::Text(MountedTextSubtree {
            host: None,
            key: None,
            cleanup_bucket: None,
            effect_scope_id: None,
        });
        let new = MountInput::new_normalized(
            MountInputType::Text("next".to_string()),
            ComponentProps::new(),
            Vec::new(),
        );
        let mut parent = node("parent");

        rue.patch_replace(&mut old, &new, &mut parent);

        let MountedSubtreeState::Text(text) = old else {
            panic!("expected text state");
        };
        assert!(text.host.is_none());
    }

    #[wasm_bindgen_test]
    fn patch_replace_routes_component_patch_through_default_component_replace() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());

        let mut parent = node("parent");
        let old_root = node("old-root");
        set_children(&parent, &[old_root.clone()]);
        let mut old = MountedSubtreeState::Patch(MountedPatchSubtree::new_component(
            Function::new_no_args("return null;").into(),
            Some(old_root),
            None,
            Vec::new(),
            Vec::new(),
            Vec::new(),
            Vec::new(),
            Vec::new(),
            None,
            None,
        ));
        let new =
            MountInput::new_normalized(MountInputType::Vapor, ComponentProps::new(), Vec::new());
        let new_host = node("new-root");
        let mut new = new;
        new.el_hint = Some(new_host);

        rue.patch_replace(&mut old, &new, &mut parent);

        assert_eq!(child_tags(&parent), vec!["new-root"]);
    }

    #[wasm_bindgen_test]
    fn patch_replace_eager_vapor_preclears_fragment_nodes() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());

        let mut parent = node("parent");
        let old_host = node("old-host");
        let stale = node("stale");
        set_children(&parent, &[stale.clone(), old_host.clone()]);
        let mut old = MountedSubtreeState::Vapor(MountedVaporSubtree {
            r#type: MountedVaporSubtreeType::Vapor,
            host: Some(old_host),
            key: None,
            fragment_nodes: vec![stale],
            props: Default::default(),
            cleanup_bucket: None,
            effect_scope_id: None,
        });
        let new_host = node("new-root");
        let mut new =
            MountInput::new_normalized(MountInputType::Vapor, ComponentProps::new(), Vec::new());
        new.el_hint = Some(new_host);

        rue.patch_replace(&mut old, &new, &mut parent);

        assert_eq!(child_tags(&parent), vec!["new-root"]);
    }
}
