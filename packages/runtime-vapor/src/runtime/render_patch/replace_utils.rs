use super::super::Rue;
use super::super::types::{MountLifecycleRecord, MountedState};
use crate::runtime::dom_adapter::DomAdapter;
use js_sys::JsString;
use js_sys::{Array, Object, Reflect};
use wasm_bindgen::{JsCast, JsValue};

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

    pub(crate) fn clear_mounted_state(&mut self, parent: &mut A::Element, mounted: MountedState<A>)
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        let (lifecycle, host, fragment_nodes) = mounted.into_dom_identity();

        if let Some(host_ref) = host.as_ref() {
            self.debug_record_cleared_sidebar(parent, host_ref);
        }
        self.debug_record_component_anchor_owner(parent, host.as_ref(), &fragment_nodes);

        self.invoke_before_unmount_record(&lifecycle);
        self.clear_mounted_block_dom(parent, host.as_ref(), &fragment_nodes);
        self.invoke_unmounted_record(&lifecycle);
    }

    /// 若某个待删除的片段节点本身是 renderAnchor 管理的锚点，
    /// 需要先完整卸载该锚点关联的 mounted subtree，再移除锚点本身。
    fn clear_anchor_entry_if_present(&mut self, parent: &mut A::Element, anchor: &A::Element)
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        let idx = {
            let anchor_js: JsValue = anchor.clone().into();
            let mut hit = None;
            for (i, entry) in self.anchor_map.iter().enumerate() {
                let av: JsValue = entry.anchor.clone().into();
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

        let global = js_sys::global();
        let source_key = JsValue::from_str("__rue_debug_clear_source__");
        let meta_key = JsValue::from_str("__rue_debug_clear_meta__");
        let anchor_js: JsValue = anchor.clone().into();
        let _ =
            Reflect::set(&global, &source_key, &JsValue::from_str("clear_anchor_entry_if_present"));
        let _ = Reflect::set(
            &global,
            &meta_key,
            &Reflect::get(&anchor_js, &JsValue::from_str("nodeValue"))
                .unwrap_or(JsValue::UNDEFINED),
        );
        self.clear_mounted_state(parent, old_mount);
        let _ = Reflect::delete_property(&global, &source_key);
        let _ = Reflect::delete_property(&global, &meta_key);
    }

    /// 若某个待删除的片段节点本身是 renderBetween 管理的 start 锚点，
    /// 需要先完整卸载该范围关联的 mounted subtree，再移除 start/end 与范围内容。
    fn clear_range_entry_if_present(&mut self, parent: &mut A::Element, start: &A::Element)
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        let idx = {
            let start_js: JsValue = start.clone().into();
            let mut hit = None;
            for (i, entry) in self.range_map.iter().enumerate() {
                let sv: JsValue = entry.start.clone().into();
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

        let global = js_sys::global();
        let source_key = JsValue::from_str("__rue_debug_clear_source__");
        let meta_key = JsValue::from_str("__rue_debug_clear_meta__");
        let start_js: JsValue = start.clone().into();
        let _ =
            Reflect::set(&global, &source_key, &JsValue::from_str("clear_range_entry_if_present"));
        let _ = Reflect::set(
            &global,
            &meta_key,
            &Reflect::get(&start_js, &JsValue::from_str("nodeValue")).unwrap_or(JsValue::UNDEFINED),
        );
        self.clear_mounted_state(parent, old_mount);
        let _ = Reflect::delete_property(&global, &source_key);
        let _ = Reflect::delete_property(&global, &meta_key);
    }

    // 片段子节点插入（优先 end 锚点）：
    // - 设计目的：RouterView 等区间渲染场景中，确保片段的真实子节点严格插入到 end 注释之前，
    //   避免因父为片段或 contains(end) 为 false 而错误地追加到区间外部。
    // - 行为：若存在有效 end 锚点，则按 end.parentNode 解析真实父节点，
    //   对每个子节点执行 insertBefore(realParent, child, end)，否则回退到锚点/尾部插入。
    pub(crate) fn insert_fragment_children_preferring_end(
        &mut self,
        parent: &mut A::Element,
        fragment_el: &A::Element,
        insert_anchor: &Option<A::Element>,
    ) where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        // 计算有效锚点：优先当前区间的 end 注释，其次使用外部传入的插入锚点
        let effective_anchor = self.current_anchor.clone().or(insert_anchor.clone());
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
    pub(crate) fn insert_with_end_anchor_opt(
        &mut self,
        parent: &mut A::Element,
        child: &A::Element,
        insert_anchor: &Option<A::Element>,
    ) where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        // 计算有效锚点：优先使用当前区间 end，其次使用外部传入的锚点
        let effective_anchor = self.current_anchor.clone().or(insert_anchor.clone());
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
