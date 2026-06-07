/*
getCurrentContainer：读取当前渲染容器

优先使用 JS shared bridge 维护的容器栈，其次读取 Rust runtime 当前容器，
最后回退到最近一次 mount/render 记录的容器，服务于嵌套渲染与 Hook 辅助逻辑。
*/
use super::WasmRue;
use crate::runtime::shared_runtime_bridge;
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl WasmRue {
    #[wasm_bindgen(js_name = "getCurrentContainer")]
    /// 获取当前容器：优先返回可重入的当前父容器 shadow，其次尝试读取 Rue 当前容器，最后回退到最近一次挂载容器
    pub fn get_current_container_wasm(&self) -> JsValue {
        if let Some(current) = shared_runtime_bridge::get_current_container() {
            return current;
        }
        // 尝试只读借用 inner，从 Rue 查询当前容器
        if let Ok(inner) = self.inner.try_borrow() {
            #[cfg(feature = "dev")]
            {
                if crate::log::want_log("debug", "runtime:getCurrentContainer start") {
                    crate::log::log("debug", "runtime:getCurrentContainer start");
                }
            }
            let res = inner.get_current_container();
            #[cfg(feature = "dev")]
            {
                if crate::log::want_log("debug", "runtime:getCurrentContainer") {
                    let has = res.is_some();
                    crate::log::log(
                        "debug",
                        &format!("runtime:getCurrentContainer has_container={}", has),
                    );
                }
            }
            if let Some(current) = res.map(JsValue::from) {
                return current;
            }
        } else {
            #[cfg(feature = "dev")]
            {
                crate::log::warning("runtime:getCurrentContainer reentrant borrow");
            }
        }

        if let Some(c) = self.last_container.borrow().as_ref() {
            return c.clone();
        }

        JsValue::UNDEFINED
    }
}
