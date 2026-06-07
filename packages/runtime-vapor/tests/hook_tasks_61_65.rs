use js_sys::{Array, Function, Object, Reflect};
use rue_runtime_vapor::{
    create_computed, create_effect, create_signal, ref_js, set_current_instance,
    set_reactive_scheduling, use_effect,
};
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use wasm_bindgen_test::*;

fn force_hook_slot(instance: &Object, index: u32) {
    let hooks = Reflect::get(instance, &JsValue::from_str("__hooks")).unwrap_or(JsValue::UNDEFINED);
    if hooks.is_object() {
        let _ = Reflect::set(
            &hooks.unchecked_into::<Object>(),
            &JsValue::from_str("__forcedIndex"),
            &JsValue::from_f64(index as f64),
        );
    }
}

#[wasm_bindgen_test]
fn ref_js_covers_global_force_and_scoped_slot_reuse() {
    set_reactive_scheduling("sync");
    let instance = Object::new();
    set_current_instance(instance.clone().into());

    let forced_a = ref_js(JsValue::from_str("a"), None, Some(true));
    let forced_b = ref_js(JsValue::from_str("b"), None, Some(true));
    assert!(!Object::is(&forced_a, &forced_b));

    Reflect::set(&forced_a, &JsValue::from_str("value"), &JsValue::from_str("changed")).unwrap();
    assert_eq!(
        Reflect::get(&forced_a, &JsValue::from_str("value")).unwrap().as_string().as_deref(),
        Some("changed"),
    );

    let scoped = ref_js(JsValue::from_str("scoped"), None, None);
    force_hook_slot(&instance, 0);
    let scoped_again = ref_js(JsValue::from_str("ignored"), None, None);
    assert!(Object::is(&scoped, &scoped_again));

    set_current_instance(JsValue::UNDEFINED);
    let global = ref_js(Object::new().into(), Some(JsValue::from_str("bad-options")), None);
    assert!(Reflect::get(&global, &JsValue::from_str("value")).unwrap().is_object());
}

#[wasm_bindgen_test]
fn use_effect_recreates_when_scheduler_changes_and_ignores_bad_options() {
    set_reactive_scheduling("sync");
    let instance = Object::new();
    set_current_instance(instance.clone().into());

    let source = create_signal(JsValue::from_f64(0.0), None);
    let runs = std::rc::Rc::new(std::cell::RefCell::new(0));
    let scheduled = std::rc::Rc::new(std::cell::RefCell::new(0));

    let runs_for_first = runs.clone();
    let first_effect = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *runs_for_first.borrow_mut() += 1;
        JsValue::UNDEFINED
    }) as Box<dyn FnMut() -> JsValue>);
    let first_effect_fn: Function = first_effect.as_ref().clone().unchecked_into();

    let deps = Array::new();
    deps.push(&JsValue::from(source.clone()));
    use_effect(first_effect_fn, Some(deps.clone().into()), Some(JsValue::from_str("bad")));
    assert_eq!(*runs.borrow(), 1);

    let scheduled_for_scheduler = scheduled.clone();
    let scheduler = wasm_bindgen::closure::Closure::wrap(Box::new(move |run: Function| {
        *scheduled_for_scheduler.borrow_mut() += 1;
        let _ = run.call0(&JsValue::NULL);
        JsValue::UNDEFINED
    })
        as Box<dyn FnMut(Function) -> JsValue>);
    let opts = Object::new();
    Reflect::set(
        &opts,
        &JsValue::from_str("scheduler"),
        &scheduler.as_ref().clone().unchecked_into::<Function>(),
    )
    .unwrap();

    force_hook_slot(&instance, 0);
    let runs_for_second = runs.clone();
    let second_effect = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *runs_for_second.borrow_mut() += 10;
        JsValue::UNDEFINED
    }) as Box<dyn FnMut() -> JsValue>);
    let second_effect_fn: Function = second_effect.as_ref().clone().unchecked_into();
    use_effect(second_effect_fn, Some(deps.into()), Some(opts.into()));
    assert_eq!(*runs.borrow(), 11);

    source.set_js(JsValue::from_f64(1.0));
    assert!(*scheduled.borrow() >= 1);
    assert_eq!(*runs.borrow(), 21);

    first_effect.forget();
    second_effect.forget();
    scheduler.forget();
    set_current_instance(JsValue::UNDEFINED);
}

#[wasm_bindgen_test]
fn use_effect_covers_function_plain_object_and_non_array_deps() {
    set_reactive_scheduling("sync");
    let instance = Object::new();
    set_current_instance(instance.clone().into());

    let hits = std::rc::Rc::new(std::cell::RefCell::new(0));
    let hits_for_effect = hits.clone();
    let effect = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *hits_for_effect.borrow_mut() += 1;
        JsValue::UNDEFINED
    }) as Box<dyn FnMut() -> JsValue>);
    let effect_fn: Function = effect.as_ref().clone().unchecked_into();

    let deps = Array::new();
    deps.push(&Function::new_no_args("return 1").into());
    deps.push(&Object::new().into());
    use_effect(effect_fn.clone(), Some(deps.into()), None);
    assert_eq!(*hits.borrow(), 1);

    force_hook_slot(&instance, 0);
    use_effect(effect_fn, Some(JsValue::from_str("not-an-array")), None);
    assert_eq!(*hits.borrow(), 2);

    effect.forget();
    set_current_instance(JsValue::UNDEFINED);
}

#[wasm_bindgen_test]
fn computed_handles_invalid_inputs_nested_dependencies_and_disposed_consumers() {
    set_reactive_scheduling("sync");

    let primitive = create_computed(JsValue::from_str("not-a-getter"));
    assert!(primitive.get_js().is_undefined());

    let missing_get = create_computed(Object::new().into());
    assert!(missing_get.get_js().is_undefined());

    let first = create_signal(JsValue::from_f64(2.0), None);
    let second = create_signal(JsValue::from_f64(3.0), None);
    let first_for_getter = first.clone();
    let second_for_getter = second.clone();
    let getter = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        let a = first_for_getter.get_js().as_f64().unwrap_or(0.0);
        let b = second_for_getter.get_js().as_f64().unwrap_or(0.0);
        JsValue::from_f64(a * b)
    }) as Box<dyn FnMut() -> JsValue>);
    let product = create_computed(getter.as_ref().clone().unchecked_into::<Function>().into());

    assert_eq!(product.get_js().as_f64(), Some(6.0));
    second.set_js(JsValue::from_f64(4.0));
    assert_eq!(product.get_js().as_f64(), Some(8.0));

    let hits = std::rc::Rc::new(std::cell::RefCell::new(0));
    let hits_for_effect = hits.clone();
    let product_for_effect = product.clone();
    let effect = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *hits_for_effect.borrow_mut() += 1;
        let _ = product_for_effect.get_js();
    }) as Box<dyn FnMut()>);
    let handle = create_effect(effect.as_ref().clone().unchecked_into(), None);
    assert_eq!(*hits.borrow(), 1);

    handle.dispose_js();
    first.set_js(JsValue::from_f64(5.0));
    assert_eq!(*hits.borrow(), 1);
    assert_eq!(product.get_js().as_f64(), Some(20.0));

    getter.forget();
    effect.forget();
}
