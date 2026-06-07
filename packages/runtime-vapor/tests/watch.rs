use js_sys::Promise;
use js_sys::{Array, Function, Object, Reflect};
use rue_runtime_vapor::{
    create_signal, set_reactive_scheduling, watch, watch_deep_signal, watch_path, watch_signal,
};
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::JsFuture;
use wasm_bindgen_test::*;

fn opts_immediate_true() -> JsValue {
    let o = Object::new();
    let _ = Reflect::set(&o, &JsValue::from_str("immediate"), &JsValue::from_bool(true));
    o.into()
}

fn opts_immediate_false() -> JsValue {
    let o = Object::new();
    let _ = Reflect::set(&o, &JsValue::from_str("immediate"), &JsValue::from_bool(false));
    o.into()
}

fn opts_immediate_true_with_equals(eq: &Function) -> JsValue {
    let o = Object::new();
    let _ = Reflect::set(&o, &JsValue::from_str("immediate"), &JsValue::from_bool(true));
    let _ = Reflect::set(&o, &JsValue::from_str("equals"), eq);
    o.into()
}

fn reset_rec() {
    let _ = Reflect::set(&js_sys::global(), &JsValue::from_str("_rec"), &Array::new());
}

fn handler_push() -> Function {
    Function::new_with_args("n,o", "globalThis._rec.push([n,o])")
}

fn rec() -> Array {
    Array::from(&Reflect::get(&js_sys::global(), &JsValue::from_str("_rec")).unwrap())
}

async fn wait_timeout(ms: f64) {
    let promise = Promise::new(&mut |resolve, _| {
        let global = js_sys::global();
        let set_timeout = Reflect::get(&global, &JsValue::from_str("setTimeout")).unwrap();
        let set_timeout_fn = set_timeout.unchecked_into::<Function>();
        let _ = set_timeout_fn.call2(&JsValue::NULL, &resolve, &JsValue::from_f64(ms));
    });
    JsFuture::from(promise).await.unwrap();
}

#[wasm_bindgen_test]
fn test_watch_signal_basic() {
    set_reactive_scheduling("sync");
    reset_rec();
    let s = create_signal(JsValue::from_f64(0.0), None);
    let _eh = watch_signal(&s, handler_push(), Some(opts_immediate_true()));
    let r = rec();
    assert_eq!(r.length(), 1);
    let e0 = Array::from(&r.get(0));
    assert_eq!(e0.get(0).as_f64().unwrap(), 0.0);
    assert!(e0.get(1).is_undefined());
    s.set_js(JsValue::from_f64(1.0));
    let r = rec();
    assert_eq!(r.length(), 2);
    let e1 = Array::from(&r.get(1));
    assert_eq!(e1.get(0).as_f64().unwrap(), 1.0);
    assert_eq!(e1.get(1).as_f64().unwrap(), 0.0);
}

#[wasm_bindgen_test]
fn test_watch_path_string() {
    set_reactive_scheduling("sync");
    reset_rec();
    let user = Object::new();
    let profile = Object::new();
    let _ = Reflect::set(&profile, &JsValue::from_str("name"), &JsValue::from_str("A"));
    let _ = Reflect::set(&user, &JsValue::from_str("profile"), &profile);
    let root = Object::new();
    let _ = Reflect::set(&root, &JsValue::from_str("user"), &user);
    let s = create_signal(root.into(), None);
    let _eh = watch_path(
        &s,
        JsValue::from_str("user.profile.name"),
        handler_push(),
        Some(opts_immediate_true()),
    );
    s.set_path_js(JsValue::from_str("user.profile.name"), JsValue::from_str("B"));
    let r = rec();
    assert_eq!(r.length(), 2);
    let e1 = Array::from(&r.get(1));
    assert_eq!(e1.get(0).as_string().unwrap(), "B");
    assert_eq!(e1.get(1).as_string().unwrap(), "A");
}

#[wasm_bindgen_test]
fn test_watch_deep_signal_default_eq() {
    set_reactive_scheduling("sync");
    reset_rec();
    let user = Object::new();
    let _ = Reflect::set(&user, &JsValue::from_str("name"), &JsValue::from_str("A"));
    let items = Array::new();
    items.push(&JsValue::from_str("x"));
    let root = Object::new();
    let _ = Reflect::set(&root, &JsValue::from_str("user"), &user);
    let _ = Reflect::set(&root, &JsValue::from_str("items"), &items);
    let s = create_signal(root.into(), None);
    let _eh = watch_deep_signal(&s, handler_push(), Some(opts_immediate_true()));
    s.set_path_js(
        Array::of2(&JsValue::from_str("items"), &JsValue::from_f64(0.0)).into(),
        JsValue::from_str("y"),
    );
    let r = rec();
    assert_eq!(r.length(), 2);
}

#[wasm_bindgen_test]
fn test_watch_deep_signal_custom_equals_no_trigger() {
    set_reactive_scheduling("sync");
    reset_rec();
    let root = Object::new();
    let _ = Reflect::set(&root, &JsValue::from_str("a"), &JsValue::from_f64(1.0));
    let s = create_signal(root.into(), None);
    let opts = Object::new();
    let eq = Function::new_with_args("prev,next", "return true");
    let _ = Reflect::set(&opts, &JsValue::from_str("immediate"), &JsValue::from_bool(true));
    let _ = Reflect::set(&opts, &JsValue::from_str("equals"), &eq);
    let _eh = watch_deep_signal(&s, handler_push(), Some(opts.into()));
    s.set_path_js(JsValue::from_str("a"), JsValue::from_f64(2.0));
    let r = rec();
    assert_eq!(r.length(), 1);
}

#[wasm_bindgen_test]
fn test_watch_unified_function() {
    set_reactive_scheduling("sync");
    reset_rec();
    let s = create_signal(JsValue::from_f64(1.0), None);
    let s1 = s.clone();
    let getter = wasm_bindgen::closure::Closure::wrap(
        Box::new(move || s1.get_js()) as Box<dyn FnMut() -> JsValue>
    );
    let getter_fn: Function = getter.as_ref().clone().unchecked_into();
    let opts = opts_immediate_true();
    let _eh = watch(getter_fn.into(), handler_push(), Some(opts));
    getter.forget();
    s.set_js(JsValue::from_f64(2.0));
    let r = rec();
    assert_eq!(r.length(), 2);
    let e1 = Array::from(&r.get(1));
    assert_eq!(e1.get(0).as_f64().unwrap(), 2.0);
    assert_eq!(e1.get(1).as_f64().unwrap(), 1.0);
}

#[wasm_bindgen_test]
fn test_watch_unified_array_sources() {
    set_reactive_scheduling("sync");
    reset_rec();
    let s1 = create_signal(JsValue::from_f64(0.0), None);
    let s2 = create_signal(JsValue::from_f64(10.0), None);
    let g1_sig = s1.clone();
    let g1 = wasm_bindgen::closure::Closure::wrap(
        Box::new(move || g1_sig.get_js()) as Box<dyn FnMut() -> JsValue>
    );
    let g1_fn: Function = g1.as_ref().clone().unchecked_into();
    let arr = Array::new();
    arr.push(&g1_fn);
    arr.push(&JsValue::from(s2.clone()));
    arr.push(&JsValue::from_str("x"));
    let _eh = watch(arr.into(), handler_push(), Some(opts_immediate_true()));
    g1.forget();
    s1.set_js(JsValue::from_f64(1.0));
    s2.set_js(JsValue::from_f64(11.0));
    let r = rec();
    assert_eq!(r.length(), 3);
    let e1 = Array::from(&r.get(1));
    assert!(Array::is_array(&e1.get(0)));
    let v1 = Array::from(&e1.get(0));
    assert_eq!(v1.get(0).as_f64().unwrap(), 1.0);
    assert_eq!(v1.get(1).as_f64().unwrap(), 10.0);
    let e2 = Array::from(&r.get(2));
    let v2 = Array::from(&e2.get(0));
    assert_eq!(v2.get(0).as_f64().unwrap(), 1.0);
    assert_eq!(v2.get(1).as_f64().unwrap(), 11.0);
}

#[wasm_bindgen_test]
fn test_watch_unified_immediate_false() {
    set_reactive_scheduling("sync");
    reset_rec();
    let s = create_signal(JsValue::from_f64(0.0), None);
    let s1 = s.clone();
    let getter = wasm_bindgen::closure::Closure::wrap(
        Box::new(move || s1.get_js()) as Box<dyn FnMut() -> JsValue>
    );
    let getter_fn: Function = getter.as_ref().clone().unchecked_into();
    let _eh = watch(getter_fn.into(), handler_push(), Some(opts_immediate_false()));
    getter.forget();
    let r = rec();
    assert_eq!(r.length(), 0);
    s.set_js(JsValue::from_f64(1.0));
    let r = rec();
    assert_eq!(r.length(), 1);
    let e0 = Array::from(&r.get(0));
    assert_eq!(e0.get(0).as_f64().unwrap(), 1.0);
    assert_eq!(e0.get(1).as_f64().unwrap(), 0.0);
}

#[wasm_bindgen_test]
fn test_watch_unified_constant_value() {
    set_reactive_scheduling("sync");
    reset_rec();
    let const_val = JsValue::from_str("CONST");
    let _eh = watch(const_val.clone(), handler_push(), Some(opts_immediate_true()));
    let r = rec();
    assert_eq!(r.length(), 1);
    let e0 = Array::from(&r.get(0));
    assert_eq!(e0.get(0).as_string().unwrap(), "CONST");
    assert!(e0.get(1).is_undefined());
    // unrelated signal changes shouldn't affect this watch
    let s = create_signal(JsValue::from_f64(0.0), None);
    s.set_js(JsValue::from_f64(1.0));
    let r = rec();
    assert_eq!(r.length(), 1);
}

#[wasm_bindgen_test]
fn test_watch_array_custom_equals_suppress() {
    set_reactive_scheduling("sync");
    reset_rec();
    let s1 = create_signal(JsValue::from_f64(0.0), None);
    let s2 = create_signal(JsValue::from_f64(10.0), None);
    let arr = Array::new();
    arr.push(&JsValue::from(s1.clone()));
    arr.push(&JsValue::from(s2.clone()));
    let always_equal = Function::new_with_args("prev,next", "return true");
    let _eh =
        watch(arr.into(), handler_push(), Some(opts_immediate_true_with_equals(&always_equal)));
    let r = rec();
    assert_eq!(r.length(), 1);
    s1.set_js(JsValue::from_f64(1.0));
    s2.set_js(JsValue::from_f64(11.0));
    let r = rec();
    assert_eq!(r.length(), 1);
}

#[wasm_bindgen_test]
fn test_watch_unified_signal_object() {
    set_reactive_scheduling("sync");
    reset_rec();
    let s = create_signal(JsValue::from_f64(0.0), None);
    let _eh = watch(JsValue::from(s.clone()), handler_push(), Some(opts_immediate_true()));
    s.set_js(JsValue::from_f64(1.0));
    let r = rec();
    assert_eq!(r.length(), 2);
}

#[wasm_bindgen_test]
fn test_watch_unified_signal_object_immediate_false_then_trigger() {
    set_reactive_scheduling("sync");
    reset_rec();
    let s = create_signal(JsValue::from_f64(0.0), None);
    let _eh = watch(JsValue::from(s.clone()), handler_push(), Some(opts_immediate_false()));
    let r0 = rec();
    assert_eq!(r0.length(), 0);
    s.set_js(JsValue::from_f64(1.0));
    let r = rec();
    assert_eq!(r.length(), 1);
    let e0 = Array::from(&r.get(0));
    assert_eq!(e0.get(0).as_f64().unwrap(), 1.0);
    assert_eq!(e0.get(1).as_f64().unwrap(), 0.0);
}

#[wasm_bindgen_test]
fn test_watch_unified_dispose_stops_runs() {
    set_reactive_scheduling("sync");
    reset_rec();
    let s = create_signal(JsValue::from_f64(0.0), None);
    let eh = watch(JsValue::from(s.clone()), handler_push(), Some(opts_immediate_true()));
    let r0 = rec();
    assert_eq!(r0.length(), 1);
    eh.dispose_js();
    s.set_js(JsValue::from_f64(2.0));
    let r = rec();
    assert_eq!(r.length(), 1);
}

#[wasm_bindgen_test(async)]
async fn test_watch_unified_array_microtask_schedule() {
    set_reactive_scheduling("microtask");
    reset_rec();
    let s1 = create_signal(JsValue::from_f64(0.0), None);
    let s2 = create_signal(JsValue::from_f64(10.0), None);
    let arr = Array::new();
    arr.push(&JsValue::from(s1.clone()));
    arr.push(&JsValue::from(s2.clone()));
    let _eh = watch(arr.into(), handler_push(), Some(opts_immediate_true()));
    s1.set_js(JsValue::from_f64(1.0));
    let r0 = rec();
    assert_eq!(r0.length(), 1);
    let _ = JsFuture::from(Promise::resolve(&JsValue::UNDEFINED)).await;
    let r = rec();
    assert_eq!(r.length(), 2);
}

#[wasm_bindgen_test]
fn test_watch_fn_custom_equals_always_true() {
    set_reactive_scheduling("sync");
    reset_rec();
    let s = create_signal(JsValue::from_f64(1.0), None);
    let s1 = s.clone();
    let getter = wasm_bindgen::closure::Closure::wrap(
        Box::new(move || s1.get_js()) as Box<dyn FnMut() -> JsValue>
    );
    let getter_fn: Function = getter.as_ref().clone().unchecked_into();
    let eq = Function::new_with_args("prev,next", "return true");
    let opts = opts_immediate_true_with_equals(&eq);
    let _eh = watch(getter_fn.into(), handler_push(), Some(opts));
    getter.forget();
    s.set_js(JsValue::from_f64(2.0));
    let r = rec();
    assert_eq!(r.length(), 1);
}
#[wasm_bindgen_test]
fn test_watch_signal_custom_equals_no_trigger() {
    set_reactive_scheduling("sync");
    reset_rec();
    let s = create_signal(JsValue::from_f64(0.0), None);
    let eq = Function::new_with_args("prev,next", "return true");
    let opts = opts_immediate_true_with_equals(&eq);
    let _eh = watch_signal(&s, handler_push(), Some(opts));
    s.set_js(JsValue::from_f64(1.0));
    let r = rec();
    assert_eq!(r.length(), 1);
}

#[wasm_bindgen_test]
fn test_watch_path_array_index_string() {
    set_reactive_scheduling("sync");
    reset_rec();
    let items = Array::new();
    items.push(&JsValue::from_str("x"));
    let root = Object::new();
    let _ = Reflect::set(&root, &JsValue::from_str("items"), &items);
    let s = create_signal(root.into(), None);
    let _eh =
        watch_path(&s, JsValue::from_str("items.0"), handler_push(), Some(opts_immediate_true()));
    s.set_path_js(JsValue::from_str("items.0"), JsValue::from_str("y"));
    let r = rec();
    assert_eq!(r.length(), 2);
}

#[wasm_bindgen_test]
fn test_watch_array_immediate_false_then_trigger() {
    set_reactive_scheduling("sync");
    reset_rec();
    let s1 = create_signal(JsValue::from_f64(0.0), None);
    let s2 = create_signal(JsValue::from_f64(0.0), None);
    let arr = Array::new();
    arr.push(&JsValue::from(s1.clone()));
    arr.push(&JsValue::from(s2.clone()));
    let _eh = watch(arr.into(), handler_push(), Some(opts_immediate_false()));
    let r = rec();
    assert_eq!(r.length(), 0);
    s1.set_js(JsValue::from_f64(1.0));
    let r = rec();
    assert_eq!(r.length(), 1);
}

#[wasm_bindgen_test(async)]
async fn test_watch_microtask_schedule() {
    set_reactive_scheduling("microtask");
    reset_rec();
    let s = create_signal(JsValue::from_f64(0.0), None);
    let _eh = watch_signal(&s, handler_push(), Some(opts_immediate_true()));
    s.set_js(JsValue::from_f64(1.0));
    let r0 = rec();
    assert_eq!(r0.length(), 1);
    let _ = JsFuture::from(Promise::resolve(&JsValue::UNDEFINED)).await;
    let r = rec();
    assert_eq!(r.length(), 2);
}

#[wasm_bindgen_test(async)]
async fn test_watch_handler_reads_do_not_subscribe_to_local_signals() {
    set_reactive_scheduling("microtask");

    let source = create_signal(JsValue::from_f64(0.0), None);
    let local = create_signal(JsValue::from_f64(0.0), None);
    let getter_hits = std::rc::Rc::new(std::cell::RefCell::new(0usize));
    let getter_hits_for_getter = getter_hits.clone();
    let source_for_getter = source.clone();
    let getter = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *getter_hits_for_getter.borrow_mut() += 1;
        source_for_getter.get_js()
    }) as Box<dyn FnMut() -> JsValue>);
    let getter_fn: Function = getter.as_ref().clone().unchecked_into();

    let local_for_handler = local.clone();
    let handler =
        wasm_bindgen::closure::Closure::wrap(Box::new(move |newv: JsValue, _oldv: JsValue| {
            let _ = local_for_handler.get_js();
            local_for_handler.set_js(newv);
        }) as Box<dyn FnMut(JsValue, JsValue)>);
    let handler_fn: Function = handler.as_ref().clone().unchecked_into();

    let _eh = watch(getter_fn.into(), handler_fn, Some(opts_immediate_true()));
    assert_eq!(*getter_hits.borrow(), 1);

    source.set_js(JsValue::from_f64(1.0));
    let _ = JsFuture::from(Promise::resolve(&JsValue::UNDEFINED)).await;
    assert_eq!(*getter_hits.borrow(), 2);

    local.set_js(JsValue::from_f64(2.0));
    let _ = JsFuture::from(Promise::resolve(&JsValue::UNDEFINED)).await;
    assert_eq!(*getter_hits.borrow(), 2);

    getter.forget();
    handler.forget();
}

#[wasm_bindgen_test]
fn test_watch_empty_array_source() {
    set_reactive_scheduling("sync");
    reset_rec();
    let sources = Array::new();
    let _eh = watch(sources.into(), handler_push(), Some(opts_immediate_true()));
    let r = rec();
    assert_eq!(r.length(), 1);
    let s = create_signal(JsValue::from_f64(0.0), None);
    s.set_js(JsValue::from_f64(1.0));
    let r2 = rec();
    assert_eq!(r2.length(), 1);
}

#[wasm_bindgen_test]
fn test_watch_fn_object_deep_equals() {
    set_reactive_scheduling("sync");
    reset_rec();
    let obj = Object::new();
    let _ = Reflect::set(&obj, &JsValue::from_str("a"), &JsValue::from_f64(1.0));
    let s = create_signal(obj.into(), None);
    let s1 = s.clone();
    let getter = wasm_bindgen::closure::Closure::wrap(
        Box::new(move || s1.get_js()) as Box<dyn FnMut() -> JsValue>
    );
    let getter_fn: Function = getter.as_ref().clone().unchecked_into();
    let deep_eq = Function::new_with_args(
        "prev,next",
        r#"
      function isDeepEqual(a,b){
        if (Object.is(a,b)) return true;
        if (typeof a !== typeof b) return false;
        if (a==null||b==null) return false;
        const aa=Array.isArray(a),ab=Array.isArray(b);
        if (aa||ab) return false;
        const ak=Object.keys(a), bk=Object.keys(b);
        if (ak.length!==bk.length) return false;
        for (let i=0;i<ak.length;i++){const k=ak[i]; if(!Object.prototype.hasOwnProperty.call(b,k)) return false; if(!Object.is(a[k],b[k])) return false;}
        return true;
      }
      return isDeepEqual(prev,next);
    "#,
    );
    let opts = Object::new();
    let _ = Reflect::set(&opts, &JsValue::from_str("immediate"), &JsValue::from_bool(true));
    let _ = Reflect::set(&opts, &JsValue::from_str("equals"), &deep_eq);
    let _eh = watch(getter_fn.into(), handler_push(), Some(opts.into()));
    getter.forget();
    s.set_path_js(JsValue::from_str("a"), JsValue::from_f64(1.0));
    let r = rec();
    assert_eq!(r.length(), 1);
    s.set_path_js(JsValue::from_str("a"), JsValue::from_f64(2.0));
    let r2 = rec();
    assert_eq!(r2.length(), 2);
}

#[wasm_bindgen_test]
fn test_watch_constant_immediate_false_no_trigger() {
    set_reactive_scheduling("sync");
    reset_rec();
    let v = JsValue::from_str("CONST");
    let _eh = watch(v, handler_push(), Some(opts_immediate_false()));
    let r = rec();
    assert_eq!(r.length(), 0);
}

#[wasm_bindgen_test]
fn test_watch_object_source_getter_disappears_on_rerun() {
    set_reactive_scheduling("sync");
    reset_rec();
    let signal = create_signal(JsValue::from_f64(0.0), None);
    let source = Object::new();
    let source_for_delete = source.clone();
    let signal_for_getter = signal.clone();
    let getter = wasm_bindgen::closure::Closure::wrap(
        Box::new(move || signal_for_getter.get_js()) as Box<dyn FnMut() -> JsValue>
    );
    let getter_fn: Function = getter.as_ref().clone().unchecked_into();
    Reflect::set(&source, &JsValue::from_str("get"), &getter_fn).unwrap();

    let _eh = watch(source.into(), handler_push(), Some(opts_immediate_false()));
    Reflect::delete_property(&source_for_delete, &JsValue::from_str("get")).unwrap();
    signal.set_js(JsValue::from_f64(1.0));

    let r = rec();
    assert_eq!(r.length(), 1);
    let entry = Array::from(&r.get(0));
    assert!(entry.get(0).is_undefined());
    assert_eq!(entry.get(1).as_f64().unwrap(), 0.0);

    getter.forget();
}

#[wasm_bindgen_test]
fn test_watch_array_source_keeps_plain_object_constants() {
    set_reactive_scheduling("sync");
    reset_rec();
    let signal = create_signal(JsValue::from_f64(0.0), None);
    let plain = Object::new();
    Reflect::set(&plain, &JsValue::from_str("label"), &JsValue::from_str("plain")).unwrap();
    let arr = Array::new();
    arr.push(&JsValue::from(signal.clone()));
    arr.push(&plain);

    let _eh = watch(arr.into(), handler_push(), Some(opts_immediate_true()));
    signal.set_js(JsValue::from_f64(1.0));

    let r = rec();
    assert_eq!(r.length(), 2);
    let entry = Array::from(&r.get(1));
    let values = Array::from(&entry.get(0));
    assert_eq!(values.get(0).as_f64().unwrap(), 1.0);
    assert_eq!(
        Reflect::get(&values.get(1), &JsValue::from_str("label")).unwrap().as_string().unwrap(),
        "plain"
    );
}

#[wasm_bindgen_test(async)]
async fn test_watch_signal_object_debounce_option() {
    set_reactive_scheduling("sync");
    reset_rec();
    let signal = create_signal(JsValue::from_f64(0.0), None);
    let options = Object::new();
    Reflect::set(&options, &JsValue::from_str("debounce"), &JsValue::from_f64(5.0)).unwrap();
    let _eh = watch(JsValue::from(signal.clone()), handler_push(), Some(options.into()));

    signal.set_js(JsValue::from_f64(1.0));
    signal.set_js(JsValue::from_f64(2.0));
    assert_eq!(rec().length(), 0);
    wait_timeout(30.0).await;
    assert_eq!(rec().length(), 1);
}

#[wasm_bindgen_test(async)]
async fn test_watch_array_debounce_option() {
    set_reactive_scheduling("sync");
    reset_rec();
    let signal = create_signal(JsValue::from_f64(0.0), None);
    let arr = Array::new();
    arr.push(&JsValue::from(signal.clone()));
    arr.push(&JsValue::from_str("stable"));
    let options = Object::new();
    Reflect::set(&options, &JsValue::from_str("debounce"), &JsValue::from_f64(5.0)).unwrap();
    let _eh = watch(arr.into(), handler_push(), Some(options.into()));

    signal.set_js(JsValue::from_f64(1.0));
    signal.set_js(JsValue::from_f64(2.0));
    assert_eq!(rec().length(), 0);
    wait_timeout(30.0).await;
    assert_eq!(rec().length(), 1);
}

#[wasm_bindgen_test]
fn test_watch_constant_source_accepts_debounce_option() {
    set_reactive_scheduling("sync");
    reset_rec();
    let options = Object::new();
    Reflect::set(&options, &JsValue::from_str("immediate"), &JsValue::from_bool(true)).unwrap();
    Reflect::set(&options, &JsValue::from_str("debounce"), &JsValue::from_f64(5.0)).unwrap();
    let _eh = watch(JsValue::from_str("CONST"), handler_push(), Some(options.into()));

    let r = rec();
    assert_eq!(r.length(), 1);
    let entry = Array::from(&r.get(0));
    assert_eq!(entry.get(0).as_string().unwrap(), "CONST");
    assert!(entry.get(1).is_undefined());
}

#[wasm_bindgen_test]
fn test_watch_scheduler_takes_precedence_over_debounce_for_unified_sources() {
    set_reactive_scheduling("sync");
    reset_rec();
    let scheduler = Function::new_with_args("run", "run()");

    let signal = create_signal(JsValue::from_f64(0.0), None);
    let object_options = Object::new();
    Reflect::set(&object_options, &JsValue::from_str("scheduler"), &scheduler).unwrap();
    Reflect::set(&object_options, &JsValue::from_str("debounce"), &JsValue::from_f64(50.0))
        .unwrap();
    let _object_watch =
        watch(JsValue::from(signal.clone()), handler_push(), Some(object_options.into()));
    signal.set_js(JsValue::from_f64(1.0));
    assert_eq!(rec().length(), 1);

    let array_signal = create_signal(JsValue::from_f64(0.0), None);
    let sources = Array::new();
    sources.push(&JsValue::from(array_signal.clone()));
    let array_options = Object::new();
    Reflect::set(&array_options, &JsValue::from_str("scheduler"), &scheduler).unwrap();
    Reflect::set(&array_options, &JsValue::from_str("debounce"), &JsValue::from_f64(50.0)).unwrap();
    let _array_watch = watch(sources.into(), handler_push(), Some(array_options.into()));
    array_signal.set_js(JsValue::from_f64(1.0));
    assert_eq!(rec().length(), 2);

    let constant_options = Object::new();
    Reflect::set(&constant_options, &JsValue::from_str("immediate"), &JsValue::from_bool(true))
        .unwrap();
    Reflect::set(&constant_options, &JsValue::from_str("scheduler"), &scheduler).unwrap();
    Reflect::set(&constant_options, &JsValue::from_str("debounce"), &JsValue::from_f64(50.0))
        .unwrap();
    let _constant_watch =
        watch(JsValue::from_str("CONST"), handler_push(), Some(constant_options.into()));
    assert_eq!(rec().length(), 3);
}
