/*
生命周期桥接：onCreated

组件实例创建后触发；重入期间先缓存到 pending hooks，之后由组件挂载流程合并。
*/
use super::WasmRue;
use crate::runtime::globals::push_pending_hook;
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl WasmRue {
    #[wasm_bindgen(js_name = "onCreated")]
    pub fn on_created(&self, f: JsValue) {
        if let Ok(mut inner) = self.inner.try_borrow_mut() {
            inner.on_created(f);
        } else {
            push_pending_hook("created", f);
        }
    }
}
