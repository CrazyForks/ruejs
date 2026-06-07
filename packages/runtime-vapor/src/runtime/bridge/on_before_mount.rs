/*
生命周期桥接：onBeforeMount

注册组件挂载前回调。重入期间无法借用 runtime 时，会先进入 pending hooks 队列。
*/
use super::WasmRue;
use crate::runtime::globals::push_pending_hook;
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl WasmRue {
    #[wasm_bindgen(js_name = "onBeforeMount")]
    pub fn on_before_mount(&self, f: JsValue) {
        if let Ok(mut inner) = self.inner.try_borrow_mut() {
            inner.on_before_mount(f);
        } else {
            push_pending_hook("before_mount", f);
        }
    }
}
