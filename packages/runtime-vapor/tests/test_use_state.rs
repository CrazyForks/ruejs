// 用例说明：
// - 验证 `useState` 的核心行为与与 `watch` 的配合：
//   1) 基本读写：读取初值、调用 setter 更新、再次读取为新值
//   2) updater 回调返回对象：形如 `{ value: next }`，写入到内部 Ref
//   3) updater 回调返回原始值：直接写入到内部 Ref 的 `value`
//   4) 配合 `watch_fn` 与 `equals`：相等更新不触发，非相等更新触发一次
use js_sys::{Array, Function, Object, Reflect};
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use wasm_bindgen_test::*;

use rue_runtime_vapor::reactive::signal::create_reactive;
use rue_runtime_vapor::{
    create_effect, set_current_instance, set_reactive_scheduling, use_state, watch_fn,
};

wasm_bindgen_test_configure!(run_in_browser);

fn force_slot_zero() {
    let inst = rue_runtime_vapor::get_current_instance();
    if inst.is_object() {
        let hooks =
            Reflect::get(&inst, &JsValue::from_str("__hooks")).unwrap_or(JsValue::UNDEFINED);
        if hooks.is_object() {
            let _ = Reflect::set(
                &hooks.unchecked_into::<Object>(),
                &JsValue::from_str("__forcedIndex"),
                &JsValue::from_f64(0.0),
            );
        }
    }
}

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
/// 验证基本读写：初值 0，设置为 1 后再次读取应为 1。
fn use_state_basic_set_and_get() {
    set_reactive_scheduling("sync");
    let inst = Object::new();
    set_current_instance(inst.into());

    force_slot_zero();
    let arr = Array::from(&use_state(JsValue::from_f64(0.0), None));
    let state_obj: Object = arr.get(0).unchecked_into();
    let cur = Reflect::get(&state_obj, &JsValue::from_str("value")).unwrap().as_f64().unwrap();
    assert_eq!(cur, 0.0);
    let setter = arr.get(1).dyn_into::<Function>().unwrap();
    let _ = setter.call1(&JsValue::NULL, &JsValue::from_f64(1.0));

    force_slot_zero();
    let arr2 = Array::from(&use_state(JsValue::from_f64(0.0), None));
    let state_obj2: Object = arr2.get(0).unchecked_into();
    let cur2 = Reflect::get(&state_obj2, &JsValue::from_str("value")).unwrap().as_f64().unwrap();
    assert_eq!(cur2, 1.0);
}

#[wasm_bindgen_test]
/// 验证 updater 回调返回 `{ value }` 对象时的写入语义。
fn use_state_updater_function() {
    set_reactive_scheduling("sync");
    let inst = Object::new();
    set_current_instance(inst.into());

    force_slot_zero();
    let arr = Array::from(&use_state(JsValue::from_f64(1.0), None));
    let setter = arr.get(1).dyn_into::<Function>().unwrap();
    // 针对默认 reactive（原始值包裹为 { value }）：读取 `{ value }`，返回包含 `value` 的对象
    let inc = wasm_bindgen::closure::Closure::wrap(Box::new(move |x: JsValue| {
        let obj: Object = x.unchecked_into();
        let v = Reflect::get(&obj, &JsValue::from_str("value")).unwrap().as_f64().unwrap();
        let out = Object::new();
        Reflect::set(&out, &JsValue::from_str("value"), &JsValue::from_f64(v + 1.0)).ok();
        out.into()
    }) as Box<dyn FnMut(JsValue) -> JsValue>);
    let f: Function = inc.as_ref().clone().into();
    let _ = setter.call1(&JsValue::NULL, &f.into());
    inc.forget();

    force_slot_zero();
    let arr2 = Array::from(&use_state(JsValue::from_f64(1.0), None));
    let state_obj: Object = arr2.get(0).unchecked_into();
    let cur = Reflect::get(&state_obj, &JsValue::from_str("value")).unwrap().as_f64().unwrap();
    assert_eq!(cur, 2.0);
}

#[wasm_bindgen_test]
/// 验证 updater 回调返回原始值（数字）时直接写入到 `value`。
fn use_state_updater_primitive_return() {
    set_reactive_scheduling("sync");
    let inst = Object::new();
    set_current_instance(inst.into());

    force_slot_zero();
    let arr = Array::from(&use_state(JsValue::from_f64(5.0), None));
    let setter = arr.get(1).dyn_into::<Function>().unwrap();
    // 返回原始值（数字），应直接写入到 { value }
    let inc = wasm_bindgen::closure::Closure::wrap(Box::new(move |x: JsValue| {
        let obj: Object = x.unchecked_into();
        let v = Reflect::get(&obj, &JsValue::from_str("value")).unwrap().as_f64().unwrap();
        JsValue::from_f64(v + 3.0)
    }) as Box<dyn FnMut(JsValue) -> JsValue>);
    let f: Function = inc.as_ref().clone().into();
    let _ = setter.call1(&JsValue::NULL, &f.into());
    inc.forget();

    force_slot_zero();
    let arr2 = Array::from(&use_state(JsValue::from_f64(5.0), None));
    let state_obj: Object = arr2.get(0).unchecked_into();
    let cur = Reflect::get(&state_obj, &JsValue::from_str("value")).unwrap().as_f64().unwrap();
    assert_eq!(cur, 8.0);
}

#[wasm_bindgen_test]
/// 验证 `equals` 选项：相等更新不触发，非相等更新触发一次。
fn use_state_equals_prevents_rerun_in_watch() {
    set_reactive_scheduling("sync");
    let inst = Object::new();
    set_current_instance(inst.into());

    let records = Array::new();

    let getter_cl = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        force_slot_zero();
        let opts = {
            let opt = Object::new();
            let eq = Function::new_with_args("p,n", "return Object.is(p,n)");
            Reflect::set(&opt, &JsValue::from_str("equals"), &eq).ok();
            opt.into()
        };
        let arr = Array::from(&use_state(JsValue::from_f64(0.0), Some(opts)));
        let obj: Object = arr.get(0).unchecked_into();
        Reflect::get(&obj, &JsValue::from_str("value")).unwrap()
    }) as Box<dyn FnMut() -> JsValue>);
    let getter_fn: Function = getter_cl.as_ref().clone().unchecked_into();

    let recs = records.clone();
    let handler_cl = wasm_bindgen::closure::Closure::wrap(Box::new(move |n: JsValue, o: JsValue| {
        let entry = Array::new();
        entry.push(&n);
        entry.push(&o);
        recs.push(&entry.into());
    })
        as Box<dyn FnMut(JsValue, JsValue)>);
    let handler_fn: Function = handler_cl.as_ref().clone().unchecked_into();

    let opts = {
        let o = Object::new();
        Reflect::set(&o, &JsValue::from_str("immediate"), &JsValue::from_bool(true)).ok();
        o.into()
    };
    let _eh = watch_fn(getter_fn, handler_fn, Some(opts));
    getter_cl.forget();
    handler_cl.forget();

    force_slot_zero();
    let arr = Array::from(&use_state(JsValue::from_f64(0.0), None));
    let setter = arr.get(1).dyn_into::<Function>().unwrap();
    // 设置相等值：不触发
    let _ = setter.call1(&JsValue::NULL, &JsValue::from_f64(0.0));
    // 设置不相等值：触发
    let _ = setter.call1(&JsValue::NULL, &JsValue::from_f64(2.0));

    assert_eq!(records.length(), 2);
    let e0 = Array::from(&records.get(0));
    assert_eq!(e0.get(0).as_f64().unwrap(), 0.0);
    assert!(e0.get(1).is_undefined());
    let e1 = Array::from(&records.get(1));
    assert_eq!(e1.get(0).as_f64().unwrap(), 2.0);
    assert_eq!(e1.get(1).as_f64().unwrap(), 0.0);
}

#[wasm_bindgen_test]
/// 传入已是 reactive 的对象时，useState 不应再次包裹成新的代理；
/// 否则浏览器里的嵌套数组 push 会丢失更新。
fn use_state_reuses_existing_reactive_object() {
    set_reactive_scheduling("sync");
    let inst = Object::new();
    set_current_instance(inst.into());

    let todos = Array::new();
    let first = Object::new();
    Reflect::set(&first, &JsValue::from_str("id"), &JsValue::from_f64(1.0)).unwrap();
    Reflect::set(&first, &JsValue::from_str("text"), &JsValue::from_str("A")).unwrap();
    todos.push(&first.into());

    let root = Object::new();
    Reflect::set(&root, &JsValue::from_str("todos"), &todos.into()).unwrap();

    let reactive_initial = create_reactive(root.into(), None);

    force_slot_zero();
    let arr = Array::from(&use_state(reactive_initial.clone(), None));
    let state_obj = arr.get(0);

    assert!(Object::is(&state_obj, &reactive_initial));

    let hits = std::rc::Rc::new(std::cell::RefCell::new(0));
    let hits2 = hits.clone();
    let state_for_effect = state_obj.clone();
    let effect = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *hits2.borrow_mut() += 1;
        let todos = Reflect::get(&state_for_effect, &JsValue::from_str("todos")).unwrap();
        let _ = Reflect::get(&todos, &JsValue::from_str("length")).unwrap();
    }) as Box<dyn FnMut()>);
    let effect_fn: Function = effect.as_ref().clone().into();
    let _handle = create_effect(effect_fn, None);

    assert_eq!(*hits.borrow(), 1);

    let todos_proxy = Reflect::get(&state_obj, &JsValue::from_str("todos")).unwrap();
    let push: Function =
        Reflect::get(&todos_proxy, &JsValue::from_str("push")).unwrap().unchecked_into();
    let next = Object::new();
    Reflect::set(&next, &JsValue::from_str("id"), &JsValue::from_f64(2.0)).unwrap();
    Reflect::set(&next, &JsValue::from_str("text"), &JsValue::from_str("B")).unwrap();
    let _ = push.call1(&JsValue::NULL, &next.into());

    assert_eq!(*hits.borrow(), 2);

    effect.forget();
}

#[wasm_bindgen_test]
fn use_state_lazy_initializer_runs_once_for_reused_render_scope() {
    set_reactive_scheduling("sync");
    let inst = Object::new();
    set_current_instance(inst.into());

    let hits = std::rc::Rc::new(std::cell::RefCell::new(0));
    let hits2 = hits.clone();
    let init = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *hits2.borrow_mut() += 1;
        JsValue::from_f64(10.0)
    }) as Box<dyn FnMut() -> JsValue>);
    let init_fn: Function = init.as_ref().clone().unchecked_into();

    force_slot_zero();
    let first = Array::from(&use_state(init_fn.clone().into(), None));
    let first_state = first.get(0);
    assert_eq!(
        Reflect::get(&first_state, &JsValue::from_str("value")).unwrap().as_f64(),
        Some(10.0)
    );

    force_slot_zero();
    let second = Array::from(&use_state(init_fn.into(), None));
    assert!(Object::is(&first_state, &second.get(0)));
    assert_eq!(*hits.borrow(), 1);

    init.forget();
}

#[wasm_bindgen_test]
fn use_state_object_and_array_states_update_through_setter_paths() {
    set_reactive_scheduling("sync");
    let inst = Object::new();
    set_current_instance(inst.into());

    let root = Object::new();
    Reflect::set(&root, &JsValue::from_str("a"), &JsValue::from_f64(1.0)).unwrap();
    Reflect::set(&root, &JsValue::from_str("b"), &JsValue::from_f64(2.0)).unwrap();
    force_slot(0);
    let object_state = Array::from(&use_state(root.into(), None));
    let object_proxy = object_state.get(0);
    let object_setter = object_state.get(1).dyn_into::<Function>().unwrap();

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
    assert_eq!(Reflect::get(&object_proxy, &JsValue::from_str("c")).unwrap().as_f64(), Some(4.0));

    let items = Array::new();
    items.push(&JsValue::from_str("A"));
    force_slot(1);
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
    assert_eq!(
        Reflect::get(&array_proxy, &JsValue::from_f64(0.0)).unwrap().as_string().as_deref(),
        Some("B")
    );
}

#[wasm_bindgen_test]
fn use_state_ref_and_signal_kinds_support_direct_and_functional_updates() {
    set_reactive_scheduling("sync");
    let inst = Object::new();
    set_current_instance(inst.into());

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
    let mutate_fn: Function = mutate.as_ref().clone().unchecked_into();
    let _ = ref_setter.call1(&JsValue::NULL, &mutate_fn.into());
    assert_eq!(Reflect::get(&ref_proxy, &JsValue::from_str("value")).unwrap().as_f64(), Some(5.0));
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
    let update_fn: Function = update.as_ref().clone().unchecked_into();
    let _ = signal_setter.call1(&JsValue::NULL, &update_fn.into());
    assert_eq!(get.call0(&signal).unwrap().as_f64(), Some(7.0));

    mutate.forget();
    update.forget();
}
