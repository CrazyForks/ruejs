/*
真实 Fragment 挂载

创建 DocumentFragment，依次挂载输入 children，并记录 fragment_nodes。
这些节点快照对后续区间清理、替换和生命周期递归很关键。
*/
use crate::runtime::Rue;
use crate::runtime::dom_adapter::DomAdapter;
use crate::runtime::types::compat_state::MountedCompatPatchKind;
use crate::runtime::types::{
    MountInput, MountInputChild, MountedPatchSubtree, MountedSubtreeChild, MountedSubtreeState,
};
use wasm_bindgen::JsValue;

#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
fn create_fragment_host<A: DomAdapter>(rue: &mut Rue<A>) -> A::Element
where
    A::Element: Clone,
{
    rue.get_dom_adapter_mut()
        .expect("runtime:mount Fragment adapter exists before compat fragment dispatch")
        .create_document_fragment()
}

pub(super) fn mount_fragment<A: DomAdapter>(
    rue: &mut Rue<A>,
    input: &MountInput<A>,
    parent_context: Option<&A::Element>,
) -> Option<MountedSubtreeState<A>>
where
    A::Element: Clone + From<JsValue> + Into<JsValue>,
{
    let mut frag = create_fragment_host(rue);

    let mut mounted_children = Vec::new();
    for child in input.children.iter() {
        match child {
            MountInputChild::Input(node) => {
                let Some(mounted_child) = rue.mount_from_input(node, parent_context) else {
                    continue;
                };
                for child_el in mounted_child.host_cloned().into_iter() {
                    let adapter = rue
                        .get_dom_adapter_mut()
                        .expect("runtime:mount Fragment adapter exists after fragment create");
                    adapter.append_child(&mut frag, &child_el);
                }
                mounted_children.push(MountedSubtreeChild::Subtree(mounted_child));
            }
            MountInputChild::Text(text) => {
                let adapter = rue
                    .get_dom_adapter_mut()
                    .expect("runtime:mount Fragment adapter exists while mounting text child");
                let tn = adapter.create_text_node(text);
                adapter.append_child(&mut frag, &tn);
                mounted_children.push(MountedSubtreeChild::Subtree(MountedSubtreeState::Text(
                    crate::runtime::types::MountedTextSubtree {
                        host: Some(tn),
                        key: None,
                        cleanup_bucket: None,
                        effect_scope_id: None,
                    },
                )));
            }
        }
    }

    let adapter = rue
        .get_dom_adapter()
        .expect("runtime:mount Fragment adapter exists while collecting fragment nodes");
    let fragment_nodes = if adapter.is_fragment(&frag) {
        adapter.collect_fragment_children(&frag)
    } else {
        Vec::new()
    };

    Some(MountedSubtreeState::Patch(MountedPatchSubtree::new_compat(
        MountedCompatPatchKind::Fragment,
        input.props.clone(),
        mounted_children,
        Some(frag),
        input.key.clone(),
        fragment_nodes,
        input.mount_cleanup_bucket.clone(),
        input.mount_effect_scope_id,
    )))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::runtime::js_adapter::JsDomAdapter;
    use crate::runtime::types::{ComponentProps, MountInputType, MountedSubtreeState};
    use js_sys::{Array, Function, Object, Reflect};
    use wasm_bindgen_test::*;

    fn set_fn(obj: &Object, name: &str, args: &str, body: &str) {
        Reflect::set(obj, &JsValue::from_str(name), &Function::new_with_args(args, body).into())
            .unwrap();
    }

    fn adapter(fragment_tag: &str) -> JsDomAdapter {
        let obj = Object::new();
        set_fn(&obj, "createElement", "tag", "return { tag, children: [], nodeType: 1 }");
        set_fn(&obj, "createTextNode", "text", "return { tag: '#text', text, nodeType: 3 }");
        set_fn(
            &obj,
            "createDocumentFragment",
            "",
            &format!("return {{ tag: '{fragment_tag}', children: [], nodeType: 11 }}"),
        );
        set_fn(&obj, "isFragment", "el", "return !!el && el.tag === 'fragment'");
        set_fn(&obj, "collectFragmentChildren", "el", "return Array.from(el && el.children || [])");
        set_fn(&obj, "setTextContent", "el,text", "el.text = text");
        set_fn(
            &obj,
            "appendChild",
            "p,c",
            "p.children = p.children || []; p.children.push(c); c.parentNode = p",
        );
        set_fn(&obj, "insertBefore", "p,c,b", "p.children = p.children || []; p.children.push(c)");
        set_fn(&obj, "removeChild", "p,c", "p.children = (p.children || []).filter(x => x !== c)");
        set_fn(&obj, "contains", "p,c", "return p === c || (p.children || []).includes(c)");
        set_fn(&obj, "setClassName", "el,v", "el.class = v");
        set_fn(&obj, "patchStyle", "el,old,next", "el.style = next");
        set_fn(&obj, "setInnerHTML", "el,html", "el.children = []; el.text = html");
        set_fn(&obj, "setValue", "el,v", "el.value = v");
        set_fn(&obj, "setChecked", "el,b", "el.checked = !!b");
        set_fn(&obj, "setDisabled", "el,b", "el.disabled = !!b");
        set_fn(&obj, "clearRef", "ref", "return");
        set_fn(&obj, "applyRef", "el,ref", "return");
        set_fn(&obj, "setAttribute", "el,k,v", "el[k] = v");
        set_fn(&obj, "removeAttribute", "el,k", "delete el[k]");
        set_fn(&obj, "getTagName", "el", "return el && (el.tag || el.tagName) || ''");
        set_fn(&obj, "addEventListener", "el,e,h", "return");
        set_fn(&obj, "removeEventListener", "el,e,h", "return");
        set_fn(&obj, "hasValueProperty", "el", "return 'value' in el");
        set_fn(&obj, "isSelectMultiple", "el", "return !!el.multiple");
        set_fn(&obj, "querySelector", "selector", "return null");
        JsDomAdapter::new(obj.into())
    }

    fn fragment_input(children: Vec<MountInputChild<JsDomAdapter>>) -> MountInput<JsDomAdapter> {
        let mut props = ComponentProps::new();
        props.insert("key".to_string(), JsValue::from_str("frag-key"));
        props.insert("__rue_cleanup_bucket".to_string(), Array::new().into());
        props.insert("__rue_effect_scope_id".to_string(), JsValue::from_f64(31.0));
        MountInput::new_normalized(MountInputType::Fragment, props, children)
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn expect_patch(
        mounted: MountedSubtreeState<JsDomAdapter>,
    ) -> MountedPatchSubtree<JsDomAdapter> {
        match mounted {
            MountedSubtreeState::Patch(patch) => patch,
            _ => panic!("expected patch state"),
        }
    }

    #[wasm_bindgen_test]
    fn mount_fragment_mounts_text_and_input_children_and_records_nodes() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter("fragment"));
        let child = MountInput::new_normalized(
            MountInputType::Text("nested".to_string()),
            ComponentProps::new(),
            vec![],
        );
        let input = fragment_input(vec![
            MountInputChild::Input(child),
            MountInputChild::Text("inline".to_string()),
        ]);

        let mounted = mount_fragment(&mut rue, &input, None).expect("fragment state");
        let patch = expect_patch(mounted);
        assert_eq!(patch.key.as_deref(), Some("frag-key"));
        assert_eq!(patch.fragment_nodes.len(), 2);
        assert_eq!(patch.compat.children.len(), 2);
        let host = patch.el.expect("fragment host");
        let children = Array::from(&Reflect::get(&host, &JsValue::from_str("children")).unwrap());
        assert_eq!(children.length(), 2);
    }

    #[wasm_bindgen_test]
    fn mount_fragment_records_empty_fragment_snapshot() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter("fragment"));
        let input = fragment_input(vec![]);

        let mounted = mount_fragment(&mut rue, &input, None).expect("fragment state");
        let patch = expect_patch(mounted);

        assert!(patch.fragment_nodes.is_empty());
        assert!(patch.compat.children.is_empty());
        let host = patch.el.expect("fragment host");
        let children = Array::from(&Reflect::get(&host, &JsValue::from_str("children")).unwrap());
        assert_eq!(children.length(), 0);
    }

    #[wasm_bindgen_test]
    fn mount_fragment_skips_input_child_that_cannot_mount() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter("fragment"));
        let missing_host_child =
            MountInput::new_normalized(MountInputType::Vapor, ComponentProps::new(), vec![]);
        let input = fragment_input(vec![
            MountInputChild::Input(missing_host_child),
            MountInputChild::Text("after".to_string()),
        ]);

        let mounted = mount_fragment(&mut rue, &input, None).expect("fragment state");
        let patch = expect_patch(mounted);

        assert_eq!(patch.fragment_nodes.len(), 1);
        assert_eq!(patch.compat.children.len(), 1);
        let host = patch.el.expect("fragment host");
        let children = Array::from(&Reflect::get(&host, &JsValue::from_str("children")).unwrap());
        assert_eq!(children.length(), 1);
        assert_eq!(
            Reflect::get(&children.get(0), &JsValue::from_str("text"))
                .unwrap()
                .as_string()
                .as_deref(),
            Some("after")
        );
    }

    #[wasm_bindgen_test]
    fn mount_fragment_keeps_empty_snapshot_when_adapter_host_is_not_fragment() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter("not-fragment"));
        let input = fragment_input(vec![MountInputChild::Text("inline".to_string())]);

        let mounted = mount_fragment(&mut rue, &input, None).expect("fragment state");
        let patch = expect_patch(mounted);

        assert!(patch.fragment_nodes.is_empty());
        assert_eq!(patch.compat.children.len(), 1);
    }
}
