/*
render input helper 测试

覆盖 props 枚举、非枚举 parent context 保留、compat children 归一化等转换细节。
这些规则影响组件上下文传递，回归成本较高，所以单独保护。
*/
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

#[wasm_bindgen_test]
fn assign_children_prop_handles_array_null_and_undefined_edges() {
    let mut props_map = ComponentProps::new();
    assign_children_prop(&mut props_map, &JsValue::NULL);
    assign_children_prop(&mut props_map, &JsValue::UNDEFINED);
    assert!(!props_map.contains_key("children"));

    let children = Array::new();
    children.push(&JsValue::from_str("a"));
    children.push(&JsValue::from_str("b"));
    assign_children_prop(&mut props_map, &children.clone().into());

    let stored = props_map.get("children").expect("array children should be stored");
    let stored_array = Array::from(stored);
    assert_eq!(stored_array.length(), 2);
    assert_eq!(stored_array.get(1).as_string().as_deref(), Some("b"));
}

#[cfg(feature = "compat")]
#[wasm_bindgen_test]
fn compat_helpers_cover_fragment_vapor_function_and_nested_children() {
    use crate::runtime::JsDomAdapter;

    let props = Object::new();
    let prop_children = Array::new();
    prop_children.push(&JsValue::from_str("from-props"));
    Reflect::set(&props, &JsValue::from_str("children"), &prop_children.clone().into()).unwrap();
    let props_map = props_from_value(&props.into());
    assert_eq!(
        Array::from(&effective_children(&Array::new().into(), &props_map))
            .get(0)
            .as_string()
            .as_deref(),
        Some("from-props"),
    );
    assert!(effective_children(&JsValue::NULL, &props_map).is_object());
    assert_eq!(
        effective_children(&JsValue::from_str("direct"), &props_map).as_string().as_deref(),
        Some("direct"),
    );

    let fragment =
        compat_type_to_input_type::<JsDomAdapter>(&JsValue::from_str(FRAGMENT), &props_map, None);
    assert!(matches!(fragment, Some(MountInputType::Fragment)));

    let setup_props = ComponentProps::from([(
        "setup".to_string(),
        Function::new_no_args("return { tag: 'vapor' }").into(),
    )]);
    let vapor =
        compat_type_to_input_type::<JsDomAdapter>(&JsValue::from_str("vapor"), &setup_props, None);
    assert!(matches!(vapor, Some(MountInputType::VaporWithSetup(_))));

    let fallback = compat_type_to_input_type::<JsDomAdapter>(
        &JsValue::from_f64(7.0),
        &props_map,
        Some("unknown"),
    );
    assert!(matches!(fallback, Some(MountInputType::Element(tag)) if tag == "unknown"));

    let nested = Array::new();
    nested.push(&JsValue::from_str("leaf"));
    let outer = Array::new();
    outer.push(&nested);
    outer.push(&JsValue::from_f64(9.0));
    let children = compat_children_from_value::<JsDomAdapter, _>(&outer.into(), |_value| None);
    assert_eq!(children.len(), 2);
}

#[cfg(feature = "compat")]
#[wasm_bindgen_test]
fn compat_helpers_cover_remaining_type_and_child_edges() {
    use crate::runtime::JsDomAdapter;

    let parent_props = Object::new();
    let parent = Object::new();
    Reflect::set(
        &parent_props,
        &JsValue::from_str(CONTEXT_PARENT_INSTANCE_PROP),
        &parent.clone().into(),
    )
    .unwrap();
    let props_map = props_from_value(&parent_props.into());
    assert!(js_sys::Object::is(
        props_map.get(CONTEXT_PARENT_INSTANCE_PROP).unwrap(),
        &parent.into(),
    ));

    let mut child_props = ComponentProps::new();
    assign_children_prop(&mut child_props, &JsValue::from_str("single"));
    assert_eq!(
        Array::from(child_props.get("children").unwrap()).get(0).as_string().as_deref(),
        Some("single"),
    );

    let empty_props = ComponentProps::new();
    assert!(effective_children(&JsValue::UNDEFINED, &empty_props).is_undefined());
    assert_eq!(
        effective_children(&JsValue::from_str("literal"), &empty_props).as_string().as_deref(),
        Some("literal"),
    );

    let no_setup =
        compat_type_to_input_type::<JsDomAdapter>(&JsValue::from_str("vapor"), &empty_props, None);
    assert!(matches!(no_setup, Some(MountInputType::Vapor)));

    let non_function_setup =
        ComponentProps::from([("setup".to_string(), JsValue::from_str("not-a-function"))]);
    let vapor_no_function = compat_type_to_input_type::<JsDomAdapter>(
        &JsValue::from_str("vapor"),
        &non_function_setup,
        None,
    );
    assert!(matches!(vapor_no_function, Some(MountInputType::Vapor)));

    let component_fn = Function::new_no_args("return null");
    let component_type =
        compat_type_to_input_type::<JsDomAdapter>(&component_fn.clone().into(), &empty_props, None);
    assert!(matches!(component_type, Some(MountInputType::Component(_))));
    assert!(
        compat_type_to_input_type::<JsDomAdapter>(&JsValue::from_f64(1.0), &empty_props, None,)
            .is_none()
    );

    let invalid_input = compat_input_from_values::<JsDomAdapter, _>(
        &JsValue::from_f64(1.0),
        &JsValue::UNDEFINED,
        &JsValue::UNDEFINED,
        None,
        |_children| Vec::new(),
    );
    assert!(invalid_input.is_none());

    let object_child = Object::new();
    Reflect::set(&object_child, &JsValue::from_str("type"), &JsValue::from_str("span")).unwrap();
    Reflect::set(&object_child, &JsValue::from_str("props"), &Object::new()).unwrap();
    let nested = Array::new();
    nested.push(&object_child.clone().into());
    nested.push(&JsValue::TRUE);
    nested.push(&JsValue::from_f64(3.0));
    let children = compat_children_from_value::<JsDomAdapter, _>(&nested.into(), |value| {
        compat_object_to_input::<JsDomAdapter, _, _>(
            value,
            None,
            |type_value| type_value.as_string().is_some(),
            |_children| Vec::new(),
        )
    });
    assert!(matches!(children.get(0), Some(MountInputChild::Input(_))));
    assert!(matches!(children.get(1), Some(MountInputChild::Text(text)) if text == "3"));

    assert!(
        compat_object_to_input::<JsDomAdapter, _, _>(
            &JsValue::from_str("not-object"),
            None,
            |_| true,
            |_children| Vec::new(),
        )
        .is_none()
    );
    assert!(
        compat_object_to_input::<JsDomAdapter, _, _>(
            &Object::new().into(),
            None,
            |_| true,
            |_children| Vec::new(),
        )
        .is_none()
    );
    let rejected = Object::new();
    Reflect::set(&rejected, &JsValue::from_str("type"), &JsValue::from_str("blocked")).unwrap();
    assert!(
        compat_object_to_input::<JsDomAdapter, _, _>(
            &rejected.into(),
            None,
            |_| false,
            |_children| Vec::new(),
        )
        .is_none()
    );
}

#[wasm_bindgen_test]
fn assign_children_prop_handles_arrays_and_nullish_values() {
    let mut props_map = ComponentProps::new();
    let children = Array::new();
    children.push(&JsValue::from_str("a"));
    children.push(&JsValue::from_str("b"));
    assign_children_prop(&mut props_map, &children.clone().into());
    let stored = props_map.get("children").expect("array children should be stored");
    assert_eq!(Array::from(stored).length(), 2);

    let mut empty_props = ComponentProps::new();
    assign_children_prop(&mut empty_props, &JsValue::NULL);
    assert!(!empty_props.contains_key("children"));
    assign_children_prop(&mut empty_props, &JsValue::UNDEFINED);
    assert!(!empty_props.contains_key("children"));
}

#[wasm_bindgen_test]
fn props_helpers_ignore_non_objects_and_wrap_boolean_children() {
    assert!(props_from_value(&JsValue::from_str("not-props")).is_empty());

    let props_map = props_with_children(&JsValue::NULL, &JsValue::TRUE);
    let children = Array::from(props_map.get("children").expect("boolean child is wrapped"));
    assert_eq!(children.length(), 1);
    assert_eq!(children.get(0).as_bool(), Some(true));
}

#[cfg(feature = "compat")]
#[wasm_bindgen_test]
fn compat_object_to_input_attaches_mount_metadata_and_ignores_bool_children() {
    use crate::runtime::JsDomAdapter;

    let vnode = Object::new();
    Reflect::set(&vnode, &JsValue::from_str("type"), &JsValue::from_str("span")).unwrap();
    Reflect::set(&vnode, &JsValue::from_str("props"), &Object::new()).unwrap();
    Reflect::set(&vnode, &JsValue::from_str("children"), &JsValue::TRUE).unwrap();
    Reflect::set(&vnode, &JsValue::from_str("key"), &JsValue::from_f64(7.0)).unwrap();
    Reflect::set(&vnode, &JsValue::from_str("__rue_cleanup_bucket"), &Array::new().into()).unwrap();

    let input = compat_object_to_input::<JsDomAdapter, _, _>(
        &vnode.into(),
        None,
        |type_value| type_value.as_string().is_some(),
        |children| compat_children_from_value::<JsDomAdapter, _>(children, |_| None),
    )
    .expect("compat vnode should normalize");

    assert_eq!(input.key.as_deref(), Some("7"));
    assert!(input.children.is_empty());
    assert!(input.mount_cleanup_bucket.is_some());
}

#[cfg(feature = "compat")]
#[wasm_bindgen_test]
fn compat_helpers_flatten_children_and_fallback_unknown_types() {
    use crate::runtime::JsDomAdapter;
    use crate::runtime::types::{MountInputChild, MountInputType};
    use js_sys::Function;

    let props = Object::new();
    let prop_children = Array::new();
    prop_children.push(&JsValue::from_str("from-props"));
    Reflect::set(&props, &JsValue::from_str("children"), &prop_children.clone().into()).unwrap();

    let props_map = props_from_value(&props.clone().into());
    let effective = effective_children(&Array::new().into(), &props_map);
    assert!(js_sys::Object::is(&effective, &prop_children.into()));

    let fallback = compat_type_to_input_type::<JsDomAdapter>(
        &JsValue::from_f64(7.0),
        &ComponentProps::new(),
        Some("fallback-node"),
    )
    .expect("unknown type should use fallback element");
    assert!(matches!(fallback, MountInputType::Element(tag) if tag == "fallback-node"));

    let component_type = Function::new_no_args("return null");
    let component_input = compat_type_to_input_type::<JsDomAdapter>(
        &component_type.into(),
        &ComponentProps::new(),
        None,
    );
    assert!(matches!(component_input, Some(MountInputType::Component(_))));

    let nested = Array::new();
    nested.push(&JsValue::from_str("text"));
    nested.push(&JsValue::from_f64(4.0));
    let inner = Array::new();
    inner.push(&JsValue::from_str("inner"));
    nested.push(&inner.into());

    let children = compat_children_from_value::<JsDomAdapter, _>(&nested.into(), |_| None);
    let text_values: Vec<String> = children
        .into_iter()
        .filter_map(|child| match child {
            MountInputChild::Text(text) => Some(text),
            MountInputChild::Input(_) => None,
        })
        .collect();
    assert_eq!(text_values, vec!["text", "4", "inner"]);
}

#[cfg(feature = "compat")]
#[wasm_bindgen_test]
fn compat_helpers_keep_empty_array_without_props_children_and_drop_unknown_object_child() {
    use crate::runtime::JsDomAdapter;

    let empty_props = ComponentProps::new();
    let empty_children = Array::new();
    let effective = effective_children(&empty_children.clone().into(), &empty_props);
    assert!(js_sys::Object::is(&effective, &empty_children.into()));

    let unknown_object = Object::new();
    Reflect::set(&unknown_object, &JsValue::from_str("type"), &JsValue::from_str("blocked"))
        .unwrap();
    let children = Array::new();
    children.push(&unknown_object.into());
    children.push(&JsValue::from_str("kept"));

    let normalized = compat_children_from_value::<JsDomAdapter, _>(&children.into(), |_value| None);
    assert_eq!(normalized.len(), 1);
    assert!(matches!(normalized.first(), Some(MountInputChild::Text(text)) if text == "kept"));
}
