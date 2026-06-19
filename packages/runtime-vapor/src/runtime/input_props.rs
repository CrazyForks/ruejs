/*
render input props 辅助转换

集中处理 JS props 与 children 到 ComponentProps 的转换。
旧式 type/props/children 对象输入解析已经删除。
*/
use super::dom_adapter::DomAdapter;
use super::types::{ComponentProps, FRAGMENT, MountInput, MountInputChild, MountInputType};
use crate::reactive::context::CONTEXT_PARENT_INSTANCE_PROP;
use js_sys::Function;
use js_sys::{Array, Object, Reflect};
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;

pub(crate) fn props_from_value(props: &JsValue) -> ComponentProps {
    let mut props_map: ComponentProps = ComponentProps::new();
    if props.is_object() {
        let obj = Object::from(props.clone());
        let keys = Object::keys(&obj);
        for index in 0..keys.length() {
            let key = keys.get(index);
            let name = key.as_string().expect("Object.keys must return string keys");
            let value = Reflect::get(&obj, &key).unwrap_or(JsValue::UNDEFINED);
            props_map.insert(name, value);
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

pub(crate) fn input_type_from_tag<A: DomAdapter>(
    type_tag: &JsValue,
    props_map: &ComponentProps,
    fallback_unknown_element: Option<&str>,
) -> Option<MountInputType<A>> {
    if let Some(tag) = type_tag.as_string() {
        Some(if tag == FRAGMENT {
            MountInputType::<A>::Fragment
        } else if tag == "vapor" {
            props_map
                .get("setup")
                .and_then(|setup| setup.dyn_ref::<Function>())
                .map(|func| MountInputType::<A>::VaporWithSetup(func.clone().into()))
                .unwrap_or(MountInputType::<A>::Vapor)
        } else {
            MountInputType::<A>::Element(tag)
        })
    } else if let Some(func) = type_tag.dyn_ref::<Function>() {
        Some(MountInputType::<A>::Component(func.clone().into()))
    } else {
        fallback_unknown_element.map(|tag| MountInputType::<A>::Element(tag.to_string()))
    }
}

pub(crate) fn input_from_values<A, F>(
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
    let r#type = input_type_from_tag::<A>(type_tag, &props, fallback_unknown_element)?;

    Some(MountInput::new_normalized(r#type, props, children_from_value(&effective)))
}

pub(crate) fn children_from_value<A, F>(
    value: &JsValue,
    mut input_from_value: F,
) -> Vec<MountInputChild<A>>
where
    A: DomAdapter,
    F: FnMut(&JsValue) -> Option<MountInput<A>>,
{
    fn push_child_value<A, F>(
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
                push_child_value(nested.get(index), child_vec, input_from_value);
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
    push_child_value(value.clone(), &mut child_vec, &mut input_from_value);
    child_vec
}
