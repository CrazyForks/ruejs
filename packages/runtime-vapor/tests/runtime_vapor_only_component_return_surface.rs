use js_sys::{Array, Function, Object, Reflect};
use rue_runtime_vapor::{coverage_touch_real_dom_component_edges, createRue};
use std::rc::Rc;
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use wasm_bindgen::closure::Closure;
use wasm_bindgen_test::*;
mod common;

use common::{child_sequence, children_of, make_vapor_only_adapter as make_adapter, tick};

#[wasm_bindgen_test]
fn real_dom_component_internal_edges_are_reachable_for_coverage() {
    assert!(coverage_touch_real_dom_component_edges());
}

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
async fn vapor_only_create_component_accepts_primitive_return_as_host_value() {
    let adapter = make_adapter();
    let rue = createRue(adapter);
    let container = Object::new();

    let render_fn = Function::new_no_args("return 'primitive-host'");
    let handle = rue.create_component_wasm(render_fn.into(), JsValue::UNDEFINED);
    rue.render_wasm(handle, container.clone().into());
    tick().await;

    let children = children_of(&container.clone().into());
    assert_eq!(children.length(), 1);
    assert_eq!(children.get(0).as_string().as_deref(), Some("primitive-host"));
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

#[wasm_bindgen_test(async)]
async fn vapor_only_component_passes_props_children_and_mounts_nested_component_return() {
    let adapter = make_adapter();
    let rue = createRue(adapter);
    let container = Object::new();

    let child = Function::new_with_args(
        "props",
        "return { type: 'span', props: { title: props.prefix }, children: [props.prefix + ':' + (Array.isArray(props.children) ? props.children[0] : props.children)] }",
    );
    Reflect::set(&js_sys::global(), &JsValue::from_str("__rue_task23_child_component"), &child)
        .unwrap();

    let parent = Function::new_with_args(
        "props",
        "return { type: globalThis.__rue_task23_child_component, props: { prefix: props.label }, children: [Array.isArray(props.children) ? props.children[0] : props.children] }",
    );
    let props = Object::new();
    Reflect::set(&props, &JsValue::from_str("label"), &JsValue::from_str("outer")).unwrap();
    let handle = rue.create_element_wasm(
        parent.into(),
        props.into(),
        Array::of1(&JsValue::from_str("kid")).into(),
    );

    rue.render_wasm(handle, container.clone().into());
    tick().await;

    let children = children_of(&container.clone().into());
    assert_eq!(children.length(), 1);
    let span = children.get(0);
    assert_eq!(
        Reflect::get(&span, &JsValue::from_str("tag")).unwrap().as_string().as_deref(),
        Some("span"),
    );
    assert_eq!(child_sequence(&span), vec!["outer:kid"]);

    Reflect::delete_property(&js_sys::global(), &JsValue::from_str("__rue_task23_child_component"))
        .unwrap();
}

#[wasm_bindgen_test(async)]
async fn vapor_only_component_lifecycle_hooks_run_through_mount_and_unmount() {
    let adapter = make_adapter();
    let rue = Rc::new(createRue(adapter));
    let container = Object::new();
    let calls = Array::new();
    Reflect::set(&js_sys::global(), &JsValue::from_str("__rue_task23_lifecycle_calls"), &calls)
        .unwrap();

    let rue_for_component = rue.clone();
    let component = Closure::wrap(Box::new(move |_props: JsValue| -> JsValue {
        rue_for_component.on_before_mount(
            Function::new_no_args("globalThis.__rue_task23_lifecycle_calls.push('before_mount')")
                .into(),
        );
        rue_for_component.on_mounted(
            Function::new_no_args("globalThis.__rue_task23_lifecycle_calls.push('mounted')").into(),
        );
        rue_for_component.on_before_unmount(
            Function::new_no_args("globalThis.__rue_task23_lifecycle_calls.push('before_unmount')")
                .into(),
        );
        rue_for_component.on_unmounted(
            Function::new_no_args("globalThis.__rue_task23_lifecycle_calls.push('unmounted')")
                .into(),
        );

        let host = Object::new();
        Reflect::set(&host, &JsValue::from_str("tag"), &JsValue::from_str("article")).unwrap();
        Reflect::set(&host, &JsValue::from_str("children"), &Array::new().into()).unwrap();
        Reflect::set(&host, &JsValue::from_str("nodeType"), &JsValue::from_f64(1.0)).unwrap();
        let bridge = Object::new();
        Reflect::set(&bridge, &JsValue::from_str("__rue_host_node"), &host).unwrap();
        bridge.into()
    }) as Box<dyn FnMut(JsValue) -> JsValue>);

    let component_fn: Function = component.as_ref().clone().unchecked_into();
    let handle = rue.create_component_wasm(component_fn.into(), JsValue::UNDEFINED);
    rue.render_wasm(handle, container.clone().into());
    tick().await;
    rue.unmount_wasm(container.clone().into());
    tick().await;

    let recorded =
        Reflect::get(&js_sys::global(), &JsValue::from_str("__rue_task23_lifecycle_calls"))
            .unwrap()
            .unchecked_into::<Array>();
    let values = recorded.iter().filter_map(|value| value.as_string()).collect::<Vec<_>>();

    for expected in ["before_mount", "mounted", "before_unmount", "unmounted"] {
        assert!(values.iter().any(|value| value == expected), "missing {expected}");
    }

    component.forget();
    Reflect::delete_property(&js_sys::global(), &JsValue::from_str("__rue_task23_lifecycle_calls"))
        .unwrap();
}

#[wasm_bindgen_test(async)]
async fn vapor_only_component_null_return_keeps_container_empty() {
    let adapter = make_adapter();
    let rue = createRue(adapter);
    let container = Object::new();

    let render_fn = Function::new_no_args("return null");
    let handle = rue.create_component_wasm(render_fn.into(), JsValue::UNDEFINED);
    rue.render_wasm(handle, container.clone().into());
    tick().await;

    assert_eq!(children_of(&container.into()).length(), 0);
}
