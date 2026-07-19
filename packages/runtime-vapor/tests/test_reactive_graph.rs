use js_sys::{Function, Object, Reflect};
use rue_runtime_vapor::{
    batch, create_computed, create_effect, create_signal, set_reactive_scheduling, untrack,
};
use std::cell::{Cell, RefCell};
use std::rc::Rc;
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use wasm_bindgen::closure::Closure;
use wasm_bindgen_test::*;

#[wasm_bindgen_test]
fn effect_drops_stale_conditional_dependencies() {
    set_reactive_scheduling("sync");
    let gate = create_signal(JsValue::TRUE, None);
    let left = create_signal(JsValue::from_f64(0.0), None);
    let right = create_signal(JsValue::from_f64(0.0), None);
    let hits = Rc::new(Cell::new(0));

    let callback = {
        let gate = gate.clone();
        let left = left.clone();
        let right = right.clone();
        let hits = hits.clone();
        Closure::wrap(Box::new(move || {
            hits.set(hits.get() + 1);
            if gate.get_js().as_bool().unwrap_or(false) { left.get_js() } else { right.get_js() }
        }) as Box<dyn FnMut() -> JsValue>)
    };
    let _effect = create_effect(callback.as_ref().clone().unchecked_into(), None);
    assert_eq!(hits.get(), 1);

    left.set_js(JsValue::from_f64(1.0));
    assert_eq!(hits.get(), 2);
    gate.set_js(JsValue::FALSE);
    assert_eq!(hits.get(), 3);

    left.set_js(JsValue::from_f64(2.0));
    assert_eq!(hits.get(), 3, "the inactive branch must be unlinked");
    right.set_js(JsValue::from_f64(1.0));
    assert_eq!(hits.get(), 4);
    callback.forget();
}

#[wasm_bindgen_test]
fn nested_effect_and_untrack_restore_outer_tracking() {
    set_reactive_scheduling("sync");
    let before = create_signal(JsValue::from_f64(0.0), None);
    let after = create_signal(JsValue::from_f64(0.0), None);
    let inner_source = create_signal(JsValue::from_f64(0.0), None);
    let ignored = create_signal(JsValue::from_f64(0.0), None);
    let outer_hits = Rc::new(Cell::new(0));
    let inner_hits = Rc::new(Cell::new(0));
    let created_inner = Rc::new(Cell::new(false));
    let retained_closures = Rc::new(RefCell::new(Vec::<Closure<dyn FnMut()>>::new()));

    let callback = {
        let before = before.clone();
        let after = after.clone();
        let inner_source = inner_source.clone();
        let ignored = ignored.clone();
        let outer_hits = outer_hits.clone();
        let inner_hits = inner_hits.clone();
        let created_inner = created_inner.clone();
        let retained_closures = retained_closures.clone();
        Closure::wrap(Box::new(move || {
            outer_hits.set(outer_hits.get() + 1);
            before.get_js();

            if !created_inner.replace(true) {
                let inner_callback = {
                    let inner_source = inner_source.clone();
                    let inner_hits = inner_hits.clone();
                    Closure::wrap(Box::new(move || {
                        inner_hits.set(inner_hits.get() + 1);
                        inner_source.get_js();
                    }) as Box<dyn FnMut()>)
                };
                let function: Function = inner_callback.as_ref().clone().unchecked_into();
                let _inner_effect = create_effect(function, None);
                retained_closures.borrow_mut().push(inner_callback);
            }

            let untracked = {
                let ignored = ignored.clone();
                Closure::once_into_js(move || ignored.get_js())
            };
            untrack(untracked.unchecked_into());
            after.get_js();
        }) as Box<dyn FnMut()>)
    };

    let _outer_effect = create_effect(callback.as_ref().clone().unchecked_into(), None);
    assert_eq!(outer_hits.get(), 1);
    assert_eq!(inner_hits.get(), 1);

    after.set_js(JsValue::from_f64(1.0));
    assert_eq!(outer_hits.get(), 2, "nested tracking must restore the outer effect");
    ignored.set_js(JsValue::from_f64(1.0));
    assert_eq!(outer_hits.get(), 2, "untrack must not create an outer dependency");
    inner_source.set_js(JsValue::from_f64(1.0));
    assert_eq!(inner_hits.get(), 2);
    assert_eq!(outer_hits.get(), 2);
    callback.forget();
}

#[wasm_bindgen_test]
fn dispose_unlinks_all_graph_dependencies() {
    set_reactive_scheduling("sync");
    let source = create_signal(JsValue::from_f64(0.0), None);
    let hits = Rc::new(Cell::new(0));
    let callback = {
        let source = source.clone();
        let hits = hits.clone();
        Closure::wrap(Box::new(move || {
            hits.set(hits.get() + 1);
            source.get_js();
            source.get_js();
        }) as Box<dyn FnMut()>)
    };
    let effect = create_effect(callback.as_ref().clone().unchecked_into(), None);
    assert_eq!(hits.get(), 1);

    effect.dispose_js();
    source.set_js(JsValue::from_f64(1.0));
    source.trigger_js();
    assert_eq!(hits.get(), 1);
    callback.forget();
}

#[wasm_bindgen_test]
fn computed_equal_result_bails_out_downstream_effect() {
    set_reactive_scheduling("sync");
    let source = create_signal(JsValue::from_f64(0.0), None);
    let getter_hits = Rc::new(Cell::new(0));
    let effect_hits = Rc::new(Cell::new(0));
    let getter = {
        let source = source.clone();
        let getter_hits = getter_hits.clone();
        Closure::wrap(Box::new(move || {
            getter_hits.set(getter_hits.get() + 1);
            JsValue::from_f64(source.get_js().as_f64().unwrap_or_default() % 2.0)
        }) as Box<dyn FnMut() -> JsValue>)
    };
    let computed = create_computed(getter.as_ref().clone());
    let effect_callback = {
        let computed = computed.clone();
        let effect_hits = effect_hits.clone();
        Closure::wrap(Box::new(move || {
            effect_hits.set(effect_hits.get() + 1);
            computed.get_js();
        }) as Box<dyn FnMut()>)
    };
    let _effect = create_effect(effect_callback.as_ref().clone().unchecked_into(), None);
    assert_eq!((getter_hits.get(), effect_hits.get()), (1, 1));

    source.set_js(JsValue::from_f64(2.0));
    assert_eq!(getter_hits.get(), 2);
    assert_eq!(effect_hits.get(), 1, "equal computed output must bail out downstream");
    getter.forget();
    effect_callback.forget();
}

#[wasm_bindgen_test]
fn computed_diamond_updates_each_node_once() {
    set_reactive_scheduling("sync");
    let source = create_signal(JsValue::from_f64(0.0), None);
    let left_hits = Rc::new(Cell::new(0));
    let right_hits = Rc::new(Cell::new(0));
    let joined_hits = Rc::new(Cell::new(0));
    let effect_hits = Rc::new(Cell::new(0));

    let left_getter = {
        let source = source.clone();
        let hits = left_hits.clone();
        Closure::wrap(Box::new(move || {
            hits.set(hits.get() + 1);
            JsValue::from_f64(source.get_js().as_f64().unwrap_or_default() + 1.0)
        }) as Box<dyn FnMut() -> JsValue>)
    };
    let left = create_computed(left_getter.as_ref().clone());
    let right_getter = {
        let source = source.clone();
        let hits = right_hits.clone();
        Closure::wrap(Box::new(move || {
            hits.set(hits.get() + 1);
            JsValue::from_f64(source.get_js().as_f64().unwrap_or_default() + 2.0)
        }) as Box<dyn FnMut() -> JsValue>)
    };
    let right = create_computed(right_getter.as_ref().clone());
    let joined_getter = {
        let left = left.clone();
        let right = right.clone();
        let hits = joined_hits.clone();
        Closure::wrap(Box::new(move || {
            hits.set(hits.get() + 1);
            JsValue::from_f64(
                left.get_js().as_f64().unwrap_or_default()
                    + right.get_js().as_f64().unwrap_or_default(),
            )
        }) as Box<dyn FnMut() -> JsValue>)
    };
    let joined = create_computed(joined_getter.as_ref().clone());
    let effect_callback = {
        let joined = joined.clone();
        let hits = effect_hits.clone();
        Closure::wrap(Box::new(move || {
            hits.set(hits.get() + 1);
            joined.get_js();
        }) as Box<dyn FnMut()>)
    };
    let _effect = create_effect(effect_callback.as_ref().clone().unchecked_into(), None);

    source.set_js(JsValue::from_f64(1.0));
    assert_eq!(left_hits.get(), 2);
    assert_eq!(right_hits.get(), 2);
    assert_eq!(joined_hits.get(), 2, "the diamond join must update once");
    assert_eq!(effect_hits.get(), 2, "the diamond consumer must run once");
    left_getter.forget();
    right_getter.forget();
    joined_getter.forget();
    effect_callback.forget();
}

#[wasm_bindgen_test]
fn computed_reverted_source_skips_downstream_effect() {
    set_reactive_scheduling("sync");
    let source = create_signal(JsValue::from_f64(0.0), None);
    let effect_hits = Rc::new(Cell::new(0));
    let getter = {
        let source = source.clone();
        Closure::wrap(Box::new(move || source.get_js()) as Box<dyn FnMut() -> JsValue>)
    };
    let computed = create_computed(getter.as_ref().clone());
    let effect_callback = {
        let computed = computed.clone();
        let hits = effect_hits.clone();
        Closure::wrap(Box::new(move || {
            hits.set(hits.get() + 1);
            computed.get_js();
        }) as Box<dyn FnMut()>)
    };
    let _effect = create_effect(effect_callback.as_ref().clone().unchecked_into(), None);
    let batch_callback = {
        let source = source.clone();
        Closure::once_into_js(move || {
            source.set_js(JsValue::from_f64(1.0));
            source.set_js(JsValue::from_f64(0.0));
        })
    };
    batch(batch_callback.unchecked_into());
    assert_eq!(effect_hits.get(), 1);
    getter.forget();
    effect_callback.forget();
}

#[wasm_bindgen_test]
fn computed_switches_dependencies_without_stale_notifications() {
    set_reactive_scheduling("sync");
    let gate = create_signal(JsValue::TRUE, None);
    let left = create_signal(JsValue::from_f64(0.0), None);
    let right = create_signal(JsValue::from_f64(0.0), None);
    let getter_hits = Rc::new(Cell::new(0));
    let getter = {
        let gate = gate.clone();
        let left = left.clone();
        let right = right.clone();
        let hits = getter_hits.clone();
        Closure::wrap(Box::new(move || {
            hits.set(hits.get() + 1);
            if gate.get_js().as_bool().unwrap_or(false) { left.get_js() } else { right.get_js() }
        }) as Box<dyn FnMut() -> JsValue>)
    };
    let computed = create_computed(getter.as_ref().clone());
    let effect_callback = {
        let computed = computed.clone();
        Closure::wrap(Box::new(move || {
            computed.get_js();
        }) as Box<dyn FnMut()>)
    };
    let _effect = create_effect(effect_callback.as_ref().clone().unchecked_into(), None);

    gate.set_js(JsValue::FALSE);
    assert_eq!(getter_hits.get(), 2);
    left.set_js(JsValue::from_f64(1.0));
    assert_eq!(getter_hits.get(), 2, "inactive computed dependency must be removed");
    right.set_js(JsValue::from_f64(1.0));
    assert_eq!(getter_hits.get(), 3);
    getter.forget();
    effect_callback.forget();
}

fn branch_value(left: f64, right: f64) -> JsValue {
    let value = Object::new();
    Reflect::set(&value, &JsValue::from_str("left"), &JsValue::from_f64(left)).unwrap();
    Reflect::set(&value, &JsValue::from_str("right"), &JsValue::from_f64(right)).unwrap();
    value.into()
}

#[wasm_bindgen_test]
fn path_and_root_dependencies_dedupe_effect_run() {
    set_reactive_scheduling("sync");
    let source = create_signal(branch_value(0.0, 0.0), None);
    let hits = Rc::new(Cell::new(0));
    let callback = {
        let source = source.clone();
        let hits = hits.clone();
        Closure::wrap(Box::new(move || {
            hits.set(hits.get() + 1);
            source.get_js();
            source.get_path_js(JsValue::from_str("left"));
        }) as Box<dyn FnMut()>)
    };
    let _effect = create_effect(callback.as_ref().clone().unchecked_into(), None);

    source.set_path_js(JsValue::from_str("left"), JsValue::from_f64(1.0));
    assert_eq!(hits.get(), 2, "root and path links must schedule the effect once");
    callback.forget();
}

#[wasm_bindgen_test]
fn dynamic_path_dependency_unlinks_old_branch() {
    set_reactive_scheduling("sync");
    let gate = create_signal(JsValue::TRUE, None);
    let source = create_signal(branch_value(0.0, 0.0), None);
    let hits = Rc::new(Cell::new(0));
    let callback = {
        let gate = gate.clone();
        let source = source.clone();
        let hits = hits.clone();
        Closure::wrap(Box::new(move || {
            hits.set(hits.get() + 1);
            let path = if gate.get_js().as_bool().unwrap_or(false) { "left" } else { "right" };
            source.get_path_js(JsValue::from_str(path));
        }) as Box<dyn FnMut()>)
    };
    let _effect = create_effect(callback.as_ref().clone().unchecked_into(), None);

    gate.set_js(JsValue::FALSE);
    assert_eq!(hits.get(), 2);
    source.set_path_js(JsValue::from_str("left"), JsValue::from_f64(1.0));
    assert_eq!(hits.get(), 2, "the stale path link must be removed after rerun");
    source.set_path_js(JsValue::from_str("right"), JsValue::from_f64(1.0));
    assert_eq!(hits.get(), 3);
    callback.forget();
}

#[wasm_bindgen_test]
fn unused_path_dependency_node_is_reclaimed() {
    set_reactive_scheduling("sync");
    let source = create_signal(branch_value(0.0, 0.0), None);
    let hits = Rc::new(Cell::new(0));
    let callback = {
        let source = source.clone();
        let hits = hits.clone();
        Closure::wrap(Box::new(move || {
            hits.set(hits.get() + 1);
            source.get_path_js(JsValue::from_str("left"));
        }) as Box<dyn FnMut()>)
    };
    let effect = create_effect(callback.as_ref().clone().unchecked_into(), None);
    effect.dispose_js();

    source.trigger_path_js(JsValue::from_str("left"));
    source.set_path_js(JsValue::from_str("left"), JsValue::from_f64(1.0));
    assert_eq!(hits.get(), 1, "disposed path consumers must be detached");
    callback.forget();
}

#[wasm_bindgen_test]
fn batched_nested_effects_flush_once_in_stable_order() {
    set_reactive_scheduling("sync");
    let source = create_signal(JsValue::from_f64(0.0), None);
    let order = Rc::new(RefCell::new(Vec::<&'static str>::new()));

    let first_callback = {
        let source = source.clone();
        let order = order.clone();
        Closure::wrap(Box::new(move || {
            source.get_js();
            order.borrow_mut().push("first");
        }) as Box<dyn FnMut()>)
    };
    let second_callback = {
        let source = source.clone();
        let order = order.clone();
        Closure::wrap(Box::new(move || {
            source.get_js();
            order.borrow_mut().push("second");
        }) as Box<dyn FnMut()>)
    };
    let _first = create_effect(first_callback.as_ref().clone().unchecked_into(), None);
    let _second = create_effect(second_callback.as_ref().clone().unchecked_into(), None);
    order.borrow_mut().clear();

    let outer = {
        let source = source.clone();
        Closure::once_into_js(move || {
            source.set_js(JsValue::from_f64(1.0));
            let inner = {
                let source = source.clone();
                Closure::once_into_js(move || source.set_js(JsValue::from_f64(2.0)))
            };
            batch(inner.unchecked_into());
            source.set_js(JsValue::from_f64(3.0));
        })
    };
    batch(outer.unchecked_into());

    assert_eq!(&*order.borrow(), &["first", "second"]);
    first_callback.forget();
    second_callback.forget();
}

#[wasm_bindgen_test]
fn scope_dispose_during_propagation_skips_stale_nodes() {
    set_reactive_scheduling("sync");
    let source = create_signal(JsValue::from_f64(0.0), None);
    let first_hits = Rc::new(Cell::new(0));
    let second_hits = Rc::new(Cell::new(0));
    let second_handle = Rc::new(RefCell::new(None::<rue_runtime_vapor::EffectHandle>));

    let first_callback = {
        let source = source.clone();
        let hits = first_hits.clone();
        let second_handle = second_handle.clone();
        Closure::wrap(Box::new(move || {
            source.get_js();
            hits.set(hits.get() + 1);
            if hits.get() > 1
                && let Some(handle) = second_handle.borrow_mut().take()
            {
                handle.dispose_js();
            }
        }) as Box<dyn FnMut()>)
    };
    let _first = create_effect(first_callback.as_ref().clone().unchecked_into(), None);
    let second_callback = {
        let source = source.clone();
        let hits = second_hits.clone();
        Closure::wrap(Box::new(move || {
            source.get_js();
            hits.set(hits.get() + 1);
        }) as Box<dyn FnMut()>)
    };
    *second_handle.borrow_mut() =
        Some(create_effect(second_callback.as_ref().clone().unchecked_into(), None));

    source.set_js(JsValue::from_f64(1.0));
    assert_eq!(first_hits.get(), 2);
    assert_eq!(second_hits.get(), 1, "disposed queued effects must become no-ops");
    source.set_js(JsValue::from_f64(2.0));
    assert_eq!(first_hits.get(), 3);
    assert_eq!(second_hits.get(), 1);
    first_callback.forget();
    second_callback.forget();
}

#[wasm_bindgen_test]
fn tracking_context_restores_after_throw() {
    set_reactive_scheduling("sync");
    let global = js_sys::global();
    let error_handler = Function::new_with_args("error", "return true");
    Reflect::set(&global, &JsValue::from_str("__rue_dispatch_error_captured"), &error_handler)
        .unwrap();

    let throwing_source = create_signal(JsValue::from_f64(0.0), None);
    let throwing_callback = {
        let source = throwing_source.clone();
        Closure::wrap(Box::new(move || {
            source.get_js();
            Err::<(), JsValue>(JsValue::from_str("handled graph test error"))?;
            Ok::<(), JsValue>(())
        }) as Box<dyn FnMut() -> Result<(), JsValue>>)
    };
    let _throwing = create_effect(throwing_callback.as_ref().clone().unchecked_into(), None);

    let survivor = create_signal(JsValue::from_f64(0.0), None);
    let survivor_hits = Rc::new(Cell::new(0));
    let survivor_callback = {
        let survivor = survivor.clone();
        let hits = survivor_hits.clone();
        Closure::wrap(Box::new(move || {
            survivor.get_js();
            hits.set(hits.get() + 1);
        }) as Box<dyn FnMut()>)
    };
    let _survivor_effect = create_effect(survivor_callback.as_ref().clone().unchecked_into(), None);

    throwing_source.set_js(JsValue::from_f64(1.0));
    survivor.set_js(JsValue::from_f64(1.0));
    assert_eq!(survivor_hits.get(), 2, "throwing effects must restore active tracking");

    Reflect::delete_property(&global, &JsValue::from_str("__rue_dispatch_error_captured")).unwrap();
    throwing_callback.forget();
    survivor_callback.forget();
}
