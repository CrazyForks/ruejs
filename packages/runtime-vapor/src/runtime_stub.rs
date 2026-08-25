/*
未启用 runtime feature 时的最小桩实现

响应式/Hook 层仍可能需要记录运行时崩溃状态与最近错误。
本文件提供同名 API，避免非 runtime 构建下出现大量条件编译分支。
*/
#[cfg(feature = "vapor")]
use js_sys::{Function, Object, Reflect};
use std::cell::{Cell, RefCell};
#[cfg(feature = "vapor")]
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
#[cfg(feature = "vapor")]
use wasm_bindgen::prelude::wasm_bindgen;

thread_local! {
    static RUNTIME_CRASHED: Cell<bool> = Cell::new(false);
    static LAST_HOOK_ERROR: RefCell<Option<JsValue>> = RefCell::new(None);
}

pub fn mark_crashed_from_hook(err: &JsValue) {
    RUNTIME_CRASHED.with(|flag| flag.set(true));
    LAST_HOOK_ERROR.with(|cell| {
        *cell.borrow_mut() = Some(err.clone());
    });
}

pub fn is_runtime_crashed() -> bool {
    RUNTIME_CRASHED.with(|flag| flag.get())
}

pub fn last_hook_error() -> Option<JsValue> {
    LAST_HOOK_ERROR.with(|cell| cell.borrow().clone())
}

/// Vapor 专用产物只保留 setup handle 与应用级 mount 的最小桥接。
///
/// 完整的组件、通用 render、生命周期和插件 API 仍由 `runtime` feature 提供。
#[cfg(feature = "vapor")]
#[wasm_bindgen]
pub struct WasmRue;

#[cfg(feature = "vapor")]
#[wasm_bindgen]
#[allow(non_snake_case)]
pub fn createRue(_adapter: JsValue) -> WasmRue {
    WasmRue
}

#[cfg(feature = "vapor")]
fn append_mount_output(container: &JsValue, output: JsValue) {
    if output.is_null() || output.is_undefined() {
        return;
    }

    let Ok(append_child) = Reflect::get(container, &JsValue::from_str("appendChild")) else {
        return;
    };
    let Some(append_child) = append_child.dyn_ref::<Function>() else {
        return;
    };
    let _ = append_child.call1(container, &output);
}

#[cfg(feature = "vapor")]
#[wasm_bindgen]
impl WasmRue {
    /// 保存 Vapor setup 本身作为轻量 mount handle，直到 mount 时再执行。
    #[wasm_bindgen(js_name = "vapor")]
    pub fn vapor_wasm(&self, setup: JsValue) -> JsValue {
        setup
    }

    /// 执行应用 setup，并将 Vapor setup 返回的真实 DOM 节点挂到容器。
    #[wasm_bindgen(js_name = "mount")]
    pub fn mount_wasm(&self, app: JsValue, container: JsValue) {
        let Some(app) = app.dyn_ref::<Function>() else {
            return;
        };
        let props = Object::new();
        let Ok(handle) = app.call1(&JsValue::UNDEFINED, &props) else {
            return;
        };
        let output = match handle.dyn_ref::<Function>() {
            Some(setup) => {
                setup.call1(&JsValue::UNDEFINED, &container).unwrap_or(JsValue::UNDEFINED)
            }
            None => handle,
        };
        append_mount_output(&container, output);
    }
}
