use super::super::WasmRue;
use crate::runtime::js_adapter::JsDomAdapter;
use crate::runtime::transport::DefaultMountHandleStorePolicy;
use crate::runtime::types::{ComponentProps, MountInput, MountInputType};
use js_sys::Function;
use wasm_bindgen::JsValue;

pub(super) fn create_function_component_out(
    _this: &WasmRue,
    func: Function,
    props_map: ComponentProps,
    strict_component_returns: bool,
) -> JsValue {
    let mut input = MountInput::new_normalized(
        MountInputType::<JsDomAdapter>::Component(func.clone().into()),
        props_map,
        Vec::new(),
    );
    input.strict_component_returns = strict_component_returns;
    crate::runtime::transport::store_default_mount_input(
        input,
        DefaultMountHandleStorePolicy::Append,
    )
    .value
}
