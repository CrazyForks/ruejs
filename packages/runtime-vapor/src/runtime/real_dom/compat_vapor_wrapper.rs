/*
Compat Vapor wrapper 判断

旧协议里某些 setup 返回对象会包一层 wrapper。这里集中识别该形态，
避免主挂载流程散落兼容判断。
*/
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

#[cfg(test)]
mod tests {
    use super::*;
    use wasm_bindgen_test::*;

    #[wasm_bindgen_test]
    fn detects_legacy_vapor_wrapper_and_fallback_shapes() {
        let wrapper = Object::new();
        Reflect::set(&wrapper, &JsValue::from_str("vaporElement"), &Object::new()).unwrap();
        assert!(setup_return_uses_legacy_vapor_wrapper(&wrapper.into()));

        let missing_metadata = Object::new();
        assert!(!setup_return_uses_legacy_vapor_wrapper(&missing_metadata.into()));

        let null_metadata = Object::new();
        Reflect::set(&null_metadata, &JsValue::from_str("vaporElement"), &JsValue::NULL).unwrap();
        assert!(!setup_return_uses_legacy_vapor_wrapper(&null_metadata.into()));

        assert!(!setup_return_uses_legacy_vapor_wrapper(&JsValue::from_str("raw")));
    }
}
