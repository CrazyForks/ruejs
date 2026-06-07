/*
容器渲染入口

维护 container_map，把容器与当前 mounted snapshot 绑定：
- 首次 render：清空容器并挂载新输入
- 后续 render：命中记录后执行 patch 复用 DOM
- 错误/崩溃状态：尽早抛出最近错误，避免运行时继续污染 DOM
*/
use super::super::Rue;
use super::super::types::{
    ContainerMountState, MountInput, MountInputType, MountedState, MountedSubtreeState,
};
#[cfg(feature = "dev")]
use crate::log::{log, want_log};
use crate::reactive::core::batch_scope;
use crate::runtime::dom_adapter::DomAdapter;
use js_sys::Reflect;
use wasm_bindgen::JsValue;
use wasm_bindgen::throw_str;

// 容器渲染入口（render）：
// - 维护 container_map，将容器与其当前挂载状态绑定，支持后续增量更新
// - 首次挂载：清空容器 innerHTML 并插入真实 DOM（片段需插入子节点）
// - 后续更新：命中 container_map 时走 patch 以复用 DOM，触发生命周期钩子
// - 崩溃防护：检测运行时异常并抛出最后的钩子错误/运行时错误

impl<A: DomAdapter> Rue<A>
where
    A::Element: Clone,
{
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn ensure_container_runtime_ready(&self) {
        if self.crashed || crate::runtime::is_runtime_crashed() {
            if let Some(e) = crate::runtime::last_hook_error() {
                wasm_bindgen::throw_val(e);
            } else if let Some(e) = self.last_error.clone() {
                wasm_bindgen::throw_val(e);
            } else {
                throw_str("Rue runtime crashed");
            }
        }

        if self.get_dom_adapter().is_none() || self.dom_adapter.is_none() {
            throw_str("Rue runtime: no DOM adapter for render");
        }
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn missing_render_mount_adapter<T>() -> T {
        throw_str("Rue runtime: no DOM adapter for render mount");
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn mounted_container_state(
        &mut self,
        mounted: MountedSubtreeState<A>,
        container: &mut A::Element,
    ) -> Option<MountedState<A>>
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        let el = mounted.host_cloned()?;
        let is_fragment =
            self.get_dom_adapter().map(|adapter| adapter.is_fragment(&el)).unwrap_or(false);

        let adapter = self.get_dom_adapter_mut().unwrap_or_else(Self::missing_render_mount_adapter);
        adapter.set_inner_html(container, "");
        if is_fragment {
            self.insert_fragment_children(container, &el, &None);
        } else {
            adapter.append_child(container, &el);
        }

        Some(MountedState::from_subtree_root(mounted))
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn default_render_container_error() -> JsValue {
        js_sys::Error::new("Rue vapor: render failed (create_real_dom=None)").into()
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn store_block_replacement_mount(&mut self, idx: usize, mounted: Option<MountedState<A>>) {
        if let Some(mounted) = mounted {
            self.call_hooks("updated");
            let entry = self.container_map.get_mut(idx).unwrap();
            entry.store_mount(mounted);
        }
    }

    pub fn clear_container(&mut self, container: &mut A::Element)
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        self.ensure_container_runtime_ready();

        batch_scope(|| {
            self.current_container = Some(container.clone());
            self.compact_container_map();

            if let Some(idx) = self.find_container_index(container) {
                let taken = {
                    let entry = self.container_map.get_mut(idx).unwrap();
                    entry.take_mount()
                };

                if let Some(old_mount) = taken {
                    let global = js_sys::global();
                    let source_key = JsValue::from_str("__rue_debug_clear_source__");
                    let _ =
                        Reflect::set(&global, &source_key, &JsValue::from_str("clear_container"));
                    self.clear_mounted_state(container, old_mount);
                    let _ = Reflect::delete_property(&global, &source_key);
                }
            }

            let adapter = self.get_dom_adapter_mut().unwrap();
            adapter.set_inner_html(container, "");
        });
    }

    /// 默认公开入口：直接渲染 MountInput。
    ///
    /// 这层让默认调用方直接沿用 MountInput-first 协议；命中更新时会把旧 mounted
    /// 边界恢复为 patch snapshot，而不是再绕回额外树对象。
    pub fn render_input(&mut self, input: MountInput<A>, container: &mut A::Element)
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        self.render_impl(&input, container);
    }

    fn render_impl(&mut self, input: &MountInput<A>, container: &mut A::Element)
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        #[cfg(feature = "dev")]
        {
            if want_log("debug", "runtime:render enter") {
                log("debug", "runtime:render enter");
            }
        }
        self.ensure_container_runtime_ready();

        batch_scope(|| {
            self.current_container = Some(container.clone());
            self.compact_container_map();
            self.compact_anchor_map();
            if !self.deferred_queue.is_empty() {
                let mut queue = Vec::new();
                queue.append(&mut self.deferred_queue);
                for mut f in queue.into_iter() {
                    f();
                }
            }
            self.call_hooks("before_mount");
            if let Some(idx) = self.find_container_index(container) {
                #[cfg(feature = "dev")]
                {
                    if want_log("debug", "runtime:render container_map hit") {
                        log("debug", &format!("runtime:render container_map hit idx={}", idx));
                    }
                }
                let taken = {
                    let entry = self.container_map.get_mut(idx).unwrap();
                    entry.take_mount()
                };
                match taken {
                    Some(MountedState::Block(old_block)) => {
                        if let (MountInputType::Text(_), Some(host)) =
                            (&input.r#type, old_block.host.clone())
                        {
                            self.call_hooks("before_update");
                            let mounted_text = self.patch_text(Some(host), input);
                            let mounted = MountedState::from_subtree_root(
                                MountedSubtreeState::Text(mounted_text),
                            );
                            self.call_hooks("updated");
                            let entry = self.container_map.get_mut(idx).unwrap();
                            entry.store_mount(mounted);
                        } else {
                            self.call_hooks("before_update");
                            let global = js_sys::global();
                            let source_key = JsValue::from_str("__rue_debug_clear_source__");
                            let _ = Reflect::set(
                                &global,
                                &source_key,
                                &JsValue::from_str("render_impl:block"),
                            );
                            self.clear_mounted_state(container, MountedState::Block(old_block));
                            let _ = Reflect::delete_property(&global, &source_key);
                            let mounted = self.render_container_mount(input, container);
                            self.store_block_replacement_mount(idx, mounted);
                        }
                    }
                    Some(old_mount) => {
                        let mut parent = container.clone();
                        #[cfg(feature = "dev")]
                        {
                            if want_log("debug", "runtime:render patch root boundary") {
                                log("debug", "runtime:render patch root boundary");
                            }
                        }
                        let mounted = self.patch_root_mounted_state(old_mount, input, &mut parent);
                        let entry = self.container_map.get_mut(idx).unwrap();
                        entry.store_mount(mounted);
                    }
                    None => {
                        #[cfg(feature = "dev")]
                        {
                            if want_log("debug", "runtime:render initial append") {
                                log("debug", "runtime:render initial append");
                            }
                        }
                        if let Some(mounted) = self.render_container_mount(input, container) {
                            let entry = self.container_map.get_mut(idx).unwrap();
                            entry.store_mount(mounted);
                        }
                    }
                }
            } else {
                #[cfg(feature = "dev")]
                {
                    if want_log("debug", "runtime:render first mount") {
                        log("debug", "runtime:render first mount");
                    }
                }
                if let Some(mounted) = self.render_container_mount(input, container) {
                    self.container_map.push(ContainerMountState::new(container.clone(), mounted));
                }
            }
            self.call_hooks("mounted");
        });
        #[cfg(feature = "dev")]
        {
            if want_log("debug", "runtime:render exit") {
                log("debug", "runtime:render exit");
            }
        }
    }

    fn render_container_mount(
        &mut self,
        input: &MountInput<A>,
        container: &mut A::Element,
    ) -> Option<MountedState<A>>
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        let previous_error = self.last_error.clone();
        if let Some(mounted) = self.mount_from_input(input, Some(container)) {
            self.mounted_container_state(mounted, container)
        } else {
            let mount_reported_error = self.last_error.as_ref().is_some_and(|current| {
                previous_error
                    .as_ref()
                    .is_none_or(|previous| !js_sys::Object::is(previous, current))
            });
            if !mount_reported_error {
                let err_to_handle =
                    self.last_error.clone().unwrap_or_else(Self::default_render_container_error);
                self.handle_error(err_to_handle);
            };
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::runtime::js_adapter::JsDomAdapter;
    use crate::runtime::types::{ComponentProps, MountInputType};
    use js_sys::{Function, Object, Reflect};
    use wasm_bindgen::JsCast;
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
            ("appendChild", "p,c", "p.children = p.children || []; p.children.push(c)"),
            (
                "insertBefore",
                "p,c,b",
                "p.children = p.children || []; const i = p.children.indexOf(b); p.children.splice(i < 0 ? p.children.length : i, 0, c)",
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

    fn text_input(text: &str) -> MountInput<JsDomAdapter> {
        MountInput {
            r#type: MountInputType::Text(text.to_string()),
            props: ComponentProps::new(),
            children: Vec::new(),
            key: None,
            strict_component_returns: false,
            mount_cleanup_bucket: None,
            mount_effect_scope_id: None,
            el_hint: None,
        }
    }

    fn vapor_without_host_input() -> MountInput<JsDomAdapter> {
        MountInput {
            r#type: MountInputType::Vapor,
            props: ComponentProps::new(),
            children: Vec::new(),
            key: None,
            strict_component_returns: false,
            mount_cleanup_bucket: None,
            mount_effect_scope_id: None,
            el_hint: None,
        }
    }

    #[wasm_bindgen_test]
    fn render_container_records_error_when_mount_input_cannot_create_dom() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let mut container = rue.get_dom_adapter_mut().unwrap().create_element("root");

        rue.render_input(vapor_without_host_input(), &mut container);

        assert!(rue.last_error.is_some());
        assert_eq!(rue.container_mount_count(), 0);
    }

    #[wasm_bindgen_test]
    fn render_container_mount_reuses_existing_error_when_mount_still_fails() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let mut container = rue.get_dom_adapter_mut().unwrap().create_element("root");
        rue.last_error = Some(JsValue::from_str("existing render error"));

        let mounted = rue.render_container_mount(&phantom_input(), &mut container);

        assert!(mounted.is_none());
        assert_eq!(
            rue.last_error.as_ref().and_then(JsValue::as_string).as_deref(),
            Some("existing render error")
        );
    }

    #[wasm_bindgen_test]
    fn render_container_block_replacement_failure_leaves_empty_entry_reusable() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());
        let mut container = rue.get_dom_adapter_mut().unwrap().create_element("root");

        rue.render_input(text_input("before"), &mut container);
        assert_eq!(rue.container_mount_count(), 1);

        rue.render_input(vapor_without_host_input(), &mut container);
        assert!(rue.last_error.is_some());
        assert_eq!(rue.container_mount_count(), 1);

        rue.last_error = None;
        rue.render_input(text_input("after"), &mut container);

        let children = Reflect::get(&container, &JsValue::from_str("children"))
            .unwrap()
            .unchecked_into::<js_sys::Array>();
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
    #[should_panic]
    fn render_container_panics_without_dom_adapter() {
        let mut rue = Rue::<JsDomAdapter>::new();
        let mut container = Object::new().into();
        rue.render_input(phantom_input(), &mut container);
    }

    #[wasm_bindgen_test]
    #[should_panic]
    fn clear_container_panics_without_dom_adapter() {
        let mut rue = Rue::<JsDomAdapter>::new();
        let mut container = Object::new().into();
        rue.clear_container(&mut container);
    }

    #[wasm_bindgen_test]
    #[should_panic]
    fn render_container_panics_when_runtime_is_marked_crashed_without_last_error() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.crashed = true;
        let mut container = Object::new().into();
        rue.render_input(phantom_input(), &mut container);
    }
}
