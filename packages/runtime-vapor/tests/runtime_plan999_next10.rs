#![cfg(feature = "compat")]

use js_sys::{Array, Function, Object, Promise, Reflect};
use rue_runtime_vapor::hook::reactive::props_reactive_js;
use rue_runtime_vapor::{
    ComponentProps, DomAdapter, MountInput, MountInputType, Rue, computed_js, createRue,
    set_current_instance, set_reactive_scheduling, use_state, watch_effect, watch_path,
};
use std::rc::Rc;
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use wasm_bindgen_futures::JsFuture;
use wasm_bindgen_test::*;

mod common;

use common::{
    TestAdapter, child_sequence, make_vapor_only_adapter, make_wasm_adapter, setup_anchor,
    setup_container, setup_range, tick, update_siblings,
};
use rue_runtime_vapor::MountInputChild;

fn set_prop(target: &Object, key: &str, value: JsValue) {
    Reflect::set(target, &JsValue::from_str(key), &value).unwrap();
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

fn host_bridge(tag: &str) -> JsValue {
    let host = Object::new();
    set_prop(&host, "tag", JsValue::from_str(tag));
    set_prop(&host, "tagName", JsValue::from_str(&tag.to_ascii_uppercase()));
    set_prop(&host, "children", Array::new().into());
    set_prop(&host, "nodeType", JsValue::from_f64(1.0));

    let bridge = Object::new();
    set_prop(&bridge, "__rue_host_node", host.into());
    bridge.into()
}

fn raw_node(tag: &str) -> JsValue {
    let node = Object::new();
    set_prop(&node, "tag", JsValue::from_str(tag));
    set_prop(&node, "tagName", JsValue::from_str(&tag.to_ascii_uppercase()));
    set_prop(&node, "children", Array::new().into());
    set_prop(&node, "nodeType", JsValue::from_f64(1.0));
    node.into()
}

fn set_js_children(parent: &JsValue, children: &[JsValue]) {
    let arr = Array::new();
    for child in children {
        arr.push(child);
        let _ = Reflect::set(child, &JsValue::from_str("parentNode"), parent);
    }
    let _ = Reflect::set(parent, &JsValue::from_str("children"), &arr.into());
    update_siblings(parent);
}

fn host_bridge_from_node(host: &JsValue) -> JsValue {
    let bridge = Object::new();
    set_prop(&bridge, "__rue_host_node", host.clone());
    bridge.into()
}

fn test_text_input(text: &str) -> MountInput<TestAdapter> {
    MountInput {
        r#type: MountInputType::Text(text.to_string()),
        props: ComponentProps::new(),
        children: Vec::new(),
        key: None,
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: None,
    }
}

fn test_vapor_input(
    host: <TestAdapter as DomAdapter>::Element,
    key: Option<&str>,
) -> MountInput<TestAdapter> {
    MountInput {
        r#type: MountInputType::Vapor,
        props: ComponentProps::new(),
        children: Vec::new(),
        key: key.map(str::to_string),
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: Some(host),
    }
}

fn test_fragment_input(children: Vec<MountInputChild<TestAdapter>>) -> MountInput<TestAdapter> {
    MountInput {
        r#type: MountInputType::Fragment,
        props: ComponentProps::new(),
        children,
        key: None,
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: None,
    }
}

async fn timeout_tick() {
    let promise_factory =
        Function::new_no_args("return new Promise(resolve => setTimeout(resolve, 0))");
    let promise: Promise = promise_factory.call0(&JsValue::NULL).unwrap().unchecked_into();
    let _ = JsFuture::from(promise).await;
}

#[wasm_bindgen_test(async)]
async fn plan999_public_range_ops_no_adapter_fallback_paths() {
    let rue = createRue(JsValue::UNDEFINED);
    let parent = raw_node("no-adapter-parent");
    let outer_start = raw_node("outer-start");
    let stale_anchor = raw_node("stale-anchor");
    let wrapper = raw_node("wrapper");
    let outer_end = raw_node("outer-end");
    set_js_children(
        &parent,
        &[outer_start.clone(), stale_anchor.clone(), wrapper.clone(), outer_end.clone()],
    );

    let stale_host = raw_node("stale-host");
    rue.render_between_wasm(
        host_bridge_from_node(&stale_host),
        parent.clone(),
        stale_anchor.clone(),
        outer_end.clone(),
    );
    tick().await;

    let nested_start = raw_node("nested-start");
    let nested_end = raw_node("nested-end");
    set_js_children(&wrapper, &[nested_start.clone(), nested_end.clone()]);
    set_prop(
        &Object::from(wrapper.clone()),
        "contains",
        Function::new_with_args("node", "return node === this || node === this.children[0]").into(),
    );

    let nested_host = raw_node("nested-host");
    rue.render_between_wasm(
        host_bridge_from_node(&nested_host),
        wrapper.clone(),
        nested_start.clone(),
        nested_end.clone(),
    );
    tick().await;

    rue.render_between_wasm(JsValue::NULL, parent.clone(), outer_start.clone(), outer_end.clone());
    tick().await;

    let replacement = raw_node("replacement");
    rue.render_between_wasm(host_bridge_from_node(&replacement), parent, outer_start, outer_end);
    tick().await;

    let empty_hit_parent = raw_node("empty-hit-parent");
    let empty_hit_start = raw_node("empty-hit-start");
    let empty_hit_end = raw_node("empty-hit-end");
    set_js_children(&empty_hit_parent, &[empty_hit_start.clone(), empty_hit_end.clone()]);

    let first = raw_node("empty-hit-first");
    rue.render_between_wasm(
        host_bridge_from_node(&first),
        empty_hit_parent.clone(),
        empty_hit_start.clone(),
        empty_hit_end.clone(),
    );
    tick().await;

    rue.render_between_wasm(
        JsValue::NULL,
        empty_hit_parent.clone(),
        empty_hit_start.clone(),
        empty_hit_end.clone(),
    );
    tick().await;

    let second = raw_node("empty-hit-second");
    rue.render_between_wasm(
        host_bridge_from_node(&second),
        empty_hit_parent,
        empty_hit_start,
        empty_hit_end,
    );
    tick().await;

    let orphan_parent = raw_node("orphan-parent");
    let orphan_start = raw_node("orphan-start");
    let orphan_end = raw_node("orphan-end");
    set_js_children(&orphan_parent, &[orphan_start.clone()]);
    let orphan_host = raw_node("orphan-host");
    rue.render_between_wasm(
        host_bridge_from_node(&orphan_host),
        orphan_parent,
        orphan_start,
        orphan_end,
    );
    tick().await;
}

#[wasm_bindgen_test(async)]
async fn plan999_public_range_ops_adapter_detached_and_drain_paths() {
    let adapter = make_vapor_only_adapter();
    let rue = createRue(adapter.clone());

    let parent = raw_node("adapter-parent");
    let start = raw_node("adapter-start");
    let stale = raw_node("adapter-stale");
    let end = raw_node("adapter-end");
    set_js_children(&parent, &[start.clone(), end.clone()]);
    let _ = Reflect::set(&start, &JsValue::from_str("nextSibling"), &stale);
    let _ = Reflect::set(&stale, &JsValue::from_str("nextSibling"), &end);

    rue.render_between_wasm(JsValue::NULL, parent.clone(), start.clone(), end.clone());
    tick().await;

    let detached_parent = raw_node("detached-parent");
    let detached_start = raw_node("detached-start");
    let detached_end = raw_node("detached-end");
    set_js_children(&detached_parent, &[detached_start.clone()]);
    let detached_host = raw_node("detached-host");
    rue.render_between_wasm(
        host_bridge_from_node(&detached_host),
        detached_parent.clone(),
        detached_start,
        detached_end,
    );
    tick().await;
    assert_eq!(child_sequence(&detached_parent), vec!["detached-start", "detached-host"]);

    let drain_parent = raw_node("drain-parent");
    let outer_start = raw_node("drain-outer-start");
    let range_start = raw_node("drain-range-start");
    let outer_end = raw_node("drain-outer-end");
    set_js_children(&drain_parent, &[outer_start.clone(), range_start.clone(), outer_end.clone()]);

    let range_host = raw_node("drain-host");
    rue.render_between_wasm(
        host_bridge_from_node(&range_host),
        drain_parent.clone(),
        range_start.clone(),
        outer_end.clone(),
    );
    tick().await;
    update_siblings(&drain_parent);

    rue.render_between_wasm(JsValue::NULL, drain_parent.clone(), outer_start, outer_end);
    tick().await;
    assert_eq!(child_sequence(&drain_parent), vec!["drain-outer-start", "drain-outer-end"]);
}

#[wasm_bindgen_test(async)]
async fn plan999_static_range_and_current_container_public_paths() {
    let adapter = make_vapor_only_adapter();
    let rue = Rc::new(createRue(adapter.clone()));

    assert!(rue.get_current_container_wasm().is_undefined());

    let container = setup_container(&adapter);
    let captured = Array::new();
    let captured_for_component = captured.clone();
    let rue_for_component = rue.clone();
    let component = wasm_bindgen::closure::Closure::wrap(Box::new(move |_props: JsValue| {
        captured_for_component.push(&rue_for_component.get_current_container_wasm());
        host_bridge("container-probe")
    })
        as Box<dyn FnMut(JsValue) -> JsValue>);
    let component_fn: Function = component.as_ref().clone().unchecked_into();
    let vnode = rue.create_component_wasm(component_fn.into(), JsValue::UNDEFINED);
    rue.render_wasm(vnode, container.clone());
    tick().await;
    assert_eq!(child_sequence(&container), vec!["container-probe"]);
    assert!(Object::is(&rue.get_current_container_wasm(), &container));
    assert!(captured.length() >= 1);
    component.forget();

    let (static_parent, static_anchor) = setup_anchor(&adapter);
    let frag_nodes_ref = Array::new();
    set_prop(
        &Object::from(static_parent.clone()),
        "__rue_frag_nodes_ref",
        frag_nodes_ref.clone().into(),
    );
    let static_handle = rue.vapor_wasm(
        Function::new_no_args(
            "const a = { tag: 'static-a', tagName: 'STATIC-A', children: [], nodeType: 1 }; \
             const b = { tag: 'static-b', tagName: 'STATIC-B', children: [], nodeType: 1 }; \
             return { tag: 'fragment', tagName: 'FRAGMENT', children: [a, b], nodeType: 11 };",
        )
        .into(),
    );
    rue.render_static_wasm(static_handle, static_parent.clone(), static_anchor);
    tick().await;
    update_siblings(&static_parent);
    assert_eq!(child_sequence(&static_parent), vec!["static-a", "static-b"]);

    let (range_parent, start, end) = setup_range(&adapter);
    let range_handle = rue.vapor_wasm(
        Function::new_no_args("return { tag: 'range-child', children: [], nodeType: 1 }").into(),
    );
    rue.render_between_wasm(range_handle, range_parent.clone(), start.clone(), end.clone());
    tick().await;
    assert_eq!(child_sequence(&range_parent), vec!["comment_start", "range-child", "comment_end"]);

    let unsupported_array = Array::new();
    unsupported_array.push(&JsValue::from_str("unsupported"));
    rue.render_between_wasm(unsupported_array.into(), range_parent.clone(), start, end);
    tick().await;
    update_siblings(&range_parent);
    assert_eq!(child_sequence(&range_parent), vec!["comment_start", "comment_end"]);
}

#[wasm_bindgen_test]
fn plan999_use_state_ref_equals_and_reactive_wrapped_object_setter_paths() {
    set_reactive_scheduling("sync");
    set_current_instance(Object::new().into());

    let ref_opts = Object::new();
    set_prop(&ref_opts, "kind", JsValue::from_str("ref"));
    set_prop(
        &ref_opts,
        "equals",
        Function::new_with_args("prev,next", "return prev === next").into(),
    );
    force_slot(0);
    let ref_state = Array::from(&use_state(JsValue::from_f64(1.0), Some(ref_opts.into())));
    let ref_proxy = ref_state.get(0);
    let ref_setter: Function = ref_state.get(1).unchecked_into();
    let ret_object = wasm_bindgen::closure::Closure::wrap(Box::new(move |_state: JsValue| {
        let out = Object::new();
        set_prop(&out, "value", JsValue::from_f64(4.0));
        out.into()
    })
        as Box<dyn FnMut(JsValue) -> JsValue>);
    let _ = ref_setter.call1(&JsValue::NULL, ret_object.as_ref().unchecked_ref());
    assert!(Reflect::get(&ref_proxy, &JsValue::from_str("value")).unwrap().is_object());

    force_slot(1);
    let reactive_state = Array::from(&use_state(JsValue::from_f64(2.0), None));
    let reactive_proxy = reactive_state.get(0);
    let reactive_setter: Function = reactive_state.get(1).unchecked_into();
    let wrapped_ret = wasm_bindgen::closure::Closure::wrap(Box::new(move |_state: JsValue| {
        let out = Object::new();
        set_prop(&out, "value", JsValue::from_f64(9.0));
        out.into()
    })
        as Box<dyn FnMut(JsValue) -> JsValue>);
    let _ = reactive_setter.call1(&JsValue::NULL, wrapped_ret.as_ref().unchecked_ref());
    assert_eq!(
        Reflect::get(&reactive_proxy, &JsValue::from_str("value")).unwrap().as_f64(),
        Some(9.0)
    );

    ret_object.forget();
    wrapped_ret.forget();
}

#[wasm_bindgen_test(async)]
async fn plan999_watch_debounce_and_props_reactive_renderable_paths() {
    set_reactive_scheduling("sync");
    set_current_instance(Object::new().into());

    let hits = Array::new();
    let hits_for_effect = hits.clone();
    let effect = wasm_bindgen::closure::Closure::wrap(Box::new(move || {
        hits_for_effect.push(&JsValue::from_str("effect"));
    }) as Box<dyn FnMut()>);
    let opts = Object::new();
    set_prop(&opts, "debounce", JsValue::from_f64(0.0));
    let _handle = watch_effect(effect.as_ref().clone().unchecked_into(), Some(opts.into()));
    timeout_tick().await;
    assert!(hits.length() >= 1);
    effect.forget();

    let root = Object::new();
    let nested = Object::new();
    set_prop(&nested, "name", JsValue::from_str("A"));
    set_prop(&root, "user", nested.into());
    let sig = rue_runtime_vapor::create_signal(root.into(), None);
    let path_hits = Array::new();
    let path_hits_for_handler = path_hits.clone();
    let handler =
        wasm_bindgen::closure::Closure::wrap(Box::new(move |next: JsValue, old: JsValue| {
            path_hits_for_handler.push(&next);
            path_hits_for_handler.push(&old);
        }) as Box<dyn FnMut(JsValue, JsValue)>);
    let path_opts = Object::new();
    set_prop(&path_opts, "debounce", JsValue::from_f64(0.0));
    let _path_handle = watch_path(
        &sig,
        JsValue::from_str("user.name"),
        handler.as_ref().clone().unchecked_into(),
        Some(path_opts.into()),
    );
    sig.set_path_js(JsValue::from_str("user.name"), JsValue::from_str("B"));
    timeout_tick().await;
    assert!(path_hits.length() >= 2);
    handler.forget();

    let host = Object::new();
    set_prop(&host, "nodeType", JsValue::from_f64(1.0));
    let props_a = Object::new();
    let nodes_a = Array::new();
    nodes_a.push(&host.clone().into());
    set_prop(&props_a, "children", nodes_a.into());
    let proxy = props_reactive_js(props_a.into(), Some(true));
    let props_b = Object::new();
    let nodes_b = Array::new();
    nodes_b.push(&host.into());
    set_prop(&props_b, "children", nodes_b.into());
    let sig_value = Reflect::get(&proxy, &JsValue::from_str("__signal__")).unwrap();
    let set_fn: Function =
        Reflect::get(&sig_value, &JsValue::from_str("set")).unwrap().unchecked_into();
    let _ = set_fn.call1(&sig_value, &props_b.into());
    let children = Reflect::get(&proxy, &JsValue::from_str("children")).unwrap();
    assert!(Array::is_array(&children));
}

#[wasm_bindgen_test(async)]
async fn plan999_render_patch_text_empty_and_missing_host_public_path() {
    let adapter = make_vapor_only_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let first = rue.create_element_wasm(
        JsValue::from_str("div"),
        JsValue::UNDEFINED,
        JsValue::from_str("text"),
    );
    rue.render_wasm(first, container.clone());
    tick().await;

    let second =
        rue.create_element_wasm(JsValue::from_str("div"), JsValue::UNDEFINED, JsValue::TRUE);
    rue.render_wasm(second, container.clone());
    tick().await;

    assert_eq!(child_sequence(&container), vec!["div"]);
}

#[wasm_bindgen_test]
fn plan999_public_rue_mount_and_patch_text_paths() {
    let mut rue = Rue::<TestAdapter>::new();
    assert_eq!(rue.container_mount_count(), 0);
    assert_eq!(rue.anchor_mount_count(), 0);
    assert_eq!(rue.range_mount_count(), 0);

    rue.set_dom_adapter(TestAdapter::default());
    let mut container = rue.get_dom_adapter_mut().unwrap().create_element("root");
    rue.mount(
        |_props| MountInput {
            r#type: MountInputType::Text("initial".to_string()),
            props: ComponentProps::new(),
            children: Vec::new(),
            key: Some("text-key".to_string()),
            strict_component_returns: false,
            mount_cleanup_bucket: None,
            mount_effect_scope_id: None,
            el_hint: None,
        },
        &mut container,
    );
    assert_eq!(rue.container_mount_count(), 1);

    let input = MountInput {
        r#type: MountInputType::Text("patched".to_string()),
        props: ComponentProps::new(),
        children: Vec::new(),
        key: Some("text-key".to_string()),
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: None,
    };
    rue.render_input(input, &mut container);

    let root = rue.get_dom_adapter().unwrap().nodes.get(&container.id).unwrap();
    assert_eq!(root.children.len(), 1);
    assert_eq!(root.children[0].tag, "#text");
    assert_eq!(root.children[0].text, "patched");
}

#[wasm_bindgen_test]
fn plan999_public_static_vapor_fragment_and_container_replace_paths() {
    let mut rue = Rue::<TestAdapter>::new();
    rue.set_dom_adapter(TestAdapter::default());

    let mut container = rue.get_dom_adapter_mut().unwrap().create_element("root");
    let initial = MountInput {
        r#type: MountInputType::Text("before".to_string()),
        props: ComponentProps::new(),
        children: Vec::new(),
        key: Some("block".to_string()),
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: None,
    };
    rue.render_input(initial, &mut container);

    let host = rue.get_dom_adapter_mut().unwrap().create_element("section");
    let replacement = MountInput {
        r#type: MountInputType::Vapor,
        props: ComponentProps::new(),
        children: Vec::new(),
        key: Some("vapor".to_string()),
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: Some(host.clone()),
    };
    rue.render_input(replacement, &mut container);

    let root = rue.get_dom_adapter().unwrap().nodes.get(&container.id).unwrap();
    assert_eq!(root.children.len(), 1);
    assert_eq!(root.children[0].tag, "section");

    let mut parent = rue.get_dom_adapter_mut().unwrap().create_element("static-parent");
    let anchor = rue.get_dom_adapter_mut().unwrap().create_element("anchor");
    rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &anchor);

    let mut fragment = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
    let child_a = rue.get_dom_adapter_mut().unwrap().create_element("static-a");
    let child_b = rue.get_dom_adapter_mut().unwrap().create_element("static-b");
    rue.get_dom_adapter_mut().unwrap().append_child(&mut fragment, &child_a);
    rue.get_dom_adapter_mut().unwrap().append_child(&mut fragment, &child_b);

    let static_input = MountInput {
        r#type: MountInputType::Vapor,
        props: ComponentProps::new(),
        children: Vec::new(),
        key: None,
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: Some(fragment),
    };
    rue.render_static_input(static_input, &mut parent, anchor);

    let parent_node = rue.get_dom_adapter().unwrap().nodes.get(&parent.id).unwrap();
    let tags: Vec<String> = parent_node.children.iter().map(|child| child.tag.clone()).collect();
    assert_eq!(tags, vec!["static-a", "static-b"]);
}

#[wasm_bindgen_test]
fn plan999_computed_slot_refresh_non_callable_getter_and_setter_paths() {
    set_reactive_scheduling("sync");
    let instance = Object::new();
    set_current_instance(instance.clone().into());

    let first_options = Object::new();
    set_prop(&first_options, "get", Function::new_no_args("return 'first'").into());
    set_prop(
        &first_options,
        "set",
        Function::new_with_args("value", "globalThis.__plan999_computed_written = value").into(),
    );
    force_slot(0);
    let computed = computed_js(first_options.into(), None);
    assert_eq!(computed.get_js().as_string().as_deref(), Some("first"));
    computed.set_js(JsValue::from_str("written"));
    assert_eq!(
        Reflect::get(&js_sys::global(), &JsValue::from_str("__plan999_computed_written"))
            .unwrap()
            .as_string()
            .as_deref(),
        Some("written")
    );

    let second_options = Object::new();
    set_prop(&second_options, "get", JsValue::from_str("not-callable"));
    force_slot(0);
    let refreshed = computed_js(second_options.into(), None);
    assert!(refreshed.get_js().is_undefined());
    refreshed.set_js(JsValue::from_str("ignored"));
    assert_eq!(
        Reflect::get(&js_sys::global(), &JsValue::from_str("__plan999_computed_written"))
            .unwrap()
            .as_string()
            .as_deref(),
        Some("written")
    );

    set_current_instance(JsValue::UNDEFINED);
}

#[wasm_bindgen_test(async)]
async fn plan999_mount_throwing_app_falls_back_to_empty_fragment_again() {
    let adapter = make_vapor_only_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let app = Function::new_no_args("throw new Error('plan999 mount fallback')");
    rue.mount_wasm(app.into(), container.clone());
    tick().await;

    assert!(child_sequence(&container).is_empty());
    assert!(Object::is(&rue.get_current_container_wasm(), &container));
}

#[wasm_bindgen_test(async)]
async fn plan999_compat_vnode_empty_children_without_props_children_uses_empty_array() {
    let adapter = make_wasm_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let vnode = rue.create_element_wasm(
        JsValue::from_str("empty-children"),
        Object::new().into(),
        Array::new().into(),
    );

    rue.render_wasm(vnode, container.clone());
    tick().await;

    assert_eq!(child_sequence(&container), vec!["empty-children"]);
}

#[wasm_bindgen_test]
fn plan999_public_anchor_and_range_clear_reuse_empty_entries() {
    let mut rue = Rue::<TestAdapter>::new();
    rue.set_dom_adapter(TestAdapter::default());

    let mut anchor_parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
    let anchor = rue.get_dom_adapter_mut().unwrap().create_element("comment_anchor");
    rue.get_dom_adapter_mut().unwrap().append_child(&mut anchor_parent, &anchor);

    rue.render_anchor_input(test_text_input("anchor-before"), &mut anchor_parent, anchor.clone());
    assert_eq!(rue.anchor_mount_count(), 1);
    rue.clear_anchor(&mut anchor_parent, anchor.clone());
    rue.render_anchor_input(test_text_input("anchor-after"), &mut anchor_parent, anchor.clone());

    let anchor_children = rue.get_dom_adapter().unwrap().collect_fragment_children(&anchor_parent);
    assert!(
        !anchor_children.iter().any(|node| node.tag == "#text" && node.text == "anchor-before")
    );
    assert!(anchor_children.iter().any(|node| node.tag == "#text" && node.text == "anchor-after"));
    assert!(anchor_children.iter().any(|node| node.id == anchor.id));

    let mut range_parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
    let start = rue.get_dom_adapter_mut().unwrap().create_element("comment_start");
    let end = rue.get_dom_adapter_mut().unwrap().create_element("comment_end");
    rue.get_dom_adapter_mut().unwrap().append_child(&mut range_parent, &start);
    rue.get_dom_adapter_mut().unwrap().append_child(&mut range_parent, &end);

    rue.render_between_input(
        test_text_input("range-before"),
        &mut range_parent,
        start.clone(),
        end.clone(),
    );
    assert_eq!(rue.range_mount_count(), 1);
    rue.clear_range(&mut range_parent, start.clone(), end.clone());
    rue.render_between_input(
        test_text_input("range-after"),
        &mut range_parent,
        start.clone(),
        end.clone(),
    );

    let range_children = rue.get_dom_adapter().unwrap().collect_fragment_children(&range_parent);
    assert!(!range_children.iter().any(|node| node.tag == "#text" && node.text == "range-before"));
    assert!(range_children.iter().any(|node| node.tag == "#text" && node.text == "range-after"));
    assert!(range_children.iter().any(|node| node.id == start.id));
    assert!(range_children.iter().any(|node| node.id == end.id));
}

#[wasm_bindgen_test]
fn plan999_public_range_block_hit_and_static_unmountable_paths() {
    let mut rue = Rue::<TestAdapter>::new();
    rue.set_dom_adapter(TestAdapter::default());

    let mut range_parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
    let start = rue.get_dom_adapter_mut().unwrap().create_element("comment_start");
    let end = rue.get_dom_adapter_mut().unwrap().create_element("comment_end");
    rue.get_dom_adapter_mut().unwrap().append_child(&mut range_parent, &start);
    rue.get_dom_adapter_mut().unwrap().append_child(&mut range_parent, &end);

    let first_host = rue.get_dom_adapter_mut().unwrap().create_element("range-first");
    rue.render_between_input(
        test_vapor_input(first_host, Some("same")),
        &mut range_parent,
        start.clone(),
        end.clone(),
    );
    let second_host = rue.get_dom_adapter_mut().unwrap().create_element("range-second");
    rue.render_between_input(
        test_vapor_input(second_host, Some("same")),
        &mut range_parent,
        start.clone(),
        end.clone(),
    );

    let range_children = rue.get_dom_adapter().unwrap().collect_fragment_children(&range_parent);
    assert!(range_children.iter().any(|node| node.tag == "range-second"));

    let mut static_parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
    let anchor = rue.get_dom_adapter_mut().unwrap().create_element("comment_static");
    rue.get_dom_adapter_mut().unwrap().append_child(&mut static_parent, &anchor);
    let input = MountInput {
        r#type: MountInputType::_Phantom(std::marker::PhantomData),
        props: ComponentProps::new(),
        children: Vec::new(),
        key: None,
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: None,
    };

    rue.render_static_input(input, &mut static_parent, anchor.clone());

    let static_children = rue.get_dom_adapter().unwrap().collect_fragment_children(&static_parent);
    assert!(!static_children.iter().any(|node| node.id == anchor.id));
}

#[wasm_bindgen_test]
fn plan999_public_vapor_with_setup_el_hint_and_compat_fragment_paths() {
    let mut rue = Rue::<TestAdapter>::new();
    rue.set_dom_adapter(TestAdapter::default());

    let mut container = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
    let mut fragment = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
    let child_a = rue.get_dom_adapter_mut().unwrap().create_element("hint-a");
    let child_b = rue.get_dom_adapter_mut().unwrap().create_element("hint-b");
    rue.get_dom_adapter_mut().unwrap().append_child(&mut fragment, &child_a);
    rue.get_dom_adapter_mut().unwrap().append_child(&mut fragment, &child_b);

    let setup =
        Function::new_no_args("throw new Error('setup should not run when el_hint exists')");
    let hinted = MountInput {
        r#type: MountInputType::VaporWithSetup(setup.into()),
        props: ComponentProps::new(),
        children: Vec::new(),
        key: Some("hinted".to_string()),
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: Some(77),
        el_hint: Some(fragment),
    };
    rue.render_input(hinted, &mut container);
    let container_children = rue.get_dom_adapter().unwrap().collect_fragment_children(&container);
    assert!(container_children.iter().any(|node| node.tag == "hint-a"));
    assert!(container_children.iter().any(|node| node.tag == "hint-b"));

    let mut static_parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
    let anchor = rue.get_dom_adapter_mut().unwrap().create_element("comment_fragment");
    rue.get_dom_adapter_mut().unwrap().append_child(&mut static_parent, &anchor);
    let compat_fragment = test_fragment_input(vec![
        MountInputChild::Text("frag-text".to_string()),
        MountInputChild::Input(MountInput {
            r#type: MountInputType::Element("frag-child".to_string()),
            props: ComponentProps::new(),
            children: vec![MountInputChild::Text("nested".to_string())],
            key: None,
            strict_component_returns: false,
            mount_cleanup_bucket: None,
            mount_effect_scope_id: None,
            el_hint: None,
        }),
    ]);
    rue.render_static_input(compat_fragment, &mut static_parent, anchor.clone());

    let static_children = rue.get_dom_adapter().unwrap().collect_fragment_children(&static_parent);
    assert!(static_children.iter().any(|node| node.tag == "#text" && node.text == "frag-text"));
    assert!(static_children.iter().any(|node| node.tag == "frag-child"));
    assert!(!static_children.iter().any(|node| node.id == anchor.id));
}

#[wasm_bindgen_test]
fn plan999_public_element_fragment_and_vapor_setup_fallback_mount_inputs() {
    let mut rue = Rue::<TestAdapter>::new();
    rue.set_dom_adapter(TestAdapter::default());

    let mut container = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
    let nested = MountInput {
        r#type: MountInputType::Element("nested-child".to_string()),
        props: ComponentProps::new(),
        children: vec![MountInputChild::Text("nested-text".to_string())],
        key: Some("nested".to_string()),
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: None,
    };
    let element = MountInput {
        r#type: MountInputType::Element("compat-root".to_string()),
        props: ComponentProps::new(),
        children: vec![
            MountInputChild::Text("leading".to_string()),
            MountInputChild::Input(nested),
        ],
        key: Some("element-root".to_string()),
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: None,
    };
    rue.render_input(element, &mut container);

    let element_children = rue.get_dom_adapter().unwrap().collect_fragment_children(&container);
    assert!(element_children.iter().any(|node| node.tag == "compat-root"));

    let fragment = test_fragment_input(vec![
        MountInputChild::Text("fragment-leading".to_string()),
        MountInputChild::Input(MountInput {
            r#type: MountInputType::Element("fragment-child".to_string()),
            props: ComponentProps::new(),
            children: Vec::new(),
            key: None,
            strict_component_returns: false,
            mount_cleanup_bucket: None,
            mount_effect_scope_id: None,
            el_hint: None,
        }),
    ]);
    rue.render_input(fragment, &mut container);

    let fragment_children = rue.get_dom_adapter().unwrap().collect_fragment_children(&container);
    assert!(fragment_children.iter().any(|node| node.tag == "#text"));
    assert!(fragment_children.iter().any(|node| node.tag == "fragment-child"));

    let fallback_setup = MountInput {
        r#type: MountInputType::VaporWithSetup(JsValue::from_str("not-a-function")),
        props: ComponentProps::new(),
        children: Vec::new(),
        key: Some("fallback-setup".to_string()),
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: Some(123),
        el_hint: None,
    };
    rue.render_input(fallback_setup, &mut container);

    let fallback_children = rue.get_dom_adapter().unwrap().collect_fragment_children(&container);
    assert!(fallback_children.iter().any(|node| node.tag == "div"));
}
