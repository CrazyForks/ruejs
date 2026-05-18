use js_sys::{Array, Function, Object, Reflect};
use rue_runtime_vapor::createRue;
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use wasm_bindgen_test::*;
mod common;

use common::{js_obj, make_wasm_adapter as make_adapter, setup_range, tick};

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
