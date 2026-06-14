/*
Compat children patch

在 compat Element/Fragment 路径下，对 mounted children 与新的 MountInput children 做增量更新。
默认 Vapor 主路径尽量绕开旧 children diff，但兼容层仍需要维护这套行为。
*/
use super::super::Rue;
use super::super::types::{
    MountInput, MountInputChild, MountedSubtreeChild, MountedSubtreeState, MountedTextSubtree,
};
use crate::runtime::dom_adapter::DomAdapter;
use wasm_bindgen::JsValue;

impl<A: DomAdapter> Rue<A>
where
    A::Element: Clone,
{
    fn keyed_first_dom_node_for_mounted(
        &self,
        mounted: &MountedSubtreeState<A>,
    ) -> Option<A::Element> {
        mounted.fragment_nodes().first().cloned().or_else(|| mounted.host_cloned())
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn keyed_old_key_map(
        old_children: &mut [MountedSubtreeChild<A>],
    ) -> std::collections::HashMap<String, usize> {
        let mut old_key_map = std::collections::HashMap::new();
        for (idx, ch) in old_children.iter_mut().enumerate() {
            if let MountedSubtreeChild::Subtree(v) = ch {
                if let Some(k) = v.key() {
                    old_key_map.insert(k.clone(), idx);
                }
            }
        }
        old_key_map
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn keyed_insert_text(
        &mut self,
        parent: &mut A::Element,
        s: &str,
        cursor: &mut Option<A::Element>,
        anchor_opt: &Option<A::Element>,
    ) -> MountedTextSubtree<A> {
        if let Some(a) = self.get_dom_adapter_mut() {
            let tn = a.create_text_node(s);
            if let Some(am) = self.get_dom_adapter_mut() {
                match cursor.as_ref() {
                    Some(cur) => am.insert_before(parent, &tn, cur),
                    None => {
                        if let Some(anchor) = anchor_opt {
                            am.insert_before(parent, &tn, anchor);
                        } else {
                            am.append_child(parent, &tn);
                        }
                    }
                }
            }
            *cursor = Some(tn.clone());
            MountedTextSubtree {
                host: Some(tn),
                key: None,
                cleanup_bucket: None,
                effect_scope_id: None,
            }
        } else {
            MountedTextSubtree {
                host: None,
                key: None,
                cleanup_bucket: None,
                effect_scope_id: None,
            }
        }
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn keyed_patch_existing_text(
        &mut self,
        parent: &mut A::Element,
        old_text: &MountedTextSubtree<A>,
        s: &str,
        cursor: &mut Option<A::Element>,
        anchor_opt: &Option<A::Element>,
    ) -> MountedTextSubtree<A> {
        let mut mounted = old_text.clone();
        if let Some(mut text_node) = mounted.host.clone() {
            if let Some(adapter) = self.get_dom_adapter_mut() {
                adapter.set_text_content(&mut text_node, s);
                match cursor.as_ref() {
                    Some(cur) => adapter.insert_before(parent, &text_node, cur),
                    None => {
                        if let Some(anchor) = anchor_opt {
                            adapter.insert_before(parent, &text_node, anchor);
                        } else {
                            adapter.append_child(parent, &text_node);
                        }
                    }
                }
            }
            mounted.host = Some(text_node.clone());
            *cursor = Some(text_node);
        }

        mounted
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn keyed_move_or_create_input_existing(
        &mut self,
        parent: &mut A::Element,
        nc: &MountInput<A>,
        old_children: &mut [MountedSubtreeChild<A>],
        old_key_map: &std::collections::HashMap<String, usize>,
        cursor: &mut Option<A::Element>,
        anchor_opt: &Option<A::Element>,
    ) -> Option<MountedSubtreeState<A>>
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        if let Some(MountedSubtreeChild::Subtree(oldv)) =
            old_children.get_mut(*old_key_map.get(&nc.key.clone().unwrap()).unwrap())
        {
            self.patch(oldv, nc, parent);
            let mounted = oldv.clone();
            let mut node_for_move: Option<A::Element> = None;
            let fragment_nodes = mounted.fragment_nodes();
            if !fragment_nodes.is_empty() {
                if let Some(am) = self.get_dom_adapter_mut() {
                    for n in fragment_nodes.iter() {
                        match cursor.as_ref() {
                            Some(cur) => am.insert_before(parent, n, cur),
                            None => {
                                if let Some(anchor) = anchor_opt {
                                    am.insert_before(parent, n, anchor);
                                } else {
                                    am.append_child(parent, n);
                                }
                            }
                        }
                    }
                }
                node_for_move = fragment_nodes.first().cloned();
            }

            if node_for_move.is_none() {
                if let Some(el_c) = mounted.host_cloned() {
                    if let Some(am) = self.get_dom_adapter_mut() {
                        match cursor.as_ref() {
                            Some(cur) => am.insert_before(parent, &el_c, cur),
                            None => {
                                if let Some(anchor) = anchor_opt {
                                    am.insert_before(parent, &el_c, anchor);
                                } else {
                                    am.append_child(parent, &el_c);
                                }
                            }
                        }
                    }
                    node_for_move = Some(el_c);
                }
            }
            *cursor = node_for_move.clone().or(cursor.clone());
            Some(mounted)
        } else {
            None
        }
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn keyed_create_input_new(
        &mut self,
        parent: &mut A::Element,
        nc: &MountInput<A>,
        cursor: &mut Option<A::Element>,
        anchor_opt: &Option<A::Element>,
    ) -> Option<MountedSubtreeState<A>>
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        if let Some(mounted) = self.mount_from_input(nc, Some(parent)) {
            let first_dom_node = self.keyed_first_dom_node_for_mounted(&mounted);
            let fragment_nodes = mounted.fragment_nodes();
            if !fragment_nodes.is_empty() {
                if let Some(am) = self.get_dom_adapter_mut() {
                    for n in fragment_nodes.iter() {
                        match cursor.as_ref() {
                            Some(cur) => am.insert_before(parent, n, cur),
                            None => {
                                if let Some(anchor) = anchor_opt {
                                    am.insert_before(parent, n, anchor);
                                } else {
                                    am.append_child(parent, n);
                                }
                            }
                        }
                    }
                }
            } else if let Some(child_el) = mounted.host_cloned() {
                if let Some(am) = self.get_dom_adapter_mut() {
                    match cursor.as_ref() {
                        Some(cur) => am.insert_before(parent, &child_el, cur),
                        None => {
                            if let Some(anchor) = anchor_opt {
                                am.insert_before(parent, &child_el, anchor);
                            } else {
                                am.append_child(parent, &child_el);
                            }
                        }
                    }
                }
            }
            *cursor = first_dom_node.or(cursor.clone());
            Some(mounted)
        } else {
            None
        }
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn keyed_push_created_input(
        &mut self,
        parent: &mut A::Element,
        nc: &MountInput<A>,
        cursor: &mut Option<A::Element>,
        anchor_opt: &Option<A::Element>,
        mounted_children_rev: &mut Vec<MountedSubtreeChild<A>>,
    ) where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        if let Some(mounted) = self.keyed_create_input_new(parent, nc, cursor, anchor_opt) {
            mounted_children_rev.push(MountedSubtreeChild::Subtree(mounted));
        }
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn keyed_cleanup_old_removed(
        &mut self,
        parent: &mut A::Element,
        old_children: &mut [MountedSubtreeChild<A>],
        reused_old_indexes: &std::collections::HashSet<usize>,
    ) where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        for (idx, oc) in old_children.iter_mut().enumerate() {
            if reused_old_indexes.contains(&idx) {
                continue;
            }
            if let MountedSubtreeChild::Subtree(ov) = oc {
                let lifecycle = ov.lifecycle_record();
                let host = ov.host_cloned();
                let fragment_nodes = ov.fragment_nodes_cloned();

                self.invoke_before_unmount_record(&lifecycle);
                self.clear_mounted_dom_identity(parent, host.as_ref(), &fragment_nodes);
                self.invoke_unmounted_record(&lifecycle);
            }
        }
    }

    pub(super) fn patch_children_keyed(
        &mut self,
        parent: &mut A::Element,
        old_children: &mut [MountedSubtreeChild<A>],
        new_children: &[MountInputChild<A>],
    ) -> Vec<MountedSubtreeChild<A>>
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        let anchor_opt = self.current_anchor.clone().filter(|anchor| {
            self.get_dom_adapter().is_some_and(|adapter| adapter.contains(parent, anchor))
        });
        let old_key_map = Self::keyed_old_key_map(old_children);

        let mut reused_old_indexes = std::collections::HashSet::new();
        let mut cursor: Option<A::Element> = None;
        let mut mounted_children_rev: Vec<MountedSubtreeChild<A>> = Vec::new();
        let mut i: i32 = (new_children.len() as i32) - 1;
        while i >= 0 {
            let ch = &new_children[i as usize];
            match ch {
                MountInputChild::Text(s) => {
                    if let Some(MountedSubtreeChild::Subtree(MountedSubtreeState::Text(old_text))) =
                        old_children.get(i as usize)
                    {
                        reused_old_indexes.insert(i as usize);
                        let mounted_text = self.keyed_patch_existing_text(
                            parent,
                            old_text,
                            s.as_str(),
                            &mut cursor,
                            &anchor_opt,
                        );
                        mounted_children_rev.push(MountedSubtreeChild::Subtree(
                            MountedSubtreeState::Text(mounted_text),
                        ));
                    } else {
                        let mounted_text =
                            self.keyed_insert_text(parent, s.as_str(), &mut cursor, &anchor_opt);
                        mounted_children_rev.push(MountedSubtreeChild::Subtree(
                            MountedSubtreeState::Text(mounted_text),
                        ));
                    }
                }
                MountInputChild::Input(nc) => {
                    let key = nc.key.clone().unwrap_or_default();
                    if nc.key.is_some() && old_key_map.contains_key(&key) {
                        reused_old_indexes.insert(*old_key_map.get(&key).unwrap());
                        let mounted = self
                            .keyed_move_or_create_input_existing(
                                parent,
                                nc,
                                old_children,
                                &old_key_map,
                                &mut cursor,
                                &anchor_opt,
                            )
                            .expect("key map entries are built from mounted subtree children");
                        mounted_children_rev.push(MountedSubtreeChild::Subtree(mounted));
                    } else if nc.key.is_none() {
                        if let Some(MountedSubtreeChild::Subtree(oldv)) =
                            old_children.get_mut(i as usize)
                        {
                            if oldv.key().is_none() {
                                reused_old_indexes.insert(i as usize);
                                self.patch(oldv, nc, parent);
                                cursor =
                                    self.keyed_first_dom_node_for_mounted(oldv).or(cursor.clone());
                                mounted_children_rev
                                    .push(MountedSubtreeChild::Subtree(oldv.clone()));
                                i -= 1;
                                continue;
                            }
                        }
                        self.keyed_push_created_input(
                            parent,
                            nc,
                            &mut cursor,
                            &anchor_opt,
                            &mut mounted_children_rev,
                        );
                    } else {
                        self.keyed_push_created_input(
                            parent,
                            nc,
                            &mut cursor,
                            &anchor_opt,
                            &mut mounted_children_rev,
                        );
                    }
                }
            }
            i -= 1;
        }

        self.keyed_cleanup_old_removed(parent, old_children, &reused_old_indexes);
        mounted_children_rev.reverse();
        mounted_children_rev
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::runtime::js_adapter::JsDomAdapter;
    use crate::runtime::types::{
        ComponentProps, MountInputType, MountedVaporSubtree, MountedVaporSubtreeType,
    };
    use js_sys::{Array, Function, Object, Reflect};
    use std::collections::HashMap;
    use wasm_bindgen_test::*;

    fn text_state(key: Option<&str>, host: Option<JsValue>) -> MountedSubtreeState<JsDomAdapter> {
        MountedSubtreeState::Text(MountedTextSubtree {
            host,
            key: key.map(str::to_string),
            cleanup_bucket: None,
            effect_scope_id: None,
        })
    }

    fn vapor_fragment_state(key: &str) -> MountedSubtreeState<JsDomAdapter> {
        MountedSubtreeState::Vapor(MountedVaporSubtree {
            r#type: MountedVaporSubtreeType::Vapor,
            host: None,
            key: Some(key.to_string()),
            fragment_nodes: vec![JsValue::from_str("fragment-child")],
            cleanup_bucket: None,
            effect_scope_id: None,
        })
    }

    fn keyed_input(key: &str, r#type: MountInputType<JsDomAdapter>) -> MountInput<JsDomAdapter> {
        let mut props = ComponentProps::new();
        props.insert("key".to_string(), JsValue::from_str(key));
        MountInput::new_normalized(r#type, props, Vec::new())
    }

    fn set_fn(obj: &Object, name: &str, args: &str, body: &str) {
        Reflect::set(obj, &JsValue::from_str(name), &Function::new_with_args(args, body).into())
            .unwrap();
    }

    fn adapter() -> JsDomAdapter {
        let obj = Object::new();
        set_fn(
            &obj,
            "createElement",
            "tag",
            "return { tag, tagName: String(tag).toUpperCase(), children: [], nodeType: 1 }",
        );
        set_fn(
            &obj,
            "createTextNode",
            "text",
            "return { tag: '#text', tagName: '#TEXT', text, nodeValue: text, children: [], nodeType: 3 }",
        );
        set_fn(
            &obj,
            "createDocumentFragment",
            "",
            "return { tag: 'fragment', tagName: 'FRAGMENT', children: [], nodeType: 11 }",
        );
        set_fn(&obj, "isFragment", "el", "return !!el && el.tag === 'fragment'");
        set_fn(&obj, "collectFragmentChildren", "el", "return Array.from(el && el.children || [])");
        set_fn(&obj, "setTextContent", "el,text", "el.text = text; el.nodeValue = text");
        set_fn(
            &obj,
            "appendChild",
            "p,c",
            "p.children = p.children || []; \
             const items = c && c.tag === 'fragment' ? Array.from(c.children || []) : [c]; \
             for (const item of items) { \
               const old = item && item.parentNode; \
               if (old && old.children) old.children = old.children.filter(x => x !== item); \
               p.children.push(item); item.parentNode = p; \
             }",
        );
        set_fn(
            &obj,
            "insertBefore",
            "p,c,b",
            "p.children = p.children || []; \
             const items = c && c.tag === 'fragment' ? Array.from(c.children || []) : [c]; \
             for (const item of items) { \
               const old = item && item.parentNode; \
               if (old && old.children) old.children = old.children.filter(x => x !== item); \
               const i = p.children.indexOf(b); \
               i >= 0 ? p.children.splice(i, 0, item) : p.children.push(item); \
               item.parentNode = p; \
             }",
        );
        set_fn(
            &obj,
            "removeChild",
            "p,c",
            "p.children = (p.children || []).filter(x => x !== c); if (c) c.parentNode = null",
        );
        set_fn(
            &obj,
            "contains",
            "p,c",
            "function has(root,node){ return root === node || Array.from(root && root.children || []).some(ch => has(ch,node)); } return has(p,c)",
        );
        set_fn(&obj, "setClassName", "el,v", "el.className = v");
        set_fn(&obj, "patchStyle", "el,old,next", "el.style = next");
        set_fn(&obj, "setInnerHTML", "el,html", "el.children = []; el.text = html");
        set_fn(&obj, "setValue", "el,v", "el.value = v");
        set_fn(&obj, "setChecked", "el,b", "el.checked = !!b");
        set_fn(&obj, "setDisabled", "el,b", "el.disabled = !!b");
        set_fn(&obj, "clearRef", "r", "return");
        set_fn(&obj, "applyRef", "el,r", "return");
        set_fn(&obj, "setAttribute", "el,k,v", "el.attrs = el.attrs || {}; el.attrs[k] = v");
        set_fn(&obj, "removeAttribute", "el,k", "if (el.attrs) delete el.attrs[k]");
        set_fn(&obj, "getTagName", "el", "return el && (el.tagName || el.tag) || ''");
        set_fn(&obj, "addEventListener", "el,evt,h", "return");
        set_fn(&obj, "removeEventListener", "el,evt,h", "return");
        set_fn(&obj, "hasValueProperty", "el", "return !!el && ('value' in el)");
        set_fn(
            &obj,
            "isSelectMultiple",
            "el",
            "return !!el && el.tagName === 'SELECT' && !!el.multiple",
        );
        set_fn(&obj, "querySelector", "sel", "return { tag: sel, children: [], nodeType: 1 }");
        JsDomAdapter::new(obj.into())
    }

    fn node(tag: &str) -> JsValue {
        let obj = Object::new();
        Reflect::set(&obj, &JsValue::from_str("tag"), &JsValue::from_str(tag)).unwrap();
        Reflect::set(
            &obj,
            &JsValue::from_str("tagName"),
            &JsValue::from_str(&tag.to_ascii_uppercase()),
        )
        .unwrap();
        Reflect::set(&obj, &JsValue::from_str("children"), &Array::new().into()).unwrap();
        Reflect::set(&obj, &JsValue::from_str("nodeType"), &JsValue::from_f64(1.0)).unwrap();
        obj.into()
    }

    fn set_children(parent: &JsValue, children: &[JsValue]) {
        let arr = Array::new();
        for child in children {
            arr.push(child);
            Reflect::set(child, &JsValue::from_str("parentNode"), parent).unwrap();
        }
        Reflect::set(parent, &JsValue::from_str("children"), &arr.into()).unwrap();
    }

    fn child_labels(parent: &JsValue) -> Vec<String> {
        let children =
            Reflect::get(parent, &JsValue::from_str("children")).unwrap_or(Array::new().into());
        Array::from(&children)
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

    fn unkeyed_element_input(tag: &str) -> MountInput<JsDomAdapter> {
        MountInput::new_normalized(
            MountInputType::Element(tag.to_string()),
            ComponentProps::new(),
            Vec::new(),
        )
    }

    fn keyed_element_input(key: &str, tag: &str) -> MountInput<JsDomAdapter> {
        keyed_input(key, MountInputType::Element(tag.to_string()))
    }

    fn vapor_host_state(key: Option<&str>, host: JsValue) -> MountedSubtreeState<JsDomAdapter> {
        MountedSubtreeState::Vapor(MountedVaporSubtree {
            r#type: MountedVaporSubtreeType::Vapor,
            host: Some(host),
            key: key.map(str::to_string),
            fragment_nodes: Vec::new(),
            cleanup_bucket: None,
            effect_scope_id: None,
        })
    }

    fn vapor_fragment_state_with_nodes(
        key: Option<&str>,
        fragment_nodes: Vec<JsValue>,
    ) -> MountedSubtreeState<JsDomAdapter> {
        MountedSubtreeState::Vapor(MountedVaporSubtree {
            r#type: MountedVaporSubtreeType::Vapor,
            host: None,
            key: key.map(str::to_string),
            fragment_nodes,
            cleanup_bucket: None,
            effect_scope_id: None,
        })
    }

    #[wasm_bindgen_test]
    fn patch_children_without_adapter_covers_text_fallbacks() {
        let mut rue: Rue<JsDomAdapter> = Rue::new();
        rue.current_anchor = Some(JsValue::from_str("anchor"));
        let mut parent = JsValue::from_str("parent");

        let mut empty_old = Vec::new();
        let mounted = rue.patch_children_keyed(
            &mut parent,
            empty_old.as_mut_slice(),
            &[MountInputChild::Text("fresh".to_string())],
        );
        assert!(matches!(
            mounted.as_slice(),
            [MountedSubtreeChild::Subtree(MountedSubtreeState::Text(text))] if text.host.is_none()
        ));

        let mut old_text = vec![MountedSubtreeChild::Subtree(text_state(
            None,
            Some(JsValue::from_str("old-host")),
        ))];
        let mounted = rue.patch_children_keyed(
            &mut parent,
            old_text.as_mut_slice(),
            &[MountInputChild::Text("updated".to_string())],
        );
        assert!(matches!(
            mounted.as_slice(),
            [MountedSubtreeChild::Subtree(MountedSubtreeState::Text(text))]
                if text.host.as_ref().and_then(JsValue::as_string).as_deref() == Some("old-host")
        ));

        let mut plain_old = vec![MountedSubtreeChild::Text("plain-old".to_string())];
        let mounted = rue.patch_children_keyed(&mut parent, plain_old.as_mut_slice(), &[]);
        assert!(mounted.is_empty());

        let mut empty_old = Vec::new();
        let mounted = rue.patch_children_keyed(
            &mut parent,
            empty_old.as_mut_slice(),
            &[MountInputChild::Input(unkeyed_element_input("missing-adapter"))],
        );
        assert!(mounted.is_empty());

        let mut empty_old = Vec::new();
        let mounted = rue.patch_children_keyed(
            &mut parent,
            empty_old.as_mut_slice(),
            &[MountInputChild::Input(keyed_element_input("missing", "missing-adapter"))],
        );
        assert!(mounted.is_empty());
    }

    #[wasm_bindgen_test]
    fn keyed_existing_input_handles_no_adapter_and_non_subtree_edges() {
        let mut rue: Rue<JsDomAdapter> = Rue::new();
        rue.current_anchor = Some(JsValue::from_str("anchor"));
        let mut parent = JsValue::from_str("parent");
        let mut cursor = None;

        let mut non_subtree_old = vec![MountedSubtreeChild::Text("not-a-subtree".to_string())];
        let old_key_map = HashMap::from([("ghost".to_string(), 0usize)]);
        let ghost = keyed_input("ghost", MountInputType::Text("next".to_string()));
        assert!(
            rue.keyed_move_or_create_input_existing(
                &mut parent,
                &ghost,
                non_subtree_old.as_mut_slice(),
                &old_key_map,
                &mut cursor,
                &None,
            )
            .is_none()
        );

        let mut keyed_text_old = vec![MountedSubtreeChild::Subtree(text_state(
            Some("text"),
            Some(JsValue::from_str("text-host")),
        ))];
        let old_key_map = HashMap::from([("text".to_string(), 0usize)]);
        let text = keyed_input("text", MountInputType::Text("updated".to_string()));
        let mounted = rue
            .keyed_move_or_create_input_existing(
                &mut parent,
                &text,
                keyed_text_old.as_mut_slice(),
                &old_key_map,
                &mut cursor,
                &None,
            )
            .expect("keyed text should still be returned without an adapter");
        assert_eq!(
            mounted.host_cloned().and_then(|host| host.as_string()).as_deref(),
            Some("text-host")
        );

        let mut fragment_old = vec![MountedSubtreeChild::Subtree(vapor_fragment_state("fragment"))];
        let old_key_map = HashMap::from([("fragment".to_string(), 0usize)]);
        let fragment = keyed_input("fragment", MountInputType::Vapor);
        let mounted = rue
            .keyed_move_or_create_input_existing(
                &mut parent,
                &fragment,
                fragment_old.as_mut_slice(),
                &old_key_map,
                &mut cursor,
                &None,
            )
            .expect("keyed fragment should still be returned without an adapter");
        assert_eq!(mounted.fragment_nodes().len(), 1);
    }

    #[wasm_bindgen_test]
    fn keyed_create_input_new_returns_none_without_adapter() {
        let mut rue: Rue<JsDomAdapter> = Rue::new();
        let mut parent = JsValue::from_str("parent");
        let mut cursor = None;
        let input = keyed_input("new", MountInputType::Text("new".to_string()));

        assert!(rue.keyed_create_input_new(&mut parent, &input, &mut cursor, &None).is_none());
    }

    #[wasm_bindgen_test]
    fn patch_children_keyed_covers_anchor_text_unkeyed_and_cleanup_dom_paths() {
        let mut rue: Rue<JsDomAdapter> = Rue::new();
        rue.set_dom_adapter(adapter());
        let mut parent = node("parent");
        let anchor = node("anchor");
        let plain_old = node("plain-old");
        let keyed_old = node("keyed-old");
        let duplicate_old = node("duplicate-old");
        let stale_text = node("#text");
        Reflect::set(&stale_text, &JsValue::from_str("text"), &JsValue::from_str("stale")).unwrap();
        set_children(
            &parent,
            &[
                plain_old.clone(),
                keyed_old.clone(),
                duplicate_old.clone(),
                stale_text.clone(),
                anchor.clone(),
            ],
        );
        rue.current_anchor = Some(anchor.clone());

        let mut old_children = vec![
            MountedSubtreeChild::Text("plain-child-record".to_string()),
            MountedSubtreeChild::Subtree(vapor_host_state(None, plain_old)),
            MountedSubtreeChild::Subtree(vapor_host_state(Some("dup"), keyed_old)),
            MountedSubtreeChild::Subtree(vapor_host_state(Some("dup"), duplicate_old)),
            MountedSubtreeChild::Subtree(text_state(None, Some(stale_text))),
        ];
        let new_children = vec![
            MountInputChild::Text("fresh-left".to_string()),
            MountInputChild::Input(unkeyed_element_input("plain-next")),
            MountInputChild::Input(keyed_element_input("dup", "keyed-next")),
            MountInputChild::Text("fresh-right".to_string()),
        ];

        let mounted =
            rue.patch_children_keyed(&mut parent, old_children.as_mut_slice(), &new_children);

        assert_eq!(mounted.len(), 4);
        assert_eq!(
            child_labels(&parent),
            vec!["fresh-left", "plain-next", "keyed-next", "fresh-right", "anchor"]
        );
    }

    #[wasm_bindgen_test]
    fn keyed_helpers_cover_fragment_host_cursor_and_detached_anchor_paths() {
        let mut rue: Rue<JsDomAdapter> = Rue::new();
        rue.set_dom_adapter(adapter());
        let mut parent = node("parent");
        let anchor = node("anchor");
        let cursor_node = node("cursor");
        let fragment_a = node("fragment-a");
        let fragment_b = node("fragment-b");
        let host = node("host");
        set_children(
            &parent,
            &[
                host.clone(),
                fragment_a.clone(),
                fragment_b.clone(),
                cursor_node.clone(),
                anchor.clone(),
            ],
        );

        let mut fragment_old = vec![MountedSubtreeChild::Subtree(vapor_fragment_state_with_nodes(
            Some("fragment"),
            vec![fragment_a.clone(), fragment_b.clone()],
        ))];
        let old_key_map = HashMap::from([("fragment".to_string(), 0usize)]);
        let mut cursor = Some(cursor_node.clone());
        let fragment = keyed_input("fragment", MountInputType::Vapor);
        let mounted = rue
            .keyed_move_or_create_input_existing(
                &mut parent,
                &fragment,
                fragment_old.as_mut_slice(),
                &old_key_map,
                &mut cursor,
                &None,
            )
            .expect("fragment move should keep mounted state");
        assert_eq!(mounted.fragment_nodes().len(), 2);
        assert_eq!(
            child_labels(&parent),
            vec!["host", "fragment-a", "fragment-b", "cursor", "anchor"]
        );

        let mut host_old =
            vec![MountedSubtreeChild::Subtree(vapor_host_state(Some("host"), host.clone()))];
        let old_key_map = HashMap::from([("host".to_string(), 0usize)]);
        cursor = Some(cursor_node);
        let host_input = keyed_input("host", MountInputType::Vapor);
        let mounted = rue
            .keyed_move_or_create_input_existing(
                &mut parent,
                &host_input,
                host_old.as_mut_slice(),
                &old_key_map,
                &mut cursor,
                &Some(anchor.clone()),
            )
            .expect("host move should keep mounted state");
        assert!(mounted.host_cloned().is_some());

        let mut fragment_input =
            MountInput::new_normalized(MountInputType::Fragment, ComponentProps::new(), Vec::new());
        fragment_input.children = vec![
            MountInputChild::Text("fresh-a".to_string()),
            MountInputChild::Input(unkeyed_element_input("fresh-b")),
        ];
        cursor = None;
        let mounted = rue
            .keyed_create_input_new(
                &mut parent,
                &fragment_input,
                &mut cursor,
                &Some(anchor.clone()),
            )
            .expect("fragment input should mount");
        assert!(mounted.host_cloned().is_some() || !mounted.fragment_nodes().is_empty());
        let labels = child_labels(&parent);
        assert!(labels.iter().any(|label| label == "fresh-a"));
        assert!(labels.iter().any(|label| label == "fresh-b"));

        let mut detached_anchor_parent = node("detached-parent");
        rue.current_anchor = Some(node("detached-anchor"));
        let mut empty_old = Vec::new();
        let mounted = rue.patch_children_keyed(
            &mut detached_anchor_parent,
            empty_old.as_mut_slice(),
            &[MountInputChild::Text("no-contained-anchor".to_string())],
        );
        assert!(matches!(
            mounted.as_slice(),
            [MountedSubtreeChild::Subtree(MountedSubtreeState::Text(text))] if text.host.is_some()
        ));
        assert_eq!(child_labels(&detached_anchor_parent), vec!["no-contained-anchor"]);
    }
}
