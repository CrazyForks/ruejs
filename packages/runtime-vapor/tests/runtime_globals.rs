use rue_runtime_vapor::{
    ComponentProps, JsDomAdapter, MOUNT_INPUT_REGISTRY, MountInput, MountInputType,
    is_runtime_crashed, last_hook_error, mark_crashed_from_hook, push_pending_hook,
    take_pending_hooks,
};
use wasm_bindgen::JsValue;
use wasm_bindgen_test::*;

#[wasm_bindgen_test]
fn runtime_globals_public_state_paths_are_observable() {
    assert!(!is_runtime_crashed());
    assert!(last_hook_error().is_none());

    push_pending_hook("before_mount", JsValue::from_str("queued"));
    let hooks = take_pending_hooks();
    assert_eq!(hooks.len(), 1);
    assert_eq!(hooks[0].0, "before_mount");
    assert_eq!(hooks[0].1.as_string().as_deref(), Some("queued"));
    assert!(take_pending_hooks().is_empty());

    MOUNT_INPUT_REGISTRY.with(|registry| {
        let mut entries = registry.borrow_mut();
        entries.clear();
        entries.push(Some(MountInput::<JsDomAdapter> {
            r#type: MountInputType::Text("stored".to_string()),
            props: ComponentProps::new(),
            children: vec![],
            key: Some("global-key".to_string()),
            strict_component_returns: false,
            mount_cleanup_bucket: None,
            mount_effect_scope_id: None,
            el_hint: None,
        }));

        let stored = entries[0].as_ref().expect("entry should be present");
        assert!(matches!(&stored.r#type, MountInputType::Text(text) if text == "stored"));
        assert_eq!(stored.key.as_deref(), Some("global-key"));
        entries.clear();
    });

    mark_crashed_from_hook(&JsValue::from_str("hook-error"));
    assert!(is_runtime_crashed());
    assert_eq!(last_hook_error().and_then(|err| err.as_string()).as_deref(), Some("hook-error"));
}
