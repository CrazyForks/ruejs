use super::WasmRue;
use super::input::CompatEntryPolicy;
use crate::runtime::js_adapter::JsDomAdapter;
use crate::runtime::types::MountInput;
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl WasmRue {
    fn enqueue_anchor_and_schedule(
        &self,
        input: MountInput<JsDomAdapter>,
        parent: JsValue,
        anchor: JsValue,
    ) {
        self.pending_anchor.borrow_mut().push((input, parent, anchor));
        self.schedule_flush();
    }

    #[wasm_bindgen(js_name = "renderAnchor")]
    /// 单锚点渲染入口：
    /// - 默认接受 tagged mount handle、portable handle、host-node bridge
    /// - compat 构建额外接受函数组件、raw node、array 等旧输入
    pub fn render_anchor_wasm(&self, input_value: JsValue, parent: JsValue, anchor: JsValue) {
        let Some(input) = self.mount_input_from_input(
            &input_value,
            CompatEntryPolicy::LegacyArrayRawElementOrFunctionComponentInput,
        ) else {
            #[cfg(feature = "dev")]
            {
                crate::log::warning(
                    "Rue runtime: renderAnchor input not supported on the default path",
                );
            }

            if let Ok(mut inner) = self.inner.try_borrow_mut() {
                let mut parent_value = parent.clone();
                inner.clear_anchor((&mut parent_value).into(), anchor.into());
            }
            return;
        };

        self.enqueue_anchor_and_schedule(input, parent, anchor);
    }
}
