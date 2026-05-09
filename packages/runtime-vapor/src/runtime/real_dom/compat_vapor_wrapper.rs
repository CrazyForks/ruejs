use js_sys::{Object, Reflect};
use wasm_bindgen::JsValue;

pub(super) fn setup_return_uses_legacy_vapor_wrapper(ret: &JsValue) -> bool {
    if ret.is_object() {
        let obj = Object::from(ret.clone());
        let legacy =
            Reflect::get(&obj, &JsValue::from_str("vaporElement")).unwrap_or(JsValue::UNDEFINED);
        return !legacy.is_undefined() && !legacy.is_null();
    }

    false
}
