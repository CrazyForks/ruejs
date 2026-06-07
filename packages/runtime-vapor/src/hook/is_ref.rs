/*
isRef 调试工具
*/
use js_sys::Reflect;
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::*;

const RUE_REF_FLAG: &str = "__rue_ref__";

/// 读取 ref/computed 标记；对代理值优先回到 raw target 再判断。
fn has_ref_flag(value: &JsValue) -> bool {
    if !value.is_object() {
        return false;
    }

    let raw = Reflect::get(value, &JsValue::from_str("__rue_raw__")).unwrap_or(JsValue::UNDEFINED);
    let target = if raw.is_object() { raw } else { value.clone() };
    Reflect::get(&target, &JsValue::from_str(RUE_REF_FLAG))
        .unwrap_or(JsValue::FALSE)
        .as_bool()
        .unwrap_or(false)
}

/// 判断值是否为 Rue ref 或 computed ref。
#[wasm_bindgen(js_name = isRef)]
pub fn is_ref(obj: JsValue) -> bool {
    has_ref_flag(&obj)
}

#[wasm_bindgen(typescript_custom_section)]
const TS_IS_REF_DECL: &'static str = r#"
/**
 * 判断值是否为 Rue ref 或 computed ref。
 */
export function isRef<T = any>(value: unknown): value is { value: T };
"#;
