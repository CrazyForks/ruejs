use js_sys::{Array, Function, Object, Promise, Reflect};
use rue_runtime_vapor::{
    EffectHandle, batch, create_computed, create_effect, create_signal, createRue,
    get_current_instance, next_tick, set_current_instance, set_reactive_scheduling, use_setup,
    with_hook_slot,
};
use std::cell::RefCell;
use std::rc::Rc;
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use wasm_bindgen_futures::JsFuture;
use wasm_bindgen_test::*;

mod common;

use common::{make_vapor_only_adapter, setup_container, tick};

fn host_bridge(tag: &str) -> JsValue {
    let host = Object::new();
    Reflect::set(&host, &JsValue::from_str("tag"), &JsValue::from_str(tag)).unwrap();
    Reflect::set(&host, &JsValue::from_str("children"), &Array::new().into()).unwrap();
    Reflect::set(&host, &JsValue::from_str("nodeType"), &JsValue::from_f64(1.0)).unwrap();

    let bridge = Object::new();
    Reflect::set(&bridge, &JsValue::from_str("__rue_host_node"), &host.into()).unwrap();
    bridge.into()
}

#[wasm_bindgen_test]
/// 同步调度：副作用在 set 后立即执行（无微任务延迟）。
fn scheduling_sync_runs_immediately() {
    // 将调度模式设为同步
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

#[wasm_bindgen_test(async)]
/// 微任务调度：set 不会立刻触发副作用，需等待一个微任务。
async fn scheduling_microtask_defers_until_microtask() {
    set_reactive_scheduling("microtask");
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
    assert_eq!(*hits.borrow(), 1); // 初始创建时立即运行一次
    sig.set_js(JsValue::from_f64(1.0));
    assert_eq!(*hits.borrow(), 1); // 此时尚未运行（等待微任务）
    wasm_bindgen_futures::JsFuture::from(Promise::resolve(&JsValue::UNDEFINED)).await.unwrap();
    assert_eq!(*hits.borrow(), 2);
    cb.forget();
}

#[wasm_bindgen_test(async)]
/// frame 调度在非浏览器环境下会安全回退到微任务，避免测试/Node 环境因缺少 rAF 而卡住。
async fn scheduling_frame_falls_back_to_microtask_outside_browser() {
    set_reactive_scheduling("frame");
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
    assert_eq!(*hits.borrow(), 1);

    wasm_bindgen_futures::JsFuture::from(Promise::resolve(&JsValue::UNDEFINED)).await.unwrap();
    assert_eq!(*hits.borrow(), 2);
    cb.forget();
}

#[wasm_bindgen_test]
fn scheduling_frame_uses_window_raf_and_timeout_guard_when_available() {
    let global = js_sys::global();
    let window = Object::new();
    Reflect::set(
        &window,
        &JsValue::from_str("requestAnimationFrame"),
        &Function::new_with_args(
            "cb",
            "globalThis.__rue_raf_calls = (globalThis.__rue_raf_calls || 0) + 1; cb(0); return 1;",
        ),
    )
    .unwrap();
    Reflect::set(
        &window,
        &JsValue::from_str("setTimeout"),
        &Function::new_with_args(
            "cb,ms",
            "globalThis.__rue_timeout_calls = (globalThis.__rue_timeout_calls || 0) + 1; cb(); return 2;",
        ),
    )
    .unwrap();
    Reflect::set(&global, &JsValue::from_str("window"), &window).unwrap();

    set_reactive_scheduling("frame");
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

    sig.set_js(JsValue::from_f64(1.0));

    assert_eq!(*hits.borrow(), 2);
    assert_eq!(
        Reflect::get(&global, &JsValue::from_str("__rue_raf_calls")).unwrap().as_f64(),
        Some(1.0)
    );
    assert_eq!(
        Reflect::get(&global, &JsValue::from_str("__rue_timeout_calls")).unwrap().as_f64(),
        Some(1.0)
    );

    Reflect::delete_property(&global, &JsValue::from_str("window")).unwrap();
    Reflect::delete_property(&global, &JsValue::from_str("__rue_raf_calls")).unwrap();
    Reflect::delete_property(&global, &JsValue::from_str("__rue_timeout_calls")).unwrap();
    set_reactive_scheduling("microtask");
    cb.forget();
}

#[wasm_bindgen_test]
fn scheduling_frame_timeout_guard_drains_when_raf_does_not_fire() {
    let global = js_sys::global();
    let window = Object::new();
    Reflect::set(
        &window,
        &JsValue::from_str("requestAnimationFrame"),
        &Function::new_with_args(
            "cb",
            "globalThis.__rue_raf_calls = (globalThis.__rue_raf_calls || 0) + 1; return 1;",
        ),
    )
    .unwrap();
    Reflect::set(
        &window,
        &JsValue::from_str("setTimeout"),
        &Function::new_with_args(
            "cb,ms",
            "globalThis.__rue_timeout_calls = (globalThis.__rue_timeout_calls || 0) + 1; cb(); return 2;",
        ),
    )
    .unwrap();
    Reflect::set(&global, &JsValue::from_str("window"), &window).unwrap();

    set_reactive_scheduling("frame");
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

    sig.set_js(JsValue::from_f64(1.0));

    assert_eq!(*hits.borrow(), 2);
    assert_eq!(
        Reflect::get(&global, &JsValue::from_str("__rue_raf_calls")).unwrap().as_f64(),
        Some(1.0)
    );
    assert_eq!(
        Reflect::get(&global, &JsValue::from_str("__rue_timeout_calls")).unwrap().as_f64(),
        Some(1.0)
    );

    Reflect::delete_property(&global, &JsValue::from_str("window")).unwrap();
    Reflect::delete_property(&global, &JsValue::from_str("__rue_raf_calls")).unwrap();
    Reflect::delete_property(&global, &JsValue::from_str("__rue_timeout_calls")).unwrap();
    set_reactive_scheduling("microtask");
    cb.forget();
}

#[wasm_bindgen_test(async)]
/// 微任务调度下，drain 过程中级联产生的新 pending effect 也应自动补发后续微任务，
/// 不应依赖下一次外部 set 才继续传播。
async fn scheduling_microtask_continues_chained_effects_without_external_poke() {
    set_reactive_scheduling("microtask");
    let source = create_signal(JsValue::from_f64(1.0), None);

    let source_for_computed = source.clone();
    let computed_cb = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        let value = source_for_computed.get_js().as_f64().unwrap();
        JsValue::from_f64(value * 2.0)
    }) as Box<dyn FnMut() -> JsValue>);
    let computed_fn: Function = computed_cb.as_ref().clone().into();
    let doubled = create_computed(computed_fn.into());
    computed_cb.forget();

    let hits = Rc::new(RefCell::new(0));
    let hits2 = hits.clone();
    let doubled_for_effect = doubled.clone();
    let effect_cb = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *hits2.borrow_mut() += 1;
        let _ = doubled_for_effect.get_js();
    }) as Box<dyn FnMut()>);
    let effect_fn: Function = effect_cb.as_ref().clone().into();
    let _eh = create_effect(effect_fn, None);

    assert_eq!(*hits.borrow(), 1);
    source.set_js(JsValue::from_f64(2.0));
    assert_eq!(*hits.borrow(), 1);

    wasm_bindgen_futures::JsFuture::from(Promise::resolve(&JsValue::UNDEFINED)).await.unwrap();
    wasm_bindgen_futures::JsFuture::from(Promise::resolve(&JsValue::UNDEFINED)).await.unwrap();

    assert_eq!(*hits.borrow(), 2);
    assert_eq!(doubled.get_js().as_f64().unwrap(), 4.0);
    effect_cb.forget();
}

#[wasm_bindgen_test(async)]
/// nextTick 应等待当前微任务 flush 完成，并看到合并后的最终值。
async fn next_tick_waits_for_merged_microtask_flush() {
    set_reactive_scheduling("microtask");
    let sig = create_signal(JsValue::from_f64(0.0), None);
    let hits = Rc::new(RefCell::new(Vec::<f64>::new()));
    let hits2 = hits.clone();
    let s_for = sig.clone();
    let cb = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        hits2.borrow_mut().push(s_for.get_js().as_f64().unwrap());
    }) as Box<dyn FnMut()>);
    let f: Function = cb.as_ref().clone().into();
    let _eh = create_effect(f, None);

    assert_eq!(hits.borrow().as_slice(), &[0.0]);

    sig.set_js(JsValue::from_f64(1.0));
    sig.set_js(JsValue::from_f64(2.0));

    assert_eq!(hits.borrow().as_slice(), &[0.0]);

    wasm_bindgen_futures::JsFuture::from(next_tick(None)).await.unwrap();

    assert_eq!(hits.borrow().as_slice(), &[0.0, 2.0]);
    cb.forget();
}

#[wasm_bindgen_test(async)]
async fn next_tick_created_inside_flush_waits_for_that_flush_to_finish() {
    set_reactive_scheduling("microtask");
    let sig = create_signal(JsValue::from_f64(0.0), None);
    let observed = Rc::new(RefCell::new(Vec::<f64>::new()));
    let pending_tick = Rc::new(RefCell::new(None::<Promise>));

    let observed_for_effect = observed.clone();
    let pending_tick_for_effect = pending_tick.clone();
    let sig_for_effect = sig.clone();
    let cb = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        let value = sig_for_effect.get_js().as_f64().unwrap();
        observed_for_effect.borrow_mut().push(value);
        if value == 1.0 {
            *pending_tick_for_effect.borrow_mut() = Some(next_tick(None));
        }
    }) as Box<dyn FnMut()>);
    let _effect = create_effect(cb.as_ref().clone().into(), None);

    sig.set_js(JsValue::from_f64(1.0));
    JsFuture::from(Promise::resolve(&JsValue::UNDEFINED)).await.unwrap();

    let promise = pending_tick.borrow_mut().take().expect("nextTick promise captured");
    JsFuture::from(promise).await.unwrap();
    assert_eq!(observed.borrow().as_slice(), &[0.0, 1.0]);
    cb.forget();
}

#[wasm_bindgen_test(async)]
async fn empty_batch_waiter_resolution_bails_when_a_flush_gets_scheduled_first() {
    set_reactive_scheduling("microtask");
    let sig = create_signal(JsValue::from_f64(0.0), None);
    let hits = Rc::new(RefCell::new(0));
    let hits_for_effect = hits.clone();
    let sig_for_effect = sig.clone();
    let cb = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *hits_for_effect.borrow_mut() += 1;
        let _ = sig_for_effect.get_js();
    }) as Box<dyn FnMut()>);
    let _effect = create_effect(cb.as_ref().clone().into(), None);

    let empty = wasm_bindgen::closure::Closure::wrap(Box::new(move || {}) as Box<dyn FnMut()>);
    batch(empty.as_ref().clone().unchecked_into());
    sig.set_js(JsValue::from_f64(1.0));

    JsFuture::from(Promise::resolve(&JsValue::UNDEFINED)).await.unwrap();
    JsFuture::from(Promise::resolve(&JsValue::UNDEFINED)).await.unwrap();

    assert_eq!(*hits.borrow(), 2);
    empty.forget();
    cb.forget();
}

#[wasm_bindgen_test(async)]
async fn scheduling_microtask_drains_effects_queued_during_flush() {
    set_reactive_scheduling("microtask");
    let source = create_signal(JsValue::from_f64(0.0), None);
    let derived = create_signal(JsValue::from_f64(0.0), None);

    let derived_hits = Rc::new(RefCell::new(Vec::<f64>::new()));
    let derived_hits_for_effect = derived_hits.clone();
    let derived_for_effect = derived.clone();
    let derived_cb = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        derived_hits_for_effect.borrow_mut().push(derived_for_effect.get_js().as_f64().unwrap());
    }) as Box<dyn FnMut()>);
    let _derived_effect = create_effect(derived_cb.as_ref().clone().into(), None);

    let source_for_effect = source.clone();
    let derived_for_source = derived.clone();
    let source_cb = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        let value = source_for_effect.get_js().as_f64().unwrap();
        if value > 0.0 {
            derived_for_source.set_js(JsValue::from_f64(value * 10.0));
        }
    }) as Box<dyn FnMut()>);
    let _source_effect = create_effect(source_cb.as_ref().clone().into(), None);

    assert_eq!(derived_hits.borrow().as_slice(), &[0.0]);
    source.set_js(JsValue::from_f64(1.0));
    assert_eq!(derived_hits.borrow().as_slice(), &[0.0]);

    wasm_bindgen_futures::JsFuture::from(Promise::resolve(&JsValue::UNDEFINED)).await.unwrap();
    wasm_bindgen_futures::JsFuture::from(Promise::resolve(&JsValue::UNDEFINED)).await.unwrap();

    assert_eq!(derived_hits.borrow().as_slice(), &[0.0, 10.0]);
    derived_cb.forget();
    source_cb.forget();
}

#[wasm_bindgen_test]
fn scheduling_frame_ignores_duplicate_raf_and_timeout_drains() {
    let global = js_sys::global();
    let window = Object::new();
    Reflect::set(
        &window,
        &JsValue::from_str("requestAnimationFrame"),
        &Function::new_with_args(
            "cb",
            "globalThis.__rue_raf_calls = (globalThis.__rue_raf_calls || 0) + 1; cb(0); cb(1); return 1;",
        ),
    )
    .unwrap();
    Reflect::set(
        &window,
        &JsValue::from_str("setTimeout"),
        &Function::new_with_args(
            "cb,ms",
            "globalThis.__rue_timeout_calls = (globalThis.__rue_timeout_calls || 0) + 1; cb(); return 2;",
        ),
    )
    .unwrap();
    Reflect::set(&global, &JsValue::from_str("window"), &window).unwrap();

    set_reactive_scheduling("frame");
    let sig = create_signal(JsValue::from_f64(0.0), None);
    let hits = Rc::new(RefCell::new(0));
    let hits_for_effect = hits.clone();
    let sig_for_effect = sig.clone();
    let cb = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *hits_for_effect.borrow_mut() += 1;
        let _ = sig_for_effect.get_js();
    }) as Box<dyn FnMut()>);
    let _effect = create_effect(cb.as_ref().clone().into(), None);

    sig.set_js(JsValue::from_f64(1.0));

    assert_eq!(*hits.borrow(), 2);
    assert_eq!(
        Reflect::get(&global, &JsValue::from_str("__rue_raf_calls")).unwrap().as_f64(),
        Some(1.0)
    );
    assert_eq!(
        Reflect::get(&global, &JsValue::from_str("__rue_timeout_calls")).unwrap().as_f64(),
        Some(1.0)
    );

    Reflect::delete_property(&global, &JsValue::from_str("window")).unwrap();
    Reflect::delete_property(&global, &JsValue::from_str("__rue_raf_calls")).unwrap();
    Reflect::delete_property(&global, &JsValue::from_str("__rue_timeout_calls")).unwrap();
    set_reactive_scheduling("microtask");
    cb.forget();
}

#[wasm_bindgen_test]
fn scheduling_frame_uses_raf_without_timeout_guard_when_timeout_is_absent() {
    let global = js_sys::global();
    let window = Object::new();
    Reflect::set(
        &window,
        &JsValue::from_str("requestAnimationFrame"),
        &Function::new_with_args(
            "cb",
            "globalThis.__rue_raf_calls = (globalThis.__rue_raf_calls || 0) + 1; cb(0); return 1;",
        ),
    )
    .unwrap();
    Reflect::set(&global, &JsValue::from_str("window"), &window).unwrap();

    set_reactive_scheduling("frame");
    let sig = create_signal(JsValue::from_f64(0.0), None);
    let hits = Rc::new(RefCell::new(0));
    let hits_for_effect = hits.clone();
    let sig_for_effect = sig.clone();
    let cb = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *hits_for_effect.borrow_mut() += 1;
        let _ = sig_for_effect.get_js();
    }) as Box<dyn FnMut()>);
    let _effect = create_effect(cb.as_ref().clone().into(), None);

    sig.set_js(JsValue::from_f64(1.0));

    assert_eq!(*hits.borrow(), 2);
    assert_eq!(
        Reflect::get(&global, &JsValue::from_str("__rue_raf_calls")).unwrap().as_f64(),
        Some(1.0)
    );
    assert!(Reflect::get(&window, &JsValue::from_str("setTimeout")).unwrap().is_undefined());

    Reflect::delete_property(&global, &JsValue::from_str("window")).unwrap();
    Reflect::delete_property(&global, &JsValue::from_str("__rue_raf_calls")).unwrap();
    set_reactive_scheduling("microtask");
    cb.forget();
}

#[wasm_bindgen_test]
fn scheduler_run_after_dispose_is_ignored_and_dispose_is_idempotent() {
    set_reactive_scheduling("sync");
    let hits = Rc::new(RefCell::new(0));
    let hits_for_effect = hits.clone();
    let cb = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *hits_for_effect.borrow_mut() += 1;
    }) as Box<dyn FnMut()>);
    let scheduler = Function::new_with_args("run", "globalThis.__rue_deferred_effect_run = run");
    let options = Object::new();
    Reflect::set(&options, &JsValue::from_str("scheduler"), &scheduler).unwrap();

    let handle = create_effect(cb.as_ref().clone().into(), Some(options.into()));
    assert_eq!(*hits.borrow(), 0);

    handle.dispose_js();
    handle.dispose_js();

    let run: Function =
        Reflect::get(&js_sys::global(), &JsValue::from_str("__rue_deferred_effect_run"))
            .unwrap()
            .unchecked_into();
    run.call0(&JsValue::NULL).unwrap();
    assert_eq!(*hits.borrow(), 0);

    Reflect::delete_property(&js_sys::global(), &JsValue::from_str("__rue_deferred_effect_run"))
        .unwrap();
    cb.forget();
}

#[wasm_bindgen_test(async)]
async fn render_triggered_hook_receives_signal_event_and_can_dispose_effect_before_schedule() {
    set_reactive_scheduling("sync");
    let adapter = make_vapor_only_adapter();
    let rue = Rc::new(createRue(adapter.clone()));
    let container = setup_container(&adapter);
    let sig = create_signal(JsValue::from_f64(0.0), None);
    let events = Array::new();
    Reflect::set(&js_sys::global(), &JsValue::from_str("__rue_render_events"), &events).unwrap();

    let handle_slot = Rc::new(RefCell::new(None::<EffectHandle>));
    let rue_for_component = rue.clone();
    let sig_for_component = sig.clone();
    let handle_slot_for_component = handle_slot.clone();
    let component = wasm_bindgen::closure::Closure::wrap(Box::new(move |_props: JsValue| {
        let slot_for_hook = handle_slot_for_component.clone();
        let hook = wasm_bindgen::closure::Closure::wrap(Box::new(move |event: JsValue| {
            let record = Array::new();
            record.push(&Reflect::get(&event, &JsValue::from_str("type")).unwrap());
            record.push(&Reflect::get(&event, &JsValue::from_str("oldValue")).unwrap());
            record.push(&Reflect::get(&event, &JsValue::from_str("newValue")).unwrap());
            let stored: Array =
                Reflect::get(&js_sys::global(), &JsValue::from_str("__rue_render_events"))
                    .unwrap()
                    .unchecked_into();
            stored.push(&record);
            if let Some(handle) = slot_for_hook.borrow_mut().take() {
                handle.dispose_js();
            }
        }) as Box<dyn FnMut(JsValue)>);
        let hook_fn: Function = hook.as_ref().clone().unchecked_into();
        rue_for_component.on_render_triggered(hook_fn.clone().into());
        rue_for_component.on_render_triggered(Function::new_no_args("return undefined").into());
        rue_for_component.on_render_triggered(JsValue::from_str("not-a-hook"));
        let wrapper = get_current_instance();
        let owner =
            Reflect::get(&wrapper, &JsValue::from_str("__rue_context_linked_instance__")).unwrap();
        let owner_hooks = Array::new();
        owner_hooks.push(&hook_fn);
        owner_hooks.push(&JsValue::from_str("not-a-function"));
        owner_hooks.push(&Function::new_no_args("return undefined").into());
        Reflect::set(&owner, &JsValue::from_str("__rue_render_triggered_hooks"), &owner_hooks)
            .unwrap();
        hook.forget();

        let sig_for_effect = sig_for_component.clone();
        let effect_cb = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
            let _ = sig_for_effect.get_js();
        }) as Box<dyn FnMut()>);
        let handle = create_effect(effect_cb.as_ref().clone().into(), None);
        *handle_slot_for_component.borrow_mut() = Some(handle);
        effect_cb.forget();

        host_bridge("triggered-child")
    })
        as Box<dyn FnMut(JsValue) -> JsValue>);

    let handle = rue.create_component_wasm(component.as_ref().clone().into(), JsValue::UNDEFINED);
    rue.render_wasm(handle, container);
    tick().await;

    sig.set_js(JsValue::from_f64(1.0));
    tick().await;

    let stored: Array = Reflect::get(&js_sys::global(), &JsValue::from_str("__rue_render_events"))
        .unwrap()
        .unchecked_into();
    assert_eq!(stored.length(), 1);
    let first: Array = stored.get(0).unchecked_into();
    assert_eq!(first.get(0).as_string().unwrap(), "set");
    assert_eq!(first.get(1).as_f64(), Some(0.0));
    assert_eq!(first.get(2).as_f64(), Some(1.0));

    Reflect::delete_property(&js_sys::global(), &JsValue::from_str("__rue_render_events")).unwrap();
    component.forget();
}

#[wasm_bindgen_test(async)]
async fn render_debug_owner_without_triggered_hooks_still_schedules_effect() {
    set_reactive_scheduling("sync");
    let adapter = make_vapor_only_adapter();
    let rue = Rc::new(createRue(adapter.clone()));
    let container = setup_container(&adapter);
    let sig = create_signal(JsValue::from_f64(0.0), None);
    let hits = Rc::new(RefCell::new(0));

    let sig_for_component = sig.clone();
    let hits_for_component = hits.clone();
    let component = wasm_bindgen::closure::Closure::wrap(Box::new(move |_props: JsValue| {
        let sig_for_effect = sig_for_component.clone();
        let hits_for_effect = hits_for_component.clone();
        let effect_cb = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
            *hits_for_effect.borrow_mut() += 1;
            let _ = sig_for_effect.get_js();
        }) as Box<dyn FnMut()>);
        let _handle = create_effect(effect_cb.as_ref().clone().into(), None);
        effect_cb.forget();

        host_bridge("unhooked-debug-owner")
    })
        as Box<dyn FnMut(JsValue) -> JsValue>);

    let handle = rue.create_component_wasm(component.as_ref().clone().into(), JsValue::UNDEFINED);
    rue.render_wasm(handle, container);
    tick().await;
    assert_eq!(*hits.borrow(), 1);

    sig.set_js(JsValue::from_f64(1.0));
    assert_eq!(*hits.borrow(), 2);
    component.forget();
}

#[wasm_bindgen_test]
fn with_hook_slot_suppresses_render_debug_tracking_and_restores_depth() {
    let instance = Object::new();
    set_current_instance(instance.into());
    let factory = Function::new_no_args("return { value: 'slot' }");
    let value = with_hook_slot(factory);
    assert!(value.is_object());
    let setup = Function::new_no_args("return { ready: true }");
    let setup_value = use_setup(setup);
    assert!(setup_value.is_object());
    set_current_instance(JsValue::UNDEFINED);
}

#[wasm_bindgen_test(async)]
async fn batch_with_pending_microtask_skips_empty_waiter_resolution() {
    set_reactive_scheduling("microtask");
    let sig = create_signal(JsValue::from_f64(0.0), None);
    let hits = Rc::new(RefCell::new(0));
    let hits_for_effect = hits.clone();
    let sig_for_effect = sig.clone();
    let cb = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        *hits_for_effect.borrow_mut() += 1;
        let _ = sig_for_effect.get_js();
    }) as Box<dyn FnMut()>);
    let _effect = create_effect(cb.as_ref().clone().into(), None);

    let sig_for_batch = sig.clone();
    let update = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        sig_for_batch.set_js(JsValue::from_f64(1.0));
    }) as Box<dyn FnMut()>);
    batch(update.as_ref().clone().unchecked_into());

    assert_eq!(*hits.borrow(), 1);
    JsFuture::from(Promise::resolve(&JsValue::UNDEFINED)).await.unwrap();
    assert_eq!(*hits.borrow(), 2);

    update.forget();
    cb.forget();
}

#[wasm_bindgen_test]
/// `to_value` 支持函数、对象 value/get、以及原始值的通用取值转换。
fn to_value_variants() {
    // 函数：调用返回值
    let f = wasm_bindgen::closure::Closure::wrap(
        Box::new(move || JsValue::from_str("ok")) as Box<dyn FnMut() -> JsValue>
    );
    let ff: js_sys::Function = f.as_ref().clone().into();
    let r1 = rue_runtime_vapor::to_value(ff.into());
    assert_eq!(r1.as_string().unwrap(), "ok");
    f.forget();

    // 对象：优先读取 value 字段
    let obj = js_sys::Object::new();
    js_sys::Reflect::set(&obj, &JsValue::from_str("value"), &JsValue::from_f64(3.0)).unwrap();
    let r2 = rue_runtime_vapor::to_value(obj.into());
    assert_eq!(r2.as_f64().unwrap(), 3.0);

    // 对象：若没有 value，则调用 get()
    let obj2 = js_sys::Object::new();
    let get = wasm_bindgen::closure::Closure::wrap(
        Box::new(move || JsValue::from_str("G")) as Box<dyn FnMut() -> JsValue>
    );
    let gf: js_sys::Function = get.as_ref().clone().into();
    js_sys::Reflect::set(&obj2, &JsValue::from_str("get"), &gf).unwrap();
    let r3 = rue_runtime_vapor::to_value(obj2.into());
    assert_eq!(r3.as_string().unwrap(), "G");
    get.forget();

    // 其他：直接返回原值
    let r4 = rue_runtime_vapor::to_value(JsValue::from_bool(true));
    assert_eq!(r4.as_bool().unwrap(), true);

    let obj3 = js_sys::Object::new();
    js_sys::Reflect::set(&obj3, &JsValue::from_str("get"), &JsValue::from_str("not-a-function"))
        .unwrap();
    let r5 = rue_runtime_vapor::to_value(obj3.clone().into());
    assert!(js_sys::Object::is(&r5, &obj3.into()));

    let obj4 = js_sys::Object::new();
    js_sys::Reflect::set(&obj4, &JsValue::from_str("value"), &JsValue::from_str("value-first"))
        .unwrap();
    js_sys::Reflect::set(
        &obj4,
        &JsValue::from_str("get"),
        &js_sys::Function::new_no_args("return 'get-second';"),
    )
    .unwrap();
    let r6 = rue_runtime_vapor::to_value(obj4.into());
    assert_eq!(r6.as_string().as_deref(), Some("value-first"));

    let obj5 = js_sys::Object::new();
    js_sys::Reflect::set(&obj5, &JsValue::from_str("__rue_ref__"), &JsValue::TRUE).unwrap();
    js_sys::Reflect::set(&obj5, &JsValue::from_str("value"), &JsValue::from_str("stale-value"))
        .unwrap();
    js_sys::Reflect::set(
        &obj5,
        &JsValue::from_str("get"),
        &js_sys::Function::new_no_args("return 'live-get';"),
    )
    .unwrap();
    let r7 = rue_runtime_vapor::to_value(obj5.into());
    assert_eq!(r7.as_string().as_deref(), Some("live-get"));
}
