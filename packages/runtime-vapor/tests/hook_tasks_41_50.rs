#![cfg_attr(wasm_bindgen_unstable_test_coverage, feature(coverage_attribute))]

use js_sys::{Array, Function, Object, Reflect};
use rue_runtime_vapor::{
    computed_js, create_effect, ref_js, set_current_instance, set_reactive_scheduling, signal_js,
    unref_js, use_callback, use_ref, use_setup, use_signal,
};
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use wasm_bindgen_test::*;

#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
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

fn signal_get(signal: &JsValue) -> JsValue {
    let get: Function = Reflect::get(signal, &JsValue::from_str("get")).unwrap().unchecked_into();
    get.call0(signal).unwrap()
}

#[wasm_bindgen_test]
fn use_signal_reuses_scope_and_honors_equals_skip() {
    set_reactive_scheduling("sync");
    let instance = Object::new();
    set_current_instance(instance.clone().into());

    let opts = Object::new();
    Reflect::set(
        &opts,
        &JsValue::from_str("equals"),
        &Function::new_with_args("prev,next", "return true"),
    )
    .unwrap();

    let first = Array::from(&use_signal(JsValue::from_f64(1.0), Some(opts.into())));
    let signal = first.get(0);
    let setter: Function = first.get(1).unchecked_into();

    let hits = std::rc::Rc::new(std::cell::RefCell::new(0));
    let hits_for_effect = hits.clone();
    let signal_for_effect = signal.clone();
    let effect = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *hits_for_effect.borrow_mut() += 1;
        let _ = signal_get(&signal_for_effect);
    }) as Box<dyn FnMut()>);
    let _handle = create_effect(effect.as_ref().clone().unchecked_into(), None);

    let _ = setter.call1(&JsValue::NULL, &JsValue::from_f64(2.0));
    assert_eq!(signal_get(&signal).as_f64(), Some(2.0));
    assert_eq!(*hits.borrow(), 1);

    force_hook_slot(&instance, 0);
    let second = Array::from(&use_signal(JsValue::from_f64(99.0), None));
    assert!(Object::is(&signal, &second.get(0)));

    force_hook_slot(&instance, 1);
    let non_object_options =
        Array::from(&use_signal(JsValue::from_str("fresh"), Some(JsValue::from_str("bad"))));
    assert_eq!(signal_get(&non_object_options.get(0)).as_string().as_deref(), Some("fresh"));

    effect.forget();
}

#[wasm_bindgen_test]
fn use_ref_keeps_mutable_current_across_render_scope_reuse() {
    let instance = Object::new();
    set_current_instance(instance.clone().into());

    let first = use_ref(JsValue::from_str("initial"));
    Reflect::set(&first, &JsValue::from_str("current"), &JsValue::from_str("mutated")).unwrap();

    force_hook_slot(&instance, 0);
    let second = use_ref(JsValue::from_str("ignored"));

    assert!(Object::is(&first, &second));
    assert_eq!(
        Reflect::get(&second, &JsValue::from_str("current")).unwrap().as_string().as_deref(),
        Some("mutated"),
    );
}

#[wasm_bindgen_test]
fn use_setup_caches_return_value_and_runs_factory_once() {
    let instance = Object::new();
    set_current_instance(instance.clone().into());

    let hits = std::rc::Rc::new(std::cell::RefCell::new(0));
    let hits_for_factory = hits.clone();
    let factory = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *hits_for_factory.borrow_mut() += 1;
        let value = Object::new();
        Reflect::set(&value, &JsValue::from_str("ready"), &JsValue::TRUE).unwrap();
        value.into()
    }) as Box<dyn FnMut() -> JsValue>);
    let factory_fn: Function = factory.as_ref().clone().unchecked_into();

    let first = use_setup(factory_fn.clone());
    force_hook_slot(&instance, 0);
    let second = use_setup(factory_fn);

    assert!(Object::is(&first, &second));
    assert_eq!(*hits.borrow(), 1);

    factory.forget();
}

#[wasm_bindgen_test]
#[should_panic]
fn use_setup_marks_runtime_crashed_when_factory_throws() {
    set_current_instance(Object::new().into());
    let factory = Function::new_no_args("throw new Error('setup boom')");
    let _ = use_setup(factory);
}

#[wasm_bindgen_test]
fn unref_handles_ref_computed_signal_plain_and_nullish_values() {
    set_reactive_scheduling("sync");
    set_current_instance(Object::new().into());

    let r = ref_js(JsValue::from_str("ref-value"), None, None);
    assert_eq!(unref_js(r).as_string().as_deref(), Some("ref-value"));

    let getter = Function::new_no_args("return 'computed-value'");
    let computed = computed_js(getter.into(), None);
    assert_eq!(unref_js(computed.into()).as_string().as_deref(), Some("computed-value"));

    let signal = signal_js(JsValue::from_str("signal-value"), None, None);
    assert_eq!(unref_js(signal.into()).as_string().as_deref(), Some("signal-value"));

    let plain = Object::new();
    assert!(Object::is(&unref_js(plain.clone().into()), &plain.into()));
    assert!(unref_js(JsValue::NULL).is_null());
    assert!(unref_js(JsValue::UNDEFINED).is_undefined());
}

#[wasm_bindgen_test]
fn use_callback_reuses_empty_and_equal_deps_but_refreshes_changed_deps() {
    let instance = Object::new();
    set_current_instance(instance.clone().into());

    let first_fn = Function::new_no_args("return 'first'");
    let first = use_callback(first_fn.clone(), Array::new().into());
    force_hook_slot(&instance, 0);
    let empty_reused = use_callback(Function::new_no_args("return 'ignored'"), Array::new().into());
    assert!(Object::is(&first.clone().into(), &empty_reused.into()));

    let dep_one = Array::new();
    dep_one.push(&JsValue::from_f64(1.0));
    force_hook_slot(&instance, 0);
    let same_dep = use_callback(first_fn, dep_one.into());
    assert!(Object::is(&first.clone().into(), &same_dep.clone().into()));

    let dep_two = Array::new();
    dep_two.push(&JsValue::from_f64(2.0));
    let next_fn = Function::new_no_args("return 'next'");
    force_hook_slot(&instance, 0);
    let changed = use_callback(next_fn, dep_two.into());
    assert!(!Object::is(&same_dep.into(), &changed.into()));
}
