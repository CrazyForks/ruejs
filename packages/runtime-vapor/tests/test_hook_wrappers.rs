/*
Hook wrapper 测试。

覆盖 Rust/Wasm hook 封装层的基础响应式能力、scope 清理和代理判定辅助函数。
*/
use js_sys::{Array, Function, Object, Reflect};
use rue_runtime_vapor::reactive::core::{
    create_effect_scope, current_effect_id, current_effect_scope_wasm, dispose_effect_scope,
    on_scope_dispose, pop_effect_scope, push_effect_scope,
};
use rue_runtime_vapor::reactive::signal::SignalHandle;
use rue_runtime_vapor::{
    computed_js as computed_hook, create_effect, is_proxy as is_proxy_hook,
    is_reactive as is_reactive_hook, is_readonly as is_readonly_hook, is_ref as is_ref_hook,
    reactive_js as reactive_hook, readonly_js as readonly_hook, ref_js as ref_hook,
    set_current_instance, set_reactive_scheduling, shallow_reactive_js as shallow_reactive_hook,
    shallow_readonly_js as shallow_readonly_hook, signal_js as signal_hook,
    to_raw_js as to_raw_hook,
};
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use wasm_bindgen_test::*;

use rue_runtime_vapor::vapor_with_hook_id;
use rue_runtime_vapor::with_hook_slot as with_slot;

#[wasm_bindgen_test]
fn on_scope_dispose_runs_when_effect_scope_is_disposed() {
    set_reactive_scheduling("sync");

    let scope = create_effect_scope();
    push_effect_scope(scope);
    assert_eq!(current_effect_scope_wasm().as_f64(), Some(scope as f64));

    let hits = Array::new();
    let hits_for_cleanup = hits.clone();
    let cleanup = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        hits_for_cleanup.push(&JsValue::from_str("disposed"));
    }) as Box<dyn FnMut()>);
    on_scope_dispose(cleanup.as_ref().clone().unchecked_into(), Some(false));
    cleanup.forget();

    assert_eq!(pop_effect_scope(), Some(scope));
    assert_eq!(hits.length(), 0);

    dispose_effect_scope(scope);
    assert_eq!(hits.length(), 1);
    dispose_effect_scope(scope);
    assert_eq!(hits.length(), 1);
}

#[wasm_bindgen_test]
fn on_scope_dispose_without_active_scope_can_fail_silently() {
    assert!(current_effect_scope_wasm().is_undefined());

    let cleanup = wasm_bindgen::closure::Closure::wrap(Box::new(|| {}) as Box<dyn FnMut()>);
    on_scope_dispose(cleanup.as_ref().clone().unchecked_into(), Some(true));
    cleanup.forget();
}

#[wasm_bindgen_test]
fn on_scope_dispose_without_active_scope_warns_when_not_silent() {
    assert!(current_effect_scope_wasm().is_undefined());

    let cleanup = wasm_bindgen::closure::Closure::wrap(Box::new(|| {}) as Box<dyn FnMut()>);
    on_scope_dispose(cleanup.as_ref().clone().unchecked_into(), Some(false));
    cleanup.forget();
}

#[wasm_bindgen_test]
fn current_effect_id_is_defined_only_while_effect_is_running() {
    set_reactive_scheduling("sync");
    assert!(current_effect_id().is_undefined());

    let observed = std::rc::Rc::new(std::cell::RefCell::new(None::<JsValue>));
    let observed_for_effect = observed.clone();
    let cb = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *observed_for_effect.borrow_mut() = Some(current_effect_id());
    }) as Box<dyn FnMut()>);
    let effect_fn: Function = cb.as_ref().clone().into();
    let _effect = create_effect(effect_fn, None);

    assert!(observed.borrow().as_ref().and_then(JsValue::as_f64).unwrap_or(0.0) > 0.0);
    assert!(current_effect_id().is_undefined());

    cb.forget();
}

#[wasm_bindgen_test]
fn hook_ref_basic_value_read_write() {
    set_reactive_scheduling("sync");
    set_current_instance(Object::new().into());
    let r = ref_hook(JsValue::from_f64(1.0), None, None);
    let v1 = Reflect::get(&r, &JsValue::from_str("value")).unwrap().as_f64().unwrap();
    assert_eq!(v1, 1.0);
    let _ = Reflect::set(&r, &JsValue::from_str("value"), &JsValue::from_f64(2.0));
    let v2 = Reflect::get(&r, &JsValue::from_str("value")).unwrap().as_f64().unwrap();
    assert_eq!(v2, 2.0);
}

#[wasm_bindgen_test]
fn hook_ref_global_and_slot_reuse_paths_are_distinct() {
    set_reactive_scheduling("sync");
    set_current_instance(JsValue::UNDEFINED);

    let global_a = ref_hook(JsValue::from_str("a"), None, None);
    let global_b = ref_hook(JsValue::from_str("b"), None, Some(true));
    assert_eq!(
        Reflect::get(&global_a, &JsValue::from_str("value")).unwrap().as_string().as_deref(),
        Some("a"),
    );
    assert_eq!(
        Reflect::get(&global_b, &JsValue::from_str("value")).unwrap().as_string().as_deref(),
        Some("b"),
    );
    assert!(!js_sys::Object::is(&global_a, &global_b));

    set_current_instance(Object::new().into());
    let first_store = std::rc::Rc::new(std::cell::RefCell::new(None::<JsValue>));
    let second_store = first_store.clone();
    let render = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        let value = ref_hook(JsValue::from_str("slot-initial"), None, None);
        if second_store.borrow().is_none() {
            *second_store.borrow_mut() = Some(value.clone());
        }
        value
    }) as Box<dyn FnMut() -> JsValue>);
    let first = vapor_with_hook_id(
        JsValue::from_str("ref:reuse"),
        render.as_ref().clone().unchecked_into(),
    );
    let second = vapor_with_hook_id(
        JsValue::from_str("ref:reuse"),
        render.as_ref().clone().unchecked_into(),
    );
    assert!(js_sys::Object::is(&first, &second));
    assert!(js_sys::Object::is(&first, first_store.borrow().as_ref().expect("stored slot ref"),));
    render.forget();
}

#[wasm_bindgen_test]
fn hook_reactive_nested_write_triggers() {
    set_reactive_scheduling("sync");
    set_current_instance(Object::new().into());
    let root = Object::new();
    let user = Object::new();
    let _ = Reflect::set(&user, &JsValue::from_str("name"), &JsValue::from_str("A"));
    let _ = Reflect::set(&root, &JsValue::from_str("user"), &user);
    let proxy = reactive_hook(root.into(), None, None);
    // 写入嵌套字段
    let u2 = Reflect::get(&proxy, &JsValue::from_str("user")).unwrap();
    let _ = Reflect::set(&u2, &JsValue::from_str("name"), &JsValue::from_str("B"));
    let name = Reflect::get(&u2, &JsValue::from_str("name")).unwrap().as_string().unwrap();
    assert_eq!(name, "B");
}

#[wasm_bindgen_test]
fn hook_vapor_with_hook_id_assigns_stable_slot() {
    set_reactive_scheduling("sync");
    let inst = Object::new();
    set_current_instance(inst.clone().into());
    // 第一次为 id=a 创建插槽，内容为 "A"
    let make_a = wasm_bindgen::closure::Closure::wrap(Box::new(|| {
        with_slot(Function::new_no_args("return 'A'"))
    }) as Box<dyn FnMut() -> JsValue>);
    let ra = vapor_with_hook_id(JsValue::from_str("a"), make_a.as_ref().clone().unchecked_into());
    make_a.forget();
    assert_eq!(ra.as_string().unwrap(), "A");
    // 第二次为 id=b 创建插槽，内容为 "B"
    let make_b = wasm_bindgen::closure::Closure::wrap(Box::new(|| {
        with_slot(Function::new_no_args("return 'B'"))
    }) as Box<dyn FnMut() -> JsValue>);
    let rb = vapor_with_hook_id(JsValue::from_str("b"), make_b.as_ref().clone().unchecked_into());
    make_b.forget();
    assert_eq!(rb.as_string().unwrap(), "B");
    // 第三次再次使用 id=a，尝试覆盖为 "A2"；应复用原插槽返回 "A"
    let make_a2 = wasm_bindgen::closure::Closure::wrap(Box::new(|| {
        with_slot(Function::new_no_args("return 'A2'"))
    }) as Box<dyn FnMut() -> JsValue>);
    let ra2 = vapor_with_hook_id(JsValue::from_str("a"), make_a2.as_ref().clone().unchecked_into());
    make_a2.forget();
    assert_eq!(ra2.as_string().unwrap(), "A");
}

#[wasm_bindgen_test]
fn hook_signal_and_computed_work() {
    set_reactive_scheduling("sync");
    set_current_instance(Object::new().into());
    let s = signal_hook(JsValue::from_f64(1.0), None, None);
    let _c = computed_hook(Function::new_with_args("", "return this.get()*2").into(), None);
    // 绑定 computed 的 this 到 s 对象的 get；此处直接通过闭包创建更可靠
    let s1 = s.clone();
    let getter = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        let v = s1.get_js().as_f64().unwrap();
        JsValue::from_f64(v * 2.0)
    }) as Box<dyn FnMut() -> JsValue>);
    let c2 = computed_hook(getter.as_ref().clone().unchecked_into::<Function>().into(), None);
    getter.forget();
    // 初值
    let v0 = c2.get_js().as_f64().unwrap();
    assert_eq!(v0, 2.0);
    // 更新源信号
    s.set_js(JsValue::from_f64(3.0));
    let v1 = c2.get_js().as_f64().unwrap();
    assert_eq!(v1, 6.0);
}

#[wasm_bindgen_test]
fn hook_signal_force_global_skips_hook_slot() {
    set_reactive_scheduling("sync");
    set_current_instance(Object::new().into());

    let first = signal_hook(JsValue::from_str("global-a"), None, Some(true));
    let second = signal_hook(JsValue::from_str("global-b"), None, Some(true));

    assert_eq!(first.get_js().as_string().as_deref(), Some("global-a"));
    assert_eq!(second.get_js().as_string().as_deref(), Some("global-b"));
    assert!(!Object::is(&first.into(), &second.into()));
}

#[wasm_bindgen_test]
fn hook_computed_global_paths_cover_force_and_null_instance() {
    set_reactive_scheduling("sync");
    set_current_instance(Object::new().into());
    let forced = computed_hook(Function::new_no_args("return 'forced'").into(), Some(true));
    assert_eq!(forced.get_js().as_string().as_deref(), Some("forced"));

    set_current_instance(JsValue::NULL);
    let null_instance = computed_hook(Function::new_no_args("return 'null-instance'").into(), None);
    assert_eq!(null_instance.get_js().as_string().as_deref(), Some("null-instance"));

    set_current_instance(JsValue::UNDEFINED);
}

#[wasm_bindgen_test]
fn hook_computed_reuses_handle_across_render_scopes_and_refreshes_getter() {
    set_reactive_scheduling("sync");
    let inst = Object::new();
    set_current_instance(inst.into());

    let source = signal_hook(JsValue::from_f64(1.0), None, None);

    let scope1 = create_effect_scope();
    push_effect_scope(scope1);
    let handle1_store = std::rc::Rc::new(std::cell::RefCell::new(None::<SignalHandle>));
    let source1 = source.clone();
    let getter1 = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        let value = source1.get_js().as_f64().unwrap();
        JsValue::from_f64(value + 10.0)
    }) as Box<dyn FnMut() -> JsValue>);
    let getter1_fn: Function = getter1.as_ref().clone().unchecked_into();
    let handle1_store_for_render = handle1_store.clone();
    let render1 = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *handle1_store_for_render.borrow_mut() =
            Some(computed_hook(getter1_fn.clone().into(), None));
        JsValue::UNDEFINED
    }) as Box<dyn FnMut() -> JsValue>);
    let _ = vapor_with_hook_id(
        JsValue::from_str("computed:reuse"),
        render1.as_ref().clone().unchecked_into(),
    );
    getter1.forget();
    render1.forget();
    let handle1 = handle1_store.borrow().as_ref().unwrap().clone();
    assert_eq!(handle1.get_js().as_f64().unwrap(), 11.0);
    assert_eq!(pop_effect_scope(), Some(scope1));
    dispose_effect_scope(scope1);

    let scope2 = create_effect_scope();
    push_effect_scope(scope2);
    let handle2_store = std::rc::Rc::new(std::cell::RefCell::new(None::<SignalHandle>));
    let source2 = source.clone();
    let getter2 = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        let value = source2.get_js().as_f64().unwrap();
        JsValue::from_f64(value + 100.0)
    }) as Box<dyn FnMut() -> JsValue>);
    let getter2_fn: Function = getter2.as_ref().clone().unchecked_into();
    let handle2_store_for_render = handle2_store.clone();
    let render2 = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *handle2_store_for_render.borrow_mut() =
            Some(computed_hook(getter2_fn.clone().into(), None));
        JsValue::UNDEFINED
    }) as Box<dyn FnMut() -> JsValue>);
    let _ = vapor_with_hook_id(
        JsValue::from_str("computed:reuse"),
        render2.as_ref().clone().unchecked_into(),
    );
    getter2.forget();
    render2.forget();
    let handle2 = handle2_store.borrow().as_ref().unwrap().clone();

    assert_eq!(handle1.get_js().as_f64().unwrap(), 101.0);
    assert_eq!(handle2.get_js().as_f64().unwrap(), 101.0);
    assert_eq!(pop_effect_scope(), Some(scope2));
    dispose_effect_scope(scope2);

    source.set_js(JsValue::from_f64(2.0));
    assert_eq!(handle1.get_js().as_f64().unwrap(), 102.0);
    assert_eq!(handle2.get_js().as_f64().unwrap(), 102.0);
}

#[wasm_bindgen_test]
fn hook_computed_reused_dynamic_arg_handles_missing_getter_and_setter() {
    set_reactive_scheduling("sync");
    let inst = Object::new();
    set_current_instance(inst.into());

    let global = js_sys::global();
    Reflect::delete_property(&global, &JsValue::from_str("__plan999_computed_setter_seen"))
        .unwrap();

    let initial_arg = Object::new();
    Reflect::set(&initial_arg, &JsValue::from_str("get"), &Function::new_no_args("return 10"))
        .unwrap();
    Reflect::set(
        &initial_arg,
        &JsValue::from_str("set"),
        &Function::new_with_args("value", "globalThis.__plan999_computed_setter_seen = value"),
    )
    .unwrap();

    let handle_store = std::rc::Rc::new(std::cell::RefCell::new(None::<SignalHandle>));
    let handle_store_for_first = handle_store.clone();
    let initial_arg_value = JsValue::from(initial_arg.clone());
    let first_render = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *handle_store_for_first.borrow_mut() = Some(computed_hook(initial_arg_value.clone(), None));
        JsValue::UNDEFINED
    }) as Box<dyn FnMut() -> JsValue>);
    let _ = vapor_with_hook_id(
        JsValue::from_str("computed:missing-accessors"),
        first_render.as_ref().clone().unchecked_into(),
    );
    first_render.forget();

    let handle = handle_store.borrow().as_ref().unwrap().clone();
    assert_eq!(handle.get_js().as_f64(), Some(10.0));
    handle.set_js(JsValue::from_str("written"));
    assert_eq!(
        Reflect::get(&global, &JsValue::from_str("__plan999_computed_setter_seen"))
            .unwrap()
            .as_string()
            .as_deref(),
        Some("written"),
    );

    let missing_accessors = Object::new();
    let handle_store_for_second = handle_store.clone();
    let missing_accessors_value = JsValue::from(missing_accessors);
    let second_render = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *handle_store_for_second.borrow_mut() =
            Some(computed_hook(missing_accessors_value.clone(), None));
        JsValue::UNDEFINED
    }) as Box<dyn FnMut() -> JsValue>);
    let _ = vapor_with_hook_id(
        JsValue::from_str("computed:missing-accessors"),
        second_render.as_ref().clone().unchecked_into(),
    );
    second_render.forget();

    let reused = handle_store.borrow().as_ref().unwrap().clone();
    assert!(reused.get_js().is_undefined());
    reused.set_js(JsValue::from_str("ignored"));
    assert_eq!(
        Reflect::get(&global, &JsValue::from_str("__plan999_computed_setter_seen"))
            .unwrap()
            .as_string()
            .as_deref(),
        Some("written"),
    );

    Reflect::delete_property(&global, &JsValue::from_str("__plan999_computed_setter_seen"))
        .unwrap();
    set_current_instance(JsValue::UNDEFINED);
}

#[wasm_bindgen_test]
fn hook_is_reactive_and_to_raw_smoke() {
    set_reactive_scheduling("sync");
    set_current_instance(Object::new().into());
    assert!(!is_reactive_hook(JsValue::from_f64(1.0)));
    assert!(!is_reactive_hook(JsValue::NULL));

    let obj = Object::new();
    let _ = Reflect::set(&obj, &JsValue::from_str("a"), &JsValue::from_f64(1.0));
    let proxy = reactive_hook(obj.into(), None, None);
    assert!(is_reactive_hook(proxy.clone()));
    assert!(is_proxy_hook(proxy.clone()));
    let _ = to_raw_hook(proxy.clone());

    let plain = Object::new();
    assert!(!is_reactive_hook(plain.into()));
    assert!(!is_proxy_hook(JsValue::from_f64(1.0)));
    assert!(!is_proxy_hook(JsValue::NULL));

    let marker = Object::new();
    let _ = Reflect::set(&marker, &JsValue::from_str("__isReactive__"), &JsValue::from_str("yes"));
    assert!(is_proxy_hook(marker.clone().into()));
    assert!(is_reactive_hook(marker.into()));

    let sig_string = Object::new();
    let _ = Reflect::set(&sig_string, &JsValue::from_str("__signal__"), &JsValue::from_str("no"));
    assert!(!is_proxy_hook(sig_string.clone().into()));
    assert!(!is_reactive_hook(sig_string.into()));

    let sig_object = Object::new();
    let _ = Reflect::set(&sig_object, &JsValue::from_str("__signal__"), &Object::new());
    assert!(is_proxy_hook(sig_object.clone().into()));
    assert!(is_reactive_hook(sig_object.into()));

    let ro = readonly_hook(Object::new().into(), None);
    assert!(is_proxy_hook(ro));

    // Ref 场景
    let r = ref_hook(JsValue::from_str("x"), None, None);
    assert!(!is_proxy_hook(r.clone()));
    let _ = to_raw_hook(r.clone());
}

#[wasm_bindgen_test]
fn hook_is_ref_and_is_readonly_cover_public_marker_paths() {
    assert!(!is_ref_hook(JsValue::from_f64(1.0)));
    assert!(!is_ref_hook(JsValue::NULL));
    assert!(!is_readonly_hook(JsValue::from_str("plain")));

    let raw_ref = Object::new();
    let _ = Reflect::set(&raw_ref, &JsValue::from_str("__rue_ref__"), &JsValue::TRUE);
    assert!(is_ref_hook(raw_ref.clone().into()));

    let wrapped_ref = Object::new();
    let _ = Reflect::set(&wrapped_ref, &JsValue::from_str("__rue_raw__"), &raw_ref);
    assert!(is_ref_hook(wrapped_ref.into()));

    let false_ref = Object::new();
    let _ = Reflect::set(&false_ref, &JsValue::from_str("__rue_ref__"), &JsValue::FALSE);
    assert!(!is_ref_hook(false_ref.into()));

    let readonly_marker = Object::new();
    let _ = Reflect::set(&readonly_marker, &JsValue::from_str("__isReadonly__"), &JsValue::TRUE);
    assert!(is_readonly_hook(readonly_marker.into()));

    let readonly_string_marker = Object::new();
    let _ = Reflect::set(
        &readonly_string_marker,
        &JsValue::from_str("__isReadonly__"),
        &JsValue::from_str("true"),
    );
    assert!(!is_readonly_hook(readonly_string_marker.into()));
}

#[wasm_bindgen_test]
fn hook_to_raw_unwraps_reactive_readonly_shallow_and_nested_values() {
    set_reactive_scheduling("sync");
    set_current_instance(Object::new().into());

    let items = Array::new();
    items.push(&JsValue::from_str("first"));
    let nested = Object::new();
    let _ = Reflect::set(&nested, &JsValue::from_str("label"), &JsValue::from_str("raw-child"));
    items.push(&nested.clone().into());

    let root = Object::new();
    let _ = Reflect::set(&root, &JsValue::from_str("items"), &items.clone().into());
    let proxy = reactive_hook(root.clone().into(), None, None);
    let raw = to_raw_hook(proxy.clone());
    assert!(js_sys::Object::is(&raw, &root.clone().into()));

    let proxy_items = Reflect::get(&proxy, &JsValue::from_str("items")).unwrap();
    let raw_items = to_raw_hook(proxy_items);
    assert!(js_sys::Array::is_array(&raw_items));
    assert_eq!(Array::from(&raw_items).get(0).as_string().as_deref(), Some("first"));

    let readonly = readonly_hook(root.clone().into(), None);
    assert!(js_sys::Object::is(&to_raw_hook(readonly), &root.clone().into()));

    let shallow = shallow_reactive_hook(root.clone().into(), None, None);
    assert!(js_sys::Object::is(&to_raw_hook(shallow), &root.clone().into()));
}

#[wasm_bindgen_test]
fn hook_to_raw_unwraps_ref_signal_getter_and_preserves_primitives() {
    set_reactive_scheduling("sync");
    set_current_instance(Object::new().into());

    let r = ref_hook(JsValue::from_str("ref-value"), None, Some(true));
    let _ = to_raw_hook(r);

    let ref_like = Object::new();
    let _ = Reflect::set(&ref_like, &JsValue::from_str("value"), &JsValue::from_str("ref-value"));
    assert_eq!(to_raw_hook(ref_like.into()).as_string().as_deref(), Some("ref-value"));

    let holder = Object::new();
    let _ = Reflect::set(&holder, &JsValue::from_str("value"), &JsValue::from_str("peek-value"));
    let peek = Function::new_with_args("", "return this._peekValue");
    let signal = Object::new();
    let _ = Reflect::set(&signal, &JsValue::from_str("_peekValue"), &holder.clone().into());
    let _ = Reflect::set(&signal, &JsValue::from_str("peek"), &peek);
    let wrapper = Object::new();
    let _ = Reflect::set(&wrapper, &JsValue::from_str("__signal__"), &signal);
    assert_eq!(to_raw_hook(wrapper.into()).as_string().as_deref(), Some("peek-value"));

    let primitive_peek_signal = Object::new();
    let primitive_peek = Function::new_with_args("", "return 'peek-primitive'");
    let _ = Reflect::set(&primitive_peek_signal, &JsValue::from_str("peek"), &primitive_peek);
    let primitive_peek_wrapper = Object::new();
    let _ = Reflect::set(
        &primitive_peek_wrapper,
        &JsValue::from_str("__signal__"),
        &primitive_peek_signal,
    );
    assert_eq!(
        to_raw_hook(primitive_peek_wrapper.into()).as_string().as_deref(),
        Some("peek-primitive"),
    );

    let get_signal = Object::new();
    let get = Function::new_with_args("", "return 'get-value'");
    let _ = Reflect::set(&get_signal, &JsValue::from_str("get"), &get);
    let get_wrapper = Object::new();
    let _ = Reflect::set(&get_wrapper, &JsValue::from_str("__signal__"), &get_signal);
    assert_eq!(to_raw_hook(get_wrapper.into()).as_string().as_deref(), Some("get-value"));

    let plain_getter = Object::new();
    let get_plain = Function::new_with_args("", "return 42");
    let _ = Reflect::set(&plain_getter, &JsValue::from_str("get"), &get_plain);
    assert_eq!(to_raw_hook(plain_getter.into()).as_f64(), Some(42.0));

    let raw_number_wrapper = Object::new();
    let _ = Reflect::set(
        &raw_number_wrapper,
        &JsValue::from_str("__rue_raw__"),
        &JsValue::from_f64(9.0),
    );
    assert_eq!(to_raw_hook(raw_number_wrapper.into()).as_f64(), Some(9.0));

    let raw_ref_without_value = Object::new();
    let _ = Reflect::set(&raw_ref_without_value, &JsValue::from_str("__rue_ref__"), &JsValue::TRUE);
    let raw_ref_wrapper = Object::new();
    let _ = Reflect::set(
        &raw_ref_wrapper,
        &JsValue::from_str("__rue_raw__"),
        &raw_ref_without_value.clone().into(),
    );
    let raw_ref_result = to_raw_hook(raw_ref_wrapper.into());
    assert!(js_sys::Object::is(&raw_ref_result, &raw_ref_without_value.into()));

    let peek_object_without_value = Object::new();
    let peek_object_signal = Object::new();
    let peek_object = Function::new_with_args("", "return this._peekValue");
    let _ = Reflect::set(
        &peek_object_signal,
        &JsValue::from_str("_peekValue"),
        &peek_object_without_value,
    );
    let _ = Reflect::set(&peek_object_signal, &JsValue::from_str("peek"), &peek_object);
    let peek_object_wrapper = Object::new();
    let _ =
        Reflect::set(&peek_object_wrapper, &JsValue::from_str("__signal__"), &peek_object_signal);
    let peek_raw = to_raw_hook(peek_object_wrapper.into());
    assert!(js_sys::Object::is(&peek_raw, &peek_object_without_value.into()));

    let get_holder = Object::new();
    let _ =
        Reflect::set(&get_holder, &JsValue::from_str("value"), &JsValue::from_str("get-object"));
    let get_object_signal = Object::new();
    let get_object = Function::new_with_args("", "return this._getValue");
    let _ = Reflect::set(&get_object_signal, &JsValue::from_str("_getValue"), &get_holder);
    let _ = Reflect::set(&get_object_signal, &JsValue::from_str("get"), &get_object);
    let get_object_wrapper = Object::new();
    let _ = Reflect::set(&get_object_wrapper, &JsValue::from_str("__signal__"), &get_object_signal);
    assert_eq!(to_raw_hook(get_object_wrapper.into()).as_string().as_deref(), Some("get-object"));

    let get_plain_object_signal = Object::new();
    let get_plain_object = Function::new_with_args("", "return this._getValue");
    let raw_without_value = Object::new();
    let _ =
        Reflect::set(&get_plain_object_signal, &JsValue::from_str("_getValue"), &raw_without_value);
    let _ = Reflect::set(&get_plain_object_signal, &JsValue::from_str("get"), &get_plain_object);
    let get_plain_object_wrapper = Object::new();
    let _ = Reflect::set(
        &get_plain_object_wrapper,
        &JsValue::from_str("__signal__"),
        &get_plain_object_signal,
    );
    let raw_without_value_result = to_raw_hook(get_plain_object_wrapper.into());
    assert!(js_sys::Object::is(&raw_without_value_result, &raw_without_value.into()));

    let missing_get_signal = Object::new();
    let missing_get_wrapper = Object::new();
    let _ =
        Reflect::set(&missing_get_wrapper, &JsValue::from_str("__signal__"), &missing_get_signal);
    let missing_get_result = to_raw_hook(missing_get_wrapper.clone().into());
    assert!(js_sys::Object::is(&missing_get_result, &missing_get_wrapper.into()));

    let undefined_signal = Object::new();
    let undefined_fn = Function::new_with_args("", "return undefined");
    let _ = Reflect::set(&undefined_signal, &JsValue::from_str("peek"), &undefined_fn);
    let _ = Reflect::set(&undefined_signal, &JsValue::from_str("get"), &undefined_fn);
    let undefined_wrapper = Object::new();
    let _ = Reflect::set(&undefined_wrapper, &JsValue::from_str("__signal__"), &undefined_signal);
    let returned = to_raw_hook(undefined_wrapper.clone().into());
    assert!(js_sys::Object::is(&returned, &undefined_wrapper.into()));

    let undefined_getter = Object::new();
    let _ = Reflect::set(&undefined_getter, &JsValue::from_str("get"), &undefined_fn);
    let returned_getter = to_raw_hook(undefined_getter.clone().into());
    assert!(js_sys::Object::is(&returned_getter, &undefined_getter.into()));

    let non_function_getter = Object::new();
    let _ = Reflect::set(
        &non_function_getter,
        &JsValue::from_str("get"),
        &JsValue::from_str("not-a-function"),
    );
    let returned_non_function_getter = to_raw_hook(non_function_getter.clone().into());
    assert!(js_sys::Object::is(&returned_non_function_getter, &non_function_getter.into(),));

    let primitive = JsValue::from_f64(7.0);
    assert_eq!(to_raw_hook(primitive).as_f64(), Some(7.0));
}

#[wasm_bindgen_test]
fn hook_readonly_blocks_top_level_set() {
    set_reactive_scheduling("sync");
    set_current_instance(Object::new().into());
    let obj = Object::new();
    let _ = Reflect::set(&obj, &JsValue::from_str("a"), &JsValue::from_f64(1.0));
    let ro = readonly_hook(obj.into(), None);
    let _ = Reflect::set(&ro, &JsValue::from_str("a"), &JsValue::from_f64(2.0));
    let a = Reflect::get(&ro, &JsValue::from_str("a")).unwrap().as_f64().unwrap();
    assert_eq!(a, 1.0);
}

#[wasm_bindgen_test]
fn hook_shallow_reactive_child_not_reactive_and_mutates() {
    set_reactive_scheduling("sync");
    set_current_instance(Object::new().into());
    let root = Object::new();
    let nested = Object::new();
    let _ = Reflect::set(&nested, &JsValue::from_str("name"), &JsValue::from_str("A"));
    let _ = Reflect::set(&root, &JsValue::from_str("nested"), &nested);
    let proxy = shallow_reactive_hook(root.into(), None, None);
    let child = Reflect::get(&proxy, &JsValue::from_str("nested")).unwrap();
    assert!(!is_reactive_hook(child.clone()));
    let _ = Reflect::set(&child, &JsValue::from_str("name"), &JsValue::from_str("B"));
    let name = Reflect::get(&child, &JsValue::from_str("name")).unwrap().as_string().unwrap();
    assert_eq!(name, "B");
}

#[wasm_bindgen_test]
fn hook_shallow_reactive_marks_object_options_and_rebuilds_invalid_options() {
    set_reactive_scheduling("sync");
    set_current_instance(JsValue::UNDEFINED);

    let object_options = Object::new();
    let root = Object::new();
    let nested = Object::new();
    let _ = Reflect::set(&nested, &JsValue::from_str("name"), &JsValue::from_str("A"));
    let _ = Reflect::set(&root, &JsValue::from_str("nested"), &nested);
    let proxy = shallow_reactive_hook(root.into(), Some(object_options.clone().into()), Some(true));
    assert_eq!(
        Reflect::get(&object_options, &JsValue::from_str("shallow")).unwrap().as_bool(),
        Some(true),
    );
    let child = Reflect::get(&proxy, &JsValue::from_str("nested")).unwrap();
    assert!(!is_reactive_hook(child));

    let invalid_options_root = Object::new();
    let invalid_nested = Object::new();
    let _ = Reflect::set(&invalid_nested, &JsValue::from_str("label"), &JsValue::from_str("B"));
    let _ = Reflect::set(&invalid_options_root, &JsValue::from_str("nested"), &invalid_nested);
    let invalid_options_proxy = shallow_reactive_hook(
        invalid_options_root.into(),
        Some(JsValue::from_str("not-options")),
        Some(true),
    );
    let invalid_child = Reflect::get(&invalid_options_proxy, &JsValue::from_str("nested")).unwrap();
    assert!(!is_reactive_hook(invalid_child));
}

#[wasm_bindgen_test]
fn hook_shallow_readonly_top_level_block_child_raw_mutates() {
    set_reactive_scheduling("sync");
    set_current_instance(Object::new().into());
    let root = Object::new();
    let nested = Object::new();
    let _ = Reflect::set(&nested, &JsValue::from_str("name"), &JsValue::from_str("A"));
    let _ = Reflect::set(&root, &JsValue::from_str("nested"), &nested);
    let proxy = shallow_readonly_hook(root.into(), None);
    // 顶层写入被阻止
    let _ = Reflect::set(&proxy, &JsValue::from_str("x"), &JsValue::from_f64(1.0));
    let x = Reflect::get(&proxy, &JsValue::from_str("x")).unwrap_or(JsValue::UNDEFINED);
    assert!(x.is_undefined());
    // 子对象为原始对象，可直接修改
    let child = Reflect::get(&proxy, &JsValue::from_str("nested")).unwrap();
    let _ = Reflect::set(&child, &JsValue::from_str("name"), &JsValue::from_str("B"));
    let name = Reflect::get(&child, &JsValue::from_str("name")).unwrap().as_string().unwrap();
    assert_eq!(name, "B");
}
