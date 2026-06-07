/*
Patch 子系统入口

根据 key/type 判断是同类更新还是整树替换：
- Text：直接改文本内容
- Component：复用实例并重新执行组件 render
- Vapor/host node：通常按替换处理
- Compat：委托 compat 边界处理旧式 Element/Fragment
*/
use super::Rue;
use super::types::{MountInput, MountedSubtreeState};
#[cfg(feature = "dev")]
use crate::log::{log, want_log};
use crate::runtime::dom_adapter::DomAdapter;
#[cfg(feature = "dev")]
use js_sys::Function;
#[cfg(feature = "dev")]
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;

#[cfg(feature = "compat")]
mod children;
#[cfg(feature = "compat")]
mod compat;
mod component;
mod replace;
mod replace_utils;
mod text;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::runtime::js_adapter::JsDomAdapter;
    use crate::runtime::types::{
        ComponentProps, MountInputType, MountedPatchSubtree, MountedSubtreeState,
        MountedTextSubtree, MountedVaporSubtree, MountedVaporSubtreeType,
    };
    use js_sys::{Function, Object, Reflect};
    use wasm_bindgen_test::*;

    fn set_fn(obj: &Object, name: &str, args: &str, body: &str) {
        Reflect::set(obj, &JsValue::from_str(name), &Function::new_with_args(args, body).into())
            .unwrap();
    }

    fn adapter() -> JsDomAdapter {
        let obj = Object::new();
        set_fn(&obj, "createElement", "tag", "return { tag, children: [], nodeType: 1 }");
        set_fn(&obj, "createTextNode", "text", "return { tag: '#text', text, nodeType: 3 }");
        set_fn(
            &obj,
            "createDocumentFragment",
            "",
            "return { tag: 'fragment', children: [], nodeType: 11 }",
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
        set_fn(
            &obj,
            "insertBefore",
            "p,c,b",
            "p.children = p.children || []; const i = p.children.indexOf(b); \
             if (i >= 0) p.children.splice(i, 0, c); else p.children.push(c); c.parentNode = p",
        );
        set_fn(
            &obj,
            "removeChild",
            "p,c",
            "p.children = (p.children || []).filter(x => x !== c); if (c) c.parentNode = null",
        );
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

    fn text_input(text: &str) -> MountInput<JsDomAdapter> {
        MountInput::new_normalized(
            MountInputType::Text(text.to_string()),
            ComponentProps::new(),
            vec![],
        )
    }

    #[wasm_bindgen_test]
    fn patch_core_same_updates_text_branch_directly() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let host = Object::new();
        Reflect::set(&host, &JsValue::from_str("text"), &JsValue::from_str("old")).unwrap();
        let mut old = MountedSubtreeState::Text(MountedTextSubtree {
            host: Some(host.clone().into()),
            key: None,
            cleanup_bucket: None,
            effect_scope_id: None,
        });
        let mut parent = Object::new().into();

        rue.patch_core_same(&mut old, &text_input("fresh"), &mut parent);

        let MountedSubtreeState::Text(text) = old else {
            panic!("expected text state");
        };
        let text_host = text.host.expect("text host");
        assert!(js_sys::Object::is(&text_host, &host.into()));
        assert_eq!(
            Reflect::get(&text_host, &JsValue::from_str("text")).unwrap().as_string().as_deref(),
            Some("fresh")
        );
    }

    #[wasm_bindgen_test]
    fn patch_replaces_when_key_presence_changes() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let old_host = Object::new();
        Reflect::set(&old_host, &JsValue::from_str("text"), &JsValue::from_str("old")).unwrap();
        let mut old = MountedSubtreeState::Text(MountedTextSubtree {
            host: Some(old_host.into()),
            key: None,
            cleanup_bucket: None,
            effect_scope_id: None,
        });
        let mut parent = Object::new().into();
        let mut props = ComponentProps::new();
        props.insert("key".to_string(), JsValue::from_str("new-key"));
        let new = MountInput::new_normalized(
            MountInputType::Text("replacement".to_string()),
            props,
            vec![],
        );

        rue.patch(&mut old, &new, &mut parent);

        assert_eq!(old.key().map(String::as_str), Some("new-key"));
    }

    #[wasm_bindgen_test]
    fn patch_core_same_routes_patch_and_vapor_variants() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let mut parent = Object::new().into();
        let component_fn =
            Function::new_no_args("return { tag: 'component-output', children: [] }");
        let mut patch_old = MountedSubtreeState::Patch(MountedPatchSubtree::new_component(
            component_fn.clone().into(),
            None,
            None,
            Vec::new(),
            Vec::new(),
            Vec::new(),
            Vec::new(),
            Vec::new(),
            None,
            None,
        ));
        let component_input = MountInput::new_normalized(
            MountInputType::Component(component_fn.into()),
            ComponentProps::new(),
            vec![],
        );

        rue.patch_core_same(&mut patch_old, &component_input, &mut parent);
        assert!(matches!(patch_old, MountedSubtreeState::Patch(_)));

        let vapor_host = Object::new();
        Reflect::set(&vapor_host, &JsValue::from_str("tag"), &JsValue::from_str("old-vapor"))
            .unwrap();
        let mut vapor_old = MountedSubtreeState::Vapor(MountedVaporSubtree {
            r#type: MountedVaporSubtreeType::Vapor,
            host: Some(vapor_host.into()),
            key: None,
            fragment_nodes: Vec::new(),
            cleanup_bucket: None,
            effect_scope_id: None,
        });
        let mut replacement =
            MountInput::new_normalized(MountInputType::Vapor, ComponentProps::new(), vec![]);
        let replacement_host = Object::new();
        Reflect::set(
            &replacement_host,
            &JsValue::from_str("tag"),
            &JsValue::from_str("next-vapor"),
        )
        .unwrap();
        replacement.el_hint = Some(replacement_host.clone().into());

        rue.patch_core_same(&mut vapor_old, &replacement, &mut parent);

        let MountedSubtreeState::Vapor(vapor) = vapor_old else {
            panic!("expected vapor state");
        };
        assert!(js_sys::Object::is(&vapor.host.unwrap(), &replacement_host.into()));
    }
}

impl<A: DomAdapter> Rue<A>
where
    A::Element: Clone,
{
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn patch_core_same(
        &mut self,
        old: &mut MountedSubtreeState<A>,
        new: &MountInput<A>,
        parent: &mut A::Element,
    ) where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        match old {
            MountedSubtreeState::Text(text) => {
                // 文本同类型更新最便宜：复用旧文本节点，只同步 textContent。
                let mounted_text = self.patch_text(text.host.clone(), new);
                *old = MountedSubtreeState::Text(mounted_text);
            }
            MountedSubtreeState::Patch(node) => {
                // Patch 节点目前主要是 Component/compat Element/Fragment，继续交给更具体的分支。
                self.patch_component_same(node, new, parent);
            }
            MountedSubtreeState::Vapor(_) => {
                // Vapor host node 多数由编译产物直接创建；同类型下也倾向替换真实节点，
                // 避免 Rust 侧尝试理解 JS/Vapor 内部结构。
                self.patch_replace(old, new, parent);
            }
        }
    }

    pub(crate) fn patch(
        &mut self,
        old: &mut MountedSubtreeState<A>,
        new: &MountInput<A>,
        parent: &mut A::Element,
    ) where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        let keys_changed = match (old.key(), &new.key) {
            (Some(ko), Some(kn)) => ko != kn,
            (None, Some(_)) | (Some(_), None) => true,
            _ => false,
        };
        let type_changed = !old.matches_input_type(&new.r#type);
        #[cfg(feature = "dev")]
        {
            if want_log("debug", "runtime:patch type_check") {
                let parent_desc = if let Some(adapter) = self.get_dom_adapter() {
                    adapter.get_tag_name(parent)
                } else {
                    String::from("<no-adapter>")
                };
                log("debug", &format!("runtime:patch type_check parent_tag={}", parent_desc));
                let old_key = old.key().cloned().unwrap_or_default();
                let new_key = new.key.clone().unwrap_or_default();
                if let (Some(of), super::types::MountInputType::Component(nf)) =
                    (old.component_render_fn(), &new.r#type)
                {
                    let old_name = of
                        .dyn_ref::<Function>()
                        .map(|f| String::from(f.name()))
                        .unwrap_or_else(|| String::from("<non-fn>"));
                    let new_name = nf
                        .dyn_ref::<Function>()
                        .map(|f| String::from(f.name()))
                        .unwrap_or_else(|| String::from("<non-fn>"));
                    log(
                        "debug",
                        &format!(
                            "runtime:patch type_check component of_name={} nf_name={} ptr_eq={}",
                            old_name,
                            new_name,
                            of.eq(nf)
                        ),
                    );
                }
                log(
                    "debug",
                    &format!(
                        "runtime:patch type_check old_type={} new_type={} keys_changed={} type_changed={} old_key={} new_key={}",
                        old.debug_type_name(),
                        new.r#type.debug_name(),
                        keys_changed,
                        type_changed,
                        old_key,
                        new_key
                    ),
                );
            }
        }
        if keys_changed || type_changed {
            // key 或类型变化说明身份已变，直接替换整棵子树，避免错误复用组件实例/DOM。
            self.patch_replace(old, new, parent);
            return;
        }

        #[cfg(feature = "compat")]
        {
            // compat Element/Fragment 有自己的 props/children diff；先让它接管旧协议 snapshot。
            match self.patch_compat_boundary(old, new, parent) {
                compat::CompatPatchBoundaryOutcome::Handled => return,
                compat::CompatPatchBoundaryOutcome::Replaced(mounted) => {
                    *old = mounted;
                    return;
                }
                compat::CompatPatchBoundaryOutcome::NotCompat => {}
            }
        }

        self.patch_core_same(old, new, parent);
    }
}
