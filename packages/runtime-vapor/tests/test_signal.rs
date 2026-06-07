use js_sys::{Array, Function, Object, Reflect};
use rue_runtime_vapor::reactive::signal::{create_reactive, create_ref};
use rue_runtime_vapor::{
    SignalHandle, create_computed, create_effect, create_signal, set_reactive_scheduling,
};
use std::cell::RefCell;
use std::rc::Rc;
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use wasm_bindgen_test::*;

#[wasm_bindgen_test]
/// 调试方法：toJSON / valueOf 返回内部值；toString 对可序列化返回 JSON 字符串
fn signal_debug_methods_basic() {
    set_reactive_scheduling("sync");
    let obj = Object::new();
    Reflect::set(&obj, &JsValue::from_str("a"), &JsValue::from_f64(1.0)).unwrap();
    let sig = create_signal(obj.clone().into(), None);
    let j = sig.to_json();
    let a1 = Reflect::get(&j, &JsValue::from_str("a")).unwrap().as_f64().unwrap();
    assert_eq!(a1, 1.0);
    let v = sig.value_of_js();
    let a2 = Reflect::get(&v, &JsValue::from_str("a")).unwrap().as_f64().unwrap();
    assert_eq!(a2, 1.0);
    let s = sig.to_string_js();
    let parsed = js_sys::JSON::parse(&s).unwrap();
    let a3 = Reflect::get(&parsed, &JsValue::from_str("a")).unwrap().as_f64().unwrap();
    assert_eq!(a3, 1.0);
}

#[wasm_bindgen_test]
/// 调试方法：toString 遇到循环对象返回占位文本
fn signal_debug_to_string_cyclic_fallback() {
    set_reactive_scheduling("sync");
    let obj = Object::new();
    // 构造循环引用：obj.self = obj
    Reflect::set(&obj, &JsValue::from_str("self"), &obj.clone().into()).unwrap();
    let sig = create_signal(obj.into(), None);
    let s = sig.to_string_js();
    assert_eq!(s, "[object SignalHandle]");
}

#[wasm_bindgen_test]
fn signal_debug_to_string_handles_json_undefined_values() {
    set_reactive_scheduling("sync");

    let value = Function::new_no_args("return 1").into();
    let sig = create_signal(value, None);

    assert_eq!(sig.to_string_js(), "[object SignalHandle]");
}

#[wasm_bindgen_test]
/// value getter 不进行依赖收集：在 Effect 中读取后，后续 set 不会再次运行
fn signal_value_getter_does_not_subscribe() {
    set_reactive_scheduling("sync");
    let sig = create_signal(JsValue::from_f64(0.0), None);
    let hits = Rc::new(RefCell::new(0));
    let hits2 = hits.clone();
    let s_for = sig.clone();
    let cb = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *hits2.borrow_mut() += 1;
        let _ = s_for.value_getter();
    }) as Box<dyn FnMut()>);
    let f: Function = cb.as_ref().clone().into();
    let _eh = create_effect(f, None);
    assert_eq!(*hits.borrow(), 1);
    sig.set_js(JsValue::from_f64(1.0));
    assert_eq!(*hits.borrow(), 1);
    cb.forget();
}

#[wasm_bindgen_test]
/// value setter 等价于 set：写入后触发订阅者与值更新
fn signal_value_setter_triggers_and_updates() {
    set_reactive_scheduling("sync");
    let sig = create_signal(JsValue::from_f64(0.0), None);
    let hits = Rc::new(RefCell::new(0));
    let hits2 = hits.clone();
    let s_for = sig.clone();
    let cb = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *hits2.borrow_mut() += 1;
        let _ = s_for.get_js();
    }) as Box<dyn FnMut()>);
    let f: Function = cb.as_ref().clone().into();
    let _eh = create_effect(f, None);
    assert_eq!(*hits.borrow(), 1);
    sig.value_setter(JsValue::from_f64(2.0));
    assert_eq!(*hits.borrow(), 2);
    let v = sig.peek_js().as_f64().unwrap();
    assert_eq!(v, 2.0);
    cb.forget();
}

#[wasm_bindgen_test]
/// 基础行为：Signal 更新会触发订阅它的 Effect 重新运行。
fn signal_runs_effect_on_set() {
    set_reactive_scheduling("sync");
    let sig = create_signal(JsValue::from_f64(0.0), None);
    let hits = Rc::new(RefCell::new(0));
    let hits2 = hits.clone();
    let s_for = sig.clone();
    let cb = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *hits2.borrow_mut() += 1;
        let _ = s_for.get_js();
    }) as Box<dyn FnMut()>);
    let f: Function = cb.as_ref().clone().into();
    let _eh = create_effect(f, None);
    assert_eq!(*hits.borrow(), 1);
    sig.set_js(JsValue::from_f64(1.0));
    assert_eq!(*hits.borrow(), 2);
    cb.forget();
}

#[wasm_bindgen_test]
fn signal_duplicate_reads_in_one_effect_subscribe_once() {
    set_reactive_scheduling("sync");
    let sig = create_signal(JsValue::from_f64(0.0), None);
    let hits = Rc::new(RefCell::new(0));
    let hits2 = hits.clone();
    let s_for = sig.clone();
    let cb = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *hits2.borrow_mut() += 1;
        let _ = s_for.get_js();
        let _ = s_for.get_js();
    }) as Box<dyn FnMut()>);
    let f: Function = cb.as_ref().clone().into();
    let _eh = create_effect(f, None);
    assert_eq!(*hits.borrow(), 1);

    sig.set_js(JsValue::from_f64(1.0));

    assert_eq!(*hits.borrow(), 2);
    cb.forget();
}

#[wasm_bindgen_test]
/// 当为 Signal 提供 `equals` 并总是返回 true 时，后续 set 不会触发重新运行（认为值未变化）。
fn signal_equals_prevents_rerun() {
    set_reactive_scheduling("sync");
    let sig = create_signal(
        JsValue::from_f64(0.0),
        Some({
            let obj = js_sys::Object::new();
            let eq = wasm_bindgen::closure::Closure::wrap(Box::new(move |a: JsValue, b: JsValue| {
                let _ = a;
                let _ = b;
                JsValue::from_bool(true)
            })
                as Box<dyn FnMut(JsValue, JsValue) -> JsValue>);
            let f: Function = eq.as_ref().clone().into();
            js_sys::Reflect::set(&obj, &JsValue::from_str("equals"), &f).unwrap();
            eq.forget();
            obj.into()
        }),
    );
    let hits = Rc::new(RefCell::new(0));
    let hits2 = hits.clone();
    let s_for = sig.clone();
    let cb = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *hits2.borrow_mut() += 1;
        let _ = s_for.get_js();
    }) as Box<dyn FnMut()>);
    let f: Function = cb.as_ref().clone().into();
    let _eh = create_effect(f, None);
    assert_eq!(*hits.borrow(), 1);
    sig.set_js(JsValue::from_f64(1.0));
    assert_eq!(*hits.borrow(), 1);
    cb.forget();
}

#[wasm_bindgen_test]
/// 当 equals 总是返回 false 时，即使 set 为“同一个值”也会认为发生了变化并触发订阅者。
fn signal_equals_always_false_triggers() {
    set_reactive_scheduling("sync");
    let sig = create_signal(
        JsValue::from_f64(1.0),
        Some({
            let obj = js_sys::Object::new();
            let eq =
                wasm_bindgen::closure::Closure::wrap(Box::new(move |_a: JsValue, _b: JsValue| {
                    JsValue::from_bool(false)
                })
                    as Box<dyn FnMut(JsValue, JsValue) -> JsValue>);
            let f: Function = eq.as_ref().clone().into();
            js_sys::Reflect::set(&obj, &JsValue::from_str("equals"), &f).unwrap();
            eq.forget();
            obj.into()
        }),
    );
    let hits = Rc::new(RefCell::new(0));
    let hits2 = hits.clone();
    let s_for = sig.clone();
    let cb = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *hits2.borrow_mut() += 1;
        let _ = s_for.get_js();
    }) as Box<dyn FnMut()>);
    let f: Function = cb.as_ref().clone().into();
    let _eh = create_effect(f, None);
    assert_eq!(*hits.borrow(), 1);
    // 设置同一个值也会触发，因为 equals 恒为 false（认为不相等）
    sig.set_js(JsValue::from_f64(1.0));
    assert_eq!(*hits.borrow(), 2);
    cb.forget();
}

#[wasm_bindgen_test]
fn signal_and_ref_options_cover_non_function_equals_fallbacks() {
    set_reactive_scheduling("sync");
    let sig = create_signal(JsValue::from_f64(1.0), Some(JsValue::from_str("not-options")));
    sig.set_js(JsValue::from_f64(2.0));
    assert_eq!(sig.peek_js().as_f64(), Some(2.0));

    let opts = Object::new();
    Reflect::set(&opts, &JsValue::from_str("equals"), &JsValue::from_str("not-a-function"))
        .unwrap();
    let r = create_ref(JsValue::from_str("A"), Some(opts.into()));
    Reflect::set(&r, &JsValue::from_str("value"), &JsValue::from_str("B")).unwrap();
    assert_eq!(
        Reflect::get(&r, &JsValue::from_str("value")).unwrap().as_string().as_deref(),
        Some("B")
    );
}

#[wasm_bindgen_test]
/// `update_js` 使用更新器函数计算新值；`peek_js` 只读当前值且不建立订阅关系。
fn signal_update_and_peek() {
    set_reactive_scheduling("sync");
    let sig = create_signal(JsValue::from_f64(1.0), None);
    let first = sig.peek_js().as_f64().unwrap();
    assert_eq!(first, 1.0);
    let inc = wasm_bindgen::closure::Closure::wrap(Box::new(move |x: JsValue| {
        let v = x.as_f64().unwrap();
        JsValue::from_f64(v + 1.0)
    }) as Box<dyn FnMut(JsValue) -> JsValue>);
    let f: Function = inc.as_ref().clone().into();
    sig.update_js(f);
    inc.forget();
    let after = sig.peek_js().as_f64().unwrap();
    assert_eq!(after, 2.0);
}

#[wasm_bindgen_test]
/// 在 Effect 中使用 `peek_js` 读取不会建立订阅，因此后续 set 不会再次运行。
fn peek_does_not_subscribe() {
    set_reactive_scheduling("sync");
    let sig = create_signal(JsValue::from_f64(0.0), None);
    let hits = Rc::new(RefCell::new(0));
    let hits2 = hits.clone();
    let s_for = sig.clone();
    let cb = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *hits2.borrow_mut() += 1;
        let _ = s_for.peek_js();
    }) as Box<dyn FnMut()>);
    let f: Function = cb.as_ref().clone().into();
    let _eh = create_effect(f, None);
    assert_eq!(*hits.borrow(), 1);
    sig.set_js(JsValue::from_f64(1.0));
    assert_eq!(*hits.borrow(), 1);
    cb.forget();
}

#[wasm_bindgen_test]
/// 路径读写：支持对嵌套对象/数组按路径 `get/set/update`，并正确触发依赖更新。
fn signal_path_get_set_update() {
    set_reactive_scheduling("sync");
    let profile = Object::new();
    Reflect::set(&profile, &JsValue::from_str("name"), &JsValue::from_str("A")).unwrap();
    let user = Object::new();
    Reflect::set(&user, &JsValue::from_str("profile"), &profile).unwrap();
    let items = Array::new();
    items.push(&JsValue::from_str("x"));
    let root = Object::new();
    Reflect::set(&root, &JsValue::from_str("user"), &user).unwrap();
    Reflect::set(&root, &JsValue::from_str("items"), &items).unwrap();
    let sig = create_signal(root.into(), None);

    let path_name = Array::new();
    path_name.push(&JsValue::from_str("user"));
    path_name.push(&JsValue::from_str("profile"));
    path_name.push(&JsValue::from_str("name"));

    let hits = Rc::new(RefCell::new(0));
    let hits2 = hits.clone();
    let s1 = sig.clone();
    let p1 = path_name.clone();
    let cb = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *hits2.borrow_mut() += 1;
        let _ = s1.get_path_js(p1.clone().into());
    }) as Box<dyn FnMut()>);
    let f: Function = cb.as_ref().clone().into();
    let _eh = create_effect(f, None);
    assert_eq!(*hits.borrow(), 1);

    sig.set_path_js(path_name.clone().into(), JsValue::from_str("B"));
    assert_eq!(*hits.borrow(), 2);
    let name = sig.get_path_js(path_name.clone().into()).as_string().unwrap();
    assert_eq!(name, "B");

    let path_item0 = Array::new();
    path_item0.push(&JsValue::from_str("items"));
    path_item0.push(&JsValue::from_f64(0.0));
    sig.set_path_js(path_item0.clone().into(), JsValue::from_str("y"));
    let v0 = sig.get_path_js(path_item0.clone().into()).as_string().unwrap();
    assert_eq!(v0, "y");

    let path_age = Array::new();
    path_age.push(&JsValue::from_str("user"));
    path_age.push(&JsValue::from_str("age"));
    sig.set_path_js(path_age.clone().into(), JsValue::from_f64(20.0));
    let inc = wasm_bindgen::closure::Closure::wrap(Box::new(move |x: JsValue| {
        let v = x.as_f64().unwrap_or(0.0);
        JsValue::from_f64(v + 1.0)
    }) as Box<dyn FnMut(JsValue) -> JsValue>);
    let f2: Function = inc.as_ref().clone().into();
    sig.update_path_js(path_age.clone().into(), f2);
    inc.forget();
    let age = sig.get_path_js(path_age.clone().into()).as_f64().unwrap();
    assert_eq!(age, 21.0);
    cb.forget();
}

#[wasm_bindgen_test]
/// 字符串路径：支持以 `.` 分隔的字符串路径，数字段转为数组索引。
fn signal_string_path_get_set_update() {
    set_reactive_scheduling("sync");
    let profile = Object::new();
    Reflect::set(&profile, &JsValue::from_str("name"), &JsValue::from_str("A")).unwrap();
    let user = Object::new();
    Reflect::set(&user, &JsValue::from_str("profile"), &profile).unwrap();
    Reflect::set(&user, &JsValue::from_str("age"), &JsValue::from_f64(20.0)).unwrap();
    let items = Array::new();
    items.push(&JsValue::from_str("x"));
    let root = Object::new();
    Reflect::set(&root, &JsValue::from_str("user"), &user).unwrap();
    Reflect::set(&root, &JsValue::from_str("items"), &items).unwrap();
    let sig = create_signal(root.into(), None);

    // getPath / setPath with string
    let name_before = sig.get_path_js(JsValue::from_str("user.profile.name")).as_string().unwrap();
    assert_eq!(name_before, "A");
    sig.set_path_js(JsValue::from_str("user.profile.name"), JsValue::from_str("B"));
    let name_after = sig.get_path_js(JsValue::from_str("user.profile.name")).as_string().unwrap();
    assert_eq!(name_after, "B");

    // array index via string
    sig.set_path_js(JsValue::from_str("items.0"), JsValue::from_str("y"));
    let v0 = sig.get_path_js(JsValue::from_str("items.0")).as_string().unwrap();
    assert_eq!(v0, "y");

    // updatePath via string
    let inc = wasm_bindgen::closure::Closure::wrap(Box::new(move |x: JsValue| {
        let v = x.as_f64().unwrap_or(0.0);
        JsValue::from_f64(v + 1.0)
    }) as Box<dyn FnMut(JsValue) -> JsValue>);
    let f: Function = inc.as_ref().clone().into();
    sig.update_path_js(JsValue::from_str("user.age"), f);
    inc.forget();
    let age = sig.get_path_js(JsValue::from_str("user.age")).as_f64().unwrap();
    assert_eq!(age, 21.0);
}

#[wasm_bindgen_test]
/// 路径订阅应按分支隔离：更新 left 分支不应触发订阅 right 分支的 effect。
fn signal_path_subscriptions_are_isolated_by_branch() {
    set_reactive_scheduling("sync");

    let left = Object::new();
    Reflect::set(&left, &JsValue::from_str("count"), &JsValue::from_f64(1.0)).unwrap();
    let right = Object::new();
    Reflect::set(&right, &JsValue::from_str("count"), &JsValue::from_f64(2.0)).unwrap();
    let root = Object::new();
    Reflect::set(&root, &JsValue::from_str("left"), &left).unwrap();
    Reflect::set(&root, &JsValue::from_str("right"), &right).unwrap();
    let sig = create_signal(root.into(), None);

    let left_path = Array::new();
    left_path.push(&JsValue::from_str("left"));
    left_path.push(&JsValue::from_str("count"));
    let right_path = Array::new();
    right_path.push(&JsValue::from_str("right"));
    right_path.push(&JsValue::from_str("count"));

    let left_hits = Rc::new(RefCell::new(0));
    let left_hits2 = left_hits.clone();
    let sig_left = sig.clone();
    let left_path_for_effect = left_path.clone();
    let left_cb = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *left_hits2.borrow_mut() += 1;
        let _ = sig_left.get_path_js(left_path_for_effect.clone().into());
    }) as Box<dyn FnMut()>);
    let left_fn: Function = left_cb.as_ref().clone().into();
    let _left_effect = create_effect(left_fn, None);

    let right_hits = Rc::new(RefCell::new(0));
    let right_hits2 = right_hits.clone();
    let sig_right = sig.clone();
    let right_path_for_effect = right_path.clone();
    let right_cb = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *right_hits2.borrow_mut() += 1;
        let _ = sig_right.get_path_js(right_path_for_effect.clone().into());
    }) as Box<dyn FnMut()>);
    let right_fn: Function = right_cb.as_ref().clone().into();
    let _right_effect = create_effect(right_fn, None);

    assert_eq!(*left_hits.borrow(), 1);
    assert_eq!(*right_hits.borrow(), 1);

    sig.set_path_js(left_path.into(), JsValue::from_f64(10.0));

    assert_eq!(*left_hits.borrow(), 2);
    assert_eq!(*right_hits.borrow(), 1);

    left_cb.forget();
    right_cb.forget();
}

#[wasm_bindgen_test]
/// 父路径整体替换时，应通知订阅子路径的 effect。
fn signal_parent_path_replace_notifies_child_subscribers() {
    set_reactive_scheduling("sync");

    let user = Object::new();
    Reflect::set(&user, &JsValue::from_str("name"), &JsValue::from_str("A")).unwrap();
    let root = Object::new();
    Reflect::set(&root, &JsValue::from_str("user"), &user).unwrap();
    let sig = create_signal(root.into(), None);

    let name_path = Array::new();
    name_path.push(&JsValue::from_str("user"));
    name_path.push(&JsValue::from_str("name"));

    let hits = Rc::new(RefCell::new(0));
    let hits2 = hits.clone();
    let sig_for_effect = sig.clone();
    let path_for_effect = name_path.clone();
    let cb = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *hits2.borrow_mut() += 1;
        let _ = sig_for_effect.get_path_js(path_for_effect.clone().into());
    }) as Box<dyn FnMut()>);
    let effect_fn: Function = cb.as_ref().clone().into();
    let _effect = create_effect(effect_fn, None);
    assert_eq!(*hits.borrow(), 1);

    let next_user = Object::new();
    Reflect::set(&next_user, &JsValue::from_str("name"), &JsValue::from_str("B")).unwrap();
    let user_path = Array::new();
    user_path.push(&JsValue::from_str("user"));
    sig.set_path_js(user_path.into(), next_user.into());

    assert_eq!(*hits.borrow(), 2);
    let next_name = sig.get_path_js(name_path.into()).as_string().unwrap();
    assert_eq!(next_name, "B");
    cb.forget();
}

#[wasm_bindgen_test]
fn signal_manual_trigger_and_markers_cover_public_getters() {
    set_reactive_scheduling("sync");

    let sig = create_signal(JsValue::from_f64(1.0), None);
    assert!(!sig.ref_marker());
    assert!(!sig.readonly_marker());

    let hits = Rc::new(RefCell::new(0));
    let hits2 = hits.clone();
    let sig_for_effect = sig.clone();
    let cb = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *hits2.borrow_mut() += 1;
        let _ = sig_for_effect.get_js();
    }) as Box<dyn FnMut()>);
    let effect_fn: Function = cb.as_ref().clone().into();
    let _effect = create_effect(effect_fn, None);

    assert_eq!(*hits.borrow(), 1);
    sig.trigger_js();
    assert_eq!(*hits.borrow(), 2);
    sig.trigger_path_js(JsValue::UNDEFINED);
    assert_eq!(*hits.borrow(), 3);

    cb.forget();
}

#[wasm_bindgen_test]
fn signal_manual_trigger_path_notifies_symbol_path_subscribers() {
    set_reactive_scheduling("sync");

    let symbol = Function::new_no_args("return Symbol('rue-path')").call0(&JsValue::NULL).unwrap();
    let boxed_symbol = Function::new_with_args("symbol", "return Object(symbol)")
        .call1(&JsValue::NULL, &symbol)
        .unwrap();
    let root = Object::new();
    Reflect::set(&root, &symbol, &JsValue::from_str("token")).unwrap();
    let sig = create_signal(root.into(), None);

    let path = Array::new();
    path.push(&boxed_symbol);

    let hits = Rc::new(RefCell::new(0));
    let hits2 = hits.clone();
    let sig_for_effect = sig.clone();
    let path_for_effect = path.clone();
    let cb = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *hits2.borrow_mut() += 1;
        let _ = sig_for_effect.get_path_js(path_for_effect.clone().into());
    }) as Box<dyn FnMut()>);
    let effect_fn: Function = cb.as_ref().clone().into();
    let _effect = create_effect(effect_fn, None);

    assert_eq!(*hits.borrow(), 1);
    sig.trigger_path_js(path.into());
    assert_eq!(*hits.borrow(), 2);

    cb.forget();
}

#[wasm_bindgen_test]
fn signal_manual_trigger_path_accepts_object_path_segments() {
    set_reactive_scheduling("sync");

    let sig = create_signal(Object::new().into(), None);
    let object_segment = Object::new();
    Reflect::set(&object_segment, &JsValue::from_str("id"), &JsValue::from_f64(1.0)).unwrap();

    let path = Array::new();
    path.push(&object_segment);

    let hits = Rc::new(RefCell::new(0));
    let hits2 = hits.clone();
    let sig_for_effect = sig.clone();
    let path_for_effect = path.clone();
    let cb = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *hits2.borrow_mut() += 1;
        let _ = sig_for_effect.get_path_js(path_for_effect.clone().into());
    }) as Box<dyn FnMut()>);
    let effect_fn: Function = cb.as_ref().clone().into();
    let _effect = create_effect(effect_fn, None);

    assert_eq!(*hits.borrow(), 1);
    sig.trigger_path_js(path.into());
    assert_eq!(*hits.borrow(), 2);

    cb.forget();
}

#[wasm_bindgen_test]
fn signal_manual_trigger_path_accepts_unstringifiable_function_segments() {
    set_reactive_scheduling("sync");

    let sig = create_signal(Object::new().into(), None);
    let function_segment = Function::new_no_args("return 1");

    let path = Array::new();
    path.push(&function_segment);

    let hits = Rc::new(RefCell::new(0));
    let hits2 = hits.clone();
    let sig_for_effect = sig.clone();
    let path_for_effect = path.clone();
    let cb = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *hits2.borrow_mut() += 1;
        let _ = sig_for_effect.get_path_js(path_for_effect.clone().into());
    }) as Box<dyn FnMut()>);
    let effect_fn: Function = cb.as_ref().clone().into();
    let _effect = create_effect(effect_fn, None);

    assert_eq!(*hits.borrow(), 1);
    sig.trigger_path_js(path.into());
    assert_eq!(*hits.borrow(), 2);

    cb.forget();
}

#[wasm_bindgen_test]
fn signal_trigger_path_empty_array_uses_path_key_fallback() {
    set_reactive_scheduling("sync");

    let root = Object::new();
    Reflect::set(&root, &JsValue::from_str("count"), &JsValue::from_f64(1.0)).unwrap();
    let sig = create_signal(root.into(), None);
    let empty_path = Array::new();

    let hits = Rc::new(RefCell::new(0));
    let hits2 = hits.clone();
    let sig_for_effect = sig.clone();
    let empty_for_effect = empty_path.clone();
    let cb = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *hits2.borrow_mut() += 1;
        let _ = sig_for_effect.get_path_js(empty_for_effect.clone().into());
    }) as Box<dyn FnMut()>);
    let effect_fn: Function = cb.as_ref().clone().into();
    let _effect = create_effect(effect_fn, None);

    assert_eq!(*hits.borrow(), 1);
    sig.trigger_path_js(empty_path.into());
    assert_eq!(*hits.borrow(), 2);

    cb.forget();
}

#[wasm_bindgen_test]
fn signal_path_edges_cover_disposed_subscribers_and_sparse_path_writes() {
    set_reactive_scheduling("sync");

    let sig = create_signal(Object::new().into(), None);
    let hits = Rc::new(RefCell::new(0));
    let hits2 = hits.clone();
    let sig_for_effect = sig.clone();
    let cb = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *hits2.borrow_mut() += 1;
        let _ = sig_for_effect.get_path_js(JsValue::from_str("user.name"));
    }) as Box<dyn FnMut()>);
    let effect_fn: Function = cb.as_ref().clone().into();
    let effect = create_effect(effect_fn, None);

    assert_eq!(*hits.borrow(), 1);
    effect.dispose_js();
    sig.set_path_js(JsValue::from_str("user.name"), JsValue::from_str("A"));
    assert_eq!(*hits.borrow(), 1);

    let user = sig.peek_path_js(JsValue::from_str("user"));
    assert_eq!(
        Reflect::get(&user, &JsValue::from_str("name")).unwrap().as_string().as_deref(),
        Some("A")
    );

    let primitive = create_signal(JsValue::from_f64(1.0), None);
    primitive
        .update_path_js(JsValue::UNDEFINED, Function::new_with_args("value", "return value + 1"));
    assert_eq!(primitive.peek_js().as_f64(), Some(2.0));

    primitive.set_path_js(JsValue::from_str("deep..0.value"), JsValue::from_str("leaf"));
    assert_eq!(
        primitive.peek_path_js(JsValue::from_str("deep.0.value")).as_string().as_deref(),
        Some("leaf")
    );

    cb.forget();
}

#[wasm_bindgen_test]
fn reactive_proxy_numeric_string_paths_are_publicly_reachable() {
    let arr = Array::new();
    arr.push(&JsValue::from_str("zero"));
    let proxy = create_reactive(arr.into(), None);
    assert_eq!(
        Reflect::get(&proxy, &JsValue::from_str("0")).unwrap().as_string().as_deref(),
        Some("zero")
    );
}

#[wasm_bindgen_test]
fn signal_array_string_index_and_empty_path_subscription_edges_are_publicly_reachable() {
    set_reactive_scheduling("sync");

    let items = Array::new();
    items.push(&JsValue::from_str("zero"));
    let root = Object::new();
    Reflect::set(&root, &JsValue::from_str("items"), &items).unwrap();
    let sig = create_signal(root.into(), None);

    let string_index_path = Array::new();
    string_index_path.push(&JsValue::from_str("items"));
    string_index_path.push(&JsValue::from_str("0"));
    sig.set_path_js(string_index_path.clone().into(), JsValue::from_str("updated"));
    assert_eq!(sig.peek_path_js(string_index_path.into()).as_string().as_deref(), Some("updated"));

    let root_hits = Rc::new(RefCell::new(0));
    let root_hits_for_effect = root_hits.clone();
    let sig_for_effect = sig.clone();
    let empty_path = Array::new();
    let cb = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *root_hits_for_effect.borrow_mut() += 1;
        let _ = sig_for_effect.get_path_js(empty_path.clone().into());
    }) as Box<dyn FnMut()>);
    let effect_fn: Function = cb.as_ref().clone().into();
    let effect = create_effect(effect_fn, None);
    assert_eq!(*root_hits.borrow(), 1);

    effect.dispose_js();
    sig.trigger_js();
    assert_eq!(*root_hits.borrow(), 1);
    cb.forget();
}

#[wasm_bindgen_test]
fn reactive_primitive_proxy_value_descriptor_reads_object_and_primitive_holders() {
    let proxy = create_reactive(JsValue::from_str("first"), None);
    assert_eq!(
        Reflect::get(&proxy, &JsValue::from_str("value")).unwrap().as_string().as_deref(),
        Some("first")
    );
    assert_eq!(Object::keys(&proxy.clone().unchecked_into::<Object>()).length(), 0);

    let signal = Reflect::get(&proxy, &JsValue::from_str("__signal__")).unwrap();
    let set: Function = Reflect::get(&signal, &JsValue::from_str("set")).unwrap().unchecked_into();
    set.call1(&signal, &JsValue::from_str("plain-holder")).unwrap();

    assert_eq!(
        Reflect::get(&proxy, &JsValue::from_str("value")).unwrap().as_string().as_deref(),
        None
    );
}

#[wasm_bindgen_test]
fn computed_getter_self_read_does_not_subscribe_to_its_own_effect() {
    set_reactive_scheduling("sync");

    let holder: Rc<RefCell<Option<SignalHandle>>> = Rc::new(RefCell::new(None));
    let getter_holder = holder.clone();
    let getter = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        getter_holder
            .borrow()
            .as_ref()
            .map(|handle| handle.get_js())
            .unwrap_or_else(|| JsValue::from_f64(1.0))
    }) as Box<dyn FnMut() -> JsValue>);
    let computed = create_computed(getter.as_ref().clone().unchecked_into::<Function>().into());
    *holder.borrow_mut() = Some(computed.clone());

    assert!(computed.get_js().is_undefined());
    assert!(computed.get_js().is_undefined());

    getter.forget();
}

#[wasm_bindgen_test]
fn signal_root_disposed_subscriber_is_pruned_on_manual_trigger() {
    set_reactive_scheduling("sync");

    let sig = create_signal(JsValue::from_f64(0.0), None);
    let hits = Rc::new(RefCell::new(0));
    let hits_for_effect = hits.clone();
    let sig_for_effect = sig.clone();
    let cb = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *hits_for_effect.borrow_mut() += 1;
        let _ = sig_for_effect.get_js();
    }) as Box<dyn FnMut()>);
    let effect = create_effect(cb.as_ref().clone().unchecked_into::<Function>(), None);
    assert_eq!(*hits.borrow(), 1);

    effect.dispose_js();
    sig.trigger_js();
    sig.set_js(JsValue::from_f64(1.0));
    assert_eq!(*hits.borrow(), 1);

    cb.forget();
}

#[wasm_bindgen_test]
fn computed_path_self_read_does_not_subscribe_to_its_own_effect() {
    set_reactive_scheduling("sync");

    let holder: Rc<RefCell<Option<SignalHandle>>> = Rc::new(RefCell::new(None));
    let getter_holder = holder.clone();
    let getter = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        getter_holder
            .borrow()
            .as_ref()
            .map(|handle| handle.get_path_js(JsValue::from_str("value")))
            .unwrap_or_else(|| JsValue::from_f64(1.0))
    }) as Box<dyn FnMut() -> JsValue>);
    let computed = create_computed(getter.as_ref().clone().unchecked_into::<Function>().into());
    *holder.borrow_mut() = Some(computed.clone());

    assert!(computed.get_js().is_undefined());
    assert!(computed.get_path_js(JsValue::from_str("value")).is_undefined());

    getter.forget();
}

#[wasm_bindgen_test]
fn reactive_proxy_public_edges_cover_numeric_paths_and_snapshot_helpers() {
    set_reactive_scheduling("sync");

    let opts = JsValue::from_str("not-options");
    let primitive_proxy = create_reactive(JsValue::from_str("wrapped"), Some(opts));
    assert_eq!(
        Reflect::get(&primitive_proxy, &JsValue::from_str("value")).unwrap().as_string().as_deref(),
        Some("wrapped")
    );

    let root = Object::new();
    let list = Array::new();
    list.push(&JsValue::from_str("zero"));
    list.push(&JsValue::from_str("one"));
    Reflect::set(&root, &JsValue::from_str("list"), &list).unwrap();
    let proxy = create_reactive(root.into(), None);

    let list_proxy = Reflect::get(&proxy, &JsValue::from_str("list")).unwrap();
    assert_eq!(
        Reflect::get(&list_proxy, &JsValue::from_str("1")).unwrap().as_string().as_deref(),
        Some("one")
    );

    let length_desc = js_sys::Object::get_own_property_descriptor(
        &list_proxy.clone().unchecked_into::<Object>(),
        &JsValue::from_str("length"),
    );
    assert!(length_desc.is_object());

    let replacement = Object::new();
    Reflect::set(&replacement, &JsValue::from_str("next"), &JsValue::from_f64(2.0)).unwrap();
    Reflect::set(&proxy, &JsValue::from_str("list"), &replacement).unwrap();
    let target = Reflect::get(&proxy, &JsValue::from_str("__rue_target__")).unwrap();
    assert_eq!(
        Reflect::get(&target, &JsValue::from_str("list")).unwrap().dyn_ref::<Object>().is_some(),
        true
    );
}

#[wasm_bindgen_test]
fn reactive_proxy_large_numeric_string_key_stays_string() {
    set_reactive_scheduling("sync");

    let huge_index = "4294967296";
    let root = Object::new();
    Reflect::set(&root, &JsValue::from_str(huge_index), &JsValue::from_str("huge")).unwrap();
    let proxy = create_reactive(root.into(), None);

    assert_eq!(
        Reflect::get(&proxy, &JsValue::from_str(huge_index)).unwrap().as_string().as_deref(),
        Some("huge")
    );
}

#[wasm_bindgen_test]
fn reactive_proxy_own_keys_preserve_non_configurable_target_keys() {
    set_reactive_scheduling("sync");

    let proxy = create_reactive(Object::new().into(), None);
    let proxy_object: Object = proxy.clone().unchecked_into();

    let stable_desc = Object::new();
    Reflect::set(&stable_desc, &JsValue::from_str("value"), &JsValue::from_str("stable")).unwrap();
    Reflect::set(&stable_desc, &JsValue::from_str("enumerable"), &JsValue::TRUE).unwrap();
    Reflect::set(&stable_desc, &JsValue::from_str("configurable"), &JsValue::FALSE).unwrap();
    Object::define_property(&proxy_object, &JsValue::from_str("stable"), &stable_desc);

    let soft_desc = Object::new();
    Reflect::set(&soft_desc, &JsValue::from_str("value"), &JsValue::from_str("soft")).unwrap();
    Reflect::set(&soft_desc, &JsValue::from_str("enumerable"), &JsValue::TRUE).unwrap();
    Reflect::set(&soft_desc, &JsValue::from_str("configurable"), &JsValue::TRUE).unwrap();
    Object::define_property(&proxy_object, &JsValue::from_str("soft"), &soft_desc);

    let keys = Reflect::own_keys(&proxy).unwrap();
    let includes_stable: Function =
        Function::new_with_args("keys", "return keys.indexOf('stable') !== -1");
    assert_eq!(includes_stable.call1(&JsValue::NULL, &keys).unwrap().as_bool(), Some(true));

    let stable_read =
        Object::get_own_property_descriptor(&proxy_object, &JsValue::from_str("stable"));
    assert_eq!(
        Reflect::get(&stable_read, &JsValue::from_str("configurable")).unwrap().as_bool(),
        Some(false)
    );

    let soft_read = Object::get_own_property_descriptor(&proxy_object, &JsValue::from_str("soft"));
    assert!(soft_read.is_undefined());
}

#[wasm_bindgen_test]
fn stale_child_proxy_set_handles_primitive_latest_snapshot() {
    set_reactive_scheduling("sync");

    let child = Object::new();
    Reflect::set(&child, &JsValue::from_str("name"), &JsValue::from_str("A")).unwrap();
    let root = Object::new();
    Reflect::set(&root, &JsValue::from_str("child"), &child).unwrap();
    let proxy = create_reactive(root.into(), None);
    let child_proxy = Reflect::get(&proxy, &JsValue::from_str("child")).unwrap();

    let signal = Reflect::get(&proxy, &JsValue::from_str("__signal__")).unwrap();
    let set_path: Function =
        Reflect::get(&signal, &JsValue::from_str("setPath")).unwrap().unchecked_into();
    set_path
        .call2(&signal, &JsValue::from_str("child"), &JsValue::from_str("plain-child"))
        .unwrap();

    assert_eq!(
        Reflect::get(&proxy, &JsValue::from_str("child")).unwrap().as_string().as_deref(),
        Some("plain-child")
    );
    assert_eq!(
        Reflect::set(&child_proxy, &JsValue::from_str("name"), &JsValue::from_str("B")).unwrap(),
        true
    );
    assert_eq!(
        Reflect::get(&proxy, &JsValue::from_str("child")).unwrap().as_string().as_deref(),
        Some("plain-child")
    );
}
