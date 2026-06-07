/*
Bridge 输入规范化

负责把 JS 传入的各种入口值转成默认 MountInput：
- 默认主路径：tagged mount handle、portable component/vapor handle、host-node bridge
- compat 路径：兼容旧 createElement/vnode/raw DOM node 输入

这一层的关键价值是“收口”：render/renderAnchor/renderBetween 等 API 后续只处理 MountInput，
不再关心 JS 侧输入到底来自编译产物、手写调用还是旧兼容协议。
*/
use super::WasmRue;
#[cfg(any(feature = "compat", feature = "runtime"))]
use crate::runtime::Rue;
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
use js_sys::Object;
#[cfg(feature = "compat")]
use js_sys::Reflect;
#[cfg(any(feature = "compat", feature = "runtime"))]
use std::cell::Ref;
use wasm_bindgen::JsValue;

#[derive(Clone, Copy)]
pub(super) enum CompatEntryPolicy {
    DefaultSurfaceOnly,
    #[cfg(feature = "compat")]
    LegacyRawElementInput,
}

#[cfg(feature = "compat")]
impl CompatEntryPolicy {
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn allows_compat_object(self) -> bool {
        matches!(self, Self::LegacyRawElementInput)
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn allows_raw_element(self) -> bool {
        matches!(self, Self::LegacyRawElementInput)
    }
}

#[cfg(any(feature = "compat", feature = "runtime"))]
#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
fn try_borrow_runtime(rue: &WasmRue) -> Option<Ref<'_, Rue<JsDomAdapter>>> {
    rue.inner.try_borrow().ok()
}

impl WasmRue {
    #[cfg(feature = "compat")]
    pub(super) fn compat_children_from_value(
        &self,
        item: &JsValue,
        compat_entry_policy: CompatEntryPolicy,
    ) -> Vec<MountInputChild<JsDomAdapter>> {
        // 子节点解析会递归回到 mount_input_from_input，这样嵌套 vnode/raw node/handle
        // 都能复用同一套入口策略，而不是在 children 分支里另写一套解析器。
        shared_compat_children_from_value::<JsDomAdapter, _>(item, |child_value| {
            self.mount_input_from_input(child_value, compat_entry_policy)
        })
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
    fn mount_input_from_raw_element(
        &self,
        obj: &Object,
        vnode_id: &JsValue,
    ) -> Option<MountInput<JsDomAdapter>> {
        let node_type =
            Reflect::get(obj, &JsValue::from_str("nodeType")).unwrap_or(JsValue::UNDEFINED);
        if node_type.as_f64().is_none() {
            return None;
        }

        // raw DOM node 需要读取 adapter 判断 fragment children，因此这里短暂只读借用 inner。
        // 若当前正处于可变借用重入，直接放弃该 compat 路径，避免 borrow panic。
        self.raw_element_input_with_runtime(obj, vnode_id)
    }

    #[cfg(feature = "compat")]
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn raw_element_input_with_runtime(
        &self,
        obj: &Object,
        vnode_id: &JsValue,
    ) -> Option<MountInput<JsDomAdapter>> {
        let inner = try_borrow_runtime(self)?;
        Some(transport::element_value_to_vapor_input(&inner, obj, vnode_id.clone()))
    }

    #[cfg(feature = "compat")]
    fn mount_input_from_compat_object(
        &self,
        input_value: &JsValue,
    ) -> Option<MountInput<JsDomAdapter>> {
        shared_compat_object_to_input::<JsDomAdapter, _, _>(
            input_value,
            None,
            |type_value| !type_value.is_function(),
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
            // 第一优先级是默认 mount handle：它已经是编译/bridge 侧规范化后的输入，
            // 消费成本最低，也能避免把 handle 对象误判成 portable/compat vnode。
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

            // 最后才借用 runtime 去解析 host-node bridge，因为这条路径需要 adapter 信息，
            // 在重入场景下也最容易碰到 borrow 冲突。
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

    #[cfg(feature = "compat")]
    fn compat_extension_mount_input_from_input(
        &self,
        input_value: &JsValue,
        compat_entry_policy: CompatEntryPolicy,
    ) -> Option<MountInput<JsDomAdapter>> {
        // compat 扩展只在明确允许的入口打开。默认 render/renderBetween 不吃旧 vnode，
        // renderAnchor 在 compat 构建下会放宽，以支持历史锚点桥接路径。
        if compat_entry_policy.allows_raw_element() && input_value.is_object() {
            let obj = Object::from(input_value.clone());
            if let Some(input) = self.mount_input_from_raw_element(&obj, input_value) {
                return Some(input);
            }
        }

        if compat_entry_policy.allows_compat_object() {
            if let Some(input) = self.mount_input_from_compat_object(input_value) {
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
        // 先走默认协议，确保新编译产物与 portable handle 不会被 compat 逻辑误解析。
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
