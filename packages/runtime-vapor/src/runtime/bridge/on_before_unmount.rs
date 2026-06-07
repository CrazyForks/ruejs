/*
生命周期桥接：onBeforeUnmount

用于在 mounted snapshot 被清理前运行用户回调，通常放置订阅、计时器、外部资源的释放逻辑。
*/
use super::WasmRue;
use crate::runtime::globals::push_pending_hook;
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl WasmRue {
    #[wasm_bindgen(js_name = "onBeforeUnmount")]
    pub fn on_before_unmount(&self, f: JsValue) {
        if let Ok(mut inner) = self.inner.try_borrow_mut() {
            inner.on_before_unmount(f);
        } else {
            push_pending_hook("before_unmount", f);
        }
    }
}
