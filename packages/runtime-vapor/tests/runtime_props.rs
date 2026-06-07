use crate::common::{TestAdapter, TestEvent};
use js_sys::{Array, Function, Object, Reflect};
use rue_runtime_vapor::{ComponentProps, DomAdapter, patch_props, post_patch_element};
use wasm_bindgen::JsValue;
use wasm_bindgen_test::*;

mod common;

fn handler() -> JsValue {
    Function::new_no_args("return undefined").into()
}

fn prop_map(entries: &[(&str, JsValue)]) -> ComponentProps {
    let mut props = ComponentProps::new();
    for (key, value) in entries {
        props.insert((*key).to_string(), value.clone());
    }
    props
}

#[wasm_bindgen_test]
fn patch_props_removes_events_special_props_and_ignores_reserved_keys() {
    let mut adapter = TestAdapter::default();
    let mut select = adapter.create_element("SELECT");
    adapter.nodes.get_mut(&select.id).unwrap().multiple = true;

    let style = Object::new();
    Reflect::set(&style, &JsValue::from_str("color"), &JsValue::from_str("red")).unwrap();
    let html = Object::new();
    Reflect::set(&html, &JsValue::from_str("__html"), &JsValue::from_str("<b>A</b>")).unwrap();

    let old_props = prop_map(&[
        ("onClick", handler()),
        ("className", JsValue::from_str("old")),
        ("style", style.into()),
        ("dangerouslySetInnerHTML", html.into()),
        ("value", JsValue::from_str("x")),
        ("checked", JsValue::TRUE),
        ("disabled", JsValue::TRUE),
        ("ref", Object::new().into()),
        ("data-id", JsValue::from_str("old")),
        ("key", JsValue::from_str("k")),
        ("children", Array::new().into()),
    ]);
    let new_props = ComponentProps::new();

    patch_props(&mut adapter, &mut select, &old_props, &new_props).unwrap();

    assert!(
        adapter.events.iter().any(|event| matches!(event, TestEvent::RmEvt(evt) if evt == "click"))
    );
    assert!(
        adapter
            .events
            .iter()
            .any(|event| matches!(event, TestEvent::SetValue(value) if Array::is_array(value)))
    );
    assert!(adapter.events.iter().any(|event| matches!(event, TestEvent::SetChecked(false))));
    assert!(adapter.events.iter().any(|event| matches!(event, TestEvent::SetDisabled(false))));
    assert!(adapter.events.iter().any(|event| matches!(event, TestEvent::ClearRef(_))));
    assert!(
        adapter
            .events
            .iter()
            .any(|event| matches!(event, TestEvent::RemoveAttr(key) if key == "data-id"))
    );
    assert!(!adapter.events.iter().any(
        |event| matches!(event, TestEvent::RemoveAttr(key) if key == "key" || key == "children")
    ));
    assert_eq!(adapter.nodes.get(&select.id).unwrap().class, "");
    assert_eq!(adapter.nodes.get(&select.id).unwrap().text, "");
}

#[wasm_bindgen_test]
fn patch_props_skips_value_reset_without_value_property_and_keeps_reserved_old_props() {
    let mut adapter = TestAdapter::default();
    let mut div = adapter.create_element("div");

    let old_props = prop_map(&[
        ("value", JsValue::from_str("plain")),
        ("key", JsValue::from_str("stable")),
        ("children", Array::new().into()),
    ]);
    let new_props = ComponentProps::new();

    patch_props(&mut adapter, &mut div, &old_props, &new_props).unwrap();

    assert!(!adapter.events.iter().any(|event| matches!(event, TestEvent::SetValue(_))));
    assert!(!adapter.events.iter().any(
        |event| matches!(event, TestEvent::RemoveAttr(key) if key == "value" || key == "key" || key == "children")
    ));
}

#[wasm_bindgen_test]
fn patch_props_removes_value_for_single_select_and_value_property_hosts() {
    let mut adapter = TestAdapter::default();

    let mut select = adapter.create_element("SELECT");
    let old_props = prop_map(&[("value", JsValue::from_str("selected"))]);
    patch_props(&mut adapter, &mut select, &old_props, &ComponentProps::new()).unwrap();
    assert!(adapter.events.iter().any(|event| {
        matches!(event, TestEvent::SetValue(value) if value.as_string().as_deref() == Some(""))
    }));

    adapter.events.clear();
    let mut input = adapter.create_element("input");
    adapter.nodes.get_mut(&input.id).unwrap().has_value = true;
    patch_props(&mut adapter, &mut input, &old_props, &ComponentProps::new()).unwrap();
    assert!(adapter.events.iter().any(|event| {
        matches!(event, TestEvent::SetValue(value) if value.as_string().as_deref() == Some(""))
    }));
    assert!(
        adapter
            .events
            .iter()
            .any(|event| matches!(event, TestEvent::RemoveAttr(key) if key == "value"))
    );
}

#[wasm_bindgen_test]
fn patch_props_handles_inner_html_empty_and_reflect_get_error_paths() {
    let mut adapter = TestAdapter::default();
    let mut div = adapter.create_element("div");

    let props = prop_map(&[("dangerouslySetInnerHTML", JsValue::UNDEFINED)]);
    patch_props(&mut adapter, &mut div, &ComponentProps::new(), &props).unwrap();
    assert_eq!(adapter.nodes.get(&div.id).unwrap().text, "");

    let throwing_html =
        Function::new_no_args("return new Proxy({}, { get(){ throw new Error('html failed') } })")
            .call0(&JsValue::UNDEFINED)
            .unwrap();
    let props = prop_map(&[("dangerouslySetInnerHTML", throwing_html)]);
    let err = patch_props(&mut adapter, &mut div, &ComponentProps::new(), &props)
        .expect_err("innerHTML Reflect::get errors should propagate");
    assert!(err.is_object());
}

#[wasm_bindgen_test]
fn patch_props_covers_style_error_event_add_without_old_and_new_reserved_props() {
    let mut adapter = TestAdapter::default();
    let mut div = adapter.create_element("div");

    let new_props = prop_map(&[
        ("onClick", handler()),
        ("key", JsValue::from_str("stable")),
        ("children", Array::new().into()),
    ]);
    patch_props(&mut adapter, &mut div, &ComponentProps::new(), &new_props).unwrap();
    assert!(
        adapter
            .events
            .iter()
            .any(|event| matches!(event, TestEvent::AddEvt(evt) if evt == "click"))
    );
    assert!(!adapter.events.iter().any(
        |event| matches!(event, TestEvent::RemoveAttr(key) if key == "key" || key == "children")
    ));

    let throwing_style = Function::new_no_args(
        "return new Proxy({}, { ownKeys(){ return ['color']; }, getOwnPropertyDescriptor(){ return { enumerable: true, configurable: true }; }, get(){ throw new Error('style failed') } })",
    )
    .call0(&JsValue::UNDEFINED)
    .unwrap();
    let style_props = prop_map(&[("style", throwing_style)]);
    let err = patch_props(&mut adapter, &mut div, &ComponentProps::new(), &style_props)
        .expect_err("style Reflect::get errors should propagate");
    assert!(err.is_object());
}

#[wasm_bindgen_test]
fn patch_props_sets_attributes_events_refs_and_dom_string_values() {
    let mut adapter = TestAdapter::default();
    let mut input = adapter.create_element("input");
    adapter.nodes.get_mut(&input.id).unwrap().has_value = true;

    let style = Object::new();
    Reflect::set(&style, &JsValue::from_str("width"), &JsValue::from_f64(12.0)).unwrap();
    Reflect::set(&style, &JsValue::from_str("opacity"), &JsValue::from_bool(true)).unwrap();
    let html = Object::new();
    Reflect::set(&html, &JsValue::from_str("__html"), &JsValue::from_str("<i>B</i>")).unwrap();

    let old_props = prop_map(&[("onInput", handler())]);
    let new_props = prop_map(&[
        ("onInput", handler()),
        ("className", JsValue::from_str("fresh")),
        ("style", style.into()),
        ("dangerouslySetInnerHTML", html.into()),
        ("value", JsValue::from_f64(5.0)),
        ("checked", JsValue::TRUE),
        ("disabled", JsValue::FALSE),
        ("ref", Object::new().into()),
        ("data-count", JsValue::from_f64(5.0)),
        ("aria-hidden", JsValue::from_bool(false)),
    ]);

    patch_props(&mut adapter, &mut input, &old_props, &new_props).unwrap();

    assert!(
        adapter.events.iter().any(|event| matches!(event, TestEvent::RmEvt(evt) if evt == "input"))
    );
    assert!(
        adapter
            .events
            .iter()
            .any(|event| matches!(event, TestEvent::AddEvt(evt) if evt == "input"))
    );
    assert!(
        adapter.events.iter().any(
            |event| matches!(event, TestEvent::SetValue(value) if value.as_f64() == Some(5.0))
        )
    );
    assert!(adapter.events.iter().any(|event| matches!(event, TestEvent::SetChecked(true))));
    assert!(adapter.events.iter().any(|event| matches!(event, TestEvent::SetDisabled(false))));
    assert!(adapter.events.iter().any(|event| matches!(event, TestEvent::ApplyRef(_))));
    assert_eq!(adapter.nodes.get(&input.id).unwrap().class, "fresh");
    assert_eq!(adapter.nodes.get(&input.id).unwrap().text, "<i>B</i>");
}

#[wasm_bindgen_test]
fn post_patch_element_resyncs_select_value_only_when_present() {
    let mut adapter = TestAdapter::default();
    let mut select = adapter.create_element("SELECT");

    post_patch_element(&mut adapter, &mut select, &ComponentProps::new()).unwrap();
    assert!(adapter.events.is_empty());

    let props = prop_map(&[("value", JsValue::from_str("selected"))]);
    post_patch_element(&mut adapter, &mut select, &props).unwrap();

    assert!(adapter.events.iter().any(|event| {
        matches!(event, TestEvent::SetValue(value) if value.as_string().as_deref() == Some("selected"))
    }));
}
