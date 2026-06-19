/*
替换辅助工具

封装父节点解析、锚点插入、片段节点清理等低层操作。
patch_replace 与 range/static 渲染都会依赖这些原语来保证 DOM 位置稳定。
*/
use super::super::Rue;
use super::super::types::{ComponentProps, MountLifecycleRecord, MountedState};
use crate::runtime::dom_adapter::DomAdapter;
use crate::runtime::props::{Props as RuntimeProps, patch_props};
use js_sys::JsString;
use js_sys::Reflect;
#[cfg(any(feature = "dev", test))]
use js_sys::{Array, Object};
use wasm_bindgen::{JsCast, JsValue};

const RUE_KEEP_ALIVE_RANGE_KEY: &str = "__rue_keep_alive_range__";

fn is_keep_alive_range_start(node: &JsValue) -> bool {
    Reflect::get(node, &JsValue::from_str(RUE_KEEP_ALIVE_RANGE_KEY)).ok().and_then(|v| v.as_bool())
        == Some(true)
}

// 替换与插入辅助工具：
// - resolve_dest_parent：当父为片段或锚点/旧 el 不在父内时，解析真实父节点。
// - insert_with_anchor_opt：依据锚点存在与否选择前插或尾部追加。
// - clear_fragment_nodes：根据 mounted snapshot 中记录的 fragment node identity 移除旧子节点。
// - clear_old_el_if_present：若旧 el 仍在父内，执行移除以避免重复。
// - insert_fragment_children：收集片段子节点并逐一插入到目标父节点。

impl<A: DomAdapter> Rue<A>
where
    A::Element: Clone,
{
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn contextual_insert_anchor(
        &self,
        parent: &A::Element,
        fallback: &Option<A::Element>,
    ) -> Option<A::Element> {
        if let Some(anchor) = self.current_anchor.clone() {
            if let Some(adapter) = self.get_dom_adapter() {
                if adapter.is_fragment(parent) || adapter.contains(parent, &anchor) {
                    return Some(anchor);
                }
            } else {
                return Some(anchor);
            }
        }

        fallback.clone()
    }

    #[cfg(any(feature = "dev", test))]
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn debug_record_cleared_sidebar(&self, parent: &A::Element, host: &A::Element)
    where
        <A as DomAdapter>::Element: Into<JsValue>,
    {
        let host_js: JsValue = host.clone().into();
        let host_class = Reflect::get(&host_js, &JsValue::from_str("className"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .unwrap_or_default();
        if !host_class.contains("sidebar-playground") {
            return;
        }

        let global = js_sys::global();
        let enabled = Reflect::get(&global, &JsValue::from_str("__rue_debug_clear_enabled__"))
            .unwrap_or(JsValue::FALSE);
        if !enabled.as_bool().unwrap_or(false) {
            return;
        }

        let key = JsValue::from_str("__rue_debug_clear__");
        let existing = Reflect::get(&global, &key).unwrap_or(JsValue::UNDEFINED);
        let array = if Array::is_array(&existing) { Array::from(&existing) } else { Array::new() };
        let record = Object::new();
        let parent_js: JsValue = parent.clone().into();
        let _ =
            Reflect::set(&record, &JsValue::from_str("hostClass"), &JsValue::from_str(&host_class));
        let _ = Reflect::set(
            &record,
            &JsValue::from_str("parentClass"),
            &Reflect::get(&parent_js, &JsValue::from_str("className"))
                .unwrap_or(JsValue::UNDEFINED),
        );
        let source = Reflect::get(&global, &JsValue::from_str("__rue_debug_clear_source__"))
            .unwrap_or(JsValue::UNDEFINED);
        if !source.is_undefined() && !source.is_null() {
            let _ = Reflect::set(&record, &JsValue::from_str("source"), &source);
        }
        let meta = Reflect::get(&global, &JsValue::from_str("__rue_debug_clear_meta__"))
            .unwrap_or(JsValue::UNDEFINED);
        if !meta.is_undefined() && !meta.is_null() {
            let _ = Reflect::set(&record, &JsValue::from_str("meta"), &meta);
        }
        array.push(&record);
        let _ = Reflect::set(&global, &key, &array.into());
    }

    #[cfg(any(feature = "dev", test))]
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn debug_record_component_anchor_owner(
        &self,
        parent: &A::Element,
        host: Option<&A::Element>,
        fragment_nodes: &[A::Element],
    ) where
        <A as DomAdapter>::Element: Into<JsValue>,
    {
        let global = js_sys::global();
        let enabled = Reflect::get(&global, &JsValue::from_str("__rue_debug_clear_enabled__"))
            .unwrap_or(JsValue::FALSE);
        if !enabled.as_bool().unwrap_or(false) {
            return;
        }

        let has_component_anchor = fragment_nodes.iter().any(|node| {
            let node_js: JsValue = node.clone().into();
            Reflect::get(&node_js, &JsValue::from_str("nodeValue"))
                .unwrap_or(JsValue::UNDEFINED)
                .as_string()
                .is_some_and(|value| value == "rue:component:anchor")
        });
        if !has_component_anchor {
            return;
        }

        let key = JsValue::from_str("__rue_debug_clear__");
        let existing = Reflect::get(&global, &key).unwrap_or(JsValue::UNDEFINED);
        let array = if Array::is_array(&existing) { Array::from(&existing) } else { Array::new() };
        let record = Object::new();
        let parent_js: JsValue = parent.clone().into();
        let _ = Reflect::set(
            &record,
            &JsValue::from_str("kind"),
            &JsValue::from_str("component-anchor-owner"),
        );
        let _ = Reflect::set(
            &record,
            &JsValue::from_str("parentClass"),
            &Reflect::get(&parent_js, &JsValue::from_str("className"))
                .unwrap_or(JsValue::UNDEFINED),
        );
        let _ = Reflect::set(
            &record,
            &JsValue::from_str("fragmentCount"),
            &JsValue::from_f64(fragment_nodes.len() as f64),
        );
        if let Some(host) = host {
            let host_js: JsValue = host.clone().into();
            let _ = Reflect::set(
                &record,
                &JsValue::from_str("hostClass"),
                &Reflect::get(&host_js, &JsValue::from_str("className"))
                    .unwrap_or(JsValue::UNDEFINED),
            );
            let _ = Reflect::set(
                &record,
                &JsValue::from_str("hostNodeName"),
                &Reflect::get(&host_js, &JsValue::from_str("nodeName"))
                    .unwrap_or(JsValue::UNDEFINED),
            );
        }
        let source = Reflect::get(&global, &JsValue::from_str("__rue_debug_clear_source__"))
            .unwrap_or(JsValue::UNDEFINED);
        if !source.is_undefined() && !source.is_null() {
            let _ = Reflect::set(&record, &JsValue::from_str("source"), &source);
        }
        let meta = Reflect::get(&global, &JsValue::from_str("__rue_debug_clear_meta__"))
            .unwrap_or(JsValue::UNDEFINED);
        if !meta.is_undefined() && !meta.is_null() {
            let _ = Reflect::set(&record, &JsValue::from_str("meta"), &meta);
        }
        array.push(&record);
        let _ = Reflect::set(&global, &key, &array.into());
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn clear_mounted_block_dom(
        &mut self,
        parent: &mut A::Element,
        host: Option<&A::Element>,
        fragment_nodes: &[A::Element],
    ) where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        if !fragment_nodes.is_empty() {
            for node_el in fragment_nodes.iter() {
                self.clear_anchor_entry_if_present(parent, node_el);
                self.clear_range_entry_if_present(parent, node_el);
                if let Some(adapter) = self.get_dom_adapter_mut() {
                    if adapter.contains(parent, node_el) {
                        let mut p2 = parent.clone();
                        adapter.remove_child(&mut p2, node_el);
                    }
                }
            }
            return;
        }

        if let Some(host_el) = host {
            self.clear_old_el_if_present(parent, host_el);
        }
    }

    #[allow(dead_code)]
    pub(super) fn clear_mounted_dom_identity(
        &mut self,
        parent: &mut A::Element,
        host: Option<&A::Element>,
        fragment_nodes: &[A::Element],
    ) where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        self.clear_mounted_block_dom(parent, host, fragment_nodes);
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub(crate) fn clear_mounted_state(&mut self, parent: &mut A::Element, mounted: MountedState<A>)
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        let (lifecycle, host, fragment_nodes, props) = mounted.into_dom_identity();

        #[cfg(any(feature = "dev", test))]
        {
            if let Some(host_ref) = host.as_ref() {
                self.debug_record_cleared_sidebar(parent, host_ref);
            }
            self.debug_record_component_anchor_owner(parent, host.as_ref(), &fragment_nodes);
        }

        self.invoke_before_unmount_record(&lifecycle);
        self.reset_mounted_props(host.as_ref(), &props);
        self.clear_mounted_block_dom(parent, host.as_ref(), &fragment_nodes);
        self.invoke_unmounted_record(&lifecycle);
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn reset_mounted_props(&mut self, host: Option<&A::Element>, old_props: &ComponentProps)
    where
        <A as DomAdapter>::Element: Clone,
    {
        if old_props.is_empty() {
            return;
        }

        let Some(host) = host else {
            return;
        };
        if let Some(adapter) = self.get_dom_adapter_mut() {
            let mut host = host.clone();
            let _ = patch_props(adapter, &mut host, old_props, &RuntimeProps::new());
        }
    }

    /// 若某个待删除的片段节点本身是 renderAnchor 管理的锚点，
    /// 需要先完整卸载该锚点关联的 mounted subtree，再移除锚点本身。
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn clear_anchor_entry_if_present(&mut self, parent: &mut A::Element, anchor: &A::Element)
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        let idx = {
            let anchor_js: JsValue = anchor.clone().into();
            let mut hit = None;
            for (i, entry) in self.anchor_map.iter().enumerate() {
                let av: JsValue = entry.anchor.clone().into();
                if is_keep_alive_range_start(&av) {
                    continue;
                }
                if js_sys::Object::is(&av, &anchor_js) {
                    hit = Some(i);
                    break;
                }
                if let Some(adapter) = self.get_dom_adapter() {
                    if adapter.contains(&entry.anchor, anchor)
                        && adapter.contains(anchor, &entry.anchor)
                    {
                        hit = Some(i);
                        break;
                    }
                }
            }
            hit
        };

        let Some(idx) = idx else {
            return;
        };

        let taken = {
            let entry = self.anchor_map.get_mut(idx).unwrap();
            entry.take_mount()
        };

        let Some(old_mount) = taken else {
            return;
        };

        #[cfg(any(feature = "dev", test))]
        let (global, source_key, meta_key) = {
            let global = js_sys::global();
            let source_key = JsValue::from_str("__rue_debug_clear_source__");
            let meta_key = JsValue::from_str("__rue_debug_clear_meta__");
            let anchor_js: JsValue = anchor.clone().into();
            let _ = Reflect::set(
                &global,
                &source_key,
                &JsValue::from_str("clear_anchor_entry_if_present"),
            );
            let _ = Reflect::set(
                &global,
                &meta_key,
                &Reflect::get(&anchor_js, &JsValue::from_str("nodeValue"))
                    .unwrap_or(JsValue::UNDEFINED),
            );
            (global, source_key, meta_key)
        };
        self.clear_mounted_state(parent, old_mount);
        #[cfg(any(feature = "dev", test))]
        {
            let _ = Reflect::delete_property(&global, &source_key);
            let _ = Reflect::delete_property(&global, &meta_key);
        }
    }

    /// 若某个待删除的片段节点本身是 renderBetween 管理的 start 锚点，
    /// 需要先完整卸载该范围关联的 mounted subtree，再移除 start/end 与范围内容。
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn clear_range_entry_if_present(&mut self, parent: &mut A::Element, start: &A::Element)
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        let idx = {
            let start_js: JsValue = start.clone().into();
            let mut hit = None;
            for (i, entry) in self.range_map.iter().enumerate() {
                let sv: JsValue = entry.start.clone().into();
                if is_keep_alive_range_start(&sv) {
                    continue;
                }
                if js_sys::Object::is(&sv, &start_js) {
                    hit = Some(i);
                    break;
                }
                if let Some(adapter) = self.get_dom_adapter() {
                    if adapter.contains(&entry.start, start)
                        && adapter.contains(start, &entry.start)
                    {
                        hit = Some(i);
                        break;
                    }
                }
            }
            hit
        };

        let Some(idx) = idx else {
            return;
        };

        let taken = {
            let entry = self.range_map.get_mut(idx).unwrap();
            entry.take_mount()
        };

        let Some(old_mount) = taken else {
            return;
        };

        #[cfg(any(feature = "dev", test))]
        let (global, source_key, meta_key) = {
            let global = js_sys::global();
            let source_key = JsValue::from_str("__rue_debug_clear_source__");
            let meta_key = JsValue::from_str("__rue_debug_clear_meta__");
            let start_js: JsValue = start.clone().into();
            let _ = Reflect::set(
                &global,
                &source_key,
                &JsValue::from_str("clear_range_entry_if_present"),
            );
            let _ = Reflect::set(
                &global,
                &meta_key,
                &Reflect::get(&start_js, &JsValue::from_str("nodeValue"))
                    .unwrap_or(JsValue::UNDEFINED),
            );
            (global, source_key, meta_key)
        };
        self.clear_mounted_state(parent, old_mount);
        #[cfg(any(feature = "dev", test))]
        {
            let _ = Reflect::delete_property(&global, &source_key);
            let _ = Reflect::delete_property(&global, &meta_key);
        }
    }

    // 片段子节点插入（优先 end 锚点）：
    // - 设计目的：RouterView 等区间渲染场景中，确保片段的真实子节点严格插入到 end 注释之前，
    //   避免因父为片段或 contains(end) 为 false 而错误地追加到区间外部。
    // - 行为：若存在有效 end 锚点，则按 end.parentNode 解析真实父节点，
    //   对每个子节点执行 insertBefore(realParent, child, end)，否则回退到锚点/尾部插入。
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub(crate) fn insert_fragment_children_preferring_end(
        &mut self,
        parent: &mut A::Element,
        fragment_el: &A::Element,
        insert_anchor: &Option<A::Element>,
    ) where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        // 计算有效锚点：优先当前区间的 end 注释，其次使用外部传入的插入锚点
        let effective_anchor = self.contextual_insert_anchor(parent, insert_anchor);
        if let Some(end) = effective_anchor.clone() {
            if let Some(a) = self.get_dom_adapter_mut() {
                // 解析真实父节点：当父为片段或父不包含 end 时，读取 end.parentNode 作为插入的参照父
                let mut real_parent = parent.clone();
                if a.is_fragment(&real_parent) || !a.contains(&real_parent, &end) {
                    let pn =
                        js_sys::Reflect::get(&end.clone().into(), &JsValue::from_str("parentNode"))
                            .unwrap_or(JsValue::UNDEFINED);
                    if !pn.is_undefined() && !pn.is_null() {
                        real_parent = pn.into();
                    }
                }
                // 收集片段的真实子节点列表，逐一插入到 end 之前（若 end 不在父内则尾部追加）
                let nodes = a.collect_fragment_children(fragment_el);
                for n in nodes.iter() {
                    if a.contains(&real_parent, &end) {
                        a.insert_before(&mut real_parent, n, &end);
                    } else {
                        a.append_child(&mut real_parent, n);
                    }
                }
            }
        } else {
            // 无有效 end：回退到原有的按锚点/尾部的插入策略
            self.insert_fragment_children(parent, fragment_el, &effective_anchor);
        }
    }

    /// 清理当前区间（start/end 锚点之间）的所有兄弟节点，保留锚点本身
    ///
    /// 说明：
    /// - 优先依据当前 end 锚点（self.current_anchor）；向前查找就近的 start 锚点；
    /// - 支持识别 'rue-router-view-start' / 'rue-use-component-start' / 'rue:component:start'；
    /// - 当父为片段或不包含 end 时，以 end.parentNode 作为真实父；
    /// - 仅移除 start.nextSibling 到 end 之前的所有节点。
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub(crate) fn clear_current_named_range_if_present(&mut self, parent: &mut A::Element)
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        let end_opt = self.current_anchor.clone();
        if end_opt.is_none() {
            return;
        }
        let end = end_opt.unwrap();
        let mut real_parent = parent.clone();
        if let Some(adapter) = self.get_dom_adapter() {
            if adapter.is_fragment(&real_parent) || !adapter.contains(&real_parent, &end) {
                let pn =
                    js_sys::Reflect::get(&end.clone().into(), &JsValue::from_str("parentNode"))
                        .unwrap_or(JsValue::UNDEFINED);
                if !pn.is_undefined() && !pn.is_null() {
                    real_parent = pn.into();
                }
            }
        }

        let end_js: JsValue = end.clone().into();
        let mut prev = js_sys::Reflect::get(&end_js, &JsValue::from_str("previousSibling"))
            .unwrap_or(JsValue::UNDEFINED);
        let mut start_opt: Option<A::Element> = None;
        while !prev.is_undefined() && !prev.is_null() {
            let val = js_sys::Reflect::get(&prev, &JsValue::from_str("nodeValue"))
                .unwrap_or(JsValue::UNDEFINED);
            let s = if val.is_string() {
                val.unchecked_ref::<JsString>().into()
            } else {
                JsValue::UNDEFINED
            }
            .as_string()
            .unwrap_or_default();
            if s == "rue-router-view-start"
                || s == "rue-use-component-start"
                || s == "rue:component:start"
            {
                start_opt = Some(prev.clone().into());
                break;
            }
            prev = js_sys::Reflect::get(&prev, &JsValue::from_str("previousSibling"))
                .unwrap_or(JsValue::UNDEFINED);
        }

        if let Some(start) = start_opt {
            let start_js: JsValue = start.clone().into();
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

                let idx = {
                    let mut hit: Option<usize> = None;
                    let node_js: JsValue = node_el.clone().into();
                    for (i, entry) in self.range_map.iter().enumerate() {
                        let sv: JsValue = entry.start.clone().into();
                        if is_keep_alive_range_start(&sv) {
                            continue;
                        }
                        if js_sys::Object::is(&sv, &node_js) {
                            hit = Some(i);
                            break;
                        }
                    }
                    hit
                };
                if let Some(idx) = idx {
                    let taken = {
                        let entry = self.range_map.get_mut(idx).unwrap();
                        entry.take_mount()
                    };
                    if let Some(mount) = taken {
                        let lifecycle = mount.into_lifecycle();
                        self.invoke_before_unmount_record(&lifecycle);
                        pending_unmounted.push(lifecycle);
                    }
                }

                if let Some(adapter) = self.get_dom_adapter_mut() {
                    if adapter.contains(&real_parent, &node_el) {
                        let mut p2 = real_parent.clone();
                        adapter.remove_child(&mut p2, &node_el);
                    }
                }
                cur = next;
            }

            for record in pending_unmounted.into_iter() {
                self.invoke_unmounted_record(&record);
            }
        }
    }

    // 普通元素插入（优先 end 锚点）：
    // - 设计目的：组件替换时，新宿主为普通元素的场景，保证插入位置精确在 end 注释之前，
    //   规避因父为片段或 contains(end) 判定不稳定导致的外部追加。
    // - 行为：若存在 end，则解析真实父并优先 insertBefore；否则回退到锚点/尾部插入。
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub(crate) fn insert_with_end_anchor_opt(
        &mut self,
        parent: &mut A::Element,
        child: &A::Element,
        insert_anchor: &Option<A::Element>,
    ) where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        // 计算有效锚点：优先使用当前区间 end，其次使用外部传入的锚点
        let effective_anchor = self.contextual_insert_anchor(parent, insert_anchor);
        if let Some(end) = effective_anchor.clone() {
            if let Some(a) = self.get_dom_adapter_mut() {
                // 解析真实父节点：当父为片段或父不包含 end 时，读取 end.parentNode
                let mut real_parent = parent.clone();
                if a.is_fragment(&real_parent) || !a.contains(&real_parent, &end) {
                    let pn =
                        js_sys::Reflect::get(&end.clone().into(), &JsValue::from_str("parentNode"))
                            .unwrap_or(JsValue::UNDEFINED);
                    if !pn.is_undefined() && !pn.is_null() {
                        real_parent = pn.into();
                    }
                }
                // 插入策略：优先 insertBefore 到 end 之前；若 end 不在父内则尾部追加
                if a.contains(&real_parent, &end) {
                    a.insert_before(&mut real_parent, child, &end);
                } else {
                    a.append_child(&mut real_parent, child);
                }
                return;
            }
        }
        // 无有效 end：退回到原 insert_with_anchor_opt 的行为（锚点在父内则前插，否则尾部）
        self.insert_with_anchor_opt(parent, child, &effective_anchor);
    }

    /// 解析真实父元素：当父为片段或不包含旧 el/锚点时，溯源 parentNode
    ///
    /// 参数：
    /// - parent：当前父元素（可能为片段）
    /// - old_el/anchor_opt：用于判断是否需要解析真实父节点
    /// 返回：
    /// - 真实的父元素，用于实际插入/移除操作
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub(super) fn resolve_dest_parent(
        &mut self,
        parent: &mut A::Element,
        old_el: Option<A::Element>,
        anchor_opt: Option<A::Element>,
    ) -> A::Element
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        // 复制 parent：后续可能解析为真实父节点（避免直接修改传入的引用）
        let mut dest_parent = parent.clone();
        let had_old_el = old_el.is_some();
        if let Some(adapter) = self.get_dom_adapter_mut() {
            if let Some(el_old) = old_el {
                // 若父为片段或父不包含旧 el，尝试从旧 el 上解析 parentNode
                if adapter.is_fragment(&dest_parent) || !adapter.contains(&dest_parent, &el_old) {
                    let pn = js_sys::Reflect::get(
                        &el_old.clone().into(),
                        &JsValue::from_str("parentNode"),
                    )
                    .unwrap_or(JsValue::UNDEFINED);
                    if !pn.is_undefined() && !pn.is_null() {
                        dest_parent = pn.into();
                    }
                }
            }
            if let Some(anchor) = anchor_opt {
                // 仅在当前父本身是片段，或根本没有旧 el 可用于定位时，才允许借助锚点反推真实父。
                // 对普通元素子节点 patch（如 TransitionGroup 内部的 ul > li），外层 renderAnchor 的锚点
                // 不属于当前父元素；若这里继续用锚点 parentNode 覆盖 dest_parent，会把真实父从 ul
                // 错改成外层容器，导致 removeChild 静默失败并不断累积重复节点。
                if adapter.is_fragment(&dest_parent)
                    || (!had_old_el && !adapter.contains(&dest_parent, &anchor))
                {
                    let pn = js_sys::Reflect::get(
                        &anchor.clone().into(),
                        &JsValue::from_str("parentNode"),
                    )
                    .unwrap_or(JsValue::UNDEFINED);
                    if !pn.is_undefined() && !pn.is_null() {
                        dest_parent = pn.into();
                    }
                }
            }
        }
        dest_parent
    }

    /// 依据锚点选择 insert_before 或 append_child 的插入辅助
    ///
    /// 参数：
    /// - parent：父元素
    /// - child：待插入的子元素
    /// - anchor_opt：插入锚点（存在且包含于父时采用前插）
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub(super) fn insert_with_anchor_opt(
        &mut self,
        parent: &mut A::Element,
        child: &A::Element,
        anchor_opt: &Option<A::Element>,
    ) {
        // 依据锚点存在与否与父是否包含锚点，选择 insert_before 或 append_child
        if let Some(adapter) = self.get_dom_adapter_mut() {
            if let Some(anchor) = anchor_opt {
                if adapter.contains(parent, anchor) {
                    adapter.insert_before(parent, child, anchor);
                } else {
                    adapter.append_child(parent, child);
                }
            } else {
                adapter.append_child(parent, child);
            }
        }
    }

    /// 清理 mounted snapshot 记录的片段子节点
    ///
    /// 参数：
    /// - parent：父元素（移除操作的作用域）
    /// - fragment_nodes：旧侧 snapshot 中记录的真实片段子节点 identity
    /// 返回：
    /// - 是否进行了清理（存在且成功移除）
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub(crate) fn clear_fragment_nodes(
        &mut self,
        parent: &mut A::Element,
        fragment_nodes: &[A::Element],
    ) -> bool
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        // 根据 mounted snapshot 中记录的 fragment node identity 清理旧子节点；返回是否进行了清理
        let mut cleared = false;
        if !fragment_nodes.is_empty() {
            for node_el in fragment_nodes.iter() {
                self.clear_anchor_entry_if_present(parent, node_el);
                self.clear_range_entry_if_present(parent, node_el);
                if let Some(adapter) = self.get_dom_adapter_mut() {
                    if adapter.contains(parent, node_el) {
                        let mut p2 = parent.clone();
                        adapter.remove_child(&mut p2, node_el);
                        cleared = true;
                    }
                }
            }
        }
        cleared
    }

    /// 若旧 el 仍在父元素内，则执行移除以避免重复
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub(super) fn clear_old_el_if_present(&mut self, parent: &mut A::Element, old_el: &A::Element) {
        // 旧 el 清理：避免旧占位影响新片段子节点插入
        if let Some(adapter) = self.get_dom_adapter_mut() {
            if adapter.contains(parent, old_el) {
                let mut p2 = parent.clone();
                adapter.remove_child(&mut p2, old_el);
            }
        }
    }

    /// 将片段的子节点逐一插入到目标父元素
    ///
    /// 参数：
    /// - parent：目标父元素
    /// - fragment_el：片段占位元素
    /// - anchor_opt：插入锚点（决定子节点的插入位置）
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub(crate) fn insert_fragment_children(
        &mut self,
        parent: &mut A::Element,
        fragment_el: &A::Element,
        anchor_opt: &Option<A::Element>,
    ) {
        // 将片段的子节点逐一插入目标父节点；插入位置由锚点决定
        if let Some(adapter) = self.get_dom_adapter_mut() {
            let nodes = adapter.collect_fragment_children(fragment_el);
            for n in nodes.iter() {
                self.insert_with_anchor_opt(parent, n, anchor_opt);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::runtime::js_adapter::JsDomAdapter;
    use crate::runtime::types::{
        AnchorMountState, MountedState, MountedSubtreeState, MountedVaporSubtree,
        MountedVaporSubtreeType, RangeMountState,
    };
    use js_sys::{Array, Function, Object};
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
            "function has(root,node){ return root === node || (!!root && !!node && root.alias && root.alias === node.alias) || Array.from(root && root.children || []).some(ch => has(ch,node)); } return has(p,c)",
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

    fn node(tag: &str) -> JsValue {
        let obj = Object::new();
        Reflect::set(&obj, &JsValue::from_str("tag"), &JsValue::from_str(tag)).unwrap();
        Reflect::set(&obj, &JsValue::from_str("children"), &Array::new().into()).unwrap();
        obj.into()
    }

    fn alias_node(tag: &str, alias: &str) -> JsValue {
        let node = node(tag);
        Reflect::set(&node, &JsValue::from_str("alias"), &JsValue::from_str(alias)).unwrap();
        node
    }

    fn set_children(parent: &JsValue, children: &[JsValue]) {
        let arr = Array::new();
        for (index, child) in children.iter().enumerate() {
            let prev = if index > 0 { children[index - 1].clone() } else { JsValue::NULL };
            let next = children.get(index + 1).cloned().unwrap_or(JsValue::NULL);
            arr.push(child);
            Reflect::set(child, &JsValue::from_str("parentNode"), parent).unwrap();
            Reflect::set(child, &JsValue::from_str("previousSibling"), &prev).unwrap();
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

    fn mounted_vapor(host: &JsValue) -> MountedState<JsDomAdapter> {
        MountedState::from_subtree_root(MountedSubtreeState::Vapor(MountedVaporSubtree {
            r#type: MountedVaporSubtreeType::Vapor,
            host: Some(host.clone()),
            key: None,
            fragment_nodes: Vec::new(),
            props: Default::default(),
            cleanup_bucket: None,
            effect_scope_id: None,
        }))
    }

    #[wasm_bindgen_test]
    fn clear_anchor_and_range_entries_take_nested_mounts_and_record_sources() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let mut parent = node("parent");
        let anchor = node("anchor");
        let range_start = node("range-start");
        let range_end = node("range-end");
        let anchor_host = node("anchor-host");
        let range_host = node("range-host");
        Reflect::set(&anchor, &JsValue::from_str("nodeValue"), &JsValue::from_str("anchor-meta"))
            .unwrap();
        Reflect::set(
            &range_start,
            &JsValue::from_str("nodeValue"),
            &JsValue::from_str("range-meta"),
        )
        .unwrap();
        Reflect::set(
            &anchor_host,
            &JsValue::from_str("className"),
            &JsValue::from_str("sidebar-playground anchor"),
        )
        .unwrap();
        Reflect::set(
            &range_host,
            &JsValue::from_str("className"),
            &JsValue::from_str("sidebar-playground range"),
        )
        .unwrap();
        set_children(
            &parent,
            &[
                anchor_host.clone(),
                anchor.clone(),
                range_host.clone(),
                range_start.clone(),
                range_end.clone(),
            ],
        );

        rue.anchor_map.push(AnchorMountState::new(anchor.clone(), mounted_vapor(&anchor_host)));
        rue.range_map.push(RangeMountState::new(
            range_start.clone(),
            range_end,
            mounted_vapor(&range_host),
        ));

        let global = js_sys::global();
        Reflect::set(&global, &JsValue::from_str("__rue_debug_clear_enabled__"), &JsValue::TRUE)
            .unwrap();
        Reflect::delete_property(&global, &JsValue::from_str("__rue_debug_clear__")).unwrap();

        rue.clear_anchor_entry_if_present(&mut parent, &anchor);
        rue.clear_range_entry_if_present(&mut parent, &range_start);

        assert!(rue.anchor_map[0].mounted.is_none());
        assert!(rue.range_map[0].mounted.is_none());
        let records = Reflect::get(&global, &JsValue::from_str("__rue_debug_clear__")).unwrap();
        let records = Array::from(&records);
        assert_eq!(records.length(), 2);
        assert_eq!(
            Reflect::get(&records.get(0), &JsValue::from_str("source"))
                .unwrap()
                .as_string()
                .as_deref(),
            Some("clear_anchor_entry_if_present")
        );
        assert_eq!(
            Reflect::get(&records.get(1), &JsValue::from_str("source"))
                .unwrap()
                .as_string()
                .as_deref(),
            Some("clear_range_entry_if_present")
        );
        Reflect::delete_property(&global, &JsValue::from_str("__rue_debug_clear_enabled__"))
            .unwrap();
        Reflect::delete_property(&global, &JsValue::from_str("__rue_debug_clear__")).unwrap();
    }

    #[wasm_bindgen_test]
    fn end_anchor_and_named_range_helpers_cover_real_parent_and_fallback_paths() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());

        let mut fragment_parent = node("fragment");
        let real_parent = node("real-parent");
        let end = node("end");
        let child = node("child");
        set_children(&real_parent, &[end.clone()]);
        rue.insert_with_end_anchor_opt(&mut fragment_parent, &child, &Some(end.clone()));
        assert_eq!(child_tags(&real_parent), vec!["child", "end"]);

        let mut no_anchor_parent = node("no-anchor-parent");
        let fallback_child = node("fallback-child");
        rue.insert_with_end_anchor_opt(&mut no_anchor_parent, &fallback_child, &None);
        assert_eq!(child_tags(&no_anchor_parent), vec!["fallback-child"]);

        let outer_parent = node("outer-parent");
        let outer_anchor = node("outer-anchor");
        set_children(&outer_parent, &[outer_anchor.clone()]);
        let mut nested_parent = node("nested-parent");
        let nested_child = node("nested-child");
        rue.current_anchor = Some(outer_anchor.clone());
        rue.insert_with_end_anchor_opt(&mut nested_parent, &nested_child, &None);
        assert_eq!(child_tags(&nested_parent), vec!["nested-child"]);
        assert_eq!(child_tags(&outer_parent), vec!["outer-anchor"]);

        let nested_fragment = node("fragment");
        let nested_fragment_child = node("nested-fragment-child");
        set_children(&nested_fragment, &[nested_fragment_child.clone()]);
        let mut nested_fragment_parent = node("nested-fragment-parent");
        rue.insert_fragment_children_preferring_end(
            &mut nested_fragment_parent,
            &nested_fragment,
            &None,
        );
        assert_eq!(child_tags(&nested_fragment_parent), vec!["nested-fragment-child"]);
        assert_eq!(child_tags(&outer_parent), vec!["outer-anchor"]);

        let mut containing_parent = node("containing-parent");
        let containing_anchor = node("containing-anchor");
        let containing_child = node("containing-child");
        set_children(&containing_parent, &[containing_anchor.clone()]);
        rue.current_anchor = Some(containing_anchor);
        rue.insert_with_end_anchor_opt(&mut containing_parent, &containing_child, &None);
        assert_eq!(child_tags(&containing_parent), vec!["containing-child", "containing-anchor"]);
        rue.current_anchor = None;

        let mut anchor_parent = node("anchor-parent");
        let anchor = node("anchor");
        let anchored_child = node("anchored-child");
        set_children(&anchor_parent, &[anchor.clone()]);
        rue.insert_with_anchor_opt(&mut anchor_parent, &anchored_child, &Some(anchor));
        assert_eq!(child_tags(&anchor_parent), vec!["anchored-child", "anchor"]);

        let start = node("start");
        let nested_start = node("nested-start");
        let loose = node("loose");
        let named_end = node("named-end");
        Reflect::set(
            &start,
            &JsValue::from_str("nodeValue"),
            &JsValue::from_str("rue:component:start"),
        )
        .unwrap();
        let mut named_parent = node("named-parent");
        set_children(
            &named_parent,
            &[start.clone(), nested_start.clone(), loose, named_end.clone()],
        );
        rue.current_anchor = Some(named_end);
        rue.range_map.push(RangeMountState::new(
            nested_start.clone(),
            node("nested-end"),
            mounted_vapor(&node("nested-host")),
        ));
        rue.clear_current_named_range_if_present(&mut named_parent);
        assert!(rue.range_map[0].mounted.is_none());
        assert_eq!(child_tags(&named_parent), vec!["start", "named-end"]);
    }

    #[wasm_bindgen_test]
    fn replacement_helpers_cover_empty_entries_detached_nodes_and_no_adapter_fallbacks() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let mut parent = node("parent");

        let detached_fragment_node = node("detached-fragment-node");
        rue.clear_mounted_dom_identity(&mut parent, None, &[detached_fragment_node.clone()]);

        let anchor_entry = alias_node("anchor-entry", "anchor-same");
        let anchor_equiv = alias_node("anchor-equiv", "anchor-same");
        let mut empty_anchor_entry =
            AnchorMountState::new(anchor_entry, mounted_vapor(&node("anchor-host")));
        empty_anchor_entry.clear();
        rue.anchor_map.push(empty_anchor_entry);
        rue.clear_anchor_entry_if_present(&mut parent, &anchor_equiv);

        let range_entry = alias_node("range-entry", "range-same");
        let range_equiv = alias_node("range-equiv", "range-same");
        let mut empty_range_entry = RangeMountState::new(
            range_entry,
            node("range-end"),
            mounted_vapor(&node("range-host")),
        );
        empty_range_entry.clear();
        rue.range_map.push(empty_range_entry);
        rue.clear_range_entry_if_present(&mut parent, &range_equiv);

        let fragment = node("fragment");
        let first = node("first");
        let second = node("second");
        set_children(&fragment, &[first.clone(), second.clone()]);
        rue.insert_fragment_children_preferring_end(&mut parent, &fragment, &None);
        assert_eq!(child_tags(&parent), vec!["first", "second"]);

        let child = node("orphan-child");
        let orphan_end = node("orphan-end");
        rue.insert_with_end_anchor_opt(&mut parent, &child, &Some(orphan_end));
        assert_eq!(child_tags(&parent), vec!["first", "second", "orphan-child"]);

        let mut no_adapter = Rue::<JsDomAdapter>::new();
        let mut no_adapter_parent = node("no-adapter-parent");
        let no_adapter_child = node("no-adapter-child");
        no_adapter.current_anchor = Some(node("no-adapter-anchor"));
        no_adapter.insert_with_end_anchor_opt(&mut no_adapter_parent, &no_adapter_child, &None);
        no_adapter.insert_with_anchor_opt(
            &mut no_adapter_parent,
            &no_adapter_child,
            &Some(node("unused-anchor")),
        );
        no_adapter.insert_fragment_children(&mut no_adapter_parent, &fragment, &None);

        let mut resolved_parent = parent.clone();
        let resolved = rue.resolve_dest_parent(&mut resolved_parent, None, Some(node("anchor")));
        assert!(Object::is(&resolved, &parent));

        assert!(!rue.clear_fragment_nodes(&mut parent, &[node("missing-fragment-node")]));
    }
}
