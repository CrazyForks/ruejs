use crate::runtime::dom_adapter::DomAdapter;
use wasm_bindgen::JsValue;

use super::mounted::{MountLifecycleRecord, MountedSubtreeChild};
use super::ComponentProps;

#[derive(Clone)]
pub(crate) enum MountedCompatLifecycleKind {
    Fragment,
    Element,
}

#[derive(Clone)]
pub(crate) enum MountedCompatPatchKind {
    Fragment,
    Element(String),
}

#[derive(Clone)]
pub(crate) struct MountedCompatPatchState<A: DomAdapter> {
    pub kind: Option<MountedCompatPatchKind>,
    pub props: ComponentProps,
    pub children: Vec<MountedSubtreeChild<A>>,
    pub mount_cleanup_bucket: Option<JsValue>,
    pub mount_effect_scope_id: Option<usize>,
}

pub(crate) struct MountedElement<A: DomAdapter> {
    pub tag: String,
    pub key: Option<String>,
    pub host: Option<A::Element>,
    pub props: ComponentProps,
    pub children: Vec<MountedSubtreeChild<A>>,
    pub lifecycle: MountLifecycleRecord,
}

pub(crate) enum MountedCompatRootState<A: DomAdapter> {
    Element(MountedElement<A>),
}

impl<A: DomAdapter> MountedCompatPatchState<A> {
    pub fn new(
        kind: MountedCompatPatchKind,
        props: ComponentProps,
        children: Vec<MountedSubtreeChild<A>>,
        mount_cleanup_bucket: Option<JsValue>,
        mount_effect_scope_id: Option<usize>,
    ) -> Self {
        Self {
            kind: Some(kind),
            props,
            children,
            mount_cleanup_bucket,
            mount_effect_scope_id,
        }
    }

    pub fn empty() -> Self {
        Self {
            kind: None,
            props: ComponentProps::new(),
            children: Vec::new(),
            mount_cleanup_bucket: None,
            mount_effect_scope_id: None,
        }
    }
}