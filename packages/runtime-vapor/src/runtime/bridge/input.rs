/*
Bridge 输入规范化

负责把 JS 传入的默认协议值转成 MountInput：
- tagged mount handle
- portable component / vapor handle

旧对象树、raw DOM node、raw array 入口已经移除。
*/
use super::WasmRue;
use crate::runtime::Rue;
use crate::runtime::input_props::{
    children_from_value as shared_children_from_value,
    input_from_values as shared_input_from_values,
};
use crate::runtime::js_adapter::JsDomAdapter;
use crate::runtime::transport;
use crate::runtime::types::{MountInput, MountInputChild};
use std::cell::Ref;
use wasm_bindgen::JsValue;

#[derive(Clone, Copy)]
pub(super) enum InputEntryPolicy {
    DefaultSurfaceOnly,
}

#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
fn try_borrow_runtime(rue: &WasmRue) -> Option<Ref<'_, Rue<JsDomAdapter>>> {
    rue.inner.try_borrow().ok()
}

impl WasmRue {
    pub(super) fn children_from_value(&self, item: &JsValue) -> Vec<MountInputChild<JsDomAdapter>> {
        shared_children_from_value::<JsDomAdapter, _>(item, |child_value| {
            self.mount_input_from_input(child_value, InputEntryPolicy::DefaultSurfaceOnly)
        })
    }

    fn mount_input_from_values(
        &self,
        type_tag: &JsValue,
        props_value: &JsValue,
        children_value: &JsValue,
        fallback_unknown_element: Option<&str>,
    ) -> Option<MountInput<JsDomAdapter>> {
        shared_input_from_values::<JsDomAdapter, _>(
            type_tag,
            props_value,
            children_value,
            fallback_unknown_element,
            |effective_children| self.children_from_value(effective_children),
        )
    }

    pub(super) fn create_element_input_from_values(
        &self,
        type_tag: &JsValue,
        props_value: &JsValue,
        children_value: &JsValue,
    ) -> MountInput<JsDomAdapter> {
        self.mount_input_from_values(type_tag, props_value, children_value, Some("div"))
            .expect("createElement input should always normalize")
    }

    fn default_surface_mount_input_from_input(
        &self,
        input_value: &JsValue,
    ) -> Option<MountInput<JsDomAdapter>> {
        if input_value.is_object() {
            let obj = js_sys::Object::from(input_value.clone());
            // 第一优先级是默认 mount handle：它已经是编译/bridge 侧规范化后的输入，
            // 消费成本最低，也能避免把 handle 对象误判成 portable object。
            if let Some(mut input) = transport::default_handle_input(&JsValue::from(obj.clone())) {
                input.attach_mount_metadata_from_source(&obj);
                return Some(input);
            }

            if let Some(input) = transport::portable_object_input::<JsDomAdapter>(&obj) {
                return Some(input);
            }

            if let Some(input) = self.default_surface_default_input(input_value) {
                return Some(input);
            }

            return None;
        }

        if let Some(input) = transport::default_handle_input(input_value) {
            return Some(input);
        }

        None
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn default_surface_default_input(
        &self,
        input_value: &JsValue,
    ) -> Option<MountInput<JsDomAdapter>> {
        let inner = try_borrow_runtime(self)?;
        transport::default_input(&inner, input_value)
    }

    pub(super) fn mount_input_from_input(
        &self,
        input_value: &JsValue,
        _entry_policy: InputEntryPolicy,
    ) -> Option<MountInput<JsDomAdapter>> {
        self.default_surface_mount_input_from_input(input_value)
    }
}
