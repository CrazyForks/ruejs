use super::WasmRue;
use crate::runtime::js_adapter::JsDomAdapter;
use crate::runtime::transport;
use crate::runtime::types::MountInput;
#[cfg(feature = "compat")]
use crate::runtime::types::MountInputChild;
#[cfg(feature = "compat")]
use crate::runtime::vnode_helpers::{
    compat_children_from_value as shared_compat_children_from_value,
    compat_input_from_values as shared_compat_input_from_values,
    compat_object_to_input as shared_compat_object_to_input,
};
#[cfg(feature = "compat")]
use js_sys::Array;
#[cfg(feature = "compat")]
use js_sys::Function;
#[cfg(feature = "compat")]
use js_sys::Object;
#[cfg(feature = "compat")]
use js_sys::Reflect;
#[cfg(feature = "compat")]
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;

#[derive(Clone, Copy)]
pub(super) enum CompatEntryPolicy {
    DefaultSurfaceOnly,
    #[cfg(feature = "compat")]
    LegacyRawElementInput,
}

#[cfg(feature = "compat")]
impl CompatEntryPolicy {
    fn allows_array(self) -> bool {
        matches!(self, Self::DefaultSurfaceOnly) && false
    }

    fn allows_compat_object(self) -> bool {
        matches!(self, Self::LegacyRawElementInput)
    }

    fn allows_raw_element(self) -> bool {
        matches!(self, Self::LegacyRawElementInput)
    }

    fn allows_function_component(self) -> bool {
        matches!(self, Self::DefaultSurfaceOnly) && false
    }
}

impl WasmRue {
    #[cfg(feature = "compat")]
    pub(super) fn compat_children_from_array(
        &self,
        arr: &Array,
        compat_entry_policy: CompatEntryPolicy,
    ) -> Vec<MountInputChild<JsDomAdapter>> {
        self.compat_children_from_value(&JsValue::from(arr.clone()), compat_entry_policy)
    }

    #[cfg(feature = "compat")]
    pub(super) fn compat_children_from_value(
        &self,
        item: &JsValue,
        compat_entry_policy: CompatEntryPolicy,
    ) -> Vec<MountInputChild<JsDomAdapter>> {
        shared_compat_children_from_value::<JsDomAdapter, _>(item, |child_value| {
            self.mount_input_from_input(child_value, compat_entry_policy)
        })
    }

    #[cfg(feature = "compat")]
    fn mount_input_from_array(&self, input_array: &JsValue) -> Option<MountInput<JsDomAdapter>> {
        if !Array::is_array(input_array) {
            return None;
        }

        let source = Object::from(input_array.clone());
        let child_vec = self.compat_children_from_array(
            &Array::from(input_array),
            CompatEntryPolicy::LegacyRawElementInput,
        );
        let mut input = MountInput::new_normalized(
            crate::runtime::types::MountInputType::<JsDomAdapter>::Fragment,
            Default::default(),
            child_vec,
        );
        input.attach_mount_metadata_from_source(&source);

        Some(input)
    }

    #[cfg(feature = "compat")]
    pub(super) fn mount_input_from_function_component(
        &self,
        vnode_id: &JsValue,
    ) -> Option<MountInput<JsDomAdapter>> {
        let func = vnode_id.dyn_ref::<Function>()?.clone();
        Some(MountInput::new_normalized(
            crate::runtime::types::MountInputType::<JsDomAdapter>::Component(func.into()),
            Default::default(),
            Vec::new(),
        ))
    }

    #[cfg(feature = "compat")]
    fn compat_mount_input_from_values(
        &self,
        type_tag: &JsValue,
        props_value: &JsValue,
        children_value: &JsValue,
        fallback_unknown_element: Option<&str>,
        compat_entry_policy: CompatEntryPolicy,
    ) -> Option<MountInput<JsDomAdapter>> {
        shared_compat_input_from_values::<JsDomAdapter, _>(
            type_tag,
            props_value,
            children_value,
            fallback_unknown_element,
            |effective_children| {
                self.compat_children_from_value(effective_children, compat_entry_policy)
            },
        )
    }

    #[cfg(feature = "compat")]
    pub(super) fn compat_mount_input_from_create_element(
        &self,
        type_tag: &JsValue,
        props_value: &JsValue,
        children_value: &JsValue,
    ) -> MountInput<JsDomAdapter> {
        self.compat_mount_input_from_values(
            type_tag,
            props_value,
            children_value,
            Some("div"),
            CompatEntryPolicy::LegacyRawElementInput,
        )
        .expect("createElement compat input should always normalize")
    }

    #[cfg(feature = "compat")]
    fn mount_input_from_raw_element(&self, vnode_id: &JsValue) -> Option<MountInput<JsDomAdapter>> {
        if !vnode_id.is_object() {
            return None;
        }

        let obj = Object::from(vnode_id.clone());
        let node_type =
            Reflect::get(&obj, &JsValue::from_str("nodeType")).unwrap_or(JsValue::UNDEFINED);
        if node_type.as_f64().is_none() {
            return None;
        }

        let inner = self.inner.try_borrow().ok()?;
        Some(transport::element_value_to_vapor_input(&inner, &obj, vnode_id.clone()))
    }

    #[cfg(feature = "compat")]
    fn mount_input_from_compat_object(
        &self,
        input_value: &JsValue,
        compat_entry_policy: CompatEntryPolicy,
    ) -> Option<MountInput<JsDomAdapter>> {
        shared_compat_object_to_input::<JsDomAdapter, _, _>(
            input_value,
            None,
            |type_value| {
                compat_entry_policy.allows_function_component() || !type_value.is_function()
            },
            |effective_children| {
                self.compat_children_from_value(
                    effective_children,
                    CompatEntryPolicy::LegacyRawElementInput,
                )
            },
        )
    }

    fn default_surface_mount_input_from_input(
        &self,
        input_value: &JsValue,
    ) -> Option<MountInput<JsDomAdapter>> {
        if input_value.is_object() {
            let obj = js_sys::Object::from(input_value.clone());
            if let Some(mut input) = transport::default_handle_input(&JsValue::from(obj.clone())) {
                // default_handle_input 会把 JS side 注册过的 mount handle 直接还原成 MountInput，
                // 但这条快路径不会再触发 default_input 那套“从 source object 回填元数据”的流程。
                // 对普通 handle 来说这通常无害；对 raw vapor handle 来说则会丢掉
                // __rue_cleanup_bucket / __rue_effect_scope_id 这两类只存在于 source object 上的卸载元数据。
                // 一旦这里漏掉，后面的 mounted lifecycle record 只能拿到 vapor subtree 自己的 scope，
                // 却看不到 JS owner cleanup bucket 和 hook scope，对应的 useSetup/watchEffect 就会在
                // renderAnchor 分支切走后继续存活，形成“隐藏分支还在响应”的泄漏。
                //
                // 不能简单把 object handle 统一改走 default_input：那条路需要额外 borrow inner runtime，
                // 在某些嵌套 render / renderAnchor 时机下更容易放大借用冲突。这里保留原有快路径，
                // 只把 source object 上的 mount metadata 显式补回 MountInput，既保住性能/借用行为，
                // 也确保卸载链能看到完整的 cleanup 信息。
                input.attach_mount_metadata_from_source(&obj);
                return Some(input);
            }

            if let Some(input) = transport::portable_object_input::<JsDomAdapter>(&obj) {
                return Some(input);
            }

            let inner = self.inner.try_borrow().ok()?;
            if let Some(input) = transport::default_input(&inner, input_value) {
                return Some(input);
            }

            return None;
        }

        if let Some(input) = transport::default_handle_input(input_value) {
            return Some(input);
        }

        None
    }

    #[cfg(feature = "compat")]
    fn compat_extension_mount_input_from_input(
        &self,
        input_value: &JsValue,
        compat_entry_policy: CompatEntryPolicy,
    ) -> Option<MountInput<JsDomAdapter>> {
        if compat_entry_policy.allows_array() {
            if let Some(input) = self.mount_input_from_array(input_value) {
                return Some(input);
            }
        }

        if compat_entry_policy.allows_function_component() {
            if let Some(input) = self.mount_input_from_function_component(input_value) {
                return Some(input);
            }
        }

        if compat_entry_policy.allows_raw_element() && input_value.is_object() {
            if let Some(input) = self.mount_input_from_raw_element(input_value) {
                return Some(input);
            }
        }

        if compat_entry_policy.allows_compat_object() {
            if let Some(input) =
                self.mount_input_from_compat_object(input_value, compat_entry_policy)
            {
                return Some(input);
            }
        }

        None
    }

    #[cfg(feature = "compat")]
    pub(super) fn mount_input_from_input(
        &self,
        input_value: &JsValue,
        compat_entry_policy: CompatEntryPolicy,
    ) -> Option<MountInput<JsDomAdapter>> {
        self.default_surface_mount_input_from_input(input_value).or_else(|| {
            self.compat_extension_mount_input_from_input(input_value, compat_entry_policy)
        })
    }

    #[cfg(not(feature = "compat"))]
    pub(super) fn mount_input_from_input(
        &self,
        input_value: &JsValue,
        _compat_entry_policy: CompatEntryPolicy,
    ) -> Option<MountInput<JsDomAdapter>> {
        self.default_surface_mount_input_from_input(input_value)
    }
}

#[cfg(test)]
#[path = "input_tests.rs"]
mod tests;
