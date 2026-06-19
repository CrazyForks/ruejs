/*
renderStatic：一次性静态锚点挂载桥接

用于编译期确认不会再由父级驱动更新的子树。
它只借助 anchor 定位插入，不维护 range_map，从而降低静态内容的运行时成本。
*/
use super::WasmRue;
use super::input::InputEntryPolicy;
use crate::runtime::error_strings;
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
    /// - 默认接受 tagged mount handle、portable handle
    /// - 不接受 raw array/raw node/object-tree/function-component 输入
    pub fn render_static_wasm(&self, input_value: JsValue, parent: JsValue, anchor: JsValue) {
        let Some(input) =
            self.mount_input_from_input(&input_value, InputEntryPolicy::DefaultSurfaceOnly)
        else {
            let should_report_error = !input_value.is_null() && !input_value.is_undefined();
            #[cfg(feature = "dev")]
            {
                crate::log::warning(error_strings::UNSUPPORTED_RENDER_STATIC_INPUT);
            }
            if should_report_error {
                if let Ok(mut inner) = self.inner.try_borrow_mut() {
                    inner.handle_error(JsValue::from_str(
                        error_strings::UNSUPPORTED_RENDER_STATIC_INPUT,
                    ));
                }
            }
            return;
        };

        self.enqueue_static_and_schedule(input, parent, anchor);
    }
}
