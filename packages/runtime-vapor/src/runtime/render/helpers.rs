/*
渲染辅助方法

集中维护 mounted 映射、查找/压缩容器记录、组件 scope 更新、props/children 转换等杂务。
这些方法支撑 container/anchor/range 三类渲染入口，避免主流程被细节淹没。
*/
use super::super::Rue;
use super::super::types::{
    AnchorMountState, ComponentProps, MountInput, MountedState, RangeMountState,
};
use crate::reactive::core::{create_effect_scope, dispose_effect_scope};
use crate::reactive::signal::signal_from_proxy;
use crate::runtime::dom_adapter::DomAdapter;
use js_sys::{Array, Function, Object, Reflect};
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;

const ANCHOR_MAP_COMPACT_STEP: usize = 64;
const RANGE_MAP_COMPACT_STEP: usize = 64;

fn next_compact_threshold(len: usize, step: usize) -> usize {
    len.saturating_add(step).max(step)
}

fn has_native_contains_method(value: &JsValue) -> bool {
    Reflect::get(value, &JsValue::from_str("contains"))
        .ok()
        .is_some_and(|contains| contains.is_function())
}

fn debug_record_sidebar_compaction(kind: &str, host: &JsValue) {
    let host_class = Reflect::get(host, &JsValue::from_str("className"))
        .unwrap_or(JsValue::UNDEFINED)
        .as_string()
        .unwrap_or_default();
    if !host_class.contains("sidebar-playground") {
        return;
    }

    let global = js_sys::global();
    let enabled = Reflect::get(&global, &JsValue::from_str("__rue_debug_compact_enabled__"))
        .unwrap_or(JsValue::FALSE);
    if !enabled.as_bool().unwrap_or(false) {
        return;
    }

    let key = JsValue::from_str("__rue_debug_compact__");
    let existing = Reflect::get(&global, &key).unwrap_or(JsValue::UNDEFINED);
    let array = if Array::is_array(&existing) { Array::from(&existing) } else { Array::new() };
    let record = Object::new();
    let _ = Reflect::set(&record, &JsValue::from_str("kind"), &JsValue::from_str(kind));
    let _ = Reflect::set(&record, &JsValue::from_str("hostClass"), &JsValue::from_str(&host_class));
    array.push(&record);
    let _ = Reflect::set(&global, &key, &array.into());
}

fn parent_node_js(node: &JsValue) -> Option<JsValue> {
    let parent =
        js_sys::Reflect::get(node, &JsValue::from_str("parentNode")).unwrap_or(JsValue::UNDEFINED);
    if parent.is_undefined() || parent.is_null() { None } else { Some(parent) }
}

fn dom_root_js(node: &JsValue) -> JsValue {
    let mut cur = node.clone();
    for _ in 0..32 {
        let Some(parent) = parent_node_js(&cur) else {
            return cur;
        };
        cur = parent;
    }
    cur
}

fn shares_dom_root_js(left: &JsValue, right: &JsValue) -> bool {
    let left_root = dom_root_js(left);
    let right_root = dom_root_js(right);
    Object::is(&left_root, &right_root)
}

fn is_explicitly_disconnected(node: &JsValue) -> bool {
    Reflect::get(node, &JsValue::from_str("isConnected")).ok().and_then(|v| v.as_bool())
        == Some(false)
}

// 渲染辅助方法：
// - reset_hook_index：重置组件宿主上的 hooks 索引，确保从头执行
// - compact_container_map / compact_anchor_map / compact_range_map：清理容器/单锚点/区间映射中过期项
// - sync_props_children：将新 props 与 children 同步到只读 reactive 视图
// - find_container_index / find_anchor_index / find_range_index：在映射中定位容器、单锚点或区间
// - get_current_container：读取当前渲染容器

impl<A: DomAdapter> Rue<A>
where
    A::Element: Clone,
{
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub(super) fn patch_root_mounted_state(
        &mut self,
        old_mount: MountedState<A>,
        input: &MountInput<A>,
        parent: &mut A::Element,
    ) -> MountedState<A>
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        let Some(mut old_patch) = old_mount.into_patch_state() else {
            unreachable!("root patch helper expects non-block mounted state")
        };
        self.call_hooks("before_update");
        self.patch(&mut old_patch, input, parent);
        self.call_hooks("updated");
        MountedState::from_subtree_root(old_patch)
    }

    /// 为组件开启新一轮渲染作用域，并回收上一轮渲染期间创建的副作用。
    ///
    /// 这层作用域专门解决“组件函数每次重跑都再次创建 computed/useEffect/watchEffect，
    /// 但旧的一轮没有释放”导致的持续堆积问题。
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub(crate) fn renew_component_render_scope(&mut self, inst_index: usize) -> usize {
        if let Some(inst) = self.instance_store.get_mut(&inst_index) {
            if let Some(prev_scope_id) = inst.render_scope_id.take() {
                dispose_effect_scope(prev_scope_id);
            }
            let scope_id = create_effect_scope();
            inst.render_scope_id = Some(scope_id);
            scope_id
        } else {
            create_effect_scope()
        }
    }

    /// 在组件卸载时释放最后一轮渲染作用域。
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub(crate) fn dispose_component_render_scope(&mut self, inst_index: usize) {
        if let Some(inst) = self.instance_store.get_mut(&inst_index) {
            if let Some(scope_id) = inst.render_scope_id.take() {
                dispose_effect_scope(scope_id);
            }
        }
    }

    /// 将宿主对象上的 __hooks.index 重置为 0
    ///
    /// 参数：
    /// - host：组件宿主对象（JS 对象）
    /// 行为：
    /// - 若存在 __hooks，则把其 index 设为 0
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub fn reset_hook_index(host: &Object) {
        let hooks = Reflect::get(host, &JsValue::from_str("__hooks")).unwrap_or(JsValue::UNDEFINED);
        if hooks.is_undefined() || hooks.is_null() {
            return;
        }
        let hooks_obj = Object::from(hooks);
        let _ = Reflect::set(&hooks_obj, &JsValue::from_str("index"), &JsValue::from_f64(0.0));
    }

    /// 清理容器映射中过期记录（预留）
    ///
    /// 说明：
    /// - 当前实现为空；可在需要时对 container_map 做一致性压缩
    pub(super) fn compact_container_map(&mut self)
    where
        <A as DomAdapter>::Element: Into<JsValue>,
    {
    }

    /// 清理单锚点映射中过期记录，并触发对应 mounted subtree 的卸载生命周期
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub(crate) fn compact_anchor_map_preserving(&mut self, preserve_anchor: Option<&A::Element>)
    where
        <A as DomAdapter>::Element: Into<JsValue>,
    {
        #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
        fn in_detached_fragment(node: &JsValue) -> bool {
            let mut cur = node.clone();
            for _ in 0..16 {
                let Some(pn) = parent_node_js(&cur) else {
                    return false;
                };
                let nt = js_sys::Reflect::get(&pn, &JsValue::from_str("nodeType"))
                    .unwrap_or(JsValue::UNDEFINED)
                    .as_f64()
                    .unwrap_or(0.0) as i32;
                if nt == 11 {
                    let has_host =
                        js_sys::Reflect::has(&pn, &JsValue::from_str("host")).unwrap_or(false);
                    return !has_host;
                }
                cur = pn;
            }
            false
        }

        #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
        fn has_detached_fragment_ancestor_by_adapter<B: DomAdapter>(
            adapter: &B,
            anchor: &B::Element,
        ) -> bool {
            let mut cur = anchor.clone();
            for _ in 0..16 {
                let parent = match adapter.get_parent_node(&cur) {
                    Some(p) => p,
                    None => return false,
                };
                if adapter.is_fragment(&parent) {
                    return true;
                }
                cur = parent;
            }
            false
        }

        let adapter_owned = self.get_dom_adapter().cloned();
        let drained = std::mem::take(&mut self.anchor_map);
        let mut kept: Vec<AnchorMountState<A>> = Vec::with_capacity(drained.len());

        for mut entry in drained.into_iter() {
            if let Some(preserve) = preserve_anchor {
                let entry_js: JsValue = entry.anchor.clone().into();
                let preserve_js: JsValue = preserve.clone().into();
                let matches_current = if js_sys::Object::is(&entry_js, &preserve_js) {
                    true
                } else if has_native_contains_method(&preserve_js) {
                    false
                } else {
                    adapter_owned.as_ref().is_some_and(|adapter| {
                        adapter.contains(&entry.anchor, preserve)
                            && adapter.contains(preserve, &entry.anchor)
                    })
                };
                if matches_current {
                    kept.push(entry);
                    continue;
                }
            }

            let av: JsValue = entry.anchor.clone().into();
            let connected =
                Reflect::get(&av, &JsValue::from_str("isConnected")).ok().and_then(|v| v.as_bool());
            let keep = match connected {
                Some(true) => true,
                // Detached roots are valid render targets in tests and offscreen rendering. Keep
                // entries that still belong to the same root as the current anchor; otherwise
                // consider the disconnected entry stale and dispose it.
                Some(false) => preserve_anchor.is_some_and(|preserve| {
                    let preserve_js: JsValue = preserve.clone().into();
                    shares_dom_root_js(&av, &preserve_js)
                }),
                None => {
                    if let Some(adapter) = adapter_owned.as_ref() {
                        adapter.get_parent_node(&entry.anchor).is_some()
                            && !has_detached_fragment_ancestor_by_adapter(adapter, &entry.anchor)
                    } else {
                        parent_node_js(&av).is_some() && !in_detached_fragment(&av)
                    }
                }
            };

            if keep {
                kept.push(entry);
            } else if let Some(mount) = entry.take_mount() {
                let (lifecycle, host, _fragment_nodes) = mount.into_dom_identity();
                if let Some(host) = host {
                    let host_js: JsValue = host.into();
                    debug_record_sidebar_compaction("anchor", &host_js);
                }
                self.invoke_before_unmount_record(&lifecycle);
                self.invoke_unmounted_record(&lifecycle);
            }
        }

        self.anchor_map = kept;
        self.anchor_map_next_compact_at =
            next_compact_threshold(self.anchor_map.len(), ANCHOR_MAP_COMPACT_STEP);
    }

    pub(crate) fn maybe_compact_anchor_map_preserving(
        &mut self,
        preserve_anchor: Option<&A::Element>,
    ) where
        <A as DomAdapter>::Element: Into<JsValue>,
    {
        let len = self.anchor_map.len();
        if len == 0 {
            self.anchor_map_next_compact_at = ANCHOR_MAP_COMPACT_STEP;
            return;
        }
        if len <= ANCHOR_MAP_COMPACT_STEP || len >= self.anchor_map_next_compact_at {
            self.compact_anchor_map_preserving(preserve_anchor);
        }
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub(crate) fn compact_anchor_map(&mut self)
    where
        <A as DomAdapter>::Element: Into<JsValue>,
    {
        self.compact_anchor_map_preserving(None);
    }

    /// 清理区间映射中过期记录
    ///
    /// 为什么需要“带卸载的 compact”：
    /// - `renderBetween(start,end)` 会把 (start -> mounted state) 记录到 `range_map`，用于后续命中做 patch。
    /// - 在路由切换/条件分支切换等场景里，旧的 Vapor 子树会被 DOM 删除，但：
    ///   - 旧的 `range_map` entry 可能仍残留（仅靠 `find_range_index` 可能匹配不到新的 start）。
    ///   - 若残留的 entry 没有走 `before_unmount/unmounted`，它在内部注册的响应式副作用（watchEffect 等）
    ///     就不会被清理，最终表现为“每次切换都多注册一批 effect，越来越卡”。
    ///
    /// 因此这里做两件事：
    /// 1) 判定一个 range 的 start 锚点是否仍“连接在文档中”；
    /// 2) 对已断开的 range：除了从 `range_map` 删除，还要主动触发 mounted subtree 的卸载生命周期，
    ///    让 Vapor scope / effect cleanup 有机会运行，完成资源回收。
    ///
    /// 连接性判定策略（从强到弱）：
    /// - 优先读取 DOM 的 `node.isConnected`（最准确：直接表示该节点是否还在文档树里）。
    /// - 若无 `isConnected`（例如测试适配器的 Element 不是原生 DOM）：退化到 `DomAdapter.get_parent_node`。
    /// - 若也没有适配器：最后再反射 `parentNode` 是否存在。
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub(super) fn compact_range_map(&mut self)
    where
        <A as DomAdapter>::Element: Into<JsValue>,
    {
        // 判定节点是否位于“未挂载的 DocumentFragment/片段树”中：
        // - 这类节点沿 parentNode 仍可向上遍历，但不属于已挂载的文档树；
        // - 需要排除 ShadowRoot（nodeType 也是 11，但它拥有 host，属于已挂载场景）。
        #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
        fn in_detached_fragment(node: &JsValue, current_anchor: Option<&JsValue>) -> bool {
            let mut cur = node.clone();
            for _ in 0..16 {
                let Some(pn) = parent_node_js(&cur) else {
                    return false;
                };
                let nt = js_sys::Reflect::get(&pn, &JsValue::from_str("nodeType"))
                    .unwrap_or(JsValue::UNDEFINED)
                    .as_f64()
                    .unwrap_or(0.0) as i32;
                if nt == 11 {
                    // ShadowRoot 的 nodeType 也是 11，但它会有 host 字段；这里不把它当作“待挂载 fragment”
                    let has_host =
                        js_sys::Reflect::has(&pn, &JsValue::from_str("host")).unwrap_or(false);
                    if has_host {
                        return false;
                    }
                    if let Some(ca) = current_anchor {
                        let mut cur2 = ca.clone();
                        for _ in 0..16 {
                            if js_sys::Object::is(&pn, &cur2) {
                                return false;
                            }
                            let Some(up) = parent_node_js(&cur2) else {
                                break;
                            };
                            cur2 = up;
                        }
                    }
                    return true;
                }
                cur = pn;
            }
            false
        }

        // 通过适配器沿祖先链判定是否存在“fragment”祖先：
        // - 若存在，说明该 start 当前位于一个临时片段容器中，视为未挂载，应当被清理。
        #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
        fn has_detached_fragment_ancestor_by_adapter<B: DomAdapter>(
            adapter: &B,
            start: &B::Element,
            current_anchor: Option<&B::Element>,
        ) -> bool {
            let mut cur = start.clone();
            for _ in 0..16 {
                let parent = match adapter.get_parent_node(&cur) {
                    Some(p) => p,
                    None => return false,
                };
                if adapter.is_fragment(&parent) {
                    if let Some(ca) = current_anchor {
                        if adapter.contains(&parent, ca) {
                            return false;
                        }
                    }
                    return true;
                }
                cur = parent;
            }
            false
        }

        // 这里不能简单 `retain`：
        // - `retain` 的闭包只拿到 `&(start, vnode_opt)` 的不可变引用；
        // - 我们需要在“丢弃 entry”时把 `vnode_opt` move 出来并执行卸载钩子；
        // 所以使用 `take + for` 的方式把所有 entry 搬出来处理，再回填保留项。
        let adapter_owned = self.get_dom_adapter().cloned();
        let drained = std::mem::take(&mut self.range_map);
        let original_len = drained.len();
        let mut kept: Vec<RangeMountState<A>> = Vec::with_capacity(original_len);

        for mut entry in drained.into_iter() {
            let sv: JsValue = entry.start.clone().into();
            // 尝试读取 `isConnected`：
            // - 浏览器 DOM 节点上该字段是 boolean；
            // - 若不是 DOM 节点（例如测试的 TestNode），Reflect::get 会返回 undefined，
            //   这时我们会走 adapter / parentNode 的降级分支。
            let connected =
                Reflect::get(&sv, &JsValue::from_str("isConnected")).ok().and_then(|v| v.as_bool());
            // keep 判定逻辑（强到弱）：
            // 1) isConnected === true：保留
            // 2) isConnected === false：仅在当前 anchor 也明确处于离线 root 时保留
            // 3) isConnected 缺失：用适配器或 parentNode 继续判定，同时排除“未挂载的 fragment”情形
            let keep = match connected {
                Some(true) => true,
                Some(false) => self.current_anchor.as_ref().is_some_and(|anchor| {
                    let anchor_js: JsValue = anchor.clone().into();
                    is_explicitly_disconnected(&anchor_js) && shares_dom_root_js(&sv, &anchor_js)
                }),
                None => {
                    if let Some(adapter) = adapter_owned.as_ref() {
                        let anchor_opt = self.current_anchor.as_ref();
                        adapter.get_parent_node(&entry.start).is_some()
                            && !has_detached_fragment_ancestor_by_adapter(
                                adapter,
                                &entry.start,
                                anchor_opt,
                            )
                    } else {
                        // 无适配器时，额外通过 JS 反射判定是否处于“未挂载的 fragment”
                        let ca_js_opt = match self.current_anchor.as_ref() {
                            Some(e) => Some(e.clone().into()),
                            None => None,
                        };
                        let ca_js_ref = ca_js_opt.as_ref();
                        if in_detached_fragment(&sv, ca_js_ref) {
                            false
                        } else {
                            parent_node_js(&sv).is_some()
                        }
                    }
                }
            };

            if keep {
                kept.push(entry);
            } else {
                // 关键：丢弃 range 前必须触发卸载生命周期。
                // - 这能保证 Vapor 子树的 `before_unmount` 被调用，从而 dispose scope，
                //   清理 watchEffect/createEffect 注册的副作用；
                // - 也能让组件的 `unmounted` 正常执行，清理事件/定时器等资源。
                if let Some(mount) = entry.take_mount() {
                    let (lifecycle, host, _fragment_nodes) = mount.into_dom_identity();
                    if let Some(host) = host {
                        let host_js: JsValue = host.into();
                        debug_record_sidebar_compaction("range", &host_js);
                    }
                    // 为什么这个代码会影响切换路由后组件的生命周期无法恢复了。
                    // 说明：在丢弃过期区间前调用卸载钩子，确保 Vapor scope 与副作用得到释放，
                    // 否则切换场景中旧副作用残留会导致生命周期异常与资源泄漏。
                    self.invoke_before_unmount_record(&lifecycle);
                    self.invoke_unmounted_record(&lifecycle);
                }
            }
        }

        let _dropped = original_len.saturating_sub(kept.len());
        #[cfg(feature = "dev")]
        {
            if _dropped > 0 && crate::log::want_log("debug", "runtime:compact_range_map dropped") {
                crate::log::log(
                    "debug",
                    &format!("runtime:compact_range_map dropped={} kept={}", _dropped, kept.len()),
                );
            }
        }

        self.range_map = kept;
        self.range_map_next_compact_at =
            next_compact_threshold(self.range_map.len(), RANGE_MAP_COMPACT_STEP);
    }

    pub(super) fn maybe_compact_range_map(&mut self)
    where
        <A as DomAdapter>::Element: Into<JsValue>,
    {
        let len = self.range_map.len();
        if len == 0 {
            self.range_map_next_compact_at = RANGE_MAP_COMPACT_STEP;
            return;
        }
        if len <= RANGE_MAP_COMPACT_STEP || len >= self.range_map_next_compact_at {
            self.compact_range_map();
        }
    }

    /// 将新的 MountInput props 与 children 同步写入只读 reactive 视图（props_ro）。
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub(crate) fn sync_props_children_input(
        &mut self,
        props_ro: &JsValue,
        new_props: &ComponentProps,
        new_children: &[super::super::types::MountInputChild<A>],
    ) where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue> + Clone,
    {
        use crate::hook::reactive::shallow_equal_prop;

        let sig = match signal_from_proxy(props_ro) {
            Some(s) => s,
            None => return,
        };
        let peek = Reflect::get(&sig, &JsValue::from_str("peekPath")).unwrap_or(JsValue::UNDEFINED);
        let set = Reflect::get(&sig, &JsValue::from_str("setPath")).unwrap_or(JsValue::UNDEFINED);
        let peek_f = match peek.dyn_ref::<Function>() {
            Some(f) => f,
            None => return,
        };
        let set_f = match set.dyn_ref::<Function>() {
            Some(f) => f,
            None => return,
        };

        for (key, new_value) in new_props.iter() {
            if key == "children" {
                continue;
            }
            let path = Array::new();
            path.push(&JsValue::from_str(key));
            let old_value = peek_f.call1(&sig, &path.clone().into()).unwrap_or(JsValue::UNDEFINED);
            if !shallow_equal_prop(&old_value, new_value) {
                let _ = set_f.call2(&sig, &path.clone().into(), &new_value.clone());
            }
        }

        let next_children = self.normalized_children_input_array(new_props, new_children);

        let path_children = Array::new();
        path_children.push(&JsValue::from_str("children"));
        let old_children =
            peek_f.call1(&sig, &path_children.clone().into()).unwrap_or(JsValue::UNDEFINED);
        let skip_empty_children_write =
            (old_children.is_undefined() || old_children.is_null()) && next_children.length() == 0;
        let next_children_value: JsValue = next_children.clone().into();
        if !skip_empty_children_write && !shallow_equal_prop(&old_children, &next_children_value) {
            let _ = set_f.call2(&sig, &path_children.clone().into(), &next_children_value);
        }
    }

    /// 在容器映射中查找与目标容器等价的记录下标
    ///
    /// 参数：
    /// - container：目标容器
    /// 返回：
    /// - Some(index) 或 None
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub(crate) fn find_container_index(&mut self, container: &A::Element) -> Option<usize>
    where
        <A as DomAdapter>::Element: Into<JsValue>,
    {
        let target_js: JsValue = container.clone().into();
        let target_has_native_contains = has_native_contains_method(&target_js);
        for (i, entry) in self.container_map.iter().enumerate() {
            let entry_js: JsValue = entry.container.clone().into();
            if js_sys::Object::is(&entry_js, &target_js) {
                return Some(i);
            }
            if target_has_native_contains {
                continue;
            }
            if let Some(adapter) = self.get_dom_adapter() {
                if adapter.contains(&entry.container, container)
                    && adapter.contains(container, &entry.container)
                {
                    return Some(i);
                }
            }
        }
        None
    }

    /// 在单锚点映射中查找与目标 anchor 等价的记录下标
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub(super) fn find_anchor_index(&mut self, anchor: &A::Element) -> Option<usize>
    where
        <A as DomAdapter>::Element: Into<JsValue>,
    {
        if self.anchor_map.is_empty() {
            return None;
        }
        let target_js: JsValue = anchor.clone().into();
        let target_has_native_contains = has_native_contains_method(&target_js);
        for (i, entry) in self.anchor_map.iter().enumerate() {
            let av: JsValue = entry.anchor.clone().into();
            if js_sys::Object::is(&av, &target_js) {
                return Some(i);
            }
            if target_has_native_contains {
                continue;
            }
            if let Some(adapter) = self.get_dom_adapter() {
                if adapter.contains(&entry.anchor, anchor)
                    && adapter.contains(anchor, &entry.anchor)
                {
                    return Some(i);
                }
            }
        }
        None
    }

    /// 在区间映射中查找以 start 为起点的记录下标
    ///
    /// 参数：
    /// - start：区间起点
    /// 返回：
    /// - Some(index) 或 None
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub(crate) fn find_range_index(&mut self, start: &A::Element) -> Option<usize>
    where
        <A as DomAdapter>::Element: Into<JsValue>,
    {
        if self.range_map.is_empty() {
            return None;
        }
        // 优先对象同一性（Object::is）。真实 DOM 节点的双向 contains 与 Object::is 等价，
        // 只在非 DOM adapter 上保留 contains fallback，避免首屏构建时对 range_map 做 O(N²) DOM contains。
        let target_js: JsValue = start.clone().into();
        let target_has_native_contains = has_native_contains_method(&target_js);
        for (i, entry) in self.range_map.iter().enumerate() {
            let sv: JsValue = entry.start.clone().into();
            if js_sys::Object::is(&sv, &target_js) {
                return Some(i);
            }
            if target_has_native_contains {
                continue;
            }
            if let Some(adapter) = self.get_dom_adapter() {
                if adapter.contains(&entry.start, start) && adapter.contains(start, &entry.start) {
                    return Some(i);
                }
            }
        }
        None
    }

    /// 获取当前渲染容器（若存在）
    pub fn get_current_container(&self) -> Option<A::Element> {
        self.current_container.clone()
    }
}

#[cfg(test)]
#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
mod tests {
    use super::super::super::types::{
        AnchorMountState, ContainerMountState, MountInputChild, MountInputType,
        MountedPatchSubtree, MountedState, MountedSubtreeState, MountedTextSubtree,
        RangeMountState,
    };
    use super::*;
    use crate::reactive::core::{
        create_effect_scope, pop_effect_scope, push_effect_scope, set_reactive_scheduling,
    };
    use crate::reactive::effect::create_effect;
    use crate::reactive::signal::{create_reactive, create_signal};
    use crate::runtime::js_adapter::JsDomAdapter;
    use crate::runtime::{ComponentInternalInstance, LifecycleHooks};
    use js_sys::{Array, Function, Object, Reflect};
    use std::cell::Cell;
    use std::collections::HashMap;
    use std::marker::PhantomData;
    use std::rc::Rc;
    use wasm_bindgen::closure::Closure;
    use wasm_bindgen_test::*;

    fn node(tag: &str, node_type: f64) -> JsValue {
        let obj = Object::new();
        Reflect::set(&obj, &JsValue::from_str("tag"), &JsValue::from_str(tag)).unwrap();
        Reflect::set(&obj, &JsValue::from_str("nodeType"), &JsValue::from_f64(node_type)).unwrap();
        obj.into()
    }

    fn set_parent(child: &JsValue, parent: &JsValue) {
        Reflect::set(child, &JsValue::from_str("parentNode"), parent).unwrap();
    }

    fn block_state(host: JsValue) -> MountedState<JsDomAdapter> {
        MountedState::from_subtree_root(MountedSubtreeState::Text(MountedTextSubtree {
            host: Some(host),
            key: None,
            cleanup_bucket: None,
            effect_scope_id: None,
        }))
    }

    fn scoped_block_state(host: JsValue, effect_scope_id: usize) -> MountedState<JsDomAdapter> {
        MountedState::from_subtree_root(MountedSubtreeState::Text(MountedTextSubtree {
            host: Some(host),
            key: None,
            cleanup_bucket: None,
            effect_scope_id: Some(effect_scope_id),
        }))
    }

    fn test_instance(index: usize) -> ComponentInternalInstance<JsDomAdapter> {
        ComponentInternalInstance {
            parent: None,
            is_mounted: false,
            hooks: LifecycleHooks(HashMap::new()),
            props_ro: Object::new().into(),
            host: Object::new().into(),
            render_scope_id: None,
            error: None,
            error_handlers: Vec::new(),
            index,
            _marker: PhantomData,
        }
    }

    fn set_bool(target: &JsValue, key: &str, value: bool) {
        Reflect::set(target, &JsValue::from_str(key), &JsValue::from_bool(value)).unwrap();
    }

    fn set_native_contains_method(target: &JsValue) {
        Reflect::set(
            target,
            &JsValue::from_str("contains"),
            &Function::new_with_args("other", "return this === other").into(),
        )
        .unwrap();
    }

    fn alias_node(tag: &str, alias: &str) -> JsValue {
        let n = node(tag, 1.0);
        Reflect::set(&n, &JsValue::from_str("alias"), &JsValue::from_str(alias)).unwrap();
        n
    }

    fn alias_adapter() -> JsDomAdapter {
        let adapter = Object::new();
        let methods = [
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
                "p,c",
                "p.children = p.children || []; p.children.push(c); c.parentNode = p",
            ),
            (
                "insertBefore",
                "p,c,b",
                "p.children = p.children || []; const i = p.children.indexOf(b); p.children.splice(i < 0 ? p.children.length : i, 0, c); c.parentNode = p",
            ),
            (
                "removeChild",
                "p,c",
                "p.children = (p.children || []).filter(x => x !== c); c.parentNode = null",
            ),
            ("contains", "p,c", "return p === c || (!!p && !!c && p.alias && p.alias === c.alias)"),
            ("getParentNode", "el", "return el && el.parentNode || null"),
            ("setClassName", "el,v", "el.className = v"),
            ("patchStyle", "el,oldv,newv", "el.style = newv"),
            ("setInnerHTML", "el,html", "el.children = []; el.text = html"),
            ("setValue", "el,v", "el.value = v"),
            ("setChecked", "el,b", "el.checked = !!b"),
            ("setDisabled", "el,b", "el.disabled = !!b"),
            ("clearRef", "r", "return"),
            ("applyRef", "el,r", "return"),
            ("setAttribute", "el,k,v", "el.attrs = el.attrs || {}; el.attrs[k] = v"),
            ("removeAttribute", "el,k", "if (el.attrs) delete el.attrs[k]"),
            ("getTagName", "el", "return el.tag || ''"),
            ("addEventListener", "el,event,handler", "return"),
            ("removeEventListener", "el,event,handler", "return"),
            ("hasValueProperty", "el", "return 'value' in el"),
            ("isSelectMultiple", "el", "return false"),
            ("querySelector", "selector", "return null"),
        ];

        for (name, args, body) in methods {
            Reflect::set(
                &adapter,
                &JsValue::from_str(name),
                &Function::new_with_args(args, body).into(),
            )
            .unwrap();
        }

        JsDomAdapter::new(adapter.into())
    }

    fn component_patch_state(render: &Function, host: JsValue) -> MountedState<JsDomAdapter> {
        MountedState::from_subtree_root(MountedSubtreeState::Patch(
            MountedPatchSubtree::new_component(
                render.clone().into(),
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

    fn hostless_component_patch_state(render: &Function) -> MountedState<JsDomAdapter> {
        MountedState::from_subtree_root(MountedSubtreeState::Patch(
            MountedPatchSubtree::new_component(
                render.clone().into(),
                None,
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

    #[wasm_bindgen_test]
    fn debug_record_sidebar_compaction_covers_return_and_record_paths() {
        let global = js_sys::global();
        let key = JsValue::from_str("__rue_debug_compact__");
        let enabled_key = JsValue::from_str("__rue_debug_compact_enabled__");
        let _ = Reflect::set(&global, &key, &JsValue::UNDEFINED);
        let _ = Reflect::set(&global, &enabled_key, &JsValue::FALSE);

        let plain = Object::new();
        Reflect::set(&plain, &JsValue::from_str("className"), &JsValue::from_str("plain")).unwrap();
        debug_record_sidebar_compaction("plain", &plain.into());

        let sidebar = Object::new();
        Reflect::set(
            &sidebar,
            &JsValue::from_str("className"),
            &JsValue::from_str("sidebar-playground panel"),
        )
        .unwrap();
        let sidebar_js: JsValue = sidebar.into();
        debug_record_sidebar_compaction("disabled", &sidebar_js);

        Reflect::set(&global, &enabled_key, &JsValue::TRUE).unwrap();
        Reflect::set(&global, &key, &JsValue::from_str("not-array")).unwrap();
        debug_record_sidebar_compaction("range", &sidebar_js);
        let first = Array::from(&Reflect::get(&global, &key).unwrap());
        assert_eq!(first.length(), 1);

        debug_record_sidebar_compaction("anchor", &sidebar_js);
        let second = Array::from(&Reflect::get(&global, &key).unwrap());
        assert_eq!(second.length(), 2);

        let _ = Reflect::set(&global, &enabled_key, &JsValue::FALSE);
    }

    #[wasm_bindgen_test]
    fn patch_root_mounted_state_covers_component_patch_path() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(alias_adapter());
        let mut parent = node("parent", 1.0);
        let host = node("old-host", 1.0);
        set_parent(&host, &parent);
        let render =
            Function::new_no_args("return { type: 'span', props: {}, children: ['next'] }");
        let old = component_patch_state(&render, host);
        let input = MountInput::new_normalized(
            MountInputType::Component(render.into()),
            ComponentProps::new(),
            vec![MountInputChild::Text("child".to_string())],
        );

        let next = rue.patch_root_mounted_state(old, &input, &mut parent);
        assert!(next.into_patch_state().is_some());
    }

    #[wasm_bindgen_test]
    #[should_panic]
    fn patch_root_mounted_state_rejects_block_state() {
        let mut rue = Rue::<JsDomAdapter>::new();
        let mut parent = node("parent", 1.0);
        let input = MountInput::new_normalized(
            MountInputType::Text("next".to_string()),
            HashMap::new(),
            vec![],
        );

        let _ = rue.patch_root_mounted_state(block_state(node("old", 3.0)), &input, &mut parent);
    }

    #[wasm_bindgen_test]
    fn render_scope_helpers_cover_missing_and_existing_instances() {
        let mut rue = Rue::<JsDomAdapter>::new();

        let missing_scope = rue.renew_component_render_scope(99);
        dispose_effect_scope(missing_scope);
        rue.dispose_component_render_scope(99);

        rue.instance_store.insert(1, test_instance(1));
        let first_scope = rue.renew_component_render_scope(1);
        let second_scope = rue.renew_component_render_scope(1);
        assert_ne!(first_scope, second_scope);
        assert_eq!(
            rue.instance_store.get(&1).and_then(|inst| inst.render_scope_id),
            Some(second_scope)
        );

        rue.dispose_component_render_scope(1);
        assert_eq!(rue.instance_store.get(&1).and_then(|inst| inst.render_scope_id), None);
        rue.dispose_component_render_scope(1);
    }

    #[wasm_bindgen_test]
    fn reset_hook_index_covers_missing_and_existing_hooks() {
        let host = Object::new();
        Rue::<JsDomAdapter>::reset_hook_index(&host);

        let hooks = Object::new();
        Reflect::set(&hooks, &JsValue::from_str("index"), &JsValue::from_f64(7.0)).unwrap();
        Reflect::set(&host, &JsValue::from_str("__hooks"), &hooks).unwrap();
        Rue::<JsDomAdapter>::reset_hook_index(&host);
        assert_eq!(Reflect::get(&hooks, &JsValue::from_str("index")).unwrap().as_f64(), Some(0.0));
    }

    #[wasm_bindgen_test]
    fn compact_threshold_helpers_are_stable() {
        assert_eq!(ANCHOR_MAP_COMPACT_STEP, 64);
        assert_eq!(RANGE_MAP_COMPACT_STEP, 64);
        assert_eq!(next_compact_threshold(0, ANCHOR_MAP_COMPACT_STEP), 64);
        assert_eq!(next_compact_threshold(1, ANCHOR_MAP_COMPACT_STEP), 65);
        assert_eq!(next_compact_threshold(64, ANCHOR_MAP_COMPACT_STEP), 128);
        assert_eq!(next_compact_threshold(usize::MAX, ANCHOR_MAP_COMPACT_STEP), usize::MAX);
    }

    #[wasm_bindgen_test]
    fn native_contains_detection_requires_a_function() {
        let plain = node("plain", 1.0);
        assert!(!has_native_contains_method(&plain));

        Reflect::set(&plain, &JsValue::from_str("contains"), &JsValue::TRUE).unwrap();
        assert!(!has_native_contains_method(&plain));

        set_native_contains_method(&plain);
        assert!(has_native_contains_method(&plain));
    }

    #[wasm_bindgen_test]
    fn find_helpers_cover_no_adapter_miss_and_adapter_equivalence() {
        let mut rue = Rue::<JsDomAdapter>::new();
        let container = alias_node("container", "container-a");
        let container_equiv = alias_node("container", "container-a");
        let container_miss = alias_node("container", "container-b");
        rue.container_map.push(ContainerMountState::new(
            container.clone(),
            block_state(node("container-host", 1.0)),
        ));
        assert_eq!(rue.find_container_index(&container_equiv), None);

        let anchor = alias_node("anchor", "anchor-a");
        let anchor_equiv = alias_node("anchor", "anchor-a");
        let anchor_miss = alias_node("anchor", "anchor-b");
        rue.anchor_map
            .push(AnchorMountState::new(anchor.clone(), block_state(node("anchor-host", 1.0))));
        assert_eq!(rue.find_anchor_index(&anchor_miss), None);

        let start = alias_node("start", "range-a");
        let start_equiv = alias_node("start", "range-a");
        let start_miss = alias_node("start", "range-b");
        rue.range_map.push(RangeMountState::new(
            start.clone(),
            node("end", 8.0),
            block_state(node("range-host", 1.0)),
        ));
        assert_eq!(rue.find_range_index(&start_miss), None);

        rue.set_dom_adapter(alias_adapter());
        assert_eq!(rue.find_container_index(&container_equiv), Some(0));
        assert_eq!(rue.find_container_index(&container_miss), None);
        assert_eq!(rue.find_anchor_index(&anchor_equiv), Some(0));
        assert_eq!(rue.find_range_index(&start_equiv), Some(0));
    }

    #[wasm_bindgen_test]
    fn find_helpers_skip_adapter_equivalence_for_native_contains_targets() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(alias_adapter());

        let container = alias_node("container", "same-container");
        set_native_contains_method(&container);
        let container_equiv = alias_node("container", "same-container");
        set_native_contains_method(&container_equiv);
        rue.container_map.push(ContainerMountState::new(
            container.clone(),
            block_state(node("container-host", 1.0)),
        ));
        assert_eq!(rue.find_container_index(&container), Some(0));
        assert_eq!(rue.find_container_index(&container_equiv), None);

        let anchor = alias_node("anchor", "same-anchor");
        set_native_contains_method(&anchor);
        let anchor_equiv = alias_node("anchor", "same-anchor");
        set_native_contains_method(&anchor_equiv);
        rue.anchor_map
            .push(AnchorMountState::new(anchor.clone(), block_state(node("anchor-host", 1.0))));
        assert_eq!(rue.find_anchor_index(&anchor), Some(0));
        assert_eq!(rue.find_anchor_index(&anchor_equiv), None);

        let start = alias_node("start", "same-range");
        set_native_contains_method(&start);
        let start_equiv = alias_node("start", "same-range");
        set_native_contains_method(&start_equiv);
        rue.range_map.push(RangeMountState::new(
            start.clone(),
            node("end", 8.0),
            block_state(node("range-host", 1.0)),
        ));
        assert_eq!(rue.find_range_index(&start), Some(0));
        assert_eq!(rue.find_range_index(&start_equiv), None);
    }

    #[wasm_bindgen_test]
    fn find_helpers_keep_adapter_equivalence_for_non_native_targets() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(alias_adapter());

        let container = alias_node("container", "non-native-container");
        let container_equiv = alias_node("container", "non-native-container");
        rue.container_map
            .push(ContainerMountState::new(container, block_state(node("container-host", 1.0))));

        let anchor = alias_node("anchor", "non-native-anchor");
        let anchor_equiv = alias_node("anchor", "non-native-anchor");
        rue.anchor_map.push(AnchorMountState::new(anchor, block_state(node("anchor-host", 1.0))));

        let start = alias_node("start", "non-native-range");
        let start_equiv = alias_node("start", "non-native-range");
        rue.range_map.push(RangeMountState::new(
            start,
            node("end", 8.0),
            block_state(node("range-host", 1.0)),
        ));

        assert_eq!(rue.find_container_index(&container_equiv), Some(0));
        assert_eq!(rue.find_anchor_index(&anchor_equiv), Some(0));
        assert_eq!(rue.find_range_index(&start_equiv), Some(0));
    }

    #[wasm_bindgen_test]
    fn find_helpers_cover_adapter_first_contains_false_and_second_true_edges() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(alias_adapter());

        let anchor = alias_node("anchor", "anchor-a");
        let anchor_one_way = alias_node("anchor", "");
        rue.anchor_map
            .push(AnchorMountState::new(anchor.clone(), block_state(node("anchor-host", 1.0))));
        assert_eq!(rue.find_anchor_index(&anchor_one_way), None);

        let range = alias_node("start", "range-a");
        let range_one_way = alias_node("start", "");
        rue.range_map.push(RangeMountState::new(
            range.clone(),
            node("end", 8.0),
            block_state(node("range-host", 1.0)),
        ));
        assert_eq!(rue.find_range_index(&range_one_way), None);
    }

    #[wasm_bindgen_test]
    fn sync_props_children_input_covers_early_returns_and_updates() {
        let mut rue = Rue::<JsDomAdapter>::new();
        let mut props = ComponentProps::new();
        props.insert("title".to_string(), JsValue::from_str("next"));
        rue.sync_props_children_input(&Object::new().into(), &props, &[]);

        let fake_no_peek = Object::new();
        Reflect::set(&fake_no_peek, &JsValue::from_str("__signal__"), &Object::new()).unwrap();
        rue.sync_props_children_input(&fake_no_peek.into(), &props, &[]);

        let fake_no_set = Object::new();
        let sig = Object::new();
        Reflect::set(
            &sig,
            &JsValue::from_str("peekPath"),
            &Function::new_no_args("return undefined").into(),
        )
        .unwrap();
        Reflect::set(&fake_no_set, &JsValue::from_str("__signal__"), &sig).unwrap();
        rue.sync_props_children_input(&fake_no_set.into(), &props, &[]);

        let initial = Object::new();
        Reflect::set(&initial, &JsValue::from_str("title"), &JsValue::from_str("old")).unwrap();
        let props_ro = create_reactive(initial.into(), None);
        let children = vec![MountInputChild::<JsDomAdapter>::Text("child".to_string())];
        rue.sync_props_children_input(&props_ro, &props, &children);

        assert_eq!(
            Reflect::get(&props_ro, &JsValue::from_str("title")).unwrap().as_string().as_deref(),
            Some("next")
        );
        let synced_children =
            Array::from(&Reflect::get(&props_ro, &JsValue::from_str("children")).unwrap());
        assert_eq!(synced_children.get(0).as_string().as_deref(), Some("child"));

        let mut props_with_children = ComponentProps::new();
        props_with_children.insert("children".to_string(), JsValue::NULL);
        rue.sync_props_children_input(&props_ro, &props_with_children, &[]);
    }

    #[wasm_bindgen_test]
    fn compact_anchor_map_covers_parent_node_detached_and_shadow_paths() {
        let mut rue = Rue::<JsDomAdapter>::new();
        let detached_fragment = node("fragment", 11.0);
        let shadow_root = node("shadow-root", 11.0);
        Reflect::set(&shadow_root, &JsValue::from_str("host"), &node("host", 1.0)).unwrap();

        let stale_anchor = node("stale-anchor", 8.0);
        set_parent(&stale_anchor, &detached_fragment);
        let shadow_anchor = node("shadow-anchor", 8.0);
        set_parent(&shadow_anchor, &shadow_root);
        let parented_anchor = node("parented-anchor", 8.0);
        set_parent(&parented_anchor, &node("parent", 1.0));

        rue.anchor_map.push(AnchorMountState::new(
            stale_anchor.clone(),
            block_state(node("stale-host", 1.0)),
        ));
        rue.anchor_map.push(AnchorMountState::new(
            shadow_anchor.clone(),
            block_state(node("shadow-host", 1.0)),
        ));
        rue.anchor_map.push(AnchorMountState::new(
            parented_anchor.clone(),
            block_state(node("parented-host", 1.0)),
        ));

        rue.compact_anchor_map();

        assert_eq!(rue.anchor_map.len(), 2);
        assert!(rue.find_anchor_index(&shadow_anchor).is_some());
        assert!(rue.find_anchor_index(&parented_anchor).is_some());
        assert!(rue.find_anchor_index(&stale_anchor).is_none());
    }

    #[wasm_bindgen_test]
    fn compact_anchor_map_covers_preserve_is_connected_and_empty_mount_paths() {
        let mut rue = Rue::<JsDomAdapter>::new();
        let preserve = node("preserve", 8.0);
        set_bool(&preserve, "isConnected", false);

        let connected = node("connected", 8.0);
        set_bool(&connected, "isConnected", true);

        let empty_mount = node("empty-mount", 8.0);
        set_bool(&empty_mount, "isConnected", false);
        let mut empty_entry =
            AnchorMountState::new(empty_mount.clone(), block_state(node("empty-host", 1.0)));
        empty_entry.clear();

        rue.anchor_map
            .push(AnchorMountState::new(preserve.clone(), block_state(node("preserve-host", 1.0))));
        rue.anchor_map.push(AnchorMountState::new(
            connected.clone(),
            block_state(node("connected-host", 1.0)),
        ));
        rue.anchor_map.push(empty_entry);

        rue.compact_anchor_map_preserving(Some(&preserve));

        assert_eq!(rue.anchor_map.len(), 2);
        assert!(rue.find_anchor_index(&preserve).is_some());
        assert!(rue.find_anchor_index(&connected).is_some());
        assert!(rue.find_anchor_index(&empty_mount).is_none());
    }

    #[wasm_bindgen_test]
    fn compact_anchor_map_drops_disconnected_anchor_with_parent_chain() {
        let mut rue = Rue::<JsDomAdapter>::new();
        let detached_parent = node("detached-parent", 1.0);
        let stale_anchor = node("stale-anchor", 8.0);
        set_bool(&stale_anchor, "isConnected", false);
        set_parent(&stale_anchor, &detached_parent);

        rue.anchor_map.push(AnchorMountState::new(
            stale_anchor.clone(),
            block_state(node("stale-host", 1.0)),
        ));

        rue.compact_anchor_map();

        assert!(rue.anchor_map.is_empty());
        assert!(rue.find_anchor_index(&stale_anchor).is_none());
    }

    #[wasm_bindgen_test]
    fn compact_anchor_map_preserves_current_disconnected_anchor_by_identity() {
        let mut rue = Rue::<JsDomAdapter>::new();
        let detached_parent = node("detached-parent", 1.0);
        let current_anchor = node("current-anchor", 8.0);
        set_bool(&current_anchor, "isConnected", false);
        set_parent(&current_anchor, &detached_parent);

        rue.anchor_map.push(AnchorMountState::new(
            current_anchor.clone(),
            block_state(node("current-host", 1.0)),
        ));

        rue.compact_anchor_map_preserving(Some(&current_anchor));

        assert_eq!(rue.anchor_map.len(), 1);
        assert!(rue.find_anchor_index(&current_anchor).is_some());
    }

    #[wasm_bindgen_test]
    fn compact_anchor_map_preserves_disconnected_anchor_in_current_detached_root() {
        let mut rue = Rue::<JsDomAdapter>::new();
        let detached_parent = node("detached-parent", 1.0);
        let stale_anchor = node("stale-anchor", 8.0);
        let current_anchor = node("current-anchor", 8.0);
        set_bool(&stale_anchor, "isConnected", false);
        set_parent(&stale_anchor, &detached_parent);
        set_parent(&current_anchor, &detached_parent);

        rue.anchor_map.push(AnchorMountState::new(
            stale_anchor.clone(),
            block_state(node("stale-host", 1.0)),
        ));

        rue.compact_anchor_map_preserving(Some(&current_anchor));

        assert_eq!(rue.anchor_map.len(), 1);
        assert!(rue.find_anchor_index(&stale_anchor).is_some());
    }

    #[wasm_bindgen_test]
    fn compact_anchor_map_drops_disconnected_anchor_before_adapter_parent_fallback() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(alias_adapter());
        let detached_parent = node("detached-parent", 1.0);
        let stale_anchor = alias_node("stale-anchor", "adapter-stale");
        set_bool(&stale_anchor, "isConnected", false);
        set_parent(&stale_anchor, &detached_parent);

        rue.anchor_map.push(AnchorMountState::new(
            stale_anchor.clone(),
            block_state(node("stale-host", 1.0)),
        ));

        rue.compact_anchor_map();

        assert!(rue.anchor_map.is_empty());
        assert!(rue.find_anchor_index(&stale_anchor).is_none());
    }

    #[wasm_bindgen_test]
    fn compact_anchor_map_native_contains_preserve_does_not_keep_disconnected_alias() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(alias_adapter());
        let stale_anchor = alias_node("stale-anchor", "native-stale");
        let preserve_alias = alias_node("preserve-anchor", "native-stale");
        set_native_contains_method(&preserve_alias);
        set_bool(&stale_anchor, "isConnected", false);
        set_parent(&stale_anchor, &node("detached-parent", 1.0));

        rue.anchor_map.push(AnchorMountState::new(
            stale_anchor.clone(),
            block_state(node("stale-host", 1.0)),
        ));

        rue.compact_anchor_map_preserving(Some(&preserve_alias));

        assert!(rue.anchor_map.is_empty());
        assert!(rue.find_anchor_index(&stale_anchor).is_none());
    }

    #[wasm_bindgen_test]
    fn compact_anchor_map_drops_many_disconnected_parented_anchors_and_resets_threshold() {
        let mut rue = Rue::<JsDomAdapter>::new();
        let live_anchor = node("live-anchor", 8.0);
        set_bool(&live_anchor, "isConnected", true);
        rue.anchor_map
            .push(AnchorMountState::new(live_anchor.clone(), block_state(node("live-host", 1.0))));

        for index in 0..(ANCHOR_MAP_COMPACT_STEP + 8) {
            let stale_anchor = node(&format!("stale-anchor-{index}"), 8.0);
            set_bool(&stale_anchor, "isConnected", false);
            set_parent(&stale_anchor, &node(&format!("detached-parent-{index}"), 1.0));
            rue.anchor_map
                .push(AnchorMountState::new(stale_anchor, block_state(node("stale-host", 1.0))));
        }

        rue.compact_anchor_map();

        assert_eq!(rue.anchor_map.len(), 1);
        assert!(rue.find_anchor_index(&live_anchor).is_some());
        assert_eq!(rue.anchor_map_next_compact_at, ANCHOR_MAP_COMPACT_STEP + 1);
    }

    #[wasm_bindgen_test]
    fn compact_anchor_map_disposes_effect_scope_for_disconnected_parented_anchor() {
        set_reactive_scheduling("sync");
        let mut rue = Rue::<JsDomAdapter>::new();
        let source = create_signal(JsValue::from_f64(0.0), None);
        let hits = Rc::new(Cell::new(0));
        let scope_id = create_effect_scope();

        push_effect_scope(scope_id);
        let source_for_effect = source.clone();
        let hits_for_effect = hits.clone();
        let effect = Closure::wrap(Box::new(move || {
            let _ = source_for_effect.get_js();
            hits_for_effect.set(hits_for_effect.get() + 1);
        }) as Box<dyn FnMut()>);
        let _handle = create_effect(effect.as_ref().clone().unchecked_into(), None);
        effect.forget();
        assert_eq!(pop_effect_scope(), Some(scope_id));
        assert_eq!(hits.get(), 1);

        let stale_anchor = node("stale-anchor", 8.0);
        set_bool(&stale_anchor, "isConnected", false);
        set_parent(&stale_anchor, &node("detached-parent", 1.0));
        rue.anchor_map.push(AnchorMountState::new(
            stale_anchor,
            scoped_block_state(node("stale-host", 1.0), scope_id),
        ));

        rue.compact_anchor_map();
        source.set_js(JsValue::from_f64(1.0));

        assert!(rue.anchor_map.is_empty());
        assert_eq!(hits.get(), 1);
    }

    #[wasm_bindgen_test]
    fn compact_anchor_map_covers_js_parent_fallback_without_adapter() {
        let mut rue = Rue::<JsDomAdapter>::new();
        let parent = node("parent", 1.0);
        let parented = node("parented", 8.0);
        set_parent(&parented, &parent);
        let child_parent = node("child-parent", 1.0);
        set_parent(&child_parent, &parent);
        let nested = node("nested", 8.0);
        set_parent(&nested, &child_parent);

        rue.anchor_map
            .push(AnchorMountState::new(parented.clone(), block_state(node("parented-host", 1.0))));
        rue.anchor_map
            .push(AnchorMountState::new(nested.clone(), block_state(node("nested-host", 1.0))));

        rue.compact_anchor_map();

        assert_eq!(rue.anchor_map.len(), 2);
        assert!(rue.find_anchor_index(&parented).is_some());
        assert!(rue.find_anchor_index(&nested).is_some());
    }

    #[wasm_bindgen_test]
    fn compact_anchor_map_covers_adapter_preserve_and_parent_paths() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(alias_adapter());

        let preserve_anchor = alias_node("preserve", "same-anchor");
        let preserve_equiv = alias_node("preserve", "same-anchor");
        set_bool(&preserve_anchor, "isConnected", false);

        let parent = node("parent", 1.0);
        let parented = node("parented", 8.0);
        set_parent(&parented, &parent);

        rue.anchor_map.push(AnchorMountState::new(
            preserve_anchor.clone(),
            block_state(node("preserve-host", 1.0)),
        ));
        rue.anchor_map
            .push(AnchorMountState::new(parented.clone(), block_state(node("parented-host", 1.0))));

        rue.compact_anchor_map_preserving(Some(&preserve_equiv));

        assert_eq!(rue.anchor_map.len(), 2);
        assert!(rue.find_anchor_index(&preserve_anchor).is_some());
        assert!(rue.find_anchor_index(&parented).is_some());
    }

    #[wasm_bindgen_test]
    fn compact_anchor_map_does_not_preserve_native_contains_equivalent_aliases() {
        let mut native_rue = Rue::<JsDomAdapter>::new();
        native_rue.set_dom_adapter(alias_adapter());
        let native_entry = alias_node("anchor", "preserve-me");
        let native_preserve = alias_node("anchor", "preserve-me");
        set_native_contains_method(&native_preserve);
        native_rue.anchor_map.push(AnchorMountState::new(
            native_entry.clone(),
            block_state(node("native-host", 1.0)),
        ));

        native_rue.compact_anchor_map_preserving(Some(&native_preserve));

        assert!(native_rue.anchor_map.is_empty());
        assert_eq!(native_rue.anchor_map_next_compact_at, ANCHOR_MAP_COMPACT_STEP);

        let mut adapter_rue = Rue::<JsDomAdapter>::new();
        adapter_rue.set_dom_adapter(alias_adapter());
        let adapter_entry = alias_node("anchor", "preserve-me");
        let adapter_preserve = alias_node("anchor", "preserve-me");
        adapter_rue.anchor_map.push(AnchorMountState::new(
            adapter_entry.clone(),
            block_state(node("adapter-host", 1.0)),
        ));

        adapter_rue.compact_anchor_map_preserving(Some(&adapter_preserve));

        assert_eq!(adapter_rue.anchor_map.len(), 1);
        assert!(adapter_rue.find_anchor_index(&adapter_entry).is_some());
        assert_eq!(adapter_rue.anchor_map_next_compact_at, ANCHOR_MAP_COMPACT_STEP + 1);
    }

    #[wasm_bindgen_test]
    fn maybe_compact_anchor_map_respects_empty_small_and_deferred_thresholds() {
        let mut empty = Rue::<JsDomAdapter>::new();
        empty.anchor_map_next_compact_at = 999;
        empty.maybe_compact_anchor_map_preserving(None);
        assert!(empty.anchor_map.is_empty());
        assert_eq!(empty.anchor_map_next_compact_at, ANCHOR_MAP_COMPACT_STEP);

        let mut small = Rue::<JsDomAdapter>::new();
        small.anchor_map_next_compact_at = 999;
        let small_stale = node("small-stale", 8.0);
        set_bool(&small_stale, "isConnected", false);
        small
            .anchor_map
            .push(AnchorMountState::new(small_stale, block_state(node("small-host", 1.0))));
        small.maybe_compact_anchor_map_preserving(None);
        assert!(small.anchor_map.is_empty());
        assert_eq!(small.anchor_map_next_compact_at, ANCHOR_MAP_COMPACT_STEP);

        let mut deferred = Rue::<JsDomAdapter>::new();
        deferred.anchor_map_next_compact_at = ANCHOR_MAP_COMPACT_STEP * 2;
        for index in 0..=ANCHOR_MAP_COMPACT_STEP {
            let stale = node(&format!("deferred-anchor-{index}"), 8.0);
            set_bool(&stale, "isConnected", false);
            deferred
                .anchor_map
                .push(AnchorMountState::new(stale, block_state(node("deferred-host", 1.0))));
        }
        deferred.maybe_compact_anchor_map_preserving(None);
        assert_eq!(deferred.anchor_map.len(), ANCHOR_MAP_COMPACT_STEP + 1);
        assert_eq!(deferred.anchor_map_next_compact_at, ANCHOR_MAP_COMPACT_STEP * 2);

        deferred.anchor_map_next_compact_at = ANCHOR_MAP_COMPACT_STEP + 1;
        deferred.maybe_compact_anchor_map_preserving(None);
        assert!(deferred.anchor_map.is_empty());
        assert_eq!(deferred.anchor_map_next_compact_at, ANCHOR_MAP_COMPACT_STEP);
    }

    #[wasm_bindgen_test]
    fn compact_maps_drop_hostless_mounts_without_debug_host() {
        let mut rue = Rue::<JsDomAdapter>::new();
        let render = Function::new_no_args("return null");
        let detached_fragment = node("fragment", 11.0);

        let stale_anchor = node("stale-anchor", 8.0);
        set_parent(&stale_anchor, &detached_fragment);
        rue.anchor_map
            .push(AnchorMountState::new(stale_anchor, hostless_component_patch_state(&render)));

        let stale_start = node("stale-start", 8.0);
        set_parent(&stale_start, &detached_fragment);
        rue.range_map.push(RangeMountState::new(
            stale_start,
            node("stale-end", 8.0),
            hostless_component_patch_state(&render),
        ));

        rue.compact_anchor_map();
        rue.compact_range_map();

        assert!(rue.anchor_map.is_empty());
        assert!(rue.range_map.is_empty());
    }

    #[wasm_bindgen_test]
    fn compact_range_map_covers_current_anchor_and_detached_parent_paths() {
        let mut rue = Rue::<JsDomAdapter>::new();
        let fragment = node("fragment", 11.0);
        let current_anchor = node("current-anchor", 8.0);
        set_parent(&current_anchor, &fragment);
        rue.current_anchor = Some(current_anchor.clone());

        let kept_start = node("kept-start", 8.0);
        set_parent(&kept_start, &fragment);
        let kept_end = node("kept-end", 8.0);
        let stale_start = node("stale-start", 8.0);
        set_parent(&stale_start, &node("detached-fragment", 11.0));
        let stale_end = node("stale-end", 8.0);

        rue.range_map.push(RangeMountState::new(
            kept_start.clone(),
            kept_end,
            block_state(node("kept-host", 1.0)),
        ));
        rue.range_map.push(RangeMountState::new(
            stale_start.clone(),
            stale_end,
            block_state(node("stale-host", 1.0)),
        ));

        rue.compact_range_map();

        assert_eq!(rue.range_map.len(), 1);
        assert!(rue.find_range_index(&kept_start).is_some());
        assert!(rue.find_range_index(&stale_start).is_none());
    }

    #[wasm_bindgen_test]
    fn compact_range_map_covers_js_fallback_and_empty_mount_paths() {
        let mut rue = Rue::<JsDomAdapter>::new();
        let parent = node("parent", 1.0);
        let kept_start = node("kept-start", 8.0);
        set_parent(&kept_start, &parent);

        let fragment = node("fragment", 11.0);
        let stale_start = node("stale-start", 8.0);
        set_parent(&stale_start, &fragment);

        let disconnected = node("disconnected", 8.0);
        set_bool(&disconnected, "isConnected", false);
        let mut empty_entry = RangeMountState::new(
            disconnected.clone(),
            node("empty-end", 8.0),
            block_state(node("empty-host", 1.0)),
        );
        empty_entry.clear();

        rue.range_map.push(RangeMountState::new(
            kept_start.clone(),
            node("kept-end", 8.0),
            block_state(node("kept-host", 1.0)),
        ));
        rue.range_map.push(RangeMountState::new(
            stale_start.clone(),
            node("stale-end", 8.0),
            block_state(node("stale-host", 1.0)),
        ));
        rue.range_map.push(empty_entry);

        rue.compact_range_map();

        assert_eq!(rue.range_map.len(), 1);
        assert!(rue.find_range_index(&kept_start).is_some());
        assert!(rue.find_range_index(&stale_start).is_none());
        assert!(rue.find_range_index(&disconnected).is_none());
    }

    #[wasm_bindgen_test]
    fn compact_range_map_drops_disconnected_start_with_parent_chain() {
        let mut rue = Rue::<JsDomAdapter>::new();
        let detached_parent = node("detached-parent", 1.0);
        let stale_start = node("stale-start", 8.0);
        set_bool(&stale_start, "isConnected", false);
        set_parent(&stale_start, &detached_parent);

        rue.range_map.push(RangeMountState::new(
            stale_start.clone(),
            node("stale-end", 8.0),
            block_state(node("stale-host", 1.0)),
        ));

        rue.compact_range_map();

        assert!(rue.range_map.is_empty());
        assert!(rue.find_range_index(&stale_start).is_none());
    }

    #[wasm_bindgen_test]
    fn compact_range_map_preserves_disconnected_start_in_current_detached_root() {
        let mut rue = Rue::<JsDomAdapter>::new();
        let detached_parent = node("detached-parent", 1.0);
        let current_end = node("current-end", 8.0);
        let kept_start = node("kept-start", 8.0);
        set_bool(&kept_start, "isConnected", false);
        set_bool(&current_end, "isConnected", false);
        set_parent(&kept_start, &detached_parent);
        set_parent(&current_end, &detached_parent);
        rue.current_anchor = Some(current_end);

        rue.range_map.push(RangeMountState::new(
            kept_start.clone(),
            node("kept-end", 8.0),
            block_state(node("kept-host", 1.0)),
        ));

        rue.compact_range_map();

        assert_eq!(rue.range_map.len(), 1);
        assert!(rue.find_range_index(&kept_start).is_some());
    }

    #[wasm_bindgen_test]
    fn compact_range_map_covers_connected_and_adapter_parent_paths() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(alias_adapter());

        let connected = node("connected", 8.0);
        set_bool(&connected, "isConnected", true);

        let parent = node("parent", 1.0);
        let parented = node("parented", 8.0);
        set_parent(&parented, &parent);

        rue.range_map.push(RangeMountState::new(
            connected.clone(),
            node("connected-end", 8.0),
            block_state(node("connected-host", 1.0)),
        ));
        rue.range_map.push(RangeMountState::new(
            parented.clone(),
            node("parented-end", 8.0),
            block_state(node("parented-host", 1.0)),
        ));

        rue.compact_range_map();

        assert_eq!(rue.range_map.len(), 2);
        assert!(rue.find_range_index(&connected).is_some());
        assert!(rue.find_range_index(&parented).is_some());
    }

    #[wasm_bindgen_test]
    fn maybe_compact_range_map_respects_empty_small_and_deferred_thresholds() {
        let mut empty = Rue::<JsDomAdapter>::new();
        empty.range_map_next_compact_at = 999;
        empty.maybe_compact_range_map();
        assert!(empty.range_map.is_empty());
        assert_eq!(empty.range_map_next_compact_at, RANGE_MAP_COMPACT_STEP);

        let mut small = Rue::<JsDomAdapter>::new();
        small.range_map_next_compact_at = 999;
        let small_stale = node("small-range-stale", 8.0);
        set_bool(&small_stale, "isConnected", false);
        small.range_map.push(RangeMountState::new(
            small_stale,
            node("small-range-end", 8.0),
            block_state(node("small-range-host", 1.0)),
        ));
        small.maybe_compact_range_map();
        assert!(small.range_map.is_empty());
        assert_eq!(small.range_map_next_compact_at, RANGE_MAP_COMPACT_STEP);

        let mut deferred = Rue::<JsDomAdapter>::new();
        deferred.range_map_next_compact_at = RANGE_MAP_COMPACT_STEP * 2;
        for index in 0..=RANGE_MAP_COMPACT_STEP {
            let stale = node(&format!("deferred-range-{index}"), 8.0);
            set_bool(&stale, "isConnected", false);
            deferred.range_map.push(RangeMountState::new(
                stale,
                node("deferred-range-end", 8.0),
                block_state(node("deferred-range-host", 1.0)),
            ));
        }
        deferred.maybe_compact_range_map();
        assert_eq!(deferred.range_map.len(), RANGE_MAP_COMPACT_STEP + 1);
        assert_eq!(deferred.range_map_next_compact_at, RANGE_MAP_COMPACT_STEP * 2);

        deferred.range_map_next_compact_at = RANGE_MAP_COMPACT_STEP + 1;
        deferred.maybe_compact_range_map();
        assert!(deferred.range_map.is_empty());
        assert_eq!(deferred.range_map_next_compact_at, RANGE_MAP_COMPACT_STEP);
    }
}
