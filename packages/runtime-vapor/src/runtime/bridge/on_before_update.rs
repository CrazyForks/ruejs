/*
生命周期桥接：onBeforeUpdate

注册更新前回调。当前实现保持与其他生命周期一致的 pending-hook 兜底语义。
*/
use super::WasmRue;
use crate::runtime::globals::push_pending_hook;
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl WasmRue {
    #[wasm_bindgen(js_name = "onBeforeUpdate")]
    pub fn on_before_update(&self, f: JsValue) {
        if let Ok(mut inner) = self.inner.try_borrow_mut() {
            inner.on_before_update(f);
        } else {
            push_pending_hook("before_update", f);
        }
    }
}
