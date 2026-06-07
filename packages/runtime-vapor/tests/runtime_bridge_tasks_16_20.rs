use js_sys::{Array, Function, Object, Reflect};
use rue_runtime_vapor::createRue;
use wasm_bindgen::JsValue;
use wasm_bindgen_test::*;

mod common;

use common::{
    child_sequence, children_of, count_children_with_tag, first_child_text, first_child_with_tag,
    make_linked_adapter, make_vapor_only_adapter, setup_anchor, setup_range, tick, update_siblings,
};

fn obj_with_prop(key: &str, value: JsValue) -> Object {
    let obj = Object::new();
    Reflect::set(&obj, &JsValue::from_str(key), &value).unwrap();
    obj
}

#[wasm_bindgen_test(async)]
async fn render_static_bridge_mounts_default_handle_and_removes_anchor() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let (parent, anchor) = setup_anchor(&adapter);

    let setup = Function::new_no_args("return { tag: 'span', children: [] }");
    let handle = rue.vapor_wasm(setup.into());
    rue.render_static_wasm(handle, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    assert_eq!(child_sequence(&parent), vec!["span"]);
    assert!(!children_of(&parent).iter().any(|child| js_sys::Object::is(&child, &anchor)));
}

#[wasm_bindgen_test(async)]
async fn render_static_bridge_ignores_null_input_without_removing_anchor() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let (parent, anchor) = setup_anchor(&adapter);

    rue.render_static_wasm(JsValue::NULL, parent.clone(), anchor.clone());
    tick().await;

    let children = children_of(&parent);
    assert_eq!(children.length(), 1);
    assert!(js_sys::Object::is(&children.get(0), &anchor));
}

#[wasm_bindgen_test(async)]
async fn render_static_bridge_rejects_raw_host_node_on_default_surface() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let (parent, anchor) = setup_anchor(&adapter);

    let raw = Object::new();
    Reflect::set(&raw, &JsValue::from_str("tag"), &JsValue::from_str("span")).unwrap();
    Reflect::set(&raw, &JsValue::from_str("nodeType"), &JsValue::from_f64(1.0)).unwrap();
    Reflect::set(&raw, &JsValue::from_str("children"), &Array::new().into()).unwrap();

    rue.render_static_wasm(raw.into(), parent.clone(), anchor.clone());
    tick().await;

    let children = children_of(&parent);
    assert_eq!(children.length(), 1);
    assert!(js_sys::Object::is(&children.get(0), &anchor));
}

#[wasm_bindgen_test(async)]
async fn render_between_clears_cross_parent_nodes_before_inserting_new_range() {
    let adapter = make_vapor_only_adapter();
    let rue = createRue(adapter.clone());
    let (outer_parent, start, end) = setup_range(&adapter);
    let actual_parent = Object::new();
    Reflect::set(&actual_parent, &JsValue::from_str("tag"), &JsValue::from_str("actual")).unwrap();
    Reflect::set(&actual_parent, &JsValue::from_str("children"), &Array::new().into()).unwrap();

    Reflect::set(&end, &JsValue::from_str("parentNode"), &actual_parent).unwrap();
    let stale = Object::new();
    Reflect::set(&stale, &JsValue::from_str("tag"), &JsValue::from_str("stale")).unwrap();
    Reflect::set(&stale, &JsValue::from_str("children"), &Array::new().into()).unwrap();
    Reflect::set(&start, &JsValue::from_str("nextSibling"), &stale).unwrap();
    Reflect::set(&stale, &JsValue::from_str("nextSibling"), &end).unwrap();
    let actual_children = Array::new();
    actual_children.push(&start);
    actual_children.push(&stale);
    actual_children.push(&end);
    Reflect::set(&actual_parent, &JsValue::from_str("children"), &actual_children.into()).unwrap();

    let host = Object::new();
    Reflect::set(&host, &JsValue::from_str("tag"), &JsValue::from_str("span")).unwrap();
    Reflect::set(&host, &JsValue::from_str("children"), &Array::new().into()).unwrap();
    Reflect::set(&host, &JsValue::from_str("nodeType"), &JsValue::from_f64(1.0)).unwrap();
    let bridge = obj_with_prop("__rue_host_node", host.clone().into());

    rue.render_between_wasm(bridge.into(), outer_parent, start.clone(), end.clone());
    tick().await;

    let actual_sequence = child_sequence(&actual_parent.into());
    assert_eq!(actual_sequence, vec!["comment_start", "span", "comment_end"]);
}

#[wasm_bindgen_test(async)]
async fn same_component_update_can_reuse_identical_vapor_host_node() {
    let adapter = make_vapor_only_adapter();
    let rue = createRue(adapter.clone());
    let (parent, start, end) = setup_range(&adapter);

    let host = Object::new();
    Reflect::set(&host, &JsValue::from_str("tag"), &JsValue::from_str("span")).unwrap();
    Reflect::set(&host, &JsValue::from_str("children"), &Array::new().into()).unwrap();
    Reflect::set(&host, &JsValue::from_str("nodeType"), &JsValue::from_f64(1.0)).unwrap();
    let bridge = obj_with_prop("__rue_host_node", host.clone().into());
    Reflect::set(&js_sys::global(), &JsValue::from_str("__rue_same_host"), &bridge.into()).unwrap();

    let component = Function::new_no_args("return globalThis.__rue_same_host");
    let first = rue.create_component_wasm(component.clone().into(), JsValue::UNDEFINED);
    rue.render_between_wasm(first, parent.clone(), start.clone(), end.clone());
    tick().await;
    update_siblings(&parent);

    let second = rue.create_component_wasm(component.into(), JsValue::UNDEFINED);
    rue.render_between_wasm(second, parent.clone(), start, end);
    tick().await;

    let children = children_of(&parent);
    assert_eq!(children.length(), 3);
    assert_eq!(count_children_with_tag(&parent, "span"), 1);
    let span = first_child_with_tag(&parent, "span").unwrap();
    assert!(js_sys::Object::is(&span, &host));
}

#[wasm_bindgen_test(async)]
async fn same_component_props_update_replaces_vapor_host_text() {
    let adapter = make_vapor_only_adapter();
    let rue = createRue(adapter.clone());
    let (parent, start, end) = setup_range(&adapter);

    let component = Function::new_with_args(
        "props",
        "const text = { tag: '#text', text: props.label, nodeType: 3, children: [] }; \
         const el = { tag: 'span', children: [text], nodeType: 1 }; \
         text.parentNode = el; \
         el.contains = n => n === text || n === el; \
         return { __rue_host_node: el };",
    );

    let props_a = obj_with_prop("label", JsValue::from_str("A"));
    let first = rue.create_component_wasm(component.clone().into(), props_a.into());
    rue.render_between_wasm(first, parent.clone(), start.clone(), end.clone());
    tick().await;
    update_siblings(&parent);

    let props_b = obj_with_prop("label", JsValue::from_str("B"));
    let second = rue.create_component_wasm(component.into(), props_b.into());
    rue.render_between_wasm(second, parent.clone(), start, end);
    tick().await;
    update_siblings(&parent);

    assert_eq!(count_children_with_tag(&parent, "span"), 1);
    let span = first_child_with_tag(&parent, "span").unwrap();
    assert_eq!(first_child_text(&span), "B");
}
