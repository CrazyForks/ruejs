//! 真实 DOM 创建的入口与分发（中文增强版）
//!
//! - 按 MountInputType 分发到具体构建函数
//! - 无 DomAdapter 时走降级路径（fallback）
//! - 复用已缓存元素，避免重复创建
//! - 组件场景预计算 props（含 children）以便 JS 调用
//! - 保留 Vapor setup 直接返回块根节点的语义，不与组件默认返回协议混用
use super::Rue;
use super::types::{MountInput, MountInputType, MountedSubtreeState};
use crate::runtime::dom_adapter::DomAdapter;
use wasm_bindgen::JsValue;
#[cfg(feature = "compat")]
mod compat_mount;
#[cfg(feature = "compat")]
mod compat_vapor_wrapper;
pub(crate) mod component;
pub(crate) mod convert;
pub(crate) mod helpers;
mod text;
mod vapor;

#[inline(never)]
fn mount_core_input<A: DomAdapter>(
    rue: &mut Rue<A>,
    input: &MountInput<A>,
    parent_context: Option<&A::Element>,
) -> Option<MountedSubtreeState<A>>
where
    A::Element: Clone + From<JsValue> + Into<JsValue>,
{
    match &input.r#type {
        MountInputType::Text(_) => text::mount_text(rue, input),
        MountInputType::Vapor => vapor::mount_vapor(rue, input),
        MountInputType::VaporWithSetup(setup) => {
            vapor::mount_vapor_with_setup(rue, input, setup, parent_context)
        }
        MountInputType::Component(render_fn) => {
            component::mount_component(rue, input, render_fn, parent_context)
        }
        #[cfg(feature = "compat")]
        MountInputType::Fragment | MountInputType::Element(_) | MountInputType::_Phantom(_) => {
            std::hint::black_box(&input.r#type);
            None
        }
        #[cfg(not(feature = "compat"))]
        MountInputType::_Phantom(_) => {
            std::hint::black_box(&input.key);
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::runtime::js_adapter::JsDomAdapter;
    use crate::runtime::types::ComponentProps;
    use crate::runtime::{ComponentInternalInstance, LifecycleHooks};
    use js_sys::{Array, Function, Object, Reflect};
    use std::collections::HashMap;
    use std::marker::PhantomData;
    use wasm_bindgen_test::*;

    fn make_adapter() -> JsDomAdapter {
        let adapter = Object::new();
        let methods = [
            ("createElement", "tag", "return { tag, children: [] }"),
            ("createTextNode", "text", "return { tag: '#text', text }"),
            ("createDocumentFragment", "", "return { tag: 'fragment', children: [] }"),
            ("isFragment", "el", "return !!el && el.tag === 'fragment'"),
            ("collectFragmentChildren", "el", "return Array.from(el && el.children || [])"),
            ("setTextContent", "el,text", "el.text = text"),
            (
                "appendChild",
                "parent, child",
                "parent.children = parent.children || []; parent.children.push(child)",
            ),
            (
                "insertBefore",
                "parent, child, before",
                "parent.children = parent.children || []; parent.children.push(child)",
            ),
            (
                "removeChild",
                "parent, child",
                "parent.children = (parent.children || []).filter(x => x !== child)",
            ),
            (
                "contains",
                "parent, child",
                "return parent === child || (parent.children || []).includes(child)",
            ),
            ("setClassName", "el,value", "el.class = value"),
            ("patchStyle", "el,oldStyle,newStyle", "el.style = newStyle"),
            ("setInnerHTML", "el,html", "el.children = []; el.text = html"),
            ("setValue", "el,value", "el.value = value"),
            ("setChecked", "el,value", "el.checked = !!value"),
            ("setDisabled", "el,value", "el.disabled = !!value"),
            ("clearRef", "ref", "return"),
            ("applyRef", "el,ref", "return"),
            ("setAttribute", "el,key,value", "el[key] = value"),
            ("removeAttribute", "el,key", "delete el[key]"),
            ("getTagName", "el", "return el.tag || ''"),
            ("addEventListener", "el,event,handler", "return"),
            ("removeEventListener", "el,event,handler", "return"),
            ("hasValueProperty", "el", "return 'value' in el"),
            ("isSelectMultiple", "el", "return !!el.multiple"),
            ("querySelector", "selector", "return null"),
        ];
        for (name, args, body) in methods {
            Reflect::set(
                &adapter,
                &JsValue::from_str(name),
                &Function::new_with_args(args, body).into(),
            )
            .unwrap();
        }
        JsDomAdapter::new(adapter.into())
    }

    fn make_host(tag: &str) -> JsValue {
        let host = Object::new();
        Reflect::set(&host, &JsValue::from_str("tag"), &JsValue::from_str(tag)).unwrap();
        Reflect::set(&host, &JsValue::from_str("children"), &Array::new().into()).unwrap();
        Reflect::set(&host, &JsValue::from_str("nodeType"), &JsValue::from_f64(1.0)).unwrap();
        host.into()
    }

    fn dummy_instance(index: usize) -> ComponentInternalInstance<JsDomAdapter> {
        ComponentInternalInstance::<JsDomAdapter> {
            parent: None,
            is_mounted: false,
            hooks: LifecycleHooks(HashMap::new()),
            props_ro: Object::new().into(),
            host: Object::new().into(),
            render_scope_id: None,
            error: None,
            error_handlers: Vec::new(),
            index,
            _marker: PhantomData,
        }
    }

    #[wasm_bindgen_test]
    fn mount_core_input_covers_text_and_noop_variants() {
        let mut rue = Rue::<JsDomAdapter>::new();
        let text = MountInput::new_normalized(
            MountInputType::Text("core text".to_string()),
            ComponentProps::new(),
            Vec::new(),
        );
        assert!(rue.mount_from_input(&text, None).is_none());

        rue.set_dom_adapter(make_adapter());
        assert!(matches!(
            mount_core_input(&mut rue, &text, None),
            Some(MountedSubtreeState::Text(_))
        ));

        #[cfg(feature = "compat")]
        {
            let fragment =
                MountInput::new_normalized(MountInputType::Fragment, ComponentProps::new(), vec![]);
            assert!(mount_core_input(&mut rue, std::hint::black_box(&fragment), None).is_none());

            let element = MountInput::new_normalized(
                MountInputType::Element("compat-el".to_string()),
                ComponentProps::new(),
                vec![],
            );
            assert!(mount_core_input(&mut rue, std::hint::black_box(&element), None).is_none());
        }

        let phantom = MountInput {
            r#type: MountInputType::_Phantom(std::marker::PhantomData),
            props: ComponentProps::new(),
            children: Vec::new(),
            key: None,
            strict_component_returns: false,
            mount_cleanup_bucket: None,
            mount_effect_scope_id: None,
            el_hint: None,
        };
        assert!(mount_core_input(&mut rue, &phantom, None).is_none());
    }

    #[wasm_bindgen_test]
    fn mount_from_input_without_adapter_returns_none_before_dispatch() {
        let mut rue = Rue::<JsDomAdapter>::new();
        let input = MountInput::new_normalized(
            MountInputType::Text("no adapter".to_string()),
            ComponentProps::new(),
            Vec::new(),
        );

        let mounted = rue.mount_from_input(&input, None);
        assert!(mounted.is_none());
        assert!(rue.get_dom_adapter_mut().is_none());
    }

    #[cfg(feature = "compat")]
    #[wasm_bindgen_test]
    fn mount_core_input_covers_compat_noop_arms_directly() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(make_adapter());

        let fragment =
            MountInput::new_normalized(MountInputType::Fragment, ComponentProps::new(), Vec::new());
        assert!(mount_core_input(&mut rue, std::hint::black_box(&fragment), None).is_none());

        let element = MountInput::new_normalized(
            MountInputType::Element("compat-el".to_string()),
            ComponentProps::new(),
            Vec::new(),
        );
        assert!(mount_core_input(&mut rue, std::hint::black_box(&element), None).is_none());
    }

    #[wasm_bindgen_test]
    fn mount_core_input_dispatches_vapor_host_and_empty_host_paths() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(make_adapter());

        let mut vapor =
            MountInput::new_normalized(MountInputType::Vapor, ComponentProps::new(), Vec::new());
        let host = make_host("vapor-host");
        vapor.el_hint = Some(host.clone().into());
        let mounted = mount_core_input(&mut rue, &vapor, None).expect("vapor host should mount");
        assert!(matches!(mounted, MountedSubtreeState::Vapor(_)));
        assert!(js_sys::Object::is(&mounted.host_cloned().unwrap().into(), &host));

        let missing_host =
            MountInput::new_normalized(MountInputType::Vapor, ComponentProps::new(), Vec::new());
        assert!(mount_core_input(&mut rue, &missing_host, None).is_none());
    }

    #[wasm_bindgen_test]
    fn mount_core_input_dispatches_vapor_setup_and_fallback_setup_paths() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(make_adapter());

        let setup =
            Function::new_no_args("return { tag: 'setup-host', children: [], nodeType: 1 }");
        let input = MountInput::new_normalized(
            MountInputType::VaporWithSetup(setup.clone().into()),
            ComponentProps::new(),
            Vec::new(),
        );
        let mounted = mount_core_input(&mut rue, &input, None).expect("setup should mount");
        assert!(matches!(mounted, MountedSubtreeState::Vapor(_)));
        let host = mounted.host_cloned().unwrap();
        assert_eq!(
            Reflect::get(&host.into(), &JsValue::from_str("tag")).unwrap().as_string().as_deref(),
            Some("setup-host"),
        );

        let fallback_input = MountInput::new_normalized(
            MountInputType::VaporWithSetup(JsValue::from_str("not-a-function")),
            ComponentProps::new(),
            Vec::new(),
        );
        let fallback = mount_core_input(&mut rue, &fallback_input, None)
            .expect("non-function setup should use placeholder fallback");
        assert!(matches!(fallback, MountedSubtreeState::Vapor(_)));
        let fallback_host = fallback.host_cloned().unwrap();
        assert_eq!(
            Reflect::get(&fallback_host.into(), &JsValue::from_str("tag"))
                .unwrap()
                .as_string()
                .as_deref(),
            Some("div"),
        );
    }

    #[wasm_bindgen_test]
    fn mount_core_input_dispatches_component_path() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(make_adapter());
        rue.instance_store.insert(0, dummy_instance(0));

        let render = Function::new_no_args("return 'component-host'");
        let component = MountInput::new_normalized(
            MountInputType::Component(render.into()),
            ComponentProps::new(),
            Vec::new(),
        );
        let mounted = mount_core_input(&mut rue, &component, None).expect("component should mount");
        assert!(matches!(mounted, MountedSubtreeState::Patch(_)));
        assert_eq!(mounted.host_cloned().unwrap().as_string().as_deref(), Some("component-host"));
        assert!(rue.instance_stack.is_empty());
        crate::set_current_instance(JsValue::UNDEFINED);
    }
}

impl<A: DomAdapter> Rue<A>
where
    A::Element: Clone,
{
    pub(crate) fn mount_from_input(
        &mut self,
        input: &MountInput<A>,
        parent_context: Option<&A::Element>,
    ) -> Option<MountedSubtreeState<A>>
    where
        A::Element: From<JsValue> + Into<JsValue>,
    {
        if self.get_dom_adapter_mut().is_none() {
            std::hint::black_box(&input.r#type);
            return None;
        }

        #[cfg(feature = "compat")]
        {
            return compat_mount::mount_compat_input(self, input, parent_context);
        }

        #[cfg(not(feature = "compat"))]
        {
            mount_core_input(self, input, parent_context)
        }
    }
}
