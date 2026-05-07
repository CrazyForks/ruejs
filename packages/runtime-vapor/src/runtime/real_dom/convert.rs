use super::super::types::{MountInput, MountInputChild, MountInputType};
#[cfg(feature = "compat")]
use super::super::vnode_helpers::{
    compat_children_from_value as shared_compat_children_from_value,
    compat_object_to_input as shared_compat_object_to_input,
};
use super::super::{JsDomAdapter, Rue};
use crate::runtime::dom_adapter::DomAdapter;
use crate::runtime::transport;
use js_sys::{Array, Object, Reflect};
use wasm_bindgen::JsValue;

fn convert_mount_input_to_js_dom<A: DomAdapter>(input: &MountInput<A>) -> MountInput<JsDomAdapter>
where
    A::Element: Into<JsValue> + Clone,
{
    MountInput {
        r#type: match &input.r#type {
            MountInputType::<A>::Text(text) => MountInputType::<JsDomAdapter>::Text(text.clone()),
            #[cfg(feature = "compat")]
            MountInputType::<A>::Fragment => MountInputType::<JsDomAdapter>::Fragment,
            MountInputType::<A>::Vapor => MountInputType::<JsDomAdapter>::Vapor,
            MountInputType::<A>::VaporWithSetup(f) => {
                MountInputType::<JsDomAdapter>::VaporWithSetup(f.clone())
            }
            #[cfg(feature = "compat")]
            MountInputType::<A>::Element(tag) => MountInputType::<JsDomAdapter>::Element(tag.clone()),
            MountInputType::<A>::Component(f) => MountInputType::<JsDomAdapter>::Component(f.clone()),
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

impl<A: DomAdapter> Rue<A>
where
    A::Element: Clone,
{
    pub(crate) fn value_to_input(&mut self, value: &JsValue) -> Option<MountInput<A>>
    where
        A::Element: From<JsValue> + Into<JsValue> + Clone,
    {
        #[cfg(feature = "compat")]
        if Array::is_array(value) {
            let source = Object::from(value.clone());
            let mut input = MountInput::new_normalized(
                MountInputType::<A>::Fragment,
                Default::default(),
                self.children_from_js_input(value),
            );
            input.attach_mount_metadata_from_source(&source);
            return Some(input);
        }

        if let Some(input) = self.object_value_to_input(value) {
            return Some(input);
        }

        #[cfg(feature = "compat")]
        if value.is_object() {
            let obj = Object::from(value.clone());
            let node_type =
                Reflect::get(&obj, &JsValue::from_str("nodeType")).unwrap_or(JsValue::UNDEFINED);
            if node_type.as_f64().is_some() {
                return Some(transport::element_value_to_vapor_input(
                    self,
                    &obj,
                    JsValue::from(obj.clone()),
                ));
            }

            #[cfg(feature = "compat")]
            if let Some(input) = self.compat_vnode_object_to_input(&obj) {
                return Some(input);
            }

            return None;
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
        if let Some(input) = transport::default_object_input(self, &obj) {
            return Some(input);
        }

        None
    }

    #[cfg(feature = "compat")]
    fn compat_vnode_object_to_input(&mut self, obj: &Object) -> Option<MountInput<A>>
    where
        A::Element: From<JsValue> + Into<JsValue>,
    {
        shared_compat_object_to_input::<A, _, _>(
            &JsValue::from(obj.clone()),
            None,
            |_| true,
            |effective_children| self.children_from_js_input(effective_children),
        )
    }

    #[cfg(feature = "compat")]
    fn child_value_to_input(&mut self, value: &JsValue) -> MountInput<A>
    where
        A::Element: From<JsValue> + Into<JsValue> + Clone,
    {
        if let Some(input) = self.value_to_input(value) {
            return input;
        }

        let error = JsValue::from_str(
            "Unsupported object child on the default path. Return a raw node, fragment, host-node bridge, or tagged mount handle instead.",
        );
        self.handle_error(error.clone());
        wasm_bindgen::throw_val(error);
    }

    #[cfg(feature = "compat")]
    fn children_from_js_input(&mut self, cc: &JsValue) -> Vec<MountInputChild<A>>
    where
        A::Element: From<JsValue> + Into<JsValue> + Clone,
    {
        shared_compat_children_from_value::<A, _>(cc, |item| Some(self.child_value_to_input(item)))
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
        &self,
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
                            let handle = self.input_to_mount_handle_value(node);
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
    #[cfg(feature = "compat")]
    use crate::runtime::transport::DEFAULT_MOUNT_HANDLE_KEY;
    use crate::runtime::transport::PORTABLE_COMPONENT_TYPE_KEY;
    use js_sys::{Array, Function, Object as JsObject};
    use wasm_bindgen_test::*;

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

    #[cfg(feature = "compat")]
    #[wasm_bindgen_test]
    fn props_with_children_input_to_jsobject_uses_tagged_mount_handles() {
        let mut rue: Rue<JsDomAdapter> = Rue::new();
        let child = MountInput::new_normalized(
            MountInputType::Element("strong".to_string()),
            Default::default(),
            vec![MountInputChild::Text("A".to_string())],
        );
        let parent = MountInput::new_normalized(
            MountInputType::Fragment,
            Default::default(),
            vec![MountInputChild::Input(child)],
        );

        let props = Object::from(rue.props_with_children_input_to_jsobject(&parent));
        let children = Array::from(
            &Reflect::get(&props, &JsValue::from_str("children")).unwrap_or(JsValue::UNDEFINED),
        );
        let child_object = Object::from(children.get(0));

        assert!(
            Reflect::has(&child_object, &JsValue::from_str(DEFAULT_MOUNT_HANDLE_KEY))
                .unwrap_or(false)
        );
        let type_value =
            Reflect::get(&child_object, &JsValue::from_str("type")).unwrap_or(JsValue::UNDEFINED);
        assert!(type_value.is_undefined());
    }

    #[wasm_bindgen_test]
    fn host_node_bridge_input_lifts_mount_metadata_off_props() {
        let mut rue: Rue<JsDomAdapter> = Rue::new();
        let host: JsValue = JsObject::new().into();
        let cleanup_bucket = Array::new();
        cleanup_bucket.push(&JsValue::from_str("cleanup"));

        let bridge = JsObject::new();
        Reflect::set(&bridge, &JsValue::from_str("__rue_host_node"), &host).unwrap();
        Reflect::set(
            &bridge,
            &JsValue::from_str("__rue_cleanup_bucket"),
            &cleanup_bucket.clone().into(),
        )
        .unwrap();
        Reflect::set(
            &bridge,
            &JsValue::from_str("__rue_effect_scope_id"),
            &JsValue::from_f64(11.0),
        )
        .unwrap();

        let input = rue
            .object_value_to_input(&bridge.clone().into())
            .expect("host-node bridge should convert");

        assert!(matches!(input.r#type, MountInputType::Vapor));
        assert!(input.mount_cleanup_bucket.is_some());
        assert_eq!(input.mount_effect_scope_id, Some(11));
        assert!(!input.props.contains_key("__rue_cleanup_bucket"));
        assert!(!input.props.contains_key("__rue_effect_scope_id"));
    }

    #[wasm_bindgen_test]
    fn tagged_mount_handle_object_lifts_wrapper_metadata() {
        let mut rue: Rue<JsDomAdapter> = Rue::new();
        let input = MountInput::new_normalized(
            MountInputType::Vapor,
            Default::default(),
            vec![],
        );

        let handle = Object::from(rue.input_to_mount_handle_value(&input));
        let cleanup_bucket = Array::new();
        cleanup_bucket.push(&JsValue::from_str("cleanup"));
        Reflect::set(
            &handle,
            &JsValue::from_str("__rue_cleanup_bucket"),
            &cleanup_bucket.clone().into(),
        )
        .unwrap();
        Reflect::set(
            &handle,
            &JsValue::from_str("__rue_effect_scope_id"),
            &JsValue::from_f64(7.0),
        )
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

    #[cfg(feature = "compat")]
    #[wasm_bindgen_test]
    fn compat_vnode_object_input_flattens_nested_array_children() {
        let mut rue: Rue<JsDomAdapter> = Rue::new();
        let strong = MountInput::new_normalized(
            MountInputType::Element("strong".to_string()),
            Default::default(),
            vec![MountInputChild::Text("B".to_string())],
        );
        let strong_handle = rue.input_to_mount_handle_value(&strong);

        let nested = Array::new();
        nested.push(&JsValue::from_str("A"));
        nested.push(&strong_handle);

        let children = Array::new();
        children.push(&nested.clone().into());

        let props = JsObject::new();
        Reflect::set(&props, &JsValue::from_str("className"), &JsValue::from_str("raw"))
            .unwrap();

        let vnode = JsObject::new();
        Reflect::set(&vnode, &JsValue::from_str("type"), &JsValue::from_str("div")).unwrap();
        Reflect::set(&vnode, &JsValue::from_str("props"), &props).unwrap();
        Reflect::set(&vnode, &JsValue::from_str("children"), &children.into()).unwrap();

        let input = rue
            .value_to_input(&vnode.into())
            .expect("compat vnode object should convert");

        assert!(matches!(input.r#type, MountInputType::Element(ref tag) if tag == "div"));
        assert_eq!(input.children.len(), 2);
        assert!(matches!(&input.children[0], MountInputChild::Text(text) if text == "A"));
        assert!(matches!(&input.children[1], MountInputChild::Input(child) if matches!(child.r#type, MountInputType::Element(ref tag) if tag == "strong")));
    }
}
