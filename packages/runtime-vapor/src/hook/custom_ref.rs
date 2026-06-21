/*
customRef Hook 包装。

与 ref()/computed() 一样，组件实例存在时会通过 Hook slot 复用同一个自定义 ref。
真正的依赖收集和触发句柄由 reactive::signal::create_custom_ref 创建。
*/
use js_sys::Function;
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use wasm_bindgen::closure::Closure;
use wasm_bindgen::prelude::*;

use crate::reactive::context::{get_current_instance, with_hook_slot};
use crate::reactive::signal::create_custom_ref;

#[wasm_bindgen(js_name = customRef)]
pub fn custom_ref_js(factory: Function, force_global: Option<bool>) -> JsValue {
    let make = Closure::wrap(
        Box::new(move || create_custom_ref(factory.clone())) as Box<dyn FnMut() -> JsValue>
    );
    let use_global = force_global.unwrap_or(false);
    let current = get_current_instance();
    let result = if use_global || current.is_undefined() || current.is_null() {
        let f: Function = make.as_ref().clone().unchecked_into();
        f.call0(&JsValue::NULL).unwrap_or(JsValue::UNDEFINED)
    } else {
        let f: Function = make.as_ref().clone().unchecked_into();
        with_hook_slot(f)
    };
    make.forget();
    result
}

#[wasm_bindgen(typescript_custom_section)]
const TS_CUSTOM_REF_DECL: &'static str = r#"
/**
 * 创建自定义 ref：工厂函数接收 track/trigger，并返回 value 的 get/set 实现。
 */
export function customRef<T = any>(
  factory: CustomRefFactory<T>,
  forceGlobal?: boolean,
): { value: T };
"#;
