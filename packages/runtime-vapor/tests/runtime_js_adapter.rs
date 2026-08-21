use js_sys::{Array, Function, Object, Reflect};
use rue_runtime_vapor::{DomAdapter, JsDomAdapter};
use wasm_bindgen::JsValue;
use wasm_bindgen_test::*;

fn adapter_obj_with(methods: &[&str]) -> JsValue {
    let obj = Object::new();
    for key in methods {
        let f = Function::new_no_args("return undefined");
        let _ = Reflect::set(&obj, &JsValue::from_str(key), &f.into());
    }
    obj.into()
}

#[wasm_bindgen_test]
#[should_panic]
fn js_adapter_audit_missing_methods_panics() {
    let missing = adapter_obj_with(&["createElement"]);
    let _ = JsDomAdapter::new(missing);
}

fn make_working_adapter() -> JsDomAdapter {
    let obj = Object::new();
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("createElement"),
        &Function::new_with_args("tag", "return { tag }").into(),
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
        &Function::new_with_args("el,old,newv", "return").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setInnerHTML"),
        &Function::new_with_args("el,html", "el.children = []; el.text = html").into(),
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
        &Function::new_with_args("sel", "return { tag: sel }").into(),
    );
    JsDomAdapter::new(obj.into())
}

fn rebuild_adapter_with_method(adapter: &JsDomAdapter, key: &str, value: JsValue) -> JsDomAdapter {
    let inner: JsValue = adapter.clone().into();
    Reflect::set(&inner, &JsValue::from_str(key), &value).unwrap();
    JsDomAdapter::new(inner)
}

fn rebuild_adapter_without_method(adapter: &JsDomAdapter, key: &str) -> JsDomAdapter {
    rebuild_adapter_with_method(adapter, key, JsValue::UNDEFINED)
}

fn adapter_object(tag: &str) -> JsValue {
    let obj = Object::new();
    Reflect::set(&obj, &JsValue::from_str("tag"), &JsValue::from_str(tag)).unwrap();
    Reflect::set(&obj, &JsValue::from_str("children"), &Array::new().into()).unwrap();
    obj.into()
}

fn call_adapter_method(adapter: &mut JsDomAdapter, method: &str) {
    let mut parent = adapter_object("parent");
    let child = adapter_object("child");
    let before = adapter_object("before");
    match method {
        "createElement" => {
            let _ = adapter.create_element("div");
        }
        "createTextNode" => {
            let _ = adapter.create_text_node("text");
        }
        "createDocumentFragment" => {
            let _ = adapter.create_document_fragment();
        }
        "isFragment" => {
            let _ = adapter.is_fragment(&child);
        }
        "collectFragmentChildren" => {
            let _ = adapter.collect_fragment_children(&child);
        }
        "setTextContent" => {
            let mut el = child;
            adapter.set_text_content(&mut el, "text");
        }
        "appendChild" => adapter.append_child(&mut parent, &child),
        "insertBefore" => adapter.insert_before(&mut parent, &child, &before),
        "removeChild" => adapter.remove_child(&mut parent, &child),
        "contains" => {
            let _ = adapter.contains(&parent, &child);
        }
        "setClassName" => adapter.set_class_name(&mut parent, "cls"),
        "patchStyle" => {
            let old = std::collections::HashMap::<String, String>::new();
            let new = std::collections::HashMap::<String, String>::new();
            adapter.patch_style(&mut parent, &old, &new);
        }
        "setInnerHTML" => adapter.set_inner_html(&mut parent, "<b>x</b>"),
        "setValue" => adapter.set_value(&mut parent, JsValue::from_str("value")),
        "setChecked" => adapter.set_checked(&mut parent, true),
        "setDisabled" => adapter.set_disabled(&mut parent, true),
        "clearRef" => adapter.clear_ref(JsValue::from_str("ref")),
        "applyRef" => adapter.apply_ref(&mut parent, JsValue::from_str("ref")),
        "setAttribute" => adapter.set_attribute(&mut parent, "data-x", "1"),
        "removeAttribute" => adapter.remove_attribute(&mut parent, "data-x"),
        "getTagName" => {
            let _ = adapter.get_tag_name(&parent);
        }
        "addEventListener" => adapter.add_event_listener(&mut parent, "click", JsValue::NULL),
        "removeEventListener" => adapter.remove_event_listener(&mut parent, "click", JsValue::NULL),
        "querySelector" => {
            let _ = adapter.query_selector("#x");
        }
        _ => panic!("unknown adapter method"),
    }
}

macro_rules! missing_method_panics {
    ($name:ident, $method:literal) => {
        #[wasm_bindgen_test]
        #[should_panic]
        fn $name() {
            let adapter = make_working_adapter();
            let mut adapter = rebuild_adapter_without_method(&adapter, $method);
            call_adapter_method(&mut adapter, $method);
        }
    };
}

macro_rules! nullish_return_panics {
    ($name:ident, $method:literal, $args:literal, $body:literal) => {
        #[wasm_bindgen_test]
        #[should_panic]
        fn $name() {
            let adapter = make_working_adapter();
            let mut adapter = rebuild_adapter_with_method(
                &adapter,
                $method,
                Function::new_with_args($args, $body).into(),
            );
            call_adapter_method(&mut adapter, $method);
        }
    };
}

#[wasm_bindgen_test]
fn js_adapter_audit_ok_and_basic_calls() {
    let mut a = make_working_adapter();
    let el = a.create_element("SELECT");
    let t = a.get_tag_name(&el);
    assert_eq!(t, "SELECT");
    let hasv = a.has_value_property(&el);
    assert_eq!(hasv, false);
    let obj = js_sys::Object::new();
    let _ = js_sys::Reflect::set(&obj, &JsValue::from_str("value"), &JsValue::from_str("x"));
    let el2 = obj.into();
    let hasv2 = a.has_value_property(&el2);
    assert_eq!(hasv2, true);
    let m = a.is_select_multiple(&el);
    assert_eq!(m, false);
}

fn setup_global_log() {
    let _ = Reflect::set(&js_sys::global(), &JsValue::from_str("_log"), &Array::new());
}

fn get_log() -> Array {
    Array::from(&Reflect::get(&js_sys::global(), &JsValue::from_str("_log")).unwrap())
}

#[wasm_bindgen_test]
fn js_adapter_events_attributes_and_patch_style_logging() {
    setup_global_log();
    let obj = Object::new();
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("createElement"),
        &Function::new_with_args("tag", "return { tag, children: [] }").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("getTagName"),
        &Function::new_with_args("el", "return el.tag||''").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("addEventListener"),
        &Function::new_with_args("el,evt,h", "globalThis._log.push('add:'+evt)").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("removeEventListener"),
        &Function::new_with_args("el,evt,h", "globalThis._log.push('rm:'+evt)").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setAttribute"),
        &Function::new_with_args("el,k,v", "globalThis._log.push('set:'+k+'='+v)").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("removeAttribute"),
        &Function::new_with_args("el,k", "globalThis._log.push('rmattr:'+k)").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("patchStyle"),
        &Function::new_with_args(
            "el,old,newv",
            "Object.keys(newv).forEach(k=>globalThis._log.push('style:'+k+'='+newv[k]))",
        )
        .into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setTextContent"),
        &Function::new_with_args("el,text", "el.text=text").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("appendChild"),
        &Function::new_with_args("p,c", "p.children.push(c)").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("insertBefore"),
        &Function::new_with_args("p,c,b", "p.children.push(c)").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("removeChild"),
        &Function::new_with_args("p,c", "p.children=p.children.filter(x=>x!==c)").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("contains"),
        &Function::new_with_args("p,c", "return p===c || (p.children||[]).includes(c)").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setClassName"),
        &Function::new_with_args("el,v", "el.class=v").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setInnerHTML"),
        &Function::new_with_args("el,html", "el.children=[]; el.text=html").into(),
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
        &JsValue::from_str("setValue"),
        &Function::new_with_args("el,v", "el.value=v").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setChecked"),
        &Function::new_with_args("el,b", "el.checked=!!b").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setDisabled"),
        &Function::new_with_args("el,b", "el.disabled=!!b").into(),
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
        &Function::new_with_args("sel", "return { tag: sel }").into(),
    );
    let mut a = JsDomAdapter::new(obj.into());
    let mut el = a.create_element("div");
    a.add_event_listener(&mut el, "click", JsValue::from_str("h"));
    a.remove_event_listener(&mut el, "click", JsValue::from_str("h"));
    a.set_attribute(&mut el, "data-x", "1");
    a.remove_attribute(&mut el, "data-x");
    let old = std::collections::HashMap::<String, String>::new();
    let mut newm = std::collections::HashMap::<String, String>::new();
    newm.insert("color".into(), "blue".into());
    newm.insert("width".into(), "10".into());
    a.patch_style(&mut el, &old, &newm);
    let log = get_log();
    assert!(log.iter().any(|v| v.as_string().unwrap() == "add:click"));
    assert!(log.iter().any(|v| v.as_string().unwrap() == "rm:click"));
    assert!(log.iter().any(|v| v.as_string().unwrap() == "set:data-x=1"));
    assert!(log.iter().any(|v| v.as_string().unwrap() == "rmattr:data-x"));
    assert!(log.iter().any(|v| v.as_string().unwrap() == "style:color=blue"));
    assert!(log.iter().any(|v| v.as_string().unwrap() == "style:width=10"));
}

#[wasm_bindgen_test]
fn js_adapter_query_selector_none_and_some() {
    setup_global_log();
    // 构造完整适配器（方法齐全），再覆盖 querySelector 返回 undefined
    let base1 = Object::new();
    for (k, fsrc) in [
        ("createElement", "return { tag: 'div', children: [] }"),
        ("createTextNode", "return { tag: '#text', text: '' }"),
        ("createDocumentFragment", "return { tag: 'fragment', children: [] }"),
        ("isFragment", "return !!el && el.tag === 'fragment'"),
        ("collectFragmentChildren", "return Array.from(el && el.children || [])"),
        ("setTextContent", "el.text=text"),
        ("appendChild", "p.children=p.children||[]; p.children.push(c)"),
        ("insertBefore", "p.children=p.children||[]; p.children.push(c)"),
        ("removeChild", "p.children=(p.children||[]).filter(x=>x!==c)"),
        ("contains", "return p===c || (p.children||[]).includes(c)"),
        ("setClassName", "el.class=v"),
        ("patchStyle", "Object.keys(newv).forEach(k=>{el.style=el.style||{};el.style[k]=newv[k]})"),
        ("setInnerHTML", "el.children=[]; el.text=html"),
        ("setValue", "el.value=v"),
        ("setChecked", "el.checked=!!b"),
        ("setDisabled", "el.disabled=!!b"),
        ("clearRef", "return"),
        ("applyRef", "return"),
        ("setAttribute", "el.attrs=el.attrs||{}; el.attrs[k]=v"),
        ("removeAttribute", "if(el.attrs) delete el.attrs[k]"),
        ("getTagName", "return el.tag||''"),
        ("addEventListener", "return"),
        ("removeEventListener", "return"),
        ("hasValueProperty", "return 'value' in el"),
        ("isSelectMultiple", "return el.tag==='SELECT' && !!el.multiple"),
        ("querySelector", "return undefined"),
    ] {
        let _ = Reflect::set(
            &base1,
            &JsValue::from_str(k),
            &Function::new_with_args("el,p,c,b,k,v,old,newv,sel", fsrc).into(),
        );
    }
    let _ = Reflect::set(
        &base1,
        &JsValue::from_str("querySelector"),
        &Function::new_with_args("sel", "return undefined").into(),
    );
    let a1 = JsDomAdapter::new(base1.into());
    assert!(a1.query_selector("#none").is_none());
    // 构造完整适配器（方法齐全），再覆盖 querySelector 返回元素并记录日志
    let base2 = Object::new();
    for (k, fsrc) in [
        ("createElement", "return { tag: 'div', children: [] }"),
        ("createTextNode", "return { tag: '#text', text: '' }"),
        ("createDocumentFragment", "return { tag: 'fragment', children: [] }"),
        ("isFragment", "return !!el && el.tag === 'fragment'"),
        ("collectFragmentChildren", "return Array.from(el && el.children || [])"),
        ("setTextContent", "el.text=text"),
        ("appendChild", "p.children=p.children||[]; p.children.push(c)"),
        ("insertBefore", "p.children=p.children||[]; p.children.push(c)"),
        ("removeChild", "p.children=(p.children||[]).filter(x=>x!==c)"),
        ("contains", "return p===c || (p.children||[]).includes(c)"),
        ("setClassName", "el.class=v"),
        ("patchStyle", "Object.keys(newv).forEach(k=>{el.style=el.style||{};el.style[k]=newv[k]})"),
        ("setInnerHTML", "el.children=[]; el.text=html"),
        ("setValue", "el.value=v"),
        ("setChecked", "el.checked=!!b"),
        ("setDisabled", "el.disabled=!!b"),
        ("clearRef", "return"),
        ("applyRef", "return"),
        ("setAttribute", "el.attrs=el.attrs||{}; el.attrs[k]=v"),
        ("removeAttribute", "if(el.attrs) delete el.attrs[k]"),
        ("getTagName", "return el.tag||''"),
        ("addEventListener", "return"),
        ("removeEventListener", "return"),
        ("hasValueProperty", "return 'value' in el"),
        ("isSelectMultiple", "return el.tag==='SELECT' && !!el.multiple"),
        ("querySelector", "globalThis._log.push('qs:'+sel); return { tag: sel }"),
    ] {
        let _ = Reflect::set(
            &base2,
            &JsValue::from_str(k),
            &Function::new_with_args("el,p,c,b,k,v,old,newv,sel", fsrc).into(),
        );
    }
    let _ = Reflect::set(
        &base2,
        &JsValue::from_str("querySelector"),
        &Function::new_with_args("sel", "globalThis._log.push('qs:'+sel); return { tag: sel }")
            .into(),
    );
    let a2 = JsDomAdapter::new(base2.into());
    let r = a2.query_selector("#x");
    assert!(r.is_some());
    let log = get_log();
    assert!(log.iter().any(|v| v.as_string().unwrap() == "qs:#x"));
}

#[wasm_bindgen_test]
#[should_panic]
fn js_adapter_create_element_returning_undefined_panics() {
    let obj = Object::new();
    for (k, fsrc) in [
        ("createElement", "return undefined"),
        ("createTextNode", "return { tag: '#text', text: '' }"),
        ("createDocumentFragment", "return { tag: 'fragment', children: [] }"),
        ("isFragment", "return !!el && el.tag === 'fragment'"),
        ("collectFragmentChildren", "return Array.from(el && el.children || [])"),
        ("setTextContent", "el.text=text"),
        ("appendChild", "p.children=p.children||[]; p.children.push(c)"),
        ("insertBefore", "p.children=p.children||[]; p.children.push(c)"),
        ("removeChild", "p.children=(p.children||[]).filter(x=>x!==c)"),
        ("contains", "return p===c || (p.children||[]).includes(c)"),
        ("setClassName", "el.class=v"),
        ("patchStyle", "return"),
        ("setInnerHTML", "el.children=[]; el.text=html"),
        ("setValue", "el.value=v"),
        ("setChecked", "el.checked=!!b"),
        ("setDisabled", "el.disabled=!!b"),
        ("clearRef", "return"),
        ("applyRef", "return"),
        ("setAttribute", "el.attrs=el.attrs||{}; el.attrs[k]=v"),
        ("removeAttribute", "if(el.attrs) delete el.attrs[k]"),
        ("getTagName", "return el.tag||''"),
        ("addEventListener", "return"),
        ("removeEventListener", "return"),
        ("hasValueProperty", "return 'value' in el"),
        ("isSelectMultiple", "return el.tag==='SELECT' && !!el.multiple"),
        ("querySelector", "return undefined"),
    ] {
        let args = match k {
            "createElement" => "tag",
            "createTextNode" => "text",
            "createDocumentFragment" => "",
            "isFragment"
            | "collectFragmentChildren"
            | "getTagName"
            | "hasValueProperty"
            | "isSelectMultiple" => "el",
            "setTextContent" => "el,text",
            "appendChild" | "removeChild" => "p,c",
            "insertBefore" => "p,c,b",
            "contains" => "p,c",
            "setClassName" => "el,v",
            "patchStyle" => "el,old,newv",
            "setInnerHTML" => "el,html",
            "setValue" => "el,v",
            "setChecked" | "setDisabled" => "el,b",
            "clearRef" => "r",
            "applyRef" => "el,r",
            "setAttribute" => "el,k,v",
            "removeAttribute" => "el,k",
            "addEventListener" | "removeEventListener" => "el,evt,h",
            "querySelector" => "sel",
            _ => "",
        };
        let _ =
            Reflect::set(&obj, &JsValue::from_str(k), &Function::new_with_args(args, fsrc).into());
    }
    let mut a = JsDomAdapter::new(obj.into());
    let _ = a.create_element("div");
}

#[wasm_bindgen_test]
fn js_adapter_get_parent_node_uses_method_or_fallback_property() {
    let obj1 = Object::new();
    for (k, fsrc) in [
        ("createElement", "return { tag, children: [] }"),
        ("createTextNode", "return { tag: '#text', text }"),
        ("createDocumentFragment", "return { tag: 'fragment', children: [] }"),
        ("isFragment", "return !!el && el.tag === 'fragment'"),
        ("collectFragmentChildren", "return Array.from(el && el.children || [])"),
        ("setTextContent", "el.text=text"),
        ("appendChild", "p.children=p.children||[]; p.children.push(c)"),
        ("insertBefore", "p.children=p.children||[]; p.children.push(c)"),
        ("removeChild", "p.children=(p.children||[]).filter(x=>x!==c)"),
        ("contains", "return p===c || (p.children||[]).includes(c)"),
        ("setClassName", "el.class=v"),
        ("patchStyle", "return"),
        ("setInnerHTML", "el.children=[]; el.text=html"),
        ("setValue", "el.value=v"),
        ("setChecked", "el.checked=!!b"),
        ("setDisabled", "el.disabled=!!b"),
        ("clearRef", "return"),
        ("applyRef", "return"),
        ("setAttribute", "el.attrs=el.attrs||{}; el.attrs[k]=v"),
        ("removeAttribute", "if(el.attrs) delete el.attrs[k]"),
        ("getTagName", "return el.tag||''"),
        ("addEventListener", "return"),
        ("removeEventListener", "return"),
        ("hasValueProperty", "return 'value' in el"),
        ("isSelectMultiple", "return el.tag==='SELECT' && !!el.multiple"),
        ("querySelector", "return undefined"),
        ("getParentNode", "return el._p || null"),
    ] {
        let args = match k {
            "createElement" => "tag",
            "createTextNode" => "text",
            "createDocumentFragment" => "",
            "isFragment"
            | "collectFragmentChildren"
            | "getTagName"
            | "hasValueProperty"
            | "isSelectMultiple"
            | "getParentNode" => "el",
            "setTextContent" => "el,text",
            "appendChild" | "removeChild" => "p,c",
            "insertBefore" => "p,c,b",
            "contains" => "p,c",
            "setClassName" => "el,v",
            "patchStyle" => "el,old,newv",
            "setInnerHTML" => "el,html",
            "setValue" => "el,v",
            "setChecked" | "setDisabled" => "el,b",
            "clearRef" => "r",
            "applyRef" => "el,r",
            "setAttribute" => "el,k,v",
            "removeAttribute" => "el,k",
            "addEventListener" | "removeEventListener" => "el,evt,h",
            "querySelector" => "sel",
            _ => "",
        };
        let _ =
            Reflect::set(&obj1, &JsValue::from_str(k), &Function::new_with_args(args, fsrc).into());
    }
    let mut a1 = JsDomAdapter::new(obj1.into());
    let parent: JsValue = Object::new().into();
    let child = a1.create_element("div");
    let _ = Reflect::set(&child, &JsValue::from_str("_p"), &parent);
    let got = a1.get_parent_node(&child);
    assert!(got.is_some());

    let obj2 = Object::new();
    for (k, fsrc) in [
        ("createElement", "return { tag, children: [] }"),
        ("createTextNode", "return { tag: '#text', text }"),
        ("createDocumentFragment", "return { tag: 'fragment', children: [] }"),
        ("isFragment", "return !!el && el.tag === 'fragment'"),
        ("collectFragmentChildren", "return Array.from(el && el.children || [])"),
        ("setTextContent", "el.text=text"),
        ("appendChild", "p.children=p.children||[]; p.children.push(c)"),
        ("insertBefore", "p.children=p.children||[]; p.children.push(c)"),
        ("removeChild", "p.children=(p.children||[]).filter(x=>x!==c)"),
        ("contains", "return p===c || (p.children||[]).includes(c)"),
        ("setClassName", "el.class=v"),
        ("patchStyle", "return"),
        ("setInnerHTML", "el.children=[]; el.text=html"),
        ("setValue", "el.value=v"),
        ("setChecked", "el.checked=!!b"),
        ("setDisabled", "el.disabled=!!b"),
        ("clearRef", "return"),
        ("applyRef", "return"),
        ("setAttribute", "el.attrs=el.attrs||{}; el.attrs[k]=v"),
        ("removeAttribute", "if(el.attrs) delete el.attrs[k]"),
        ("getTagName", "return el.tag||''"),
        ("addEventListener", "return"),
        ("removeEventListener", "return"),
        ("hasValueProperty", "return 'value' in el"),
        ("isSelectMultiple", "return el.tag==='SELECT' && !!el.multiple"),
        ("querySelector", "return undefined"),
    ] {
        let args = match k {
            "createElement" => "tag",
            "createTextNode" => "text",
            "createDocumentFragment" => "",
            "isFragment"
            | "collectFragmentChildren"
            | "getTagName"
            | "hasValueProperty"
            | "isSelectMultiple" => "el",
            "setTextContent" => "el,text",
            "appendChild" | "removeChild" => "p,c",
            "insertBefore" => "p,c,b",
            "contains" => "p,c",
            "setClassName" => "el,v",
            "patchStyle" => "el,old,newv",
            "setInnerHTML" => "el,html",
            "setValue" => "el,v",
            "setChecked" | "setDisabled" => "el,b",
            "clearRef" => "r",
            "applyRef" => "el,r",
            "setAttribute" => "el,k,v",
            "removeAttribute" => "el,k",
            "addEventListener" | "removeEventListener" => "el,evt,h",
            "querySelector" => "sel",
            _ => "",
        };
        let _ =
            Reflect::set(&obj2, &JsValue::from_str(k), &Function::new_with_args(args, fsrc).into());
    }
    let mut a2 = JsDomAdapter::new(obj2.into());
    let p2: JsValue = Object::new().into();
    let c2 = a2.create_element("div");
    let _ = Reflect::set(&c2, &JsValue::from_str("parentNode"), &p2);
    let got2 = a2.get_parent_node(&c2);
    assert!(got2.is_some());
}

#[wasm_bindgen_test]
fn js_adapter_replace_child_fallback_calls_insert_before_and_remove_child() {
    let _ = Reflect::set(&js_sys::global(), &JsValue::from_str("_repLog"), &Array::new());
    let obj = Object::new();
    for (k, fsrc) in [
        ("createElement", "return { tag, children: [] }"),
        ("createTextNode", "return { tag: '#text', text }"),
        ("createDocumentFragment", "return { tag: 'fragment', children: [] }"),
        ("isFragment", "return !!el && el.tag === 'fragment'"),
        ("collectFragmentChildren", "return Array.from(el && el.children || [])"),
        ("setTextContent", "el.text=text"),
        ("appendChild", "p.children=p.children||[]; p.children.push(c)"),
        (
            "insertBefore",
            "globalThis._repLog.push('insert'); p.children=p.children||[]; p.children.push(c)",
        ),
        (
            "removeChild",
            "globalThis._repLog.push('remove'); p.children=(p.children||[]).filter(x=>x!==c)",
        ),
        ("contains", "return p===c || (p.children||[]).includes(c)"),
        ("setClassName", "el.class=v"),
        ("patchStyle", "return"),
        ("setInnerHTML", "el.children=[]; el.text=html"),
        ("setValue", "el.value=v"),
        ("setChecked", "el.checked=!!b"),
        ("setDisabled", "el.disabled=!!b"),
        ("clearRef", "return"),
        ("applyRef", "return"),
        ("setAttribute", "el.attrs=el.attrs||{}; el.attrs[k]=v"),
        ("removeAttribute", "if(el.attrs) delete el.attrs[k]"),
        ("getTagName", "return el.tag||''"),
        ("addEventListener", "return"),
        ("removeEventListener", "return"),
        ("hasValueProperty", "return 'value' in el"),
        ("isSelectMultiple", "return el.tag==='SELECT' && !!el.multiple"),
        ("querySelector", "return undefined"),
    ] {
        let args = match k {
            "createElement" => "tag",
            "createTextNode" => "text",
            "createDocumentFragment" => "",
            "isFragment"
            | "collectFragmentChildren"
            | "getTagName"
            | "hasValueProperty"
            | "isSelectMultiple" => "el",
            "setTextContent" => "el,text",
            "appendChild" | "removeChild" => "p,c",
            "insertBefore" => "p,c,b",
            "contains" => "p,c",
            "setClassName" => "el,v",
            "patchStyle" => "el,old,newv",
            "setInnerHTML" => "el,html",
            "setValue" => "el,v",
            "setChecked" | "setDisabled" => "el,b",
            "clearRef" => "r",
            "applyRef" => "el,r",
            "setAttribute" => "el,k,v",
            "removeAttribute" => "el,k",
            "addEventListener" | "removeEventListener" => "el,evt,h",
            "querySelector" => "sel",
            _ => "",
        };
        let _ =
            Reflect::set(&obj, &JsValue::from_str(k), &Function::new_with_args(args, fsrc).into());
    }
    let mut a = JsDomAdapter::new(obj.into());
    let mut parent = a.create_element("div");
    let oldc = a.create_element("span");
    let newc = a.create_element("b");
    a.append_child(&mut parent, &oldc);
    a.replace_child(&mut parent, &newc, &oldc);
    let log: Array =
        Array::from(&Reflect::get(&js_sys::global(), &JsValue::from_str("_repLog")).unwrap());
    assert!(log.iter().any(|v| v.as_string().unwrap() == "insert"));
    assert!(log.iter().any(|v| v.as_string().unwrap() == "remove"));
}

missing_method_panics!(js_adapter_missing_create_element_panics_after_audit, "createElement");
missing_method_panics!(js_adapter_missing_create_text_node_panics_after_audit, "createTextNode");
missing_method_panics!(
    js_adapter_missing_create_document_fragment_panics_after_audit,
    "createDocumentFragment"
);
missing_method_panics!(js_adapter_missing_is_fragment_panics_after_audit, "isFragment");
missing_method_panics!(
    js_adapter_missing_collect_fragment_children_panics_after_audit,
    "collectFragmentChildren"
);
missing_method_panics!(js_adapter_missing_set_text_content_panics_after_audit, "setTextContent");
missing_method_panics!(js_adapter_missing_append_child_panics_after_audit, "appendChild");
missing_method_panics!(js_adapter_missing_insert_before_panics_after_audit, "insertBefore");
missing_method_panics!(js_adapter_missing_remove_child_panics_after_audit, "removeChild");
missing_method_panics!(js_adapter_missing_contains_panics_after_audit, "contains");
missing_method_panics!(js_adapter_missing_set_class_name_panics_after_audit, "setClassName");
missing_method_panics!(js_adapter_missing_patch_style_panics_after_audit, "patchStyle");
missing_method_panics!(js_adapter_missing_set_inner_html_panics_after_audit, "setInnerHTML");
missing_method_panics!(js_adapter_missing_set_value_panics_after_audit, "setValue");
missing_method_panics!(js_adapter_missing_set_checked_panics_after_audit, "setChecked");
missing_method_panics!(js_adapter_missing_set_disabled_panics_after_audit, "setDisabled");
missing_method_panics!(js_adapter_missing_clear_ref_panics_after_audit, "clearRef");
missing_method_panics!(js_adapter_missing_apply_ref_panics_after_audit, "applyRef");
missing_method_panics!(js_adapter_missing_set_attribute_panics_after_audit, "setAttribute");
missing_method_panics!(js_adapter_missing_remove_attribute_panics_after_audit, "removeAttribute");
missing_method_panics!(js_adapter_missing_get_tag_name_panics_after_audit, "getTagName");
missing_method_panics!(
    js_adapter_missing_add_event_listener_panics_after_audit,
    "addEventListener"
);
missing_method_panics!(
    js_adapter_missing_remove_event_listener_panics_after_audit,
    "removeEventListener"
);
missing_method_panics!(js_adapter_missing_query_selector_panics_after_audit, "querySelector");

nullish_return_panics!(
    js_adapter_create_element_returning_null_panics,
    "createElement",
    "tag,parent",
    "return null"
);
nullish_return_panics!(
    js_adapter_create_text_node_returning_undefined_panics,
    "createTextNode",
    "text",
    "return undefined"
);
nullish_return_panics!(
    js_adapter_create_text_node_returning_null_panics,
    "createTextNode",
    "text",
    "return null"
);
nullish_return_panics!(
    js_adapter_create_document_fragment_returning_undefined_panics,
    "createDocumentFragment",
    "",
    "return undefined"
);
nullish_return_panics!(
    js_adapter_create_document_fragment_returning_null_panics,
    "createDocumentFragment",
    "",
    "return null"
);

#[wasm_bindgen_test]
fn js_adapter_value_key_and_children_conversion_edges() {
    let mut adapter = make_working_adapter();
    let parent = adapter_object("parent");
    let mut child = adapter.create_element_in_parent("child", Some(&parent));
    assert_eq!(
        Reflect::get(&child, &JsValue::from_str("tag")).unwrap().as_string().as_deref(),
        Some("child")
    );

    let fragment = adapter.create_document_fragment();
    let nested = Array::new();
    nested.push(&JsValue::from_str("nested"));
    let children = Array::new();
    children.push(&JsValue::from_str("text"));
    children.push(&JsValue::from_f64(7.0));
    children.push(&JsValue::TRUE);
    children.push(&JsValue::NULL);
    children.push(&JsValue::UNDEFINED);
    children.push(&adapter_object("object-child"));
    children.push(&nested.into());
    Reflect::set(&fragment, &JsValue::from_str("children"), &children.into()).unwrap();

    let collected = adapter.collect_fragment_children(&fragment);
    assert_eq!(collected.len(), 7);
    assert_eq!(collected[0].as_string().as_deref(), Some("text"));
    assert_eq!(collected[1].as_f64(), Some(7.0));
    assert_eq!(collected[2].as_bool(), Some(true));
    assert!(collected[3].is_null());
    assert!(collected[4].is_undefined());
    assert!(collected[5].is_object());
    assert!(Array::is_array(&collected[6]));

    adapter.set_value(&mut child, JsValue::NULL);
    assert!(Reflect::get(&child, &JsValue::from_str("value")).unwrap().is_null());
    adapter.set_value(&mut child, JsValue::UNDEFINED);
    assert!(Reflect::get(&child, &JsValue::from_str("value")).unwrap().is_undefined());
    adapter.set_attribute(&mut child, "data-k", "v");
    adapter.remove_attribute(&mut child, "missing-key");
}

#[wasm_bindgen_test]
fn js_adapter_nullish_falsey_and_direct_replace_child_edges() {
    let mut adapter = make_working_adapter();

    adapter = rebuild_adapter_with_method(
        &adapter,
        "isFragment",
        Function::new_with_args("el", "return 'not-bool'").into(),
    );
    let child = adapter_object("child");
    assert!(!adapter.is_fragment(&child));

    adapter = rebuild_adapter_with_method(
        &adapter,
        "contains",
        Function::new_with_args("p,c", "return 'not-bool'").into(),
    );
    let parent = adapter_object("parent");
    assert!(!adapter.contains(&parent, &child));

    let select = adapter_object("SELECT");
    Reflect::set(&select, &JsValue::from_str("multiple"), &JsValue::from_str("yes")).unwrap();
    assert!(!adapter.is_select_multiple(&select));
    let div = adapter_object("div");
    assert!(!adapter.is_select_multiple(&div));

    adapter = rebuild_adapter_with_method(
        &adapter,
        "getTagName",
        Function::new_with_args("el", "return 42").into(),
    );
    assert_eq!(adapter.get_tag_name(&div), "");

    adapter = rebuild_adapter_with_method(
        &adapter,
        "querySelector",
        Function::new_with_args("sel", "return null").into(),
    );
    assert!(adapter.query_selector("#null").is_none());

    adapter = rebuild_adapter_with_method(
        &adapter,
        "getParentNode",
        Function::new_with_args("el", "return undefined").into(),
    );
    assert!(adapter.get_parent_node(&child).is_none());
    adapter = rebuild_adapter_without_method(&adapter, "getParentNode");
    assert!(adapter.get_parent_node(&child).is_none());
    Reflect::set(&child, &JsValue::from_str("parentNode"), &JsValue::NULL).unwrap();
    assert!(adapter.get_parent_node(&child).is_none());

    Reflect::set(&js_sys::global(), &JsValue::from_str("_replaceDirectLog"), &Array::new())
        .unwrap();
    adapter = rebuild_adapter_with_method(
        &adapter,
        "replaceChild",
        Function::new_with_args(
            "p,n,o",
            "globalThis._replaceDirectLog.push('replace:' + n.tag + ':' + o.tag)",
        )
        .into(),
    );
    let mut replace_parent = adapter_object("replace-parent");
    let new_child = adapter_object("new");
    let old_child = adapter_object("old");
    adapter.replace_child(&mut replace_parent, &new_child, &old_child);
    let log = Array::from(
        &Reflect::get(&js_sys::global(), &JsValue::from_str("_replaceDirectLog")).unwrap(),
    );
    assert!(log.iter().any(|v| v.as_string().as_deref() == Some("replace:new:old")));
}

#[wasm_bindgen_test]
fn js_adapter_set_inner_html_nullish_targets_are_noops() {
    Reflect::set(&js_sys::global(), &JsValue::from_str("_innerHtmlLog"), &Array::new()).unwrap();
    Reflect::set(&js_sys::global(), &JsValue::from_str("_childOpLog"), &Array::new()).unwrap();
    let mut adapter = make_working_adapter();
    adapter = rebuild_adapter_with_method(
        &adapter,
        "setInnerHTML",
        Function::new_with_args(
            "el,html",
            "globalThis._innerHtmlLog.push(html); el.children=[]; el.text=html",
        )
        .into(),
    );
    adapter = rebuild_adapter_with_method(
        &adapter,
        "appendChild",
        Function::new_with_args("p,c", "globalThis._childOpLog.push('append')").into(),
    );
    adapter = rebuild_adapter_with_method(
        &adapter,
        "insertBefore",
        Function::new_with_args("p,c,b", "globalThis._childOpLog.push('insert')").into(),
    );
    adapter = rebuild_adapter_with_method(
        &adapter,
        "removeChild",
        Function::new_with_args("p,c", "globalThis._childOpLog.push('remove')").into(),
    );

    let mut undefined_el = JsValue::UNDEFINED;
    adapter.set_inner_html(&mut undefined_el, "skip-undefined");
    let mut null_el = JsValue::NULL;
    adapter.set_inner_html(&mut null_el, "skip-null");
    let mut real_el = adapter_object("real");
    adapter.set_inner_html(&mut real_el, "apply");
    let real_child = adapter_object("child");
    let before_child = adapter_object("before");
    adapter.append_child(&mut undefined_el, &real_child);
    adapter.append_child(&mut real_el, &JsValue::NULL);
    adapter.insert_before(&mut null_el, &real_child, &before_child);
    adapter.insert_before(&mut real_el, &JsValue::UNDEFINED, &before_child);
    adapter.remove_child(&mut undefined_el, &real_child);
    adapter.remove_child(&mut real_el, &JsValue::NULL);

    let log =
        Array::from(&Reflect::get(&js_sys::global(), &JsValue::from_str("_innerHtmlLog")).unwrap());
    assert_eq!(log.length(), 1);
    assert_eq!(log.get(0).as_string().as_deref(), Some("apply"));
    assert_eq!(
        Reflect::get(&real_el, &JsValue::from_str("text")).unwrap().as_string().as_deref(),
        Some("apply")
    );
    let child_log =
        Array::from(&Reflect::get(&js_sys::global(), &JsValue::from_str("_childOpLog")).unwrap());
    assert_eq!(child_log.length(), 0);
}

#[wasm_bindgen_test]
#[should_panic]
fn js_adapter_propagates_call0_throw() {
    let adapter = make_working_adapter();
    let mut adapter = rebuild_adapter_with_method(
        &adapter,
        "createDocumentFragment",
        Function::new_no_args("throw new Error('call0 boom')").into(),
    );
    let _ = adapter.create_document_fragment();
}

#[wasm_bindgen_test]
#[should_panic]
fn js_adapter_propagates_call1_throw() {
    let adapter = make_working_adapter();
    let adapter = rebuild_adapter_with_method(
        &adapter,
        "isFragment",
        Function::new_with_args("el", "throw new Error('call1 boom')").into(),
    );
    let child = adapter_object("child");
    let _ = adapter.is_fragment(&child);
}

#[wasm_bindgen_test]
#[should_panic]
fn js_adapter_propagates_call2_throw() {
    let adapter = make_working_adapter();
    let mut adapter = rebuild_adapter_with_method(
        &adapter,
        "setTextContent",
        Function::new_with_args("el,text", "throw new Error('call2 boom')").into(),
    );
    let mut child = adapter_object("child");
    adapter.set_text_content(&mut child, "x");
}

#[wasm_bindgen_test]
#[should_panic]
fn js_adapter_propagates_call3_throw() {
    let adapter = make_working_adapter();
    let mut adapter = rebuild_adapter_with_method(
        &adapter,
        "setAttribute",
        Function::new_with_args("el,k,v", "throw new Error('call3 boom')").into(),
    );
    let mut child = adapter_object("child");
    adapter.set_attribute(&mut child, "data-x", "1");
}
