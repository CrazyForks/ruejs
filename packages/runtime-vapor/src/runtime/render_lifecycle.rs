/*
渲染生命周期与卸载清理

mounted snapshot 会被转换成 MountLifecycleRecord，再由这里递归执行：
- before_unmount 阶段释放 cleanup bucket / effect scope，并调用组件卸载前钩子
- unmounted 阶段调用组件已卸载钩子
- 容器卸载时同步清理 DOM、container_map、anchor_map

把生命周期从 patch/render 细节中抽离出来，可以确保替换、区间清理和整容器卸载走同一套清理语义。
*/
use super::Rue;
use super::types::{ComponentProps, MountInput, MountInputType, MountLifecycleRecord};
use crate::reactive::context::component_instance_wrapper;
use crate::reactive::core::dispose_effect_scope;
use crate::runtime::dom_adapter::DomAdapter;
use crate::runtime::shared_runtime_bridge;
use js_sys::{Array, Function, Promise};
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;

impl<A: DomAdapter> Rue<A>
where
    A::Element: Clone,
{
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn dispose_mounted_component_scopes(&mut self, inst_index: usize) {
        if let Some(inst) = self.instance_store.get(&inst_index) {
            // 组件 render 期间 JS bridge 会把 currentInstance 暴露为 host；
            // useSetup/onScopeDispose 的清理可能挂在 host 上，而不是 CI wrapper 上。
            shared_runtime_bridge::dispose_component(&inst.host);
        }
        if let Some(instance_wrapper) = component_instance_wrapper(inst_index) {
            // JS shared runtime 可能保存了组件级 hook scope/上下文栈，先通知它释放。
            shared_runtime_bridge::dispose_component(&instance_wrapper);
        }
        // Rust 侧分别清理组件 render scope 与 Hook slot scope，覆盖两类副作用来源。
        self.dispose_component_render_scope(inst_index);
        crate::reactive::context::dispose_component_hook_scope(inst_index);
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn call_lifecycle_hooks(&mut self, hooks: &[JsValue]) {
        for hook in hooks.iter() {
            if let Some(func) = hook.dyn_ref::<Function>() {
                let _ = func.call0(&JsValue::UNDEFINED);
            }
        }
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn invoke_cleanup_bucket(&mut self, bucket: &JsValue) {
        if !Array::is_array(bucket) {
            return;
        }

        let arr: Array = bucket.clone().unchecked_into();
        let len = arr.length();
        let mut callbacks = Vec::with_capacity(len as usize);
        // 先复制再清空 bucket，避免 cleanup 执行期间再次触发卸载导致同一回调重复运行。
        for index in 0..len {
            callbacks.push(arr.get(index));
        }
        arr.set_length(0);

        for callback in callbacks.into_iter() {
            if let Some(func) = callback.dyn_ref::<Function>() {
                let _ = func.call0(&JsValue::UNDEFINED);
            }
        }
    }

    fn invoke_mount_owned_resources(&mut self, record: &MountLifecycleRecord) {
        // mount-owned resources 指由这段 mounted 子树直接拥有的资源：
        // JS cleanup bucket 与 Rust effect scope。它们应在 before_unmount 阶段释放。
        if let Some(bucket) = record.cleanup_bucket.as_ref() {
            self.invoke_cleanup_bucket(bucket);
        }
        if let Some(scope_id) = record.effect_scope_id {
            self.dispose_vapor_scope_id(scope_id);
        }
    }

    fn dispose_vapor_scope_id(&mut self, scope_id: usize) {
        #[cfg(feature = "dev")]
        {
            if crate::log::want_log("debug", "runtime:mount before_unmount vapor") {
                crate::log::log(
                    "debug",
                    &format!("runtime:mount before_unmount vapor scope={}", scope_id),
                );
            }
        }
        dispose_effect_scope(scope_id);
    }

    /// 推入一个生命周期钩子：名称 -> JS 函数
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub fn push_hook(&mut self, name: &str, f: JsValue) {
        if let Some(top_idx) = self.instance_stack.last() {
            if let Some(inst) = self.instance_store.get_mut(top_idx) {
                let list = inst.hooks.0.entry(name.to_string()).or_insert_with(Vec::new);
                list.push(f);
                return;
            }
        }

        let list = self.lifecycle_hooks.entry(name.to_string()).or_insert_with(Vec::new);
        list.push(f);
    }

    /// 向指定组件实例追加生命周期钩子；用于 setup 期间已经知道实例索引的桥接 API。
    pub fn push_instance_hook(&mut self, index: usize, name: &str, f: JsValue) -> bool {
        if let Some(inst) = self.instance_store.get_mut(&index) {
            let list = inst.hooks.0.entry(name.to_string()).or_insert_with(Vec::new);
            list.push(f);
            true
        } else {
            false
        }
    }

    /// 调用生命周期钩子
    ///
    /// - 优先调用当前实例栈顶的组件实例 hooks
    /// - 若无栈顶实例，则调用全局 hooks（Rue.lifecycle_hooks）
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub fn call_hooks(&mut self, name: &str) {
        use js_sys::Function;
        if let Some(top_idx) = self.instance_stack.last() {
            if let Some(inst) = self.instance_store.get_mut(top_idx) {
                // 有当前组件时，生命周期钩子默认归属该组件实例。
                if let Some(list) = inst.hooks.0.get_mut(name) {
                    for jsf in list.iter_mut() {
                        if let Some(func) = jsf.dyn_ref::<Function>() {
                            let _ = func.call0(&JsValue::UNDEFINED);
                        }
                    }
                }
                return;
            }
        }
        if let Some(list) = self.lifecycle_hooks.get_mut(name) {
            // 没有组件上下文时才走全局钩子，用于 app/root 级别生命周期。
            for jsf in list.iter_mut() {
                if let Some(func) = jsf.dyn_ref::<Function>() {
                    let _ = func.call0(&JsValue::UNDEFINED);
                }
            }
        }
    }

    /// 收集当前实例或全局层面的指定 hooks，供需要返回 Promise 的生命周期复用。
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn collect_hooks(&self, name: &str) -> Vec<JsValue> {
        if let Some(top_idx) = self.instance_stack.last() {
            if let Some(inst) = self.instance_store.get(top_idx) {
                return inst.hooks.0.get(name).cloned().unwrap_or_default();
            }
        }
        self.lifecycle_hooks.get(name).cloned().unwrap_or_default()
    }

    /// 执行当前上下文的 server_prefetch hooks，并返回可等待的 Promise。
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub fn run_server_prefetch(&mut self) -> Promise {
        let promises = Array::new();
        for hook in self.collect_hooks("server_prefetch").into_iter() {
            if let Some(func) = hook.dyn_ref::<Function>() {
                match func.call0(&JsValue::UNDEFINED) {
                    Ok(value) => {
                        promises.push(&value);
                    }
                    Err(error) => {
                        self.handle_error(error.clone());
                        promises.push(&Promise::reject(&error));
                    }
                }
            }
        }
        Promise::all(&promises)
    }

    /// 注册：卸载前（before_unmount）
    pub fn on_before_unmount(&mut self, f: JsValue) {
        self.push_hook("before_unmount", f);
    }
    /// 注册：已卸载（unmounted）
    pub fn on_unmounted(&mut self, f: JsValue) {
        self.push_hook("unmounted", f);
    }
    /// 注册：缓存实例激活（activated）
    pub fn on_activated(&mut self, f: JsValue) {
        self.push_hook("activated", f);
    }
    /// 注册：缓存实例停用（deactivated）
    pub fn on_deactivated(&mut self, f: JsValue) {
        self.push_hook("deactivated", f);
    }
    /// 注册：错误处理器（全局）
    pub fn on_error(&mut self, f: JsValue) {
        self.global_error_handlers.push(f);
    }

    /// 处理错误并派发到实例或全局错误处理器
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub fn handle_error(&mut self, err: JsValue) {
        self.last_error = Some(err.clone());
        let mut handled = false;
        if let Some(ci) = self.current_instance.as_mut() {
            // 组件内错误优先给实例错误处理器；处理后仍记录在实例上供调试。
            for h in ci.error_handlers.iter_mut() {
                if let Some(func) = h.dyn_ref::<js_sys::Function>() {
                    let _ = func.call1(&JsValue::UNDEFINED, &err);
                    handled = true;
                }
            }
            ci.error = Some(err.clone());
        }
        if !handled {
            // 没有组件处理器时再广播给全局错误处理器。
            for h in self.global_error_handlers.iter_mut() {
                if let Some(func) = h.dyn_ref::<js_sys::Function>() {
                    let _ = func.call1(&JsValue::UNDEFINED, &err);
                }
            }
        }
    }
    /// 卸载容器内容：触发钩子、清理 container_map 记录，并递归处理 mounted subtree
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub fn unmount(&mut self, container: &mut A::Element)
    where
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        self.call_hooks("before_unmount");
        if let Some(adapter) = self.get_dom_adapter_mut() {
            // 先清空容器 DOM，再根据 mounted snapshot 释放副作用和生命周期。
            // DOM 操作失败面更小，逻辑资源清理仍由下面的 lifecycle record 保证。
            adapter.set_inner_html(container, "");
        }
        if let Some(idx) = self.find_container_index(container) {
            let taken = {
                let entry = self.container_map.get_mut(idx).unwrap();
                entry.take_mount()
            };
            if let Some(mount) = taken {
                // MountedState 转成统一 lifecycle record 后，容器/锚点/区间卸载都走同一套递归规则。
                let lifecycle = mount.into_lifecycle();
                self.invoke_before_unmount_record(&lifecycle);
                self.invoke_unmounted_record(&lifecycle);
            }
            if let Some(entry) = self.container_map.get_mut(idx) {
                entry.clear();
            }
        }
        self.compact_anchor_map();
        self.call_hooks("unmounted");
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub(crate) fn invoke_before_unmount_record(&mut self, record: &MountLifecycleRecord) {
        if record.kind.invokes_mount_owned_resources_before_unmount() {
            self.invoke_mount_owned_resources(record);
        }

        if record.kind.invokes_component_before_unmount() {
            // 组件 before_unmount 先于子树递归，便于用户在子节点仍可访问时做收尾。
            self.call_lifecycle_hooks(&record.component_before_unmount_hooks);
            if let Some(inst_index) = record.component_inst_index {
                self.dispose_mounted_component_scopes(inst_index);
            }
        }

        if record.kind.recurses_before_unmount_children() {
            // Component 这类拥有子树结构的节点需要继续向下释放资源。
            for child in record.children.iter() {
                self.invoke_before_unmount_record(child);
            }
        }
    }

    /// 按 mount lifecycle record 执行 unmounted。
    pub(crate) fn invoke_unmounted_record(&mut self, record: &MountLifecycleRecord) {
        if record.kind.recurses_unmounted_children() {
            // unmounted 阶段先递归子级，再通知当前组件，语义上表示整棵子树已完成卸载。
            for child in record.children.iter() {
                self.invoke_unmounted_record(child);
            }
        }

        if record.kind.invokes_component_unmounted() {
            self.call_lifecycle_hooks(&record.component_unmounted_hooks);
        }
    }

    /// 递归触发 mounted snapshot 中记录的 activated hooks。
    pub(crate) fn invoke_activated_record(&mut self, record: &MountLifecycleRecord) {
        if record.kind.invokes_component_unmounted() {
            self.call_lifecycle_hooks(&record.component_activated_hooks);
        }

        if record.kind.recurses_unmounted_children() {
            for child in record.children.iter() {
                self.invoke_activated_record(child);
            }
        }
    }

    /// 递归触发 mounted snapshot 中记录的 deactivated hooks。
    pub(crate) fn invoke_deactivated_record(&mut self, record: &MountLifecycleRecord) {
        if record.kind.invokes_component_unmounted() {
            self.call_lifecycle_hooks(&record.component_deactivated_hooks);
        }

        if record.kind.recurses_unmounted_children() {
            for child in record.children.iter() {
                self.invoke_deactivated_record(child);
            }
        }
    }

    /// 根据 start anchor 查找缓存 range，并触发其 activated hooks。
    pub fn activate_range(&mut self, start: &A::Element)
    where
        <A as DomAdapter>::Element: Into<JsValue>,
    {
        if let Some(record) = self
            .find_range_index(start)
            .and_then(|idx| self.range_map.get(idx))
            .and_then(|entry| entry.mounted.as_ref())
            .map(|mounted| mounted.lifecycle_record())
        {
            self.invoke_activated_record(&record);
        }
    }

    /// 根据 start anchor 查找缓存 range，并触发其 deactivated hooks。
    pub fn deactivate_range(&mut self, start: &A::Element)
    where
        <A as DomAdapter>::Element: Into<JsValue>,
    {
        if let Some(record) = self
            .find_range_index(start)
            .and_then(|idx| self.range_map.get(idx))
            .and_then(|entry| entry.mounted.as_ref())
            .map(|mounted| mounted.lifecycle_record())
        {
            self.invoke_deactivated_record(&record);
        }
    }

    /// 挂载入口：将 app(props) 产生的默认 MountInput 渲染到容器。
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub fn mount<F>(&mut self, _app: F, _container: &mut A::Element)
    where
        F: Fn(ComponentProps) -> MountInput<A>,
        <A as DomAdapter>::Element: From<JsValue> + Into<JsValue>,
    {
        let props = ComponentProps::new();
        let input = _app(props);
        self.render_input(input, _container);
    }

    /// 使用插件：将安装动作入队（deferred_queue）
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub fn use_plugin(&mut self, _plugin: JsValue, _options: Vec<JsValue>) -> &mut Self {
        let plugin = _plugin.clone();
        let options = _options.clone();
        self.deferred_queue.push(Box::new(move || {
            // 插件安装延迟到 mount 前执行，确保插件能读取到当前 app/runtime 上下文。
            let install = js_sys::Reflect::get(&plugin, &JsValue::from_str("install"))
                .unwrap_or(JsValue::UNDEFINED);
            if let Some(func) = install.dyn_ref::<Function>() {
                let arr = Array::new();
                for o in options.iter() {
                    arr.push(o);
                }
                let _ = func.call2(&plugin, &JsValue::UNDEFINED, &arr.into());
            }
        }));
        self
    }

    /// 事件发射器：根据 props 中 onXxx/onxxx 找到处理器并调用
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub fn emitted(&self, _props: &ComponentProps) -> Box<dyn FnMut(String, Vec<JsValue>)> {
        let props = _props.clone();
        Box::new(move |evt: String, args: Vec<JsValue>| {
            // 同时支持 onMyEvent 与 onmyevent 两种 prop 命名，兼容不同编译/手写风格。
            let lower = format!("on{}", evt.to_lowercase());
            let mut camel = String::from("on");
            for part in evt.split(|c| c == '-' || c == '_' || c == ' ') {
                if part.is_empty() {
                    continue;
                }
                let mut it = part.chars();
                if let Some(f) = it.next() {
                    camel.push_str(&f.to_uppercase().to_string());
                    let rest: String = it.collect();
                    camel.push_str(&rest);
                }
            }
            let mut names: Vec<String> = Vec::new();
            names.push(camel.clone());
            if lower != camel {
                names.push(lower.clone());
            } else {
                names.push(lower.clone());
            }
            for name in names.iter() {
                if let Some(handler) = props.get(name) {
                    if let Some(func) = handler.dyn_ref::<Function>() {
                        let arr = Array::new();
                        for a in args.iter() {
                            arr.push(a);
                        }
                        let _ = func.apply(&JsValue::UNDEFINED, &arr.into());
                    }
                }
            }
        })
    }

    /// Vapor 构建辅助：调用 setup 生成默认 MountInput。
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    pub fn vapor<F>(&self, setup: F) -> MountInput<A>
    where
        F: Fn() -> A::Element,
        A::Element: Into<JsValue>,
    {
        let el = setup();
        let mut props = ComponentProps::new();
        if let Some(adapter) = self.get_dom_adapter() {
            if adapter.is_fragment(&el) {
                let nodes = adapter.collect_fragment_children(&el);
                let arr = js_sys::Array::new();
                for n in nodes.into_iter() {
                    let v: JsValue = n.into();
                    arr.push(&v);
                }
                props.insert("__fragNodes".to_string(), arr.clone().into());
                let el_js: JsValue = el.clone().into();
                let _ =
                    js_sys::Reflect::set(&el_js, &JsValue::from_str("__rue_frag_nodes_ref"), &arr);
            }
        }
        MountInput {
            r#type: MountInputType::Vapor,
            props,
            children: vec![],
            key: None,
            strict_component_returns: false,
            mount_cleanup_bucket: None,
            mount_effect_scope_id: None,
            el_hint: Some(el),
        }
    }

    /// 注册各生命周期钩子（组件或全局）
    pub fn on_before_create(&mut self, _f: JsValue) {
        self.push_hook("before_create", _f);
    }
    pub fn on_created(&mut self, _f: JsValue) {
        self.push_hook("created", _f);
    }
    pub fn on_before_mount(&mut self, _f: JsValue) {
        self.push_hook("before_mount", _f);
    }
    pub fn on_mounted(&mut self, _f: JsValue) {
        self.push_hook("mounted", _f);
    }
    pub fn on_before_update(&mut self, _f: JsValue) {
        self.push_hook("before_update", _f);
    }
    pub fn on_updated(&mut self, _f: JsValue) {
        self.push_hook("updated", _f);
    }
    /// 注册：服务端预取（server_prefetch）
    pub fn on_server_prefetch(&mut self, _f: JsValue) {
        self.push_hook("server_prefetch", _f);
    }
}

#[cfg(test)]
mod tests {
    use super::super::types::{
        MountedPatchSubtree, MountedSubtreeState, MountedTextSubtree, RangeMountState,
    };
    use super::*;
    use crate::runtime::js_adapter::JsDomAdapter;
    use crate::runtime::{ComponentInternalInstance, LifecycleHooks};
    use js_sys::{Object, Reflect};
    use std::collections::HashMap;
    use std::marker::PhantomData;
    use wasm_bindgen_test::*;

    fn lifecycle_adapter() -> JsDomAdapter {
        let adapter = Object::new();
        let methods = [
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
                "parent, child",
                "parent.children = parent.children || []; parent.children.push(child)",
            ),
            (
                "insertBefore",
                "parent, child, before",
                "parent.children = parent.children || []; const i = parent.children.indexOf(before); i >= 0 ? parent.children.splice(i, 0, child) : parent.children.push(child)",
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
            ("setClassName", "el,value", "el.className = value"),
            ("patchStyle", "el,oldStyle,newStyle", "el.style = newStyle"),
            ("setInnerHTML", "el,html", "el.children = []; el.innerHTML = html"),
            ("setValue", "el,value", "el.value = value"),
            ("setChecked", "el,value", "el.checked = !!value"),
            ("setDisabled", "el,value", "el.disabled = !!value"),
            ("clearRef", "ref", "return"),
            ("applyRef", "el,ref", "return"),
            ("setAttribute", "el,key,value", "el.attrs = el.attrs || {}; el.attrs[key] = value"),
            ("removeAttribute", "el,key", "if (el.attrs) delete el.attrs[key]"),
            ("getTagName", "el", "return el.tag || ''"),
            ("addEventListener", "el,event,handler", "return"),
            ("removeEventListener", "el,event,handler", "return"),
            ("hasValueProperty", "el", "return 'value' in el"),
            ("isSelectMultiple", "el", "return el.tag === 'SELECT' && !!el.multiple"),
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

    fn test_instance(index: usize) -> ComponentInternalInstance<JsDomAdapter> {
        ComponentInternalInstance {
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
    fn cleanup_bucket_runs_function_entries_once_and_ignores_non_arrays() {
        let mut rue: Rue<JsDomAdapter> = Rue::new();
        let hits = Array::new();
        Reflect::set(&js_sys::global(), &JsValue::from_str("__lifecycle_cleanup_hits"), &hits)
            .unwrap();

        rue.invoke_cleanup_bucket(&JsValue::from_str("not-array"));

        let bucket = Array::new();
        bucket.push(
            &Function::new_no_args("globalThis.__lifecycle_cleanup_hits.push('cleanup')").into(),
        );
        bucket.push(&JsValue::from_str("not-a-function"));
        rue.invoke_cleanup_bucket(&bucket.clone().into());
        rue.invoke_cleanup_bucket(&bucket.clone().into());

        assert_eq!(hits.length(), 1);
        assert_eq!(bucket.length(), 0);
    }

    #[wasm_bindgen_test]
    fn cleanup_bucket_non_array_path_is_a_noop() {
        let mut rue: Rue<JsDomAdapter> = Rue::new();
        rue.invoke_cleanup_bucket(&JsValue::UNDEFINED);
        rue.invoke_cleanup_bucket(&JsValue::NULL);
        rue.invoke_cleanup_bucket(&Object::new().into());
    }

    #[wasm_bindgen_test]
    fn instance_stack_hooks_register_collect_and_return_without_global_fallback() {
        let mut rue: Rue<JsDomAdapter> = Rue::new();
        let hits = Array::new();
        Reflect::set(&js_sys::global(), &JsValue::from_str("__lifecycle_stack_hits"), &hits)
            .unwrap();

        rue.push_hook(
            "mounted",
            Function::new_no_args("globalThis.__lifecycle_stack_hits.push('global-mounted')")
                .into(),
        );
        rue.instance_store.insert(3, test_instance(3));
        rue.instance_stack.push(3);

        rue.push_hook(
            "mounted",
            Function::new_no_args("globalThis.__lifecycle_stack_hits.push('instance-mounted')")
                .into(),
        );
        rue.push_hook("mounted", JsValue::from_str("not-a-function"));
        assert!(rue.push_instance_hook(
            3,
            "server_prefetch",
            Function::new_no_args(
                "globalThis.__lifecycle_stack_hits.push('instance-prefetch'); return Promise.resolve('ok')"
            )
            .into(),
        ));
        assert!(rue.push_instance_hook(3, "server_prefetch", JsValue::from_str("not-a-function")));
        assert!(!rue.push_instance_hook(
            404,
            "mounted",
            Function::new_no_args("return undefined").into(),
        ));

        rue.call_hooks("mounted");
        rue.call_hooks("missing-instance-hook");
        let _promise = rue.run_server_prefetch();

        rue.instance_stack.clear();
        rue.call_hooks("mounted");

        let values = hits.iter().filter_map(|value| value.as_string()).collect::<Vec<_>>();
        assert_eq!(
            values,
            vec![
                "instance-mounted".to_string(),
                "instance-prefetch".to_string(),
                "global-mounted".to_string(),
            ],
        );
    }

    #[wasm_bindgen_test]
    fn global_error_handler_runs_when_no_component_handler_exists() {
        let mut rue: Rue<JsDomAdapter> = Rue::new();
        let hits = Array::new();
        Reflect::set(&js_sys::global(), &JsValue::from_str("__lifecycle_error_hits"), &hits)
            .unwrap();
        rue.on_error(
            Function::new_with_args(
                "err",
                "globalThis.__lifecycle_error_hits.push(String(err && err.message || err))",
            )
            .into(),
        );

        rue.handle_error(js_sys::Error::new("planned").into());

        assert_eq!(hits.length(), 1);
        assert!(rue.last_error.is_some());
    }

    #[wasm_bindgen_test]
    fn component_error_handlers_run_before_global_handlers_and_mark_instance_error() {
        let mut rue: Rue<JsDomAdapter> = Rue::new();
        let hits = Array::new();
        Reflect::set(
            &js_sys::global(),
            &JsValue::from_str("__lifecycle_component_error_hits"),
            &hits,
        )
        .unwrap();
        rue.on_error(
            Function::new_no_args("globalThis.__lifecycle_component_error_hits.push('global')")
                .into(),
        );

        let mut current = test_instance(5);
        current.error_handlers.push(
            Function::new_with_args(
                "err",
                "globalThis.__lifecycle_component_error_hits.push('component:' + String(err))",
            )
            .into(),
        );
        current.error_handlers.push(JsValue::from_str("not-a-function"));
        rue.current_instance = Some(current);

        rue.handle_error(JsValue::from_str("boom"));

        let values = hits.iter().filter_map(|value| value.as_string()).collect::<Vec<_>>();
        assert_eq!(values, vec!["component:boom".to_string()]);
        assert!(rue.current_instance.as_ref().and_then(|inst| inst.error.clone()).is_some());
        assert_eq!(rue.last_error.as_ref().and_then(JsValue::as_string).as_deref(), Some("boom"));
    }

    #[wasm_bindgen_test]
    fn use_plugin_deferred_queue_invokes_install_with_options() {
        let mut rue: Rue<JsDomAdapter> = Rue::new();
        let plugin = Object::new();
        let hits = Array::new();
        Reflect::set(&js_sys::global(), &JsValue::from_str("__plugin_hits"), &hits).unwrap();
        Reflect::set(
            &plugin,
            &JsValue::from_str("install"),
            &Function::new_with_args(
                "app, options",
                "globalThis.__plugin_hits.push(options && options.length)",
            )
            .into(),
        )
        .unwrap();

        rue.use_plugin(plugin.into(), vec![JsValue::from_str("one"), JsValue::from_str("two")]);
        let mut task = rue.deferred_queue.pop().expect("plugin install should be deferred");
        task();

        assert_eq!(hits.get(0).as_f64(), Some(2.0));
    }

    #[wasm_bindgen_test]
    fn use_plugin_without_install_and_emitted_non_function_handlers_are_ignored() {
        let mut rue: Rue<JsDomAdapter> = Rue::new();
        rue.use_plugin(Object::new().into(), Vec::new());
        let mut task = rue.deferred_queue.pop().expect("plugin install should be deferred");
        task();

        let hits = Array::new();
        let mut props = ComponentProps::new();
        props.insert("onSave".to_string(), JsValue::from_str("not-a-function"));
        let hits_for_handler = hits.clone();
        let handler = wasm_bindgen::closure::Closure::wrap(Box::new(move |value: JsValue| {
            hits_for_handler.push(&JsValue::from_str(&format!(
                "lower:{}",
                value.as_string().unwrap_or_default()
            )));
        }) as Box<dyn FnMut(JsValue)>);
        props.insert(
            "onsave".to_string(),
            handler.as_ref().clone().unchecked_into::<Function>().into(),
        );

        let mut emit = rue.emitted(&props);
        emit("save".to_string(), vec![JsValue::from_str("payload")]);
        handler.forget();

        let values = hits.iter().filter_map(|value| value.as_string()).collect::<Vec<_>>();
        assert_eq!(values, vec!["lower:payload".to_string()]);
    }

    #[wasm_bindgen_test]
    fn emitted_maps_tsx_model_update_event_to_handler() {
        let rue: Rue<JsDomAdapter> = Rue::new();
        let hits = Array::new();
        let hits_for_handler = hits.clone();
        let handler = wasm_bindgen::closure::Closure::wrap(Box::new(move |value: JsValue| {
            hits_for_handler.push(&value);
        }) as Box<dyn FnMut(JsValue)>);

        let mut props = ComponentProps::new();
        props.insert(
            "onUpdateModelValue".to_string(),
            handler.as_ref().clone().unchecked_into::<Function>().into(),
        );

        let mut emit = rue.emitted(&props);
        emit("updateModelValue".to_string(), vec![JsValue::from_str("Rue")]);
        handler.forget();

        assert_eq!(hits.length(), 1);
        assert_eq!(hits.get(0).as_string().as_deref(), Some("Rue"));
    }

    #[wasm_bindgen_test]
    fn instance_scoped_hooks_server_prefetch_errors_and_emitters_run() {
        let mut rue: Rue<JsDomAdapter> = Rue::new();
        let hits = Array::new();
        Reflect::set(&js_sys::global(), &JsValue::from_str("__lifecycle_instance_hits"), &hits)
            .unwrap();

        let mut current = test_instance(7);
        current.error_handlers.push(
            Function::new_with_args(
                "err",
                "globalThis.__lifecycle_instance_hits.push('component-error:' + String(err && err.message || err))",
            )
            .into(),
        );
        rue.current_instance = Some(current);
        rue.handle_error(JsValue::from_str("direct"));

        rue.instance_store.insert(7, test_instance(7));
        rue.instance_stack.push(7);
        rue.push_hook(
            "mounted",
            Function::new_no_args("globalThis.__lifecycle_instance_hits.push('mounted')").into(),
        );
        rue.call_hooks("mounted");
        rue.push_hook(
            "server_prefetch",
            Function::new_no_args(
                "globalThis.__lifecycle_instance_hits.push('prefetch-ok'); return Promise.resolve('ok')",
            )
            .into(),
        );
        let _promise = rue.run_server_prefetch();

        let mut props = ComponentProps::new();
        props.insert(
            "onSaveNow".to_string(),
            Function::new_with_args(
                "a,b",
                "globalThis.__lifecycle_instance_hits.push('emit:' + a + ':' + b)",
            )
            .into(),
        );
        let mut emit = rue.emitted(&props);
        emit("save-now".to_string(), vec![JsValue::from_str("A"), JsValue::from_str("B")]);

        assert!(hits.length() >= 4);
    }

    #[wasm_bindgen_test]
    fn lifecycle_records_mount_vapor_and_range_activation_paths_run() {
        let mut rue: Rue<JsDomAdapter> = Rue::new();
        rue.set_dom_adapter(lifecycle_adapter());
        let hits = Array::new();
        Reflect::set(&js_sys::global(), &JsValue::from_str("__lifecycle_record_hits"), &hits)
            .unwrap();

        let bucket = Array::new();
        bucket.push(
            &Function::new_no_args("globalThis.__lifecycle_record_hits.push('cleanup')").into(),
        );
        let text_child = MountedSubtreeState::Text(MountedTextSubtree {
            host: None,
            key: None,
            cleanup_bucket: Some(bucket.into()),
            effect_scope_id: Some(99_999),
        });
        let component_patch = MountedPatchSubtree::new_component(
            Function::new_no_args("return null").into(),
            None,
            None,
            Vec::new(),
            vec![Function::new_no_args("globalThis.__lifecycle_record_hits.push('before')").into()],
            vec![
                Function::new_no_args("globalThis.__lifecycle_record_hits.push('unmounted')")
                    .into(),
            ],
            vec![
                Function::new_no_args("globalThis.__lifecycle_record_hits.push('activated')")
                    .into(),
            ],
            vec![
                Function::new_no_args("globalThis.__lifecycle_record_hits.push('deactivated')")
                    .into(),
            ],
            Some(Box::new(text_child)),
            Some(11),
        );
        let component = MountedSubtreeState::Patch(component_patch.clone());
        let record = component.lifecycle_record();

        rue.invoke_before_unmount_record(&record);
        rue.invoke_unmounted_record(&record);
        rue.invoke_activated_record(&record);
        rue.invoke_deactivated_record(&record);

        let start = Object::new();
        Reflect::set(&start, &JsValue::from_str("tag"), &JsValue::from_str("start")).unwrap();
        let end = Object::new();
        Reflect::set(&end, &JsValue::from_str("tag"), &JsValue::from_str("end")).unwrap();
        rue.range_map.push(RangeMountState {
            start: start.clone().into(),
            end: end.into(),
            mounted: Some(component_patch.into_root_state()),
        });
        rue.activate_range(&start.clone().into());
        rue.deactivate_range(&start.into());

        let mut container: JsValue = Object::new().into();
        rue.mount(
            |_| {
                MountInput::new_normalized(
                    MountInputType::Text("mounted".to_string()),
                    ComponentProps::new(),
                    Vec::new(),
                )
            },
            &mut container,
        );

        let fragment = Object::new();
        let child = Object::new();
        let children = Array::new();
        children.push(&child.into());
        Reflect::set(&fragment, &JsValue::from_str("tag"), &JsValue::from_str("fragment")).unwrap();
        Reflect::set(&fragment, &JsValue::from_str("children"), &children.into()).unwrap();
        let vapor = rue.vapor(|| fragment.clone().into());
        assert!(matches!(vapor.r#type, MountInputType::Vapor));
        assert!(vapor.props.contains_key("__fragNodes"));
        assert!(hits.length() >= 5);
    }
}
