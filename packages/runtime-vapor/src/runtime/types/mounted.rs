/*
Mounted snapshot 类型体系

仅保留默认 Text / Vapor / Component 路径。旧 Element/Fragment patch snapshot 已删除。
*/
use crate::runtime::dom_adapter::DomAdapter;
use wasm_bindgen::JsValue;

use super::{ComponentProps, MountInputType};

#[derive(Clone)]
pub(crate) enum MountLifecycleKind {
    Other,
    Vapor,
    Component,
}

impl MountLifecycleKind {
    pub(crate) fn invokes_mount_owned_resources_before_unmount(&self) -> bool {
        matches!(self, Self::Other | Self::Vapor)
    }

    pub(crate) fn recurses_before_unmount_children(&self) -> bool {
        matches!(self, Self::Component)
    }

    pub(crate) fn invokes_component_before_unmount(&self) -> bool {
        matches!(self, Self::Component)
    }

    pub(crate) fn recurses_unmounted_children(&self) -> bool {
        matches!(self, Self::Component)
    }

    pub(crate) fn invokes_component_unmounted(&self) -> bool {
        matches!(self, Self::Component)
    }
}

#[derive(Clone)]
pub(crate) struct MountLifecycleRecord {
    pub kind: MountLifecycleKind,
    pub cleanup_bucket: Option<JsValue>,
    pub effect_scope_id: Option<usize>,
    pub component_before_unmount_hooks: Vec<JsValue>,
    pub component_unmounted_hooks: Vec<JsValue>,
    pub component_activated_hooks: Vec<JsValue>,
    pub component_deactivated_hooks: Vec<JsValue>,
    pub component_inst_index: Option<usize>,
    pub children: Vec<MountLifecycleRecord>,
}

pub(crate) struct MountedBlock<A: DomAdapter> {
    pub host: Option<A::Element>,
    pub fragment_nodes: Vec<A::Element>,
    pub props: ComponentProps,
    pub lifecycle: MountLifecycleRecord,
}

#[derive(Clone)]
pub(crate) enum MountedPatchSubtreeType {
    Component(JsValue),
}

#[derive(Clone)]
pub(crate) enum MountedVaporSubtreeType {
    Vapor,
    #[allow(dead_code)]
    VaporWithSetup(JsValue),
}

#[derive(Clone)]
pub(crate) struct MountedTextSubtree<A: DomAdapter> {
    pub host: Option<A::Element>,
    pub key: Option<String>,
    pub cleanup_bucket: Option<JsValue>,
    pub effect_scope_id: Option<usize>,
}

#[derive(Clone)]
pub(crate) struct MountedVaporSubtree<A: DomAdapter> {
    pub r#type: MountedVaporSubtreeType,
    pub host: Option<A::Element>,
    pub key: Option<String>,
    pub fragment_nodes: Vec<A::Element>,
    pub props: ComponentProps,
    pub cleanup_bucket: Option<JsValue>,
    pub effect_scope_id: Option<usize>,
}

#[derive(Clone)]
pub(crate) struct MountedPatchSubtree<A: DomAdapter> {
    pub r#type: MountedPatchSubtreeType,
    pub el: Option<A::Element>,
    pub key: Option<String>,
    pub fragment_nodes: Vec<A::Element>,
    pub component_before_unmount_hooks: Vec<JsValue>,
    pub component_unmounted_hooks: Vec<JsValue>,
    pub component_activated_hooks: Vec<JsValue>,
    pub component_deactivated_hooks: Vec<JsValue>,
    pub comp_subtree: Option<Box<MountedSubtreeState<A>>>,
    pub comp_inst_index: Option<usize>,
}

#[derive(Clone)]
pub(crate) enum MountedSubtreeState<A: DomAdapter> {
    Text(MountedTextSubtree<A>),
    Vapor(MountedVaporSubtree<A>),
    Patch(MountedPatchSubtree<A>),
}

pub(crate) struct MountedComponent<A: DomAdapter> {
    pub render_fn: JsValue,
    pub key: Option<String>,
    pub host: Option<A::Element>,
    pub fragment_nodes: Vec<A::Element>,
    pub subtree: Option<Box<MountedSubtreeState<A>>>,
    pub inst_index: Option<usize>,
    pub lifecycle: MountLifecycleRecord,
}

pub(crate) enum MountedState<A: DomAdapter> {
    Block(MountedBlock<A>),
    Component(MountedComponent<A>),
}

pub(crate) struct ContainerMountState<A: DomAdapter> {
    pub container: A::Element,
    pub mounted: Option<MountedState<A>>,
}

pub(crate) struct AnchorMountState<A: DomAdapter> {
    pub anchor: A::Element,
    pub mounted: Option<MountedState<A>>,
}

pub(crate) struct RangeMountState<A: DomAdapter> {
    pub start: A::Element,
    pub end: A::Element,
    pub mounted: Option<MountedState<A>>,
}

/// JS 侧只透传、不解析的 owned mount 句柄身份。
///
/// `slot` 允许运行时复用存储槽，`generation` 则确保复用后旧 token 不会命中新资源。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct OwnedMountToken {
    pub slot: usize,
    pub generation: u64,
}

#[derive(Clone)]
pub(crate) struct PendingComponentMounted<A: DomAdapter> {
    pub owner: OwnedMountToken,
    pub inst_index: usize,
    pub parent_inst_index: Option<usize>,
    pub container: Option<A::Element>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum OwnedMountPhase {
    Building,
    Committed,
}

/// 一个列表行拥有的全部 Rust mounted snapshot。
///
/// anchor/range 分开存储，查找只扫描当前行的局部集合；嵌套列表创建的新 token
/// 记录为 children，使 dispose/abort 能在不扫描全局 map 的情况下递归回收。
pub(crate) struct OwnedMountSlot<A: DomAdapter> {
    pub generation: u64,
    pub phase: OwnedMountPhase,
    pub anchors: Vec<AnchorMountState<A>>,
    pub ranges: Vec<RangeMountState<A>>,
    pub children: Vec<OwnedMountToken>,
    pub pending_mounted: bool,
    pub pending_component_mounted: Vec<PendingComponentMounted<A>>,
}

impl<A: DomAdapter> OwnedMountSlot<A> {
    pub fn new(generation: u64) -> Self {
        Self {
            generation,
            phase: OwnedMountPhase::Building,
            anchors: Vec::new(),
            ranges: Vec::new(),
            children: Vec::new(),
            pending_mounted: false,
            pending_component_mounted: Vec::new(),
        }
    }
}

impl MountedVaporSubtreeType {
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub(crate) fn matches_input_type<A: DomAdapter>(&self, input_type: &MountInputType<A>) -> bool {
        match (self, input_type) {
            (Self::Vapor, MountInputType::Vapor) => true,
            (Self::VaporWithSetup(_), MountInputType::VaporWithSetup(_)) => true,
            _ => false,
        }
    }

    #[cfg(feature = "dev")]
    pub fn debug_name(&self) -> String {
        match self {
            Self::Vapor => "Vapor".to_string(),
            Self::VaporWithSetup(_) => "VaporWithSetup".to_string(),
        }
    }
}

impl<A: DomAdapter> MountedSubtreeState<A>
where
    A::Element: Clone,
{
    pub fn key(&self) -> Option<&String> {
        match self {
            Self::Text(text) => text.key.as_ref(),
            Self::Vapor(vapor) => vapor.key.as_ref(),
            Self::Patch(node) => node.key.as_ref(),
        }
    }

    pub fn host(&self) -> Option<&A::Element> {
        match self {
            Self::Text(text) => text.host.as_ref(),
            Self::Vapor(vapor) => vapor.host.as_ref(),
            Self::Patch(node) => node.el.as_ref(),
        }
    }

    pub fn host_cloned(&self) -> Option<A::Element> {
        self.host().cloned()
    }

    pub fn fragment_nodes(&self) -> &[A::Element] {
        match self {
            Self::Text(_) => &[],
            Self::Vapor(vapor) => vapor.fragment_nodes.as_slice(),
            Self::Patch(node) => node.fragment_nodes.as_slice(),
        }
    }

    pub fn fragment_nodes_cloned(&self) -> Vec<A::Element> {
        self.fragment_nodes().to_vec()
    }

    #[cfg(feature = "dev")]
    pub fn component_render_fn(&self) -> Option<&JsValue> {
        match self {
            Self::Patch(node) => match &node.r#type {
                MountedPatchSubtreeType::Component(render_fn) => Some(render_fn),
            },
            _ => None,
        }
    }

    pub(crate) fn matches_input_type(&self, input_type: &MountInputType<A>) -> bool {
        match self {
            Self::Text(_) => matches!(input_type, MountInputType::Text(_)),
            Self::Vapor(vapor) => vapor.r#type.matches_input_type(input_type),
            Self::Patch(node) => node.matches_input_type(input_type),
        }
    }

    #[cfg(feature = "dev")]
    pub fn debug_type_name(&self) -> String {
        match self {
            Self::Text(_) => "Text".to_string(),
            Self::Vapor(vapor) => vapor.r#type.debug_name(),
            Self::Patch(node) => node.debug_name(),
        }
    }

    pub fn lifecycle_record(&self) -> MountLifecycleRecord {
        match self {
            Self::Text(text) => MountLifecycleRecord {
                kind: MountLifecycleKind::Other,
                cleanup_bucket: text.cleanup_bucket.clone(),
                effect_scope_id: text.effect_scope_id,
                component_before_unmount_hooks: Vec::new(),
                component_unmounted_hooks: Vec::new(),
                component_activated_hooks: Vec::new(),
                component_deactivated_hooks: Vec::new(),
                component_inst_index: None,
                children: Vec::new(),
            },
            Self::Vapor(vapor) => MountLifecycleRecord {
                kind: MountLifecycleKind::Vapor,
                cleanup_bucket: vapor.cleanup_bucket.clone(),
                effect_scope_id: vapor.effect_scope_id,
                component_before_unmount_hooks: Vec::new(),
                component_unmounted_hooks: Vec::new(),
                component_activated_hooks: Vec::new(),
                component_deactivated_hooks: Vec::new(),
                component_inst_index: None,
                children: Vec::new(),
            },
            Self::Patch(node) => node.lifecycle_record(),
        }
    }
}

impl<A: DomAdapter> MountedPatchSubtree<A>
where
    A::Element: Clone,
{
    pub fn new_component(
        render_fn: JsValue,
        el: Option<A::Element>,
        key: Option<String>,
        fragment_nodes: Vec<A::Element>,
        component_before_unmount_hooks: Vec<JsValue>,
        component_unmounted_hooks: Vec<JsValue>,
        component_activated_hooks: Vec<JsValue>,
        component_deactivated_hooks: Vec<JsValue>,
        comp_subtree: Option<Box<MountedSubtreeState<A>>>,
        comp_inst_index: Option<usize>,
    ) -> Self {
        Self {
            r#type: MountedPatchSubtreeType::Component(render_fn),
            el,
            key,
            fragment_nodes,
            component_before_unmount_hooks,
            component_unmounted_hooks,
            component_activated_hooks,
            component_deactivated_hooks,
            comp_subtree,
            comp_inst_index,
        }
    }

    pub fn lifecycle_record(&self) -> MountLifecycleRecord {
        MountLifecycleRecord {
            kind: MountLifecycleKind::Component,
            cleanup_bucket: None,
            effect_scope_id: None,
            component_before_unmount_hooks: self.component_before_unmount_hooks.clone(),
            component_unmounted_hooks: self.component_unmounted_hooks.clone(),
            component_activated_hooks: self.component_activated_hooks.clone(),
            component_deactivated_hooks: self.component_deactivated_hooks.clone(),
            component_inst_index: self.comp_inst_index,
            children: self
                .comp_subtree
                .as_deref()
                .map(|subtree| vec![subtree.lifecycle_record()])
                .unwrap_or_default(),
        }
    }

    pub(crate) fn matches_input_type(&self, input_type: &MountInputType<A>) -> bool {
        match (&self.r#type, input_type) {
            (
                MountedPatchSubtreeType::Component(old_render),
                MountInputType::Component(new_render),
            ) => old_render.eq(new_render),
            (MountedPatchSubtreeType::Component(_), _) => false,
        }
    }

    #[cfg(feature = "dev")]
    pub fn debug_name(&self) -> String {
        match &self.r#type {
            MountedPatchSubtreeType::Component(_) => "Component".to_string(),
        }
    }

    pub fn into_root_state(self) -> MountedState<A> {
        let lifecycle = self.lifecycle_record();
        let MountedPatchSubtreeType::Component(render_fn) = self.r#type;
        MountedState::Component(MountedComponent {
            render_fn,
            key: self.key,
            host: self.el,
            fragment_nodes: self.fragment_nodes,
            subtree: self.comp_subtree,
            inst_index: self.comp_inst_index,
            lifecycle,
        })
    }
}

impl<A: DomAdapter> MountedComponent<A>
where
    A::Element: Clone,
{
    pub fn into_patch_state(self) -> MountedSubtreeState<A> {
        MountedSubtreeState::Patch(MountedPatchSubtree::new_component(
            self.render_fn,
            self.host,
            self.key,
            self.fragment_nodes,
            self.lifecycle.component_before_unmount_hooks,
            self.lifecycle.component_unmounted_hooks,
            self.lifecycle.component_activated_hooks,
            self.lifecycle.component_deactivated_hooks,
            self.subtree,
            self.inst_index,
        ))
    }
}

impl<A: DomAdapter> MountedState<A>
where
    A::Element: Clone,
{
    pub fn into_patch_state(self) -> Option<MountedSubtreeState<A>> {
        match self {
            Self::Component(component) => Some(component.into_patch_state()),
            Self::Block(_) => None,
        }
    }

    pub fn from_subtree_root(subtree: MountedSubtreeState<A>) -> Self {
        match subtree {
            MountedSubtreeState::Text(text) => Self::Block(MountedBlock {
                host: text.host.clone(),
                fragment_nodes: Vec::new(),
                props: ComponentProps::new(),
                lifecycle: MountedSubtreeState::Text(text).lifecycle_record(),
            }),
            MountedSubtreeState::Vapor(vapor) => Self::Block(MountedBlock {
                host: vapor.host.clone(),
                fragment_nodes: vapor.fragment_nodes.clone(),
                props: vapor.props.clone(),
                lifecycle: MountedSubtreeState::Vapor(vapor).lifecycle_record(),
            }),
            MountedSubtreeState::Patch(node) => node.into_root_state(),
        }
    }
}

impl<A: DomAdapter> MountedState<A> {
    pub fn lifecycle_record(&self) -> MountLifecycleRecord {
        match self {
            Self::Block(block) => block.lifecycle.clone(),
            Self::Component(component) => component.lifecycle.clone(),
        }
    }

    pub fn into_dom_identity(
        self,
    ) -> (MountLifecycleRecord, Option<A::Element>, Vec<A::Element>, ComponentProps) {
        match self {
            Self::Block(block) => (block.lifecycle, block.host, block.fragment_nodes, block.props),
            Self::Component(component) => (
                component.lifecycle,
                component.host,
                component.fragment_nodes,
                ComponentProps::new(),
            ),
        }
    }

    pub fn into_lifecycle(self) -> MountLifecycleRecord {
        match self {
            Self::Block(block) => block.lifecycle,
            Self::Component(component) => component.lifecycle,
        }
    }
}

impl<A: DomAdapter> ContainerMountState<A> {
    pub fn new(container: A::Element, mounted: MountedState<A>) -> Self {
        Self { container, mounted: Some(mounted) }
    }

    pub fn take_mount(&mut self) -> Option<MountedState<A>> {
        self.mounted.take()
    }

    pub fn store_mount(&mut self, mounted: MountedState<A>) {
        self.mounted = Some(mounted);
    }

    pub fn clear(&mut self) {
        self.mounted = None;
    }
}

impl<A: DomAdapter> AnchorMountState<A> {
    pub fn new(anchor: A::Element, mounted: MountedState<A>) -> Self {
        Self { anchor, mounted: Some(mounted) }
    }

    pub fn take_mount(&mut self) -> Option<MountedState<A>> {
        self.mounted.take()
    }

    pub fn store_mount(&mut self, mounted: MountedState<A>) {
        self.mounted = Some(mounted);
    }

    #[allow(dead_code)]
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub fn clear(&mut self) {
        self.mounted = None;
    }
}

impl<A: DomAdapter> RangeMountState<A> {
    pub fn new(start: A::Element, end: A::Element, mounted: MountedState<A>) -> Self {
        Self { start, end, mounted: Some(mounted) }
    }

    pub fn take_mount(&mut self) -> Option<MountedState<A>> {
        self.mounted.take()
    }

    pub fn store_mount(&mut self, mounted: MountedState<A>) {
        self.mounted = Some(mounted);
    }

    #[allow(dead_code)]
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub fn clear(&mut self) {
        self.mounted = None;
    }
}
