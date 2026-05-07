//! 测试专用 DomAdapter 与节点模型
//!
//! 通过纯 Rust 结构体模拟 DOM 树，用于断言 runtime-vapor
//! 在渲染、补丁与事件行为上的正确性。
use js_sys::{Array, Function, Object, Promise, Reflect};
use rue_runtime_vapor::DomAdapter;
use wasm_bindgen::{JsCast, JsValue};
use wasm_bindgen_futures::JsFuture;

/// 测试用节点结构，模拟一个简化的 DOM 节点
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct TestNode {
    /// 标签名，例如 `div`、`#text`、`fragment`
    pub tag: String,
    /// 纯文本内容，仅对文本或 innerHTML 场景有意义
    pub text: String,
    /// 子节点列表，组成一棵树
    pub children: Vec<TestNode>,
    /// class 名称
    pub class: String,
    /// 唯一 id，作为节点在 HashMap 中的键
    pub id: u64,
    /// 是否为多选 select，用于 props 测试
    pub multiple: bool,
    /// 是否存在 value 属性，用于 props 测试
    pub has_value: bool,
}

impl Default for TestNode {
    fn default() -> Self {
        TestNode {
            tag: String::new(),
            text: String::new(),
            children: vec![],
            class: String::new(),
            id: 0,
            multiple: false,
            has_value: false,
        }
    }
}

/// 测试中记录发生过的“DOM 操作”
#[allow(dead_code)]
#[derive(Debug, Clone)]
pub enum TestEvent {
    /// 添加事件监听
    AddEvt(String),
    /// 移除事件监听
    RmEvt(String),
    /// 应用 ref
    ApplyRef(JsValue),
    /// 清理 ref
    ClearRef(JsValue),
    /// 设置 checked
    SetChecked(bool),
    /// 设置 disabled
    SetDisabled(bool),
    /// 设置 value
    SetValue(JsValue),
    /// 移除属性
    RemoveAttr(String),
}

/// DomAdapter 的测试实现
#[allow(dead_code)]
#[derive(Default)]
#[derive(Clone)]
pub struct TestAdapter {
    /// 下一个分配给节点的 id
    pub next_id: u64,
    /// 已记录的事件列表，供断言使用
    pub events: Vec<TestEvent>,
    /// id -> TestNode 的节点存储
    pub nodes: std::collections::HashMap<u64, TestNode>,
}

impl TestAdapter {
    /// 消费事件，避免编译器将枚举分支视为未使用
    #[allow(dead_code)]
    fn consume_event(e: &TestEvent) {
        match e {
            TestEvent::AddEvt(s) | TestEvent::RmEvt(s) => {
                let _ = s.len();
            }
            TestEvent::ApplyRef(v) | TestEvent::ClearRef(v) => {
                let _ = v.is_undefined();
            }
            TestEvent::SetChecked(b) | TestEvent::SetDisabled(b) => {
                let _ = *b;
            }
            TestEvent::SetValue(v) => {
                let _ = v.is_object() || v.is_string();
            }
            TestEvent::RemoveAttr(s) => {
                let _ = s.len();
            }
        }
    }
    /// 将事件推入列表，并通过 consume_event 确保各分支被触达
    #[allow(dead_code)]
    fn push_event(&mut self, e: TestEvent) {
        Self::consume_event(&e);
        self.events.push(e);
    }

    fn sync_child_snapshots(children: &mut [TestNode], updated: &TestNode) {
        for child in children.iter_mut() {
            if child.id == updated.id {
                *child = updated.clone();
            }
            Self::sync_child_snapshots(&mut child.children, updated);
        }
    }

    fn sync_node_snapshots(&mut self, updated_id: u64) {
        let Some(updated) = self.nodes.get(&updated_id).cloned() else {
            return;
        };

        for node in self.nodes.values_mut() {
            Self::sync_child_snapshots(&mut node.children, &updated);
        }
    }
}
impl From<JsValue> for TestNode {
    fn from(value: JsValue) -> Self {
        if let Some(idf) = value.as_f64() {
            return TestNode { id: idf as u64, ..Default::default() };
        }
        TestNode::default()
    }
}
impl From<TestNode> for JsValue {
    fn from(node: TestNode) -> JsValue {
        JsValue::from_f64(node.id as f64)
    }
}

/// 为测试实现 DomAdapter，使 runtime 可以在纯 Rust 环境中“渲染”到 TestNode
impl DomAdapter for TestAdapter {
    type Element = TestNode;

    fn create_element(&mut self, tag: &str) -> Self::Element {
        self.next_id += 1;
        let n = TestNode { tag: tag.into(), id: self.next_id, ..Default::default() };
        self.nodes.insert(n.id, n.clone());
        n
    }
    fn create_text_node(&mut self, text: &str) -> Self::Element {
        self.next_id += 1;
        let n = TestNode {
            tag: "#text".into(),
            text: text.into(),
            id: self.next_id,
            ..Default::default()
        };
        self.nodes.insert(n.id, n.clone());
        n
    }
    fn create_document_fragment(&mut self) -> Self::Element {
        self.next_id += 1;
        let n = TestNode { tag: "fragment".into(), id: self.next_id, ..Default::default() };
        self.nodes.insert(n.id, n.clone());
        n
    }
    fn is_fragment(&self, el: &Self::Element) -> bool {
        self.nodes.get(&el.id).map(|n| n.tag.as_str() == "fragment").unwrap_or(false)
    }
    fn collect_fragment_children(&self, el: &Self::Element) -> Vec<Self::Element> {
        if let Some(n) = self.nodes.get(&el.id) {
            n.children
                .iter()
                .map(|c| self.nodes.get(&c.id).cloned().unwrap_or_else(|| c.clone()))
                .collect()
        } else {
            Vec::new()
        }
    }
    fn set_text_content(&mut self, el: &mut Self::Element, text: &str) {
        if let Some(n) = self.nodes.get_mut(&el.id) {
            n.text = text.into();
        }
        self.sync_node_snapshots(el.id);
    }
    fn append_child(&mut self, parent: &mut Self::Element, child: &Self::Element) {
        // 片段会被展开为其子节点，其它节点直接附加
        let to_append = if self.is_fragment(child) {
            self.collect_fragment_children(child)
        } else {
            vec![self.nodes.get(&child.id).cloned().unwrap_or_else(|| child.clone())]
        };
        if let Some(p) = self.nodes.get_mut(&parent.id) {
            for ch in to_append.into_iter() {
                p.children.push(ch);
            }
        }
    }
    fn insert_before(
        &mut self,
        parent: &mut Self::Element,
        child: &Self::Element,
        _before: &Self::Element,
    ) {
        // 为简化实现，insert_before 在测试适配器中等价于 append_child
        let to_append = if self.is_fragment(child) {
            self.collect_fragment_children(child)
        } else {
            vec![self.nodes.get(&child.id).cloned().unwrap_or_else(|| child.clone())]
        };
        if let Some(p) = self.nodes.get_mut(&parent.id) {
            for ch in to_append.into_iter() {
                p.children.push(ch);
            }
        }
    }
    fn remove_child(&mut self, parent: &mut Self::Element, child: &Self::Element) {
        if let Some(p) = self.nodes.get_mut(&parent.id) {
            p.children.retain(|c| c.id != child.id);
        }
    }
    /// 仅检查单层 children，满足测试场景即可
    fn contains(&self, parent: &Self::Element, child: &Self::Element) -> bool {
        if parent.id == child.id {
            return true;
        }
        self.nodes
            .get(&parent.id)
            .map(|p| p.children.iter().any(|c| c.id == child.id))
            .unwrap_or(false)
    }
    fn get_parent_node(&self, node: &Self::Element) -> Option<Self::Element> {
        for (_id, cand) in self.nodes.iter() {
            if cand.children.iter().any(|c| c.id == node.id) {
                return self.nodes.get(&cand.id).cloned();
            }
        }
        None
    }
    fn replace_child(
        &mut self,
        parent: &mut Self::Element,
        new_child: &Self::Element,
        old_child: &Self::Element,
    ) {
        let replacement =
            self.nodes.get(&new_child.id).cloned().unwrap_or_else(|| new_child.clone());
        if let Some(p) = self.nodes.get_mut(&parent.id) {
            if let Some(pos) = p.children.iter().position(|c| c.id == old_child.id) {
                p.children[pos] = replacement;
            } else {
                p.children.push(replacement);
            }
        }
    }
    fn set_class_name(&mut self, el: &mut Self::Element, value: &str) {
        if let Some(n) = self.nodes.get_mut(&el.id) {
            n.class = value.into();
        }
    }
    fn patch_style(
        &mut self,
        _el: &mut Self::Element,
        _old_style: &std::collections::HashMap<String, String>,
        _new_style: &std::collections::HashMap<String, String>,
    ) {
    }
    fn set_inner_html(&mut self, el: &mut Self::Element, html: &str) {
        if let Some(n) = self.nodes.get_mut(&el.id) {
            n.children.clear();
            n.text = html.into();
        }
    }
    fn set_value(&mut self, _el: &mut Self::Element, value: JsValue) {
        self.push_event(TestEvent::SetValue(value));
    }
    fn set_checked(&mut self, _el: &mut Self::Element, checked: bool) {
        self.push_event(TestEvent::SetChecked(checked));
    }
    fn set_disabled(&mut self, _el: &mut Self::Element, disabled: bool) {
        self.push_event(TestEvent::SetDisabled(disabled));
    }
    fn clear_ref(&mut self, ref_handle: JsValue) {
        self.push_event(TestEvent::ClearRef(ref_handle));
    }
    fn apply_ref(&mut self, _el: &mut Self::Element, ref_handle: JsValue) {
        self.push_event(TestEvent::ApplyRef(ref_handle));
    }
    fn set_attribute(&mut self, _el: &mut Self::Element, key: &str, value: &str) {
        let _ = (key, value);
    }
    fn remove_attribute(&mut self, _el: &mut Self::Element, key: &str) {
        self.push_event(TestEvent::RemoveAttr(key.into()));
    }
    fn get_tag_name(&self, el: &Self::Element) -> String {
        self.nodes.get(&el.id).map(|n| n.tag.clone()).unwrap_or_default()
    }
    fn add_event_listener(&mut self, _el: &mut Self::Element, event: &str, _handler: JsValue) {
        self.push_event(TestEvent::AddEvt(event.to_string()));
    }
    fn remove_event_listener(&mut self, _el: &mut Self::Element, event: &str, _handler: JsValue) {
        self.push_event(TestEvent::RmEvt(event.to_string()));
    }
    fn has_value_property(&self, el: &Self::Element) -> bool {
        self.nodes.get(&el.id).map(|n| n.has_value).unwrap_or(false)
    }
    fn is_select_multiple(&self, el: &Self::Element) -> bool {
        self.nodes.get(&el.id).map(|n| n.multiple).unwrap_or(false)
    }
    fn query_selector(&self, _selector: &str) -> Option<Self::Element> {
        // 测试适配器目前不模拟查询
        None
    }
}

#[allow(dead_code)]
pub async fn tick() {
    let p = Promise::resolve(&JsValue::UNDEFINED);
    let _ = JsFuture::from(p).await;
}

#[allow(dead_code)]
pub fn update_siblings(parent: &JsValue) {
    let children =
        Reflect::get(parent, &JsValue::from_str("children")).unwrap_or(Array::new().into());
    let arr: Array = children.unchecked_into();
    for index in 0..arr.length() {
        let cur = arr.get(index);
        let prev = if index > 0 {
            arr.get(index - 1)
        } else {
            JsValue::NULL
        };
        let next = if index + 1 < arr.length() {
            arr.get(index + 1)
        } else {
            JsValue::NULL
        };
        let _ = Reflect::set(&cur, &JsValue::from_str("previousSibling"), &prev);
        let _ = Reflect::set(&cur, &JsValue::from_str("nextSibling"), &next);
        let _ = Reflect::set(&cur, &JsValue::from_str("parentNode"), parent);
    }
}

#[allow(dead_code)]
fn build_linked_adapter(consume_fragment_children: bool) -> JsValue {
    let obj = Object::new();
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("createElement"),
        &Function::new_with_args("tag", "return { tag, children: [] }").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("createTextNode"),
        &Function::new_with_args("text", "return { tag: '#text', text, children: [] }").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("createDocumentFragment"),
        &Function::new_no_args("return { tag: 'fragment', children: [] }").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("isFragment"),
        &Function::new_with_args("el", "return !!el && el.tag === 'fragment'").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("collectFragmentChildren"),
        &Function::new_with_args("el", "return Array.from(el && el.children || [])").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setTextContent"),
        &Function::new_with_args("el,text", "el.text = text").into(),
    );

    let append_impl = if consume_fragment_children {
        Function::new_with_args(
            "p,c",
            "p.children = p.children||[]; \
             if (c && c.tag === 'fragment') { \
               const list = Array.from(c.children||[]); \
               list.forEach(ch => p.children.push(ch)); \
               c.children = []; \
             } else { \
               p.children.push(c); \
             } \
             return;",
        )
    } else {
        Function::new_with_args(
            "p,c",
            "p.children = p.children||[]; \
             if (c && c.tag === 'fragment') { \
               const list = Array.from(c.children||[]); \
               list.forEach(ch => p.children.push(ch)); \
             } else { \
               p.children.push(c); \
             } \
             return;",
        )
    };
    let _ = Reflect::set(&obj, &JsValue::from_str("appendChild"), &append_impl.into());

    let insert_impl = if consume_fragment_children {
        Function::new_with_args(
            "p,c,b",
            "p.children = p.children||[]; \
             const idx = (p.children||[]).indexOf(b); \
             const at = idx >= 0 ? idx : p.children.length; \
             if (c && c.tag === 'fragment') { \
               const list = Array.from(c.children||[]); \
               p.children.splice(at, 0, ...list); \
               c.children = []; \
             } else { \
               p.children.splice(at, 0, c); \
             } \
             return;",
        )
    } else {
        Function::new_with_args(
            "p,c,b",
            "p.children = p.children||[]; \
             const idx = (p.children||[]).indexOf(b); \
             const at = idx >= 0 ? idx : p.children.length; \
             if (c && c.tag === 'fragment') { \
               const list = Array.from(c.children||[]); \
               p.children.splice(at, 0, ...list); \
             } else { \
               p.children.splice(at, 0, c); \
             } \
             return;",
        )
    };
    let _ = Reflect::set(&obj, &JsValue::from_str("insertBefore"), &insert_impl.into());

    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("removeChild"),
        &Function::new_with_args("p,c", "p.children = (p.children||[]).filter(x=>x!==c)").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("contains"),
        &Function::new_with_args("p,c", "return p===c || (p.children||[]).includes(c)").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setClassName"),
        &Function::new_with_args("el,v", "el.class = v").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("patchStyle"),
        &Function::new_with_args("el,old,newv", "return").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setInnerHTML"),
        &Function::new_with_args("el,html", "el.children=[]; el.text=html").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setValue"),
        &Function::new_with_args("el,v", "el.value = v").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setChecked"),
        &Function::new_with_args("el,b", "el.checked = !!b").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setDisabled"),
        &Function::new_with_args("el,b", "el.disabled = !!b").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("clearRef"),
        &Function::new_with_args("r", "return").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("applyRef"),
        &Function::new_with_args("el,r", "return").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setAttribute"),
        &Function::new_with_args("el,k,v", "el.attrs = el.attrs||{}; el.attrs[k]=v").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("removeAttribute"),
        &Function::new_with_args("el,k", "if(el.attrs) delete el.attrs[k]").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("getTagName"),
        &Function::new_with_args("el", "return el.tag||''").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("addEventListener"),
        &Function::new_with_args("el,evt,h", "return").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("removeEventListener"),
        &Function::new_with_args("el,evt,h", "return").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("hasValueProperty"),
        &Function::new_with_args("el", "return 'value' in el").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("isSelectMultiple"),
        &Function::new_with_args("el", "return el.tag==='SELECT' && !!el.multiple").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("querySelector"),
        &Function::new_with_args("sel", "return { tag: sel, children: [] }").into(),
    );
    obj.into()
}

#[allow(dead_code)]
pub fn make_linked_adapter() -> JsValue {
    build_linked_adapter(false)
}

#[allow(dead_code)]
pub fn make_consuming_linked_adapter() -> JsValue {
    build_linked_adapter(true)
}

#[allow(dead_code)]
pub fn make_wasm_adapter() -> JsValue {
    let obj = Object::new();
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("createElement"),
        &Function::new_with_args("tag", "return { tag, children: [] }").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("createTextNode"),
        &Function::new_with_args("text", "return { tag: '#text', text }").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("createDocumentFragment"),
        &Function::new_no_args("return { tag: 'fragment', children: [] }").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("isFragment"),
        &Function::new_with_args("el", "return !!el && el.tag === 'fragment'").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("collectFragmentChildren"),
        &Function::new_with_args("el", "return Array.from(el && el.children || [])").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setTextContent"),
        &Function::new_with_args("el,text", "el.text = text").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("appendChild"),
        &Function::new_with_args("p,c", "p.children = p.children||[]; p.children.push(c)").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("insertBefore"),
        &Function::new_with_args("p,c,b", "p.children = p.children||[]; p.children.push(c)").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("removeChild"),
        &Function::new_with_args("p,c", "p.children = (p.children||[]).filter(x=>x!==c)").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("contains"),
        &Function::new_with_args("p,c", "return p===c || (p.children||[]).includes(c)").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setClassName"),
        &Function::new_with_args("el,v", "el.class = v").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("patchStyle"),
        &Function::new_with_args(
            "el,old,newv",
            "Object.keys(newv).forEach(k=>{ el.style = el.style||{}; el.style[k]=newv[k]; })",
        )
        .into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setInnerHTML"),
        &Function::new_with_args("el,html", "el.children=[]; el.text=html").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setValue"),
        &Function::new_with_args("el,v", "el.value = v").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setChecked"),
        &Function::new_with_args("el,b", "el.checked = !!b").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setDisabled"),
        &Function::new_with_args("el,b", "el.disabled = !!b").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("clearRef"),
        &Function::new_with_args("r", "return").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("applyRef"),
        &Function::new_with_args("el,r", "return").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setAttribute"),
        &Function::new_with_args("el,k,v", "el.attrs = el.attrs||{}; el.attrs[k]=v").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("removeAttribute"),
        &Function::new_with_args("el,k", "if(el.attrs) delete el.attrs[k]").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("getTagName"),
        &Function::new_with_args("el", "return el.tag||''").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("addEventListener"),
        &Function::new_with_args("el,evt,h", "return").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("removeEventListener"),
        &Function::new_with_args("el,evt,h", "return").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("hasValueProperty"),
        &Function::new_with_args("el", "return 'value' in el").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("isSelectMultiple"),
        &Function::new_with_args("el", "return el.tag==='SELECT' && !!el.multiple").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("querySelector"),
        &Function::new_with_args("sel", "return { tag: sel, children: [] }").into(),
    );
    obj.into()
}

#[allow(dead_code)]
pub fn make_vapor_only_adapter() -> JsValue {
    let obj = Object::new();
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("createElement"),
        &Function::new_with_args("tag", "return { tag, children: [], nodeType: 1 }").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("createTextNode"),
        &Function::new_with_args("text", "return { tag: '#text', text, nodeType: 3 }").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("createDocumentFragment"),
        &Function::new_no_args("return { tag: 'fragment', children: [], nodeType: 11 }").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("isFragment"),
        &Function::new_with_args("el", "return !!el && el.tag === 'fragment'").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("collectFragmentChildren"),
        &Function::new_with_args("el", "return Array.from(el && el.children || [])").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setTextContent"),
        &Function::new_with_args("el,text", "el.text = text").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("appendChild"),
        &Function::new_with_args(
            "p,c",
            "p.children = p.children||[]; p.children.push(c); c.parentNode = p",
        )
        .into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("insertBefore"),
        &Function::new_with_args(
            "p,c,b",
            "p.children = p.children||[]; const idx = p.children.indexOf(b); if (idx >= 0) { p.children.splice(idx, 0, c); } else { p.children.push(c); } c.parentNode = p",
        )
        .into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("removeChild"),
        &Function::new_with_args(
            "p,c",
            "p.children = (p.children||[]).filter(x => x !== c); if (c) c.parentNode = null",
        )
        .into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("contains"),
        &Function::new_with_args("p,c", "return p===c || (p.children||[]).includes(c)").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setClassName"),
        &Function::new_with_args("el,v", "el.class = v").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("patchStyle"),
        &Function::new_with_args("el,old,newv", "el.style = newv").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setInnerHTML"),
        &Function::new_with_args("el,html", "el.children=[]; el.text=html").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setValue"),
        &Function::new_with_args("el,v", "el.value = v").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setChecked"),
        &Function::new_with_args("el,b", "el.checked = !!b").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setDisabled"),
        &Function::new_with_args("el,b", "el.disabled = !!b").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("clearRef"),
        &Function::new_with_args("r", "return").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("applyRef"),
        &Function::new_with_args("el,r", "return").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setAttribute"),
        &Function::new_with_args("el,k,v", "el.attrs = el.attrs||{}; el.attrs[k]=v").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("removeAttribute"),
        &Function::new_with_args("el,k", "if(el.attrs) delete el.attrs[k]").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("getTagName"),
        &Function::new_with_args("el", "return el.tag||''").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("addEventListener"),
        &Function::new_with_args("el,evt,h", "return").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("removeEventListener"),
        &Function::new_with_args("el,evt,h", "return").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("hasValueProperty"),
        &Function::new_with_args("el", "return 'value' in el").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("isSelectMultiple"),
        &Function::new_with_args("el", "return el.tag==='SELECT' && !!el.multiple").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("querySelector"),
        &Function::new_with_args("sel", "return { tag: sel, children: [], nodeType: 1 }").into(),
    );
    obj.into()
}

#[allow(dead_code)]
pub fn js_obj() -> JsValue {
    Object::new().into()
}

#[allow(dead_code)]
fn adapter_call0(adapter: &JsValue, method: &str) -> JsValue {
    let f = Reflect::get(adapter, &JsValue::from_str(method)).unwrap();
    let func = f.unchecked_ref::<Function>();
    func.call0(adapter).unwrap()
}

#[allow(dead_code)]
fn adapter_call1(adapter: &JsValue, method: &str, arg: &JsValue) -> JsValue {
    let f = Reflect::get(adapter, &JsValue::from_str(method)).unwrap();
    let func = f.unchecked_ref::<Function>();
    func.call1(adapter, arg).unwrap()
}

#[allow(dead_code)]
fn adapter_call2(adapter: &JsValue, method: &str, arg1: &JsValue, arg2: &JsValue) {
    let f = Reflect::get(adapter, &JsValue::from_str(method)).unwrap();
    let func = f.unchecked_ref::<Function>();
    let _ = func.call2(adapter, arg1, arg2);
}

#[allow(dead_code)]
pub fn setup_range(adapter: &JsValue) -> (JsValue, JsValue, JsValue) {
    let parent = adapter_call0(adapter, "createDocumentFragment");
    let start = adapter_call1(adapter, "createElement", &JsValue::from_str("comment_start"));
    let end = adapter_call1(adapter, "createElement", &JsValue::from_str("comment_end"));
    adapter_call2(adapter, "appendChild", &parent, &start);
    adapter_call2(adapter, "appendChild", &parent, &end);
    update_siblings(&parent);
    (parent, start, end)
}

#[allow(dead_code)]
pub fn setup_anchor(adapter: &JsValue) -> (JsValue, JsValue) {
    let parent = adapter_call0(adapter, "createDocumentFragment");
    let anchor = adapter_call1(adapter, "createElement", &JsValue::from_str("comment_anchor"));
    adapter_call2(adapter, "appendChild", &parent, &anchor);
    update_siblings(&parent);
    (parent, anchor)
}

#[allow(dead_code)]
pub fn setup_container(adapter: &JsValue) -> JsValue {
    adapter_call0(adapter, "createDocumentFragment")
}

#[allow(dead_code)]
fn direct_children(parent: &JsValue) -> Array {
    let children =
        Reflect::get(parent, &JsValue::from_str("children")).unwrap_or(Array::new().into());
    if children.is_object() {
        Array::from(&children)
    } else {
        Array::new()
    }
}

#[allow(dead_code)]
pub fn children_of(target: &JsValue) -> Array {
    direct_children(target)
}

#[allow(dead_code)]
fn tag_name(node: &JsValue) -> String {
    Reflect::get(node, &JsValue::from_str("tag"))
        .unwrap_or(JsValue::UNDEFINED)
        .as_string()
        .unwrap_or_default()
}

#[allow(dead_code)]
pub fn child_sequence(parent: &JsValue) -> Vec<String> {
    direct_children(parent)
        .iter()
        .map(|item| {
            let tag = tag_name(&item);
            if tag == "#text" {
                Reflect::get(&item, &JsValue::from_str("text"))
                    .unwrap_or(JsValue::UNDEFINED)
                    .as_string()
                    .unwrap_or_default()
            } else {
                tag
            }
        })
        .collect()
}

#[allow(dead_code)]
pub fn first_child_text(el: &JsValue) -> String {
    let arr = direct_children(el);
    Reflect::get(&arr.get(0), &JsValue::from_str("text"))
        .unwrap_or(JsValue::UNDEFINED)
        .as_string()
        .unwrap_or_default()
}

#[allow(dead_code)]
pub fn first_child_with_tag(parent: &JsValue, tag: &str) -> Option<JsValue> {
    direct_children(parent)
        .iter()
        .find(|item| tag_name(item) == tag)
}

#[allow(dead_code)]
pub fn count_children_with_tag(parent: &JsValue, tag: &str) -> usize {
    direct_children(parent)
        .iter()
        .filter(|item| tag_name(item) == tag)
        .count()
}
