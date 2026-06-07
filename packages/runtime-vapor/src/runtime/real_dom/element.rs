/*
真实元素挂载

根据标签创建宿主元素，应用初始 props，递归挂载 children，并记录 Patch subtree。
该文件主要服务 compat Element 路径，默认 Vapor 子树通常会直接携带 host node。
*/
use crate::runtime::Rue;
use crate::runtime::dom_adapter::DomAdapter;
use crate::runtime::props::{Props as RuntimeProps, patch_props, post_patch_element};
use crate::runtime::types::compat_state::MountedCompatPatchKind;
use crate::runtime::types::{
    MountInput, MountInputChild, MountedPatchSubtree, MountedSubtreeChild, MountedSubtreeState,
    MountedTextSubtree,
};
use wasm_bindgen::JsValue;

/// 通过 DomAdapter 根据标签创建元素
#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
fn build_element<A: DomAdapter>(
    rue: &mut Rue<A>,
    tag: &String,
    parent_context: Option<&A::Element>,
) -> Option<A::Element> {
    match rue.get_dom_adapter_mut() {
        Some(a) => Some(a.create_element_in_parent(tag.as_str(), parent_context)),
        None => {
            rue.handle_error(JsValue::from_str("runtime:create_real_dom Element no adapter"));
            None
        }
    }
}

fn collect_input_props<A: DomAdapter>(input: &MountInput<A>) -> RuntimeProps {
    let mut new_props: RuntimeProps = RuntimeProps::new();
    for (k, v) in input.props.iter() {
        new_props.insert(k.clone(), v.clone());
    }
    new_props
}

/// 应用初始属性（与空映射 diff）到元素
#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
fn apply_initial_props<A: DomAdapter>(
    rue: &mut Rue<A>,
    el: &mut A::Element,
    new_props: &RuntimeProps,
) {
    if let Some(a) = rue.get_dom_adapter_mut() {
        let empty = RuntimeProps::new();
        if let Err(e) = patch_props(a, el, &empty, new_props) {
            rue.handle_error(e);
        }
    } else {
        rue.handle_error(JsValue::from_str(
            "runtime:create_real_dom Element patch_props no adapter",
        ));
    }
}

fn mount_children<A: DomAdapter>(
    rue: &mut Rue<A>,
    el: &mut A::Element,
    input: &MountInput<A>,
) -> Vec<MountedSubtreeChild<A>>
where
    A::Element: From<JsValue> + Into<JsValue> + Clone,
{
    let mut mounted_children = Vec::new();
    for child in input.children.iter() {
        mounted_children.extend(mount_child(rue, el, child));
    }

    mounted_children
}

#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
fn mount_child<A: DomAdapter>(
    rue: &mut Rue<A>,
    el: &mut A::Element,
    child: &MountInputChild<A>,
) -> Option<MountedSubtreeChild<A>>
where
    A::Element: From<JsValue> + Into<JsValue> + Clone,
{
    match child {
        MountInputChild::Text(text) => {
            if let Some(adapter) = rue.get_dom_adapter_mut() {
                let tn = adapter.create_text_node(text);
                adapter.append_child(el, &tn);
                return Some(MountedSubtreeChild::Subtree(MountedSubtreeState::Text(
                    MountedTextSubtree {
                        host: Some(tn),
                        key: None,
                        cleanup_bucket: None,
                        effect_scope_id: None,
                    },
                )));
            }
            None
        }
        MountInputChild::Input(node) => {
            if let Some(mounted_child) = rue.mount_from_input(node, Some(el)) {
                append_mounted_child_host(rue, el, &mounted_child);
                return Some(MountedSubtreeChild::Subtree(mounted_child));
            }
            None
        }
    }
}

#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
fn append_mounted_child_host<A: DomAdapter>(
    rue: &mut Rue<A>,
    el: &mut A::Element,
    mounted_child: &MountedSubtreeState<A>,
) where
    A::Element: From<JsValue> + Into<JsValue> + Clone,
{
    if let Some(child_el) = mounted_child.host_cloned() {
        if let Some(adapter) = rue.get_dom_adapter_mut() {
            adapter.append_child(el, &child_el);
        }
    }
}

pub(super) fn mount_element<A: DomAdapter>(
    rue: &mut Rue<A>,
    input: &MountInput<A>,
    tag: &String,
    parent_context: Option<&A::Element>,
) -> Option<MountedSubtreeState<A>>
where
    A::Element: Clone + From<JsValue> + Into<JsValue>,
{
    #[cfg(wasm_bindgen_unstable_test_coverage)]
    let mut el =
        build_element(rue, tag, parent_context).expect("adapter is checked before element mount");

    #[cfg(not(wasm_bindgen_unstable_test_coverage))]
    let mut el = build_element(rue, tag, parent_context)?;

    let new_props = collect_input_props(input);
    apply_initial_props(rue, &mut el, &new_props);
    let mounted_children = if !new_props.contains_key("dangerouslySetInnerHTML") {
        mount_children(rue, &mut el, input)
    } else {
        Vec::new()
    };
    post_patch(rue, &mut el, &new_props);

    Some(MountedSubtreeState::Patch(MountedPatchSubtree::new_compat(
        MountedCompatPatchKind::Element(tag.clone()),
        input.props.clone(),
        mounted_children,
        Some(el),
        input.key.clone(),
        Vec::new(),
        None,
        None,
    )))
}

/// 元素级别后置补丁：执行元素特定的最终处理
#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
fn post_patch<A: DomAdapter>(rue: &mut Rue<A>, el: &mut A::Element, new_props: &RuntimeProps) {
    if let Some(a) = rue.get_dom_adapter_mut() {
        if let Err(e) = post_patch_element(a, el, new_props) {
            handle_post_patch_error(rue, e);
        }
    } else {
        rue.handle_error(JsValue::from_str(
            "runtime:create_real_dom Element post_patch no adapter",
        ));
    }
}

#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
fn handle_post_patch_error<A: DomAdapter>(rue: &mut Rue<A>, error: JsValue) {
    rue.handle_error(error);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::runtime::js_adapter::JsDomAdapter;
    use crate::runtime::types::{ComponentProps, MountInputType};
    use js_sys::{Array, Function, Object, Reflect};
    use std::marker::PhantomData;
    use wasm_bindgen_test::*;

    fn set_prop(target: &Object, key: &str, value: JsValue) {
        Reflect::set(target, &JsValue::from_str(key), &value).unwrap();
    }

    fn adapter() -> JsDomAdapter {
        let obj = Object::new();
        for (name, func) in [
            (
                "createElement",
                Function::new_with_args(
                    "tag,parent",
                    "return { tag, children: [], nodeType: 1, createdIn: parent && parent.tag }",
                ),
            ),
            (
                "createTextNode",
                Function::new_with_args("text", "return { tag: '#text', text, nodeType: 3 }"),
            ),
            (
                "createDocumentFragment",
                Function::new_no_args("return { tag: 'fragment', children: [], nodeType: 11 }"),
            ),
            ("isFragment", Function::new_with_args("el", "return el.tag === 'fragment'")),
            (
                "collectFragmentChildren",
                Function::new_with_args("el", "return Array.from(el.children || [])"),
            ),
            ("setTextContent", Function::new_with_args("el,text", "el.text = text")),
            (
                "appendChild",
                Function::new_with_args("p,c", "p.children = p.children||[]; p.children.push(c)"),
            ),
            (
                "insertBefore",
                Function::new_with_args("p,c,b", "p.children = p.children||[]; p.children.push(c)"),
            ),
            (
                "removeChild",
                Function::new_with_args("p,c", "p.children = (p.children||[]).filter(x=>x!==c)"),
            ),
            (
                "contains",
                Function::new_with_args("p,c", "return p === c || (p.children||[]).includes(c)"),
            ),
            ("setClassName", Function::new_with_args("el,v", "el.class = v")),
            ("patchStyle", Function::new_with_args("el,old,next", "return")),
            (
                "setInnerHTML",
                Function::new_with_args("el,html", "el.children = []; el.innerHTML = html"),
            ),
            ("setValue", Function::new_with_args("el,v", "el.value = v")),
            ("setChecked", Function::new_with_args("el,b", "el.checked = !!b")),
            ("setDisabled", Function::new_with_args("el,b", "el.disabled = !!b")),
            ("clearRef", Function::new_with_args("r", "return")),
            ("applyRef", Function::new_with_args("el,r", "return")),
            ("setAttribute", Function::new_with_args("el,k,v", "el[k] = v")),
            ("removeAttribute", Function::new_with_args("el,k", "delete el[k]")),
            ("getTagName", Function::new_with_args("el", "return el.tag || ''")),
            ("addEventListener", Function::new_with_args("el,evt,h", "return")),
            ("removeEventListener", Function::new_with_args("el,evt,h", "return")),
            ("hasValueProperty", Function::new_with_args("el", "return 'value' in el")),
            ("isSelectMultiple", Function::new_with_args("el", "return !!el.multiple")),
            ("querySelector", Function::new_with_args("sel", "return null")),
        ] {
            set_prop(&obj, name, func.into());
        }
        JsDomAdapter::new(obj.into())
    }

    fn empty_input(tag: &str) -> MountInput<JsDomAdapter> {
        MountInput::new_normalized(
            MountInputType::<JsDomAdapter>::Element(tag.to_string()),
            ComponentProps::new(),
            Vec::new(),
        )
    }

    #[cfg(not(wasm_bindgen_unstable_test_coverage))]
    #[wasm_bindgen_test]
    fn mount_element_covers_no_adapter_and_inner_html_skip_children() {
        let mut no_adapter = Rue::<JsDomAdapter>::new();
        let input = empty_input("div");
        assert!(mount_element(&mut no_adapter, &input, &"div".to_string(), None).is_none());
        assert!(no_adapter.last_error.is_some());

        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let mut props = RuntimeProps::new();
        props.insert("dangerouslySetInnerHTML".to_string(), JsValue::from_str("<b>x</b>"));
        let input = MountInput::new_normalized(
            MountInputType::<JsDomAdapter>::Element("section".to_string()),
            props,
            vec![MountInputChild::Text("ignored".to_string())],
        );
        let mounted = mount_element(&mut rue, &input, &"section".to_string(), None)
            .expect("element should mount");
        assert!(mounted.host_cloned().is_some());
        match mounted {
            MountedSubtreeState::Patch(patch) => {
                assert!(patch.compat.children.is_empty());
            }
            _ => panic!("element mount should produce compat patch state"),
        }
    }

    #[wasm_bindgen_test]
    fn mount_element_mounts_props_text_input_and_parent_context() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());

        let parent = Object::new();
        set_prop(&parent, "tag", JsValue::from_str("svg"));
        let child = MountInput::new_normalized(
            MountInputType::<JsDomAdapter>::Element("span".to_string()),
            ComponentProps::new(),
            vec![MountInputChild::Text("nested".to_string())],
        );
        let mut props = ComponentProps::new();
        props.insert("className".to_string(), JsValue::from_str("card"));
        props.insert("data-id".to_string(), JsValue::from_f64(7.0));
        let input = MountInput::new_normalized(
            MountInputType::<JsDomAdapter>::Element("section".to_string()),
            props,
            vec![MountInputChild::Text("lead".to_string()), MountInputChild::Input(child)],
        );

        let mounted =
            mount_element(&mut rue, &input, &"section".to_string(), Some(&parent.clone().into()))
                .expect("element should mount");
        let MountedSubtreeState::Patch(patch) = mounted else {
            panic!("element mount should produce compat patch state");
        };

        assert_eq!(patch.compat.children.len(), 2);
        let host = patch.el.expect("host element");
        assert_eq!(
            Reflect::get(&host, &JsValue::from_str("createdIn")).unwrap().as_string().as_deref(),
            Some("svg")
        );
        assert_eq!(
            Reflect::get(&host, &JsValue::from_str("class")).unwrap().as_string().as_deref(),
            Some("card")
        );
        assert_eq!(
            Reflect::get(&host, &JsValue::from_str("data-id")).unwrap().as_string().as_deref(),
            Some("7")
        );
        let children = Array::from(&Reflect::get(&host, &JsValue::from_str("children")).unwrap());
        assert_eq!(children.length(), 2);
        assert_eq!(
            Reflect::get(&children.get(0), &JsValue::from_str("text"))
                .unwrap()
                .as_string()
                .as_deref(),
            Some("lead")
        );
        assert_eq!(
            Reflect::get(&children.get(1), &JsValue::from_str("tag"))
                .unwrap()
                .as_string()
                .as_deref(),
            Some("span")
        );
    }

    #[wasm_bindgen_test]
    fn mount_element_skips_unmountable_input_children() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let phantom = MountInput {
            r#type: MountInputType::<JsDomAdapter>::_Phantom(PhantomData),
            props: ComponentProps::new(),
            children: Vec::new(),
            key: None,
            strict_component_returns: false,
            mount_cleanup_bucket: None,
            mount_effect_scope_id: None,
            el_hint: None,
        };
        let input = MountInput::new_normalized(
            MountInputType::<JsDomAdapter>::Element("div".to_string()),
            ComponentProps::new(),
            vec![MountInputChild::Input(phantom)],
        );

        let mounted = mount_element(&mut rue, &input, &"div".to_string(), None)
            .expect("element should mount");
        let MountedSubtreeState::Patch(patch) = mounted else {
            panic!("element mount should produce compat patch state");
        };

        assert!(patch.compat.children.is_empty());
        let host = patch.el.expect("host element");
        let children = Array::from(&Reflect::get(&host, &JsValue::from_str("children")).unwrap());
        assert_eq!(children.length(), 0);
    }

    #[wasm_bindgen_test]
    fn element_private_helpers_report_missing_adapter_and_patch_errors() {
        let mut no_adapter = Rue::<JsDomAdapter>::new();
        let mut el = Object::new().into();
        let props = ComponentProps::new();

        apply_initial_props(&mut no_adapter, &mut el, &props);
        assert_eq!(
            no_adapter.last_error.as_ref().and_then(JsValue::as_string).as_deref(),
            Some("runtime:create_real_dom Element patch_props no adapter")
        );

        no_adapter.last_error = None;
        post_patch(&mut no_adapter, &mut el, &props);
        assert_eq!(
            no_adapter.last_error.as_ref().and_then(JsValue::as_string).as_deref(),
            Some("runtime:create_real_dom Element post_patch no adapter")
        );

        let mut throwing = Rue::<JsDomAdapter>::new();
        throwing.set_dom_adapter(adapter());
        let mut throwing_props = ComponentProps::new();
        let throwing_style = Function::new_no_args(
            "return new Proxy({}, { ownKeys(){ return ['color']; }, getOwnPropertyDescriptor(){ return { enumerable: true, configurable: true }; }, get(){ throw new Error('style failed') } })",
        )
        .call0(&JsValue::UNDEFINED)
        .unwrap();
        throwing_props.insert("style".to_string(), throwing_style);
        apply_initial_props(&mut throwing, &mut el, &throwing_props);
        assert!(throwing.last_error.as_ref().is_some_and(JsValue::is_object));
    }
}
