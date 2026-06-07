/*
Bridge 输入规范化测试

重点保护默认 MountInput handle、portable 对象和 compat 输入在转换后的语义一致性。
*/
use super::*;
use crate::runtime::core::Rue;
use crate::runtime::types::{MountInput, MountInputType};
use js_sys::{Array, Function, Object, Reflect};
use wasm_bindgen_test::*;

fn input_test_adapter() -> JsValue {
    let adapter = Object::new();
    Reflect::set(
        &adapter,
        &JsValue::from_str("createElement"),
        &Function::new_with_args("tag", "return { tag, children: [], nodeType: 1 }").into(),
    )
    .unwrap();
    Reflect::set(
        &adapter,
        &JsValue::from_str("createTextNode"),
        &Function::new_with_args("text", "return { tag: '#text', text, nodeType: 3 }").into(),
    )
    .unwrap();
    Reflect::set(
        &adapter,
        &JsValue::from_str("createDocumentFragment"),
        &Function::new_no_args("return { tag: 'fragment', children: [], nodeType: 11 }").into(),
    )
    .unwrap();
    Reflect::set(
        &adapter,
        &JsValue::from_str("isFragment"),
        &Function::new_with_args("el", "return !!el && el.tag === 'fragment'").into(),
    )
    .unwrap();
    Reflect::set(
        &adapter,
        &JsValue::from_str("collectFragmentChildren"),
        &Function::new_with_args("el", "return Array.from(el && el.children || [])").into(),
    )
    .unwrap();
    Reflect::set(
        &adapter,
        &JsValue::from_str("setTextContent"),
        &Function::new_with_args("el,text", "el.text = text").into(),
    )
    .unwrap();
    Reflect::set(
        &adapter,
        &JsValue::from_str("appendChild"),
        &Function::new_with_args("p,c", "p.children = p.children||[]; p.children.push(c)").into(),
    )
    .unwrap();
    Reflect::set(
        &adapter,
        &JsValue::from_str("insertBefore"),
        &Function::new_with_args(
            "p,c,b",
            "p.children = p.children||[]; const i = p.children.indexOf(b); \
             i >= 0 ? p.children.splice(i, 0, c) : p.children.push(c)",
        )
        .into(),
    )
    .unwrap();
    Reflect::set(
        &adapter,
        &JsValue::from_str("removeChild"),
        &Function::new_with_args("p,c", "p.children = (p.children||[]).filter(x => x !== c)")
            .into(),
    )
    .unwrap();
    Reflect::set(
        &adapter,
        &JsValue::from_str("contains"),
        &Function::new_with_args("p,c", "return p === c || (p.children||[]).includes(c)").into(),
    )
    .unwrap();
    for (name, body) in [
        ("setClassName", "el.class = v"),
        ("patchStyle", "return"),
        ("setInnerHTML", "el.children = []; el.text = html"),
        ("setValue", "el.value = v"),
        ("setChecked", "el.checked = !!b"),
        ("setDisabled", "el.disabled = !!b"),
        ("clearRef", "return"),
        ("applyRef", "return"),
        ("setAttribute", "el.attrs = el.attrs||{}; el.attrs[k] = v"),
        ("removeAttribute", "if (el.attrs) delete el.attrs[k]"),
        ("getTagName", "return el.tag || ''"),
        ("addEventListener", "return"),
        ("removeEventListener", "return"),
        ("hasValueProperty", "return 'value' in el"),
        ("isSelectMultiple", "return el.tag === 'SELECT' && !!el.multiple"),
        ("querySelector", "return { tag: sel, children: [], nodeType: 1 }"),
    ] {
        let f = match name {
            "setClassName" => Function::new_with_args("el,v", body),
            "patchStyle" => Function::new_with_args("el,old,next", body),
            "setInnerHTML" => Function::new_with_args("el,html", body),
            "setValue" => Function::new_with_args("el,v", body),
            "setChecked" | "setDisabled" => Function::new_with_args("el,b", body),
            "clearRef" => Function::new_with_args("r", body),
            "applyRef" => Function::new_with_args("el,r", body),
            "setAttribute" => Function::new_with_args("el,k,v", body),
            "removeAttribute" => Function::new_with_args("el,k", body),
            "getTagName" => Function::new_with_args("el", body),
            "addEventListener" | "removeEventListener" => Function::new_with_args("el,evt,h", body),
            "hasValueProperty" | "isSelectMultiple" => Function::new_with_args("el", body),
            "querySelector" => Function::new_with_args("sel", body),
            _ => unreachable!(),
        };
        Reflect::set(&adapter, &JsValue::from_str(name), &f.into()).unwrap();
    }
    adapter.into()
}

#[wasm_bindgen_test]
fn default_surface_object_handle_attaches_wrapper_mount_metadata() {
    let rue = super::super::createRue(JsValue::UNDEFINED);
    let registry_rue: Rue<JsDomAdapter> = Rue::new();
    let input = MountInput::new_normalized(MountInputType::Vapor, Default::default(), vec![]);

    let handle = Object::from(registry_rue.input_to_mount_handle_value(&input));
    let cleanup_bucket = Array::new();
    cleanup_bucket.push(&JsValue::from_str("cleanup"));
    Reflect::set(
        &handle,
        &JsValue::from_str("__rue_cleanup_bucket"),
        &cleanup_bucket.clone().into(),
    )
    .unwrap();
    Reflect::set(&handle, &JsValue::from_str("__rue_effect_scope_id"), &JsValue::from_f64(17.0))
        .unwrap();
    Reflect::set(&handle, &JsValue::from_str("key"), &JsValue::from_str("wrapped-key")).unwrap();

    let roundtrip = rue
        .default_surface_mount_input_from_input(&handle.clone().into())
        .expect("default object handle should convert");

    assert!(matches!(roundtrip.r#type, MountInputType::Vapor));
    assert!(roundtrip.mount_cleanup_bucket.is_some());
    assert_eq!(roundtrip.mount_effect_scope_id, Some(17));
    assert_eq!(roundtrip.key.as_deref(), Some("wrapped-key"));
}

#[wasm_bindgen_test]
fn default_surface_object_handle_fast_path_does_not_need_inner_borrow() {
    let rue = super::super::createRue(JsValue::UNDEFINED);
    let registry_rue: Rue<JsDomAdapter> = Rue::new();
    let input = MountInput::new_normalized(MountInputType::Vapor, Default::default(), vec![]);
    let handle = registry_rue.input_to_mount_handle_value(&input);

    let _borrow = rue.inner.borrow_mut();
    let roundtrip = rue.default_surface_mount_input_from_input(&handle);

    assert!(roundtrip.is_some());
}

#[wasm_bindgen_test]
fn default_surface_host_bridge_returns_none_during_inner_mut_borrow() {
    let rue = super::super::createRue(input_test_adapter());
    let host = Object::new();
    Reflect::set(&host, &JsValue::from_str("tag"), &JsValue::from_str("span")).unwrap();
    Reflect::set(&host, &JsValue::from_str("nodeType"), &JsValue::from_f64(1.0)).unwrap();
    let bridge = Object::new();
    Reflect::set(&bridge, &JsValue::from_str("__rue_host_node"), &host.into()).unwrap();

    let _borrow = rue.inner.borrow_mut();
    assert!(rue.default_surface_mount_input_from_input(&bridge.into()).is_none());
}

#[wasm_bindgen_test]
fn default_surface_accepts_portable_component_and_vapor_wrappers() {
    let rue = super::super::createRue(JsValue::UNDEFINED);

    let component = Object::new();
    let render = Function::new_no_args("return null");
    Reflect::set(&component, &JsValue::from_str("__rue_component_type"), &render.into()).unwrap();
    Reflect::set(&component, &JsValue::from_str("key"), &JsValue::from_str("component-key"))
        .unwrap();

    let component_input = rue
        .default_surface_mount_input_from_input(&component.into())
        .expect("portable component should convert");
    assert!(matches!(component_input.r#type, MountInputType::Component(_)));
    assert_eq!(component_input.key.as_deref(), Some("component-key"));

    let vapor = Object::new();
    let setup = Function::new_no_args("return { tag: 'span', children: [] }");
    Reflect::set(&vapor, &JsValue::from_str("__rue_vapor_setup"), &setup.into()).unwrap();

    let vapor_input = rue
        .default_surface_mount_input_from_input(&vapor.into())
        .expect("portable vapor should convert");
    assert!(matches!(vapor_input.r#type, MountInputType::VaporWithSetup(_)));
}

#[wasm_bindgen_test]
fn default_surface_accepts_host_node_bridge_and_rejects_plain_object() {
    let rue = super::super::createRue(input_test_adapter());

    let host = Object::new();
    Reflect::set(&host, &JsValue::from_str("tag"), &JsValue::from_str("span")).unwrap();
    Reflect::set(&host, &JsValue::from_str("nodeType"), &JsValue::from_f64(1.0)).unwrap();
    Reflect::set(&host, &JsValue::from_str("children"), &Array::new().into()).unwrap();
    let bridge = Object::new();
    Reflect::set(&bridge, &JsValue::from_str("__rue_host_node"), &host.clone().into()).unwrap();

    let host_input = rue
        .default_surface_mount_input_from_input(&bridge.into())
        .expect("host-node bridge should convert");
    assert!(matches!(host_input.r#type, MountInputType::Vapor));
    assert!(host_input.el_hint.is_some());

    let plain = Object::new();
    assert!(rue.default_surface_mount_input_from_input(&plain.into()).is_none());
}

#[wasm_bindgen_test]
fn default_surface_accepts_consumable_string_mount_handles() {
    let rue = super::super::createRue(JsValue::UNDEFINED);
    let input = MountInput::new_normalized(
        MountInputType::Text("string-handle".to_string()),
        Default::default(),
        vec![],
    );
    let handle = transport::store_default_mount_input(
        input,
        transport::DefaultMountHandleStorePolicy::Append,
    );

    let roundtrip = rue
        .default_surface_mount_input_from_input(&JsValue::from_str(&handle.id.to_string()))
        .expect("numeric string handle should be consumed by the default surface");

    assert!(matches!(roundtrip.r#type, MountInputType::Text(text) if text == "string-handle"));
}

#[cfg(feature = "compat")]
#[wasm_bindgen_test]
fn compat_helpers_cover_arrays_create_element_and_raw_elements() {
    let rue = super::super::createRue(input_test_adapter());

    let array = Array::new();
    array.push(&JsValue::from_str("A"));
    Reflect::set(&array, &JsValue::from_str("key"), &JsValue::from_str("array-key")).unwrap();
    assert!(
        rue.compat_extension_mount_input_from_input(
            &array.clone().into(),
            CompatEntryPolicy::LegacyRawElementInput,
        )
        .is_none()
    );

    let element_input = rue.compat_mount_input_from_create_element(
        &JsValue::from_str("section"),
        &JsValue::UNDEFINED,
        &array.into(),
    );
    assert!(matches!(element_input.r#type, MountInputType::Element(tag) if tag == "section"));
    assert_eq!(element_input.children.len(), 1);

    let raw = Object::new();
    Reflect::set(&raw, &JsValue::from_str("tag"), &JsValue::from_str("span")).unwrap();
    Reflect::set(&raw, &JsValue::from_str("nodeType"), &JsValue::from_f64(1.0)).unwrap();
    Reflect::set(&raw, &JsValue::from_str("children"), &Array::new().into()).unwrap();
    let raw_input = rue
        .compat_extension_mount_input_from_input(
            &raw.clone().into(),
            CompatEntryPolicy::LegacyRawElementInput,
        )
        .expect("legacy raw element should convert");
    assert!(matches!(raw_input.r#type, MountInputType::Vapor));
    assert!(raw_input.el_hint.is_some());

    let blocked = rue.compat_extension_mount_input_from_input(
        &raw.into(),
        CompatEntryPolicy::DefaultSurfaceOnly,
    );
    assert!(blocked.is_none());

    let missing_node_type = Object::new();
    assert!(
        rue.compat_extension_mount_input_from_input(
            &missing_node_type.into(),
            CompatEntryPolicy::LegacyRawElementInput,
        )
        .is_none()
    );
}

#[cfg(feature = "compat")]
#[wasm_bindgen_test]
fn compat_helpers_reject_raw_arrays_and_function_component_vnodes() {
    let rue = super::super::createRue(input_test_adapter());

    let render = Function::new_no_args("return { type: 'span', props: {}, children: ['ok'] }");
    let component_vnode = Object::new();
    Reflect::set(&component_vnode, &JsValue::from_str("type"), &render.into()).unwrap();
    Reflect::set(&component_vnode, &JsValue::from_str("props"), &Object::new().into()).unwrap();
    let blocked_component = rue.compat_extension_mount_input_from_input(
        &component_vnode.into(),
        CompatEntryPolicy::DefaultSurfaceOnly,
    );
    assert!(blocked_component.is_none());
}

#[cfg(feature = "compat")]
#[wasm_bindgen_test]
fn mount_input_from_input_returns_none_for_reentrant_borrow_edges() {
    let rue = super::super::createRue(input_test_adapter());

    let host = Object::new();
    Reflect::set(&host, &JsValue::from_str("tag"), &JsValue::from_str("span")).unwrap();
    Reflect::set(&host, &JsValue::from_str("nodeType"), &JsValue::from_f64(1.0)).unwrap();
    let bridge = Object::new();
    Reflect::set(&bridge, &JsValue::from_str("__rue_host_node"), &host.into()).unwrap();

    let raw = Object::new();
    Reflect::set(&raw, &JsValue::from_str("tag"), &JsValue::from_str("strong")).unwrap();
    Reflect::set(&raw, &JsValue::from_str("nodeType"), &JsValue::from_f64(1.0)).unwrap();
    Reflect::set(&raw, &JsValue::from_str("children"), &Array::new().into()).unwrap();

    let _borrow = rue.inner.borrow_mut();
    assert!(
        rue.mount_input_from_input(&bridge.into(), CompatEntryPolicy::DefaultSurfaceOnly).is_none()
    );
    assert!(
        rue.mount_input_from_input(&raw.into(), CompatEntryPolicy::LegacyRawElementInput).is_none()
    );
}

#[cfg(feature = "compat")]
#[wasm_bindgen_test]
fn compat_raw_element_returns_none_during_inner_mut_borrow() {
    let rue = super::super::createRue(input_test_adapter());
    let raw = Object::new();
    Reflect::set(&raw, &JsValue::from_str("tag"), &JsValue::from_str("span")).unwrap();
    Reflect::set(&raw, &JsValue::from_str("nodeType"), &JsValue::from_f64(1.0)).unwrap();

    let _borrow = rue.inner.borrow_mut();
    assert!(
        rue.compat_extension_mount_input_from_input(
            &raw.into(),
            CompatEntryPolicy::LegacyRawElementInput,
        )
        .is_none()
    );
}
