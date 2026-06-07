use js_sys::{Array, Function, Object, Reflect};
use rue_runtime_vapor::{ComponentProps, JsDomAdapter, MountInput, MountInputType, Rue, createRue};
use std::rc::Rc;
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use wasm_bindgen_test::*;

mod common;

use common::{child_sequence, make_vapor_only_adapter, make_wasm_adapter, setup_container, tick};

fn set_prop(target: &Object, key: &str, value: JsValue) {
    Reflect::set(target, &JsValue::from_str(key), &value).unwrap();
}

fn host_node(tag: &str) -> Object {
    let host = Object::new();
    set_prop(&host, "tag", JsValue::from_str(tag));
    set_prop(&host, "children", Array::new().into());
    set_prop(&host, "nodeType", JsValue::from_f64(1.0));
    host
}

fn host_bridge(host: &Object) -> Object {
    let bridge = Object::new();
    set_prop(&bridge, "__rue_host_node", host.clone().into());
    bridge
}

fn text_input(text: &str) -> MountInput<JsDomAdapter> {
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

#[wasm_bindgen_test(async)]
async fn vapor_setup_legacy_wrapper_is_rejected_without_mounting() {
    let adapter = make_vapor_only_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let errors = Array::new();
    let errors_for_handler = errors.clone();
    let on_error = wasm_bindgen::closure::Closure::wrap(Box::new(move |err: JsValue| {
        errors_for_handler.push(&err);
    }) as Box<dyn FnMut(JsValue)>);
    rue.on_error(on_error.as_ref().clone().into());
    on_error.forget();

    let legacy = rue.vapor_wasm(
        Function::new_no_args(
            "return { vaporElement: { tag: 'legacy-node', children: [], nodeType: 1 } }",
        )
        .into(),
    );
    rue.render_wasm(legacy, container.clone());
    tick().await;

    assert_eq!(errors.length(), 1);
    assert!(child_sequence(&container).is_empty());

    let missing_metadata =
        rue.vapor_wasm(Function::new_no_args("return { tag: 'plain-object' }").into());
    rue.render_wasm(missing_metadata, container.clone());
    tick().await;

    let primitive_adapter = make_wasm_adapter();
    let primitive_rue = createRue(primitive_adapter.clone());
    let primitive_container = setup_container(&primitive_adapter);
    let primitive = primitive_rue.vapor_wasm(Function::new_no_args("return 7").into());
    primitive_rue.render_wasm(primitive, primitive_container);
    tick().await;
}

#[wasm_bindgen_test(async)]
async fn use_plugin_bridge_defers_install_and_normalizes_options() {
    let adapter = make_vapor_only_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let calls = Array::new();
    Reflect::set(&js_sys::global(), &JsValue::from_str("__plugin_calls"), &calls).unwrap();

    let plugin = Object::new();
    let install = Function::new_with_args(
        "app,opts",
        "globalThis.__plugin_calls.push({ self: this, app, len: opts.length, first: opts[0] })",
    );
    set_prop(&plugin, "install", install.into());

    let options = Array::new();
    options.push(&JsValue::from_str("alpha"));
    options.push(&JsValue::from_str("beta"));
    rue.use_plugin_wasm(plugin.clone().into(), options.into());
    rue.use_plugin_wasm(plugin.clone().into(), JsValue::from_str("not-array"));

    let handle = rue.vapor_wasm(
        Function::new_no_args("return { tag: 'plugin-target', children: [], nodeType: 1 }").into(),
    );
    rue.render_wasm(handle, container.clone());
    tick().await;

    let recorded: Array = Reflect::get(&js_sys::global(), &JsValue::from_str("__plugin_calls"))
        .unwrap()
        .unchecked_into();
    assert_eq!(recorded.length(), 2);
    assert!(Object::is(
        &Reflect::get(&recorded.get(0), &JsValue::from_str("self")).unwrap(),
        &plugin.into(),
    ));
    assert_eq!(
        Reflect::get(&recorded.get(0), &JsValue::from_str("len")).unwrap().as_f64(),
        Some(2.0),
    );
    assert_eq!(
        Reflect::get(&recorded.get(0), &JsValue::from_str("first")).unwrap().as_string().as_deref(),
        Some("alpha"),
    );
    assert_eq!(
        Reflect::get(&recorded.get(1), &JsValue::from_str("len")).unwrap().as_f64(),
        Some(0.0),
    );
    assert_eq!(child_sequence(&container), vec!["plugin-target"]);
}

#[wasm_bindgen_test(async)]
async fn mount_flushes_deferred_plugin_queue_before_app_render() {
    let adapter = make_vapor_only_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let calls = Array::new();
    Reflect::set(&js_sys::global(), &JsValue::from_str("__mount_plugin_calls"), &calls).unwrap();

    let plugin = Object::new();
    set_prop(
        &plugin,
        "install",
        Function::new_no_args("globalThis.__mount_plugin_calls.push('installed')").into(),
    );
    rue.use_plugin_wasm(plugin.into(), Array::new().into());

    let app = Function::new_no_args(
        "globalThis.__mount_plugin_calls.push('app'); \
         return { __rue_host_node: { tag: 'mounted-app', children: [], nodeType: 1 } };",
    );
    rue.mount_wasm(app.into(), container.clone());
    tick().await;

    let recorded: Array =
        Reflect::get(&js_sys::global(), &JsValue::from_str("__mount_plugin_calls"))
            .unwrap()
            .unchecked_into();
    assert_eq!(recorded.length(), 2);
    assert_eq!(recorded.get(0).as_string().as_deref(), Some("installed"));
    assert_eq!(recorded.get(1).as_string().as_deref(), Some("app"));
    assert_eq!(child_sequence(&container), vec!["mounted-app"]);
}

#[wasm_bindgen_test(async)]
async fn mount_throwing_app_falls_back_to_empty_fragment() {
    let adapter = make_vapor_only_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let existing = host_node("before-throw");
    rue.render_wasm(host_bridge(&existing).into(), container.clone());
    tick().await;
    assert_eq!(child_sequence(&container), vec!["before-throw"]);

    let app = Function::new_no_args("throw new Error('mount boom')");
    rue.mount_wasm(app.into(), container.clone());
    tick().await;

    assert_eq!(child_sequence(&container), Vec::<String>::new());
}

#[wasm_bindgen_test(async)]
async fn mount_throwing_app_without_existing_mount_still_schedules_empty_fragment() {
    let adapter = make_vapor_only_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let app = Function::new_no_args("throw new Error('mount first boom')");
    rue.mount_wasm(app.into(), container.clone());
    tick().await;

    assert_eq!(child_sequence(&container), Vec::<String>::new());
}

#[wasm_bindgen_test(async)]
async fn mount_non_function_app_falls_back_to_empty_fragment() {
    let adapter = make_vapor_only_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let existing = host_node("before-non-function");
    rue.render_wasm(host_bridge(&existing).into(), container.clone());
    tick().await;
    assert_eq!(child_sequence(&container), vec!["before-non-function"]);

    rue.mount_wasm(JsValue::NULL, container.clone());
    tick().await;

    assert_eq!(child_sequence(&container), Vec::<String>::new());
}

#[wasm_bindgen_test(async)]
async fn render_wasm_probes_raw_array_root_and_direct_function_component_input() {
    let adapter = make_wasm_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let raw_children = Array::new();
    raw_children.push(&JsValue::from_str("array-child"));
    Reflect::set(&raw_children, &JsValue::from_str("__rue_key"), &JsValue::from_str("array-root"))
        .unwrap();
    rue.render_wasm(raw_children.into(), container.clone());
    tick().await;
    assert_eq!(child_sequence(&container), Vec::<String>::new());

    let component = Function::new_no_args(
        "return { type: 'span', props: { key: 'function-component-root' }, children: ['fn-child'] }",
    );
    rue.render_wasm(component.into(), container.clone());
    tick().await;

    assert_eq!(child_sequence(&container), Vec::<String>::new());
}

#[wasm_bindgen_test(async)]
async fn on_before_create_bridge_registers_pending_hook_and_triggers_component_hook() {
    let adapter = make_vapor_only_adapter();
    let rue = Rc::new(createRue(adapter.clone()));
    let container = setup_container(&adapter);

    let direct_hook = Function::new_no_args("globalThis.__direct_before_create = true");
    rue.on_before_create(direct_hook.into());

    let hits = Array::new();
    Reflect::set(&js_sys::global(), &JsValue::from_str("__before_create_hits"), &hits).unwrap();

    let rue_for_render = rue.clone();
    let component = wasm_bindgen::closure::Closure::wrap(Box::new(move |_props: JsValue| {
        let hook =
            Function::new_no_args("globalThis.__before_create_hits.push('pending-before-create')");
        rue_for_render.on_before_create(hook.into());

        let host = Object::new();
        set_prop(&host, "tag", JsValue::from_str("before-create-host"));
        set_prop(&host, "children", Array::new().into());
        set_prop(&host, "nodeType", JsValue::from_f64(1.0));
        let bridge = Object::new();
        set_prop(&bridge, "__rue_host_node", host.into());
        bridge.into()
    })
        as Box<dyn FnMut(JsValue) -> JsValue>);

    let handle = rue.create_component_wasm(
        component.as_ref().clone().unchecked_into::<Function>().into(),
        JsValue::UNDEFINED,
    );
    rue.render_wasm(handle, container.clone());
    tick().await;

    let recorded: Array =
        Reflect::get(&js_sys::global(), &JsValue::from_str("__before_create_hits"))
            .unwrap()
            .unchecked_into();
    assert_eq!(recorded.length(), 1);
    assert_eq!(recorded.get(0).as_string().as_deref(), Some("pending-before-create"));
    assert_eq!(child_sequence(&container), vec!["before-create-host"]);

    component.forget();
}

#[wasm_bindgen_test]
fn real_dom_text_mounts_text_nodes_with_js_adapter() {
    let adapter = make_vapor_only_adapter();
    let mut rue: Rue<JsDomAdapter> = Rue::new();
    rue.set_dom_adapter(JsDomAdapter::new(adapter.clone()));
    let container = setup_container(&adapter);
    let mut container_for_render = container.clone();

    rue.render_input(text_input("plain"), (&mut container_for_render).into());
    assert_eq!(child_sequence(&container), vec!["plain"]);

    rue.render_input(text_input(""), (&mut container_for_render).into());
    assert_eq!(child_sequence(&container), vec![""]);
}
