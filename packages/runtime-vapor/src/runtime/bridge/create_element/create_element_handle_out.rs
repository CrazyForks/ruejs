/*
createElement 输出辅助

负责把已经规范化的 Component/Element MountInput 写入默认输入注册表，
并返回 JS 侧可继续传递的 mount handle。
*/
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
