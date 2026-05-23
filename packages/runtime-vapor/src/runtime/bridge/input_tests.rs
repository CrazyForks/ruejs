use super::*;
use crate::runtime::core::Rue;
use crate::runtime::types::MountInputType;
use js_sys::{Array, Object, Reflect};
use wasm_bindgen_test::*;

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
