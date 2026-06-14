/*
单锚点渲染

anchor_map 以 anchor 节点作为稳定定位点，记录其前方当前挂载的 MountedState。
再次渲染同一 anchor 时可以走 patch；输入类型/key 变化时则替换整棵子树。
*/
use super::super::Rue;
use super::super::types::{AnchorMountState, MountInput, MountedState, MountedSubtreeState};
#[cfg(feature = "dev")]
use crate::log::{log, want_log};
use crate::reactive::core::batch_scope;
use crate::runtime::dom_adapter::DomAdapter;
use js_sys::Reflect;
use wasm_bindgen::JsValue;
use wasm_bindgen::throw_str;

impl<A: DomAdapter> Rue<A>
where
    A::Element: Clone,
{
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn ensure_anchor_runtime_ready(&self) {
        if self.crashed || crate::runtime::is_runtime_crashed() {
            if let Some(e) = crate::runtime::last_hook_error() {
                wasm_bindgen::throw_val(e);
            } else if let Some(e) = self.last_error.clone() {
                wasm_bindgen::throw_val(e);
            } else {
                throw_str("Rue runtime crashed");
            }
        }

        if self.get_dom_adapter().is_none() {
            throw_str("Rue runtime: no DOM adapter for renderAnchor");
        }
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn store_anchor_mount_at(&mut self, idx: usize, mounted: MountedState<A>) {
        if let Some(entry) = self.anchor_map.get_mut(idx) {
            entry.store_mount(mounted);
        }
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn mounted_host_for_anchor(mounted: &MountedSubtreeState<A>) -> Option<A::Element> {
        mounted.host_cloned()
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn default_render_anchor_error() -> JsValue {
        js_sys::Error::new("Rue vapor: renderAnchor failed (create_real_dom=None)").into()
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn render_existing_anchor_entry(
        &mut self,
        idx: usize,
        taken: Option<MountedState<A>>,
        input: &MountInput<A>,
        parent: &mut A::Element,
        anchor: &A::Element,
    ) where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        match taken {
            Some(MountedState::Block(old_block)) => {
                let mut dest_parent = self.resolve_dest_parent_for_end(parent, anchor);
                self.call_hooks("before_update");
                let global = js_sys::global();
                let source_key = JsValue::from_str("__rue_debug_clear_source__");
                let _ = Reflect::set(
                    &global,
                    &source_key,
                    &JsValue::from_str("render_anchor_impl:block"),
                );
                self.clear_mounted_state(&mut dest_parent, MountedState::Block(old_block));
                let _ = Reflect::delete_property(&global, &source_key);
                let _ = self.render_anchor_mount(input, parent, anchor).map(|mounted| {
                    self.call_hooks("updated");
                    self.store_anchor_mount_at(idx, mounted);
                });
            }
            Some(old_mount) => {
                let mut parent_clone = parent.clone();
                let mounted = self.patch_root_mounted_state(old_mount, input, &mut parent_clone);
                self.store_anchor_mount_at(idx, mounted);
            }
            None => {
                let mounted = self.render_anchor_mount(input, parent, anchor);
                if let Some(mounted) = mounted {
                    self.store_anchor_mount_at(idx, mounted);
                }
            }
        }
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub fn clear_anchor(&mut self, parent: &mut A::Element, anchor: A::Element)
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        self.ensure_anchor_runtime_ready();

        batch_scope(|| {
            self.current_anchor = Some(anchor.clone());
            self.compact_anchor_map_preserving(Some(&anchor));

            if let Some(idx) = self.find_anchor_index(&anchor) {
                let taken = {
                    let entry = self.anchor_map.get_mut(idx).unwrap();
                    entry.take_mount()
                };

                if let Some(old_mount) = taken {
                    let mut dest_parent = self.resolve_dest_parent_for_end(parent, &anchor);
                    let global = js_sys::global();
                    let source_key = JsValue::from_str("__rue_debug_clear_source__");
                    let _ = Reflect::set(&global, &source_key, &JsValue::from_str("clear_anchor"));
                    self.clear_mounted_state(&mut dest_parent, old_mount);
                    let _ = Reflect::delete_property(&global, &source_key);
                }
            }

            self.current_anchor = None;
        });
    }

    /// 默认公开入口：在单个尾锚点前渲染 MountInput。
    ///
    /// 这层让默认调用方沿用 MountInput-first 协议；底层 patch 内核只恢复 mounted
    /// snapshot，不再临时构造额外树对象。
    pub fn render_anchor_input(
        &mut self,
        input: MountInput<A>,
        parent: &mut A::Element,
        anchor: A::Element,
    ) where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        self.render_anchor_impl(&input, parent, anchor);
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn render_anchor_impl(
        &mut self,
        input: &MountInput<A>,
        parent: &mut A::Element,
        anchor: A::Element,
    ) where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        self.ensure_anchor_runtime_ready();

        batch_scope(|| {
            self.current_anchor = Some(anchor.clone());
            self.call_hooks("before_mount");
            self.maybe_compact_anchor_map_preserving(Some(&anchor));

            if let Some(idx) = self.find_anchor_index(&anchor) {
                #[cfg(feature = "dev")]
                {
                    if want_log("debug", "runtime:renderAnchor anchor_map hit") {
                        log("debug", &format!("runtime:renderAnchor anchor_map hit idx={}", idx));
                    }
                }
                let taken = {
                    let entry = self.anchor_map.get_mut(idx).unwrap();
                    entry.take_mount()
                };
                self.render_existing_anchor_entry(idx, taken, input, parent, &anchor);
            } else {
                #[cfg(feature = "dev")]
                {
                    if want_log("debug", "runtime:renderAnchor anchor_map miss") {
                        log(
                            "debug",
                            "runtime:renderAnchor anchor_map miss, creating new anchor entry",
                        );
                    }
                }
                if let Some(mounted) = self.render_anchor_mount(input, parent, &anchor) {
                    self.anchor_map.push(AnchorMountState::new(anchor, mounted));
                }
            }

            self.call_hooks("mounted");
            self.current_anchor = None;
        });
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn render_anchor_mount(
        &mut self,
        input: &MountInput<A>,
        parent: &mut A::Element,
        anchor: &A::Element,
    ) -> Option<MountedState<A>>
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        if let Some(mounted) = self.mount_from_input(input, Some(parent)) {
            let el = Self::mounted_host_for_anchor(&mounted)?;
            let mut dest_parent = self.resolve_dest_parent_for_end(parent, anchor);
            let is_fragment =
                self.get_dom_adapter().map(|adapter| adapter.is_fragment(&el)).unwrap_or(false);
            if is_fragment {
                self.insert_fragment_children_preferring_end(
                    &mut dest_parent,
                    &el,
                    &Some(anchor.clone()),
                );
            } else {
                self.insert_new_dom_before_end(&mut dest_parent, &el, anchor);
            }
            Some(MountedState::from_subtree_root(mounted))
        } else {
            let err_to_handle =
                self.last_error.clone().unwrap_or_else(Self::default_render_anchor_error);
            self.handle_error(err_to_handle);
            None
        }
    }
}

#[cfg(test)]
#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
mod tests {
    use super::*;
    use crate::runtime::js_adapter::JsDomAdapter;
    use crate::runtime::types::{
        ComponentProps, MountInputChild, MountInputType, MountedSubtreeState, MountedTextSubtree,
    };
    use js_sys::{Array, Function, Object, Reflect};
    use wasm_bindgen_test::*;

    fn set_prop(target: &Object, key: &str, value: JsValue) {
        Reflect::set(target, &JsValue::from_str(key), &value).unwrap();
    }

    fn adapter() -> JsDomAdapter {
        let obj = Object::new();
        for (name, args, body) in [
            ("createElement", "tag", "return { tag, children: [], nodeType: 1 }"),
            ("createTextNode", "text", "return { tag: '#text', text, nodeType: 3 }"),
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
                "p,c",
                "p.children = p.children || []; if (c && c.tag === 'fragment') p.children.push(...Array.from(c.children || [])); else p.children.push(c)",
            ),
            (
                "insertBefore",
                "p,c,b",
                "p.children = p.children || []; const at = Math.max(0, p.children.indexOf(b)); const list = c && c.tag === 'fragment' ? Array.from(c.children || []) : [c]; p.children.splice(at, 0, ...list)",
            ),
            ("removeChild", "p,c", "p.children = (p.children || []).filter(x => x !== c)"),
            ("contains", "p,c", "return p === c || (p.children || []).includes(c)"),
            ("setClassName", "el,v", "el.className = v"),
            ("patchStyle", "el,old,next", "el.style = next"),
            ("setInnerHTML", "el,html", "el.children = []; el.innerHTML = html"),
            ("setValue", "el,v", "el.value = v"),
            ("setChecked", "el,b", "el.checked = !!b"),
            ("setDisabled", "el,b", "el.disabled = !!b"),
            ("clearRef", "r", "return"),
            ("applyRef", "el,r", "return"),
            ("setAttribute", "el,k,v", "el[k] = v"),
            ("removeAttribute", "el,k", "delete el[k]"),
            ("getTagName", "el", "return el.tag || ''"),
            ("addEventListener", "el,evt,h", "return"),
            ("removeEventListener", "el,evt,h", "return"),
            ("hasValueProperty", "el", "return 'value' in el"),
            ("isSelectMultiple", "el", "return !!el.multiple"),
            ("querySelector", "sel", "return null"),
        ] {
            set_prop(&obj, name, Function::new_with_args(args, body).into());
        }
        JsDomAdapter::new(obj.into())
    }

    fn phantom_input() -> MountInput<JsDomAdapter> {
        MountInput {
            r#type: MountInputType::_Phantom(std::marker::PhantomData),
            props: ComponentProps::new(),
            children: Vec::new(),
            key: None,
            strict_component_returns: false,
            mount_cleanup_bucket: None,
            mount_effect_scope_id: None,
            el_hint: None,
        }
    }

    fn vapor_input(host: JsValue) -> MountInput<JsDomAdapter> {
        MountInput {
            r#type: MountInputType::Vapor,
            props: ComponentProps::new(),
            children: Vec::new(),
            key: Some("vapor".to_string()),
            strict_component_returns: false,
            mount_cleanup_bucket: None,
            mount_effect_scope_id: None,
            el_hint: Some(host),
        }
    }

    fn text_input(text: &str) -> MountInput<JsDomAdapter> {
        MountInput {
            r#type: MountInputType::Text(text.to_string()),
            props: ComponentProps::new(),
            children: Vec::new(),
            key: None,
            strict_component_returns: false,
            mount_cleanup_bucket: None,
            mount_effect_scope_id: None,
            el_hint: None,
        }
    }

    fn fragment_input(children: Vec<MountInputChild<JsDomAdapter>>) -> MountInput<JsDomAdapter> {
        MountInput {
            r#type: MountInputType::Fragment,
            props: ComponentProps::new(),
            children,
            key: None,
            strict_component_returns: false,
            mount_cleanup_bucket: None,
            mount_effect_scope_id: None,
            el_hint: None,
        }
    }

    fn block_state(host: JsValue) -> MountedState<JsDomAdapter> {
        MountedState::from_subtree_root(MountedSubtreeState::Text(MountedTextSubtree {
            host: Some(host),
            key: None,
            cleanup_bucket: None,
            effect_scope_id: None,
        }))
    }

    fn child_tags(parent: &JsValue) -> Vec<String> {
        let children = Array::from(&Reflect::get(parent, &JsValue::from_str("children")).unwrap());
        children
            .iter()
            .map(|child| {
                Reflect::get(&child, &JsValue::from_str("tag"))
                    .unwrap_or(JsValue::UNDEFINED)
                    .as_string()
                    .unwrap_or_else(|| {
                        Reflect::get(&child, &JsValue::from_str("text"))
                            .unwrap_or(JsValue::UNDEFINED)
                            .as_string()
                            .unwrap_or_default()
                    })
            })
            .collect()
    }

    #[wasm_bindgen_test]
    fn render_anchor_covers_fragment_insert_and_create_none_error() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let mut parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
        let anchor = rue.get_dom_adapter_mut().unwrap().create_element("anchor");
        rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &anchor);

        let fragment = Object::new();
        set_prop(&fragment, "tag", JsValue::from_str("fragment"));
        let children = Array::new();
        children.push(&rue.get_dom_adapter_mut().unwrap().create_element("a"));
        children.push(&rue.get_dom_adapter_mut().unwrap().create_element("b"));
        set_prop(&fragment, "children", children.into());

        rue.render_anchor_input(vapor_input(fragment.into()), &mut parent, anchor.clone());
        assert_eq!(rue.anchor_mount_count(), 1);

        rue.clear_anchor(&mut parent, anchor.clone());
        rue.last_error = None;
        rue.render_anchor_input(phantom_input(), &mut parent, anchor);
        assert!(rue.last_error.is_some());
    }

    #[wasm_bindgen_test]
    fn render_anchor_hit_with_empty_entry_mounts_and_stores_again() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let mut parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
        let anchor = rue.get_dom_adapter_mut().unwrap().create_element("anchor");
        rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &anchor);

        let mounted =
            block_state(rue.get_dom_adapter_mut().unwrap().create_text_node("stale text"));
        let mut empty_entry = AnchorMountState::new(anchor.clone(), mounted);
        assert!(empty_entry.take_mount().is_some());
        rue.anchor_map.push(empty_entry);
        assert!(rue.anchor_map[0].mounted.is_none());
        assert_eq!(rue.find_anchor_index(&anchor), Some(0));

        rue.render_anchor_input(text_input("fresh text"), &mut parent, anchor.clone());

        assert_eq!(rue.anchor_mount_count(), 1);
        assert!(rue.find_anchor_index(&anchor).is_some());
        assert_eq!(child_tags(&parent.into()), vec!["#text", "anchor"]);
    }

    #[wasm_bindgen_test]
    fn clear_anchor_hit_with_empty_entry_noops_without_dropping_entry() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let mut parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
        let anchor = rue.get_dom_adapter_mut().unwrap().create_element("anchor");
        rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &anchor);

        let mounted =
            block_state(rue.get_dom_adapter_mut().unwrap().create_text_node("stale text"));
        let mut empty_entry = AnchorMountState::new(anchor.clone(), mounted);
        assert!(empty_entry.take_mount().is_some());
        rue.anchor_map.push(empty_entry);

        rue.clear_anchor(&mut parent, anchor.clone());

        let idx = rue.find_anchor_index(&anchor).unwrap();
        assert!(rue.anchor_map[idx].mounted.is_none());
        assert_eq!(child_tags(&parent.into()), vec!["anchor"]);
    }

    #[wasm_bindgen_test]
    fn clear_anchor_miss_noops_without_creating_entry() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let mut parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
        let anchor = rue.get_dom_adapter_mut().unwrap().create_element("anchor");
        rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &anchor);

        rue.clear_anchor(&mut parent, anchor.clone());

        assert!(rue.find_anchor_index(&anchor).is_none());
        assert_eq!(rue.anchor_mount_count(), 0);
        assert_eq!(child_tags(&parent.into()), vec!["anchor"]);
    }

    #[wasm_bindgen_test]
    fn render_anchor_block_hit_handles_unmountable_replacement_without_restoring_mount() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let mut parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
        let anchor = rue.get_dom_adapter_mut().unwrap().create_element("anchor");
        rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &anchor);
        let old_host = rue.get_dom_adapter_mut().unwrap().create_text_node("old");
        rue.get_dom_adapter_mut().unwrap().insert_before(&mut parent, &old_host, &anchor);
        rue.anchor_map.push(AnchorMountState::new(anchor.clone(), block_state(old_host)));

        rue.render_anchor_input(phantom_input(), &mut parent, anchor.clone());

        let idx = rue.find_anchor_index(&anchor).unwrap();
        assert!(rue.anchor_map[idx].mounted.is_none());
        assert!(rue.last_error.is_some());
        assert_eq!(child_tags(&parent.into()), vec!["anchor"]);
    }

    #[wasm_bindgen_test]
    fn render_anchor_block_hit_stores_successful_replacement() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let mut parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
        let anchor = rue.get_dom_adapter_mut().unwrap().create_element("anchor");
        rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &anchor);
        let old_host = rue.get_dom_adapter_mut().unwrap().create_text_node("old");
        rue.get_dom_adapter_mut().unwrap().insert_before(&mut parent, &old_host, &anchor);
        rue.anchor_map.push(AnchorMountState::new(anchor.clone(), block_state(old_host)));

        rue.render_anchor_input(text_input("new"), &mut parent, anchor.clone());

        let idx = rue.find_anchor_index(&anchor).unwrap();
        assert!(rue.anchor_map[idx].mounted.is_some());
        assert!(rue.last_error.is_none());
        assert_eq!(child_tags(&parent.into()), vec!["#text", "anchor"]);
    }

    #[wasm_bindgen_test]
    fn render_anchor_mount_uses_default_error_when_mounting_reports_no_error() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let mut parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
        let anchor = rue.get_dom_adapter_mut().unwrap().create_element("anchor");
        rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &anchor);

        assert!(rue.render_anchor_mount(&phantom_input(), &mut parent, &anchor).is_none());
        let message = rue
            .last_error
            .as_ref()
            .and_then(|err| {
                Reflect::get(err, &JsValue::from_str("message"))
                    .ok()
                    .and_then(|value| value.as_string())
            })
            .unwrap_or_default();
        assert_eq!(message, "Rue vapor: renderAnchor failed (create_real_dom=None)");
    }

    #[wasm_bindgen_test]
    fn render_anchor_fragment_with_hostless_child_keeps_fragment_boundary_order() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let mut parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
        let anchor = rue.get_dom_adapter_mut().unwrap().create_element("anchor");
        rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &anchor);

        let input = fragment_input(vec![
            MountInputChild::Text("left".to_string()),
            MountInputChild::Input(phantom_input()),
            MountInputChild::Text("right".to_string()),
        ]);

        rue.render_anchor_input(input, &mut parent, anchor);

        assert_eq!(child_tags(&parent.into()), vec!["#text", "#text", "anchor"]);
    }

    #[wasm_bindgen_test]
    #[should_panic]
    fn render_anchor_panics_without_dom_adapter() {
        let mut rue = Rue::<JsDomAdapter>::new();
        let mut parent = Object::new().into();
        let anchor = Object::new().into();
        rue.render_anchor_input(phantom_input(), &mut parent, anchor);
    }

    #[wasm_bindgen_test]
    #[should_panic]
    fn clear_anchor_panics_without_dom_adapter() {
        let mut rue = Rue::<JsDomAdapter>::new();
        let mut parent = Object::new().into();
        let anchor = Object::new().into();
        rue.clear_anchor(&mut parent, anchor);
    }

    #[wasm_bindgen_test]
    #[should_panic]
    fn clear_anchor_panics_when_runtime_is_marked_crashed_without_last_error() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.crashed = true;
        let mut parent = Object::new().into();
        let anchor = Object::new().into();
        rue.clear_anchor(&mut parent, anchor);
    }
}
