/*
生命周期桥接：onDeactivated

组件被 KeepAlive 缓存并移出活动 DOM 区间时触发。
*/
use super::WasmRue;
use crate::runtime::globals::push_pending_hook;
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl WasmRue {
    #[wasm_bindgen(js_name = "onDeactivated")]
    /// 注册 KeepAlive deactivated 钩子；优先挂到当前组件实例，重入时退回 pending 队列。
    pub fn on_deactivated(&self, f: JsValue) {
        let current = crate::reactive::context::get_current_instance();
        let current_index = js_sys::Reflect::get(&current, &JsValue::from_str("__ci_index"))
            .ok()
            .and_then(|value| value.as_f64())
            .map(|value| value as usize);
        if let Some(index) = current_index {
            if let Ok(mut inner) = self.inner.try_borrow_mut() {
                if inner.push_instance_hook(index, "deactivated", f.clone()) {
                    return;
                }
            }
        }

        if let Ok(mut inner) = self.inner.try_borrow_mut() {
            inner.on_deactivated(f);
        } else {
            push_pending_hook("deactivated", f);
        }
    }
}
