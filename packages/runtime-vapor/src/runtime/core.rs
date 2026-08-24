//! 运行时核心：Rue 结构（中文注释增强）
//!
//! 本模块定义 Rue 运行时的核心数据结构与全局状态。
//! 注释采用中文高密度风格，便于团队内阅读与维护。
use crate::runtime::dom_adapter::DomAdapter;
use crate::runtime::instance::ComponentInternalInstance;
use crate::runtime::types::{
    AnchorMountState, ContainerMountState, OwnedMountPhase, OwnedMountSlot, OwnedMountToken,
    PendingComponentMounted, RangeMountState,
};
use js_sys::WeakMap;
use std::collections::{HashMap, HashSet};
use wasm_bindgen::JsValue;

/// Rue 运行时核心结构
///
/// - 负责容器、实例栈、生命周期钩子、插件与错误处理等全局状态
/// - 通过 dom_adapter 抽象底层 DOM/宿主环境操作
pub struct Rue<A: DomAdapter>
where
    A::Element: Clone,
{
    /// 容器与其当前挂载记录的映射
    pub(crate) container_map: Vec<ContainerMountState<A>>,
    /// 单锚点渲染映射（anchor -> mount），用于组件等可由尾锚点定位的增量更新
    pub(crate) anchor_map: Vec<AnchorMountState<A>>,
    /// 原生 anchor 对象到 `anchor_map` 下标的弱身份索引，不持有 DOM 强引用
    pub(crate) anchor_identity_index: WeakMap,
    /// 弱身份索引上次同步时对应的 Vec 长度，用于发现绕过 helper 的结构变更
    pub(crate) anchor_identity_indexed_len: usize,
    /// 当前活跃组件实例（用于钩子、错误处理等）
    pub(crate) current_instance: Option<ComponentInternalInstance<A>>,
    /// 当前已关联的容器计数
    #[allow(dead_code)]
    pub(crate) current_container_count: usize,
    /// 组件实例栈（用于嵌套组件钩子上下文）
    pub(crate) instance_stack: Vec<usize>,
    /// 实例存储（索引 -> 实例）
    pub(crate) instance_store: HashMap<usize, ComponentInternalInstance<A>>,
    /// 组件实例 ID 单调分配器；实例回收后 ID 仍不复用。
    pub(crate) next_component_instance_id: usize,
    /// 挂载完成后需要执行的队列（如 onMounted）
    #[allow(dead_code)]
    pub(crate) mounted_queue: Vec<Box<dyn FnMut()>>,
    /// 区间渲染的挂载映射（start/end -> mount）
    pub(crate) range_map: Vec<RangeMountState<A>>,
    /// 行 owner 的局部 mounted snapshot 槽；空槽可复用，但 generation 永不复用。
    pub(crate) owned_mount_slots: Vec<Option<OwnedMountSlot<A>>>,
    pub(crate) owned_mount_free_slots: Vec<usize>,
    pub(crate) next_owned_mount_generation: u64,
    /// 可重入 collector 栈；嵌套列表 build 会自然成为父 token 的 child。
    pub(crate) current_owned_collectors: Vec<OwnedMountToken>,
    /// 原生 range start 对象到 `range_map` 下标的弱身份索引，不持有 DOM 强引用
    pub(crate) range_identity_index: WeakMap,
    /// 弱身份索引上次同步时对应的 Vec 长度，用于发现绕过 helper 的结构变更
    pub(crate) range_identity_indexed_len: usize,
    /// 下一次触发 anchor 映射压缩的长度阈值
    pub(crate) anchor_map_next_compact_at: usize,
    /// 下一次触发 range 映射压缩的长度阈值
    pub(crate) range_map_next_compact_at: usize,
    #[cfg(any(feature = "dev", test))]
    pub(crate) anchor_identity_lookup_visits: usize,
    #[cfg(any(feature = "dev", test))]
    pub(crate) range_identity_lookup_visits: usize,
    #[cfg(any(feature = "dev", test))]
    pub(crate) anchor_compact_entry_visits: usize,
    #[cfg(any(feature = "dev", test))]
    pub(crate) range_compact_entry_visits: usize,
    #[cfg(any(feature = "dev", test))]
    pub(crate) anchor_compact_trigger_lengths: Vec<usize>,
    #[cfg(any(feature = "dev", test))]
    pub(crate) range_compact_trigger_lengths: Vec<usize>,
    /// 当前区间锚点（渲染 Between 时使用）
    pub(crate) current_anchor: Option<A::Element>,
    /// 错误处理器集合（按实例索引）
    #[allow(dead_code)]
    pub(crate) error_handlers: HashSet<usize>,
    /// 当前渲染的容器
    pub(crate) current_container: Option<A::Element>,
    /// 延迟执行队列（插件安装等）
    pub(crate) deferred_queue: Vec<Box<dyn FnMut()>>,
    /// 已安装插件及其参数（按实例索引）
    #[allow(dead_code)]
    pub(crate) installed_plugins: HashMap<usize, Vec<JsValue>>,
    /// 运行时是否已崩溃（全局标记）
    pub(crate) crashed: bool,
    /// DOM 适配器（可选，需先设置）
    pub(crate) dom_adapter: Option<A>,
    /// 最近一次错误（用于上报与调试）
    pub(crate) last_error: Option<JsValue>,
    /// 全局错误处理器列表
    pub(crate) global_error_handlers: Vec<JsValue>,
    /// 全局生命周期钩子（名称 -> JS 函数列表）
    pub(crate) lifecycle_hooks: HashMap<String, Vec<JsValue>>,
}

impl<A: DomAdapter> Rue<A>
where
    A::Element: Clone,
{
    /// 构建默认 Rue 实例（各状态初始化为空）
    pub fn new() -> Self {
        Rue {
            container_map: Vec::new(),
            anchor_map: Vec::new(),
            anchor_identity_index: WeakMap::new(),
            anchor_identity_indexed_len: 0,
            current_instance: None,
            current_container_count: 0,
            instance_stack: Vec::new(),
            instance_store: HashMap::new(),
            next_component_instance_id: 0,
            mounted_queue: Vec::new(),
            range_map: Vec::new(),
            owned_mount_slots: Vec::new(),
            owned_mount_free_slots: Vec::new(),
            next_owned_mount_generation: 1,
            current_owned_collectors: Vec::new(),
            range_identity_index: WeakMap::new(),
            range_identity_indexed_len: 0,
            anchor_map_next_compact_at: 0,
            range_map_next_compact_at: 0,
            #[cfg(any(feature = "dev", test))]
            anchor_identity_lookup_visits: 0,
            #[cfg(any(feature = "dev", test))]
            range_identity_lookup_visits: 0,
            #[cfg(any(feature = "dev", test))]
            anchor_compact_entry_visits: 0,
            #[cfg(any(feature = "dev", test))]
            range_compact_entry_visits: 0,
            #[cfg(any(feature = "dev", test))]
            anchor_compact_trigger_lengths: Vec::new(),
            #[cfg(any(feature = "dev", test))]
            range_compact_trigger_lengths: Vec::new(),
            current_anchor: None,
            error_handlers: HashSet::new(),
            current_container: None,
            deferred_queue: Vec::new(),
            installed_plugins: HashMap::new(),
            crashed: false,
            dom_adapter: None,
            last_error: None,
            global_error_handlers: Vec::new(),
            lifecycle_hooks: HashMap::new(),
        }
    }

    /// 设置 DOM 适配器（绑定宿主环境能力）
    pub fn set_dom_adapter(&mut self, adapter: A) {
        self.dom_adapter = Some(adapter);
    }

    /// 只读获取 DOM 适配器
    pub fn get_dom_adapter(&self) -> Option<&A> {
        self.dom_adapter.as_ref()
    }

    /// 可变获取 DOM 适配器
    pub fn get_dom_adapter_mut(&mut self) -> Option<&mut A> {
        self.dom_adapter.as_mut()
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub fn container_mount_count(&self) -> usize {
        self.container_map.len()
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub fn anchor_mount_count(&self) -> usize {
        self.anchor_map.len()
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub fn range_mount_count(&self) -> usize {
        self.range_map.len()
    }

    pub(crate) fn owned_mount_count(&self) -> usize {
        self.owned_mount_slots.iter().filter(|slot| slot.is_some()).count()
    }

    pub(crate) fn owned_mount_entry_count(&self) -> usize {
        self.owned_mount_slots
            .iter()
            .flatten()
            .map(|slot| slot.anchors.len() + slot.ranges.len())
            .sum()
    }

    pub(crate) fn component_instance_count(&self) -> usize {
        self.instance_store.len()
    }

    pub(crate) fn pending_component_mounted_count(&self) -> usize {
        self.owned_mount_slots
            .iter()
            .flatten()
            .map(|slot| slot.pending_component_mounted.len())
            .sum()
    }

    pub(crate) fn allocate_component_instance_id(&mut self) -> usize {
        let id = self.next_component_instance_id;
        self.next_component_instance_id = self
            .next_component_instance_id
            .checked_add(1)
            .expect("component instance id exhausted");
        id
    }

    pub(crate) fn current_owned_mount(&self) -> Option<OwnedMountToken> {
        self.current_owned_collectors.last().copied()
    }

    pub(crate) fn owned_mount_slot(&self, token: OwnedMountToken) -> Option<&OwnedMountSlot<A>> {
        self.owned_mount_slots
            .get(token.slot)
            .and_then(Option::as_ref)
            .filter(|slot| slot.generation == token.generation)
    }

    pub(crate) fn owned_mount_slot_mut(
        &mut self,
        token: OwnedMountToken,
    ) -> Option<&mut OwnedMountSlot<A>> {
        self.owned_mount_slots
            .get_mut(token.slot)
            .and_then(Option::as_mut)
            .filter(|slot| slot.generation == token.generation)
    }

    pub(crate) fn build_owned_mount(&mut self) -> OwnedMountToken {
        let generation = self.next_owned_mount_generation;
        self.next_owned_mount_generation = self
            .next_owned_mount_generation
            .checked_add(1)
            .expect("owned mount generation exhausted");
        let slot = self.owned_mount_free_slots.pop().unwrap_or(self.owned_mount_slots.len());
        let token = OwnedMountToken { slot, generation };
        if slot == self.owned_mount_slots.len() {
            self.owned_mount_slots.push(Some(OwnedMountSlot::new(generation)));
        } else {
            self.owned_mount_slots[slot] = Some(OwnedMountSlot::new(generation));
        }

        if let Some(parent) = self.current_owned_mount()
            && let Some(parent_slot) = self.owned_mount_slot_mut(parent)
        {
            parent_slot.children.push(token);
        }
        self.current_owned_collectors.push(token);
        token
    }

    pub(crate) fn commit_owned_mount(&mut self, token: OwnedMountToken) -> bool {
        if self.current_owned_mount() != Some(token) {
            return false;
        }
        let Some(slot) = self.owned_mount_slot_mut(token) else {
            return false;
        };
        slot.phase = OwnedMountPhase::Committed;
        slot.pending_mounted = false;
        self.current_owned_collectors.pop();
        if let Some(parent) = self.current_owned_mount() {
            let pending = self
                .owned_mount_slot_mut(token)
                .map(|slot| std::mem::take(&mut slot.pending_component_mounted))
                .unwrap_or_default();
            if let Some(parent_slot) = self.owned_mount_slot_mut(parent) {
                parent_slot.pending_component_mounted.extend(pending);
            }
        }
        true
    }

    pub(crate) fn queue_current_component_mounted(
        &mut self,
        inst_index: usize,
        parent_inst_index: Option<usize>,
        container: Option<A::Element>,
    ) -> bool {
        let Some(owner) = self.current_owned_mount() else {
            return false;
        };
        let Some(slot) = self.owned_mount_slot_mut(owner) else {
            return false;
        };
        slot.pending_component_mounted.push(PendingComponentMounted {
            owner,
            inst_index,
            parent_inst_index,
            container,
        });
        true
    }

    pub(crate) fn take_committed_component_mounted(
        &mut self,
        token: OwnedMountToken,
    ) -> Vec<PendingComponentMounted<A>>
    where
        A::Element: Into<JsValue>,
    {
        let Some(slot) = self.owned_mount_slot_mut(token) else {
            return Vec::new();
        };
        if slot.phase != OwnedMountPhase::Committed {
            return Vec::new();
        }
        let mut pending = std::mem::take(&mut slot.pending_component_mounted);
        let parents: HashMap<usize, Option<usize>> =
            pending.iter().map(|item| (item.inst_index, item.parent_inst_index)).collect();
        let depth = |item: &PendingComponentMounted<A>| {
            let mut depth = 0usize;
            let mut parent = item.parent_inst_index;
            let mut seen = HashSet::new();
            while let Some(index) = parent
                && seen.insert(index)
            {
                depth = depth.saturating_add(1);
                parent = parents.get(&index).copied().flatten();
            }
            depth
        };
        let container_depth = |item: &PendingComponentMounted<A>| {
            let Some(container) = item.container.as_ref() else {
                return 0usize;
            };
            let mut current: JsValue = container.clone().into();
            let mut depth = 0usize;
            for _ in 0..64 {
                let parent = js_sys::Reflect::get(&current, &JsValue::from_str("parentNode"))
                    .unwrap_or(JsValue::UNDEFINED);
                if parent.is_null() || parent.is_undefined() {
                    break;
                }
                depth = depth.saturating_add(1);
                current = parent;
            }
            depth
        };
        pending.sort_by_key(|item| {
            (std::cmp::Reverse(container_depth(item)), std::cmp::Reverse(depth(item)))
        });
        pending
    }

    pub(crate) fn begin_owned_mount_update(&mut self, token: OwnedMountToken) -> bool {
        let Some(slot) = self.owned_mount_slot(token) else {
            return false;
        };
        if slot.phase != OwnedMountPhase::Committed {
            return false;
        }
        self.current_owned_collectors.push(token);
        true
    }

    pub(crate) fn mark_current_owned_mount_pending(&mut self) {
        if let Some(token) = self.current_owned_mount()
            && let Some(slot) = self.owned_mount_slot_mut(token)
        {
            slot.pending_mounted = true;
        }
    }

    pub(crate) fn take_owned_mount_slot(
        &mut self,
        token: OwnedMountToken,
    ) -> Option<OwnedMountSlot<A>> {
        if self.owned_mount_slot(token).is_none() {
            return None;
        }
        self.current_owned_collectors.retain(|active| *active != token);
        let slot = self.owned_mount_slots[token.slot].take();
        self.owned_mount_free_slots.push(token.slot);
        slot
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use wasm_bindgen_test::*;

    #[derive(Clone)]
    struct NoopAdapter;

    impl DomAdapter for NoopAdapter {
        type Element = JsValue;

        fn create_element(&mut self, tag: &str) -> Self::Element {
            JsValue::from_str(tag)
        }

        fn create_text_node(&mut self, text: &str) -> Self::Element {
            JsValue::from_str(text)
        }

        fn create_document_fragment(&mut self) -> Self::Element {
            JsValue::from_str("fragment")
        }

        fn is_fragment(&self, el: &Self::Element) -> bool {
            el.as_string().as_deref() == Some("fragment")
        }

        fn collect_fragment_children(&self, _el: &Self::Element) -> Vec<Self::Element> {
            Vec::new()
        }

        fn set_text_content(&mut self, el: &mut Self::Element, text: &str) {
            *el = JsValue::from_str(text);
        }

        fn append_child(&mut self, _parent: &mut Self::Element, _child: &Self::Element) {}

        fn insert_before(
            &mut self,
            _parent: &mut Self::Element,
            _child: &Self::Element,
            _before: &Self::Element,
        ) {
        }

        fn remove_child(&mut self, _parent: &mut Self::Element, _child: &Self::Element) {}

        fn contains(&self, parent: &Self::Element, child: &Self::Element) -> bool {
            parent == child
        }

        fn get_parent_node(&self, _node: &Self::Element) -> Option<Self::Element> {
            None
        }

        fn replace_child(
            &mut self,
            parent: &mut Self::Element,
            new_child: &Self::Element,
            _old_child: &Self::Element,
        ) {
            *parent = new_child.clone();
        }

        fn set_class_name(&mut self, _el: &mut Self::Element, _value: &str) {}

        fn patch_style(
            &mut self,
            _el: &mut Self::Element,
            _old_style: &HashMap<String, String>,
            _new_style: &HashMap<String, String>,
        ) {
        }

        fn set_inner_html(&mut self, el: &mut Self::Element, html: &str) {
            *el = JsValue::from_str(html);
        }

        fn set_value(&mut self, _el: &mut Self::Element, _value: JsValue) {}

        fn set_checked(&mut self, _el: &mut Self::Element, _checked: bool) {}

        fn set_disabled(&mut self, _el: &mut Self::Element, _disabled: bool) {}

        fn clear_ref(&mut self, _ref_handle: JsValue) {}

        fn apply_ref(&mut self, _el: &mut Self::Element, _ref_handle: JsValue) {}

        fn set_attribute(&mut self, _el: &mut Self::Element, _key: &str, _value: &str) {}

        fn remove_attribute(&mut self, _el: &mut Self::Element, _key: &str) {}

        fn get_tag_name(&self, el: &Self::Element) -> String {
            el.as_string().unwrap_or_default()
        }

        fn add_event_listener(&mut self, _el: &mut Self::Element, _event: &str, _handler: JsValue) {
        }

        fn remove_event_listener(
            &mut self,
            _el: &mut Self::Element,
            _event: &str,
            _handler: JsValue,
        ) {
        }

        fn has_value_property(&self, _el: &Self::Element) -> bool {
            false
        }

        fn is_select_multiple(&self, _el: &Self::Element) -> bool {
            false
        }

        fn query_selector(&self, selector: &str) -> Option<Self::Element> {
            Some(JsValue::from_str(selector))
        }
    }

    #[wasm_bindgen_test]
    fn core_defaults_adapter_accessors_and_mount_counts_are_stable() {
        let mut rue = Rue::<NoopAdapter>::new();
        assert!(rue.get_dom_adapter().is_none());
        assert!(rue.get_dom_adapter_mut().is_none());
        assert_eq!(rue.container_mount_count(), 0);
        assert_eq!(rue.anchor_mount_count(), 0);
        assert_eq!(rue.range_mount_count(), 0);
        assert_eq!(rue.owned_mount_count(), 0);
        assert_eq!(rue.anchor_map_next_compact_at, 0);
        assert_eq!(rue.range_map_next_compact_at, 0);

        rue.set_dom_adapter(NoopAdapter);
        assert!(rue.get_dom_adapter().is_some());
        let adapter = rue.get_dom_adapter_mut().expect("adapter should be mutable");
        let mut el = adapter.create_element("div");
        let text = adapter.create_text_node("text");
        let fragment = adapter.create_document_fragment();
        assert!(adapter.is_fragment(&fragment));
        assert!(adapter.collect_fragment_children(&fragment).is_empty());
        adapter.set_text_content(&mut el, "updated");
        assert_eq!(el.as_string().as_deref(), Some("updated"));
        adapter.append_child(&mut el, &text);
        adapter.insert_before(&mut el, &text, &fragment);
        adapter.remove_child(&mut el, &text);
        assert!(adapter.contains(&el, &el));
        assert!(adapter.get_parent_node(&el).is_none());
        adapter.replace_child(&mut el, &fragment, &text);
        assert_eq!(el.as_string().as_deref(), Some("fragment"));
        adapter.set_class_name(&mut el, "active");
        adapter.patch_style(&mut el, &HashMap::new(), &HashMap::new());
        adapter.set_inner_html(&mut el, "<b>html</b>");
        assert_eq!(el.as_string().as_deref(), Some("<b>html</b>"));
        adapter.set_value(&mut el, JsValue::from_str("value"));
        adapter.set_checked(&mut el, true);
        adapter.set_disabled(&mut el, true);
        adapter.clear_ref(JsValue::UNDEFINED);
        adapter.apply_ref(&mut el, JsValue::UNDEFINED);
        adapter.set_attribute(&mut el, "role", "main");
        adapter.remove_attribute(&mut el, "role");
        assert_eq!(adapter.get_tag_name(&el), "<b>html</b>");
        adapter.add_event_listener(&mut el, "click", JsValue::UNDEFINED);
        adapter.remove_event_listener(&mut el, "click", JsValue::UNDEFINED);
        assert!(!adapter.has_value_property(&el));
        assert!(!adapter.is_select_multiple(&el));
        assert_eq!(
            adapter.query_selector(".target").and_then(|v| v.as_string()).as_deref(),
            Some(".target")
        );
        assert!(rue.current_container.is_none());
        assert!(!rue.crashed);
    }

    #[wasm_bindgen_test]
    fn owned_mount_generation_rejects_stale_and_tracks_nested_collectors() {
        let mut rue = Rue::<NoopAdapter>::new();
        let parent = rue.build_owned_mount();
        let child = rue.build_owned_mount();
        assert_eq!(rue.current_owned_mount(), Some(child));
        assert!(rue.commit_owned_mount(child));
        assert_eq!(rue.current_owned_mount(), Some(parent));
        assert!(rue.commit_owned_mount(parent));
        assert_eq!(rue.owned_mount_count(), 2);

        let old_child_slot = child.slot;
        assert!(rue.take_owned_mount_slot(child).is_some());
        let replacement = rue.build_owned_mount();
        assert_eq!(replacement.slot, old_child_slot);
        assert_ne!(replacement.generation, child.generation);
        assert!(rue.owned_mount_slot(child).is_none());
        assert!(!rue.commit_owned_mount(child));
        assert!(rue.commit_owned_mount(replacement));
    }
}
