/*
真实 DOM 辅助函数

放置挂载流程中反复使用的小工具，例如 Hook index 初始化。
保持这些细节集中，避免组件/元素/片段挂载代码互相复制。
*/
use js_sys::{Object, Reflect};
use wasm_bindgen::JsValue;

/// 重置组件宿主对象上的 hook 调用索引
///
/// 确保后续 hooks 从索引 0 开始，避免跨渲染错位。
#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
pub(crate) fn reset_hook_index(host: &Object) {
    let hooks = Reflect::get(host, &JsValue::from_str("__hooks")).unwrap_or(JsValue::UNDEFINED);
    if !(hooks.is_undefined() || hooks.is_null()) {
        let hooks_obj = Object::from(hooks);
        let _ = Reflect::set(&hooks_obj, &JsValue::from_str("index"), &JsValue::from_f64(0.0));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use wasm_bindgen_test::*;

    #[wasm_bindgen_test]
    fn reset_hook_index_ignores_missing_hooks_and_resets_existing_index() {
        let empty_host = Object::new();
        reset_hook_index(&empty_host);

        let undefined_hooks_host = Object::new();
        Reflect::set(&undefined_hooks_host, &JsValue::from_str("__hooks"), &JsValue::UNDEFINED)
            .unwrap();
        reset_hook_index(&undefined_hooks_host);

        let null_hooks_host = Object::new();
        Reflect::set(&null_hooks_host, &JsValue::from_str("__hooks"), &JsValue::NULL).unwrap();
        reset_hook_index(&null_hooks_host);

        let host = Object::new();
        let hooks = Object::new();
        Reflect::set(&hooks, &JsValue::from_str("index"), &JsValue::from_f64(9.0)).unwrap();
        Reflect::set(&host, &JsValue::from_str("__hooks"), &hooks).unwrap();

        reset_hook_index(&host);

        assert_eq!(Reflect::get(&hooks, &JsValue::from_str("index")).unwrap().as_f64(), Some(0.0));
    }

    #[wasm_bindgen_test]
    fn reset_hook_index_creates_index_on_hook_object_without_existing_index() {
        let host = Object::new();
        let hooks = Object::new();
        Reflect::set(&host, &JsValue::from_str("__hooks"), &hooks).unwrap();

        reset_hook_index(&host);

        assert_eq!(Reflect::get(&hooks, &JsValue::from_str("index")).unwrap().as_f64(), Some(0.0));
    }
}
