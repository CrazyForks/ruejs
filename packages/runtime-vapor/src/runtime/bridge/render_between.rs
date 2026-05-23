use super::WasmRue;
use super::input::CompatEntryPolicy;
use crate::runtime::js_adapter::JsDomAdapter;
use crate::runtime::types::MountInput;
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl WasmRue {
    /// 入队一次区间渲染并调度异步刷新
    fn enqueue_between_and_schedule(
        &self,
        input: MountInput<JsDomAdapter>,
        parent: JsValue,
        start: JsValue,
        end: JsValue,
    ) {
        let p: JsValue = parent;
        let s: JsValue = start;
        let e: JsValue = end;
        self.pending_between.borrow_mut().push((input, p, s, e));
        self.schedule_flush();
    }

    #[wasm_bindgen(js_name = "renderBetween")]
    /// 区间渲染入口：
    /// - 默认接受 tagged mount handle、portable handle、host-node bridge
    /// - 不接受 compat raw array/raw node/vnode/function-component 输入
    pub fn render_between_wasm(
        &self,
        input_value: JsValue,
        parent: JsValue,
        start: JsValue,
        end: JsValue,
    ) {
        let Some(input) =
            self.mount_input_from_input(&input_value, CompatEntryPolicy::DefaultSurfaceOnly)
        else {
            let should_report_error = !input_value.is_null() && !input_value.is_undefined();
            if should_report_error {
                #[cfg(feature = "dev")]
                {
                    crate::log::warning(
                        "Rue runtime: renderBetween input not supported on the default path",
                    );
                }
            }

            if let Ok(mut inner) = self.inner.try_borrow_mut() {
                if should_report_error {
                    inner.handle_error(JsValue::from_str(
                        "Rue runtime: renderBetween input not supported on the default path",
                    ));
                }
                let mut parent_value = parent.clone();
                inner.clear_range((&mut parent_value).into(), start.into(), end.into());
            }
            return;
        };

        // 解包并入队执行
        self.enqueue_between_and_schedule(input, parent, start, end);
    }
}
