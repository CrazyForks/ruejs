use super::globals::MOUNT_INPUT_REGISTRY;
use super::vnode_helpers::props_from_value as shared_props_from_value;
use super::{
    ComponentProps, DomAdapter, JsDomAdapter, MountInput, MountInputChild, MountInputType, Rue,
};
use js_sys::{Function, Object, Reflect};
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;

pub(crate) const DEFAULT_MOUNT_HANDLE_KEY: &str = "__rue_mount_id";

#[derive(Clone, Copy)]
pub(crate) enum DefaultMountHandleStorePolicy {
    ReuseEmptySlot,
    Append,
}

pub(crate) struct DefaultMountHandle {
    #[cfg_attr(not(all(feature = "compat", feature = "dev")), allow(dead_code))]
    pub(crate) id: u32,
    pub(crate) value: JsValue,
}

fn allocate_default_mount_handle_id(
    store_policy: DefaultMountHandleStorePolicy,
    pending_input: &mut Option<MountInput<JsDomAdapter>>,
) -> u32 {
    MOUNT_INPUT_REGISTRY.with(|reg| {
        let mut registry = reg.borrow_mut();
        match store_policy {
            DefaultMountHandleStorePolicy::ReuseEmptySlot => {
                for (idx, slot) in registry.iter_mut().enumerate() {
                    if slot.is_none() {
                        *slot = pending_input.take();
                        return idx as u32;
                    }
                }
            }
            DefaultMountHandleStorePolicy::Append => {}
        }

        registry.push(pending_input.take());
        (registry.len() - 1) as u32
    })
}

fn default_mount_handle_object_value(id: u32, key: Option<&str>) -> JsValue {
    let obj = Object::new();
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str(DEFAULT_MOUNT_HANDLE_KEY),
        &JsValue::from_f64(id as f64),
    );
    if let Some(key) = key {
        let _ = Reflect::set(&obj, &JsValue::from_str("key"), &JsValue::from_str(key));
    }
    obj.into()
}

pub(crate) fn store_default_mount_input(
    input: MountInput<JsDomAdapter>,
    store_policy: DefaultMountHandleStorePolicy,
) -> DefaultMountHandle {
    let key = input.key.clone();
    let mut pending_input = Some(input);
    let id = allocate_default_mount_handle_id(store_policy, &mut pending_input);

    DefaultMountHandle { id, value: default_mount_handle_object_value(id, key.as_deref()) }
}

fn default_mount_handle_value_from_input(input_value: &JsValue) -> Option<JsValue> {
    if input_value.as_f64().is_some() {
        Some(input_value.clone())
    } else if let Some(text) = input_value.as_string() {
        Some(JsValue::from_f64(text.parse::<f64>().ok()?))
    } else if input_value.is_object() {
        let obj = Object::from(input_value.clone());
        let handle_value = Reflect::get(&obj, &JsValue::from_str(DEFAULT_MOUNT_HANDLE_KEY))
            .unwrap_or(JsValue::UNDEFINED);
        if handle_value.is_undefined() { None } else { Some(handle_value) }
    } else {
        None
    }
}

fn default_mount_handle_index(input_value: &JsValue) -> Option<usize> {
    Some(default_mount_handle_value_from_input(input_value)?.as_f64()? as usize)
}

pub(crate) fn take_default_mount_input(input_value: &JsValue) -> Option<MountInput<JsDomAdapter>> {
    let idx = default_mount_handle_index(input_value)?;
    MOUNT_INPUT_REGISTRY.with(|reg| {
        let mut r = reg.borrow_mut();
        if idx < r.len() { r[idx].take() } else { None }
    })
}

pub(crate) const PORTABLE_COMPONENT_TYPE_KEY: &str = "__rue_component_type";
pub(crate) const PORTABLE_VAPOR_SETUP_KEY: &str = "__rue_vapor_setup";
pub(crate) const PORTABLE_PROPS_KEY: &str = "props";

fn with_source_metadata<A: DomAdapter>(source: &Object, mut input: MountInput<A>) -> MountInput<A> {
    input.attach_mount_metadata_from_source(source);
    input
}

fn empty_mount_input<A: DomAdapter>(r#type: MountInputType<A>) -> MountInput<A> {
    MountInput {
        r#type,
        props: ComponentProps::new(),
        children: vec![],
        key: None,
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: None,
    }
}

pub(crate) fn host_node_value(obj: &Object) -> JsValue {
    Reflect::get(obj, &JsValue::from_str("__rue_host_node")).unwrap_or(JsValue::UNDEFINED)
}

pub(crate) fn raw_object_to_vnode_props<A: DomAdapter>(
    rue: &Rue<A>,
    el: &A::Element,
) -> ComponentProps
where
    A::Element: Into<JsValue> + Clone,
{
    let mut props = ComponentProps::new();

    if let Some(adapter) = rue.get_dom_adapter() {
        if adapter.is_fragment(el) {
            let nodes = adapter.collect_fragment_children(el);
            let arr = js_sys::Array::new();
            for node in nodes.into_iter() {
                let value: JsValue = node.into();
                arr.push(&value);
            }
            props.insert("__fragNodes".to_string(), arr.clone().into());

            let el_js: JsValue = el.clone().into();
            let _ = Reflect::set(&el_js, &JsValue::from_str("__rue_frag_nodes_ref"), &arr);
        }
    }

    props
}

pub(crate) fn element_value_to_vapor_input<A: DomAdapter>(
    rue: &Rue<A>,
    source: &Object,
    element_value: JsValue,
) -> MountInput<A>
where
    A::Element: From<JsValue> + Into<JsValue> + Clone,
{
    let el: A::Element = element_value.into();
    with_source_metadata(
        source,
        MountInput {
            r#type: MountInputType::<A>::Vapor,
            props: raw_object_to_vnode_props(rue, &el),
            children: vec![],
            key: None,
            strict_component_returns: false,
            mount_cleanup_bucket: None,
            mount_effect_scope_id: None,
            el_hint: Some(el),
        },
    )
}

pub(crate) fn portable_component_input<A: DomAdapter>(obj: &Object) -> Option<MountInput<A>> {
    let render_fn = Reflect::get(obj, &JsValue::from_str(PORTABLE_COMPONENT_TYPE_KEY))
        .unwrap_or(JsValue::UNDEFINED);
    if render_fn.is_undefined() || render_fn.is_null() {
        return None;
    }

    let props_value =
        Reflect::get(obj, &JsValue::from_str(PORTABLE_PROPS_KEY)).unwrap_or(JsValue::UNDEFINED);
    Some(with_source_metadata(
        obj,
        MountInput::new_normalized(
            MountInputType::<A>::Component(render_fn),
            shared_props_from_value(&props_value),
            vec![],
        ),
    ))
}

pub(crate) fn portable_vapor_input<A: DomAdapter>(obj: &Object) -> Option<MountInput<A>> {
    let has_setup =
        Reflect::has(obj, &JsValue::from_str(PORTABLE_VAPOR_SETUP_KEY)).unwrap_or(false);
    if !has_setup {
        return None;
    }

    let setup = Reflect::get(obj, &JsValue::from_str(PORTABLE_VAPOR_SETUP_KEY))
        .unwrap_or(JsValue::UNDEFINED);
    let r#type = if let Some(func) = setup.dyn_ref::<Function>() {
        MountInputType::<A>::VaporWithSetup(func.clone().into())
    } else {
        MountInputType::<A>::Vapor
    };
    Some(with_source_metadata(obj, empty_mount_input(r#type)))
}

pub(crate) fn portable_object_input<A: DomAdapter>(obj: &Object) -> Option<MountInput<A>> {
    portable_component_input(obj).or_else(|| portable_vapor_input(obj))
}

fn convert_mount_input_from_js_dom<A: DomAdapter>(input: MountInput<JsDomAdapter>) -> MountInput<A>
where
    A::Element: From<JsValue>,
{
    MountInput {
        r#type: match input.r#type {
            MountInputType::<JsDomAdapter>::Text(text) => MountInputType::<A>::Text(text),
            #[cfg(feature = "compat")]
            MountInputType::<JsDomAdapter>::Fragment => MountInputType::<A>::Fragment,
            MountInputType::<JsDomAdapter>::Vapor => MountInputType::<A>::Vapor,
            MountInputType::<JsDomAdapter>::VaporWithSetup(f) => {
                MountInputType::<A>::VaporWithSetup(f)
            }
            #[cfg(feature = "compat")]
            MountInputType::<JsDomAdapter>::Element(tag) => MountInputType::<A>::Element(tag),
            MountInputType::<JsDomAdapter>::Component(f) => MountInputType::<A>::Component(f),
            MountInputType::<JsDomAdapter>::_Phantom(_) => {
                MountInputType::<A>::_Phantom(std::marker::PhantomData)
            }
        },
        props: input.props,
        children: input
            .children
            .into_iter()
            .map(|child| match child {
                MountInputChild::Input(node) => {
                    MountInputChild::Input(convert_mount_input_from_js_dom::<A>(node))
                }
                MountInputChild::Text(text) => MountInputChild::Text(text),
            })
            .collect(),
        key: input.key,
        strict_component_returns: input.strict_component_returns,
        mount_cleanup_bucket: input.mount_cleanup_bucket,
        mount_effect_scope_id: input.mount_effect_scope_id,
        el_hint: input.el_hint.map(|e| {
            let js: JsValue = e.into();
            <A::Element as From<JsValue>>::from(js)
        }),
    }
}

pub(crate) fn default_handle_input<A: DomAdapter>(input_value: &JsValue) -> Option<MountInput<A>>
where
    A::Element: From<JsValue>,
{
    take_default_mount_input(input_value).map(convert_mount_input_from_js_dom::<A>)
}

fn default_object_candidate_input<A: DomAdapter>(
    rue: &Rue<A>,
    obj: &Object,
) -> Option<MountInput<A>>
where
    A::Element: From<JsValue> + Into<JsValue> + Clone,
{
    default_handle_input(&JsValue::from(obj.clone()))
        .or_else(|| portable_object_input::<A>(obj))
        .or_else(|| host_node_object_input(rue, obj))
}

pub(crate) fn host_node_object_input<A: DomAdapter>(
    rue: &Rue<A>,
    obj: &Object,
) -> Option<MountInput<A>>
where
    A::Element: From<JsValue> + Into<JsValue> + Clone,
{
    let host = host_node_value(obj);
    if host.is_undefined() || host.is_null() {
        return None;
    }

    Some(element_value_to_vapor_input(rue, obj, host))
}

pub(crate) fn default_object_input<A: DomAdapter>(
    rue: &Rue<A>,
    obj: &Object,
) -> Option<MountInput<A>>
where
    A::Element: From<JsValue> + Into<JsValue> + Clone,
{
    Some(with_source_metadata(obj, default_object_candidate_input(rue, obj)?))
}

pub(crate) fn default_input<A: DomAdapter>(
    rue: &Rue<A>,
    input_value: &JsValue,
) -> Option<MountInput<A>>
where
    A::Element: From<JsValue> + Into<JsValue> + Clone,
{
    if input_value.is_object() {
        return default_object_input(rue, &Object::from(input_value.clone()));
    }

    default_handle_input(input_value)
}
