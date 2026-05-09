/*
运行时输入与 compat 类型体系
---------------------------
默认主路径现在围绕 MountInput 组织：
- MountInputType：默认挂载协议的节点语义（文本、片段、元素、组件、Vapor）
- MountInput：默认调度/挂载/bridge 运输的数据货币
- MountInputChild：默认 children 形状，文本直接保留为文本，不再要求先包装成额外树节点

types.rs 现在只保留默认输入协议与公共别名；mounted/lifecycle 内部状态已下沉到 runtime/types/mounted.rs。
默认运行时不再把历史树对象契约当作并列数据货币。

关键点：
- el_hint: MountInput 可携带宿主提示节点，供 Vapor/host-node bridge 直接复用
- key: 仍用于 keyed 更新稳定性判断
- FRAGMENT 常量：JS 桥接时用于识别片段构造
*/
use crate::runtime::dom_adapter::DomAdapter;
use js_sys::{Array, Object, Reflect};
use std::collections::HashMap;
use std::marker::PhantomData;
use wasm_bindgen::JsValue;

#[cfg(feature = "compat")]
mod compat_lifecycle;
#[cfg(feature = "compat")]
mod compat_patch_root;
#[cfg(feature = "compat")]
pub(super) mod compat_state;
#[cfg(feature = "compat")]
mod compat_subtree;
mod mounted;

#[cfg(feature = "compat")]
pub(crate) use mounted::MountedSubtreeChild;
pub(crate) use mounted::{
    AnchorMountState, ContainerMountState, MountLifecycleRecord, MountedPatchSubtree,
    MountedPatchSubtreeType, MountedState, MountedSubtreeState, MountedTextSubtree,
    MountedVaporSubtree, MountedVaporSubtreeType, RangeMountState,
};

pub type ComponentProps = HashMap<String, JsValue>;
pub type PropsWithChildren = ComponentProps;

#[derive(Clone)]
pub enum MountInputType<A: DomAdapter> {
    Text(String),
    #[cfg(feature = "compat")]
    Fragment,
    Vapor,
    VaporWithSetup(JsValue),
    #[cfg(feature = "compat")]
    Element(String),
    Component(JsValue),
    _Phantom(PhantomData<A>),
}

#[derive(Clone)]
pub enum MountInputChild<A: DomAdapter> {
    Input(MountInput<A>),
    Text(String),
}

#[derive(Clone)]
pub struct MountInput<A: DomAdapter> {
    pub r#type: MountInputType<A>,
    pub props: ComponentProps,
    pub children: Vec<MountInputChild<A>>,
    pub key: Option<String>,
    pub strict_component_returns: bool,
    pub mount_cleanup_bucket: Option<JsValue>,
    pub mount_effect_scope_id: Option<usize>,
    pub el_hint: Option<A::Element>,
}

pub type FC<A> = fn(PropsWithChildren) -> MountInput<A>;
pub const FRAGMENT: &str = "fragment";

impl<A: DomAdapter> MountInputType<A> {
    #[cfg(feature = "dev")]
    pub(crate) fn debug_name(&self) -> String {
        match self {
            Self::Text(_) => "Text".to_string(),
            #[cfg(feature = "compat")]
            Self::Fragment => "Fragment".to_string(),
            Self::Vapor => "Vapor".to_string(),
            Self::VaporWithSetup(_) => "VaporWithSetup".to_string(),
            #[cfg(feature = "compat")]
            Self::Element(tag) => format!("Element({})", tag),
            Self::Component(_) => "Component".to_string(),
            Self::_Phantom(_) => "_Phantom".to_string(),
        }
    }
}

impl<A: DomAdapter> MountInput<A> {
    /// 构造规范化后的默认挂载输入。
    ///
    /// 这层与旧的 compat `create_element` 做同样的收口工作，但结果直接落成
    /// `MountInput`：
    /// - 提取 `key`
    /// - 把挂载元信息从 props 中剥离到专用字段
    /// - 保留已经归一化好的 children
    pub(crate) fn new_normalized(
        r#type: MountInputType<A>,
        mut props: ComponentProps,
        children: Vec<MountInputChild<A>>,
    ) -> Self {
        let mount_cleanup_bucket =
            props.get("__rue_cleanup_bucket").cloned().filter(|value| Array::is_array(value));
        if mount_cleanup_bucket.is_some() {
            props.remove("__rue_cleanup_bucket");
        }

        let mount_effect_scope_id = props
            .get("__rue_effect_scope_id")
            .and_then(|value| value.as_f64().map(|scope_id| scope_id as usize));
        if mount_effect_scope_id.is_some() {
            props.remove("__rue_effect_scope_id");
        }

        let key = props.get("key").and_then(|value| {
            if let Some(text) = value.as_string() {
                Some(text)
            } else {
                value.as_f64().map(|number| number.to_string())
            }
        });

        Self {
            r#type,
            props,
            children,
            key,
            strict_component_returns: false,
            mount_cleanup_bucket,
            mount_effect_scope_id,
            el_hint: None,
        }
    }
}

impl<A: DomAdapter> MountInput<A>
where
    A::Element: Clone,
{
    /// 从 bridge/source 对象同步挂载元信息。
    ///
    /// 默认主路径不再把 cleanup/effect scope 藏在历史树对象里运输，
    /// 但这些挂载元信息仍要跟随 MountInput 一起进入调度与卸载边界。
    pub fn attach_mount_metadata_from_source(&mut self, source: &Object) {
        let key = Reflect::get(source, &JsValue::from_str("key")).unwrap_or(JsValue::UNDEFINED);
        if !key.is_undefined() && !key.is_null() {
            self.key = key.as_string().or_else(|| key.as_f64().map(|number| number.to_string()));
        }

        let cleanup_bucket = Reflect::get(source, &JsValue::from_str("__rue_cleanup_bucket"))
            .unwrap_or(JsValue::UNDEFINED);
        if Array::is_array(&cleanup_bucket) {
            self.mount_cleanup_bucket = Some(cleanup_bucket);
        }

        let scope_id = Reflect::get(source, &JsValue::from_str("__rue_effect_scope_id"))
            .unwrap_or(JsValue::UNDEFINED);
        self.mount_effect_scope_id = scope_id.as_f64().map(|scope_id| scope_id as usize);
    }
}
