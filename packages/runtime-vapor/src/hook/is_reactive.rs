/*
isReactive 调试工具
*/
use js_sys::Reflect;
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::*;

// ref/computed 虽然也是对象，但 isProxy 语义只覆盖 reactive/readonly 代理。
fn has_ref_flag(obj: &JsValue) -> bool {
    let raw = Reflect::get(obj, &JsValue::from_str("__rue_raw__")).unwrap_or(JsValue::UNDEFINED);
    let target = if raw.is_object() { raw } else { obj.clone() };
    Reflect::get(&target, &JsValue::from_str("__rue_ref__"))
        .unwrap_or(JsValue::FALSE)
        .as_bool()
        .unwrap_or(false)
}

#[wasm_bindgen(js_name = isReactive)]
pub fn is_reactive(obj: JsValue) -> bool {
    // 非对象一定不是 reactive
    if !obj.is_object() {
        return false;
    }
    // reactive 代理会打上内部标记：
    // - __isReactive__: 布尔或存在即视为真
    // - __signal__:    隐藏的底层信号句柄（对象存在也说明是代理）
    let flag =
        Reflect::get(&obj, &JsValue::from_str("__isReactive__")).unwrap_or(JsValue::UNDEFINED);
    let sig = Reflect::get(&obj, &JsValue::from_str("__signal__")).unwrap_or(JsValue::UNDEFINED);
    let flag_true = flag.as_bool().unwrap_or(false) || !flag.is_undefined();
    let has_sig = !sig.is_undefined() && sig.is_object();
    flag_true || has_sig
}

/// 判断对象是否为 Rue reactive 或 readonly 代理，排除 ref/computed 句柄。
#[wasm_bindgen(js_name = isProxy)]
pub fn is_proxy(obj: JsValue) -> bool {
    if !obj.is_object() || has_ref_flag(&obj) {
        return false;
    }

    let readonly_flag =
        Reflect::get(&obj, &JsValue::from_str("__isReadonly__")).unwrap_or(JsValue::UNDEFINED);
    is_reactive(obj) || readonly_flag.as_bool() == Some(true)
}

#[wasm_bindgen(typescript_custom_section)]
const TS_IS_REACTIVE_DECL: &'static str = r#"
/**
 * 调试工具：判断对象是否为 reactive 代理
 */
export function isReactive(obj: any): boolean;

/**
 * 调试工具：判断对象是否为 Rue 响应式代理
 */
export function isProxy(obj: any): boolean;
"#;
