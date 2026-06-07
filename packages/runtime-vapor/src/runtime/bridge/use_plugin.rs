/*
use(plugin)：插件安装桥接

将 options 归一化为数组，并把安装动作延迟到 mount 前执行。
延迟执行可以确保插件逻辑处在正确的容器与应用 scope 上下文里。
*/
use super::WasmRue;
use js_sys::Array;
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl WasmRue {
    #[wasm_bindgen(js_name = "use")]
    /// 使用插件：将 options 归一化为 Vec<JsValue> 并调用内部 use_plugin
    pub fn use_plugin_wasm(&self, plugin: JsValue, options: JsValue) {
        #[cfg(feature = "dev")]
        {
            if crate::log::want_log("debug", "runtime:use") {
                crate::log::log("debug", "runtime:use");
            }
        }
        let mut inner = self.inner.borrow_mut();
        let mut opts_vec: Vec<JsValue> = Vec::new();
        if Array::is_array(&options) {
            let arr = Array::from(&options);
            for i in 0..arr.length() {
                opts_vec.push(arr.get(i));
            }
        }
        inner.use_plugin(plugin, opts_vec);
    }
}
