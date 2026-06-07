use js_sys::{Array, Function, Object, Reflect};
use rue_runtime_vapor::{
    computed_js, create_effect, createRue, set_current_instance, set_reactive_scheduling,
};
use wasm_bindgen::JsValue;
use wasm_bindgen_test::*;

mod common;

use common::{
    child_sequence, children_of, first_child_text, first_child_with_tag, make_linked_adapter,
    make_vapor_only_adapter, setup_anchor, setup_container, setup_range, tick, update_siblings,
};

// runtime bridge 21-30 任务覆盖：集中验证 hook 复用、computed 刷新和组件实例桥接行为。

fn set_prop(target: &Object, key: &str, value: &JsValue) {
    Reflect::set(target, &JsValue::from_str(key), value).unwrap();
}

fn host_node(tag: &str) -> Object {
    let host = Object::new();
    set_prop(&host, "tag", &JsValue::from_str(tag));
    set_prop(&host, "children", &Array::new().into());
    set_prop(&host, "nodeType", &JsValue::from_f64(1.0));
    host
}

fn host_bridge(host: &Object) -> Object {
    let bridge = Object::new();
    set_prop(&bridge, "__rue_host_node", &JsValue::from(host.clone()));
    bridge
}

fn mount_id(handle: &JsValue) -> JsValue {
    Reflect::get(handle, &JsValue::from_str("__rue_mount_id")).unwrap()
}

fn reset_hook_index(instance: &Object) {
    let hooks = Reflect::get(instance, &JsValue::from_str("__hooks")).unwrap();
    Reflect::set(&hooks, &JsValue::from_str("index"), &JsValue::from_f64(0.0)).unwrap();
}

#[wasm_bindgen_test]
fn vapor_bridge_creates_plain_vapor_handle_for_non_function_input() {
    let adapter = make_vapor_only_adapter();
    let rue = createRue(adapter);

    let handle = rue.vapor_wasm(JsValue::UNDEFINED);

    assert!(handle.is_object());
    assert!(mount_id(&handle).as_f64().is_some());
}

#[wasm_bindgen_test]
fn create_component_non_function_falls_back_to_element_handle_in_compat() {
    let adapter = make_vapor_only_adapter();
    let rue = createRue(adapter);

    let handle = rue.create_component_wasm(JsValue::from_str("section"), JsValue::UNDEFINED);

    assert!(handle.is_object());
    assert!(mount_id(&handle).as_f64().is_some());
}

#[wasm_bindgen_test(async)]
async fn default_mount_handle_accepts_number_and_string_forms() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let div =
        rue.create_element_wasm(JsValue::from_str("div"), JsValue::UNDEFINED, Array::new().into());
    rue.render_wasm(mount_id(&div), container.clone());
    tick().await;

    let span =
        rue.create_element_wasm(JsValue::from_str("span"), JsValue::UNDEFINED, Array::new().into());
    let span_id = mount_id(&span).as_f64().unwrap().to_string();
    rue.render_wasm(JsValue::from_str(&span_id), container.clone());
    tick().await;

    assert_eq!(child_sequence(&container), vec!["span"]);
}

#[wasm_bindgen_test(async)]
async fn default_surface_accepts_portable_component_and_props() {
    let adapter = make_vapor_only_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let component = Function::new_with_args(
        "props",
        "const text = { tag: '#text', text: props.label, children: [], nodeType: 3 }; \
         const el = { tag: 'span', children: [text], nodeType: 1 }; \
         text.parentNode = el; \
         return { __rue_host_node: el };",
    );
    let props = Object::new();
    set_prop(&props, "label", &JsValue::from_str("portable"));
    let portable = Object::new();
    set_prop(&portable, "__rue_component_type", &component.into());
    set_prop(&portable, "props", &props.into());

    rue.render_wasm(portable.into(), container.clone());
    tick().await;

    let span = first_child_with_tag(&container, "span").unwrap();
    assert_eq!(first_child_text(&span), "portable");
}

#[wasm_bindgen_test(async)]
async fn portable_vapor_setup_accepts_bridge_and_raw_host_returns() {
    let adapter = make_vapor_only_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let bridge_setup = Function::new_no_args(
        "const host = { tag: 'section', children: [], nodeType: 1 }; \
         return { __rue_host_node: host };",
    );
    let portable_bridge = Object::new();
    set_prop(&portable_bridge, "__rue_vapor_setup", &bridge_setup.into());
    rue.render_wasm(portable_bridge.into(), container.clone());
    tick().await;

    let raw_setup = Function::new_no_args("return { tag: 'article', children: [], nodeType: 1 }");
    let portable_raw = Object::new();
    set_prop(&portable_raw, "__rue_vapor_setup", &raw_setup.into());
    rue.render_wasm(portable_raw.into(), container.clone());
    tick().await;

    assert_eq!(child_sequence(&container), vec!["article"]);
}

#[wasm_bindgen_test(async)]
async fn host_node_bridge_fragment_records_children_and_renders_them() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let fragment = Object::new();
    set_prop(&fragment, "tag", &JsValue::from_str("fragment"));
    set_prop(&fragment, "nodeType", &JsValue::from_f64(11.0));
    let children = Array::new();
    children.push(&host_node("i").into());
    children.push(&host_node("b").into());
    set_prop(&fragment, "children", &children.into());
    let bridge = host_bridge(&fragment);

    rue.render_wasm(bridge.into(), container.clone());
    tick().await;

    assert_eq!(child_sequence(&container), vec!["i", "b"]);
    let frag_nodes = Reflect::get(&fragment, &JsValue::from_str("__rue_frag_nodes_ref"))
        .unwrap_or(JsValue::UNDEFINED);
    assert!(Array::is_array(&frag_nodes));
}

#[wasm_bindgen_test(async)]
async fn render_between_replaces_vapor_blocks_and_clears_null_input() {
    let adapter = make_vapor_only_adapter();
    let rue = createRue(adapter.clone());
    let (parent, start, end) = setup_range(&adapter);

    let first = rue.vapor_wasm(
        Function::new_no_args("return { tag: 'one', children: [], nodeType: 1 }").into(),
    );
    rue.render_between_wasm(first, parent.clone(), start.clone(), end.clone());
    tick().await;
    update_siblings(&parent);

    let second = rue.vapor_wasm(
        Function::new_no_args("return { tag: 'two', children: [], nodeType: 1 }").into(),
    );
    rue.render_between_wasm(second, parent.clone(), start.clone(), end.clone());
    tick().await;
    update_siblings(&parent);

    assert_eq!(child_sequence(&parent), vec!["comment_start", "two", "comment_end"]);

    rue.render_between_wasm(JsValue::NULL, parent.clone(), start, end);
    tick().await;
    update_siblings(&parent);

    assert_eq!(child_sequence(&parent), vec!["comment_start", "comment_end"]);
}

#[wasm_bindgen_test(async)]
async fn render_anchor_mounts_fragment_and_clears_on_null_input() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let (parent, anchor) = setup_anchor(&adapter);

    let fragment = Object::new();
    set_prop(&fragment, "tag", &JsValue::from_str("fragment"));
    set_prop(&fragment, "nodeType", &JsValue::from_f64(11.0));
    let children = Array::new();
    children.push(&host_node("em").into());
    children.push(&host_node("strong").into());
    set_prop(&fragment, "children", &children.into());

    rue.render_anchor_wasm(host_bridge(&fragment).into(), parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    assert_eq!(child_sequence(&parent), vec!["em", "strong", "comment_anchor"]);

    rue.render_anchor_wasm(JsValue::NULL, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    assert_eq!(child_sequence(&parent), vec!["comment_anchor"]);
}

#[wasm_bindgen_test(async)]
async fn render_container_clears_existing_mount_on_null_input() {
    let adapter = make_vapor_only_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);
    let host = host_node("main");

    rue.render_wasm(host_bridge(&host).into(), container.clone());
    tick().await;
    assert_eq!(child_sequence(&container), vec!["main"]);

    rue.render_wasm(JsValue::NULL, container.clone());
    tick().await;
    assert_eq!(children_of(&container).length(), 0);
}

#[wasm_bindgen_test(async)]
async fn component_render_error_restores_context_and_reports_error() {
    let adapter = make_vapor_only_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);
    let errors = Array::new();
    let errors_for_handler = errors.clone();
    let on_error = wasm_bindgen::closure::Closure::wrap(Box::new(move |err: JsValue| {
        errors_for_handler.push(&err);
    }) as Box<dyn FnMut(JsValue)>);
    rue.on_error(on_error.as_ref().clone().into());
    on_error.forget();

    let component = Function::new_no_args("throw new Error('boom from component')");
    let handle = rue.create_component_wasm(component.into(), JsValue::UNDEFINED);
    rue.render_wasm(handle, container.clone());
    tick().await;

    assert_eq!(errors.length(), 1);
    assert_eq!(children_of(&container).length(), 0);
}

#[wasm_bindgen_test]
fn computed_hook_writable_slot_refreshes_getter_and_setter() {
    set_reactive_scheduling("sync");
    let instance = Object::new();
    set_current_instance(instance.clone().into());

    let state = Object::new();
    set_prop(&state, "value", &JsValue::from_f64(1.0));

    let options_one = Object::new();
    let state_for_get_one = state.clone();
    let getter_one = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        Reflect::get(&state_for_get_one, &JsValue::from_str("value")).unwrap()
    }) as Box<dyn FnMut() -> JsValue>);
    set_prop(&options_one, "get", &getter_one.as_ref().clone().into());
    let state_for_set_one = state.clone();
    let setter_one = wasm_bindgen::closure::Closure::wrap(Box::new(move |value: JsValue| {
        let _ = Reflect::set(&state_for_set_one, &JsValue::from_str("value"), &value);
    }) as Box<dyn FnMut(JsValue)>);
    set_prop(&options_one, "set", &setter_one.as_ref().clone().into());

    let computed_one = computed_js(options_one.into(), None);
    assert_eq!(computed_one.get_js().as_f64(), Some(1.0));
    computed_one.set_js(JsValue::from_f64(2.0));
    assert_eq!(Reflect::get(&state, &JsValue::from_str("value")).unwrap().as_f64(), Some(2.0));

    reset_hook_index(&instance);
    let options_two = Object::new();
    let state_for_get_two = state.clone();
    let getter_two = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        let value = Reflect::get(&state_for_get_two, &JsValue::from_str("value"))
            .unwrap()
            .as_f64()
            .unwrap();
        JsValue::from_f64(value + 10.0)
    }) as Box<dyn FnMut() -> JsValue>);
    set_prop(&options_two, "get", &getter_two.as_ref().clone().into());
    let state_for_set_two = state.clone();
    let setter_two = wasm_bindgen::closure::Closure::wrap(Box::new(move |value: JsValue| {
        let value = value.as_f64().unwrap() - 10.0;
        let _ = Reflect::set(
            &state_for_set_two,
            &JsValue::from_str("value"),
            &JsValue::from_f64(value),
        );
    }) as Box<dyn FnMut(JsValue)>);
    set_prop(&options_two, "set", &setter_two.as_ref().clone().into());

    let computed_two = computed_js(options_two.into(), None);
    assert_eq!(computed_two.get_js().as_f64(), Some(12.0));
    computed_two.set_js(JsValue::from_f64(25.0));
    assert_eq!(Reflect::get(&state, &JsValue::from_str("value")).unwrap().as_f64(), Some(15.0));

    getter_one.forget();
    setter_one.forget();
    getter_two.forget();
    setter_two.forget();
}

#[wasm_bindgen_test]
fn computed_hook_refresh_handles_missing_getter_and_setter_after_reuse() {
    set_reactive_scheduling("sync");
    let instance = Object::new();
    set_current_instance(instance.clone().into());

    let hits = Array::new();
    let options_one = Object::new();
    set_prop(&options_one, "get", &Function::new_no_args("return 'initial'").into());
    set_prop(
        &options_one,
        "set",
        &Function::new_with_args("value", "globalThis.__plan999_computed_set = value").into(),
    );
    let computed_one = computed_js(options_one.into(), None);

    let hits_for_effect = hits.clone();
    let computed_for_effect = computed_one.clone();
    let effect = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        hits_for_effect.push(&computed_for_effect.get_js());
    }) as Box<dyn FnMut()>);
    create_effect(effect.as_ref().clone().into(), None);
    assert_eq!(hits.get(0).as_string().as_deref(), Some("initial"));

    reset_hook_index(&instance);
    let options_two = Object::new();
    let computed_two = computed_js(options_two.into(), None);
    assert!(computed_two.get_js().is_undefined());

    computed_two.set_js(JsValue::from_str("ignored"));
    assert!(
        Reflect::get(&js_sys::global(), &JsValue::from_str("__plan999_computed_set"),)
            .unwrap_or(JsValue::UNDEFINED)
            .is_undefined()
    );
    assert!(hits.iter().any(|value| value.is_undefined()));

    effect.forget();
}

#[wasm_bindgen_test]
fn computed_hook_force_global_handles_primitive_arg() {
    let computed = computed_js(JsValue::from_f64(7.0), Some(true));
    assert!(computed.get_js().is_undefined());
}
