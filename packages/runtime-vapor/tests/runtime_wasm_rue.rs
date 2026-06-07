use js_sys::{Array, Function, Object, Reflect};
use rue_runtime_vapor::createRue;
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use wasm_bindgen_test::*;
mod common;

use common::{js_obj, make_wasm_adapter as make_adapter, setup_range, tick};

fn set_prop(target: &Object, key: &str, value: &JsValue) {
    Reflect::set(target, &JsValue::from_str(key), value).unwrap();
}

fn set_fn(target: &Object, key: &str, args: &str, body: &str) {
    set_prop(target, key, &Function::new_with_args(args, body).into());
}

fn get_prop(target: &JsValue, key: &str) -> JsValue {
    Reflect::get(target, &JsValue::from_str(key)).unwrap_or(JsValue::UNDEFINED)
}

fn make_real_dom_observing_adapter() -> JsValue {
    let obj = Object::new();
    set_prop(&obj, "__calls", &Array::new().into());
    set_fn(&obj, "__record", "name,value", "this.__calls.push({ name, value });");
    set_fn(
        &obj,
        "createElement",
        "tag,parent",
        "const el = { tag, tagName: String(tag).toUpperCase(), children: [], nodeType: 1 }; \
         if (parent) el.createdIn = parent.tag || 'parent'; \
         this.__record('createElement', tag); \
         return el;",
    );
    set_fn(
        &obj,
        "createTextNode",
        "text",
        "this.__record('createTextNode', text); \
         return { tag: '#text', text, children: [], nodeType: 3 };",
    );
    set_fn(
        &obj,
        "createDocumentFragment",
        "",
        "return { tag: 'fragment', tagName: 'FRAGMENT', children: [], nodeType: 11 };",
    );
    set_fn(&obj, "isFragment", "el", "return !!el && el.tag === 'fragment';");
    set_fn(&obj, "collectFragmentChildren", "el", "return Array.from(el && el.children || []);");
    set_fn(&obj, "setTextContent", "el,text", "el.text = text; this.__record('text', text);");
    let move_helpers = "\
        function detach(node) { \
          const old = node && node.parentNode; \
          if (old && old.children) old.children = old.children.filter(x => x !== node); \
        } \
        function insertOne(p, node, before) { \
          p.children = p.children || []; \
          detach(node); \
          const existing = p.children.indexOf(node); \
          if (existing >= 0) p.children.splice(existing, 1); \
          const idx = before ? p.children.indexOf(before) : -1; \
          const at = idx >= 0 ? idx : p.children.length; \
          p.children.splice(at, 0, node); \
          node.parentNode = p; \
        } \
        const items = c && c.tag === 'fragment' ? Array.from(c.children || []) : [c];";
    set_fn(
        &obj,
        "appendChild",
        "p,c",
        &format!(
            "{} for (const item of items) insertOne(p, item, null); this.__record('append', c && c.tag);",
            move_helpers
        ),
    );
    set_fn(
        &obj,
        "insertBefore",
        "p,c,b",
        &format!(
            "{} for (const item of items) insertOne(p, item, b); this.__record('insertBefore', c && c.tag);",
            move_helpers
        ),
    );
    set_fn(
        &obj,
        "removeChild",
        "p,c",
        "p.children = (p.children || []).filter(x => x !== c); if (c) c.parentNode = null; this.__record('remove', c && c.tag);",
    );
    set_fn(
        &obj,
        "contains",
        "p,c",
        "function has(root, node) { return root === node || Array.from(root && root.children || []).some(ch => has(ch, node)); } return has(p, c);",
    );
    set_fn(&obj, "setClassName", "el,v", "el.class = v; this.__record('class', v);");
    set_fn(&obj, "patchStyle", "el,oldv,newv", "el.style = newv;");
    set_fn(
        &obj,
        "setInnerHTML",
        "el,html",
        "Array.from(el.children || []).forEach(ch => ch.parentNode = null); el.children = []; el.text = html; this.__record('html', html);",
    );
    set_fn(&obj, "setValue", "el,v", "el.value = v; this.__record('value', v);");
    set_fn(&obj, "setChecked", "el,b", "el.checked = !!b;");
    set_fn(&obj, "setDisabled", "el,b", "el.disabled = !!b;");
    set_fn(&obj, "clearRef", "r", "this.__record('clearRef', !!r);");
    set_fn(&obj, "applyRef", "el,r", "this.__record('applyRef', !!r);");
    set_fn(
        &obj,
        "setAttribute",
        "el,k,v",
        "el.attrs = el.attrs || {}; el.attrs[k] = v; this.__record('attr:' + k, v);",
    );
    set_fn(
        &obj,
        "removeAttribute",
        "el,k",
        "if (el.attrs) delete el.attrs[k]; this.__record('removeAttr', k);",
    );
    set_fn(&obj, "getTagName", "el", "return el && (el.tagName || el.tag || '') || '';");
    set_fn(
        &obj,
        "addEventListener",
        "el,evt,h",
        "el.events = el.events || {}; el.events[evt] = h; this.__record('add:' + evt, true);",
    );
    set_fn(
        &obj,
        "removeEventListener",
        "el,evt,h",
        "if (el.events) delete el.events[evt]; this.__record('remove:' + evt, true);",
    );
    set_fn(
        &obj,
        "hasValueProperty",
        "el",
        "return 'value' in el || el.tag === 'input' || el.tag === 'select';",
    );
    set_fn(
        &obj,
        "isSelectMultiple",
        "el",
        "return el && el.tagName === 'SELECT' && !!el.multiple;",
    );
    set_fn(
        &obj,
        "querySelector",
        "sel",
        "return { tag: sel, tagName: String(sel).toUpperCase(), children: [], nodeType: 1 };",
    );
    obj.into()
}

fn attach_error_collector(rue: &rue_runtime_vapor::WasmRue) -> Array {
    let errors = Array::new();
    let errors_for_handler = errors.clone();
    let on_error = wasm_bindgen::closure::Closure::wrap(Box::new(move |err: JsValue| {
        errors_for_handler.push(&err);
    }) as Box<dyn FnMut(JsValue)>);
    rue.on_error(on_error.as_ref().clone().into());
    on_error.forget();
    errors
}

// Note: Lifecycle hook registration via WasmRue inside component functions
// would reenter a mutable borrow of the same Rue. End-to-end lifecycle tests
// are covered in Rust unit tests in runtime_render.rs to avoid reentrancy.

#[wasm_bindgen_test(async)]
async fn wasm_real_dom_element_covers_nullish_props_inner_html_and_child_removal() {
    let adapter = make_real_dom_observing_adapter();
    let rue = createRue(adapter.clone());
    let container = js_obj();

    let empty =
        rue.create_element_wasm(JsValue::from_str("div"), JsValue::NULL, JsValue::UNDEFINED);
    rue.render_wasm(empty, container.clone());
    tick().await;

    let roots = Reflect::get(&container, &JsValue::from_str("children"))
        .unwrap_or(Array::new().into())
        .unchecked_into::<Array>();
    assert_eq!(roots.length(), 1);
    assert_eq!(get_prop(&roots.get(0), "tag").as_string().as_deref(), Some("div"));
    assert_eq!(
        Reflect::get(&roots.get(0), &JsValue::from_str("children"))
            .unwrap()
            .unchecked_into::<Array>()
            .length(),
        0
    );

    let html = Object::new();
    set_prop(&html, "__html", &JsValue::from_str("<b>raw</b>"));
    let html_props = Object::new();
    set_prop(&html_props, "dangerouslySetInnerHTML", &html.into());
    let with_html = rue.create_element_wasm(
        JsValue::from_str("section"),
        html_props.into(),
        Array::of1(&JsValue::from_str("ignored child")).into(),
    );
    rue.render_wasm(with_html, container.clone());
    tick().await;

    let root = Reflect::get(&container, &JsValue::from_str("children"))
        .unwrap()
        .unchecked_into::<Array>()
        .get(0);
    assert_eq!(get_prop(&root, "tag").as_string().as_deref(), Some("section"));
    assert_eq!(get_prop(&root, "text").as_string().as_deref(), Some("<b>raw</b>"));
    assert_eq!(
        Reflect::get(&root, &JsValue::from_str("children"))
            .unwrap()
            .unchecked_into::<Array>()
            .length(),
        0
    );

    let props = Object::new();
    set_prop(&props, "data-state", &JsValue::from_str("ready"));
    set_prop(&props, "onClick", &Function::new_no_args("return 'clicked';").into());
    let child = rue.create_element_wasm(
        JsValue::from_str("span"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("child")).into(),
    );
    let next_children = Array::new();
    next_children.push(&child);
    next_children.push(&JsValue::from_str("tail"));
    let with_children =
        rue.create_element_wasm(JsValue::from_str("section"), props.into(), next_children.into());
    rue.render_wasm(with_children, container.clone());
    tick().await;

    let root = Reflect::get(&container, &JsValue::from_str("children"))
        .unwrap()
        .unchecked_into::<Array>()
        .get(0);
    assert_eq!(
        Reflect::get(&get_prop(&root, "attrs"), &JsValue::from_str("data-state"))
            .unwrap()
            .as_string()
            .as_deref(),
        Some("ready")
    );
    assert_eq!(
        Reflect::get(&root, &JsValue::from_str("children"))
            .unwrap()
            .unchecked_into::<Array>()
            .length(),
        2
    );

    let bad_component = Function::new_no_args("return { unsupported: true };");
    let bad_child =
        rue.create_element_wasm(bad_component.into(), JsValue::UNDEFINED, JsValue::UNDEFINED);
    let mixed_children = Array::new();
    mixed_children.push(&bad_child);
    mixed_children.push(&JsValue::from_str("kept"));
    let with_unmountable_child = rue.create_element_wasm(
        JsValue::from_str("section"),
        JsValue::UNDEFINED,
        mixed_children.into(),
    );
    rue.render_wasm(with_unmountable_child, container.clone());
    tick().await;

    let root = Reflect::get(&container, &JsValue::from_str("children"))
        .unwrap()
        .unchecked_into::<Array>()
        .get(0);
    let children =
        Reflect::get(&root, &JsValue::from_str("children")).unwrap().unchecked_into::<Array>();
    assert!(
        children
            .iter()
            .any(|child| { get_prop(&child, "text").as_string().as_deref() == Some("kept") })
    );

    let without_children = rue.create_element_wasm(
        JsValue::from_str("section"),
        JsValue::UNDEFINED,
        Array::new().into(),
    );
    rue.render_wasm(without_children, container.clone());
    tick().await;

    let root = Reflect::get(&container, &JsValue::from_str("children"))
        .unwrap()
        .unchecked_into::<Array>()
        .get(0);
    assert_eq!(
        Reflect::get(&root, &JsValue::from_str("children"))
            .unwrap()
            .unchecked_into::<Array>()
            .length(),
        0
    );
    assert!(
        Reflect::get(&get_prop(&root, "attrs"), &JsValue::from_str("data-state"))
            .unwrap_or(JsValue::UNDEFINED)
            .is_undefined()
    );

    let calls = Array::from(&get_prop(&adapter, "__calls"));
    let call_names: Vec<String> = calls
        .iter()
        .map(|entry| get_prop(&entry, "name").as_string().unwrap_or_default())
        .collect();
    assert!(call_names.iter().any(|name| name == "html"));
    assert!(call_names.iter().any(|name| name == "add:click"));
    assert!(call_names.iter().any(|name| name == "remove:click"));
    assert!(call_names.iter().any(|name| name == "removeAttr"));
    assert!(call_names.iter().any(|name| name == "remove"));
}

#[wasm_bindgen_test(async)]
async fn wasm_render_rejects_raw_array_fragment_input() {
    let adapter = make_adapter();
    let rue = createRue(adapter.clone());
    let container = js_obj();
    let errors = attach_error_collector(&rue);

    let raw_fragment = Array::new();
    raw_fragment.push(&JsValue::from_str("A"));
    raw_fragment.push(&JsValue::from_f64(4.0));

    rue.render_wasm(raw_fragment.into(), container.clone());
    tick().await;

    let children =
        Reflect::get(&container, &JsValue::from_str("children")).unwrap_or(Array::new().into());
    let children: Array = children.unchecked_into();
    assert_eq!(children.length(), 0);
    assert_eq!(errors.length(), 1);
    assert_eq!(
        errors.get(0).as_string().unwrap_or_default(),
        "Rue runtime: render input not supported on the default path"
    );
}

#[wasm_bindgen_test(async)]
async fn wasm_render_clears_container_on_null_without_error() {
    let adapter = make_adapter();
    let rue = createRue(adapter.clone());
    let container = js_obj();
    let errors = attach_error_collector(&rue);

    let setup = Function::new_with_args("", "const el = { tag: 'span', children: [] }; return el");
    let id = rue.vapor_wasm(setup.into());
    rue.render_wasm(id, container.clone());
    tick().await;

    rue.render_wasm(JsValue::NULL, container.clone());
    tick().await;

    let children = Reflect::get(&container, &JsValue::from_str("children"))
        .unwrap_or(Array::new().into())
        .unchecked_into::<Array>();
    assert_eq!(children.length(), 0);
    assert_eq!(errors.length(), 0);
}

#[wasm_bindgen_test(async)]
async fn wasm_render_rejects_raw_vnode_object_input() {
    let adapter = make_adapter();
    let rue = createRue(adapter.clone());
    let container = js_obj();

    let children = Array::new();
    children.push(&JsValue::from_str("A"));

    let props = Object::new();
    let _ = Reflect::set(&props, &JsValue::from_str("className"), &JsValue::from_str("raw"));

    let vnode = Object::new();
    let _ = Reflect::set(&vnode, &JsValue::from_str("type"), &JsValue::from_str("div"));
    let _ = Reflect::set(&vnode, &JsValue::from_str("props"), &props);
    let _ = Reflect::set(&vnode, &JsValue::from_str("children"), &children.into());

    rue.render_wasm(vnode.into(), container.clone());
    tick().await;

    let children =
        Reflect::get(&container, &JsValue::from_str("children")).unwrap_or(Array::new().into());
    let children: Array = children.unchecked_into();
    assert_eq!(children.length(), 0);
}

#[wasm_bindgen_test]
fn create_rue_sets_global_dom_adapter() {
    let adapter = make_adapter();
    let _rue = createRue(adapter.clone());
    let global = js_sys::global();
    let stored =
        Reflect::get(&global, &JsValue::from_str("__rue_dom")).unwrap_or(JsValue::UNDEFINED);
    assert!(stored.is_object());
}

#[wasm_bindgen_test(async)]
async fn wasm_render_rejects_raw_function_component_input_on_container_entry() {
    let adapter = make_adapter();
    let rue = createRue(adapter.clone());
    let container = js_obj();

    let _ = Reflect::set(
        &js_sys::global(),
        &JsValue::from_str("_renderFcCount"),
        &JsValue::from_f64(0.0),
    );
    let fc = Function::new_no_args(
        "globalThis._renderFcCount = (globalThis._renderFcCount||0) + 1; return { type: 'div', props: {}, children: ['x'] }",
    );

    rue.render_wasm(fc.into(), container.clone());
    tick().await;

    let count = Reflect::get(&js_sys::global(), &JsValue::from_str("_renderFcCount"))
        .unwrap_or(JsValue::UNDEFINED)
        .as_f64()
        .unwrap_or(0.0);
    assert_eq!(count as i32, 0);

    let children =
        Reflect::get(&container, &JsValue::from_str("children")).unwrap_or(Array::new().into());
    let children: Array = children.unchecked_into();
    assert_eq!(children.length(), 0);
}

#[wasm_bindgen_test(async)]
async fn wasm_render_between_rejects_raw_function_component_input() {
    let adapter = make_adapter();
    let rue = createRue(adapter.clone());
    let (parent, start, end) = setup_range(&adapter);
    let errors = attach_error_collector(&rue);

    let _ = Reflect::set(
        &js_sys::global(),
        &JsValue::from_str("_betweenFcCount"),
        &JsValue::from_f64(0.0),
    );
    let fc = Function::new_no_args(
        "globalThis._betweenFcCount = (globalThis._betweenFcCount||0) + 1; return { type: 'div', props: { className: 'between-ok' }, children: ['B'] }",
    );

    rue.render_between_wasm(fc.into(), parent.clone(), start.clone(), end.clone());
    tick().await;

    let count = Reflect::get(&js_sys::global(), &JsValue::from_str("_betweenFcCount"))
        .unwrap_or(JsValue::UNDEFINED)
        .as_f64()
        .unwrap_or(0.0);
    assert_eq!(count as i32, 0);

    let children =
        Reflect::get(&parent, &JsValue::from_str("children")).unwrap_or(Array::new().into());
    let children: Array = children.unchecked_into();
    assert!(!children.iter().any(|child| {
        Reflect::get(&child, &JsValue::from_str("class"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .unwrap_or_default()
            == "between-ok"
    }));
    assert_eq!(errors.length(), 1);
    assert_eq!(
        errors.get(0).as_string().unwrap_or_default(),
        "Rue runtime: renderBetween input not supported on the default path"
    );
}

#[wasm_bindgen_test(async)]
async fn wasm_render_between_clears_range_on_null_without_error() {
    let adapter = make_adapter();
    let rue = createRue(adapter.clone());
    let (parent, start, end) = setup_range(&adapter);
    let errors = attach_error_collector(&rue);

    let setup = Function::new_with_args("", "const el = { tag: 'span', children: [] }; return el");
    let id = rue.vapor_wasm(setup.into());
    rue.render_between_wasm(id, parent.clone(), start.clone(), end.clone());
    tick().await;

    rue.render_between_wasm(JsValue::NULL, parent.clone(), start.clone(), end.clone());
    tick().await;
    rue.render_between_wasm(JsValue::NULL, parent.clone(), start.clone(), end.clone());
    tick().await;

    let next_setup =
        Function::new_with_args("", "const el = { tag: 'strong', children: [] }; return el");
    let next_id = rue.vapor_wasm(next_setup.into());
    rue.render_between_wasm(next_id, parent.clone(), start.clone(), end.clone());
    tick().await;

    let children = Reflect::get(&parent, &JsValue::from_str("children"))
        .unwrap_or(Array::new().into())
        .unchecked_into::<Array>();
    assert!(!children.iter().any(|child| {
        Reflect::get(&child, &JsValue::from_str("tag"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .unwrap_or_default()
            == "span"
    }));
    assert!(children.iter().any(|child| {
        Reflect::get(&child, &JsValue::from_str("tag"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .unwrap_or_default()
            == "strong"
    }));
    assert_eq!(errors.length(), 0);
}

#[wasm_bindgen_test(async)]
async fn wasm_render_anchor_reports_unsupported_default_surface_input() {
    let adapter = make_adapter();
    let rue = createRue(adapter.clone());
    let (parent, _start, anchor) = setup_range(&adapter);
    let errors = attach_error_collector(&rue);

    let unsupported_function_component = Function::new_no_args("return null");

    rue.render_anchor_wasm(unsupported_function_component.into(), parent.clone(), anchor.clone());
    tick().await;

    assert_eq!(errors.length(), 1);
    assert_eq!(
        errors.get(0).as_string().unwrap_or_default(),
        "Rue runtime: renderAnchor input not supported on the default path"
    );
}

#[wasm_bindgen_test(async)]
async fn wasm_render_anchor_clears_on_null_without_error() {
    let adapter = make_adapter();
    let rue = createRue(adapter.clone());
    let (parent, _start, anchor) = setup_range(&adapter);
    let errors = attach_error_collector(&rue);

    let setup = Function::new_with_args("", "const el = { tag: 'span', children: [] }; return el");
    let id = rue.vapor_wasm(setup.into());
    rue.render_anchor_wasm(id, parent.clone(), anchor.clone());
    tick().await;

    rue.render_anchor_wasm(JsValue::NULL, parent.clone(), anchor.clone());
    tick().await;

    let children = Reflect::get(&parent, &JsValue::from_str("children"))
        .unwrap_or(Array::new().into())
        .unchecked_into::<Array>();
    assert!(!children.iter().any(|child| {
        Reflect::get(&child, &JsValue::from_str("tag"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .unwrap_or_default()
            == "span"
    }));
    assert_eq!(errors.length(), 0);
}

#[wasm_bindgen_test(async)]
async fn wasm_render_static_reports_unsupported_default_surface_input() {
    let adapter = make_adapter();
    let rue = createRue(adapter.clone());
    let (parent, _start, anchor) = setup_range(&adapter);
    let errors = attach_error_collector(&rue);

    let raw_vnode = Object::new();
    let _ = Reflect::set(&raw_vnode, &JsValue::from_str("type"), &JsValue::from_str("div"));

    rue.render_static_wasm(raw_vnode.into(), parent, anchor);
    tick().await;

    assert_eq!(errors.length(), 1);
    assert_eq!(
        errors.get(0).as_string().unwrap_or_default(),
        "Rue runtime: renderStatic input not supported on the default path"
    );
}

#[wasm_bindgen_test(async)]
async fn wasm_vapor_wasm_renders_host_element() {
    let adapter = make_adapter();
    let rue = createRue(adapter.clone());
    let container = js_obj();

    let setup = Function::new_with_args("", "const el = { tag: 'span', children: [] }; return el");
    let id = rue.vapor_wasm(setup.into());
    rue.render_wasm(id, container.clone());
    tick().await;

    let children =
        Reflect::get(&container, &JsValue::from_str("children")).unwrap_or(Array::new().into());
    let children: Array = children.unchecked_into();
    assert_eq!(children.length(), 1);
    let el = children.get(0);
    let tag = Reflect::get(&el, &JsValue::from_str("tag"))
        .unwrap_or(JsValue::UNDEFINED)
        .as_string()
        .unwrap_or_default();
    assert_eq!(tag, "span");
}

#[wasm_bindgen_test(async)]
async fn wasm_vapor_wasm_rejects_legacy_vapor_wrapper_return() {
    let adapter = make_adapter();
    let rue = createRue(adapter.clone());
    let container = js_obj();
    let errors = Array::new();

    let errors_for_handler = errors.clone();
    let on_error = wasm_bindgen::closure::Closure::wrap(Box::new(move |err: JsValue| {
        errors_for_handler.push(&err);
    }) as Box<dyn FnMut(JsValue)>);
    rue.on_error(on_error.as_ref().clone().into());
    on_error.forget();

    let setup = Function::new_no_args(
        "return { vaporElement: { tag: 'span', children: [], nodeType: 1 } }",
    );
    let id = rue.vapor_wasm(setup.into());
    rue.render_wasm(id, container.clone());
    tick().await;

    assert_eq!(errors.length(), 1);
    let message = errors.get(0).as_string().unwrap_or_default();
    assert!(message.contains("Unsupported object returns are no longer accepted for vapor setup"));
    let children =
        Reflect::get(&container, &JsValue::from_str("children")).unwrap_or(JsValue::UNDEFINED);
    let children: Array = if children.is_object() { Array::from(&children) } else { Array::new() };
    assert_eq!(children.length(), 0);
}

#[wasm_bindgen_test(async)]
async fn wasm_get_current_container_returns_last_render_container() {
    let adapter = make_adapter();
    let rue = createRue(adapter.clone());
    let container = js_obj();

    let setup = Function::new_with_args("", "const el = { tag: 'div', children: [] }; return el");
    let id = rue.vapor_wasm(setup.into());
    rue.render_wasm(id, container.clone());
    let got = rue.get_current_container_wasm();
    assert!(got.is_object());
    tick().await;
}

#[wasm_bindgen_test(async)]
async fn wasm_render_isolates_multiple_containers_and_reuses_cleared_entry() {
    let adapter = make_adapter();
    let rue = createRue(adapter.clone());
    let container_a = js_obj();
    let container_b = js_obj();

    let first_a = rue
        .vapor_wasm(Function::new_with_args("", "return { tag: 'first-a', children: [] }").into());
    rue.render_wasm(first_a, container_a.clone());
    tick().await;
    assert!(js_sys::Object::is(&rue.get_current_container_wasm(), &container_a));

    let first_b = rue
        .vapor_wasm(Function::new_with_args("", "return { tag: 'first-b', children: [] }").into());
    rue.render_wasm(first_b, container_b.clone());
    tick().await;
    assert!(js_sys::Object::is(&rue.get_current_container_wasm(), &container_b));

    let second_a = rue
        .vapor_wasm(Function::new_with_args("", "return { tag: 'second-a', children: [] }").into());
    rue.render_wasm(second_a, container_a.clone());
    tick().await;

    let children_a = Reflect::get(&container_a, &JsValue::from_str("children"))
        .unwrap_or(Array::new().into())
        .unchecked_into::<Array>();
    let children_b = Reflect::get(&container_b, &JsValue::from_str("children"))
        .unwrap_or(Array::new().into())
        .unchecked_into::<Array>();
    assert_eq!(children_a.length(), 1);
    assert_eq!(children_b.length(), 1);
    assert_eq!(
        Reflect::get(&children_a.get(0), &JsValue::from_str("tag"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .as_deref(),
        Some("second-a")
    );
    assert_eq!(
        Reflect::get(&children_b.get(0), &JsValue::from_str("tag"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .as_deref(),
        Some("first-b")
    );
    assert!(js_sys::Object::is(&rue.get_current_container_wasm(), &container_a));

    rue.render_wasm(JsValue::NULL, container_a.clone());
    tick().await;
    let cleared_a = Reflect::get(&container_a, &JsValue::from_str("children"))
        .unwrap_or(Array::new().into())
        .unchecked_into::<Array>();
    assert_eq!(cleared_a.length(), 0);
    assert_eq!(children_b.length(), 1);

    let third_a = rue
        .vapor_wasm(Function::new_with_args("", "return { tag: 'third-a', children: [] }").into());
    rue.render_wasm(third_a, container_a.clone());
    tick().await;
    let remounted_a = Reflect::get(&container_a, &JsValue::from_str("children"))
        .unwrap_or(Array::new().into())
        .unchecked_into::<Array>();
    assert_eq!(remounted_a.length(), 1);
    assert_eq!(
        Reflect::get(&remounted_a.get(0), &JsValue::from_str("tag"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .as_deref(),
        Some("third-a")
    );
    assert!(js_sys::Object::is(&rue.get_current_container_wasm(), &container_a));
}

#[wasm_bindgen_test(async)]
async fn wasm_mount_calls_app_with_props_and_renders_returned_handle() {
    let adapter = make_adapter();
    let rue = createRue(adapter.clone());
    let container = js_obj();

    let setup = Function::new_with_args("", "return { tag: 'main', children: [] }");
    let handle = rue.vapor_wasm(setup.into());
    let seen_props = Array::new();
    let seen_props_for_app = seen_props.clone();
    let app = wasm_bindgen::closure::Closure::wrap(Box::new(move |props: JsValue| {
        seen_props_for_app.push(&props);
        handle.clone()
    }) as Box<dyn FnMut(JsValue) -> JsValue>);

    rue.mount_wasm(app.as_ref().clone().unchecked_into(), container.clone());
    tick().await;

    let children = Reflect::get(&container, &JsValue::from_str("children"))
        .unwrap_or(Array::new().into())
        .unchecked_into::<Array>();
    assert_eq!(children.length(), 1);
    assert_eq!(
        Reflect::get(&children.get(0), &JsValue::from_str("tag"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .as_deref(),
        Some("main"),
    );
    assert_eq!(seen_props.length(), 1);
    assert!(seen_props.get(0).is_object());
    assert!(js_sys::Object::is(&rue.get_current_container_wasm(), &container));

    app.forget();
}

#[wasm_bindgen_test(async)]
async fn wasm_mount_falls_back_to_empty_fragment_for_invalid_or_throwing_app() {
    let adapter = make_adapter();
    let rue = createRue(adapter.clone());
    let container = js_obj();

    rue.mount_wasm(JsValue::from_str("not-a-function"), container.clone());
    tick().await;
    let children = Reflect::get(&container, &JsValue::from_str("children"))
        .unwrap_or(Array::new().into())
        .unchecked_into::<Array>();
    assert_eq!(children.length(), 0);
    assert!(js_sys::Object::is(&rue.get_current_container_wasm(), &container));

    let throwing_app = Function::new_no_args("throw new Error('boom')");
    rue.mount_wasm(throwing_app.into(), container.clone());
    tick().await;
    let children_after_throw = Reflect::get(&container, &JsValue::from_str("children"))
        .unwrap_or(Array::new().into())
        .unchecked_into::<Array>();
    assert_eq!(children_after_throw.length(), 0);
}

#[wasm_bindgen_test]
fn wasm_emitted_invokes_camel_and_lower_handlers_with_array_args() {
    let rue = createRue(JsValue::UNDEFINED);
    let calls = Array::new();

    let calls_for_camel = calls.clone();
    let on_save = wasm_bindgen::closure::Closure::wrap(Box::new(move |a: JsValue, b: JsValue| {
        calls_for_camel.push(&JsValue::from_str("camel"));
        calls_for_camel.push(&a);
        calls_for_camel.push(&b);
    }) as Box<dyn FnMut(JsValue, JsValue)>);

    let calls_for_lower = calls.clone();
    let on_lower = wasm_bindgen::closure::Closure::wrap(Box::new(move |a: JsValue, b: JsValue| {
        calls_for_lower.push(&JsValue::from_str("lower"));
        calls_for_lower.push(&a);
        calls_for_lower.push(&b);
    }) as Box<dyn FnMut(JsValue, JsValue)>);

    let props = Object::new();
    Reflect::set(&props, &JsValue::from_str("onSave"), on_save.as_ref()).unwrap();
    Reflect::set(&props, &JsValue::from_str("onsave"), on_lower.as_ref()).unwrap();
    let emitter: Function = rue.emitted_wasm(props.into()).unchecked_into();

    let args = Array::new();
    args.push(&JsValue::from_str("payload"));
    args.push(&JsValue::from_f64(3.0));
    emitter.call2(&JsValue::UNDEFINED, &JsValue::from_str("save"), &args.into()).unwrap();

    assert_eq!(calls.length(), 6);
    assert_eq!(calls.get(0).as_string().as_deref(), Some("camel"));
    assert_eq!(calls.get(1).as_string().as_deref(), Some("payload"));
    assert_eq!(calls.get(2).as_f64(), Some(3.0));
    assert_eq!(calls.get(3).as_string().as_deref(), Some("lower"));
    assert_eq!(calls.get(4).as_string().as_deref(), Some("payload"));
    assert_eq!(calls.get(5).as_f64(), Some(3.0));

    emitter.call2(&JsValue::UNDEFINED, &JsValue::from_str("missing"), &JsValue::NULL).unwrap();
    assert_eq!(calls.length(), 6);

    on_save.forget();
    on_lower.forget();
}
