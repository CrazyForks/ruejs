/*
静态锚点挂载

用于一次性插入不会再由父层更新的子树。
挂载后移除临时 anchor，不写 range_map，减少静态内容的后续维护成本。
*/
use super::super::Rue;
use super::super::types::MountInput;
use crate::reactive::core::batch_scope;
use crate::runtime::dom_adapter::DomAdapter;
use crate::runtime::error_strings;
use js_sys::Array;
use wasm_bindgen::JsValue;
use wasm_bindgen::throw_str;

// 静态锚点挂载（render_static）：
// - 使用单个临时锚点作为插入定位，挂载完成后移除该锚点
// - 不写入 range_map，也不保留 start/end 成对注释，适合“父层不会再重跑”的静态子树
// - 常见场景：静态组件、静态 JSX 插槽在编译期已确认不会由父级驱动更新

impl<A: DomAdapter> Rue<A>
where
    A::Element: Clone,
{
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn assert_static_runtime_ready(&self) {
        if self.crashed || crate::runtime::is_runtime_crashed() {
            if let Some(e) = crate::runtime::last_hook_error() {
                wasm_bindgen::throw_val(e);
            } else if let Some(e) = self.last_error.clone() {
                wasm_bindgen::throw_val(e);
            } else {
                throw_str(error_strings::RUNTIME_CRASHED);
            }
        }

        if self.get_dom_adapter().is_none() {
            throw_str(error_strings::NO_DOM_RENDER_STATIC);
        }
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn handle_static_mount_failure(&mut self) {
        let err_to_handle = if let Some(e) = self.last_error.clone() {
            e
        } else {
            js_sys::Error::new(error_strings::RENDER_STATIC_FAILED_NO_DOM).into()
        };
        self.handle_error(err_to_handle);
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn sync_static_mount_frag_nodes(&mut self, parent: &A::Element, mounted_nodes: &[A::Element])
    where
        <A as DomAdapter>::Element: Into<JsValue>,
    {
        let parent_js: JsValue = parent.clone().into();
        let arr_val = js_sys::Reflect::get(&parent_js, &JsValue::from_str("__rue_frag_nodes_ref"))
            .unwrap_or(JsValue::UNDEFINED);
        if arr_val.is_undefined() {
            return;
        }
        if arr_val.is_null() {
            return;
        }
        if !Array::is_array(&arr_val) {
            return;
        }

        let arr = Array::from(&arr_val);
        arr.set_length(0);
        for node in mounted_nodes.iter() {
            let node_js: JsValue = node.clone().into();
            arr.push(&node_js);
        }
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn mount_static_nodes_before_anchor(
        &mut self,
        input: &MountInput<A>,
        parent: &mut A::Element,
        dest_parent: &mut A::Element,
        anchor: &A::Element,
        mounted_nodes: &mut Vec<A::Element>,
    ) -> bool
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        let Some(mounted) = self.mount_from_input(input, Some(parent)) else {
            self.handle_static_mount_failure();
            return false;
        };

        let el = mounted.host_cloned().expect(error_strings::STATIC_HOST_MISSING);
        let is_fragment = self.get_dom_adapter().is_some_and(|adapter| adapter.is_fragment(&el));
        if is_fragment {
            *mounted_nodes = mounted.fragment_nodes_cloned();
            self.insert_fragment_children_preferring_end(dest_parent, &el, &Some(anchor.clone()));
        } else {
            mounted_nodes.push(el.clone());
            self.insert_new_dom_before_end(dest_parent, &el, anchor);
        }
        true
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn call_static_mounted_hook_if_needed(&mut self, mounted: bool) {
        if mounted {
            self.call_hooks("mounted");
        }
    }

    /// 在单个锚点前执行一次性静态 MountInput 挂载，并在成功后移除锚点。
    ///
    /// 默认公开路径直接消费 MountInput；静态挂载只在局部边界记录 mounted state，
    /// 不再经过额外树对象协议。
    pub fn render_static_input(
        &mut self,
        input: MountInput<A>,
        parent: &mut A::Element,
        anchor: A::Element,
    ) where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        self.render_static_impl(&input, parent, anchor);
    }

    fn render_static_impl(
        &mut self,
        input: &MountInput<A>,
        parent: &mut A::Element,
        anchor: A::Element,
    ) where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        self.assert_static_runtime_ready();

        batch_scope(|| {
            self.call_hooks("before_mount");

            let mut dest_parent = self.resolve_dest_parent_for_end(parent, &anchor);
            let mut mounted_nodes: Vec<A::Element> = Vec::new();
            let mounted = self.mount_static_nodes_before_anchor(
                input,
                parent,
                &mut dest_parent,
                &anchor,
                &mut mounted_nodes,
            );

            let adapter = self.get_dom_adapter_mut().expect(error_strings::STATIC_DOM_CHECKED);
            if adapter.contains(&dest_parent, &anchor) {
                let mut p2 = dest_parent.clone();
                adapter.remove_child(&mut p2, &anchor);
            }

            self.sync_static_mount_frag_nodes(parent, &mounted_nodes);
            self.call_static_mounted_hook_if_needed(mounted);
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::runtime::js_adapter::JsDomAdapter;
    use crate::runtime::types::{ComponentProps, MountInputType};
    use js_sys::{Array, Function, Object, Reflect};
    use wasm_bindgen_test::*;

    fn set_prop(target: &Object, key: &str, value: JsValue) {
        Reflect::set(target, &JsValue::from_str(key), &value).unwrap();
    }

    fn adapter() -> JsDomAdapter {
        let obj = Object::new();
        for (name, args, body) in [
            ("createElement", "tag", "return { tag, children: [], nodeType: 1 }"),
            ("createTextNode", "text", "return { tag: '#text', text, nodeType: 3 }"),
            (
                "createDocumentFragment",
                "",
                "return { tag: 'fragment', children: [], nodeType: 11 }",
            ),
            ("isFragment", "el", "return !!el && el.tag === 'fragment'"),
            ("collectFragmentChildren", "el", "return Array.from(el && el.children || [])"),
            ("setTextContent", "el,text", "el.text = text"),
            (
                "appendChild",
                "p,c",
                "p.children = p.children || []; if (c && c.tag === 'fragment') p.children.push(...Array.from(c.children || [])); else p.children.push(c)",
            ),
            (
                "insertBefore",
                "p,c,b",
                "p.children = p.children || []; const idx = p.children.indexOf(b); const at = idx < 0 ? p.children.length : idx; const list = c && c.tag === 'fragment' ? Array.from(c.children || []) : [c]; p.children.splice(at, 0, ...list)",
            ),
            ("removeChild", "p,c", "p.children = (p.children || []).filter(x => x !== c)"),
            ("contains", "p,c", "return p === c || (p.children || []).includes(c)"),
            ("setClassName", "el,v", "el.className = v"),
            ("patchStyle", "el,old,next", "el.style = next"),
            ("setInnerHTML", "el,html", "el.children = []; el.innerHTML = html"),
            ("setValue", "el,v", "el.value = v"),
            ("setChecked", "el,b", "el.checked = !!b"),
            ("setDisabled", "el,b", "el.disabled = !!b"),
            ("clearRef", "r", "return"),
            ("applyRef", "el,r", "return"),
            ("setAttribute", "el,k,v", "el[k] = v"),
            ("removeAttribute", "el,k", "delete el[k]"),
            ("getTagName", "el", "return el.tag || ''"),
            ("addEventListener", "el,evt,h", "return"),
            ("removeEventListener", "el,evt,h", "return"),
            ("hasValueProperty", "el", "return 'value' in el"),
            ("isSelectMultiple", "el", "return !!el.multiple"),
            ("querySelector", "sel", "return null"),
        ] {
            set_prop(&obj, name, Function::new_with_args(args, body).into());
        }
        JsDomAdapter::new(obj.into())
    }

    fn phantom_input() -> MountInput<JsDomAdapter> {
        MountInput {
            r#type: MountInputType::_Phantom(std::marker::PhantomData),
            props: ComponentProps::new(),
            children: Vec::new(),
            key: None,
            strict_component_returns: false,
            mount_cleanup_bucket: None,
            mount_effect_scope_id: None,
            el_hint: None,
        }
    }

    fn vapor_input(host: JsValue) -> MountInput<JsDomAdapter> {
        MountInput {
            r#type: MountInputType::Vapor,
            props: ComponentProps::new(),
            children: Vec::new(),
            key: None,
            strict_component_returns: false,
            mount_cleanup_bucket: None,
            mount_effect_scope_id: None,
            el_hint: Some(host),
        }
    }

    fn child_labels(parent: &JsValue) -> Vec<String> {
        let children =
            Reflect::get(parent, &JsValue::from_str("children")).unwrap_or(Array::new().into());
        child_labels_from_array(&Array::from(&children))
    }

    fn child_labels_from_array(children: &Array) -> Vec<String> {
        children
            .iter()
            .map(|child| {
                let tag = Reflect::get(&child, &JsValue::from_str("tag"))
                    .unwrap_or(JsValue::UNDEFINED)
                    .as_string()
                    .unwrap_or_default();
                if tag == "#text" {
                    Reflect::get(&child, &JsValue::from_str("text"))
                        .unwrap_or(JsValue::UNDEFINED)
                        .as_string()
                        .unwrap_or_default()
                } else {
                    tag
                }
            })
            .collect()
    }

    #[wasm_bindgen_test]
    fn render_static_frag_node_sync_ignores_null_and_non_array_refs() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());

        let mut null_parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
        let null_anchor = rue.get_dom_adapter_mut().unwrap().create_element("null-anchor");
        rue.get_dom_adapter_mut().unwrap().append_child(&mut null_parent, &null_anchor);
        Reflect::set(&null_parent, &JsValue::from_str("__rue_frag_nodes_ref"), &JsValue::NULL)
            .unwrap();
        let null_host = rue.get_dom_adapter_mut().unwrap().create_element("null-host");
        rue.render_static_input(vapor_input(null_host), &mut null_parent, null_anchor);
        assert_eq!(child_labels(&null_parent), vec!["null-host"]);

        let mut scalar_parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
        let scalar_anchor = rue.get_dom_adapter_mut().unwrap().create_element("scalar-anchor");
        rue.get_dom_adapter_mut().unwrap().append_child(&mut scalar_parent, &scalar_anchor);
        Reflect::set(
            &scalar_parent,
            &JsValue::from_str("__rue_frag_nodes_ref"),
            &JsValue::from_str("not-array"),
        )
        .unwrap();
        let scalar_host = rue.get_dom_adapter_mut().unwrap().create_element("scalar-host");
        rue.render_static_input(vapor_input(scalar_host), &mut scalar_parent, scalar_anchor);
        assert_eq!(child_labels(&scalar_parent), vec!["scalar-host"]);
    }

    #[wasm_bindgen_test]
    fn render_static_covers_fragment_sync_and_create_none_error() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let mut parent = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
        let anchor = rue.get_dom_adapter_mut().unwrap().create_element("anchor");
        let frag_nodes_ref = Array::new();
        Reflect::set(
            &parent,
            &JsValue::from_str("__rue_frag_nodes_ref"),
            &frag_nodes_ref.clone().into(),
        )
        .unwrap();
        rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &anchor);

        let host = rue.get_dom_adapter_mut().unwrap().create_element("host");
        rue.render_static_input(vapor_input(host), &mut parent, anchor.clone());
        assert!(rue.last_error.is_none());

        let mut parent_fragment = rue.get_dom_adapter_mut().unwrap().create_document_fragment();
        let anchor_fragment = rue.get_dom_adapter_mut().unwrap().create_element("anchor-fragment");
        rue.get_dom_adapter_mut().unwrap().append_child(&mut parent_fragment, &anchor_fragment);
        let fragment = Object::new();
        set_prop(&fragment, "tag", JsValue::from_str("fragment"));
        let children = Array::new();
        let a = rue.get_dom_adapter_mut().unwrap().create_element("a");
        let b = rue.get_dom_adapter_mut().unwrap().create_element("b");
        children.push(&a);
        children.push(&b);
        set_prop(&fragment, "children", children.into());
        rue.render_static_input(
            vapor_input(fragment.into()),
            &mut parent_fragment,
            anchor_fragment,
        );

        let anchor2 = rue.get_dom_adapter_mut().unwrap().create_element("anchor2");
        rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &anchor2);
        rue.render_static_input(phantom_input(), &mut parent, anchor2);
        assert!(rue.last_error.is_some());

        let anchor3 = rue.get_dom_adapter_mut().unwrap().create_element("anchor3");
        rue.get_dom_adapter_mut().unwrap().append_child(&mut parent, &anchor3);
        rue.last_error = Some(JsValue::from_str("preexisting static error"));
        rue.render_static_input(phantom_input(), &mut parent, anchor3);
        assert_eq!(
            rue.last_error.as_ref().and_then(JsValue::as_string).as_deref(),
            Some("preexisting static error")
        );
    }

    #[wasm_bindgen_test]
    #[should_panic]
    fn render_static_panics_without_dom_adapter() {
        let mut rue = Rue::<JsDomAdapter>::new();
        let mut parent = Object::new().into();
        let anchor = Object::new().into();
        rue.render_static_input(phantom_input(), &mut parent, anchor);
    }

    #[wasm_bindgen_test]
    #[should_panic]
    fn render_static_panics_when_runtime_is_marked_crashed_without_last_error() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.crashed = true;
        let mut parent = Object::new().into();
        let anchor = Object::new().into();
        rue.render_static_input(phantom_input(), &mut parent, anchor);
    }
}
