use js_sys::{Array, Function, Object, Promise, Reflect};
use rue_runtime_vapor::{
    ComponentProps, DomAdapter, JsDomAdapter, MOUNT_INPUT_REGISTRY, MountInput, MountInputType,
    Rue, createRue, get_current_instance, set_current_instance,
};
use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use wasm_bindgen_futures::JsFuture;
use wasm_bindgen_test::*;

mod common;

use common::{
    TestAdapter, child_sequence, make_vapor_only_adapter, setup_anchor, setup_container,
    setup_range, tick,
};

fn set_prop(target: &Object, key: &str, value: JsValue) {
    Reflect::set(target, &JsValue::from_str(key), &value).unwrap();
}

fn host_bridge(tag: &str) -> JsValue {
    let host = Object::new();
    set_prop(&host, "tag", JsValue::from_str(tag));
    set_prop(&host, "children", Array::new().into());
    set_prop(&host, "nodeType", JsValue::from_f64(1.0));

    let bridge = Object::new();
    set_prop(&bridge, "__rue_host_node", host.into());
    bridge.into()
}

fn compat_vnode(tag: &str, children: JsValue) -> Object {
    let vnode = Object::new();
    set_prop(&vnode, "type", JsValue::from_str(tag));
    set_prop(&vnode, "props", Object::new().into());
    if !children.is_undefined() {
        set_prop(&vnode, "children", children);
    }
    vnode
}

fn push_hook_call(name: &str) -> Function {
    Function::new_with_args("", &format!("globalThis.__lifecycle_hits.push('{}')", name))
}

fn manual_mount_input(r#type: MountInputType<JsDomAdapter>) -> MountInput<JsDomAdapter> {
    MountInput {
        r#type,
        props: ComponentProps::new(),
        children: Vec::new(),
        key: None,
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: None,
    }
}

fn store_manual_mount_input(input: MountInput<JsDomAdapter>) -> usize {
    MOUNT_INPUT_REGISTRY.with(|registry| {
        let mut entries = registry.borrow_mut();
        entries.push(Some(input));
        entries.len() - 1
    })
}

#[wasm_bindgen_test(async)]
async fn lifecycle_bridge_pending_hooks_trigger_mount_update_and_unmount() {
    let adapter = make_vapor_only_adapter();
    let rue = Rc::new(createRue(adapter.clone()));
    let container = setup_container(&adapter);
    let hits = Array::new();
    Reflect::set(&js_sys::global(), &JsValue::from_str("__lifecycle_hits"), &hits).unwrap();

    rue.on_before_mount(push_hook_call("direct-before-mount").into());
    rue.on_mounted(push_hook_call("direct-mounted").into());
    rue.on_before_update(push_hook_call("direct-before-update").into());
    rue.on_updated(push_hook_call("direct-updated").into());
    rue.on_before_unmount(push_hook_call("direct-before-unmount").into());
    rue.on_unmounted(push_hook_call("direct-unmounted").into());
    rue.on_created(push_hook_call("direct-created").into());

    let render_count = Rc::new(std::cell::Cell::new(0));
    let rue_for_component = rue.clone();
    let render_count_for_component = render_count.clone();
    let component = wasm_bindgen::closure::Closure::wrap(Box::new(move |_props: JsValue| {
        render_count_for_component.set(render_count_for_component.get() + 1);
        rue_for_component.on_before_mount(push_hook_call("pending-before-mount").into());
        rue_for_component.on_mounted(push_hook_call("pending-mounted").into());
        rue_for_component.on_created(push_hook_call("pending-created").into());
        rue_for_component.on_before_update(push_hook_call("pending-before-update").into());
        rue_for_component.on_updated(push_hook_call("pending-updated").into());
        rue_for_component.on_before_unmount(push_hook_call("pending-before-unmount").into());
        rue_for_component.on_unmounted(push_hook_call("pending-unmounted").into());
        host_bridge(if render_count_for_component.get() == 1 {
            "lifecycle-first"
        } else {
            "lifecycle-second"
        })
    })
        as Box<dyn FnMut(JsValue) -> JsValue>);

    let component_fn: Function = component.as_ref().clone().unchecked_into();
    let first = rue.create_component_wasm(component_fn.clone().into(), JsValue::UNDEFINED);
    rue.render_wasm(first, container.clone());
    tick().await;
    assert!(child_sequence(&container).contains(&"lifecycle-first".to_string()));

    let second = rue.create_component_wasm(component_fn.into(), JsValue::UNDEFINED);
    rue.render_wasm(second, container.clone());
    tick().await;

    rue.unmount_wasm(container.clone());
    rue.unmount_wasm(container.clone());
    rue.unmount_wasm(JsValue::UNDEFINED);
    tick().await;

    let recorded: Array = Reflect::get(&js_sys::global(), &JsValue::from_str("__lifecycle_hits"))
        .unwrap()
        .unchecked_into();
    let values = recorded.iter().filter_map(|value| value.as_string()).collect::<Vec<_>>();

    for expected in [
        "direct-before-mount",
        "direct-mounted",
        "direct-before-unmount",
        "direct-unmounted",
        "pending-before-mount",
        "pending-mounted",
        "pending-created",
        "pending-before-update",
        "pending-updated",
        "pending-before-unmount",
        "pending-unmounted",
    ] {
        assert!(values.iter().any(|value| value == expected), "missing {expected}");
    }

    component.forget();
}

#[wasm_bindgen_test(async)]
async fn keep_alive_range_bridge_triggers_component_activation_hooks() {
    let adapter = make_vapor_only_adapter();
    let rue = Rc::new(createRue(adapter.clone()));
    let (parent, start, end) = setup_range(&adapter);
    let hits = Array::new();
    Reflect::set(&js_sys::global(), &JsValue::from_str("__keep_alive_hits"), &hits).unwrap();

    let captured_instance = Rc::new(RefCell::new(JsValue::UNDEFINED));
    let rue_for_component = rue.clone();
    let captured_instance_for_component = captured_instance.clone();
    let component = wasm_bindgen::closure::Closure::wrap(Box::new(move |_props: JsValue| {
        captured_instance_for_component.replace(get_current_instance());
        rue_for_component.on_activated(
            Function::new_no_args("globalThis.__keep_alive_hits.push('activated')").into(),
        );
        rue_for_component.on_deactivated(
            Function::new_no_args("globalThis.__keep_alive_hits.push('deactivated')").into(),
        );
        host_bridge("keep-alive-child")
    })
        as Box<dyn FnMut(JsValue) -> JsValue>);

    let component_fn: Function = component.as_ref().clone().unchecked_into();
    let handle = rue.create_component_wasm(component_fn.into(), JsValue::UNDEFINED);
    rue.render_between_wasm(handle, parent, start.clone(), end);
    tick().await;

    let current = captured_instance.borrow().clone();
    assert!(Reflect::get(&current, &JsValue::from_str("__ci_index")).unwrap().as_f64().is_some());
    set_current_instance(current);
    rue.on_activated(Function::new_no_args("return undefined").into());
    rue.on_deactivated(Function::new_no_args("return undefined").into());

    let missing = Object::new();
    set_prop(&missing, "__ci_index", JsValue::from_f64(999_999.0));
    set_current_instance(missing.into());
    rue.on_activated(Function::new_no_args("return undefined").into());
    rue.on_deactivated(Function::new_no_args("return undefined").into());
    set_current_instance(JsValue::UNDEFINED);

    rue.deactivate_range_wasm(start.clone());
    rue.activate_range_wasm(start);

    let recorded: Array = Reflect::get(&js_sys::global(), &JsValue::from_str("__keep_alive_hits"))
        .unwrap()
        .unchecked_into();
    let values = recorded.iter().filter_map(|value| value.as_string()).collect::<Vec<_>>();
    assert!(values.iter().any(|value| value == "deactivated"));
    assert!(values.iter().any(|value| value == "activated"));

    component.forget();
}

#[wasm_bindgen_test(async)]
async fn keep_alive_range_bridge_reads_block_and_compat_root_lifecycle_records() {
    let adapter = make_vapor_only_adapter();
    let rue = createRue(adapter.clone());
    let (parent, start, end) = setup_range(&adapter);

    let text_id = store_manual_mount_input(manual_mount_input(MountInputType::Text(
        "keep-alive text".to_string(),
    )));
    rue.render_between_wasm(
        JsValue::from_f64(text_id as f64),
        parent.clone(),
        start.clone(),
        end.clone(),
    );
    tick().await;
    assert!(child_sequence(&parent).contains(&"keep-alive text".to_string()));

    rue.deactivate_range_wasm(start.clone());
    rue.activate_range_wasm(start.clone());

    let children = Array::new();
    children.push(&JsValue::from_str("compat child"));
    let compat_handle = rue.create_element_wasm(
        JsValue::from_str("compat-range-root"),
        Object::new().into(),
        children.into(),
    );
    rue.render_between_wasm(compat_handle, parent.clone(), start.clone(), end);
    tick().await;
    assert!(child_sequence(&parent).contains(&"compat-range-root".to_string()));

    rue.deactivate_range_wasm(start.clone());
    rue.activate_range_wasm(start);
}

#[wasm_bindgen_test]
fn dom_adapter_default_parent_creation_path_delegates_to_create_element() {
    let mut adapter = TestAdapter::default();
    let parent = adapter.create_document_fragment();
    let child = adapter.create_element_in_parent("default-child", Some(&parent));

    assert_eq!(child.tag, "default-child");
    assert!(adapter.nodes.contains_key(&child.id));
}

#[wasm_bindgen_test]
fn rue_core_public_accessors_start_empty_and_accept_adapter() {
    let mut rue: Rue<JsDomAdapter> = Rue::new();

    assert_eq!(rue.container_mount_count(), 0);
    assert_eq!(rue.anchor_mount_count(), 0);
    assert_eq!(rue.range_mount_count(), 0);
    assert!(rue.get_dom_adapter().is_none());
    assert!(rue.get_dom_adapter_mut().is_none());

    rue.set_dom_adapter(JsDomAdapter::new(make_vapor_only_adapter()));
    assert!(rue.get_dom_adapter().is_some());
    assert!(rue.get_dom_adapter_mut().is_some());
}

#[wasm_bindgen_test]
fn set_dom_adapter_bridge_replaces_adapter_used_by_later_render() {
    let first_adapter = make_vapor_only_adapter();
    let second_adapter = make_vapor_only_adapter();
    let rue = createRue(first_adapter);
    rue.set_dom_adapter(second_adapter.clone());

    let container = setup_container(&second_adapter);
    let handle = rue.vapor_wasm(
        Function::new_no_args("return { tag: 'set-dom-adapter-host', children: [], nodeType: 1 }")
            .into(),
    );
    rue.render_wasm(handle, container.clone());

    assert_eq!(child_sequence(&container), vec!["set-dom-adapter-host"]);
}

#[wasm_bindgen_test]
fn mount_input_metadata_is_observable_through_public_bridge_handles() {
    let adapter = make_vapor_only_adapter();
    let rue = createRue(adapter);
    let props = Object::new();
    let cleanup = Array::new();
    set_prop(&props, "key", JsValue::from_f64(42.0));
    set_prop(&props, "__rue_cleanup_bucket", cleanup.clone().into());
    set_prop(&props, "__rue_effect_scope_id", JsValue::from_f64(17.0));
    set_prop(&props, "title", JsValue::from_str("kept"));

    let handle =
        rue.create_element_wasm(JsValue::from_str("meta-el"), props.into(), JsValue::UNDEFINED);
    let handle_id = Reflect::get(&handle, &JsValue::from_str("__rue_mount_id"))
        .unwrap()
        .as_f64()
        .expect("mount id") as usize;

    MOUNT_INPUT_REGISTRY.with(|registry| {
        let mut entries = registry.borrow_mut();
        let input = entries.get_mut(handle_id).and_then(Option::take).expect("stored mount input");
        assert!(matches!(input.r#type, MountInputType::Element(ref tag) if tag == "meta-el"));
        assert_eq!(input.key.as_deref(), Some("42"));
        assert!(Array::is_array(input.mount_cleanup_bucket.as_ref().unwrap()));
        assert_eq!(input.mount_effect_scope_id, Some(17));
        assert!(!input.props.contains_key("__rue_cleanup_bucket"));
        assert!(!input.props.contains_key("__rue_effect_scope_id"));
        assert_eq!(input.props.get("title").and_then(JsValue::as_string).as_deref(), Some("kept"),);
    });

    let mut manual = MountInput::<JsDomAdapter> {
        r#type: MountInputType::Vapor,
        props: ComponentProps::new(),
        children: Vec::new(),
        key: None,
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: None,
    };
    let source = Object::new();
    let source_cleanup = Array::new();
    set_prop(&source, "key", JsValue::from_f64(99.0));
    set_prop(&source, "__rue_cleanup_bucket", source_cleanup.into());
    set_prop(&source, "__rue_effect_scope_id", JsValue::from_f64(23.0));

    manual.attach_mount_metadata_from_source(&source);
    assert_eq!(manual.key.as_deref(), Some("99"));
    assert!(Array::is_array(manual.mount_cleanup_bucket.as_ref().unwrap()));
    assert_eq!(manual.mount_effect_scope_id, Some(23));
}

#[wasm_bindgen_test(async)]
async fn default_transport_public_handles_cover_registry_text_phantom_and_invalid_inputs() {
    let adapter = make_vapor_only_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let text_id = store_manual_mount_input(manual_mount_input(MountInputType::Text(
        "stored text".to_string(),
    )));
    rue.render_wasm(JsValue::from_f64(text_id as f64), container.clone());
    tick().await;
    assert_eq!(child_sequence(&container), vec!["stored text"]);

    let updated_text_id = store_manual_mount_input(manual_mount_input(MountInputType::Text(
        "updated stored text".to_string(),
    )));
    rue.render_wasm(JsValue::from_f64(updated_text_id as f64), container.clone());
    tick().await;
    assert_eq!(child_sequence(&container), vec!["updated stored text"]);

    rue.render_wasm(JsValue::from_str("not-a-mount-id"), container.clone());
    tick().await;
    assert!(child_sequence(&container).is_empty());

    let text_string_id = store_manual_mount_input(manual_mount_input(MountInputType::Text(
        "numeric string text".to_string(),
    )));
    rue.render_wasm(JsValue::from_str(&text_string_id.to_string()), container.clone());
    tick().await;
    assert_eq!(child_sequence(&container), vec!["numeric string text"]);

    rue.render_wasm(JsValue::from_f64(999_999.0), container.clone());
    tick().await;
    assert!(child_sequence(&container).is_empty());

    let phantom_id = store_manual_mount_input(manual_mount_input(MountInputType::_Phantom(
        std::marker::PhantomData,
    )));
    rue.render_wasm(JsValue::from_f64(phantom_id as f64), container.clone());
    tick().await;
    assert!(child_sequence(&container).is_empty());

    let portable = Object::new();
    set_prop(&portable, "__rue_vapor_setup", JsValue::from_str("non-function marker"));
    rue.render_wasm(portable.into(), container.clone());
    tick().await;
    assert!(child_sequence(&container).is_empty());
}

#[wasm_bindgen_test(async)]
async fn render_triggered_and_server_prefetch_bridges_are_reachable_from_public_rue() {
    let adapter = make_vapor_only_adapter();
    let rue = createRue(adapter);

    let instance = Object::new();
    set_current_instance(instance.clone().into());
    rue.on_render_triggered(Function::new_no_args("return undefined").into());
    let hooks =
        Reflect::get(&instance, &JsValue::from_str("__rue_render_triggered_hooks")).unwrap();
    assert_eq!(Array::from(&hooks).length(), 1);
    set_current_instance(JsValue::UNDEFINED);

    Reflect::set(
        &js_sys::global(),
        &JsValue::from_str("__public_server_prefetch_hits"),
        &JsValue::from_f64(0.0),
    )
    .unwrap();
    let hook = Function::new_no_args(
        "globalThis.__public_server_prefetch_hits += 1; return Promise.resolve('done')",
    );
    rue.on_server_prefetch(hook.into());
    let promise: Promise = rue.run_server_prefetch();
    JsFuture::from(promise).await.unwrap();

    assert_eq!(
        Reflect::get(&js_sys::global(), &JsValue::from_str("__public_server_prefetch_hits"))
            .unwrap()
            .as_f64(),
        Some(1.0),
    );

    rue.on_server_prefetch(Function::new_no_args("throw new Error('prefetch boom')").into());
    assert!(JsFuture::from(rue.run_server_prefetch()).await.is_err());

    rue.on_activated(Function::new_no_args("return undefined").into());
    rue.on_deactivated(Function::new_no_args("return undefined").into());

    Reflect::set(
        &js_sys::global(),
        &JsValue::from_str("__public_emitted_empty_hits"),
        &JsValue::from_f64(0.0),
    )
    .unwrap();
    let props = Object::new();
    set_prop(
        &props,
        "on",
        Function::new_no_args("globalThis.__public_emitted_empty_hits += 1").into(),
    );
    let emitter: Function = rue.emitted_wasm(props.into()).unchecked_into();
    emitter.call2(&JsValue::UNDEFINED, &JsValue::from_str(""), &Array::new().into()).unwrap();
    assert_eq!(
        Reflect::get(&js_sys::global(), &JsValue::from_str("__public_emitted_empty_hits"))
            .unwrap()
            .as_f64(),
        Some(2.0),
    );

    Reflect::set(
        &js_sys::global(),
        &JsValue::from_str("__public_emitted_args"),
        &JsValue::UNDEFINED,
    )
    .unwrap();
    let args_props = Object::new();
    set_prop(
        &args_props,
        "onSave",
        Function::new_with_args(
            "first, second",
            "globalThis.__public_emitted_args = [first, second]",
        )
        .into(),
    );
    let args_emitter: Function = rue.emitted_wasm(args_props.into()).unchecked_into();
    let args = Array::new();
    args.push(&JsValue::from_str("one"));
    args.push(&JsValue::from_f64(2.0));
    args_emitter.call2(&JsValue::UNDEFINED, &JsValue::from_str("save"), &args.into()).unwrap();
    let received: Array =
        Reflect::get(&js_sys::global(), &JsValue::from_str("__public_emitted_args"))
            .unwrap()
            .unchecked_into();
    assert_eq!(received.get(0).as_string().as_deref(), Some("one"));
    assert_eq!(received.get(1).as_f64(), Some(2.0));

    let noop_emitter: Function = rue.emitted_wasm(JsValue::from_str("not-props")).unchecked_into();
    noop_emitter.call2(&JsValue::UNDEFINED, &JsValue::from_str("save"), &JsValue::NULL).unwrap();
}

#[wasm_bindgen_test(async)]
async fn reentrant_public_bridges_use_pending_or_noop_fallbacks() {
    let adapter = make_vapor_only_adapter();
    let rue = Rc::new(createRue(adapter.clone()));
    let container = setup_container(&adapter);
    let activated_side_container = setup_container(&adapter);
    let deactivated_side_container = setup_container(&adapter);
    let (anchor_parent, anchor) = setup_anchor(&adapter);
    let (range_parent, start, end) = setup_range(&adapter);
    let (static_parent, static_anchor) = setup_anchor(&adapter);
    let activated_side_text_id = store_manual_mount_input(manual_mount_input(
        MountInputType::Text("queued activated side text".to_string()),
    ));
    let deactivated_side_text_id = store_manual_mount_input(manual_mount_input(
        MountInputType::Text("queued deactivated side text".to_string()),
    ));

    let rue_for_component = rue.clone();
    let container_for_component = container.clone();
    let activated_side_container_for_component = activated_side_container.clone();
    let deactivated_side_container_for_component = deactivated_side_container.clone();
    let anchor_parent_for_component = anchor_parent.clone();
    let anchor_for_component = anchor.clone();
    let range_parent_for_component = range_parent.clone();
    let start_for_component = start.clone();
    let end_for_component = end.clone();
    let static_parent_for_component = static_parent.clone();
    let static_anchor_for_component = static_anchor.clone();
    let component = wasm_bindgen::closure::Closure::wrap(Box::new(move |_props: JsValue| {
        rue_for_component
            .on_server_prefetch(Function::new_no_args("return Promise.resolve('queued')").into());
        let _promise = rue_for_component.run_server_prefetch();

        let emitter: Function =
            rue_for_component.emitted_wasm(Object::new().into()).unchecked_into();
        emitter
            .call2(&JsValue::UNDEFINED, &JsValue::from_str("save"), &Array::new().into())
            .unwrap();

        rue_for_component.activate_range_wasm(Object::new().into());
        rue_for_component.render_wasm(
            JsValue::from_f64(activated_side_text_id as f64),
            activated_side_container_for_component.clone(),
        );
        rue_for_component.deactivate_range_wasm(Object::new().into());
        rue_for_component.render_wasm(
            JsValue::from_f64(deactivated_side_text_id as f64),
            deactivated_side_container_for_component.clone(),
        );

        rue_for_component.render_wasm(
            JsValue::from_str("reentrant-invalid-render"),
            container_for_component.clone(),
        );
        rue_for_component.render_anchor_wasm(
            JsValue::from_str("reentrant-invalid-anchor"),
            anchor_parent_for_component.clone(),
            anchor_for_component.clone(),
        );
        rue_for_component.render_between_wasm(
            JsValue::from_str("reentrant-invalid-between"),
            range_parent_for_component.clone(),
            start_for_component.clone(),
            end_for_component.clone(),
        );
        rue_for_component.render_static_wasm(
            JsValue::from_str("reentrant-invalid-static"),
            static_parent_for_component.clone(),
            static_anchor_for_component.clone(),
        );
        host_bridge("reentrant-bridge-child")
    })
        as Box<dyn FnMut(JsValue) -> JsValue>);

    let component_fn: Function = component.as_ref().clone().unchecked_into();
    let handle = rue.create_component_wasm(component_fn.into(), JsValue::UNDEFINED);
    rue.render_wasm(handle, container.clone());
    tick().await;
    tick().await;
    assert_eq!(child_sequence(&container), vec!["reentrant-bridge-child"]);
    assert_eq!(child_sequence(&activated_side_container), vec!["queued activated side text"]);
    assert_eq!(child_sequence(&deactivated_side_container), vec!["queued deactivated side text"]);

    component.forget();
}

#[wasm_bindgen_test(async)]
async fn render_unmount_invokes_mount_cleanup_bucket_once() {
    let adapter = make_vapor_only_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let hits = Array::new();
    Reflect::set(&js_sys::global(), &JsValue::from_str("__cleanup_bucket_hits"), &hits).unwrap();
    let cleanup_bucket = Array::new();
    cleanup_bucket
        .push(&Function::new_no_args("globalThis.__cleanup_bucket_hits.push('cleanup')").into());
    cleanup_bucket.push(&JsValue::from_str("not-a-function"));

    let bridge = Object::from(host_bridge("cleanup-child"));
    let host = Reflect::get(&bridge, &JsValue::from_str("__rue_host_node")).unwrap();
    Reflect::set(
        &host,
        &JsValue::from_str("className"),
        &JsValue::from_str("sidebar-playground cleanup"),
    )
    .unwrap();
    set_prop(&bridge, "__rue_cleanup_bucket", cleanup_bucket.clone().into());
    rue.render_wasm(bridge.into(), container.clone());
    tick().await;
    assert_eq!(child_sequence(&container), vec!["cleanup-child"]);

    Reflect::set(
        &js_sys::global(),
        &JsValue::from_str("__rue_debug_clear_enabled__"),
        &JsValue::TRUE,
    )
    .unwrap();
    Reflect::set(
        &js_sys::global(),
        &JsValue::from_str("__rue_debug_clear_meta__"),
        &JsValue::from_str("cleanup-test"),
    )
    .unwrap();
    rue.unmount_wasm(container.clone());
    tick().await;
    assert_eq!(hits.length(), 1);
    assert_eq!(cleanup_bucket.length(), 0);
    let clear_records = Reflect::get(&js_sys::global(), &JsValue::from_str("__rue_debug_clear__"))
        .unwrap_or(JsValue::UNDEFINED);
    if Array::is_array(&clear_records) {
        assert!(Array::from(&clear_records).length() >= 1);
    }

    rue.unmount_wasm(container);
    tick().await;
    assert_eq!(hits.length(), 1);
    Reflect::delete_property(&js_sys::global(), &JsValue::from_str("__rue_debug_clear_enabled__"))
        .unwrap();
    Reflect::delete_property(&js_sys::global(), &JsValue::from_str("__rue_debug_clear_meta__"))
        .unwrap();
    Reflect::delete_property(&js_sys::global(), &JsValue::from_str("__rue_debug_clear__")).unwrap();
}

#[wasm_bindgen_test(async)]
async fn render_null_records_sidebar_clear_debug_metadata() {
    let adapter = make_vapor_only_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let bridge = Object::from(host_bridge("debug-clear-child"));
    let host = Reflect::get(&bridge, &JsValue::from_str("__rue_host_node")).unwrap();
    Reflect::set(
        &host,
        &JsValue::from_str("className"),
        &JsValue::from_str("sidebar-playground debug-clear"),
    )
    .unwrap();
    rue.render_wasm(bridge.into(), container.clone());
    tick().await;
    assert_eq!(child_sequence(&container), vec!["debug-clear-child"]);

    Reflect::set(
        &js_sys::global(),
        &JsValue::from_str("__rue_debug_clear_enabled__"),
        &JsValue::TRUE,
    )
    .unwrap();
    Reflect::set(
        &js_sys::global(),
        &JsValue::from_str("__rue_debug_clear_source__"),
        &JsValue::from_str("render-null-test"),
    )
    .unwrap();
    Reflect::set(
        &js_sys::global(),
        &JsValue::from_str("__rue_debug_clear_meta__"),
        &JsValue::from_str("sidebar-meta"),
    )
    .unwrap();

    rue.render_wasm(JsValue::NULL, container.clone());
    tick().await;

    let clear_records = Reflect::get(&js_sys::global(), &JsValue::from_str("__rue_debug_clear__"))
        .unwrap_or(JsValue::UNDEFINED);
    assert!(Array::is_array(&clear_records));
    let clear_records = Array::from(&clear_records);
    assert!(clear_records.length() >= 1);
    let record = clear_records.get(clear_records.length() - 1);
    assert!(
        Reflect::get(&record, &JsValue::from_str("source"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .is_some()
    );
    assert_eq!(
        Reflect::get(&record, &JsValue::from_str("meta"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .as_deref(),
        Some("sidebar-meta")
    );

    Reflect::delete_property(&js_sys::global(), &JsValue::from_str("__rue_debug_clear_enabled__"))
        .unwrap();
    Reflect::delete_property(&js_sys::global(), &JsValue::from_str("__rue_debug_clear_source__"))
        .unwrap();
    Reflect::delete_property(&js_sys::global(), &JsValue::from_str("__rue_debug_clear_meta__"))
        .unwrap();
    Reflect::delete_property(&js_sys::global(), &JsValue::from_str("__rue_debug_clear__")).unwrap();
}

#[wasm_bindgen_test]
fn js_dom_adapter_covers_optional_fallbacks_and_common_dom_ops() {
    let adapter_value = make_vapor_only_adapter();
    let mut adapter = JsDomAdapter::new(adapter_value);
    let mut parent = adapter.create_document_fragment();
    let mut first = adapter.create_element_in_parent("input", Some(&parent));
    let second = adapter.create_element("replacement");
    let text = adapter.create_text_node("hello");

    adapter.append_child(&mut parent, &first);
    adapter.insert_before(&mut parent, &text, &first);
    assert!(adapter.contains(&parent, &first));
    assert!(adapter.get_parent_node(&first).is_some());

    adapter.set_class_name(&mut first, "active");
    adapter.set_text_content(&mut first, "updated");
    adapter.set_value(&mut first, JsValue::from_str("value"));
    adapter.set_checked(&mut first, true);
    adapter.set_disabled(&mut first, true);
    adapter.set_attribute(&mut first, "data-kind", "demo");
    adapter.remove_attribute(&mut first, "data-kind");
    adapter.patch_style(
        &mut first,
        &HashMap::new(),
        &HashMap::from([("color".into(), "red".into())]),
    );
    adapter.add_event_listener(&mut first, "click", Function::new_no_args("").into());
    adapter.remove_event_listener(&mut first, "click", Function::new_no_args("").into());
    adapter.apply_ref(&mut first, JsValue::from_str("ref"));
    adapter.clear_ref(JsValue::from_str("ref"));

    let select = adapter.create_element("SELECT");
    Reflect::set(&select, &JsValue::from_str("multiple"), &JsValue::TRUE).unwrap();
    assert!(adapter.is_select_multiple(&select));
    assert!(adapter.has_value_property(&first));
    assert_eq!(adapter.get_tag_name(&first), "input");
    assert!(adapter.query_selector(".target").is_some());

    adapter.replace_child(&mut parent, &second, &first);
    adapter.remove_child(&mut parent, &second);
    adapter.set_inner_html(&mut parent, "<span></span>");
}

#[wasm_bindgen_test]
fn rue_unmount_bridge_clears_rendered_container_and_is_idempotent() {
    let adapter = make_vapor_only_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);
    let handle = rue.vapor_wasm(
        Function::new_no_args("return { tag: 'unmount-target', children: [], nodeType: 1 }").into(),
    );

    rue.render_wasm(handle, container.clone());
    assert_eq!(child_sequence(&container), vec!["unmount-target"]);

    rue.unmount_wasm(container.clone());
    assert!(child_sequence(&container).is_empty());

    rue.unmount_wasm(container);
    rue.unmount_wasm(JsValue::UNDEFINED);
}

#[wasm_bindgen_test(async)]
async fn render_anchor_legacy_compat_object_uses_shared_vnode_helpers() {
    let adapter = make_vapor_only_adapter();
    let rue = createRue(adapter.clone());
    let (parent, anchor) = setup_anchor(&adapter);

    let props = Object::new();
    let prop_children = Array::new();
    prop_children.push(&compat_vnode("prop-child", JsValue::UNDEFINED).into());
    set_prop(&props, "children", prop_children.into());

    let root = Object::new();
    set_prop(&root, "type", JsValue::from_str("compat-root"));
    set_prop(&root, "props", props.into());

    rue.render_anchor_wasm(root.into(), parent.clone(), anchor.clone());
    tick().await;
    assert!(child_sequence(&parent).contains(&"compat-root".to_string()));

    let nested = Array::new();
    nested.push(&compat_vnode("nested-child", JsValue::UNDEFINED).into());
    nested.push(&JsValue::from_f64(5.0));
    nested.push(&JsValue::TRUE);
    let replacement = compat_vnode("compat-replacement", nested.into());
    rue.render_anchor_wasm(replacement.into(), parent.clone(), anchor);
    tick().await;

    let seq = child_sequence(&parent);
    assert!(seq.iter().any(|item| item == "compat-replacement"));
}
