/*
renderAnchor：单锚点渲染桥接

用于在指定 parent 的 anchor 前渲染一段子树，并通过 anchor_map 追踪后续更新。
常见于组件或条件分支这类“位置由锚点稳定标识”的场景。
*/
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
    /// - compat 构建额外接受 compat vnode、raw node 等锚点桥接输入
    pub fn render_anchor_wasm(&self, input_value: JsValue, parent: JsValue, anchor: JsValue) {
        #[cfg(feature = "compat")]
        let compat_entry_policy = CompatEntryPolicy::LegacyRawElementInput;
        #[cfg(not(feature = "compat"))]
        let compat_entry_policy = CompatEntryPolicy::DefaultSurfaceOnly;

        let Some(input) = self.mount_input_from_input(&input_value, compat_entry_policy) else {
            let should_report_error = !input_value.is_null() && !input_value.is_undefined();
            if should_report_error {
                #[cfg(feature = "dev")]
                {
                    crate::log::warning(
                        "Rue runtime: renderAnchor input not supported on the default path",
                    );
                }
            }

            if let Ok(mut inner) = self.inner.try_borrow_mut() {
                if should_report_error {
                    inner.handle_error(JsValue::from_str(
                        "Rue runtime: renderAnchor input not supported on the default path",
                    ));
                }
                let mut parent_value = parent.clone();
                inner.clear_anchor((&mut parent_value).into(), anchor.into());
            }
            return;
        };

        self.enqueue_anchor_and_schedule(input, parent, anchor);
    }
}
