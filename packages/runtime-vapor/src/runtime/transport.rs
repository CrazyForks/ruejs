/*
默认挂载协议运输层

runtime-vapor 默认主路径不再把完整 JS 对象树作为数据货币，而是：
1. createElement/vapor/portable bridge 先生成 MountInput
2. MountInput 写入线程局部注册表，返回轻量 mount handle
3. render/renderAnchor/renderBetween 消费 handle，再还原 MountInput 进入渲染队列

这样做可以降低跨 wasm 边界的对象形态复杂度，并让入口协议集中在默认 handle/portable 两类。
*/
use super::globals::MOUNT_INPUT_REGISTRY;
use super::input_props::props_from_value as shared_props_from_value;
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
    #[allow(dead_code)]
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
                // createElement 产生的 handle 生命周期通常很短；优先复用空槽，避免注册表无限增长。
                for (idx, slot) in registry.iter_mut().enumerate() {
                    if slot.is_none() {
                        *slot = pending_input.take();
                        return idx as u32;
                    }
                }
            }
            DefaultMountHandleStorePolicy::Append => {}
        }

        // Append 策略用于需要保留稳定位置的输入，例如 vapor() 预创建的 setup handle。
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
    // 兼容三种 handle 表示：裸数字、数字字符串、以及 { __rue_mount_id } 对象。
    // JS 侧在不同桥接路径中可能会包装 handle，对这里来说最终只需要拿到索引。
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

#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
fn default_mount_handle_index(input_value: &JsValue) -> Option<usize> {
    Some(default_mount_handle_value_from_input(input_value)?.as_f64()? as usize)
}

pub(crate) fn take_default_mount_input(input_value: &JsValue) -> Option<MountInput<JsDomAdapter>> {
    let idx = default_mount_handle_index(input_value)?;
    MOUNT_INPUT_REGISTRY.with(|reg| {
        let mut r = reg.borrow_mut();
        // handle 是一次性消费的：take() 后槽位变成 None，后续可被 ReuseEmptySlot 复用。
        // 这样可以避免旧 MountInput 被重复 render，也减少注册表里的长生命周期对象。
        if idx < r.len() { r[idx].take() } else { None }
    })
}

pub(crate) const PORTABLE_COMPONENT_TYPE_KEY: &str = "__rue_component_type";
pub(crate) const PORTABLE_VAPOR_SETUP_KEY: &str = "__rue_vapor_setup";
pub(crate) const PORTABLE_PROPS_KEY: &str = "props";

fn with_source_metadata<A: DomAdapter>(source: &Object, mut input: MountInput<A>) -> MountInput<A> {
    // source 对象上可能挂着 key、cleanup bucket、effect scope 等卸载所需元信息。
    // 转成 MountInput 后必须显式带过去，否则后续 lifecycle record 看不到这些清理边界。
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

pub(crate) fn portable_component_input<A: DomAdapter>(obj: &Object) -> Option<MountInput<A>> {
    // portable component 是默认主路径允许跨层传递的轻量对象：
    // { __rue_component_type: renderFn, props }。
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
    // portable vapor 只以 key 是否存在来识别；值为函数时表示 VaporWithSetup，
    // 非函数/空值则表示普通 Vapor，占位给后续真实挂载阶段处理。
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
    // 注册表统一存 JsDomAdapter 版本；消费时再转回当前 Rue<A> 的宿主元素类型。
    // 这里递归转换 children 与 el_hint，保持默认协议可以跨不同适配器边界流动。
    MountInput {
        r#type: match input.r#type {
            MountInputType::<JsDomAdapter>::Text(text) => MountInputType::<A>::Text(text),
            MountInputType::<JsDomAdapter>::Fragment => MountInputType::<A>::Fragment,
            MountInputType::<JsDomAdapter>::Vapor => MountInputType::<A>::Vapor,
            MountInputType::<JsDomAdapter>::VaporWithSetup(f) => {
                MountInputType::<A>::VaporWithSetup(f)
            }
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

fn default_object_candidate_input<A: DomAdapter>(obj: &Object) -> Option<MountInput<A>>
where
    A::Element: From<JsValue>,
{
    // 默认对象输入按“最明确、成本最低”的顺序识别：
    // 1. mount handle：直接从注册表取回
    // 2. portable object：组件/Vapor 的轻量跨层表示
    default_handle_input(&JsValue::from(obj.clone())).or_else(|| portable_object_input::<A>(obj))
}

pub(crate) fn default_object_input<A: DomAdapter>(
    _rue: &Rue<A>,
    obj: &Object,
) -> Option<MountInput<A>>
where
    A::Element: From<JsValue>,
{
    Some(with_source_metadata(obj, default_object_candidate_input(obj)?))
}

#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
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

#[cfg(test)]
mod tests {
    use super::*;
    use wasm_bindgen_test::*;

    fn mount_input(r#type: MountInputType<JsDomAdapter>) -> MountInput<JsDomAdapter> {
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

    #[wasm_bindgen_test]
    fn portable_vapor_input_accepts_non_function_setup_marker() {
        let obj = Object::new();
        Reflect::set(
            &obj,
            &JsValue::from_str(PORTABLE_VAPOR_SETUP_KEY),
            &JsValue::from_str("marker"),
        )
        .unwrap();

        let input = portable_vapor_input::<JsDomAdapter>(&obj).expect("portable vapor input");
        assert!(matches!(input.r#type, MountInputType::Vapor));
    }

    #[wasm_bindgen_test]
    fn default_handle_input_converts_text_and_phantom_inputs() {
        let text = store_default_mount_input(
            mount_input(MountInputType::Text("stored text".to_string())),
            DefaultMountHandleStorePolicy::Append,
        );
        let converted = default_handle_input::<JsDomAdapter>(&text.value).expect("text input");
        assert!(
            matches!(converted.r#type, MountInputType::Text(ref value) if value == "stored text")
        );

        let phantom = store_default_mount_input(
            mount_input(MountInputType::_Phantom(std::marker::PhantomData)),
            DefaultMountHandleStorePolicy::Append,
        );
        let converted =
            default_handle_input::<JsDomAdapter>(&phantom.value).expect("phantom input");
        assert!(matches!(converted.r#type, MountInputType::_Phantom(_)));
    }

    #[wasm_bindgen_test]
    fn default_handle_input_reuses_slots_keys_and_nested_inputs() {
        MOUNT_INPUT_REGISTRY.with(|registry| registry.borrow_mut().clear());

        let first = store_default_mount_input(
            mount_input(MountInputType::Text("first".to_string())),
            DefaultMountHandleStorePolicy::Append,
        );
        assert!(take_default_mount_input(&first.value).is_some());

        let mut keyed = mount_input(MountInputType::Text("keyed".to_string()));
        keyed.key = Some("stable-key".to_string());
        let reused =
            store_default_mount_input(keyed, DefaultMountHandleStorePolicy::ReuseEmptySlot);
        assert_eq!(reused.id, first.id);
        assert_eq!(
            Reflect::get(&reused.value, &JsValue::from_str("key")).unwrap().as_string().as_deref(),
            Some("stable-key")
        );

        assert!(default_handle_input::<JsDomAdapter>(&JsValue::from_str("not-a-number")).is_none());
        assert!(default_handle_input::<JsDomAdapter>(&JsValue::TRUE).is_none());
        assert!(default_handle_input::<JsDomAdapter>(&JsValue::from_f64(999_999.0)).is_none());

        let missing_object_handle = Object::new();
        assert!(default_handle_input::<JsDomAdapter>(&missing_object_handle.into()).is_none());

        let mut component =
            mount_input(MountInputType::Component(Function::new_no_args("return null").into()));
        component
            .children
            .push(MountInputChild::Input(mount_input(MountInputType::Text("nested".to_string()))));
        let component_handle =
            store_default_mount_input(component, DefaultMountHandleStorePolicy::Append);
        let converted =
            default_handle_input::<JsDomAdapter>(&component_handle.value).expect("component input");
        assert!(matches!(converted.r#type, MountInputType::Component(_)));
        assert!(matches!(
            converted.children.first(),
            Some(MountInputChild::Input(child))
                if matches!(child.r#type, MountInputType::Text(ref text) if text == "nested")
        ));
    }

    #[wasm_bindgen_test]
    fn default_input_uses_non_object_handle_path() {
        let rue: Rue<JsDomAdapter> = Rue::new();
        let handle = store_default_mount_input(
            mount_input(MountInputType::Text("numeric handle".to_string())),
            DefaultMountHandleStorePolicy::Append,
        );

        let input = default_input(&rue, &JsValue::from_f64(handle.id as f64)).expect("input");
        assert!(
            matches!(input.r#type, MountInputType::Text(ref value) if value == "numeric handle")
        );
    }

    #[wasm_bindgen_test]
    fn default_input_covers_object_candidates_and_invalid_non_object_fallbacks() {
        let rue: Rue<JsDomAdapter> = Rue::new();

        let plain = Object::new();
        assert!(default_input::<JsDomAdapter>(&rue, &plain.clone().into()).is_none());
        assert!(
            default_input::<JsDomAdapter>(&rue, &JsValue::from_str("missing-handle")).is_none()
        );

        let component = Object::new();
        Reflect::set(
            &component,
            &JsValue::from_str(PORTABLE_COMPONENT_TYPE_KEY),
            &Function::new_no_args("return null").into(),
        )
        .unwrap();
        let component_input = default_input::<JsDomAdapter>(&rue, &component.clone().into())
            .expect("component input");
        assert!(matches!(component_input.r#type, MountInputType::Component(_)));

        let unsupported = Object::new();
        Reflect::set(&unsupported, &JsValue::from_str("nodeType"), &JsValue::from_f64(1.0))
            .unwrap();
        assert!(default_input::<JsDomAdapter>(&rue, &unsupported.clone().into()).is_none());
    }

    #[wasm_bindgen_test]
    fn default_input_accepts_string_and_object_mount_handles() {
        let rue: Rue<JsDomAdapter> = Rue::new();
        let string_handle = store_default_mount_input(
            mount_input(MountInputType::Text("string handle".to_string())),
            DefaultMountHandleStorePolicy::Append,
        );
        let input =
            default_input::<JsDomAdapter>(&rue, &JsValue::from_str(&string_handle.id.to_string()))
                .expect("string handle input");
        assert!(
            matches!(input.r#type, MountInputType::Text(ref value) if value == "string handle")
        );

        let object_handle = store_default_mount_input(
            mount_input(MountInputType::Text("object handle".to_string())),
            DefaultMountHandleStorePolicy::Append,
        );
        let input =
            default_input::<JsDomAdapter>(&rue, &object_handle.value).expect("object handle input");
        assert!(
            matches!(input.r#type, MountInputType::Text(ref value) if value == "object handle")
        );
    }

    #[wasm_bindgen_test]
    fn default_handle_input_rejects_object_handle_with_non_numeric_id() {
        let obj = Object::new();
        let invalid_id = Object::new();
        Reflect::set(&obj, &JsValue::from_str(DEFAULT_MOUNT_HANDLE_KEY), &invalid_id.into())
            .unwrap();

        assert!(default_handle_input::<JsDomAdapter>(&obj.into()).is_none());
    }
}
