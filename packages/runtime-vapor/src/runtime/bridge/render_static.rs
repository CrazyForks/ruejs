use super::WasmRue;
use super::input::CompatEntryPolicy;
use crate::runtime::js_adapter::JsDomAdapter;
use crate::runtime::types::MountInput;
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl WasmRue {
    /// 入队一次静态锚点渲染并调度异步刷新
    fn enqueue_static_and_schedule(
        &self,
        input: MountInput<JsDomAdapter>,
        parent: JsValue,
        anchor: JsValue,
    ) {
        self.pending_static.borrow_mut().push((input, parent, anchor));
        self.schedule_flush();
    }

    #[wasm_bindgen(js_name = "renderStatic")]
    /// 单锚点静态渲染入口：
    /// - 默认接受 tagged mount handle、portable handle、host-node bridge
    /// - 不接受 compat raw array/raw node/vnode/function-component 输入
    pub fn render_static_wasm(&self, input_value: JsValue, parent: JsValue, anchor: JsValue) {
        let Some(input) =
            self.mount_input_from_input(&input_value, CompatEntryPolicy::DefaultSurfaceOnly)
        else {
            let should_report_error = !input_value.is_null() && !input_value.is_undefined();
            #[cfg(feature = "dev")]
            {
                crate::log::warning(
                    "Rue runtime: renderStatic input not supported on the default path",
                );
            }
            if should_report_error {
                if let Ok(mut inner) = self.inner.try_borrow_mut() {
                    inner.handle_error(JsValue::from_str(
                        "Rue runtime: renderStatic input not supported on the default path",
                    ));
                }
            }
            return;
        };

        self.enqueue_static_and_schedule(input, parent, anchor);
    }
}
