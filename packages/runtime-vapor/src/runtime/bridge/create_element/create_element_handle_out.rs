use super::super::WasmRue;
use crate::runtime::transport::DefaultMountHandleStorePolicy;
use crate::runtime::js_adapter::JsDomAdapter;
use crate::runtime::types::{ComponentProps, MountInput, MountInputType};
use js_sys::Function;
use wasm_bindgen::JsValue;

pub(super) fn create_function_component_out(
    _this: &WasmRue,
    func: Function,
    props_map: ComponentProps,
) -> JsValue {
    let input = MountInput::new_normalized(
        MountInputType::<JsDomAdapter>::Component(func.clone().into()),
        props_map,
        Vec::new(),
    );
    crate::runtime::transport::store_default_mount_input(input, DefaultMountHandleStorePolicy::Append)
        .value
}
