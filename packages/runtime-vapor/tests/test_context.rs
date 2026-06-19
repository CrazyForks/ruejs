use js_sys::{Array, Function, Map, Object, Reflect};
use rue_runtime_vapor::reactive::context::coverage_touch_internal_edges;
use rue_runtime_vapor::reactive::context::dispose_hook_scope_for_instance;
use rue_runtime_vapor::{
    get_current_instance, set_current_instance, vapor_with_hook_id, with_hook_slot,
};
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use wasm_bindgen_test::*;

// 文件说明：
// 验证“当前实例”与“Hook 插槽”相关的上下文管理：
// - `with_hook_slot` 为当前实例分配/访问 Hook 的状态位
// - 支持强制插槽索引（`__forcedIndex`）并在调用后自动复位
// - `get_current_instance` 在无显式实例时返回“根实例结构”

#[wasm_bindgen_test]
fn with_hook_slot_allocates_and_forced_index_resets() {
    // 准备一个伪实例并设置为当前实例
    let inst = Object::new();
    set_current_instance(inst.clone().into());

    let a = wasm_bindgen::closure::Closure::wrap(
        Box::new(move || JsValue::from_str("A")) as Box<dyn FnMut() -> JsValue>
    );
    let af: Function = a.as_ref().clone().into();
    let s0 = with_hook_slot(af);
    a.forget();

    let b = wasm_bindgen::closure::Closure::wrap(
        Box::new(move || JsValue::from_str("B")) as Box<dyn FnMut() -> JsValue>
    );
    let bf: Function = b.as_ref().clone().into();
    let s1 = with_hook_slot(bf);
    b.forget();

    let cur = get_current_instance();
    let hooks = Reflect::get(&cur, &JsValue::from_str("__hooks")).unwrap();
    let states = Reflect::get(&hooks, &JsValue::from_str("states")).unwrap();
    let arr: Array = states.unchecked_into();
    assert_eq!(arr.get(0).as_string().unwrap(), s0.as_string().unwrap());
    assert_eq!(arr.get(1).as_string().unwrap(), s1.as_string().unwrap());

    // 强制使用插槽 0，并验证调用后会自动复位
    Reflect::set(&hooks, &JsValue::from_str("__forcedIndex"), &JsValue::from_f64(0.0)).unwrap();
    let c = wasm_bindgen::closure::Closure::wrap(
        Box::new(move || JsValue::from_str("C")) as Box<dyn FnMut() -> JsValue>
    );
    let cf: Function = c.as_ref().clone().into();
    let s_forced = with_hook_slot(cf);
    c.forget();

    let states2: Array =
        Reflect::get(&hooks, &JsValue::from_str("states")).unwrap().unchecked_into();
    assert_eq!(states2.get(0).as_string().unwrap(), s_forced.as_string().unwrap());
    let forced = Reflect::get(&hooks, &JsValue::from_str("__forcedIndex")).unwrap();
    assert!(forced.is_undefined());
}

#[wasm_bindgen_test]
fn get_current_instance_returns_undefined_when_cleared() {
    set_current_instance(JsValue::UNDEFINED);
    let cur = get_current_instance();
    assert!(cur.is_undefined() || cur.is_null());
}

#[wasm_bindgen_test]
fn with_hook_slot_reuses_existing_slot_when_index_is_rewound() {
    let inst = Object::new();
    set_current_instance(inst.clone().into());

    let first = wasm_bindgen::closure::Closure::wrap(
        Box::new(move || JsValue::from_str("A")) as Box<dyn FnMut() -> JsValue>
    );
    let first_fn: Function = first.as_ref().clone().into();
    let initial = with_hook_slot(first_fn);
    first.forget();

    let cur = get_current_instance();
    let hooks = Reflect::get(&cur, &JsValue::from_str("__hooks")).unwrap();
    Reflect::set(&hooks, &JsValue::from_str("index"), &JsValue::from_f64(0.0)).unwrap();

    let second = wasm_bindgen::closure::Closure::wrap(
        Box::new(move || JsValue::from_str("B")) as Box<dyn FnMut() -> JsValue>
    );
    let second_fn: Function = second.as_ref().clone().into();
    let reused = with_hook_slot(second_fn);
    second.forget();

    let states: Array =
        Reflect::get(&hooks, &JsValue::from_str("states")).unwrap().unchecked_into();
    assert_eq!(initial.as_string().as_deref(), Some("A"));
    assert_eq!(reused.as_string().as_deref(), Some("A"));
    assert_eq!(states.length(), 1);
    assert_eq!(states.get(0).as_string().as_deref(), Some("A"));
}

#[wasm_bindgen_test]
fn public_context_helpers_cover_no_instance_and_non_object_paths() {
    set_current_instance(JsValue::UNDEFINED);
    let no_inst = with_hook_slot(Function::new_no_args("return 'no-inst'"));
    assert_eq!(no_inst.as_string().as_deref(), Some("no-inst"));

    set_current_instance(JsValue::from_str("not-object"));
    let primitive_inst = with_hook_slot(Function::new_no_args("return 'primitive-inst'"));
    assert_eq!(primitive_inst.as_string().as_deref(), Some("primitive-inst"));

    set_current_instance(JsValue::UNDEFINED);
    let id_no_inst = vapor_with_hook_id(
        JsValue::from_str("id-no-inst"),
        Function::new_no_args("return 'id-no-inst-result'"),
    );
    assert_eq!(id_no_inst.as_string().as_deref(), Some("id-no-inst-result"));

    set_current_instance(JsValue::from_f64(4.0));
    let id_primitive_inst = vapor_with_hook_id(
        JsValue::from_str("id-primitive-inst"),
        Function::new_no_args("return 'id-primitive-result'"),
    );
    assert_eq!(id_primitive_inst.as_string().as_deref(), Some("id-primitive-result"));
}

#[wasm_bindgen_test]
fn vapor_with_hook_id_accepts_array_slot_mapping_publicly() {
    let inst = Object::new();
    let hooks = Object::new();
    let states = Array::new();
    states.push(&JsValue::from_str("seeded"));

    let idmap = Map::new();
    let slots = Array::new();
    slots.push(&JsValue::from_f64(0.0));
    idmap.set(&JsValue::from_str("stable"), &slots.into());

    Reflect::set(&hooks, &JsValue::from_str("states"), &states).unwrap();
    Reflect::set(&hooks, &JsValue::from_str("index"), &JsValue::from_f64(0.0)).unwrap();
    Reflect::set(&hooks, &JsValue::from_str("__idMap"), &idmap).unwrap();
    Reflect::set(&inst, &JsValue::from_str("__hooks"), &hooks).unwrap();
    set_current_instance(inst.into());

    let runner = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        with_hook_slot(Function::new_no_args("return 'unused'"))
    }) as Box<dyn FnMut() -> JsValue>);
    let out =
        vapor_with_hook_id(JsValue::from_str("stable"), runner.as_ref().clone().unchecked_into());
    runner.forget();
    assert_eq!(out.as_string().as_deref(), Some("seeded"));
    assert!(
        Reflect::get(&hooks, &JsValue::from_str("__forcedIndex"))
            .unwrap_or(JsValue::UNDEFINED)
            .is_undefined()
    );
    assert_eq!(idmap.get(&JsValue::from_str("stable")).as_f64(), Some(0.0));

    let empty_slots = Array::new();
    idmap.set(&JsValue::from_str("empty"), &empty_slots.into());
    let runner_empty = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        with_hook_slot(Function::new_no_args("return 'created-from-empty-array'"))
    }) as Box<dyn FnMut() -> JsValue>);
    let out_empty = vapor_with_hook_id(
        JsValue::from_str("empty"),
        runner_empty.as_ref().clone().unchecked_into(),
    );
    runner_empty.forget();
    assert_eq!(out_empty.as_string().as_deref(), Some("created-from-empty-array"));
    assert_eq!(idmap.get(&JsValue::from_str("empty")).as_f64(), Some(1.0));
}

#[wasm_bindgen_test]
fn dispose_hook_scope_public_entry_handles_primitives_and_wrappers() {
    dispose_hook_scope_for_instance(JsValue::from_str("not-an-object"));

    let wrapper_without_scope = Object::new();
    dispose_hook_scope_for_instance(wrapper_without_scope.into());

    let wrapper_with_scope = Object::new();
    Reflect::set(
        &wrapper_with_scope,
        &JsValue::from_str("__hook_effect_scope_id"),
        &JsValue::from_f64(999_999.0),
    )
    .unwrap();
    dispose_hook_scope_for_instance(wrapper_with_scope.clone().into());
    assert!(
        Reflect::get(&wrapper_with_scope, &JsValue::from_str("__hook_effect_scope_id"))
            .unwrap_or(JsValue::UNDEFINED)
            .is_undefined()
    );
}

#[wasm_bindgen_test]
fn coverage_touch_internal_context_edges_publicly() {
    assert!(coverage_touch_internal_edges());
}

#[wasm_bindgen_test]
#[should_panic]
fn with_hook_slot_rethrows_factory_error_without_current_instance() {
    set_current_instance(JsValue::UNDEFINED);
    let _ = with_hook_slot(Function::new_no_args("throw new Error('no instance factory boom')"));
}

#[wasm_bindgen_test]
#[should_panic]
fn with_hook_slot_rethrows_factory_error_for_primitive_instance() {
    set_current_instance(JsValue::from_str("primitive"));
    let _ = with_hook_slot(Function::new_no_args("throw new Error('primitive factory boom')"));
}

#[wasm_bindgen_test]
#[should_panic]
fn with_hook_slot_rethrows_factory_error_when_creating_object_slot() {
    set_current_instance(Object::new().into());
    let _ = with_hook_slot(Function::new_no_args("throw new Error('slot factory boom')"));
}

#[wasm_bindgen_test]
#[should_panic]
fn vapor_with_hook_id_rethrows_runner_error_without_current_instance() {
    set_current_instance(JsValue::UNDEFINED);
    let _ = vapor_with_hook_id(
        JsValue::from_str("throwing-id"),
        Function::new_no_args("throw new Error('no instance runner boom')"),
    );
}

#[wasm_bindgen_test]
#[should_panic]
fn vapor_with_hook_id_rethrows_runner_error_for_primitive_instance() {
    set_current_instance(JsValue::from_f64(7.0));
    let _ = vapor_with_hook_id(
        JsValue::from_str("throwing-id"),
        Function::new_no_args("throw new Error('primitive runner boom')"),
    );
}

#[wasm_bindgen_test]
#[should_panic]
fn vapor_with_hook_id_rethrows_runner_error_for_object_instance() {
    set_current_instance(Object::new().into());
    let _ = vapor_with_hook_id(
        JsValue::from_str("throwing-id"),
        Function::new_no_args("throw new Error('object runner boom')"),
    );
}
