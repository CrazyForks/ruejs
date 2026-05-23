#[cfg(feature = "compat")]
use super::DomAdapter;
use super::types::ComponentProps;
#[cfg(feature = "compat")]
use super::types::{FRAGMENT, MountInput, MountInputChild, MountInputType};
use crate::reactive::context::CONTEXT_PARENT_INSTANCE_PROP;
#[cfg(feature = "compat")]
use js_sys::Function;
use js_sys::{Array, Object, Reflect};
#[cfg(feature = "compat")]
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;

pub(crate) fn props_from_value(props: &JsValue) -> ComponentProps {
    let mut props_map: ComponentProps = ComponentProps::new();
    if props.is_object() {
        let obj = Object::from(props.clone());
        let keys = Object::keys(&obj);
        for index in 0..keys.length() {
            let key = keys.get(index);
            if let Some(name) = key.as_string() {
                let value = Reflect::get(&obj, &key).unwrap_or(JsValue::UNDEFINED);
                props_map.insert(name, value);
            }
        }

        let parent_key = JsValue::from_str(CONTEXT_PARENT_INSTANCE_PROP);
        if Reflect::has(&obj, &parent_key).unwrap_or(false) {
            let value = Reflect::get(&obj, &parent_key).unwrap_or(JsValue::UNDEFINED);
            props_map.insert(CONTEXT_PARENT_INSTANCE_PROP.to_string(), value);
        }
    }
    props_map
}

pub(crate) fn assign_children_prop(props_map: &mut ComponentProps, children: &JsValue) {
    if Array::is_array(children) {
        props_map.insert("children".to_string(), children.clone());
    } else if !children.is_undefined() && !children.is_null() {
        let arr = Array::new();
        arr.push(children);
        props_map.insert("children".to_string(), arr.into());
    }
}

pub(crate) fn props_with_children(props: &JsValue, children: &JsValue) -> ComponentProps {
    let mut props_map = props_from_value(props);
    assign_children_prop(&mut props_map, children);
    props_map
}

#[cfg(feature = "compat")]
pub(crate) fn effective_children(children: &JsValue, props_map: &ComponentProps) -> JsValue {
    if Array::is_array(children) {
        let arr = Array::from(children);
        if arr.length() == 0 {
            props_map.get("children").cloned().unwrap_or_else(|| children.clone())
        } else {
            children.clone()
        }
    } else if children.is_undefined() || children.is_null() {
        props_map.get("children").cloned().unwrap_or_else(|| children.clone())
    } else {
        children.clone()
    }
}

#[cfg(feature = "compat")]
pub(crate) fn compat_type_to_input_type<A: DomAdapter>(
    type_tag: &JsValue,
    props_map: &ComponentProps,
    fallback_unknown_element: Option<&str>,
) -> Option<MountInputType<A>> {
    if let Some(tag) = type_tag.as_string() {
        Some(if tag == FRAGMENT {
            MountInputType::<A>::Fragment
        } else if tag == "vapor" {
            if let Some(setup) = props_map.get("setup") {
                if let Some(func) = setup.dyn_ref::<Function>() {
                    MountInputType::<A>::VaporWithSetup(func.clone().into())
                } else {
                    MountInputType::<A>::Vapor
                }
            } else {
                MountInputType::<A>::Vapor
            }
        } else {
            MountInputType::<A>::Element(tag)
        })
    } else if let Some(func) = type_tag.dyn_ref::<Function>() {
        Some(MountInputType::<A>::Component(func.clone().into()))
    } else {
        fallback_unknown_element.map(|tag| MountInputType::<A>::Element(tag.to_string()))
    }
}

#[cfg(feature = "compat")]
pub(crate) fn compat_input_from_values<A, F>(
    type_tag: &JsValue,
    props_value: &JsValue,
    children_value: &JsValue,
    fallback_unknown_element: Option<&str>,
    children_from_value: F,
) -> Option<MountInput<A>>
where
    A: DomAdapter,
    F: FnOnce(&JsValue) -> Vec<MountInputChild<A>>,
{
    let props = props_with_children(props_value, children_value);
    let effective = effective_children(children_value, &props);
    let r#type = compat_type_to_input_type::<A>(type_tag, &props, fallback_unknown_element)?;

    Some(MountInput::new_normalized(r#type, props, children_from_value(&effective)))
}

#[cfg(feature = "compat")]
pub(crate) fn compat_object_to_input<A, TypeGuard, F>(
    input_value: &JsValue,
    fallback_unknown_element: Option<&str>,
    type_guard: TypeGuard,
    children_from_value: F,
) -> Option<MountInput<A>>
where
    A: DomAdapter,
    TypeGuard: FnOnce(&JsValue) -> bool,
    F: FnOnce(&JsValue) -> Vec<MountInputChild<A>>,
{
    if !input_value.is_object() {
        return None;
    }

    let obj = Object::from(input_value.clone());
    let type_value = Reflect::get(&obj, &JsValue::from_str("type")).unwrap_or(JsValue::UNDEFINED);
    if type_value.is_undefined() || type_value.is_null() || !type_guard(&type_value) {
        return None;
    }

    let props_value = Reflect::get(&obj, &JsValue::from_str("props")).unwrap_or(JsValue::UNDEFINED);
    let children_value =
        Reflect::get(&obj, &JsValue::from_str("children")).unwrap_or(JsValue::UNDEFINED);
    let mut input = compat_input_from_values::<A, _>(
        &type_value,
        &props_value,
        &children_value,
        fallback_unknown_element,
        children_from_value,
    )?;
    input.attach_mount_metadata_from_source(&obj);
    Some(input)
}

#[cfg(feature = "compat")]
pub(crate) fn compat_children_from_value<A, F>(
    value: &JsValue,
    mut input_from_value: F,
) -> Vec<MountInputChild<A>>
where
    A: DomAdapter,
    F: FnMut(&JsValue) -> Option<MountInput<A>>,
{
    fn push_compat_child_value<A, F>(
        item: JsValue,
        child_vec: &mut Vec<MountInputChild<A>>,
        input_from_value: &mut F,
    ) where
        A: DomAdapter,
        F: FnMut(&JsValue) -> Option<MountInput<A>>,
    {
        if Array::is_array(&item) {
            let nested = Array::from(&item);
            for index in 0..nested.length() {
                push_compat_child_value(nested.get(index), child_vec, input_from_value);
            }
            return;
        }

        if let Some(text) = item.as_string() {
            child_vec.push(MountInputChild::<A>::Text(text));
        } else if let Some(number) = item.as_f64() {
            child_vec.push(MountInputChild::<A>::Text(number.to_string()));
        } else if item.is_object() {
            if let Some(input) = input_from_value(&item) {
                child_vec.push(MountInputChild::<A>::Input(input));
            }
        }
    }

    let mut child_vec = Vec::new();
    push_compat_child_value(value.clone(), &mut child_vec, &mut input_from_value);
    child_vec
}

#[cfg(test)]
#[path = "vnode_helpers_tests.rs"]
mod tests;
