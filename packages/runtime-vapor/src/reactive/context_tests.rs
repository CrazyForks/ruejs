use super::*;
use crate::runtime::{ComponentInternalInstance, JsDomAdapter, LifecycleHooks};
use std::collections::HashMap;
use std::marker::PhantomData;
use wasm_bindgen_test::*;

fn clear_context_test_state(indices: &[usize]) {
    set_current_instance(JsValue::UNDEFINED);
    CI_WRAPPERS.with(|wr| {
        let mut map = wr.borrow_mut();
        for index in indices {
            map.remove(index);
        }
    });
}

fn make_component_instance(
    index: usize,
    host: JsValue,
    props_ro: JsValue,
) -> ComponentInternalInstance<JsDomAdapter> {
    ComponentInternalInstance::<JsDomAdapter> {
        parent: None,
        is_mounted: false,
        hooks: LifecycleHooks(HashMap::new()),
        props_ro,
        host,
        render_scope_id: None,
        error: None,
        error_handlers: Vec::new(),
        index,
        _marker: PhantomData,
    }
}

#[wasm_bindgen_test]
fn set_current_instance_ci_reuses_wrapper_and_prefers_owner_parent() {
    let index = 10_001;
    clear_context_test_state(&[index]);

    let host = Object::new();
    let owner_parent = Object::new();
    let direct_parent = Object::new();
    let props_ro = Object::new();
    Reflect::set(
        &host,
        &JsValue::from_str(CONTEXT_OWNER_PARENT_PROP),
        &owner_parent.clone().into(),
    )
    .unwrap();
    Reflect::set(
        &host,
        &JsValue::from_str(CONTEXT_PARENT_INSTANCE_PROP),
        &direct_parent.clone().into(),
    )
    .unwrap();

    let mut inst = make_component_instance(index, host.clone().into(), props_ro.clone().into());
    set_current_instance_ci(&mut inst);

    let wrapper = get_current_instance();
    let hooks = Reflect::get(&wrapper, &JsValue::from_str("__hooks")).unwrap();
    let states: Array =
        Reflect::get(&hooks, &JsValue::from_str("states")).unwrap().unchecked_into();
    states.set(0, JsValue::from_str("persisted"));
    Reflect::set(&hooks, &JsValue::from_str("index"), &JsValue::from_f64(5.0)).unwrap();

    let next_props_ro = Object::new();
    inst.props_ro = next_props_ro.clone().into();
    set_current_instance_ci(&mut inst);

    let wrapper_again = get_current_instance();
    assert!(js_sys::Object::is(&wrapper, &wrapper_again));
    assert!(js_sys::Object::is(
        &component_instance_wrapper(index).expect("wrapper should exist"),
        &wrapper_again,
    ));

    let wrapper_host =
        Reflect::get(&wrapper_again, &JsValue::from_str(CONTEXT_LINKED_INSTANCE_PROP)).unwrap();
    assert!(js_sys::Object::is(&wrapper_host, &host.clone().into()));

    let host_wrapper =
        Reflect::get(&host, &JsValue::from_str(CONTEXT_LINKED_INSTANCE_PROP)).unwrap();
    assert!(js_sys::Object::is(&host_wrapper, &wrapper_again));

    let resolved_owner_parent =
        Reflect::get(&wrapper_again, &JsValue::from_str(CONTEXT_OWNER_PARENT_PROP)).unwrap();
    assert!(js_sys::Object::is(&resolved_owner_parent, &owner_parent.clone().into(),));

    let resolved_direct_parent =
        Reflect::get(&wrapper_again, &JsValue::from_str(CONTEXT_PARENT_INSTANCE_PROP)).unwrap();
    assert!(js_sys::Object::is(&resolved_direct_parent, &owner_parent.clone().into(),));

    let stored_props = Reflect::get(&wrapper_again, &JsValue::from_str("propsRO")).unwrap();
    assert!(js_sys::Object::is(&stored_props, &next_props_ro.clone().into()));

    let hooks_again = Reflect::get(&wrapper_again, &JsValue::from_str("__hooks")).unwrap();
    assert_eq!(
        Reflect::get(&hooks_again, &JsValue::from_str("index")).unwrap().as_f64(),
        Some(0.0)
    );
    let states_again: Array =
        Reflect::get(&hooks_again, &JsValue::from_str("states")).unwrap().unchecked_into();
    assert_eq!(states_again.get(0).as_string().as_deref(), Some("persisted"));

    clear_context_test_state(&[index]);
}

#[wasm_bindgen_test]
fn set_current_instance_ci_falls_back_to_direct_parent_when_owner_parent_missing() {
    let index = 10_002;
    clear_context_test_state(&[index]);

    let host = Object::new();
    let direct_parent = Object::new();
    Reflect::set(
        &host,
        &JsValue::from_str(CONTEXT_PARENT_INSTANCE_PROP),
        &direct_parent.clone().into(),
    )
    .unwrap();

    let mut inst = make_component_instance(index, host.clone().into(), Object::new().into());
    set_current_instance_ci(&mut inst);

    let wrapper = get_current_instance();
    let resolved_owner_parent =
        Reflect::get(&wrapper, &JsValue::from_str(CONTEXT_OWNER_PARENT_PROP)).unwrap();
    let resolved_direct_parent =
        Reflect::get(&wrapper, &JsValue::from_str(CONTEXT_PARENT_INSTANCE_PROP)).unwrap();

    assert!(js_sys::Object::is(&resolved_owner_parent, &direct_parent.clone().into(),));
    assert!(js_sys::Object::is(&resolved_direct_parent, &direct_parent.clone().into(),));

    clear_context_test_state(&[index]);
}
