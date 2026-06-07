/*
生命周期桥接：onMounted

组件真实挂载完成后触发。这里与其他 hook 一样支持重入时进入 pending 队列。
*/
use super::WasmRue;
use crate::runtime::globals::push_pending_hook;
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl WasmRue {
    #[wasm_bindgen(js_name = "onMounted")]
    pub fn on_mounted(&self, f: JsValue) {
        if let Ok(mut inner) = self.inner.try_borrow_mut() {
            inner.on_mounted(f);
        } else {
            push_pending_hook("mounted", f);
        }
    }
}
