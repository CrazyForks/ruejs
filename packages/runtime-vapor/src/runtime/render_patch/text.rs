/*
文本 patch

文本节点同类型更新时直接 set_text_content，缺失旧 host 时创建新文本节点。
这是最轻量的 patch 分支。
*/
use super::super::Rue;
use super::super::types::{MountInput, MountInputType, MountedTextSubtree};
use crate::runtime::dom_adapter::DomAdapter;

impl<A: DomAdapter> Rue<A>
where
    A::Element: Clone,
{
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub(crate) fn patch_text(
        &mut self,
        old_host: Option<A::Element>,
        new: &MountInput<A>,
    ) -> MountedTextSubtree<A> {
        let text = match &new.r#type {
            MountInputType::Text(text) => text.clone(),
            _ => String::new(),
        };

        if let Some(mut el_old) = old_host {
            if let Some(adapter) = self.get_dom_adapter_mut() {
                adapter.set_text_content(&mut el_old, &text);
            }
            MountedTextSubtree {
                host: Some(el_old),
                key: new.key.clone(),
                cleanup_bucket: new.mount_cleanup_bucket.clone(),
                effect_scope_id: new.mount_effect_scope_id,
            }
        } else {
            let parent_opt = self.get_current_container();
            if let Some(adapter) = self.get_dom_adapter_mut() {
                let text_el = adapter.create_text_node(text.as_str());
                if let Some(mut parent) = parent_opt {
                    adapter.append_child(&mut parent, &text_el);
                }
                MountedTextSubtree {
                    host: Some(text_el),
                    key: new.key.clone(),
                    cleanup_bucket: new.mount_cleanup_bucket.clone(),
                    effect_scope_id: new.mount_effect_scope_id,
                }
            } else {
                MountedTextSubtree {
                    host: None,
                    key: new.key.clone(),
                    cleanup_bucket: new.mount_cleanup_bucket.clone(),
                    effect_scope_id: new.mount_effect_scope_id,
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::runtime::js_adapter::JsDomAdapter;
    use crate::runtime::types::ComponentProps;
    use js_sys::{Array, Function, Object, Reflect};
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
            ("setTextContent", "el, text", "el.text = text"),
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
            ("setClassName", "el, value", "el.class = value"),
            ("patchStyle", "el, oldStyle, newStyle", "el.style = newStyle"),
            ("setInnerHTML", "el, html", "el.children = []; el.text = html"),
            ("setValue", "el, value", "el.value = value"),
            ("setChecked", "el, value", "el.checked = !!value"),
            ("setDisabled", "el, value", "el.disabled = !!value"),
            ("clearRef", "ref", "return"),
            ("applyRef", "el, ref", "return"),
            ("setAttribute", "el, key, value", "el[key] = value"),
            ("removeAttribute", "el, key", "delete el[key]"),
            ("getTagName", "el", "return el.tag || ''"),
            ("addEventListener", "el, event, handler", "return"),
            ("removeEventListener", "el, event, handler", "return"),
            ("hasValueProperty", "el", "return 'value' in el"),
            ("isSelectMultiple", "el", "return !!el.multiple"),
            (
                "querySelector",
                "selector",
                "return selector ? { tag: selector, children: [] } : null",
            ),
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

    fn text_input(text: &str) -> MountInput<JsDomAdapter> {
        MountInput {
            r#type: MountInputType::Text(text.to_string()),
            props: Default::default(),
            children: vec![],
            key: Some("text-key".to_string()),
            strict_component_returns: false,
            mount_cleanup_bucket: Some(Array::new().into()),
            mount_effect_scope_id: Some(8),
            el_hint: None,
        }
    }

    #[wasm_bindgen_test]
    fn patch_text_reuses_existing_host_and_preserves_mount_metadata() {
        let mut rue: Rue<JsDomAdapter> = Rue::new();
        rue.set_dom_adapter(make_adapter());
        let old_host = Object::new();
        Reflect::set(&old_host, &JsValue::from_str("text"), &JsValue::from_str("old")).unwrap();

        let mounted = rue.patch_text(Some(old_host.clone().into()), &text_input("new"));
        let host = mounted.host.expect("text host should be retained");

        assert!(js_sys::Object::is(&host, &old_host.into()));
        assert_eq!(
            Reflect::get(&host, &JsValue::from_str("text")).unwrap().as_string().as_deref(),
            Some("new")
        );
        assert_eq!(mounted.key.as_deref(), Some("text-key"));
        assert!(mounted.cleanup_bucket.is_some());
        assert_eq!(mounted.effect_scope_id, Some(8));
    }

    #[wasm_bindgen_test]
    fn patch_text_creates_and_appends_host_when_old_host_is_missing() {
        let mut rue: Rue<JsDomAdapter> = Rue::new();
        rue.set_dom_adapter(make_adapter());
        let parent = Object::new();
        rue.current_container = Some(parent.clone().into());

        let mounted = rue.patch_text(None, &text_input("created"));
        let host = mounted.host.expect("text host should be created");

        assert_eq!(
            Reflect::get(&host, &JsValue::from_str("text")).unwrap().as_string().as_deref(),
            Some("created")
        );
        let children = Array::from(&Reflect::get(&parent, &JsValue::from_str("children")).unwrap());
        assert_eq!(children.length(), 1);
        assert!(js_sys::Object::is(&children.get(0), &host));
    }

    #[wasm_bindgen_test]
    fn patch_text_covers_non_text_and_no_adapter_fallbacks() {
        let mut rue: Rue<JsDomAdapter> = Rue::new();
        let old_host = Object::new();
        let vapor_input =
            MountInput::new_normalized(MountInputType::Vapor, ComponentProps::new(), Vec::new());

        let retained = rue.patch_text(Some(old_host.clone().into()), &vapor_input);
        assert!(js_sys::Object::is(&retained.host.unwrap(), &old_host.into()));
        assert_eq!(retained.key, None);

        let missing_host = rue.patch_text(None, &text_input("no-adapter"));
        assert!(missing_host.host.is_none());
        assert_eq!(missing_host.key.as_deref(), Some("text-key"));
        assert!(missing_host.cleanup_bucket.is_some());
        assert_eq!(missing_host.effect_scope_id, Some(8));
    }

    #[wasm_bindgen_test]
    fn patch_text_creates_empty_text_for_non_text_input_without_old_host() {
        let mut rue: Rue<JsDomAdapter> = Rue::new();
        rue.set_dom_adapter(make_adapter());
        let parent = Object::new();
        rue.current_container = Some(parent.clone().into());
        let vapor_input =
            MountInput::new_normalized(MountInputType::Vapor, ComponentProps::new(), Vec::new());

        let mounted = rue.patch_text(None, &vapor_input);
        let host = mounted.host.expect("fallback text host should be created");

        assert_eq!(
            Reflect::get(&host, &JsValue::from_str("text")).unwrap().as_string().as_deref(),
            Some("")
        );
        let children = Array::from(&Reflect::get(&parent, &JsValue::from_str("children")).unwrap());
        assert_eq!(children.length(), 1);
        assert!(js_sys::Object::is(&children.get(0), &host));
    }
}
