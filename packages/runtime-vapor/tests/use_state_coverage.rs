use js_sys::{Array, Function, Object, Reflect};
use rue_runtime_vapor::reactive::signal::create_reactive;
use rue_runtime_vapor::{create_effect, set_current_instance, set_reactive_scheduling, use_state};
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use wasm_bindgen_test::*;

fn force_slot(index: u32) {
    let inst = rue_runtime_vapor::get_current_instance();
    if inst.is_object() {
        let hooks =
            Reflect::get(&inst, &JsValue::from_str("__hooks")).unwrap_or(JsValue::UNDEFINED);
        if hooks.is_object() {
            let _ = Reflect::set(
                &hooks.unchecked_into::<Object>(),
                &JsValue::from_str("__forcedIndex"),
                &JsValue::from_f64(index as f64),
            );
        }
    }
}

#[wasm_bindgen_test]
fn use_state_lazy_initializer_runs_once_for_reused_scope() {
    set_reactive_scheduling("sync");
    set_current_instance(Object::new().into());

    let hits = std::rc::Rc::new(std::cell::RefCell::new(0));
    let hits2 = hits.clone();
    let init = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *hits2.borrow_mut() += 1;
        JsValue::from_f64(10.0)
    }) as Box<dyn FnMut() -> JsValue>);
    let init_fn: Function = init.as_ref().clone().unchecked_into();

    force_slot(0);
    let first = Array::from(&use_state(init_fn.clone().into(), None));
    let first_state = first.get(0);
    assert_eq!(
        Reflect::get(&first_state, &JsValue::from_str("value")).unwrap().as_f64(),
        Some(10.0)
    );

    force_slot(0);
    let second = Array::from(&use_state(init_fn.into(), None));
    assert!(Object::is(&first_state, &second.get(0)));
    assert_eq!(*hits.borrow(), 1);

    init.forget();
}

#[wasm_bindgen_test]
fn use_state_reactive_object_array_and_equal_skip_paths() {
    set_reactive_scheduling("sync");
    set_current_instance(Object::new().into());

    let root = Object::new();
    Reflect::set(&root, &JsValue::from_str("a"), &JsValue::from_f64(1.0)).unwrap();
    Reflect::set(&root, &JsValue::from_str("b"), &JsValue::from_f64(2.0)).unwrap();
    force_slot(0);
    let object_state = Array::from(&use_state(root.into(), None));
    let object_proxy = object_state.get(0);
    let object_setter = object_state.get(1).dyn_into::<Function>().unwrap();

    let effect_hits = std::rc::Rc::new(std::cell::RefCell::new(0));
    let effect_hits2 = effect_hits.clone();
    let proxy_for_effect = object_proxy.clone();
    let effect = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *effect_hits2.borrow_mut() += 1;
        let _ = Reflect::get(&proxy_for_effect, &JsValue::from_str("b")).unwrap();
    }) as Box<dyn FnMut()>);
    let _handle = create_effect(effect.as_ref().clone().unchecked_into(), None);

    let next = Object::new();
    Reflect::set(&next, &JsValue::from_str("b"), &JsValue::from_f64(3.0)).unwrap();
    Reflect::set(&next, &JsValue::from_str("c"), &JsValue::from_f64(4.0)).unwrap();
    let _ = object_setter.call1(&JsValue::NULL, &next.into());

    assert!(
        Reflect::get(&object_proxy, &JsValue::from_str("a"))
            .unwrap_or(JsValue::UNDEFINED)
            .is_undefined()
    );
    assert_eq!(Reflect::get(&object_proxy, &JsValue::from_str("b")).unwrap().as_f64(), Some(3.0));
    assert_eq!(*effect_hits.borrow(), 2);

    let eq_opts = Object::new();
    Reflect::set(
        &eq_opts,
        &JsValue::from_str("equals"),
        &Function::new_with_args("p,n", "return true"),
    )
    .unwrap();
    force_slot(1);
    let equal_state = Array::from(&use_state(JsValue::from_f64(1.0), Some(eq_opts.into())));
    let equal_proxy = equal_state.get(0);
    let equal_setter = equal_state.get(1).dyn_into::<Function>().unwrap();
    let _ = equal_setter.call1(&JsValue::NULL, &JsValue::from_f64(9.0));
    assert_eq!(
        Reflect::get(&equal_proxy, &JsValue::from_str("value")).unwrap().as_f64(),
        Some(9.0)
    );

    let items = Array::new();
    items.push(&JsValue::from_str("A"));
    force_slot(2);
    let array_state = Array::from(&use_state(items.into(), None));
    let array_proxy = array_state.get(0);
    let array_setter = array_state.get(1).dyn_into::<Function>().unwrap();
    let replace = Array::new();
    replace.push(&JsValue::from_str("B"));
    replace.push(&JsValue::from_str("C"));
    let _ = array_setter.call1(&JsValue::NULL, &replace.into());
    assert_eq!(
        Reflect::get(&array_proxy, &JsValue::from_str("length")).unwrap().as_f64(),
        Some(2.0)
    );

    effect.forget();
}

#[wasm_bindgen_test]
fn use_state_ref_and_signal_kinds_support_setter_variants() {
    set_reactive_scheduling("sync");
    set_current_instance(Object::new().into());

    let ref_opts = Object::new();
    Reflect::set(&ref_opts, &JsValue::from_str("kind"), &JsValue::from_str("ref")).unwrap();
    force_slot(0);
    let ref_state = Array::from(&use_state(JsValue::from_f64(1.0), Some(ref_opts.into())));
    let ref_proxy = ref_state.get(0);
    let ref_setter = ref_state.get(1).dyn_into::<Function>().unwrap();
    let mutate = wasm_bindgen::closure::Closure::wrap(Box::new(move |state: JsValue| {
        let current = Reflect::get(&state, &JsValue::from_str("value")).unwrap().as_f64().unwrap();
        let _ =
            Reflect::set(&state, &JsValue::from_str("value"), &JsValue::from_f64(current + 4.0));
        JsValue::UNDEFINED
    }) as Box<dyn FnMut(JsValue) -> JsValue>);
    let _ = ref_setter.call1(&JsValue::NULL, &mutate.as_ref().clone().unchecked_into::<Function>());
    let _ = ref_setter.call1(&JsValue::NULL, &JsValue::from_f64(8.0));
    assert_eq!(Reflect::get(&ref_proxy, &JsValue::from_str("value")).unwrap().as_f64(), Some(8.0));

    let signal_opts = Object::new();
    Reflect::set(&signal_opts, &JsValue::from_str("kind"), &JsValue::from_str("signal")).unwrap();
    force_slot(1);
    let signal_state = Array::from(&use_state(JsValue::from_f64(2.0), Some(signal_opts.into())));
    let signal = signal_state.get(0);
    let signal_setter = signal_state.get(1).dyn_into::<Function>().unwrap();
    let get: Function = Reflect::get(&signal, &JsValue::from_str("get")).unwrap().unchecked_into();
    let _ = signal_setter.call1(&JsValue::NULL, &JsValue::from_f64(6.0));
    assert_eq!(get.call0(&signal).unwrap().as_f64(), Some(6.0));

    let update = wasm_bindgen::closure::Closure::wrap(Box::new(move |sig: JsValue| {
        let peek: Function =
            Reflect::get(&sig, &JsValue::from_str("peek")).unwrap().unchecked_into();
        JsValue::from_f64(peek.call0(&sig).unwrap().as_f64().unwrap() + 1.0)
    }) as Box<dyn FnMut(JsValue) -> JsValue>);
    let _ =
        signal_setter.call1(&JsValue::NULL, &update.as_ref().clone().unchecked_into::<Function>());
    assert_eq!(get.call0(&signal).unwrap().as_f64(), Some(7.0));

    mutate.forget();
    update.forget();
}

#[wasm_bindgen_test]
fn use_state_reactive_wrapped_and_missing_signal_fallback_setters() {
    set_reactive_scheduling("sync");
    set_current_instance(Object::new().into());

    force_slot(0);
    let wrapped_state = Array::from(&use_state(JsValue::from_f64(1.0), None));
    let wrapped_proxy = wrapped_state.get(0);
    let wrapped_setter = wrapped_state.get(1).dyn_into::<Function>().unwrap();

    let return_wrapped_object =
        wasm_bindgen::closure::Closure::wrap(Box::new(move |_state: JsValue| {
            let out = Object::new();
            Reflect::set(&out, &JsValue::from_str("value"), &JsValue::from_f64(11.0)).unwrap();
            out.into()
        }) as Box<dyn FnMut(JsValue) -> JsValue>);
    let _ = wrapped_setter.call1(
        &JsValue::NULL,
        &return_wrapped_object.as_ref().clone().unchecked_into::<Function>(),
    );
    assert_eq!(
        Reflect::get(&wrapped_proxy, &JsValue::from_str("value")).unwrap().as_f64(),
        Some(11.0)
    );

    let return_wrapped_primitive =
        wasm_bindgen::closure::Closure::wrap(Box::new(move |_state: JsValue| {
            JsValue::from_f64(11.5)
        }) as Box<dyn FnMut(JsValue) -> JsValue>);
    let _ = wrapped_setter.call1(
        &JsValue::NULL,
        &return_wrapped_primitive.as_ref().clone().unchecked_into::<Function>(),
    );
    assert_eq!(
        Reflect::get(&wrapped_proxy, &JsValue::from_str("value")).unwrap().as_f64(),
        Some(11.5)
    );

    let direct_wrapped_object = Object::new();
    Reflect::set(&direct_wrapped_object, &JsValue::from_str("value"), &JsValue::from_f64(12.0))
        .unwrap();
    let _ = wrapped_setter.call1(&JsValue::NULL, &direct_wrapped_object.into());
    assert_eq!(
        Reflect::get(&wrapped_proxy, &JsValue::from_str("value")).unwrap().as_f64(),
        Some(12.0)
    );

    let root = Object::new();
    Reflect::set(&root, &JsValue::from_str("old"), &JsValue::from_f64(1.0)).unwrap();
    force_slot(1);
    let object_state = Array::from(&use_state(root.into(), None));
    let object_proxy = object_state.get(0);
    let object_setter = object_state.get(1).dyn_into::<Function>().unwrap();
    Reflect::delete_property(&Object::from(object_proxy.clone()), &JsValue::from_str("__signal__"))
        .unwrap();

    let return_object_without_signal =
        wasm_bindgen::closure::Closure::wrap(Box::new(move |_state: JsValue| {
            let out = Object::new();
            Reflect::set(&out, &JsValue::from_str("next"), &JsValue::from_f64(2.0)).unwrap();
            out.into()
        }) as Box<dyn FnMut(JsValue) -> JsValue>);
    let _ = object_setter.call1(
        &JsValue::NULL,
        &return_object_without_signal.as_ref().clone().unchecked_into::<Function>(),
    );
    assert!(
        Reflect::get(&object_proxy, &JsValue::from_str("old"))
            .unwrap_or(JsValue::UNDEFINED)
            .is_undefined()
    );
    assert_eq!(
        Reflect::get(&object_proxy, &JsValue::from_str("next")).unwrap().as_f64(),
        Some(2.0)
    );

    Reflect::delete_property(&Object::from(object_proxy.clone()), &JsValue::from_str("__signal__"))
        .unwrap();
    let direct_object_without_signal = Object::new();
    Reflect::set(
        &direct_object_without_signal,
        &JsValue::from_str("final"),
        &JsValue::from_f64(3.0),
    )
    .unwrap();
    let _ = object_setter.call1(&JsValue::NULL, &direct_object_without_signal.into());
    assert!(
        Reflect::get(&object_proxy, &JsValue::from_str("next"))
            .unwrap_or(JsValue::UNDEFINED)
            .is_undefined()
    );
    assert_eq!(
        Reflect::get(&object_proxy, &JsValue::from_str("final")).unwrap().as_f64(),
        Some(3.0)
    );

    return_wrapped_object.forget();
    return_wrapped_primitive.forget();
    return_object_without_signal.forget();
}

#[wasm_bindgen_test]
fn use_state_reuses_reactive_initial_and_preseeded_fallback_slots() {
    set_reactive_scheduling("sync");

    let initial = Object::new();
    Reflect::set(&initial, &JsValue::from_str("kept"), &JsValue::from_f64(1.0)).unwrap();
    let reactive_initial = create_reactive(initial.into(), None);
    set_current_instance(Object::new().into());
    force_slot(0);
    let reused =
        Array::from(&use_state(reactive_initial.clone(), Some(JsValue::from_str("ignored"))));
    assert!(Object::is(&reactive_initial, &reused.get(0)));

    let inst = Object::new();
    let hooks = Object::new();
    let states = Array::new();
    let slot = Object::new();
    let state = Object::new();
    Reflect::set(&state, &JsValue::from_str("old"), &JsValue::from_f64(1.0)).unwrap();
    Reflect::set(&slot, &JsValue::from_str("created"), &JsValue::TRUE).unwrap();
    Reflect::set(&slot, &JsValue::from_str("state"), &state).unwrap();
    Reflect::set(&slot, &JsValue::from_str("__wrapped__"), &JsValue::FALSE).unwrap();
    states.push(&slot);
    Reflect::set(&hooks, &JsValue::from_str("states"), &states).unwrap();
    Reflect::set(&hooks, &JsValue::from_str("index"), &JsValue::from_f64(0.0)).unwrap();
    Reflect::set(&inst, &JsValue::from_str("__hooks"), &hooks).unwrap();
    set_current_instance(inst.into());

    let object_state = Array::from(&use_state(JsValue::UNDEFINED, None));
    let object_proxy = object_state.get(0);
    let object_setter = object_state.get(1).dyn_into::<Function>().unwrap();
    let updater_object = wasm_bindgen::closure::Closure::wrap(Box::new(move |_state: JsValue| {
        let out = Object::new();
        Reflect::set(&out, &JsValue::from_str("next"), &JsValue::from_f64(2.0)).unwrap();
        out.into()
    })
        as Box<dyn FnMut(JsValue) -> JsValue>);
    let _ = object_setter
        .call1(&JsValue::NULL, &updater_object.as_ref().clone().unchecked_into::<Function>());
    assert!(
        Reflect::get(&object_proxy, &JsValue::from_str("old"))
            .unwrap_or(JsValue::UNDEFINED)
            .is_undefined()
    );
    assert_eq!(
        Reflect::get(&object_proxy, &JsValue::from_str("next")).unwrap().as_f64(),
        Some(2.0)
    );

    let updater_primitive =
        wasm_bindgen::closure::Closure::wrap(
            Box::new(move |_state: JsValue| JsValue::from_f64(9.0))
                as Box<dyn FnMut(JsValue) -> JsValue>,
        );
    let _ = object_setter
        .call1(&JsValue::NULL, &updater_primitive.as_ref().clone().unchecked_into::<Function>());
    let _ = object_setter.call1(&JsValue::NULL, &JsValue::from_f64(10.0));

    let direct = Object::new();
    Reflect::set(&direct, &JsValue::from_str("final"), &JsValue::from_f64(3.0)).unwrap();
    let _ = object_setter.call1(&JsValue::NULL, &direct.into());
    assert!(
        Reflect::get(&object_proxy, &JsValue::from_str("next"))
            .unwrap_or(JsValue::UNDEFINED)
            .is_undefined()
    );
    assert_eq!(
        Reflect::get(&object_proxy, &JsValue::from_str("final")).unwrap().as_f64(),
        Some(3.0)
    );

    let signal_inst = Object::new();
    let signal_hooks = Object::new();
    let signal_states = Array::new();
    let signal_slot = Object::new();
    Reflect::set(&signal_slot, &JsValue::from_str("created"), &JsValue::TRUE).unwrap();
    Reflect::set(&signal_slot, &JsValue::from_str("state"), &Object::new()).unwrap();
    signal_states.push(&signal_slot);
    Reflect::set(&signal_hooks, &JsValue::from_str("states"), &signal_states).unwrap();
    Reflect::set(&signal_hooks, &JsValue::from_str("index"), &JsValue::from_f64(0.0)).unwrap();
    Reflect::set(&signal_inst, &JsValue::from_str("__hooks"), &signal_hooks).unwrap();
    set_current_instance(signal_inst.into());

    let signal_opts = Object::new();
    Reflect::set(&signal_opts, &JsValue::from_str("kind"), &JsValue::from_str("signal")).unwrap();
    let signal_state = Array::from(&use_state(JsValue::UNDEFINED, Some(signal_opts.into())));
    let signal_setter = signal_state.get(1).dyn_into::<Function>().unwrap();
    let _ = signal_setter.call1(&JsValue::NULL, &JsValue::from_f64(1.0));
    let signal_updater =
        wasm_bindgen::closure::Closure::wrap(
            Box::new(move |_state: JsValue| JsValue::from_f64(2.0))
                as Box<dyn FnMut(JsValue) -> JsValue>,
        );
    let _ = signal_setter
        .call1(&JsValue::NULL, &signal_updater.as_ref().clone().unchecked_into::<Function>());

    updater_object.forget();
    updater_primitive.forget();
    signal_updater.forget();
}

#[wasm_bindgen_test]
fn use_state_preseeded_reactive_signal_setter_handles_primitive_replacements() {
    set_reactive_scheduling("sync");

    let inst = Object::new();
    let hooks = Object::new();
    let states = Array::new();
    let slot = Object::new();
    let state = Object::new();
    let signal = Object::new();
    let calls = Array::new();
    Reflect::set(&signal, &JsValue::from_str("calls"), &calls).unwrap();
    Function::new_with_args(
        "signal",
        "Object.defineProperty(signal, 'set', { \
           configurable: true, \
           get() { \
             this.accessCount = (this.accessCount || 0) + 1; \
             if (this.accessCount % 2 === 1) return undefined; \
             return function(value) { this.calls.push(value); this.last = value; return undefined; }; \
           } \
         });",
    )
    .call1(&JsValue::NULL, &signal)
    .unwrap();
    Reflect::set(&state, &JsValue::from_str("__signal__"), &signal).unwrap();
    Reflect::set(&slot, &JsValue::from_str("created"), &JsValue::TRUE).unwrap();
    Reflect::set(&slot, &JsValue::from_str("state"), &state).unwrap();
    Reflect::set(&slot, &JsValue::from_str("__wrapped__"), &JsValue::FALSE).unwrap();
    states.push(&slot);
    Reflect::set(&hooks, &JsValue::from_str("states"), &states).unwrap();
    Reflect::set(&hooks, &JsValue::from_str("index"), &JsValue::from_f64(0.0)).unwrap();
    Reflect::set(&inst, &JsValue::from_str("__hooks"), &hooks).unwrap();
    set_current_instance(inst.into());

    let state_tuple = Array::from(&use_state(JsValue::UNDEFINED, None));
    let setter = state_tuple.get(1).dyn_into::<Function>().unwrap();
    let updater = wasm_bindgen::closure::Closure::wrap(Box::new(move |_state: JsValue| {
        JsValue::from_f64(41.0)
    })
        as Box<dyn FnMut(JsValue) -> JsValue>);
    let _ = setter.call1(&JsValue::NULL, &updater.as_ref().clone().unchecked_into::<Function>());
    let _ = setter.call1(&JsValue::NULL, &JsValue::from_f64(42.0));

    let recorded: Array =
        Reflect::get(&signal, &JsValue::from_str("calls")).unwrap().unchecked_into();
    assert_eq!(recorded.length(), 2);
    assert_eq!(recorded.get(0).as_f64(), Some(41.0));
    assert_eq!(recorded.get(1).as_f64(), Some(42.0));
    assert_eq!(Reflect::get(&signal, &JsValue::from_str("last")).unwrap().as_f64(), Some(42.0));

    updater.forget();
}
