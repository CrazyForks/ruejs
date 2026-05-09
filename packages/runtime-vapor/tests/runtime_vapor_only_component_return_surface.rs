use js_sys::{Array, Function, Object, Reflect};
use rue_runtime_vapor::createRue;
use wasm_bindgen::JsValue;
use wasm_bindgen_test::*;
mod common;

use common::{children_of, make_vapor_only_adapter as make_adapter, tick};

#[wasm_bindgen_test(async)]
async fn vapor_only_component_accepts_host_node_bridge_return() {
    let adapter = make_adapter();
    let rue = createRue(adapter);
    let container = Object::new();

    let host = Object::new();
    Reflect::set(&host, &JsValue::from_str("tag"), &JsValue::from_str("span")).unwrap();
    Reflect::set(&host, &JsValue::from_str("children"), &Array::new().into()).unwrap();
    Reflect::set(&host, &JsValue::from_str("nodeType"), &JsValue::from_f64(1.0)).unwrap();

    let bridge = Object::new();
    Reflect::set(&bridge, &JsValue::from_str("__rue_host_node"), &host.clone().into()).unwrap();
    Reflect::set(&js_sys::global(), &JsValue::from_str("__rue_component_bridge"), &bridge).unwrap();

    let render_fn = Function::new_no_args("return globalThis.__rue_component_bridge");
    let handle = rue.create_component_wasm(render_fn.into(), JsValue::UNDEFINED);
    rue.render_wasm(handle, container.clone().into());
    tick().await;

    let children = children_of(&container.clone().into());
    assert_eq!(children.length(), 1);
    let first = children.get(0);
    let tag = Reflect::get(&first, &JsValue::from_str("tag"))
        .unwrap_or(JsValue::UNDEFINED)
        .as_string()
        .unwrap_or_default();
    assert_eq!(tag, "span");
}

#[wasm_bindgen_test(async)]
async fn vapor_only_component_rejects_array_fragment_return() {
    let adapter = make_adapter();
    let rue = createRue(adapter);
    let container = Object::new();
    let errors = Array::new();

    let errors_for_handler = errors.clone();
    let on_error = wasm_bindgen::closure::Closure::wrap(Box::new(move |err: JsValue| {
        errors_for_handler.push(&err);
    }) as Box<dyn FnMut(JsValue)>);
    rue.on_error(on_error.as_ref().clone().into());
    on_error.forget();

    let render_fn = Function::new_no_args("return ['A', 'B']");
    let handle = rue.create_component_wasm(render_fn.into(), JsValue::UNDEFINED);

    rue.render_wasm(handle, container.clone().into());
    tick().await;

    assert_eq!(errors.length(), 1);
    let message = errors.get(0).as_string().unwrap_or_default();
    assert!(message.contains("Unsupported object returns are no longer accepted"));
    assert_eq!(children_of(&container.into()).length(), 0);
}

#[wasm_bindgen_test(async)]
async fn vapor_only_component_rejects_bare_raw_host_node_return() {
    let adapter = make_adapter();
    let rue = createRue(adapter);
    let container = Object::new();
    let errors = Array::new();

    let errors_for_handler = errors.clone();
    let on_error = wasm_bindgen::closure::Closure::wrap(Box::new(move |err: JsValue| {
        errors_for_handler.push(&err);
    }) as Box<dyn FnMut(JsValue)>);
    rue.on_error(on_error.as_ref().clone().into());
    on_error.forget();

    let raw = Object::new();
    Reflect::set(&raw, &JsValue::from_str("tag"), &JsValue::from_str("span")).unwrap();
    Reflect::set(&raw, &JsValue::from_str("children"), &Array::new().into()).unwrap();
    Reflect::set(&raw, &JsValue::from_str("nodeType"), &JsValue::from_f64(1.0)).unwrap();
    Reflect::set(&js_sys::global(), &JsValue::from_str("__rue_component_raw_node"), &raw).unwrap();

    let render_fn = Function::new_no_args("return globalThis.__rue_component_raw_node");
    let handle = rue.create_component_wasm(render_fn.into(), JsValue::UNDEFINED);
    rue.render_wasm(handle, container.clone().into());
    tick().await;

    assert_eq!(errors.length(), 1);
    let message = errors.get(0).as_string().unwrap_or_default();
    assert!(message.contains("Unsupported object returns are no longer accepted"));
    assert_eq!(children_of(&container.into()).length(), 0);
}
