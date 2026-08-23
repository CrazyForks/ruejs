/*
渲染调试桥接：onRenderTriggered

注册当前组件实例的渲染触发调试回调。回调会在响应式依赖触发组件渲染相关 effect 时收到
DebuggerEvent-like 对象，便于定位是哪一个响应式 key/path 触发了更新。
*/
use super::WasmRue;
use crate::reactive::context::register_current_instance_render_triggered_hook;
use crate::reactive::core::activate_render_triggered_debug;
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl WasmRue {
    #[wasm_bindgen(js_name = "onRenderTriggered")]
    /// 注册当前组件的 renderTriggered 调试钩子。
    pub fn on_render_triggered(&self, f: JsValue) {
        register_current_instance_render_triggered_hook(f);
    }

    #[wasm_bindgen(js_name = "__rtd", skip_typescript)]
    /// shared owner 注册路径使用的内部激活桥；不进入公开 TypeScript 声明。
    pub fn activate_render_triggered_debug(&self) {
        activate_render_triggered_debug();
    }
}
