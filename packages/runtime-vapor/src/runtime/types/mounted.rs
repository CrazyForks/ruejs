use crate::runtime::dom_adapter::DomAdapter;
use wasm_bindgen::JsValue;

#[cfg(feature = "compat")]
use super::ComponentProps;
use super::MountInputType;
#[cfg(feature = "compat")]
use super::compat_state::{
    MountedCompatLifecycleKind, MountedCompatPatchKind, MountedCompatPatchState,
    MountedCompatRootState,
};
#[cfg(feature = "compat")]
use super::{compat_lifecycle, compat_patch_root, compat_subtree};

#[derive(Clone)]
pub(crate) enum MountLifecycleKind {
    Other,
    Vapor,
    #[cfg(feature = "compat")]
    Compat(MountedCompatLifecycleKind),
    Component,
}

impl MountLifecycleKind {
    pub(crate) fn invokes_mount_owned_resources_before_unmount(&self) -> bool {
        match self {
            Self::Other | Self::Vapor => true,
            Self::Component => false,
            #[cfg(feature = "compat")]
            Self::Compat(kind) => {
                compat_lifecycle::lifecycle_invokes_mount_owned_resources_before_unmount(kind)
            }
        }
    }

    pub(crate) fn recurses_before_unmount_children(&self) -> bool {
        match self {
            Self::Component => true,
            Self::Other | Self::Vapor => false,
            #[cfg(feature = "compat")]
            Self::Compat(kind) => {
                compat_lifecycle::lifecycle_recurses_before_unmount_children(kind)
            }
        }
    }

    pub(crate) fn invokes_component_before_unmount(&self) -> bool {
        matches!(self, Self::Component)
    }

    pub(crate) fn recurses_unmounted_children(&self) -> bool {
        match self {
            Self::Component => true,
            Self::Other | Self::Vapor => false,
            #[cfg(feature = "compat")]
            Self::Compat(kind) => compat_lifecycle::lifecycle_recurses_unmounted_children(kind),
        }
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
    pub component_inst_index: Option<usize>,
    pub children: Vec<MountLifecycleRecord>,
}

pub(crate) struct MountedBlock<A: DomAdapter> {
    pub host: Option<A::Element>,
    pub fragment_nodes: Vec<A::Element>,
    pub lifecycle: MountLifecycleRecord,
}

#[derive(Clone)]
pub(crate) enum MountedPatchSubtreeType {
    #[cfg(feature = "compat")]
    Compat,
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
    pub cleanup_bucket: Option<JsValue>,
    pub effect_scope_id: Option<usize>,
}

#[derive(Clone)]
pub(crate) struct MountedPatchSubtree<A: DomAdapter> {
    pub r#type: MountedPatchSubtreeType,
    #[cfg(feature = "compat")]
    pub compat: MountedCompatPatchState<A>,
    pub el: Option<A::Element>,
    pub key: Option<String>,
    pub fragment_nodes: Vec<A::Element>,
    pub component_before_unmount_hooks: Vec<JsValue>,
    pub component_unmounted_hooks: Vec<JsValue>,
    pub comp_subtree: Option<Box<MountedSubtreeState<A>>>,
    pub comp_inst_index: Option<usize>,
}

#[cfg(feature = "compat")]
#[derive(Clone)]
#[allow(dead_code)]
pub(crate) enum MountedSubtreeChild<A: DomAdapter> {
    Subtree(MountedSubtreeState<A>),
    Text(String),
    Bool(bool),
    Null,
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
    #[cfg(feature = "compat")]
    Compat(MountedCompatRootState<A>),
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

impl MountedPatchSubtreeType {
    #[cfg(not(feature = "compat"))]
    pub(crate) fn matches_input_type<A: DomAdapter>(&self, input_type: &MountInputType<A>) -> bool {
        match (self, input_type) {
            (Self::Component(old_render), MountInputType::Component(new_render)) => {
                old_render.eq(new_render)
            }
            (Self::Component(_), _) => false,
        }
    }

    #[cfg(not(feature = "compat"))]
    #[cfg(feature = "dev")]
    pub fn debug_name(&self) -> String {
        match self {
            Self::Component(_) => "Component".to_string(),
        }
    }
}

impl MountedVaporSubtreeType {
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

#[cfg(feature = "compat")]
impl<A: DomAdapter> MountedSubtreeChild<A>
where
    A::Element: Clone,
{
    pub fn lifecycle_record(&self) -> Option<MountLifecycleRecord> {
        match self {
            Self::Subtree(subtree) => Some(subtree.lifecycle_record()),
            Self::Text(_) | Self::Bool(_) | Self::Null => None,
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
            #[cfg(not(feature = "compat"))]
            Self::Patch(node) => match &node.r#type {
                MountedPatchSubtreeType::Component(render_fn) => Some(render_fn),
            },
            #[cfg(feature = "compat")]
            Self::Patch(node) => match &node.r#type {
                MountedPatchSubtreeType::Component(render_fn) => Some(render_fn),
                MountedPatchSubtreeType::Compat => None,
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
                component_inst_index: None,
                children: Vec::new(),
            },
            Self::Vapor(vapor) => MountLifecycleRecord {
                kind: MountLifecycleKind::Vapor,
                cleanup_bucket: vapor.cleanup_bucket.clone(),
                effect_scope_id: vapor.effect_scope_id,
                component_before_unmount_hooks: Vec::new(),
                component_unmounted_hooks: Vec::new(),
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
    fn component_lifecycle_record(&self) -> MountLifecycleRecord {
        MountLifecycleRecord {
            kind: MountLifecycleKind::Component,
            cleanup_bucket: None,
            effect_scope_id: None,
            component_before_unmount_hooks: self.component_before_unmount_hooks.clone(),
            component_unmounted_hooks: self.component_unmounted_hooks.clone(),
            component_inst_index: self.comp_inst_index,
            children: self
                .comp_subtree
                .as_deref()
                .map(|subtree| vec![subtree.lifecycle_record()])
                .unwrap_or_default(),
        }
    }

    #[cfg(feature = "compat")]
    pub fn new_compat(
        kind: MountedCompatPatchKind,
        props: ComponentProps,
        children: Vec<MountedSubtreeChild<A>>,
        el: Option<A::Element>,
        key: Option<String>,
        fragment_nodes: Vec<A::Element>,
        mount_cleanup_bucket: Option<JsValue>,
        mount_effect_scope_id: Option<usize>,
    ) -> Self {
        Self {
            r#type: MountedPatchSubtreeType::Compat,
            compat: MountedCompatPatchState::new(
                kind,
                props,
                children,
                mount_cleanup_bucket,
                mount_effect_scope_id,
            ),
            el,
            key,
            fragment_nodes,
            component_before_unmount_hooks: Vec::new(),
            component_unmounted_hooks: Vec::new(),
            comp_subtree: None,
            comp_inst_index: None,
        }
    }

    pub fn new_component(
        render_fn: JsValue,
        el: Option<A::Element>,
        key: Option<String>,
        fragment_nodes: Vec<A::Element>,
        component_before_unmount_hooks: Vec<JsValue>,
        component_unmounted_hooks: Vec<JsValue>,
        comp_subtree: Option<Box<MountedSubtreeState<A>>>,
        comp_inst_index: Option<usize>,
    ) -> Self {
        Self {
            r#type: MountedPatchSubtreeType::Component(render_fn),
            #[cfg(feature = "compat")]
            compat: MountedCompatPatchState::empty(),
            el,
            key,
            fragment_nodes,
            component_before_unmount_hooks,
            component_unmounted_hooks,
            comp_subtree,
            comp_inst_index,
        }
    }

    #[cfg(not(feature = "compat"))]
    pub fn lifecycle_record(&self) -> MountLifecycleRecord {
        self.component_lifecycle_record()
    }

    fn into_component_root_state(self, lifecycle: MountLifecycleRecord) -> MountedState<A> {
        match self.r#type {
            MountedPatchSubtreeType::Component(render_fn) => {
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
            #[cfg(feature = "compat")]
            MountedPatchSubtreeType::Compat => {
                unreachable!("compat patch roots must be handled by compat_root_state")
            }
        }
    }

    pub fn into_root_state(self) -> MountedState<A> {
        let lifecycle = self.lifecycle_record();
        #[cfg(feature = "compat")]
        if let Some(kind) = compat_patch_root::patch_root_kind(&self) {
            return compat_patch_root::into_patch_root_state(self, kind, lifecycle);
        }

        self.into_component_root_state(lifecycle)
    }

    #[cfg(feature = "compat")]
    pub fn lifecycle_record(&self) -> MountLifecycleRecord {
        if let Some(record) = compat_lifecycle::patch_lifecycle_record(self) {
            return record;
        }

        self.component_lifecycle_record()
    }

    #[cfg(feature = "compat")]
    pub(crate) fn matches_input_type(&self, input_type: &MountInputType<A>) -> bool {
        compat_subtree::patch_subtree_matches_input_type(self, input_type)
    }

    #[cfg(not(feature = "compat"))]
    pub(crate) fn matches_input_type(&self, input_type: &MountInputType<A>) -> bool {
        self.r#type.matches_input_type(input_type)
    }

    #[cfg(feature = "compat")]
    #[cfg(feature = "dev")]
    pub fn debug_name(&self) -> String {
        compat_subtree::patch_subtree_debug_name(self)
    }

    #[cfg(not(feature = "compat"))]
    #[cfg(feature = "dev")]
    pub fn debug_name(&self) -> String {
        self.r#type.debug_name()
    }

    #[cfg(feature = "compat")]
    pub fn compat_props(&self) -> &ComponentProps {
        &self.compat.props
    }

    #[cfg(feature = "compat")]
    pub fn compat_kind(&self) -> Option<&MountedCompatPatchKind> {
        self.compat.kind.as_ref()
    }

    #[cfg(feature = "compat")]
    pub fn compat_children_mut(&mut self) -> &mut [MountedSubtreeChild<A>] {
        self.compat.children.as_mut_slice()
    }

    #[cfg(feature = "compat")]
    pub fn replace_compat_patch_inputs(
        &mut self,
        props: ComponentProps,
        children: Vec<MountedSubtreeChild<A>>,
    ) {
        self.compat.props = props;
        self.compat.children = children;
    }

    #[cfg(feature = "compat")]
    pub fn set_compat_mount_metadata(
        &mut self,
        cleanup_bucket: Option<JsValue>,
        effect_scope_id: Option<usize>,
    ) {
        self.compat.mount_cleanup_bucket = cleanup_bucket;
        self.compat.mount_effect_scope_id = effect_scope_id;
    }

    #[cfg(feature = "compat")]
    pub fn set_compat_patch_kind(&mut self, kind: MountedCompatPatchKind) {
        self.compat.kind = Some(kind);
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
            self.subtree,
            self.inst_index,
        ))
    }
}

impl<A: DomAdapter> MountedState<A>
where
    A::Element: Clone,
{
    #[cfg(not(feature = "compat"))]
    pub fn into_patch_state(self) -> Option<MountedSubtreeState<A>> {
        match self {
            Self::Component(component) => Some(component.into_patch_state()),
            Self::Block(_) => None,
        }
    }

    #[cfg(feature = "compat")]
    pub fn into_patch_state(self) -> Option<MountedSubtreeState<A>> {
        match self {
            Self::Compat(root) => Some(compat_patch_root::compat_root_into_patch_state(root)),
            Self::Component(component) => Some(component.into_patch_state()),
            Self::Block(_) => None,
        }
    }

    pub fn from_subtree_root(subtree: MountedSubtreeState<A>) -> Self {
        match subtree {
            MountedSubtreeState::Text(text) => Self::Block(MountedBlock {
                host: text.host.clone(),
                fragment_nodes: Vec::new(),
                lifecycle: MountedSubtreeState::Text(text).lifecycle_record(),
            }),
            MountedSubtreeState::Vapor(vapor) => Self::Block(MountedBlock {
                host: vapor.host.clone(),
                fragment_nodes: vapor.fragment_nodes.clone(),
                lifecycle: MountedSubtreeState::Vapor(vapor).lifecycle_record(),
            }),
            MountedSubtreeState::Patch(node) => node.into_root_state(),
        }
    }
}

impl<A: DomAdapter> MountedState<A> {
    pub fn into_dom_identity(self) -> (MountLifecycleRecord, Option<A::Element>, Vec<A::Element>) {
        match self {
            Self::Block(block) => (block.lifecycle, block.host, block.fragment_nodes),
            #[cfg(feature = "compat")]
            Self::Compat(root) => compat_patch_root::compat_root_into_dom_identity(root),
            Self::Component(component) => {
                (component.lifecycle, component.host, component.fragment_nodes)
            }
        }
    }

    #[cfg(not(feature = "compat"))]
    pub fn into_lifecycle(self) -> MountLifecycleRecord {
        match self {
            Self::Block(block) => block.lifecycle,
            Self::Component(component) => component.lifecycle,
        }
    }

    #[cfg(feature = "compat")]
    pub fn into_lifecycle(self) -> MountLifecycleRecord {
        match self {
            Self::Block(block) => block.lifecycle,
            Self::Compat(root) => compat_patch_root::compat_root_into_lifecycle(root),
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
    pub fn clear(&mut self) {
        self.mounted = None;
    }
}
