//! 运行时核心：Rue 结构（中文注释增强）
//!
//! 本模块定义 Rue 运行时的核心数据结构与全局状态。
//! 注释采用中文高密度风格，便于团队内阅读与维护。
use crate::runtime::dom_adapter::DomAdapter;
use crate::runtime::instance::ComponentInternalInstance;
use crate::runtime::types::{AnchorMountState, ContainerMountState, RangeMountState};
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
    /// 当前活跃组件实例（用于钩子、错误处理等）
    pub(crate) current_instance: Option<ComponentInternalInstance<A>>,
    /// 当前已关联的容器计数
    #[allow(dead_code)]
    pub(crate) current_container_count: usize,
    /// 组件实例栈（用于嵌套组件钩子上下文）
    pub(crate) instance_stack: Vec<usize>,
    /// 实例存储（索引 -> 实例）
    pub(crate) instance_store: HashMap<usize, ComponentInternalInstance<A>>,
    /// 挂载完成后需要执行的队列（如 onMounted）
    #[allow(dead_code)]
    pub(crate) mounted_queue: Vec<Box<dyn FnMut()>>,
    /// 区间渲染的挂载映射（start/end -> mount）
    pub(crate) range_map: Vec<RangeMountState<A>>,
    /// 下一次触发 anchor 映射压缩的长度阈值
    pub(crate) anchor_map_next_compact_at: usize,
    /// 下一次触发 range 映射压缩的长度阈值
    pub(crate) range_map_next_compact_at: usize,
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
            current_instance: None,
            current_container_count: 0,
            instance_stack: Vec::new(),
            instance_store: HashMap::new(),
            mounted_queue: Vec::new(),
            range_map: Vec::new(),
            anchor_map_next_compact_at: 0,
            range_map_next_compact_at: 0,
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
}
