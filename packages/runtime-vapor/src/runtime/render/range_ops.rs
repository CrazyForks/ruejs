/*
区间渲染原子操作

这里放置 render_between 所需的低层 DOM 操作：
解析真实父节点、清理锚点之间的节点、插入新片段，以及同步 range/anchor 映射。
保持这些操作原子化，可以降低替换与清理时的边界错误。
*/
use super::super::Rue;
use super::super::types::MountLifecycleRecord;
use crate::runtime::dom_adapter::DomAdapter;
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;

// 区间渲染的原子操作集合：
// - vapor_insert_new_range：将新范围插入到 end 前（片段走子节点原子插入）
// - collect_fragment_children_atomic / insert_fragment_children_atomic：片段子节点的原子化收集与插入
// - resolve_dest_parent_for_end：解析 end 的真实父元素（片段/不包含 end 时）
// - clear_dom_between_anchors：移除 start 与 end 之间的所有节点
// - insert_new_dom_before_end：在 end 前插入新节点或尾部追加

impl<A: DomAdapter> Rue<A>
where
    A::Element: Clone,
{
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn drain_range_entries_within_root(
        &mut self,
        root: &A::Element,
        pending_unmounted: &mut Vec<MountLifecycleRecord>,
    ) where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        let adapter_owned = self.get_dom_adapter().cloned();
        let root_js: JsValue = root.clone().into();

        let should_remove = |start: &A::Element| {
            let start_js: JsValue = start.clone().into();
            if js_sys::Object::is(&root_js, &start_js) {
                return true;
            }
            if let Some(adapter) = adapter_owned.as_ref() {
                return adapter.contains(root, start);
            }
            let contains = js_sys::Reflect::get(&root_js, &JsValue::from_str("contains"))
                .unwrap_or(JsValue::UNDEFINED);
            if let Some(func) = contains.dyn_ref::<js_sys::Function>() {
                let result = func.call1(&root_js, &start_js).unwrap_or(JsValue::FALSE);
                return result.as_bool().unwrap_or(false);
            }
            false
        };

        let drained = std::mem::take(&mut self.range_map);
        let mut kept = Vec::with_capacity(drained.len());
        for mut entry in drained.into_iter() {
            if should_remove(&entry.start) {
                if let Some(mount) = entry.take_mount() {
                    let lifecycle = mount.into_lifecycle();
                    self.invoke_before_unmount_record(&lifecycle);
                    pending_unmounted.push(lifecycle);
                } else {
                    continue;
                }
            } else {
                kept.push(entry);
            }
        }
        self.range_map = kept;
    }

    /// 将新范围插入到 end 前：片段走原子化插入，普通节点直接插入
    pub(super) fn vapor_insert_new_range(
        &mut self,
        parent: &A::Element,
        end: &A::Element,
        el: &A::Element,
    ) where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        let mut dest_parent = self.resolve_dest_parent_for_end(parent, end);
        if let Some(adapter) = self.get_dom_adapter() {
            if adapter.is_fragment(el) {
                let nodes = self.collect_fragment_children_atomic(el);
                self.insert_fragment_children_atomic(&mut dest_parent, &nodes, end);
            } else {
                self.insert_new_dom_before_end(&mut dest_parent, el, end);
            }
        } else {
            let nodes = self.collect_fragment_children_atomic(el);
            self.insert_fragment_children_atomic(&mut dest_parent, &nodes, end);
            self.insert_new_dom_before_end(&mut dest_parent, el, end);
        }
    }

    /// 原子化收集片段的子节点列表
    #[inline(never)]
    pub(super) fn collect_fragment_children_atomic(&self, el: &A::Element) -> Vec<A::Element>
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        self.get_dom_adapter()
            .map(|adapter| adapter.collect_fragment_children(el))
            .unwrap_or_default()
    }

    /// 原子化插入片段的子节点到 end 前
    pub(super) fn insert_fragment_children_atomic(
        &mut self,
        dest_parent: &mut A::Element,
        nodes: &[A::Element],
        end: &A::Element,
    ) where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        for n in nodes.iter() {
            self.insert_new_dom_before_end(dest_parent, n, end);
        }
    }

    /// 解析 end 的真实父元素：父为片段或不包含 end 时溯源 parentNode
    pub(super) fn resolve_dest_parent_for_end(
        &self,
        parent: &A::Element,
        end: &A::Element,
    ) -> A::Element
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        if let Some(adapter) = self.get_dom_adapter() {
            let mut dest = parent.clone();
            if adapter.is_fragment(&dest) || !adapter.contains(&dest, end) {
                let pn =
                    js_sys::Reflect::get(&end.clone().into(), &JsValue::from_str("parentNode"))
                        .unwrap_or(JsValue::UNDEFINED);
                if !pn.is_undefined() && !pn.is_null() {
                    dest = pn.into();
                }
            }
            dest
        } else {
            let mut dest = parent.clone();
            let pn = js_sys::Reflect::get(&end.clone().into(), &JsValue::from_str("parentNode"))
                .unwrap_or(JsValue::UNDEFINED);
            if !pn.is_undefined() && !pn.is_null() {
                dest = pn.into();
            }
            dest
        }
    }

    /// 清理 start 与 end 之间的所有 DOM 节点
    pub(super) fn clear_dom_between_anchors(
        &mut self,
        dest_parent: &mut A::Element,
        start: &A::Element,
        end: &A::Element,
    ) where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        let start_js: JsValue = start.clone().into();
        let end_js: JsValue = end.clone().into();
        let mut pending_unmounted: Vec<MountLifecycleRecord> = Vec::new();

        let mut cur = js_sys::Reflect::get(&start_js, &JsValue::from_str("nextSibling"))
            .unwrap_or(JsValue::UNDEFINED);
        while !cur.is_undefined() && !cur.is_null() {
            if js_sys::Object::is(&cur, &end_js) {
                break;
            }
            let next = js_sys::Reflect::get(&cur, &JsValue::from_str("nextSibling"))
                .unwrap_or(JsValue::UNDEFINED);

            let node_el: A::Element = cur.clone().into();
            self.drain_range_entries_within_root(&node_el, &mut pending_unmounted);

            if let Some(adapter) = self.get_dom_adapter_mut() {
                if adapter.contains(dest_parent, &node_el) {
                    let mut p2 = dest_parent.clone();
                    adapter.remove_child(&mut p2, &node_el);
                } else {
                    cur = next;
                    continue;
                }
            }

            cur = next;
        }

        for record in pending_unmounted.into_iter() {
            self.invoke_unmounted_record(&record);
        }
    }

    /// 在 end 前插入新节点；若 end 不在父内则尾部追加
    pub(super) fn insert_new_dom_before_end(
        &mut self,
        dest_parent: &mut A::Element,
        new_el: &A::Element,
        end: &A::Element,
    ) {
        if let Some(adapter) = self.get_dom_adapter_mut() {
            if adapter.contains(dest_parent, end) {
                adapter.insert_before(dest_parent, new_el, end);
            } else {
                adapter.append_child(dest_parent, new_el);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::runtime::js_adapter::JsDomAdapter;
    use crate::runtime::types::{
        MountedState, MountedSubtreeState, MountedVaporSubtree, MountedVaporSubtreeType,
        RangeMountState,
    };
    use js_sys::{Array, Function, Object, Reflect};
    use wasm_bindgen_test::*;

    fn adapter() -> JsDomAdapter {
        let obj = Object::new();
        Reflect::set(
            &obj,
            &JsValue::from_str("createElement"),
            &Function::new_with_args("tag", "return { tag, children: [], nodeType: 1 }").into(),
        )
        .unwrap();
        Reflect::set(
            &obj,
            &JsValue::from_str("createTextNode"),
            &Function::new_with_args("text", "return { tag: '#text', text, nodeType: 3 }").into(),
        )
        .unwrap();
        Reflect::set(
            &obj,
            &JsValue::from_str("createDocumentFragment"),
            &Function::new_no_args("return { tag: 'fragment', children: [], nodeType: 11 }").into(),
        )
        .unwrap();
        Reflect::set(
            &obj,
            &JsValue::from_str("isFragment"),
            &Function::new_with_args("el", "return !!el && el.tag === 'fragment'").into(),
        )
        .unwrap();
        Reflect::set(
            &obj,
            &JsValue::from_str("collectFragmentChildren"),
            &Function::new_with_args("el", "return Array.from(el && el.children || [])").into(),
        )
        .unwrap();
        Reflect::set(
            &obj,
            &JsValue::from_str("setTextContent"),
            &Function::new_with_args("el,text", "el.text = text").into(),
        )
        .unwrap();
        Reflect::set(
            &obj,
            &JsValue::from_str("appendChild"),
            &Function::new_with_args(
                "p,c",
                "p.children = p.children||[]; p.children.push(c); c.parentNode = p",
            )
            .into(),
        )
        .unwrap();
        Reflect::set(
            &obj,
            &JsValue::from_str("insertBefore"),
            &Function::new_with_args(
                "p,c,b",
                "p.children = p.children||[]; const i = p.children.indexOf(b); \
                 i >= 0 ? p.children.splice(i, 0, c) : p.children.push(c); c.parentNode = p",
            )
            .into(),
        )
        .unwrap();
        Reflect::set(
            &obj,
            &JsValue::from_str("removeChild"),
            &Function::new_with_args(
                "p,c",
                "p.children = (p.children||[]).filter(x => x !== c); c.parentNode = null",
            )
            .into(),
        )
        .unwrap();
        Reflect::set(
            &obj,
            &JsValue::from_str("contains"),
            &Function::new_with_args("p,c", "return p === c || (p.children||[]).includes(c)")
                .into(),
        )
        .unwrap();
        for (name, f) in [
            ("setClassName", Function::new_with_args("el,v", "el.class = v")),
            ("patchStyle", Function::new_with_args("el,old,next", "return")),
            (
                "setInnerHTML",
                Function::new_with_args("el,html", "el.children = []; el.text = html"),
            ),
            ("setValue", Function::new_with_args("el,v", "el.value = v")),
            ("setChecked", Function::new_with_args("el,b", "el.checked = !!b")),
            ("setDisabled", Function::new_with_args("el,b", "el.disabled = !!b")),
            ("clearRef", Function::new_with_args("r", "return")),
            ("applyRef", Function::new_with_args("el,r", "return")),
            (
                "setAttribute",
                Function::new_with_args("el,k,v", "el.attrs = el.attrs||{}; el.attrs[k] = v"),
            ),
            (
                "removeAttribute",
                Function::new_with_args("el,k", "if (el.attrs) delete el.attrs[k]"),
            ),
            ("getTagName", Function::new_with_args("el", "return el.tag || ''")),
            ("addEventListener", Function::new_with_args("el,evt,h", "return")),
            ("removeEventListener", Function::new_with_args("el,evt,h", "return")),
            ("hasValueProperty", Function::new_with_args("el", "return 'value' in el")),
            (
                "isSelectMultiple",
                Function::new_with_args("el", "return el.tag === 'SELECT' && !!el.multiple"),
            ),
            ("querySelector", Function::new_with_args("sel", "return { tag: sel }")),
        ] {
            Reflect::set(&obj, &JsValue::from_str(name), &f.into()).unwrap();
        }
        JsDomAdapter::new(obj.into())
    }

    fn node(tag: &str) -> JsValue {
        let obj = Object::new();
        Reflect::set(&obj, &JsValue::from_str("tag"), &JsValue::from_str(tag)).unwrap();
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

    fn link_siblings(children: &[JsValue]) {
        for (index, child) in children.iter().enumerate() {
            let next = if index + 1 < children.len() {
                children[index + 1].clone()
            } else {
                JsValue::NULL
            };
            Reflect::set(child, &JsValue::from_str("nextSibling"), &next).unwrap();
        }
    }

    fn set_linked_children(parent: &JsValue, children: &[JsValue]) {
        set_children(parent, children);
        link_siblings(children);
    }

    fn mounted_vapor(host: JsValue) -> MountedState<JsDomAdapter> {
        MountedState::from_subtree_root(MountedSubtreeState::Vapor(MountedVaporSubtree {
            r#type: MountedVaporSubtreeType::Vapor,
            host: Some(host),
            key: None,
            fragment_nodes: Vec::new(),
            cleanup_bucket: None,
            effect_scope_id: None,
        }))
    }

    fn tags(parent: &JsValue) -> Vec<String> {
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

    #[wasm_bindgen_test]
    fn vapor_insert_new_range_expands_fragment_before_end() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let parent = node("parent");
        let end = node("end");
        let first = node("first");
        let second = node("second");
        let fragment = node("fragment");
        set_children(&fragment, &[first.clone(), second.clone()]);
        set_children(&parent, &[end.clone()]);

        rue.vapor_insert_new_range(&parent, &end, &fragment);

        assert_eq!(tags(&parent), vec!["first", "second", "end"]);
        assert_eq!(rue.collect_fragment_children_atomic(&fragment).len(), 2);

        let normal_parent = node("normal_parent");
        let normal_end = node("normal_end");
        let normal = node("normal");
        set_children(&normal_parent, &[normal_end.clone()]);

        rue.vapor_insert_new_range(&normal_parent, &normal_end, &normal);

        assert_eq!(tags(&normal_parent), vec!["normal", "normal_end"]);
    }

    #[wasm_bindgen_test]
    fn resolve_dest_parent_uses_end_parent_and_append_fallback_when_end_missing() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let outer = node("outer");
        let actual = node("actual");
        let end = node("end");
        let inserted = node("inserted");
        let missing_end = node("missing_end");
        set_children(&outer, &[]);
        set_children(&actual, &[end.clone()]);

        let mut dest = rue.resolve_dest_parent_for_end(&outer, &end);
        assert!(Object::is(&dest, &actual));

        rue.insert_new_dom_before_end(&mut dest, &inserted, &missing_end);

        assert_eq!(tags(&actual), vec!["end", "inserted"]);

        let parent = node("parent");
        let contained_end = node("contained_end");
        set_children(&parent, &[contained_end.clone()]);
        let resolved_parent = rue.resolve_dest_parent_for_end(&parent, &contained_end);
        assert!(Object::is(&resolved_parent, &parent));

        let orphan_end = node("orphan_end");
        let resolved_orphan = rue.resolve_dest_parent_for_end(&parent, &orphan_end);
        assert!(Object::is(&resolved_orphan, &parent));
    }

    #[wasm_bindgen_test]
    fn clear_dom_between_anchors_removes_nodes_and_drains_nested_range_entry() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let parent = node("parent");
        let start = node("start");
        let stale = node("stale");
        let end = node("end");
        set_linked_children(&parent, &[start.clone(), stale.clone(), end.clone()]);

        rue.range_map.push(RangeMountState::new(
            stale.clone(),
            end.clone(),
            mounted_vapor(stale.clone()),
        ));

        let mut parent_for_clear = parent.clone();
        rue.clear_dom_between_anchors(&mut parent_for_clear, &start, &end);

        assert_eq!(tags(&parent), vec!["start", "end"]);
        assert_eq!(rue.range_map.len(), 0);

        let empty_start = node("empty_start");
        let empty_end = node("empty_end");
        set_linked_children(&parent, &[empty_start.clone(), empty_end.clone()]);
        rue.clear_dom_between_anchors(&mut parent_for_clear, &empty_start, &empty_end);
        assert_eq!(tags(&parent), vec!["empty_start", "empty_end"]);

        let detached_parent = node("detached_parent");
        let detached_start = node("detached_start");
        let detached = node("detached");
        let detached_end = node("detached_end");
        set_linked_children(&detached_parent, &[detached_start.clone(), detached_end.clone()]);
        Reflect::set(&detached_start, &JsValue::from_str("nextSibling"), &detached).unwrap();
        Reflect::set(&detached, &JsValue::from_str("nextSibling"), &detached_end).unwrap();
        let mut detached_parent_for_clear = detached_parent.clone();
        rue.clear_dom_between_anchors(
            &mut detached_parent_for_clear,
            &detached_start,
            &detached_end,
        );
        assert_eq!(tags(&detached_parent), vec!["detached_start", "detached_end"]);
    }

    #[wasm_bindgen_test]
    fn clear_dom_between_anchors_drains_nested_range_with_adapter_and_js_fallback() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let parent = node("parent");
        let start = node("start");
        let wrapper = node("wrapper");
        let nested_start = node("nested_start");
        let end = node("end");
        set_children(&wrapper, &[nested_start.clone()]);
        set_linked_children(&parent, &[start.clone(), wrapper.clone(), end.clone()]);
        rue.range_map.push(RangeMountState::new(
            nested_start.clone(),
            end.clone(),
            mounted_vapor(nested_start.clone()),
        ));

        let mut parent_for_clear = parent.clone();
        rue.clear_dom_between_anchors(&mut parent_for_clear, &start, &end);
        assert_eq!(tags(&parent), vec!["start", "end"]);
        assert_eq!(rue.range_map.len(), 0);

        let drained_empty_mount = node("drained_empty_mount");
        rue.range_map.push(RangeMountState {
            start: drained_empty_mount.clone(),
            end: end.clone(),
            mounted: None,
        });
        let mut pending_unmounted = Vec::new();
        rue.drain_range_entries_within_root(&drained_empty_mount, &mut pending_unmounted);
        assert_eq!(rue.range_map.len(), 0);
        assert!(pending_unmounted.is_empty());

        let mut rue_no_adapter = Rue::<JsDomAdapter>::new();
        let no_adapter_parent = node("no_adapter_parent");
        let no_adapter_start = node("no_adapter_start");
        let no_adapter_wrapper = node("no_adapter_wrapper");
        let no_adapter_nested = node("no_adapter_nested");
        let no_adapter_end = node("no_adapter_end");
        set_linked_children(
            &no_adapter_parent,
            &[no_adapter_start.clone(), no_adapter_wrapper.clone(), no_adapter_end.clone()],
        );
        Reflect::set(
            &no_adapter_wrapper,
            &JsValue::from_str("contains"),
            &Function::new_with_args("node", "return node && node.tag === 'no_adapter_nested'")
                .into(),
        )
        .unwrap();
        rue_no_adapter.range_map.push(RangeMountState::new(
            no_adapter_nested.clone(),
            no_adapter_end.clone(),
            mounted_vapor(no_adapter_nested),
        ));
        let mut no_adapter_parent_for_clear = no_adapter_parent.clone();
        rue_no_adapter.clear_dom_between_anchors(
            &mut no_adapter_parent_for_clear,
            &no_adapter_start,
            &no_adapter_end,
        );
        assert_eq!(rue_no_adapter.range_map.len(), 0);

        let mut rue_no_contains = Rue::<JsDomAdapter>::new();
        let no_contains_root = node("no_contains_root");
        let kept_start = node("kept_start");
        let kept_end = node("kept_end");
        rue_no_contains.range_map.push(RangeMountState::new(
            kept_start.clone(),
            kept_end.clone(),
            mounted_vapor(kept_start),
        ));
        let mut pending_unmounted = Vec::new();

        rue_no_contains.drain_range_entries_within_root(&no_contains_root, &mut pending_unmounted);

        assert_eq!(rue_no_contains.range_map.len(), 1);
        assert!(pending_unmounted.is_empty());
    }

    #[wasm_bindgen_test]
    fn drain_range_entries_within_root_drops_entry_without_mount() {
        let mut rue = Rue::<JsDomAdapter>::new();
        let root = node("root");
        let end = node("end");
        Reflect::set(
            &root,
            &JsValue::from_str("contains"),
            &Function::new_with_args("node", "return node === this").into(),
        )
        .unwrap();
        rue.range_map.push(RangeMountState { start: root.clone(), end, mounted: None });
        let mut pending_unmounted = Vec::new();

        rue.drain_range_entries_within_root(&root, &mut pending_unmounted);

        assert!(rue.range_map.is_empty());
        assert!(pending_unmounted.is_empty());
    }

    #[wasm_bindgen_test]
    fn range_helpers_cover_no_adapter_fallbacks() {
        let mut rue = Rue::<JsDomAdapter>::new();
        let parent = node("parent");
        let actual = node("actual");
        let end = node("end");
        Reflect::set(&end, &JsValue::from_str("parentNode"), &actual).unwrap();

        let resolved = rue.resolve_dest_parent_for_end(&parent, &end);
        assert!(Object::is(&resolved, &actual));
        let collect: fn(&Rue<JsDomAdapter>, &JsValue) -> Vec<JsValue> =
            Rue::<JsDomAdapter>::collect_fragment_children_atomic;
        let empty_children = std::hint::black_box(collect(
            std::hint::black_box(&rue),
            std::hint::black_box(&parent),
        ));
        assert!(std::hint::black_box(empty_children.is_empty()));

        let missing_parent_end = node("missing_parent_end");
        let resolved_missing = rue.resolve_dest_parent_for_end(&parent, &missing_parent_end);
        assert!(Object::is(&resolved_missing, &parent));
        let null_parent_end = node("null_parent_end");
        Reflect::set(&null_parent_end, &JsValue::from_str("parentNode"), &JsValue::NULL).unwrap();
        let resolved_null = rue.resolve_dest_parent_for_end(&parent, &null_parent_end);
        assert!(Object::is(&resolved_null, &parent));

        let mut dest = parent.clone();
        let inserted = node("inserted");
        rue.insert_fragment_children_atomic(&mut dest, &[inserted.clone()], &end);
        rue.insert_new_dom_before_end(&mut dest, &inserted, &end);
        rue.vapor_insert_new_range(&parent, &end, &inserted);
        assert!(tags(&parent).is_empty());
    }
}
