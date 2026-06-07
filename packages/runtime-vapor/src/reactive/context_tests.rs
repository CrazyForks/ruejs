/*
上下文模块测试

覆盖当前组件实例、Hook 插槽、组件包装器等状态的核心边界。
这些测试偏向保护“调用顺序与实例归属”这类容易被重构破坏的运行时约定。
*/
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

#[wasm_bindgen_test]
fn hook_scope_helpers_create_dispose_and_ignore_non_object_instances() {
    clear_context_test_state(&[]);

    assert!(ensure_current_instance_hook_scope().is_none());
    dispose_hook_scope_for_instance(JsValue::from_str("not-an-object"));

    set_current_instance(JsValue::from_str("primitive-instance"));
    assert!(ensure_current_instance_hook_scope().is_none());
    let ran_without_scope = with_current_instance_hook_scope(|| {
        assert_eq!(crate::reactive::core::current_effect_scope(), None);
        "ran"
    });
    assert_eq!(ran_without_scope, "ran");

    let inst = Object::new();
    set_current_instance(inst.clone().into());
    let first = ensure_current_instance_hook_scope().expect("object instance gets hook scope");
    let second = ensure_current_instance_hook_scope().expect("existing hook scope is reused");
    assert_eq!(first, second);

    with_current_instance_hook_scope(|| {
        assert_eq!(crate::reactive::core::current_effect_scope(), Some(first));
    });
    assert_ne!(crate::reactive::core::current_effect_scope(), Some(first));

    dispose_hook_scope_for_instance(inst.clone().into());
    let stored = Reflect::get(&inst, &JsValue::from_str(HOOK_EFFECT_SCOPE_KEY)).unwrap();
    assert!(stored.is_undefined());
    set_current_instance(JsValue::UNDEFINED);
}

#[wasm_bindgen_test]
fn component_context_edges_cover_primitive_host_and_dispose_entries() {
    let primitive_host_index = 10_003;
    let wrapper_index = 10_004;
    let scoped_wrapper_index = 10_005;
    clear_context_test_state(&[primitive_host_index, wrapper_index, scoped_wrapper_index]);

    let mut primitive_host_inst = make_component_instance(
        primitive_host_index,
        JsValue::from_str("hostless"),
        Object::new().into(),
    );
    set_current_instance_ci(&mut primitive_host_inst);
    let wrapper = get_current_instance();
    assert!(
        Reflect::get(&wrapper, &JsValue::from_str(CONTEXT_OWNER_PARENT_PROP))
            .unwrap_or(JsValue::UNDEFINED)
            .is_undefined()
    );
    assert!(
        Reflect::get(&wrapper, &JsValue::from_str(CONTEXT_PARENT_INSTANCE_PROP))
            .unwrap_or(JsValue::UNDEFINED)
            .is_undefined()
    );

    CI_WRAPPERS.with(|wr| {
        wr.borrow_mut().insert(wrapper_index, JsValue::from_str("not-an-object"));
    });
    dispose_component_hook_scope(wrapper_index);

    let scoped_wrapper = Object::new();
    let scope_id = create_detached_effect_scope();
    Reflect::set(
        &scoped_wrapper,
        &JsValue::from_str(HOOK_EFFECT_SCOPE_KEY),
        &JsValue::from_f64(scope_id as f64),
    )
    .unwrap();
    CI_WRAPPERS.with(|wr| {
        wr.borrow_mut().insert(scoped_wrapper_index, scoped_wrapper.clone().into());
    });
    dispose_component_hook_scope(scoped_wrapper_index);
    assert!(
        Reflect::get(&scoped_wrapper, &JsValue::from_str(HOOK_EFFECT_SCOPE_KEY))
            .unwrap_or(JsValue::UNDEFINED)
            .is_undefined()
    );

    set_current_instance(JsValue::UNDEFINED);
    register_current_instance_render_triggered_hook(Function::new_no_args("return").into());

    clear_context_test_state(&[primitive_host_index, wrapper_index, scoped_wrapper_index]);
}

#[wasm_bindgen_test]
fn vapor_with_hook_id_reuses_array_slot_mapping_and_resets_forced_index() {
    let inst = Object::new();
    let hooks = Object::new();
    let states = Array::new();
    let id_map = Map::new();
    let slot_pair = Array::new();
    slot_pair.push(&JsValue::from_f64(0.0));
    id_map.set(&JsValue::from_str("stable"), &slot_pair.into());
    Reflect::set(&hooks, &JsValue::from_str("states"), &states).unwrap();
    Reflect::set(&hooks, &JsValue::from_str("index"), &JsValue::from_f64(0.0)).unwrap();
    Reflect::set(&hooks, &JsValue::from_str("__idMap"), &id_map).unwrap();
    Reflect::set(&inst, &JsValue::from_str("__hooks"), &hooks).unwrap();
    set_current_instance(inst.into());

    let first = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        with_hook_slot(Function::new_no_args("return 'first'"))
    }) as Box<dyn FnMut() -> JsValue>);
    let value =
        vapor_with_hook_id(JsValue::from_str("stable"), first.as_ref().clone().unchecked_into());
    assert_eq!(value.as_string().as_deref(), Some("first"));

    let forced = Reflect::get(&hooks, &JsValue::from_str("__forcedIndex")).unwrap();
    assert!(forced.is_undefined());

    let second = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        with_hook_slot(Function::new_no_args("return 'second'"))
    }) as Box<dyn FnMut() -> JsValue>);
    let reused =
        vapor_with_hook_id(JsValue::from_str("stable"), second.as_ref().clone().unchecked_into());
    assert_eq!(reused.as_string().as_deref(), Some("first"));
    first.forget();
    second.forget();
    set_current_instance(JsValue::UNDEFINED);
}
