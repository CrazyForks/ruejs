/*
Vapor 子树挂载

处理默认主路径中的 Vapor/host-node bridge：
- 直接复用已由 JS/Vapor 侧创建的宿主节点或片段节点
- 若存在 setup，则在专属 effect scope 中执行，确保卸载时可统一清理
- 将 cleanup bucket 与 scope id 写入 mounted snapshot，交给生命周期层释放
*/
use super::super::Rue;
use super::super::types::{
    MountInput, MountedSubtreeState, MountedVaporSubtree, MountedVaporSubtreeType,
};
#[cfg(feature = "compat")]
use super::compat_vapor_wrapper::setup_return_uses_legacy_vapor_wrapper;
use crate::reactive::core::{create_effect_scope, pop_effect_scope, push_effect_scope};
use crate::runtime::dom_adapter::DomAdapter;
use crate::runtime::shared_runtime_bridge;
use crate::runtime::transport;
use js_sys::{Function, Object, Reflect};
use wasm_bindgen::{JsCast, JsValue};

impl<A: DomAdapter> Rue<A>
where
    A::Element: From<JsValue> + Into<JsValue> + Clone,
{
    /// 解析 setup 返回对象：提取其中的 `__rue_host_node` bridge（若存在）
    pub(super) fn parse_vapor_with_setup_return(&self, ret: &JsValue) -> Option<A::Element> {
        if ret.is_object() {
            let obj = Object::from(ret.clone());
            let host = transport::host_node_value(&obj);
            if !host.is_undefined() && !host.is_null() {
                // setup 返回 bridge wrapper 时，真正要挂载的是 wrapper 内部的 host node。
                // wrapper 自身只作为运输壳，不应进入 mounted snapshot。
                let el: A::Element = host.into();
                return Some(el);
            }
        }
        None
    }

    /// Vapor setup 主路径由编译器直接返回可挂载块根节点，这里保留该薄协议。
    ///
    /// 与组件默认返回面不同，setup 不要求额外包成 host-node bridge；
    /// 只要返回值本身就是宿主节点/片段节点，就直接把它视为可挂载元素。
    pub(super) fn coerce_setup_return_to_element(&self, ret: &JsValue) -> A::Element {
        ret.clone().into()
    }

    pub(super) fn fragment_nodes_for_element(&self, el: &A::Element) -> Vec<A::Element> {
        // Fragment 的 host 只是临时容器，真实插入/删除需要追踪其展开后的子节点。
        self.get_dom_adapter()
            .filter(|adapter| adapter.is_fragment(el))
            .map(|adapter| adapter.collect_fragment_children(el))
            .unwrap_or_default()
    }

    pub(super) fn set_owner_scope_on_element(&self, scope_id: Option<usize>, el: &A::Element) {
        if let Some(scope_id) = scope_id {
            // 把 scope id 写回宿主节点，供 JS 侧调试/桥接路径识别该节点的 owner scope。
            let el_js: JsValue = el.clone().into();
            let _ = Reflect::set(
                &el_js,
                &JsValue::from_str("__rue_effect_scope_id"),
                &JsValue::from_f64(scope_id as f64),
            );
        }
    }

    #[cfg(wasm_bindgen_unstable_test_coverage)]
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub fn __coverage_mount_vapor_with_setup_probe(
        &mut self,
        input: &MountInput<A>,
        f: &JsValue,
        parent_context: Option<&A::Element>,
    ) -> bool {
        mount_vapor_with_setup(self, input, f, parent_context).is_some()
    }

    #[cfg(wasm_bindgen_unstable_test_coverage)]
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub fn __coverage_set_owner_scope_none_probe(&self, el: &A::Element) {
        self.set_owner_scope_on_element(None, el);
    }
}

pub(crate) fn mount_vapor<A: DomAdapter>(
    rue: &mut Rue<A>,
    input: &MountInput<A>,
) -> Option<MountedSubtreeState<A>>
where
    A::Element: From<JsValue> + Into<JsValue> + Clone,
{
    let host = input.el_hint.clone()?;
    // 普通 Vapor 输入已经携带宿主节点，Rust 侧只建立 mounted snapshot，不重新执行 setup。
    let fragment_nodes = rue.fragment_nodes_for_element(&host);

    Some(MountedSubtreeState::Vapor(MountedVaporSubtree {
        r#type: MountedVaporSubtreeType::Vapor,
        host: Some(host),
        key: input.key.clone(),
        fragment_nodes,
        cleanup_bucket: input.mount_cleanup_bucket.clone(),
        effect_scope_id: input.mount_effect_scope_id,
    }))
}

#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
fn vapor_with_setup_no_adapter<A: DomAdapter>(rue: &mut Rue<A>) -> Option<MountedSubtreeState<A>> {
    rue.handle_error(JsValue::from_str("runtime:mount VaporWithSetup fallback no adapter"));
    None
}

pub(crate) fn mount_vapor_with_setup<A: DomAdapter>(
    rue: &mut Rue<A>,
    input: &MountInput<A>,
    f: &JsValue,
    parent_context: Option<&A::Element>,
) -> Option<MountedSubtreeState<A>>
where
    A::Element: From<JsValue> + Into<JsValue> + Clone,
{
    if let Some(existing_host) = input.el_hint.clone() {
        // 若编译/bridge 已经提前提供 host，说明 setup 结果已经在 JS 侧准备好；
        // 这里直接复用，避免二次调用 setup 造成副作用重复注册。
        let fragment_nodes = rue.fragment_nodes_for_element(&existing_host);
        return Some(MountedSubtreeState::Vapor(MountedVaporSubtree {
            r#type: MountedVaporSubtreeType::VaporWithSetup(f.clone()),
            host: Some(existing_host),
            key: input.key.clone(),
            fragment_nodes,
            cleanup_bucket: input.mount_cleanup_bucket.clone(),
            effect_scope_id: input.mount_effect_scope_id,
        }));
    }

    if let Some(func) = f.dyn_ref::<Function>() {
        // setup 执行期间创建的 watch/effect/computed 都应归属于该 Vapor 子树。
        // 后续卸载时 render_lifecycle 会根据 scope_id 统一 dispose。
        let scope_id = input.mount_effect_scope_id.unwrap_or_else(create_effect_scope);
        push_effect_scope(scope_id);
        let prev_container = rue.current_container.clone();
        let mut did_push_current_container = false;
        if let Some(parent) = parent_context {
            rue.current_container = Some(parent.clone());
        }
        let parent_value =
            parent_context.cloned().map(Into::<JsValue>::into).unwrap_or(JsValue::UNDEFINED);
        if !parent_value.is_undefined() && !parent_value.is_null() {
            // 同步维护 JS shared bridge 的当前容器栈，供 setup 内部调用 getCurrentContainer。
            shared_runtime_bridge::push_current_container(&parent_value);
            did_push_current_container = true;
        }
        let ret = func.call1(&JsValue::UNDEFINED, &parent_value);
        // 无论 setup 成功还是失败，当前容器与 effect scope 都必须恢复，避免污染外层渲染。
        if did_push_current_container {
            shared_runtime_bridge::pop_current_container();
        }
        rue.current_container = prev_container;
        pop_effect_scope();

        match ret {
            Ok(ret) => {
                if let Some(el) = rue.parse_vapor_with_setup_return(&ret) {
                    // bridge wrapper 返回：提取 host 后仍要把 owner scope 绑定回 host。
                    rue.set_owner_scope_on_element(Some(scope_id), &el);
                    let fragment_nodes = rue.fragment_nodes_for_element(&el);
                    return Some(MountedSubtreeState::Vapor(MountedVaporSubtree {
                        r#type: MountedVaporSubtreeType::VaporWithSetup(f.clone()),
                        host: Some(el),
                        key: input.key.clone(),
                        fragment_nodes,
                        cleanup_bucket: input.mount_cleanup_bucket.clone(),
                        effect_scope_id: Some(scope_id),
                    }));
                }

                #[cfg(feature = "compat")]
                if setup_return_uses_legacy_vapor_wrapper(&ret) {
                    let error = JsValue::from_str(
                        "Unsupported object returns are no longer accepted for vapor setup on the default path. Return a raw node, fragment, or mount handle instead.",
                    );
                    rue.handle_error(error.clone());
                    return None;
                }

                // 编译器生成的 Vapor setup 默认直接 `return _root`，这里继续接受该块根节点。
                let el: A::Element = rue.coerce_setup_return_to_element(&ret);
                rue.set_owner_scope_on_element(Some(scope_id), &el);
                let fragment_nodes = rue.fragment_nodes_for_element(&el);
                return Some(MountedSubtreeState::Vapor(MountedVaporSubtree {
                    r#type: MountedVaporSubtreeType::VaporWithSetup(f.clone()),
                    host: Some(el),
                    key: input.key.clone(),
                    fragment_nodes,
                    cleanup_bucket: input.mount_cleanup_bucket.clone(),
                    effect_scope_id: Some(scope_id),
                }));
            }
            Err(e) => {
                let instance = crate::get_current_instance();
                if shared_runtime_bridge::dispatch_error_captured(&e, &instance, "vapor setup") {
                    let Some(adapter) = rue.get_dom_adapter_mut() else {
                        return None;
                    };
                    let el = adapter.create_element_in_parent("div", parent_context);
                    rue.set_owner_scope_on_element(Some(scope_id), &el);
                    let fragment_nodes = rue.fragment_nodes_for_element(&el);
                    return Some(MountedSubtreeState::Vapor(MountedVaporSubtree {
                        r#type: MountedVaporSubtreeType::VaporWithSetup(f.clone()),
                        host: Some(el),
                        key: input.key.clone(),
                        fragment_nodes,
                        cleanup_bucket: input.mount_cleanup_bucket.clone(),
                        effect_scope_id: Some(scope_id),
                    }));
                }
                rue.handle_error(e.clone());
                wasm_bindgen::throw_val(e.clone());
            }
        }
    }

    let Some(adapter) = rue.get_dom_adapter_mut() else { return vapor_with_setup_no_adapter(rue) };

    // 非函数 setup 是异常/兼容兜底：创建一个空 div 占位，保持 mounted 结构可继续返回。
    let el = adapter.create_element_in_parent("div", parent_context);
    Some(MountedSubtreeState::Vapor(MountedVaporSubtree {
        r#type: MountedVaporSubtreeType::VaporWithSetup(f.clone()),
        host: Some(el),
        key: input.key.clone(),
        fragment_nodes: Vec::new(),
        cleanup_bucket: input.mount_cleanup_bucket.clone(),
        effect_scope_id: input.mount_effect_scope_id,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::runtime::js_adapter::JsDomAdapter;
    use crate::runtime::types::{ComponentProps, MountInputType};
    use js_sys::{Array, Object};
    use wasm_bindgen_test::*;

    fn set_prop(target: &Object, key: &str, value: JsValue) {
        Reflect::set(target, &JsValue::from_str(key), &value).unwrap();
    }

    fn adapter() -> JsDomAdapter {
        let obj = Object::new();
        for (name, func) in [
            (
                "createElement",
                Function::new_with_args("tag", "return { tag, children: [], nodeType: 1 }"),
            ),
            (
                "createTextNode",
                Function::new_with_args("text", "return { tag: '#text', text, nodeType: 3 }"),
            ),
            (
                "createDocumentFragment",
                Function::new_no_args("return { tag: 'fragment', children: [], nodeType: 11 }"),
            ),
            ("isFragment", Function::new_with_args("el", "return !!el && el.tag === 'fragment'")),
            (
                "collectFragmentChildren",
                Function::new_with_args("el", "return Array.from(el && el.children || [])"),
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
                Function::new_with_args("el,html", "el.children = []; el.text = html"),
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

    fn host(tag: &str) -> JsValue {
        let node = Object::new();
        set_prop(&node, "tag", JsValue::from_str(tag));
        set_prop(&node, "children", Array::new().into());
        set_prop(&node, "nodeType", JsValue::from_f64(1.0));
        node.into()
    }

    #[wasm_bindgen_test]
    fn vapor_helpers_cover_bridge_fragment_owner_scope_and_fallback_setup() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.set_dom_adapter(adapter());

        let first = host("first");
        let second = host("second");
        let fragment = Object::new();
        set_prop(&fragment, "tag", JsValue::from_str("fragment"));
        let children = Array::new();
        children.push(&first);
        children.push(&second);
        set_prop(&fragment, "children", children.into());

        let bridge = Object::new();
        set_prop(&bridge, "__rue_host_node", first.clone());
        let parsed = rue.parse_vapor_with_setup_return(&bridge.into()).unwrap();
        assert!(js_sys::Object::is(&parsed.clone().into(), &first));

        rue.set_owner_scope_on_element(Some(33), &parsed);
        assert_eq!(
            Reflect::get(&first, &JsValue::from_str("__rue_effect_scope_id")).unwrap().as_f64(),
            Some(33.0),
        );

        let mut input = MountInput::new_normalized(
            MountInputType::<JsDomAdapter>::Vapor,
            ComponentProps::new(),
            Vec::new(),
        );
        input.el_hint = Some(fragment.clone().into());
        let mounted = mount_vapor(&mut rue, &input).expect("fragment hint should mount");
        assert_eq!(mounted.fragment_nodes_cloned().len(), 2);

        let fallback_input = MountInput::new_normalized(
            MountInputType::VaporWithSetup(JsValue::from_str("not-a-function")),
            ComponentProps::new(),
            Vec::new(),
        );
        let fallback = mount_vapor_with_setup(
            &mut rue,
            &fallback_input,
            &JsValue::from_str("not-a-function"),
            None,
        )
        .expect("non-function setup gets placeholder when adapter exists");
        assert!(fallback.host_cloned().is_some());
    }

    #[wasm_bindgen_test]
    fn vapor_helpers_cover_no_adapter_and_noop_branch_edges() {
        let rue = Rue::<JsDomAdapter>::new();
        assert!(rue.parse_vapor_with_setup_return(&JsValue::from_str("plain")).is_none());
        assert!(rue.parse_vapor_with_setup_return(&Object::new().into()).is_none());
        assert!(rue.fragment_nodes_for_element(&host("not-fragment")).is_empty());
        rue.set_owner_scope_on_element(None, &host("noop"));

        let mut no_adapter = Rue::<JsDomAdapter>::new();
        let fallback_input = MountInput::new_normalized(
            MountInputType::VaporWithSetup(JsValue::from_str("not-a-function")),
            ComponentProps::new(),
            Vec::new(),
        );

        let mounted = mount_vapor_with_setup(
            &mut no_adapter,
            &fallback_input,
            &JsValue::from_str("not-a-function"),
            None,
        );

        assert!(mounted.is_none());
    }
}
