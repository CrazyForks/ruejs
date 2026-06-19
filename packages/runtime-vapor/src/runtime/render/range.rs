/*
区间渲染入口

range_map 使用 start/end 两个锚点定位动态区间。
它适合 Fragment、条件块、列表局部等需要“清理中间节点但保留边界”的场景。
*/
use super::super::Rue;
use super::super::types::{
    MountInput, MountInputType, MountedState, MountedSubtreeState, MountedVaporSubtree,
    MountedVaporSubtreeType, RangeMountState,
};
#[cfg(feature = "dev")]
use crate::log::{log, want_log};
use crate::reactive::core::batch_scope;
use crate::runtime::dom_adapter::DomAdapter;
use crate::runtime::error_strings;
#[cfg(feature = "dev")]
use js_sys::Reflect;
use wasm_bindgen::JsValue;
use wasm_bindgen::throw_str;

// 区间渲染（render_between）：
// - 在父元素的 start/end 两个锚点之间渲染输入子树，适合片段/动态局部更新
// - 维护 range_map：记录每个区间的起点与当前挂载状态，便于后续命中更新
// - 顶层 Vapor/VaporWithSetup 命中时直接按 block identity 替换，不再依赖旧树对象 patch
// - Miss 时创建真实 DOM，清理区间并插入到 end 前；最后记录到 range_map

impl<A: DomAdapter> Rue<A>
where
    A::Element: Clone,
{
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn rethrow_if_crashed_for_range(&self) {
        if self.crashed || crate::runtime::is_runtime_crashed() {
            if let Some(e) = crate::runtime::last_hook_error() {
                wasm_bindgen::throw_val(e);
            } else if let Some(e) = self.last_error.clone() {
                wasm_bindgen::throw_val(e);
            } else {
                throw_str(error_strings::RUNTIME_CRASHED);
            }
        }
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn mount_range_input_or_error(
        &mut self,
        input: &MountInput<A>,
        parent: &A::Element,
        message: &str,
    ) -> Option<MountedSubtreeState<A>>
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        if let Some(mounted) = self.mount_from_input(input, Some(parent)) {
            return Some(mounted);
        }

        if matches!(&input.r#type, MountInputType::Vapor) {
            if let Some(host) = input.el_hint.clone() {
                return Some(MountedSubtreeState::Vapor(MountedVaporSubtree {
                    r#type: MountedVaporSubtreeType::Vapor,
                    host: Some(host),
                    key: input.key.clone(),
                    fragment_nodes: Vec::new(),
                    props: input.props.clone(),
                    cleanup_bucket: input.mount_cleanup_bucket.clone(),
                    effect_scope_id: input.mount_effect_scope_id,
                }));
            }
        }

        let err_to_handle = if let Some(e) = self.last_error.clone() {
            e
        } else {
            js_sys::Error::new(message).into()
        };
        self.handle_error(err_to_handle);
        None
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn mounted_host_for_range(&self, mounted: &MountedSubtreeState<A>) -> A::Element {
        mounted.host_cloned().expect(error_strings::RANGE_HOST_MISSING)
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn store_range_mount_at(&mut self, idx: usize, end: A::Element, mounted: MountedState<A>) {
        if let Some(entry) = self.range_map.get_mut(idx) {
            entry.end = end;
            entry.store_mount(mounted);
        } else {
            let err = js_sys::Error::new(error_strings::RANGE_STORE_OOB).into();
            self.handle_error(err);
            self.current_anchor = None;
        }
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn abort_range_mount(&mut self) {
        self.current_anchor = None;
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn insert_range_miss_dom(
        &mut self,
        dest_parent: &mut A::Element,
        el: &A::Element,
        end: &A::Element,
    ) where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        if let Some(adapter) = self.get_dom_adapter() {
            if adapter.is_fragment(el) {
                self.insert_fragment_children_preferring_end(dest_parent, el, &Some(end.clone()));
            } else {
                self.insert_new_dom_before_end(dest_parent, el, end);
            }
        } else {
            self.insert_new_dom_before_end(dest_parent, el, end);
        }
    }

    pub fn clear_range(&mut self, parent: &mut A::Element, start: A::Element, end: A::Element)
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        self.rethrow_if_crashed_for_range();

        batch_scope(|| {
            self.current_anchor = Some(end.clone());
            self.compact_range_map();

            let mut dest_parent = self.resolve_dest_parent_for_end(parent, &end);
            if let Some(idx) = self.find_range_index(&start) {
                let taken = {
                    let entry = self.range_map.get_mut(idx).unwrap();
                    entry.end = end.clone();
                    entry.take_mount()
                };

                if let Some(old_mount) = taken {
                    #[cfg(feature = "dev")]
                    let (global, source_key, meta_key) = {
                        let global = js_sys::global();
                        let source_key = JsValue::from_str("__rue_debug_clear_source__");
                        let meta_key = JsValue::from_str("__rue_debug_clear_meta__");
                        let start_js: JsValue = start.clone().into();
                        let end_js: JsValue = end.clone().into();
                        let _ =
                            Reflect::set(&global, &source_key, &JsValue::from_str("clear_range"));
                        let start_value = Reflect::get(&start_js, &JsValue::from_str("nodeValue"))
                            .unwrap_or(JsValue::UNDEFINED)
                            .as_string()
                            .unwrap_or_default();
                        let end_value = Reflect::get(&end_js, &JsValue::from_str("nodeValue"))
                            .unwrap_or(JsValue::UNDEFINED)
                            .as_string()
                            .unwrap_or_default();
                        let _ = Reflect::set(
                            &global,
                            &meta_key,
                            &JsValue::from_str(&format!("{} -> {}", start_value, end_value)),
                        );
                        (global, source_key, meta_key)
                    };
                    self.clear_mounted_state(&mut dest_parent, old_mount);
                    #[cfg(feature = "dev")]
                    {
                        let _ = Reflect::delete_property(&global, &source_key);
                        let _ = Reflect::delete_property(&global, &meta_key);
                    }
                }
            }

            self.clear_dom_between_anchors(&mut dest_parent, &start, &end);
            self.current_anchor = None;
        });
    }

    /// 在父元素的两个锚点之间渲染 MountInput（支持增量更新）。
    ///
    /// 默认公开路径已经切到 MountInput-first；当前 render/patch 内核只在局部
    /// 边界恢复 mounted snapshot。
    pub fn render_between_input(
        &mut self,
        input: MountInput<A>,
        parent: &mut A::Element,
        start: A::Element,
        end: A::Element,
    ) where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        self.render_between_impl(&input, parent, start, end);
    }

    fn render_between_impl(
        &mut self,
        input: &MountInput<A>,
        parent: &mut A::Element,
        start: A::Element,
        end: A::Element,
    ) where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        self.rethrow_if_crashed_for_range();

        batch_scope(|| {
            self.current_anchor = Some(end.clone());
            self.call_hooks("before_mount");
            self.maybe_compact_range_map();
            if let Some(idx) = self.find_range_index(&start) {
                #[cfg(feature = "dev")]
                {
                    if want_log("debug", "runtime:renderBetween range_map hit") {
                        log("debug", &format!("runtime:renderBetween range_map hit idx={}", idx));
                    }
                }
                self.render_between_hit(idx, input, parent, start, end);
            } else {
                #[cfg(feature = "dev")]
                {
                    if want_log("debug", "runtime:renderBetween range_map miss") {
                        log("debug", "runtime:renderBetween range_map miss, creating new range");
                    }
                }
                self.render_between_miss(input, parent, start, end);
            }
            self.call_hooks("mounted");
            self.current_anchor = None;
        });
        #[cfg(feature = "dev")]
        {
            if want_log("debug", "runtime:renderBetween end") {
                log("debug", "runtime:renderBetween end");
            }
        }
    }
    /// 命中区间映射后的更新流程：block 替换或常规 tree patch
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn render_between_hit(
        &mut self,
        idx: usize,
        input: &MountInput<A>,
        parent: &mut A::Element,
        start: A::Element,
        end: A::Element,
    ) where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        // 取出旧挂载状态：顶层 Vapor 根走 block identity 替换，其余节点保留 tree patch
        let taken = {
            let entry = self.range_map.get_mut(idx).unwrap();
            entry.end = end.clone();
            entry.take_mount()
        };
        if let Some(old_mount) = taken {
            match old_mount {
                MountedState::Block(old_block) => {
                    let mut dest_parent = self.resolve_dest_parent_for_end(parent, &end);
                    #[cfg(feature = "dev")]
                    let (global, source_key) = {
                        let global = js_sys::global();
                        let source_key = JsValue::from_str("__rue_debug_clear_source__");
                        let _ = Reflect::set(
                            &global,
                            &source_key,
                            &JsValue::from_str("render_between_hit:block"),
                        );
                        (global, source_key)
                    };
                    self.clear_mounted_state(&mut dest_parent, MountedState::Block(old_block));
                    #[cfg(feature = "dev")]
                    {
                        let _ = Reflect::delete_property(&global, &source_key);
                    }
                    let Some(mounted) = self.mount_range_input_or_error(
                        input,
                        parent,
                        error_strings::RANGE_BLOCK_HIT_FAILED_NO_DOM,
                    ) else {
                        return self.abort_range_mount();
                    };
                    let el = self.mounted_host_for_range(&mounted);
                    self.vapor_insert_new_range(parent, &end, &el);
                    self.store_range_mount_at(
                        idx,
                        end.clone(),
                        MountedState::from_subtree_root(mounted),
                    );
                }
                old_mount => {
                    let mut parent_clone = parent.clone();
                    let mounted =
                        self.patch_root_mounted_state(old_mount, input, &mut parent_clone);
                    let entry_opt = self.range_map.get_mut(idx);
                    let entry = entry_opt.expect("range_map index must stay valid during hit");
                    entry.end = end.clone();
                    entry.store_mount(mounted);
                }
            }
        } else {
            let mut dest_parent = self.resolve_dest_parent_for_end(parent, &end);
            self.clear_dom_between_anchors(&mut dest_parent, &start, &end);
            let Some(mounted) = self.mount_range_input_or_error(
                input,
                parent,
                error_strings::RANGE_EMPTY_HIT_FAILED_NO_DOM,
            ) else {
                return self.abort_range_mount();
            };
            let el = self.mounted_host_for_range(&mounted);
            self.vapor_insert_new_range(parent, &end, &el);
            self.store_range_mount_at(idx, end.clone(), MountedState::from_subtree_root(mounted));
        }
    }

    /// 未命中区间映射：创建真实 DOM，清理区间并插入，最后记录映射
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn render_between_miss(
        &mut self,
        input: &MountInput<A>,
        parent: &mut A::Element,
        start: A::Element,
        end: A::Element,
    ) where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        if let Some(mounted) =
            self.mount_range_input_or_error(input, parent, error_strings::RANGE_MISS_FAILED_NO_DOM)
        {
            let el = self.mounted_host_for_range(&mounted);
            #[cfg(feature = "dev")]
            {
                if want_log("debug", "runtime:renderBetween create_real_dom ok") {
                    let mut tag = String::new();
                    if let Some(adapter) = self.get_dom_adapter() {
                        tag = adapter.get_tag_name(&el);
                    }
                    log("debug", &format!("runtime:renderBetween create_real_dom el_tag={}", tag));
                }
            }
            // 解析 end 的真实父元素；若已有其他范围，先清理 start 到 end 的 DOM
            let mut dest_parent = self.resolve_dest_parent_for_end(parent, &end);
            // 清理 start 与 end 之间的所有兄弟节点（不包含起止锚点）
            self.clear_dom_between_anchors(&mut dest_parent, &start, &end);
            // 插入：片段走子节点插入，普通元素直接在 end 前插入
            self.insert_range_miss_dom(&mut dest_parent, &el, &end);
            self.range_map.push(RangeMountState::new(
                start,
                end,
                MountedState::from_subtree_root(mounted),
            ));
        } else {
            self.current_anchor = None;
            return;
        }
        #[cfg(feature = "dev")]
        {
            if want_log("debug", "runtime:renderBetween push range") {
                log(
                    "debug",
                    &format!("runtime:renderBetween push range new_len={}", self.range_map.len()),
                );
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::runtime::js_adapter::JsDomAdapter;
    use crate::runtime::types::{
        ComponentProps, MountInputType, MountedPatchSubtree, MountedState, MountedSubtreeState,
        MountedTextSubtree, RangeMountState,
    };
    use js_sys::{Array, Function, Object, Reflect};
    use wasm_bindgen_test::*;

    fn set_prop(target: &Object, key: &str, value: JsValue) {
        Reflect::set(target, &JsValue::from_str(key), &value).unwrap();
    }

    fn adapter() -> JsDomAdapter {
        let obj = Object::new();
        let prelude = "\
            function sync(parent) { \
              const list = Array.from(parent && parent.children || []); \
              for (let i = 0; i < list.length; i++) { \
                if (!list[i]) continue; \
                list[i].parentNode = parent; \
                list[i].previousSibling = list[i - 1] || null; \
                list[i].nextSibling = list[i + 1] || null; \
                list[i].isConnected = parent && parent.isConnected !== false; \
              } \
            } \
            function detach(node) { \
              const old = node && node.parentNode; \
              if (old && old.children) { \
                old.children = old.children.filter(x => x !== node); \
                sync(old); \
              } \
              if (node) { node.parentNode = null; node.previousSibling = null; node.nextSibling = null; } \
            } \
            function insertOne(parent, node, before) { \
              if (!node) return; \
              parent.children = parent.children || []; \
              detach(node); \
              const idx = before ? parent.children.indexOf(before) : -1; \
              const at = idx >= 0 ? idx : parent.children.length; \
              parent.children.splice(at, 0, node); \
              sync(parent); \
            }";
        for (name, args, body) in [
            (
                "createElement",
                "tag",
                "return { tag, tagName: String(tag).toUpperCase(), children: [], nodeType: 1, nodeValue: tag, isConnected: true }",
            ),
            (
                "createTextNode",
                "text",
                "return { tag: '#text', text, nodeValue: text, children: [], nodeType: 3, isConnected: true }",
            ),
            (
                "createDocumentFragment",
                "",
                "return { tag: 'fragment', tagName: '#document-frag', children: [], nodeType: 11, isConnected: true }",
            ),
            ("isFragment", "el", "return !!el && el.tag === 'fragment'"),
            ("collectFragmentChildren", "el", "return Array.from(el && el.children || [])"),
            ("setTextContent", "el,text", "el.text = text"),
            (
                "appendChild",
                "p,c",
                &format!(
                    "{prelude} const list = c && c.tag === 'fragment' ? Array.from(c.children || []) : [c]; \
                     for (const item of list) insertOne(p, item, null); \
                     if (c && c.tag === 'fragment') c.children = [];",
                ),
            ),
            (
                "insertBefore",
                "p,c,b",
                &format!(
                    "{prelude} const list = c && c.tag === 'fragment' ? Array.from(c.children || []) : [c]; \
                     for (const item of list) insertOne(p, item, b); \
                     if (c && c.tag === 'fragment') c.children = [];",
                ),
            ),
            (
                "removeChild",
                "p,c",
                &format!(
                    "{prelude} p.children = (p.children || []).filter(x => x !== c); \
                     if (c) {{ c.parentNode = null; c.previousSibling = null; c.nextSibling = null; c.isConnected = false; }} \
                     sync(p);",
                ),
            ),
            (
                "contains",
                "p,c",
                "function has(root,node){ return root === node || Array.from(root && root.children || []).some(ch => has(ch,node)); } return has(p,c)",
            ),
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

    fn child_tags(parent: &JsValue) -> Vec<String> {
        Array::from(
            &Reflect::get(parent, &JsValue::from_str("children")).unwrap_or(Array::new().into()),
        )
        .iter()
        .map(|node| {
            Reflect::get(&node, &JsValue::from_str("tag"))
                .unwrap_or(JsValue::UNDEFINED)
                .as_string()
                .unwrap_or_default()
        })
        .collect()
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

    fn text_input(text: &str) -> MountInput<JsDomAdapter> {
        MountInput {
            r#type: MountInputType::Text(text.to_string()),
            props: ComponentProps::new(),
            children: Vec::new(),
            key: Some(text.to_string()),
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

    fn empty_host_mount() -> MountedState<JsDomAdapter> {
        MountedState::from_subtree_root(MountedSubtreeState::Text(MountedTextSubtree {
            host: None,
            key: None,
            cleanup_bucket: None,
            effect_scope_id: None,
        }))
    }

    fn component_mount(host: JsValue) -> MountedState<JsDomAdapter> {
        MountedState::from_subtree_root(MountedSubtreeState::Patch(
            MountedPatchSubtree::new_component(
                Function::new_no_args("return null").into(),
                Some(host),
                None,
                Vec::new(),
                Vec::new(),
                Vec::new(),
                Vec::new(),
                Vec::new(),
                None,
                None,
            ),
        ))
    }

    fn range_parent(rue: &mut Rue<JsDomAdapter>) -> (JsValue, JsValue, JsValue) {
        let mut parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
        let start = rue.get_dom_adapter_mut().unwrap().create_element("start");
        let end = rue.get_dom_adapter_mut().unwrap().create_element("end");
        rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &start);
        rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &end);
        (parent, start, end)
    }

    #[wasm_bindgen_test]
    fn render_between_covers_miss_empty_hit_and_block_hit_error_paths() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let (mut parent, start, end) = range_parent(&mut rue);

        rue.render_between_input(phantom_input(), &mut parent, start.clone(), end.clone());
        assert!(rue.last_error.is_some());
        assert_eq!(rue.range_mount_count(), 0);

        rue.last_error = None;
        rue.render_between_input(text_input("first"), &mut parent, start.clone(), end.clone());
        assert_eq!(rue.range_mount_count(), 1);
        rue.clear_range(&mut parent, start.clone(), end.clone());
        rue.render_between_input(phantom_input(), &mut parent, start.clone(), end.clone());
        assert!(rue.last_error.is_some());

        rue.last_error = None;
        let (mut parent2, start2, end2) = range_parent(&mut rue);
        let host = rue.get_dom_adapter_mut().unwrap().create_element("host");
        rue.render_between_input(vapor_input(host), &mut parent2, start2.clone(), end2.clone());
        rue.render_between_input(phantom_input(), &mut parent2, start2, end2);
        assert!(rue.last_error.is_some());
    }

    #[wasm_bindgen_test]
    fn render_between_internal_hit_edges_cover_empty_and_missing_host_paths() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let (mut parent, start, end) = range_parent(&mut rue);

        rue.range_map.push(RangeMountState {
            start: start.clone(),
            end: end.clone(),
            mounted: None,
        });
        rue.render_between_hit(
            0,
            &text_input("empty-hit"),
            &mut parent,
            start.clone(),
            end.clone(),
        );
        assert_eq!(rue.range_mount_count(), 1);
        assert_eq!(child_tags(&parent), vec!["start", "#text", "end"]);

        let (mut parent2, start2, end2) = range_parent(&mut rue);
        rue.range_map.clear();
        rue.range_map.push(RangeMountState::new(start2.clone(), end2.clone(), empty_host_mount()));
        rue.render_between_hit(
            0,
            &text_input("missing-host-hit"),
            &mut parent2,
            start2.clone(),
            end2.clone(),
        );
        assert_eq!(rue.range_mount_count(), 1);

        rue.range_map.clear();
        rue.range_map.push(RangeMountState {
            start: start2.clone(),
            end: end2.clone(),
            mounted: None,
        });
        rue.last_error = Some(JsValue::from_str("empty-hit-last-error"));
        rue.render_between_hit(0, &phantom_input(), &mut parent2, start2, end2);
        assert_eq!(
            rue.last_error.as_ref().and_then(JsValue::as_string).as_deref(),
            Some("empty-hit-last-error")
        );
    }

    #[wasm_bindgen_test]
    fn render_between_hit_covers_non_block_patch_and_existing_error_paths() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let (mut parent, start, end) = range_parent(&mut rue);
        let old_host = rue.get_dom_adapter_mut().unwrap().create_element("old-component-host");
        rue.get_dom_adapter_mut().unwrap().insert_before(&mut parent, &old_host, &end);

        rue.range_map.push(RangeMountState::new(
            start.clone(),
            end.clone(),
            component_mount(old_host),
        ));
        rue.render_between_hit(0, &text_input("component-next"), &mut parent, start, end);
        assert_eq!(rue.range_mount_count(), 1);

        let (mut block_parent, block_start, block_end) = range_parent(&mut rue);
        let block_host = rue.get_dom_adapter_mut().unwrap().create_element("block-host");
        rue.range_map.clear();
        rue.range_map.push(RangeMountState::new(
            block_start.clone(),
            block_end.clone(),
            MountedState::from_subtree_root(MountedSubtreeState::Text(MountedTextSubtree {
                host: Some(block_host),
                key: None,
                cleanup_bucket: None,
                effect_scope_id: None,
            })),
        ));
        rue.last_error = Some(JsValue::from_str("block-hit-last-error"));
        rue.render_between_hit(0, &phantom_input(), &mut block_parent, block_start, block_end);
        assert_eq!(
            rue.last_error.as_ref().and_then(JsValue::as_string).as_deref(),
            Some("block-hit-last-error")
        );

        let (mut miss_parent, miss_start, miss_end) = range_parent(&mut rue);
        rue.range_map.clear();
        rue.last_error = Some(JsValue::from_str("miss-last-error"));
        rue.render_between_miss(&phantom_input(), &mut miss_parent, miss_start, miss_end);
        assert_eq!(
            rue.last_error.as_ref().and_then(JsValue::as_string).as_deref(),
            Some("miss-last-error")
        );
    }

    #[wasm_bindgen_test]
    fn render_between_hit_failure_paths_clear_current_anchor_without_adapter() {
        let mut rue = Rue::<JsDomAdapter>::new();
        let mut parent: JsValue = Object::new().into();
        let start: JsValue = Object::new().into();
        let end: JsValue = Object::new().into();
        let old_host: JsValue = Object::new().into();

        rue.current_anchor = Some(end.clone());
        rue.range_map.push(RangeMountState::new(
            start.clone(),
            end.clone(),
            MountedState::from_subtree_root(MountedSubtreeState::Text(MountedTextSubtree {
                host: Some(old_host),
                key: None,
                cleanup_bucket: None,
                effect_scope_id: None,
            })),
        ));
        rue.render_between_hit(
            0,
            &text_input("block-fail"),
            &mut parent,
            start.clone(),
            end.clone(),
        );
        assert!(rue.last_error.is_some());
        assert!(rue.current_anchor.is_none());

        rue.last_error = None;
        rue.current_anchor = Some(end.clone());
        rue.range_map.clear();
        rue.range_map.push(RangeMountState {
            start: start.clone(),
            end: end.clone(),
            mounted: None,
        });
        rue.render_between_hit(0, &text_input("empty-fail"), &mut parent, start, end);
        assert!(rue.last_error.is_some());
        assert!(rue.current_anchor.is_none());

        rue.last_error = None;
        let miss_start: JsValue = Object::new().into();
        let miss_end: JsValue = Object::new().into();
        rue.current_anchor = Some(miss_end.clone());
        rue.render_between_miss(&text_input("miss-fail"), &mut parent, miss_start, miss_end);
        assert!(rue.last_error.is_some());
        assert!(rue.current_anchor.is_none());
    }

    #[wasm_bindgen_test]
    fn clear_range_covers_empty_populated_and_already_cleared_entries() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let (mut parent, start, end) = range_parent(&mut rue);

        rue.clear_range(&mut parent, start.clone(), end.clone());
        assert_eq!(child_tags(&parent), vec!["start", "end"]);

        rue.render_between_input(text_input("clear-me"), &mut parent, start.clone(), end.clone());
        assert_eq!(child_tags(&parent), vec!["start", "#text", "end"]);
        rue.clear_range(&mut parent, start.clone(), end.clone());
        assert_eq!(child_tags(&parent), vec!["start", "end"]);
        assert_eq!(rue.range_mount_count(), 1);

        rue.clear_range(&mut parent, start, end);
        assert_eq!(child_tags(&parent), vec!["start", "end"]);
    }

    #[wasm_bindgen_test]
    fn render_between_covers_fragment_miss_insertion() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let (mut parent, start, end) = range_parent(&mut rue);

        let fragment = Object::new();
        set_prop(&fragment, "tag", JsValue::from_str("fragment"));
        let children = Array::new();
        let a = rue.get_dom_adapter_mut().unwrap().create_element("a");
        let b = rue.get_dom_adapter_mut().unwrap().create_element("b");
        children.push(&a);
        children.push(&b);
        set_prop(&fragment, "children", children.into());

        rue.render_between_input(vapor_input(fragment.into()), &mut parent, start, end);

        assert_eq!(rue.range_mount_count(), 1);
    }

    #[wasm_bindgen_test]
    #[should_panic]
    fn render_between_panics_when_runtime_is_marked_crashed_without_last_error() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.crashed = true;
        let mut parent = Object::new().into();
        let start = Object::new().into();
        let end = Object::new().into();
        rue.render_between_input(phantom_input(), &mut parent, start, end);
    }

    #[wasm_bindgen_test]
    #[should_panic]
    fn clear_range_panics_when_runtime_is_marked_crashed_without_last_error() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.crashed = true;
        let mut parent = Object::new().into();
        let start = Object::new().into();
        let end = Object::new().into();
        rue.clear_range(&mut parent, start, end);
    }
}
