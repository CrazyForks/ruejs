/*
JS 值到 MountInput 的转换

组件 render 与 bridge 输入最终都会走到这里的一部分逻辑。
它把 JS 值归一化成 runtime 能理解的 MountInput，并在需要时把跨适配器元素转成 JsDomAdapter 句柄。
*/
use super::super::types::{MountInput, MountInputChild, MountInputType};
use super::super::{JsDomAdapter, Rue};
use crate::runtime::dom_adapter::DomAdapter;
use crate::runtime::input_props::{
    children_from_value as shared_children_from_value,
    input_from_values as shared_input_from_values,
};
use crate::runtime::transport;
use js_sys::{Array, Object, Reflect};
use wasm_bindgen::JsValue;

fn convert_mount_input_to_js_dom<A: DomAdapter>(input: &MountInput<A>) -> MountInput<JsDomAdapter>
where
    A::Element: Into<JsValue> + Clone,
{
    // 嵌套 children 需要交回 JS bridge 时，统一转成 JsDomAdapter 版本，
    // 这样 store_default_mount_input 只需要维护一种注册表元素类型。
    MountInput {
        r#type: match &input.r#type {
            MountInputType::<A>::Text(text) => MountInputType::<JsDomAdapter>::Text(text.clone()),
            MountInputType::<A>::Fragment => MountInputType::<JsDomAdapter>::Fragment,
            MountInputType::<A>::Vapor => MountInputType::<JsDomAdapter>::Vapor,
            MountInputType::<A>::VaporWithSetup(f) => {
                MountInputType::<JsDomAdapter>::VaporWithSetup(f.clone())
            }
            MountInputType::<A>::Element(tag) => {
                MountInputType::<JsDomAdapter>::Element(tag.clone())
            }
            MountInputType::<A>::Component(f) => {
                MountInputType::<JsDomAdapter>::Component(f.clone())
            }
            MountInputType::<A>::_Phantom(_) => {
                MountInputType::<JsDomAdapter>::_Phantom(std::marker::PhantomData)
            }
        },
        props: input.props.clone(),
        children: input
            .children
            .iter()
            .map(|child| match child {
                MountInputChild::Input(node) => {
                    MountInputChild::Input(convert_mount_input_to_js_dom(node))
                }
                MountInputChild::Text(text) => MountInputChild::Text(text.clone()),
            })
            .collect(),
        key: input.key.clone(),
        strict_component_returns: input.strict_component_returns,
        mount_cleanup_bucket: input.mount_cleanup_bucket.clone(),
        mount_effect_scope_id: input.mount_effect_scope_id,
        el_hint: input
            .el_hint
            .clone()
            .map(|el| <JsDomAdapter as DomAdapter>::Element::from(el.into())),
    }
}

fn default_mount_handle_value_from_jsdom_input(input: MountInput<JsDomAdapter>) -> JsValue {
    super::super::transport::store_default_mount_input(
        input,
        super::super::transport::DefaultMountHandleStorePolicy::ReuseEmptySlot,
    )
    .value
}

#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
fn set_mount_handle_wrapper_metadata<A: DomAdapter>(target: &Object, input: &MountInput<A>) {
    if let Some(key) = input.key.as_ref() {
        let _ = Reflect::set(target, &JsValue::from_str("key"), &JsValue::from_str(key));
    }

    if let Some(cleanup_bucket) = input.mount_cleanup_bucket.as_ref() {
        let _ = Reflect::set(target, &JsValue::from_str("__rue_cleanup_bucket"), cleanup_bucket);
    }

    if let Some(scope_id) = input.mount_effect_scope_id {
        let _ = Reflect::set(
            target,
            &JsValue::from_str("__rue_effect_scope_id"),
            &JsValue::from_f64(scope_id as f64),
        );
    }
}

impl<A: DomAdapter> Rue<A>
where
    A::Element: Clone,
{
    fn nested_child_mount_handle_value(&mut self, input: &MountInput<A>) -> JsValue
    where
        A::Element: From<JsValue> + Into<JsValue> + Clone,
    {
        match &input.r#type {
            MountInputType::<A>::Component(render_fn) => {
                // 组件子节点不能直接序列化成 DOM，因此转成 portable component wrapper。
                // 父级真正挂载时再根据 render_fn + props 还原成 MountInput::Component。
                let handle = Object::new();
                let _ = Reflect::set(
                    &handle,
                    &JsValue::from_str(transport::PORTABLE_COMPONENT_TYPE_KEY),
                    render_fn,
                );
                let props = self.props_with_children_input_to_jsobject(input);
                let _ = Reflect::set(&handle, &JsValue::from_str("props"), &props);
                set_mount_handle_wrapper_metadata(&handle, input);
                handle.into()
            }
            MountInputType::<A>::VaporWithSetup(setup) => {
                // VaporWithSetup 保留 setup 函数本身，延后到真实挂载阶段执行。
                let handle = Object::new();
                let _ = Reflect::set(
                    &handle,
                    &JsValue::from_str(transport::PORTABLE_VAPOR_SETUP_KEY),
                    setup,
                );
                set_mount_handle_wrapper_metadata(&handle, input);
                handle.into()
            }
            _ => default_mount_handle_value_from_jsdom_input(convert_mount_input_to_js_dom(input)),
        }
    }

    fn input_children_from_js_value(&mut self, value: &JsValue) -> Vec<MountInputChild<A>>
    where
        A::Element: From<JsValue> + Into<JsValue> + Clone,
    {
        shared_children_from_value::<A, _>(value, |child_value| self.value_to_input(child_value))
    }

    pub(crate) fn component_return_value_to_input(
        &mut self,
        value: &JsValue,
        strict_component_returns: bool,
    ) -> Option<MountInput<A>>
    where
        A::Element: From<JsValue> + Into<JsValue> + Clone,
    {
        if value.is_null() || value.is_undefined() {
            return Some(MountInput::new_normalized(
                MountInputType::<A>::Text(String::new()),
                Default::default(),
                Vec::new(),
            ));
        }

        if strict_component_returns {
            // strict 组件返回面只接受默认协议对象/handle；避免把任意对象误当宿主节点。
            if let Some(input) = self.object_value_to_input(value) {
                return Some(input);
            }

            None
        } else {
            self.value_to_input(value)
        }
    }

    #[cfg_attr(not(test), allow(dead_code))]
    pub(crate) fn value_to_input(&mut self, value: &JsValue) -> Option<MountInput<A>>
    where
        A::Element: From<JsValue> + Into<JsValue> + Clone,
    {
        if let Some(input) = self.object_value_to_input(value) {
            return Some(input);
        }

        None
    }

    fn object_value_to_input(&mut self, value: &JsValue) -> Option<MountInput<A>>
    where
        A::Element: From<JsValue> + Into<JsValue> + Clone,
    {
        if !value.is_object() {
            return None;
        }

        let obj = Object::from(value.clone());
        // 默认对象只识别 mount handle / portable object。
        if let Some(input) = transport::default_object_input(self, &obj) {
            return Some(input);
        }

        let type_tag = Reflect::get(&obj, &JsValue::from_str("type")).unwrap_or(JsValue::UNDEFINED);
        if !type_tag.is_undefined() && !type_tag.is_null() {
            let props =
                Reflect::get(&obj, &JsValue::from_str("props")).unwrap_or(JsValue::UNDEFINED);
            let children =
                Reflect::get(&obj, &JsValue::from_str("children")).unwrap_or(JsValue::UNDEFINED);
            return shared_input_from_values::<A, _>(
                &type_tag,
                &props,
                &children,
                None,
                |effective_children| self.input_children_from_js_value(effective_children),
            );
        }

        None
    }

    fn append_existing_children_prop(
        &self,
        props: &super::super::types::ComponentProps,
        arr: &Array,
    ) {
        if let Some(v) = props.get("children") {
            if Array::is_array(v) {
                let existing = Array::from(v);
                for i in 0..existing.length() {
                    arr.push(&existing.get(i));
                }
            } else if v.is_undefined() || v.is_null() {
            } else {
                arr.push(v);
            }
        }
    }

    pub(crate) fn normalized_children_input_array(
        &mut self,
        props: &super::super::types::ComponentProps,
        children: &[MountInputChild<A>],
    ) -> Array
    where
        A::Element: From<JsValue> + Into<JsValue> + Clone,
    {
        let arr = Array::new();
        if !children.is_empty() {
            for child in children.iter() {
                match child {
                    MountInputChild::Text(text) => {
                        arr.push(&JsValue::from_str(text));
                    }
                    MountInputChild::Input(node) => match &node.r#type {
                        MountInputType::Text(text) => {
                            arr.push(&JsValue::from_str(text));
                        }
                        _ => {
                            let handle = self.nested_child_mount_handle_value(node);
                            arr.push(&handle);
                        }
                    },
                }
            }
        } else {
            self.append_existing_children_prop(props, &arr);
        }

        arr
    }

    /// 从 MountInput 生成包含 props 与归一化 children 的 JS 对象。
    ///
    /// 默认组件挂载主路径已经切到 MountInput，这里把嵌套非文本子项
    /// 序列化为 tagged mount handle，而不是再恢复成 type/props/children 对象协议。
    pub(crate) fn props_with_children_input_to_jsobject(&mut self, input: &MountInput<A>) -> JsValue
    where
        A::Element: From<JsValue> + Into<JsValue> + Clone,
    {
        let obj = Object::new();
        for (k, v) in input.props.iter() {
            let _ = Reflect::set(&obj, &JsValue::from_str(k.as_str()), v);
        }

        let arr = self.normalized_children_input_array(&input.props, &input.children);

        let _ = Reflect::set(&obj, &JsValue::from_str("children"), &arr.into());
        obj.into()
    }

    #[cfg(test)]
    pub(crate) fn input_to_mount_handle_value(&self, input: &MountInput<A>) -> JsValue
    where
        A::Element: From<JsValue> + Into<JsValue> + Clone,
    {
        default_mount_handle_value_from_jsdom_input(convert_mount_input_to_js_dom(input))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::runtime::transport::DEFAULT_MOUNT_HANDLE_KEY;
    use crate::runtime::transport::PORTABLE_COMPONENT_TYPE_KEY;
    use crate::runtime::types::ComponentProps;
    use js_sys::{Array, Function, Object as JsObject};
    use std::collections::HashMap;
    use wasm_bindgen_test::*;

    #[derive(Clone, Default)]
    struct AltAdapter;

    impl DomAdapter for AltAdapter {
        type Element = JsValue;

        fn create_element(&mut self, tag: &str) -> Self::Element {
            let el = JsObject::new();
            Reflect::set(&el, &JsValue::from_str("tag"), &JsValue::from_str(tag)).unwrap();
            Reflect::set(&el, &JsValue::from_str("children"), &Array::new().into()).unwrap();
            el.into()
        }

        fn create_text_node(&mut self, text: &str) -> Self::Element {
            let el = JsObject::new();
            Reflect::set(&el, &JsValue::from_str("tag"), &JsValue::from_str("#text")).unwrap();
            Reflect::set(&el, &JsValue::from_str("text"), &JsValue::from_str(text)).unwrap();
            el.into()
        }

        fn create_document_fragment(&mut self) -> Self::Element {
            self.create_element("fragment")
        }

        fn is_fragment(&self, el: &Self::Element) -> bool {
            Reflect::get(el, &JsValue::from_str("tag"))
                .unwrap_or(JsValue::UNDEFINED)
                .as_string()
                .as_deref()
                == Some("fragment")
        }

        fn collect_fragment_children(&self, el: &Self::Element) -> Vec<Self::Element> {
            let children =
                Reflect::get(el, &JsValue::from_str("children")).unwrap_or(Array::new().into());
            Array::from(&children).iter().collect()
        }

        fn set_text_content(&mut self, el: &mut Self::Element, text: &str) {
            Reflect::set(el, &JsValue::from_str("text"), &JsValue::from_str(text)).unwrap();
        }

        fn append_child(&mut self, parent: &mut Self::Element, child: &Self::Element) {
            let children =
                Reflect::get(parent, &JsValue::from_str("children")).unwrap_or(Array::new().into());
            let children = Array::from(&children);
            children.push(child);
            Reflect::set(parent, &JsValue::from_str("children"), &children.into()).unwrap();
            Reflect::set(child, &JsValue::from_str("parentNode"), parent).unwrap();
        }

        fn insert_before(
            &mut self,
            parent: &mut Self::Element,
            child: &Self::Element,
            before: &Self::Element,
        ) {
            let children =
                Reflect::get(parent, &JsValue::from_str("children")).unwrap_or(Array::new().into());
            let children = Array::from(&children);
            let out = Array::new();
            let mut inserted = false;
            for item in children.iter() {
                if !inserted && js_sys::Object::is(&item, before) {
                    out.push(child);
                    inserted = true;
                }
                out.push(&item);
            }
            if !inserted {
                out.push(child);
            }
            Reflect::set(parent, &JsValue::from_str("children"), &out.into()).unwrap();
            Reflect::set(child, &JsValue::from_str("parentNode"), parent).unwrap();
        }

        fn remove_child(&mut self, parent: &mut Self::Element, child: &Self::Element) {
            let children =
                Reflect::get(parent, &JsValue::from_str("children")).unwrap_or(Array::new().into());
            let out = Array::new();
            for item in Array::from(&children).iter() {
                if !js_sys::Object::is(&item, child) {
                    out.push(&item);
                }
            }
            Reflect::set(parent, &JsValue::from_str("children"), &out.into()).unwrap();
        }

        fn contains(&self, parent: &Self::Element, child: &Self::Element) -> bool {
            if js_sys::Object::is(parent, child) {
                return true;
            }
            let children =
                Reflect::get(parent, &JsValue::from_str("children")).unwrap_or(Array::new().into());
            Array::from(&children).iter().any(|item| self.contains(&item, child))
        }

        fn get_parent_node(&self, node: &Self::Element) -> Option<Self::Element> {
            let parent =
                Reflect::get(node, &JsValue::from_str("parentNode")).unwrap_or(JsValue::UNDEFINED);
            if parent.is_undefined() || parent.is_null() { None } else { Some(parent) }
        }

        fn replace_child(
            &mut self,
            parent: &mut Self::Element,
            new_child: &Self::Element,
            old_child: &Self::Element,
        ) {
            self.insert_before(parent, new_child, old_child);
            self.remove_child(parent, old_child);
        }

        fn set_class_name(&mut self, el: &mut Self::Element, value: &str) {
            Reflect::set(el, &JsValue::from_str("className"), &JsValue::from_str(value)).unwrap();
        }

        fn patch_style(
            &mut self,
            _el: &mut Self::Element,
            _old_style: &HashMap<String, String>,
            _new_style: &HashMap<String, String>,
        ) {
        }

        fn set_inner_html(&mut self, el: &mut Self::Element, html: &str) {
            Reflect::set(el, &JsValue::from_str("innerHTML"), &JsValue::from_str(html)).unwrap();
        }

        fn set_value(&mut self, el: &mut Self::Element, value: JsValue) {
            Reflect::set(el, &JsValue::from_str("value"), &value).unwrap();
        }

        fn set_checked(&mut self, el: &mut Self::Element, checked: bool) {
            Reflect::set(el, &JsValue::from_str("checked"), &JsValue::from_bool(checked)).unwrap();
        }

        fn set_disabled(&mut self, el: &mut Self::Element, disabled: bool) {
            Reflect::set(el, &JsValue::from_str("disabled"), &JsValue::from_bool(disabled))
                .unwrap();
        }

        fn clear_ref(&mut self, _ref_handle: JsValue) {}

        fn apply_ref(&mut self, _el: &mut Self::Element, _ref_handle: JsValue) {}

        fn set_attribute(&mut self, el: &mut Self::Element, key: &str, value: &str) {
            Reflect::set(el, &JsValue::from_str(key), &JsValue::from_str(value)).unwrap();
        }

        fn remove_attribute(&mut self, el: &mut Self::Element, key: &str) {
            Reflect::delete_property(&JsObject::from(el.clone()), &JsValue::from_str(key)).unwrap();
        }

        fn get_tag_name(&self, el: &Self::Element) -> String {
            Reflect::get(el, &JsValue::from_str("tag"))
                .unwrap_or(JsValue::UNDEFINED)
                .as_string()
                .unwrap_or_default()
        }

        fn add_event_listener(&mut self, _el: &mut Self::Element, _event: &str, _handler: JsValue) {
        }

        fn remove_event_listener(
            &mut self,
            _el: &mut Self::Element,
            _event: &str,
            _handler: JsValue,
        ) {
        }

        fn has_value_property(&self, el: &Self::Element) -> bool {
            Reflect::has(el, &JsValue::from_str("value")).unwrap_or(false)
        }

        fn is_select_multiple(&self, el: &Self::Element) -> bool {
            Reflect::get(el, &JsValue::from_str("multiple"))
                .unwrap_or(JsValue::FALSE)
                .as_bool()
                .unwrap_or(false)
        }

        fn query_selector(&self, selector: &str) -> Option<Self::Element> {
            Some(self.clone().create_element(selector))
        }
    }

    #[wasm_bindgen_test]
    fn vapor_with_setup_mount_handle_roundtrip_preserves_setup_marker() {
        let mut rue: Rue<JsDomAdapter> = Rue::new();
        let setup = Function::new_no_args("return 1;");
        let input = MountInput::new_normalized(
            MountInputType::VaporWithSetup(setup.into()),
            Default::default(),
            vec![],
        );

        let handle = rue.input_to_mount_handle_value(&input);
        let roundtrip = rue
            .object_value_to_input(&handle)
            .expect("vapor-with-setup mount handle should roundtrip");
        assert!(matches!(roundtrip.r#type, MountInputType::VaporWithSetup(_)));
    }

    #[wasm_bindgen_test]
    fn vapor_with_existing_element_mount_handle_roundtrip_preserves_element_hint() {
        let mut rue: Rue<JsDomAdapter> = Rue::new();
        let el: JsValue = JsObject::new().into();
        let input = MountInput {
            r#type: MountInputType::Vapor,
            props: Default::default(),
            children: vec![],
            key: None,
            strict_component_returns: false,
            mount_cleanup_bucket: None,
            mount_effect_scope_id: None,
            el_hint: Some(el.clone()),
        };

        let handle = rue.input_to_mount_handle_value(&input);
        let roundtrip =
            rue.object_value_to_input(&handle).expect("tagged mount handle should roundtrip");
        assert!(matches!(roundtrip.r#type, MountInputType::Vapor));
        assert!(roundtrip.el_hint.is_some());
        assert!(js_sys::Object::is(&roundtrip.el_hint.unwrap(), &el));
    }

    #[wasm_bindgen_test]
    fn tagged_mount_handle_object_lifts_wrapper_metadata() {
        let mut rue: Rue<JsDomAdapter> = Rue::new();
        let input = MountInput::new_normalized(MountInputType::Vapor, Default::default(), vec![]);

        let handle = Object::from(rue.input_to_mount_handle_value(&input));
        let cleanup_bucket = Array::new();
        cleanup_bucket.push(&JsValue::from_str("cleanup"));
        Reflect::set(
            &handle,
            &JsValue::from_str("__rue_cleanup_bucket"),
            &cleanup_bucket.clone().into(),
        )
        .unwrap();
        Reflect::set(&handle, &JsValue::from_str("__rue_effect_scope_id"), &JsValue::from_f64(7.0))
            .unwrap();

        let roundtrip = rue
            .object_value_to_input(&handle.clone().into())
            .expect("tagged mount handle object should lift wrapper metadata");

        assert!(roundtrip.mount_cleanup_bucket.is_some());
        assert_eq!(roundtrip.mount_effect_scope_id, Some(7));
    }

    #[wasm_bindgen_test]
    fn portable_component_object_input_roundtrips_on_default_object_surface() {
        let mut rue: Rue<JsDomAdapter> = Rue::new();
        let portable = JsObject::new();
        let render = Function::new_no_args("return null;");
        let props = JsObject::new();
        Reflect::set(
            &portable,
            &JsValue::from_str(PORTABLE_COMPONENT_TYPE_KEY),
            &render.clone().into(),
        )
        .unwrap();
        Reflect::set(&portable, &JsValue::from_str("props"), &props.clone().into()).unwrap();
        Reflect::set(&portable, &JsValue::from_str("key"), &JsValue::from_str("portable-key"))
            .unwrap();

        let input = rue
            .object_value_to_input(&portable.clone().into())
            .expect("portable component object should convert on default object surface");

        assert!(matches!(input.r#type, MountInputType::Component(_)));
        assert_eq!(input.key.as_deref(), Some("portable-key"));
    }

    #[wasm_bindgen_test]
    fn primitive_and_plain_object_inputs_are_rejected_on_default_surface() {
        let mut rue: Rue<JsDomAdapter> = Rue::new();
        assert!(rue.value_to_input(&JsValue::from_str("plain text")).is_none());
        assert!(rue.value_to_input(&JsValue::from_f64(7.0)).is_none());

        let plain = JsObject::new();
        Reflect::set(&plain, &JsValue::from_str("notAProtocol"), &JsValue::TRUE).unwrap();
        assert!(rue.value_to_input(&plain.into()).is_none());
    }

    #[wasm_bindgen_test]
    fn component_child_serializes_to_portable_wrapper_with_props_children_and_metadata() {
        let mut rue: Rue<JsDomAdapter> = Rue::new();
        let render = Function::new_no_args("return null;");
        let mut props: ComponentProps = Default::default();
        props.insert("title".to_string(), JsValue::from_str("card"));
        let cleanup_bucket = Array::new();
        cleanup_bucket.push(&JsValue::from_str("cleanup"));
        props.insert("__rue_cleanup_bucket".to_string(), cleanup_bucket.clone().into());
        props.insert("__rue_effect_scope_id".to_string(), JsValue::from_f64(13.0));
        props.insert("key".to_string(), JsValue::from_str("child-key"));
        let child = MountInput::new_normalized(
            MountInputType::Component(render.into()),
            props,
            vec![MountInputChild::Text("slot".to_string())],
        );
        let parent = MountInput::new_normalized(
            MountInputType::Component(Function::new_no_args("return null;").into()),
            Default::default(),
            vec![MountInputChild::Input(child)],
        );

        let props_obj = Object::from(rue.props_with_children_input_to_jsobject(&parent));
        let children = Array::from(
            &Reflect::get(&props_obj, &JsValue::from_str("children")).unwrap_or(JsValue::UNDEFINED),
        );
        let wrapper = Object::from(children.get(0));
        assert!(Reflect::has(&wrapper, &JsValue::from_str(PORTABLE_COMPONENT_TYPE_KEY)).unwrap());
        assert_eq!(
            Reflect::get(&wrapper, &JsValue::from_str("key")).unwrap().as_string().as_deref(),
            Some("child-key")
        );
        assert_eq!(
            Reflect::get(&wrapper, &JsValue::from_str("__rue_effect_scope_id")).unwrap().as_f64(),
            Some(13.0)
        );

        let wrapper_props = Object::from(
            Reflect::get(&wrapper, &JsValue::from_str("props")).unwrap_or(JsValue::UNDEFINED),
        );
        let nested_children = Array::from(
            &Reflect::get(&wrapper_props, &JsValue::from_str("children"))
                .unwrap_or(JsValue::UNDEFINED),
        );
        assert_eq!(nested_children.get(0).as_string().as_deref(), Some("slot"));
    }

    #[wasm_bindgen_test]
    fn component_child_serializes_without_optional_wrapper_metadata() {
        let mut rue: Rue<JsDomAdapter> = Rue::new();
        let child = MountInput::new_normalized(
            MountInputType::Component(Function::new_no_args("return null;").into()),
            Default::default(),
            vec![],
        );
        let parent = MountInput::new_normalized(
            MountInputType::Component(Function::new_no_args("return null;").into()),
            Default::default(),
            vec![MountInputChild::Input(child)],
        );

        let props_obj = Object::from(rue.props_with_children_input_to_jsobject(&parent));
        let children = Array::from(
            &Reflect::get(&props_obj, &JsValue::from_str("children")).unwrap_or(JsValue::UNDEFINED),
        );
        let wrapper = Object::from(children.get(0));

        assert!(!Reflect::has(&wrapper, &JsValue::from_str("key")).unwrap());
        assert!(!Reflect::has(&wrapper, &JsValue::from_str("__rue_cleanup_bucket")).unwrap());
        assert!(!Reflect::has(&wrapper, &JsValue::from_str("__rue_effect_scope_id")).unwrap());
    }

    #[wasm_bindgen_test]
    fn non_js_adapter_mount_handle_conversion_covers_default_input_shapes() {
        let rue: Rue<AltAdapter> = Rue::new();

        let text_handle = rue.input_to_mount_handle_value(&MountInput::new_normalized(
            MountInputType::Text("plain".to_string()),
            Default::default(),
            vec![],
        ));
        assert!(!text_handle.is_undefined());

        let component_handle = rue.input_to_mount_handle_value(&MountInput::new_normalized(
            MountInputType::Component(Function::new_no_args("return null").into()),
            Default::default(),
            vec![],
        ));
        assert!(!component_handle.is_undefined());

        let phantom_handle = rue.input_to_mount_handle_value(&MountInput::new_normalized(
            MountInputType::_Phantom(std::marker::PhantomData),
            Default::default(),
            vec![],
        ));
        assert!(!phantom_handle.is_undefined());

        let nested = MountInput::new_normalized(
            MountInputType::Vapor,
            Default::default(),
            vec![MountInputChild::Input(MountInput::new_normalized(
                MountInputType::Text("nested".to_string()),
                Default::default(),
                vec![],
            ))],
        );
        let nested_handle = rue.input_to_mount_handle_value(&nested);
        assert!(!nested_handle.is_undefined());
    }

    #[wasm_bindgen_test]
    fn non_js_adapter_children_serialization_covers_wrappers_and_existing_children_props() {
        let mut rue: Rue<AltAdapter> = Rue::new();

        let vapor_setup = MountInput::new_normalized(
            MountInputType::VaporWithSetup(Function::new_no_args("return null").into()),
            Default::default(),
            vec![],
        );
        let vapor = MountInput::new_normalized(MountInputType::Vapor, Default::default(), vec![]);
        let text = MountInput::new_normalized(
            MountInputType::Text("inline".to_string()),
            Default::default(),
            vec![],
        );
        let parent = MountInput::new_normalized(
            MountInputType::Component(Function::new_no_args("return null").into()),
            Default::default(),
            vec![
                MountInputChild::Input(vapor_setup),
                MountInputChild::Input(vapor),
                MountInputChild::Input(text),
            ],
        );

        let props_obj = Object::from(rue.props_with_children_input_to_jsobject(&parent));
        let children = Array::from(
            &Reflect::get(&props_obj, &JsValue::from_str("children")).unwrap_or(JsValue::UNDEFINED),
        );
        assert_eq!(children.length(), 3);
        assert!(
            Reflect::has(&children.get(0), &JsValue::from_str(transport::PORTABLE_VAPOR_SETUP_KEY))
                .unwrap()
        );
        assert!(
            Reflect::has(&children.get(1), &JsValue::from_str(DEFAULT_MOUNT_HANDLE_KEY)).unwrap()
        );
        assert_eq!(children.get(2).as_string().as_deref(), Some("inline"));

        let existing = Array::new();
        existing.push(&JsValue::from_str("existing-a"));
        existing.push(&JsValue::from_str("existing-b"));
        let mut props_with_array: ComponentProps = Default::default();
        props_with_array.insert("children".to_string(), existing.into());
        let reused = rue.normalized_children_input_array(&props_with_array, &[]);
        assert_eq!(reused.length(), 2);

        let mut props_with_scalar: ComponentProps = Default::default();
        props_with_scalar.insert("children".to_string(), JsValue::from_str("scalar-child"));
        let scalar = rue.normalized_children_input_array(&props_with_scalar, &[]);
        assert_eq!(scalar.get(0).as_string().as_deref(), Some("scalar-child"));

        let mut props_with_null: ComponentProps = Default::default();
        props_with_null.insert("children".to_string(), JsValue::NULL);
        assert_eq!(rue.normalized_children_input_array(&props_with_null, &[]).length(), 0);
    }
}
