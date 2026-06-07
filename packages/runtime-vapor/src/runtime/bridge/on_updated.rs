/*
生命周期桥接：onUpdated

注册更新后回调。具体触发由 patch/render 生命周期层统一决定。
*/
use super::WasmRue;
use crate::runtime::globals::push_pending_hook;
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl WasmRue {
    #[wasm_bindgen(js_name = "onUpdated")]
    pub fn on_updated(&self, f: JsValue) {
        if let Ok(mut inner) = self.inner.try_borrow_mut() {
            inner.on_updated(f);
        } else {
            push_pending_hook("updated", f);
        }
    }
}
