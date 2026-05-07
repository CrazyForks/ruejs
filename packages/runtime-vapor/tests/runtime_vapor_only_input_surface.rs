use js_sys::{Array, Object, Reflect};
use rue_runtime_vapor::createRue;
use wasm_bindgen::JsValue;
use wasm_bindgen_test::*;
mod common;

use common::{children_of, make_vapor_only_adapter as make_adapter, tick};

#[wasm_bindgen_test(async)]
async fn vapor_only_render_accepts_host_node_bridge() {
    let adapter = make_adapter();
    let rue = createRue(adapter);
    let container = Object::new();
    let host = Object::new();
    Reflect::set(&host, &JsValue::from_str("tag"), &JsValue::from_str("span")).unwrap();
    Reflect::set(&host, &JsValue::from_str("children"), &Array::new().into()).unwrap();
    Reflect::set(&host, &JsValue::from_str("nodeType"), &JsValue::from_f64(1.0)).unwrap();

    let bridge = Object::new();
    Reflect::set(&bridge, &JsValue::from_str("__rue_host_node"), &host.clone().into()).unwrap();

    rue.render_wasm(bridge.into(), container.clone().into());
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
async fn vapor_only_render_rejects_raw_element_input() {
    let adapter = make_adapter();
    let rue = createRue(adapter);
    let container = Object::new();

    let raw = Object::new();
    Reflect::set(&raw, &JsValue::from_str("tag"), &JsValue::from_str("span")).unwrap();
    Reflect::set(&raw, &JsValue::from_str("children"), &Array::new().into()).unwrap();
    Reflect::set(&raw, &JsValue::from_str("nodeType"), &JsValue::from_f64(1.0)).unwrap();

    rue.render_wasm(raw.into(), container.clone().into());
    tick().await;

    let children = children_of(&container.clone().into());
    assert_eq!(children.length(), 0);
}