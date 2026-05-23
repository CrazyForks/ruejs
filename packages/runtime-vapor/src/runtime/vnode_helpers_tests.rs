use super::*;
use wasm_bindgen_test::*;

fn define_non_enumerable_parent(props: &Object, parent: &Object) {
    let descriptor = Object::new();
    Reflect::set(&descriptor, &JsValue::from_str("value"), &parent.clone().into()).unwrap();
    Reflect::set(&descriptor, &JsValue::from_str("configurable"), &JsValue::TRUE).unwrap();
    Reflect::set(&descriptor, &JsValue::from_str("enumerable"), &JsValue::FALSE).unwrap();
    Reflect::set(&descriptor, &JsValue::from_str("writable"), &JsValue::TRUE).unwrap();
    Object::define_property(props, &JsValue::from_str(CONTEXT_PARENT_INSTANCE_PROP), &descriptor);
}

#[wasm_bindgen_test]
fn props_from_value_preserves_non_enumerable_context_parent_instance() {
    let props = Object::new();
    let parent = Object::new();
    Reflect::set(&props, &JsValue::from_str("className"), &JsValue::from_str("demo")).unwrap();
    define_non_enumerable_parent(&props, &parent);

    let keys = Object::keys(&props);
    assert_eq!(keys.length(), 1);
    assert_eq!(keys.get(0).as_string().as_deref(), Some("className"));

    let props_map = props_from_value(&props.clone().into());
    assert_eq!(
        props_map.get("className").and_then(|value| value.as_string()).as_deref(),
        Some("demo"),
    );
    let stored_parent = props_map
        .get(CONTEXT_PARENT_INSTANCE_PROP)
        .cloned()
        .expect("context parent should be preserved");
    assert!(js_sys::Object::is(&stored_parent, &parent.clone().into()));
}

#[wasm_bindgen_test]
fn props_with_children_preserves_context_parent_and_wraps_single_child() {
    let props = Object::new();
    let parent = Object::new();
    define_non_enumerable_parent(&props, &parent);

    let props_map = props_with_children(&props.into(), &JsValue::from_str("child"));
    let stored_parent = props_map
        .get(CONTEXT_PARENT_INSTANCE_PROP)
        .cloned()
        .expect("context parent should be preserved");
    assert!(js_sys::Object::is(&stored_parent, &parent.clone().into()));

    let children = props_map.get("children").cloned().expect("children should be assigned");
    let children_array = Array::from(&children);
    assert_eq!(children_array.length(), 1);
    assert_eq!(children_array.get(0).as_string().as_deref(), Some("child"));
}
