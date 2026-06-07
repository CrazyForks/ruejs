use js_sys::{Array, Function, Object, Reflect};
use rue_runtime_vapor::{last_hook_error, set_current_instance, use_memo};
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use wasm_bindgen_test::*;

fn force_hook_slot(inst: &Object, index: u32) {
    let hooks = Reflect::get(inst, &JsValue::from_str("__hooks")).unwrap_or(JsValue::UNDEFINED);
    if hooks.is_object() {
        let _ = Reflect::set(
            &hooks.unchecked_into::<Object>(),
            &JsValue::from_str("__forcedIndex"),
            &JsValue::from_f64(index as f64),
        );
    }
}

#[wasm_bindgen_test]
fn use_memo_empty_deps_reuses_jsx_like_object_value() {
    let inst = Object::new();
    set_current_instance(inst.clone().into());

    let hits = std::rc::Rc::new(std::cell::RefCell::new(0));
    let hits2 = hits.clone();
    let factory = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *hits2.borrow_mut() += 1;
        let vnode = Object::new();
        Reflect::set(&vnode, &JsValue::from_str("type"), &JsValue::from_str("span")).unwrap();
        Reflect::set(&vnode, &JsValue::from_str("props"), &Object::new()).unwrap();
        vnode.into()
    }) as Box<dyn FnMut() -> JsValue>);
    let f: Function = factory.as_ref().clone().unchecked_into();

    let first = use_memo(f.clone(), Array::new().into());
    force_hook_slot(&inst, 0);
    let second = use_memo(f.clone(), Array::new().into());

    assert!(Object::is(&first, &second));
    assert_eq!(*hits.borrow(), 1);

    factory.forget();
}

#[wasm_bindgen_test]
#[should_panic]
fn use_memo_marks_runtime_crashed_when_factory_throws() {
    set_current_instance(Object::new().into());
    let factory = Function::new_no_args("throw new Error('memo boom')");
    let _ = use_memo(factory, Array::new().into());
    assert!(last_hook_error().is_some());
}

#[wasm_bindgen_test]
fn use_memo_recomputes_for_changed_equal_and_unstable_deps() {
    let inst = Object::new();
    set_current_instance(inst.clone().into());

    let hits = std::rc::Rc::new(std::cell::RefCell::new(0));
    let hits2 = hits.clone();
    let factory = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *hits2.borrow_mut() += 1;
        JsValue::from_f64(*hits2.borrow() as f64)
    }) as Box<dyn FnMut() -> JsValue>);
    let f: Function = factory.as_ref().clone().unchecked_into();

    let dep1 = Object::new();
    Reflect::set(&dep1, &JsValue::from_str("value"), &JsValue::from_f64(1.0)).unwrap();
    let deps1 = Array::new();
    deps1.push(&dep1.into());
    assert_eq!(use_memo(f.clone(), deps1.into()).as_f64(), Some(1.0));

    let dep2 = Object::new();
    Reflect::set(&dep2, &JsValue::from_str("value"), &JsValue::from_f64(1.0)).unwrap();
    let deps2 = Array::new();
    deps2.push(&dep2.into());
    force_hook_slot(&inst, 0);
    assert_eq!(use_memo(f.clone(), deps2.into()).as_f64(), Some(1.0));
    assert_eq!(*hits.borrow(), 1);

    let dep3 = Object::new();
    Reflect::set(&dep3, &JsValue::from_str("value"), &JsValue::from_f64(2.0)).unwrap();
    let deps3 = Array::new();
    deps3.push(&dep3.into());
    force_hook_slot(&inst, 0);
    assert_eq!(use_memo(f.clone(), deps3.into()).as_f64(), Some(2.0));
    assert_eq!(*hits.borrow(), 2);

    force_hook_slot(&inst, 0);
    assert_eq!(use_memo(f.clone(), JsValue::from_str("unstable")).as_f64(), Some(3.0));
    force_hook_slot(&inst, 0);
    assert_eq!(use_memo(f.clone(), JsValue::from_str("unstable")).as_f64(), Some(4.0));

    factory.forget();
}
