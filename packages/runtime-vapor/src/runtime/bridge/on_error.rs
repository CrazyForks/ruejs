/*
错误处理桥接：onError

注册全局错误处理器。组件级错误处理会优先消费，未处理的错误再派发到这里。
*/
use super::WasmRue;
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl WasmRue {
    #[wasm_bindgen(js_name = "onError")]
    pub fn on_error(&self, f: JsValue) {
        self.inner.borrow_mut().on_error(f);
    }
}
