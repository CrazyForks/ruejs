/*
JsDomAdapter（浏览器/JS 环境适配）
-----------------------------------
该适配器将 DomAdapter 的抽象方法映射到 JS 对象上的同名函数：
- 构造时通过 js_sys::Reflect 抓取并缓存 JS 方法，热路径直接调用缓存；
- 调用并转换返回值到 JsValue；
- 对必须存在的方法进行审计（new 时检查），确保运行时所有原语可用；
- 在宿主返回 undefined/null 时抛错，帮助尽早定位实现缺失或返回异常。

核心约定：
- inner: 传入的适配器 JS 对象，必须包含一组完整的方法（详见 req 列表）。
- 错误策略：throw_str 会使 wasm 测试直接失败；这是刻意的“及早失败”设计。
- 类型转换：元素类型即为 JsValue；片段 children 用 Array 转 Vec<JsValue>。

最小工作示例（构造 JS 适配器对象）：
const adapter = {
  createElement: (tag) => ({ tag, children: [] }),
  createTextNode: (text) => ({ tag: '#text', text }),
  createDocumentFragment: () => ({ tag: 'fragment', children: [] }),
  isFragment: (el) => !!el && el.tag === 'fragment',
  collectFragmentChildren: (el) => Array.from((el && el.children) || []),
  setTextContent: (el, text) => { el.text = text },
  appendChild: (p, c) => { (p.children ||= []).push(c) },
  insertBefore: (p, c, b) => { (p.children ||= []).push(c) },
  removeChild: (p, c) => { p.children = (p.children || []).filter(x => x !== c) },
  contains: (p, c) => p === c || ((p.children || []).includes(c)),
  setClassName: (el, v) => { el.class = v },
  patchStyle: (el, old, next) => { Object.keys(next).forEach(k => (el.style ||= {}, el.style[k] = next[k])) },
  setInnerHTML: (el, html) => { el.children = []; el.text = html },
  setValue: (el, v) => { if (String(el.value ?? '') !== String(v ?? '')) el.value = v },
  setChecked: (el, b) => { el.checked = !!b },
  setDisabled: (el, b) => { el.disabled = !!b },
  clearRef: (_r) => {},
  applyRef: (_el, _r) => {},
  setAttribute: (el, k, v) => { (el.attrs ||= {})[k] = v },
  removeAttribute: (el, k) => { if (el.attrs) delete el.attrs[k] },
  getTagName: (el) => el.tag || '',
  addEventListener: (_el, _evt, _h) => {},
  removeEventListener: (_el, _evt, _h) => {},
  hasValueProperty: (el) => ('value' in el),
  isSelectMultiple: (el) => el.tag === 'SELECT' && !!el.multiple,
  querySelector: (sel) => ({ tag: sel, children: [] }),
};
// 传入 wasm：createRue(adapter)
*/
#[cfg(feature = "dev")]
use crate::log::{log, want_log};
use crate::runtime::dom_adapter::DomAdapter;
use js_sys::{Array, Function, Object, Reflect};
use std::collections::HashMap;
use std::rc::Rc;
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use wasm_bindgen::throw_str;
use wasm_bindgen::throw_val;

#[inline(never)]
fn throw_adapter_missing(name: &str) -> ! {
    #[cfg(feature = "dev")]
    {
        throw_str(&format!("Rue runtime: dom-adapter.{name} not found"));
    }

    #[cfg(not(feature = "dev"))]
    {
        let _ = name;
        throw_str("RDA0");
    }
}

#[inline(never)]
fn throw_adapter_null_return(name: &str) -> ! {
    #[cfg(feature = "dev")]
    {
        throw_str(&format!("Rue runtime: {name} returned undefined/null"));
    }

    #[cfg(not(feature = "dev"))]
    {
        let _ = name;
        throw_str("RDA1");
    }
}

#[derive(Clone)]
struct JsDomMethods {
    create_element: Function,
    create_text_node: Function,
    create_document_fragment: Function,
    is_fragment: Function,
    collect_fragment_children: Function,
    set_text_content: Function,
    append_child: Function,
    insert_before: Function,
    remove_child: Function,
    contains: Function,
    get_parent_node: Option<Function>,
    replace_child: Option<Function>,
    set_class_name: Function,
    patch_style: Function,
    set_inner_html: Function,
    set_value: Function,
    set_checked: Function,
    set_disabled: Function,
    clear_ref: Function,
    apply_ref: Function,
    set_attribute: Function,
    remove_attribute: Function,
    get_tag_name: Function,
    add_event_listener: Function,
    remove_event_listener: Function,
    query_selector: Function,
}

impl JsDomMethods {
    fn new(inner: &JsValue) -> Self {
        Self {
            create_element: required_method(inner, "createElement"),
            create_text_node: required_method(inner, "createTextNode"),
            create_document_fragment: required_method(inner, "createDocumentFragment"),
            is_fragment: required_method(inner, "isFragment"),
            collect_fragment_children: required_method(inner, "collectFragmentChildren"),
            set_text_content: required_method(inner, "setTextContent"),
            append_child: required_method(inner, "appendChild"),
            insert_before: required_method(inner, "insertBefore"),
            remove_child: required_method(inner, "removeChild"),
            contains: required_method(inner, "contains"),
            get_parent_node: optional_method(inner, "getParentNode"),
            replace_child: optional_method(inner, "replaceChild"),
            set_class_name: required_method(inner, "setClassName"),
            patch_style: required_method(inner, "patchStyle"),
            set_inner_html: required_method(inner, "setInnerHTML"),
            set_value: required_method(inner, "setValue"),
            set_checked: required_method(inner, "setChecked"),
            set_disabled: required_method(inner, "setDisabled"),
            clear_ref: required_method(inner, "clearRef"),
            apply_ref: required_method(inner, "applyRef"),
            set_attribute: required_method(inner, "setAttribute"),
            remove_attribute: required_method(inner, "removeAttribute"),
            get_tag_name: required_method(inner, "getTagName"),
            add_event_listener: required_method(inner, "addEventListener"),
            remove_event_listener: required_method(inner, "removeEventListener"),
            query_selector: required_method(inner, "querySelector"),
        }
    }
}

fn optional_method(inner: &JsValue, name: &str) -> Option<Function> {
    Reflect::get(inner, &JsValue::from_str(name))
        .unwrap_or(JsValue::UNDEFINED)
        .dyn_ref::<Function>()
        .cloned()
}

fn required_method(inner: &JsValue, name: &str) -> Function {
    optional_method(inner, name).unwrap_or_else(|| throw_adapter_missing(name))
}

#[derive(Clone)]
pub struct JsDomAdapter {
    inner: JsValue,
    methods: Rc<JsDomMethods>,
}

impl JsDomAdapter {
    pub fn new(inner: JsValue) -> Self {
        {
            let mut missing: Vec<&str> = Vec::new();
            let req = [
                "createElement",
                "createTextNode",
                "createDocumentFragment",
                "isFragment",
                "collectFragmentChildren",
                "setTextContent",
                "appendChild",
                "insertBefore",
                "removeChild",
                "contains",
                "setClassName",
                "patchStyle",
                "setInnerHTML",
                "setValue",
                "setChecked",
                "setDisabled",
                "clearRef",
                "applyRef",
                "setAttribute",
                "removeAttribute",
                "getTagName",
                "addEventListener",
                "removeEventListener",
                "hasValueProperty",
                "isSelectMultiple",
                "querySelector",
            ];
            // 审计：确保每个必需方法已在 JS 适配器对象上定义
            for key in req.iter() {
                let f = Reflect::get(&inner, &JsValue::from_str(key)).unwrap_or(JsValue::UNDEFINED);
                if !f.is_function() {
                    missing.push(*key);
                }
            }
            if !missing.is_empty() {
                #[cfg(not(feature = "dev"))]
                throw_str("RDA2");

                #[cfg(feature = "dev")]
                throw_str(&format!(
                    "Rue runtime: dom-adapter missing methods: {}",
                    missing.join(",")
                ));
            } else {
                #[cfg(feature = "dev")]
                {
                    if want_log("debug", "runtime:dom-adapter audit ok") {
                        log("debug", "dom-adapter audit ok");
                    }
                }
            }
        }
        let methods = Rc::new(JsDomMethods::new(&inner));
        JsDomAdapter { inner, methods }
    }
}

impl From<JsDomAdapter> for JsValue {
    fn from(adapter: JsDomAdapter) -> Self {
        adapter.inner
    }
}

impl DomAdapter for JsDomAdapter {
    type Element = JsValue;

    fn create_element(&mut self, tag: &str) -> Self::Element {
        self.create_element_in_parent(tag, None)
    }

    fn create_element_in_parent(
        &mut self,
        tag: &str,
        parent: Option<&Self::Element>,
    ) -> Self::Element {
        // 通过 JS 适配器对象的 createElement 构造元素；返回值需非空
        let parent_value = parent.cloned().unwrap_or(JsValue::UNDEFINED);
        let ret = call2_or_throw(
            &self.methods.create_element,
            &self.inner,
            &JsValue::from_str(tag),
            &parent_value,
        );
        if ret.is_undefined() || ret.is_null() {
            throw_adapter_null_return("createElement");
        }
        ret
    }
    fn create_text_node(&mut self, text: &str) -> Self::Element {
        // 文本节点创建
        let ret =
            call1_or_throw(&self.methods.create_text_node, &self.inner, &JsValue::from_str(text));
        if ret.is_undefined() || ret.is_null() {
            throw_adapter_null_return("createTextNode");
        }
        ret
    }
    fn create_document_fragment(&mut self) -> Self::Element {
        // 片段创建（常用于批量插入）
        let ret = call0_or_throw(&self.methods.create_document_fragment, &self.inner);
        if ret.is_undefined() || ret.is_null() {
            throw_adapter_null_return("createDocumentFragment");
        }
        ret
    }

    fn is_fragment(&self, el: &Self::Element) -> bool {
        // 判断元素是否为片段
        call1_or_throw(&self.methods.is_fragment, &self.inner, el).as_bool().unwrap_or(false)
    }
    fn collect_fragment_children(&self, el: &Self::Element) -> Vec<Self::Element> {
        // 收集片段内部子节点为 Vec<JsValue>
        let arr = call1_or_throw(&self.methods.collect_fragment_children, &self.inner, el);
        let arr: Array = arr.unchecked_into();
        let mut out = Vec::new();
        for i in 0..arr.length() {
            out.push(arr.get(i));
        }
        out
    }

    fn set_text_content(&mut self, el: &mut Self::Element, text: &str) {
        // 设置文本内容
        let _ = call2_or_throw(
            &self.methods.set_text_content,
            &self.inner,
            el,
            &JsValue::from_str(text),
        );
    }
    fn append_child(&mut self, parent: &mut Self::Element, child: &Self::Element) {
        if parent.is_undefined() || parent.is_null() || child.is_undefined() || child.is_null() {
            return;
        }
        // 追加子节点
        let _ = call2_or_throw(&self.methods.append_child, &self.inner, parent, child);
    }
    fn insert_before(
        &mut self,
        parent: &mut Self::Element,
        child: &Self::Element,
        before: &Self::Element,
    ) {
        if parent.is_undefined() || parent.is_null() || child.is_undefined() || child.is_null() {
            return;
        }
        let _ = call3_or_throw(&self.methods.insert_before, &self.inner, parent, child, before);
    }
    fn remove_child(&mut self, parent: &mut Self::Element, child: &Self::Element) {
        if parent.is_undefined() || parent.is_null() || child.is_undefined() || child.is_null() {
            return;
        }
        let _ = call2_or_throw(&self.methods.remove_child, &self.inner, parent, child);
    }
    fn contains(&self, parent: &Self::Element, child: &Self::Element) -> bool {
        call2_or_throw(&self.methods.contains, &self.inner, parent, child)
            .as_bool()
            .unwrap_or(false)
    }
    // 读取父节点：优先使用适配器方法，缺省读取 parentNode
    // - 返回 Some(el) 表示存在父节点；
    // - 返回 None 表示不存在或为根；
    // - 兼容宿主未实现 getParentNode 的情况。
    fn get_parent_node(&self, node: &Self::Element) -> Option<Self::Element> {
        if let Some(func) = &self.methods.get_parent_node {
            let ret = call1_or_throw(func, &self.inner, node);
            if ret.is_undefined() || ret.is_null() { None } else { Some(ret) }
        } else {
            let ret =
                Reflect::get(node, &JsValue::from_str("parentNode")).unwrap_or(JsValue::UNDEFINED);
            if ret.is_undefined() || ret.is_null() { None } else { Some(ret) }
        }
    }

    fn set_class_name(&mut self, el: &mut Self::Element, value: &str) {
        let _ = call2_or_throw(
            &self.methods.set_class_name,
            &self.inner,
            el,
            &JsValue::from_str(value),
        );
    }
    fn patch_style(
        &mut self,
        el: &mut Self::Element,
        old_style: &HashMap<String, String>,
        new_style: &HashMap<String, String>,
    ) {
        let js_old = map_to_js_obj(old_style);
        let js_new = map_to_js_obj(new_style);
        let _ = call3_or_throw(&self.methods.patch_style, &self.inner, el, &js_old, &js_new);
    }
    fn set_inner_html(&mut self, el: &mut Self::Element, html: &str) {
        if el.is_undefined() || el.is_null() {
            return;
        }
        let _ =
            call2_or_throw(&self.methods.set_inner_html, &self.inner, el, &JsValue::from_str(html));
    }

    fn set_value(&mut self, el: &mut Self::Element, value: JsValue) {
        if should_skip_same_value_write(self, el, &value) {
            return;
        }
        let _ = call2_or_throw(&self.methods.set_value, &self.inner, el, &value);
    }
    fn set_checked(&mut self, el: &mut Self::Element, checked: bool) {
        let _ = call2_or_throw(
            &self.methods.set_checked,
            &self.inner,
            el,
            &JsValue::from_bool(checked),
        );
    }
    fn set_disabled(&mut self, el: &mut Self::Element, disabled: bool) {
        let _ = call2_or_throw(
            &self.methods.set_disabled,
            &self.inner,
            el,
            &JsValue::from_bool(disabled),
        );
    }

    fn clear_ref(&mut self, ref_handle: JsValue) {
        let _ = call1_or_throw(&self.methods.clear_ref, &self.inner, &ref_handle);
    }
    fn apply_ref(&mut self, el: &mut Self::Element, ref_handle: JsValue) {
        let _ = call2_or_throw(&self.methods.apply_ref, &self.inner, el, &ref_handle);
    }

    fn set_attribute(&mut self, el: &mut Self::Element, key: &str, value: &str) {
        let _ = call3_or_throw(
            &self.methods.set_attribute,
            &self.inner,
            el,
            &JsValue::from_str(key),
            &JsValue::from_str(value),
        );
    }
    fn remove_attribute(&mut self, el: &mut Self::Element, key: &str) {
        // 移除属性
        let _ = call2_or_throw(
            &self.methods.remove_attribute,
            &self.inner,
            el,
            &JsValue::from_str(key),
        );
    }
    fn get_tag_name(&self, el: &Self::Element) -> String {
        // 读取标签名
        call1_or_throw(&self.methods.get_tag_name, &self.inner, el).as_string().unwrap_or_default()
    }
    // 替换子节点：优先使用宿主 replaceChild
    // - 若 replaceChild 缺失，则退化为 insert_before + remove_child；
    // - 保持调用幂等与容错，便于统一替换路径。
    fn replace_child(
        &mut self,
        parent: &mut Self::Element,
        new_child: &Self::Element,
        old_child: &Self::Element,
    ) {
        if let Some(func) = &self.methods.replace_child {
            let _ = call3_or_throw(func, &self.inner, parent, new_child, old_child);
        } else {
            self.insert_before(parent, new_child, old_child);
            self.remove_child(parent, old_child);
        }
    }

    fn add_event_listener(&mut self, el: &mut Self::Element, event: &str, handler: JsValue) {
        // 绑定事件监听
        let _ = call3_or_throw(
            &self.methods.add_event_listener,
            &self.inner,
            el,
            &JsValue::from_str(event),
            &handler,
        );
    }
    fn remove_event_listener(&mut self, el: &mut Self::Element, event: &str, handler: JsValue) {
        // 移除事件监听
        let _ = call3_or_throw(
            &self.methods.remove_event_listener,
            &self.inner,
            el,
            &JsValue::from_str(event),
            &handler,
        );
    }

    fn has_value_property(&self, el: &Self::Element) -> bool {
        !Reflect::get(el, &JsValue::from_str("value")).unwrap_or(JsValue::UNDEFINED).is_undefined()
    }
    fn is_select_multiple(&self, el: &Self::Element) -> bool {
        let tag = self.get_tag_name(el);
        if tag.to_uppercase() != "SELECT" {
            return false;
        }
        Reflect::get(el, &JsValue::from_str("multiple"))
            .unwrap_or(JsValue::FALSE)
            .as_bool()
            .unwrap_or(false)
    }

    fn query_selector(&self, selector: &str) -> Option<Self::Element> {
        // 选择器：返回匹配到的元素（或 None）
        let ret =
            call1_or_throw(&self.methods.query_selector, &self.inner, &JsValue::from_str(selector));
        if ret.is_undefined() || ret.is_null() { None } else { Some(ret) }
    }
}

fn map_to_js_obj(map: &HashMap<String, String>) -> JsValue {
    // 辅助：Rust HashMap<String,String> → JS 对象
    let obj = Object::new();
    for (k, v) in map.iter() {
        let _ = Reflect::set(&obj, &JsValue::from_str(k), &JsValue::from_str(v));
    }
    obj.into()
}

fn dom_value_string(value: &JsValue) -> Option<String> {
    if value.is_object() {
        return None;
    }
    if let Some(text) = value.as_string() {
        return Some(text);
    }
    if let Some(number) = value.as_f64() {
        return Some(number.to_string());
    }
    if let Some(boolean) = value.as_bool() {
        return Some(if boolean { "true" } else { "false" }.to_string());
    }
    if value.is_null() || value.is_undefined() {
        return Some(String::new());
    }
    None
}

fn should_skip_same_value_write(
    adapter: &JsDomAdapter,
    el: &<JsDomAdapter as DomAdapter>::Element,
    next: &JsValue,
) -> bool {
    let tag = adapter.get_tag_name(el).to_uppercase();
    if tag != "INPUT" && tag != "TEXTAREA" {
        return false;
    }
    let current = Reflect::get(el, &JsValue::from_str("value")).unwrap_or(JsValue::UNDEFINED);
    match (dom_value_string(&current), dom_value_string(next)) {
        (Some(current), Some(next)) => current == next,
        _ => false,
    }
}

fn call0_or_throw(func: &Function, this: &JsValue) -> JsValue {
    match func.call0(this) {
        Ok(value) => value,
        Err(error) => throw_val(error),
    }
}

fn call1_or_throw(func: &Function, this: &JsValue, arg1: &JsValue) -> JsValue {
    match func.call1(this, arg1) {
        Ok(value) => value,
        Err(error) => throw_val(error),
    }
}

fn call2_or_throw(func: &Function, this: &JsValue, arg1: &JsValue, arg2: &JsValue) -> JsValue {
    match func.call2(this, arg1, arg2) {
        Ok(value) => value,
        Err(error) => throw_val(error),
    }
}

fn call3_or_throw(
    func: &Function,
    this: &JsValue,
    arg1: &JsValue,
    arg2: &JsValue,
    arg3: &JsValue,
) -> JsValue {
    match func.call3(this, arg1, arg2, arg3) {
        Ok(value) => value,
        Err(error) => throw_val(error),
    }
}
