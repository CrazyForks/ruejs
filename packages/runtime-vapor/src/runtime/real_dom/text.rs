/*
文本节点挂载

把 MountInput::Text 转成宿主文本节点，并记录 MountedTextSubtree。
文本是 patch 中最简单但最常见的分支，保持独立文件便于快速定位。
*/
use super::super::Rue;
use super::super::types::{MountInput, MountInputType, MountedSubtreeState, MountedTextSubtree};
use crate::runtime::dom_adapter::DomAdapter;

#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
fn text_content_from_input<A: DomAdapter>(input: &MountInput<A>) -> String {
    match &input.r#type {
        MountInputType::Text(text) => text.clone(),
        _ => String::new(),
    }
}

pub(crate) fn mount_text<A: DomAdapter>(
    rue: &mut Rue<A>,
    input: &MountInput<A>,
) -> Option<MountedSubtreeState<A>>
where
    A::Element: Clone,
{
    let text = text_content_from_input(input);
    let host = rue.get_dom_adapter_mut().map(|adapter| adapter.create_text_node(&text));

    Some(MountedSubtreeState::Text(MountedTextSubtree {
        host,
        key: input.key.clone(),
        cleanup_bucket: input.mount_cleanup_bucket.clone(),
        effect_scope_id: input.mount_effect_scope_id,
    }))
}

#[cfg(test)]
// text mount 测试，覆盖无 DOM adapter 时的 fallback mounted metadata。
mod tests {
    use super::*;
    use crate::runtime::js_adapter::JsDomAdapter;
    use crate::runtime::types::{ComponentProps, MountInputType};
    use js_sys::{Function, Object, Reflect};
    use wasm_bindgen::JsValue;
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

    #[wasm_bindgen_test]
    fn mount_text_falls_back_for_non_text_input_without_adapter() {
        let mut rue: Rue<JsDomAdapter> = Rue::new();
        let input =
            MountInput::new_normalized(MountInputType::Vapor, ComponentProps::new(), Vec::new());

        let mounted = mount_text(&mut rue, &input).expect("text subtree should be created");
        let MountedSubtreeState::Text(text) = mounted else {
            panic!("expected text subtree");
        };
        assert!(text.host.is_none());
        assert!(text.key.is_none());
        assert!(text.cleanup_bucket.is_none());
        assert!(text.effect_scope_id.is_none());
    }

    #[wasm_bindgen_test]
    fn mount_text_creates_text_host_when_adapter_exists() {
        let mut rue: Rue<JsDomAdapter> = Rue::new();
        rue.set_dom_adapter(make_adapter());
        let input = MountInput::new_normalized(
            MountInputType::Text("hello".to_string()),
            ComponentProps::new(),
            Vec::new(),
        );

        let mounted = mount_text(&mut rue, &input).expect("text subtree should be created");
        let MountedSubtreeState::Text(text) = mounted else {
            panic!("expected text subtree");
        };
        let host = text.host.expect("text host");
        assert_eq!(
            Reflect::get(&host, &JsValue::from_str("text")).unwrap().as_string().as_deref(),
            Some("hello")
        );
    }

    #[wasm_bindgen_test]
    fn mount_text_creates_empty_text_for_non_text_input_with_adapter() {
        let mut rue: Rue<JsDomAdapter> = Rue::new();
        rue.set_dom_adapter(make_adapter());
        let input =
            MountInput::new_normalized(MountInputType::Vapor, ComponentProps::new(), Vec::new());

        let mounted = mount_text(&mut rue, &input).expect("text subtree should be created");
        let MountedSubtreeState::Text(text) = mounted else {
            panic!("expected text subtree");
        };
        let host = text.host.expect("text host");

        assert_eq!(
            Reflect::get(&host, &JsValue::from_str("text")).unwrap().as_string().as_deref(),
            Some("")
        );
    }
}
