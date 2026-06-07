/*
KeepAlive 生命周期触发桥接

JS KeepAlive 负责移动缓存 DOM range；Wasm runtime 持有该 range 的 mounted snapshot，
因此由这里按 start anchor 找到子树并递归触发 activated/deactivated hooks。
*/
use super::WasmRue;
use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::*;

enum KeepAliveLifecycleKind {
    Activated,
    Deactivated,
}

impl WasmRue {
    /// 立即触发指定 range 的 KeepAlive 生命周期；若 runtime 正在借用则推入待处理队列。
    fn invoke_keep_alive_lifecycle(&self, kind: KeepAliveLifecycleKind, start: JsValue) -> bool {
        if let Ok(mut inner) = self.inner.try_borrow_mut() {
            match kind {
                KeepAliveLifecycleKind::Activated => inner.activate_range(&start.into()),
                KeepAliveLifecycleKind::Deactivated => inner.deactivate_range(&start.into()),
            }
            true
        } else {
            match kind {
                KeepAliveLifecycleKind::Activated => {
                    self.pending_activated_ranges.borrow_mut().push(start);
                }
                KeepAliveLifecycleKind::Deactivated => {
                    self.pending_deactivated_ranges.borrow_mut().push(start);
                }
            }
            false
        }
    }

    /// 处理 KeepAlive 生命周期队列；返回 true 表示本轮消费了一个任务。
    pub(super) fn process_keep_alive_lifecycle_queue(&self) -> bool {
        let deactivated = self.pending_deactivated_ranges.borrow_mut().pop();
        if let Some(start) = deactivated {
            if !self.invoke_keep_alive_lifecycle(KeepAliveLifecycleKind::Deactivated, start) {
                return false;
            }
            return true;
        }

        let activated = self.pending_activated_ranges.borrow_mut().pop();
        if let Some(start) = activated {
            if !self.invoke_keep_alive_lifecycle(KeepAliveLifecycleKind::Activated, start) {
                return false;
            }
            return true;
        }

        false
    }
}

#[wasm_bindgen]
impl WasmRue {
    #[wasm_bindgen(js_name = "__rueActivateRange")]
    /// JS KeepAlive 桥接入口：按 start anchor 触发 activated。
    pub fn activate_range_wasm(&self, start: JsValue) {
        self.invoke_keep_alive_lifecycle(KeepAliveLifecycleKind::Activated, start);
    }

    #[wasm_bindgen(js_name = "__rueDeactivateRange")]
    /// JS KeepAlive 桥接入口：按 start anchor 触发 deactivated。
    pub fn deactivate_range_wasm(&self, start: JsValue) {
        self.invoke_keep_alive_lifecycle(KeepAliveLifecycleKind::Deactivated, start);
    }
}
