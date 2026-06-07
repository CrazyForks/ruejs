/*
isReadonly 调试工具
*/
use js_sys::Reflect;
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::*;

/// 判断对象是否带有 readonly 标记，覆盖 readonly/shallowReadonly 与只读 computed。
#[wasm_bindgen(js_name = isReadonly)]
pub fn is_readonly(obj: JsValue) -> bool {
    if !obj.is_object() {
        return false;
    }

    let flag =
        Reflect::get(&obj, &JsValue::from_str("__isReadonly__")).unwrap_or(JsValue::UNDEFINED);
    flag.as_bool() == Some(true)
}

#[wasm_bindgen(typescript_custom_section)]
const TS_IS_READONLY_DECL: &'static str = r#"
/**
 * 调试工具：判断对象是否为 readonly/shallowReadonly 代理，或只读 computed 句柄
 */
export function isReadonly(obj: any): boolean;
"#;
