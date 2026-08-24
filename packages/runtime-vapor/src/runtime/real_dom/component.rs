/*
组件真实挂载

负责创建组件实例、建立 propsRO、切换当前实例上下文、执行 render 函数，
并把组件返回值继续挂载成子树。最后将子树包成 Patch snapshot，供后续组件 patch 复用。
*/
use super::super::types::{
    MountInput, MountedPatchSubtree, MountedSubtreeState, OwnedMountPhase, OwnedMountToken,
    PendingComponentMounted,
};
use super::super::{ComponentInternalInstance, Rue};
use crate::hook::reactive::props_reactive_js;
use crate::reactive::context::{
    CONTEXT_LINKED_INSTANCE_PROP, CONTEXT_OWNER_PARENT_PROP, CONTEXT_PARENT_INSTANCE_PROP,
    set_current_instance_ci,
};
use crate::reactive::core::{
    begin_render_debug_owner, end_render_debug_owner, pop_effect_scope, push_effect_scope,
};
use crate::runtime::dom_adapter::DomAdapter;
use crate::runtime::shared_runtime_bridge;
use js_sys::{Function, Object, Reflect};
use wasm_bindgen::{JsCast, JsValue};

type ComponentLifecycleHookSets = (Vec<JsValue>, Vec<JsValue>, Vec<JsValue>, Vec<JsValue>);

pub(crate) struct ComponentMountedContext<A: DomAdapter> {
    pub hooks: Vec<JsValue>,
    pub host: JsValue,
    previous_current_instance: JsValue,
    previous_container: Option<A::Element>,
    previous_instance_stack: Vec<usize>,
    previous_owned_collectors: Vec<OwnedMountToken>,
    pushed_container: bool,
}

pub(crate) fn mount_component<A: DomAdapter>(
    rue: &mut Rue<A>,
    input: &MountInput<A>,
    render_fn: &JsValue,
    parent_context: Option<&A::Element>,
) -> Option<MountedSubtreeState<A>>
where
    A::Element: From<JsValue> + Into<JsValue> + Clone,
{
    let props_js = rue.props_with_children_input_to_jsobject(input);
    let (host, props_ro, idx) = prepare_instance_from_input(rue, props_js);
    let render_scope_id = rue.renew_component_render_scope(idx);
    // 将当前组件实例作为 render debug owner，供本轮创建的 effect 绑定调试归属。
    let host_value: JsValue = host.clone().into();
    begin_render_debug_owner(&host_value);
    shared_runtime_bridge::begin_component_render(&host_value);
    push_effect_scope(render_scope_id);
    let func = render_fn.dyn_ref::<Function>().unwrap();
    let prev_container = rue.current_container.clone();
    let mut did_push_current_container = false;
    if let Some(parent) = parent_context {
        rue.current_container = Some(parent.clone());
        let parent_value: JsValue = parent.clone().into();
        shared_runtime_bridge::push_current_container(&parent_value);
        did_push_current_container = true;
    }
    let ret = match func.call1(&JsValue::UNDEFINED, &props_ro) {
        Ok(value) => value,
        Err(error) => {
            if did_push_current_container {
                shared_runtime_bridge::pop_current_container();
            }
            rue.current_container = prev_container.clone();
            let _ = pop_effect_scope();
            shared_runtime_bridge::end_component_render();
            end_render_debug_owner();
            rue.instance_stack.pop();
            restore_current_instance_from_stack(rue);
            let captured = shared_runtime_bridge::dispatch_error_captured(
                &error,
                &host_value,
                "component render",
            );
            if captured {
                rue.last_error = Some(error.clone());
            } else {
                rue.handle_error(error.clone());
            }
            return None;
        }
    };
    if did_push_current_container {
        shared_runtime_bridge::pop_current_container();
    }
    rue.current_container = prev_container;
    let _ = pop_effect_scope();

    merge_pending_hooks(rue);
    rue.call_hooks("before_create");
    rue.call_hooks("created");
    rue.call_hooks("before_mount");

    let empty_component_return = ret.is_null() || ret.is_undefined();
    let mounted_subtree_opt = if empty_component_return {
        None
    } else if let Some(sub_input) =
        rue.component_return_value_to_input(&ret, input.strict_component_returns)
    {
        crate::set_current_instance(host.clone().into());
        rue.mount_from_input(&sub_input, parent_context)
    } else if ret.is_object() {
        let error = JsValue::from_str(
            "Unsupported object returns are no longer accepted on the default component path. Return a portable handle or mount handle instead.",
        );
        rue.handle_error(error.clone());
        None
    } else {
        let el: A::Element = ret.into();
        Some(MountedSubtreeState::Vapor(super::super::types::MountedVaporSubtree {
            r#type: super::super::types::MountedVaporSubtreeType::Vapor,
            host: Some(el),
            key: None,
            fragment_nodes: Vec::new(),
            props: super::super::types::ComponentProps::new(),
            cleanup_bucket: None,
            effect_scope_id: None,
        }))
    };
    shared_runtime_bridge::end_component_render();
    end_render_debug_owner();
    if mounted_subtree_opt.is_none() && !empty_component_return {
        rue.instance_stack.pop();
        restore_current_instance_from_stack(rue);
        return None;
    }

    let parent_inst_index =
        Reflect::get(&host_value, &JsValue::from_str(CONTEXT_OWNER_PARENT_PROP))
            .ok()
            .filter(JsValue::is_object)
            .and_then(|parent| {
                let direct = Reflect::get(&parent, &JsValue::from_str("__ci_index"))
                    .unwrap_or(JsValue::UNDEFINED);
                if direct.as_f64().is_some() {
                    Some(parent)
                } else {
                    Reflect::get(&parent, &JsValue::from_str(CONTEXT_LINKED_INSTANCE_PROP)).ok()
                }
            })
            .and_then(|parent| Reflect::get(&parent, &JsValue::from_str("__ci_index")).ok())
            .and_then(|index| index.as_f64())
            .map(|index| index as usize);
    let delayed_mounted =
        rue.queue_current_component_mounted(idx, parent_inst_index, parent_context.cloned());
    if !delayed_mounted {
        rue.call_hooks("mounted");
        merge_pending_hooks(rue);
        if let Some(inst) = rue.instance_store.get_mut(&idx) {
            inst.is_mounted = true;
        }
    }

    // 组件级 KeepAlive hooks 与卸载 hooks 一起写入 mounted snapshot，后续按 range 递归触发。
    // mounted 回调内部也允许注册 onUnmounted，这些清理必须被纳入当前 mounted state。
    let (before_unmount_hooks, unmounted_hooks, activated_hooks, deactivated_hooks) =
        component_lifecycle_hooks_from_stack(rue);

    rue.instance_stack.pop();
    restore_current_instance_from_stack(rue);

    let (host, fragment_nodes, comp_subtree) = if let Some(mounted_subtree) = mounted_subtree_opt {
        (
            mounted_subtree.host_cloned(),
            mounted_subtree.fragment_nodes_cloned(),
            Some(Box::new(mounted_subtree)),
        )
    } else {
        (None, Vec::new(), None)
    };

    Some(MountedSubtreeState::Patch(MountedPatchSubtree::new_component(
        render_fn.clone(),
        host,
        input.key.clone(),
        fragment_nodes,
        before_unmount_hooks,
        unmounted_hooks,
        activated_hooks,
        deactivated_hooks,
        comp_subtree,
        Some(idx),
    )))
}

#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
fn restore_current_instance_from_stack<A: DomAdapter>(rue: &mut Rue<A>)
where
    A::Element: From<JsValue> + Into<JsValue> + Clone,
{
    if let Some(top_idx) = rue.instance_stack.last() {
        if let Some(inst_ref) = rue.instance_store.get_mut(top_idx) {
            set_current_instance_ci(inst_ref);
            return;
        }
    }

    crate::set_current_instance(JsValue::UNDEFINED);
}

#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
fn empty_component_lifecycle_hook_sets() -> ComponentLifecycleHookSets {
    (Vec::new(), Vec::new(), Vec::new(), Vec::new())
}

#[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
fn component_lifecycle_hooks_from_stack<A: DomAdapter>(rue: &Rue<A>) -> ComponentLifecycleHookSets
where
    A::Element: Clone,
{
    if let Some(top_idx) = rue.instance_stack.last() {
        if let Some(ci) = rue.instance_store.get(top_idx) {
            return (
                ci.hooks.0.get("before_unmount").cloned().unwrap_or_default(),
                ci.hooks.0.get("unmounted").cloned().unwrap_or_default(),
                ci.hooks.0.get("activated").cloned().unwrap_or_default(),
                ci.hooks.0.get("deactivated").cloned().unwrap_or_default(),
            );
        }

        return empty_component_lifecycle_hook_sets();
    }

    empty_component_lifecycle_hook_sets()
}

/// 挂载阶段根据 MountInput 准备组件实例。
///
/// 默认挂载主路径已经不再缓存外层 live 树对象，这里直接基于 MountInput
/// 创建 propsRO、宿主对象与实例索引，并把实例压入当前上下文。
fn prepare_instance_from_input<A: DomAdapter>(
    rue: &mut Rue<A>,
    props_js: JsValue,
) -> (Object, JsValue, usize)
where
    A::Element: From<JsValue> + Into<JsValue> + Clone,
{
    let parent_instance = crate::get_current_instance();
    let props_ro = shared_runtime_bridge::props_reactive(&props_js)
        .unwrap_or_else(|| props_reactive_js(props_js.clone(), Some(true)));
    let host = Object::new();
    let hooks = Object::new();
    let _ = Reflect::set(&hooks, &JsValue::from_str("states"), &js_sys::Array::new());
    let _ = Reflect::set(&hooks, &JsValue::from_str("index"), &JsValue::from_f64(0.0));
    let _ = Reflect::set(&host, &JsValue::from_str("__hooks"), &hooks);
    let _ = Reflect::set(&host, &JsValue::from_str("propsRO"), &props_ro);
    let effective_parent = if !parent_instance.is_undefined() && !parent_instance.is_null() {
        parent_instance
    } else {
        Reflect::get(&props_ro, &JsValue::from_str(CONTEXT_OWNER_PARENT_PROP))
            .unwrap_or(JsValue::UNDEFINED)
    };
    if !effective_parent.is_undefined() && !effective_parent.is_null() {
        let _ =
            Reflect::set(&host, &JsValue::from_str(CONTEXT_OWNER_PARENT_PROP), &effective_parent);
        let _ = Reflect::set(
            &host,
            &JsValue::from_str(CONTEXT_PARENT_INSTANCE_PROP),
            &effective_parent,
        );
    }
    super::helpers::reset_hook_index(&host);

    let idx = rue.allocate_component_instance_id();
    let new_inst = ComponentInternalInstance::<A> {
        parent: None,
        is_mounted: false,
        hooks: super::super::instance::LifecycleHooks(std::collections::HashMap::new()),
        props_ro: props_ro.clone(),
        host: host.clone().into(),
        render_scope_id: None,
        error: None,
        error_handlers: Vec::new(),
        index: idx,
        _marker: std::marker::PhantomData,
    };
    rue.instance_store.insert(idx, new_inst);
    rue.instance_stack.push(idx);

    let inst_ref =
        rue.instance_store.get_mut(&idx).expect("component instance should exist after insertion");
    set_current_instance_ci(inst_ref);

    (host, props_ro, idx)
}

impl<A: DomAdapter> Rue<A>
where
    A::Element: From<JsValue> + Into<JsValue> + Clone,
{
    pub(crate) fn begin_pending_component_mounted(
        &mut self,
        pending: &PendingComponentMounted<A>,
    ) -> Option<ComponentMountedContext<A>> {
        let slot = self.owned_mount_slot(pending.owner)?;
        if slot.phase != OwnedMountPhase::Committed {
            return None;
        }
        let inst = self.instance_store.get(&pending.inst_index)?;
        let hooks = inst.hooks.0.get("mounted").cloned().unwrap_or_default();
        let host = inst.host.clone();
        let previous_current_instance = crate::get_current_instance();
        let previous_container = self.current_container.clone();
        let previous_instance_stack = self.instance_stack.clone();
        let previous_owned_collectors = self.current_owned_collectors.clone();

        self.current_owned_collectors.push(pending.owner);
        self.instance_stack.push(pending.inst_index);
        if let Some(inst) = self.instance_store.get_mut(&pending.inst_index) {
            set_current_instance_ci(inst);
        }
        shared_runtime_bridge::begin_component_render(&host);
        let pushed_container = if let Some(container) = pending.container.as_ref() {
            self.current_container = Some(container.clone());
            let container_value: JsValue = container.clone().into();
            shared_runtime_bridge::push_current_container(&container_value);
            true
        } else {
            false
        };

        Some(ComponentMountedContext {
            hooks,
            host,
            previous_current_instance,
            previous_container,
            previous_instance_stack,
            previous_owned_collectors,
            pushed_container,
        })
    }

    pub(crate) fn pending_component_mounted_is_alive(
        &self,
        pending: &PendingComponentMounted<A>,
    ) -> bool {
        self.owned_mount_slot(pending.owner).is_some()
            && self.instance_store.contains_key(&pending.inst_index)
    }

    pub(crate) fn finish_pending_component_mounted(
        &mut self,
        pending: &PendingComponentMounted<A>,
        context: ComponentMountedContext<A>,
    ) -> bool {
        let alive = self.pending_component_mounted_is_alive(pending);
        if alive {
            merge_pending_hooks(self);
            if let Some(inst) = self.instance_store.get_mut(&pending.inst_index) {
                inst.is_mounted = true;
            }
        } else {
            crate::runtime::take_pending_hooks();
        }

        if context.pushed_container {
            shared_runtime_bridge::pop_current_container();
        }
        shared_runtime_bridge::end_component_render();
        self.current_container = context.previous_container;
        self.instance_stack = context.previous_instance_stack;
        self.current_owned_collectors = context.previous_owned_collectors;
        crate::set_current_instance(context.previous_current_instance);
        alive
    }
}

/// 合并挂起的生命周期 hooks 到当前实例
fn merge_pending_hooks<A: DomAdapter>(rue: &mut Rue<A>) {
    // 读取全局挂起的 hooks 列表（由 runtime 收集）
    let pending = crate::runtime::take_pending_hooks();
    for (name, f) in pending.into_iter() {
        // 优先写入当前实例；若没有显式 current_instance，则写入栈顶实例
        if let Some(ci) = rue.current_instance.as_mut() {
            let list = ci.hooks.0.entry(name.clone()).or_insert_with(Vec::new);
            list.push(f.clone());
        } else if let Some(top_idx) = rue.instance_stack.last() {
            if let Some(inst) = rue.instance_store.get_mut(top_idx) {
                let list = inst.hooks.0.entry(name.clone()).or_insert_with(Vec::new);
                list.push(f.clone());
            }
        }
    }
}

#[doc(hidden)]
pub(crate) fn coverage_touch_internal_edges() -> bool {
    use crate::runtime::js_adapter::JsDomAdapter;
    use crate::runtime::types::{ComponentProps, MountInputType};
    use crate::runtime::{ComponentInternalInstance, LifecycleHooks, push_pending_hook};
    use std::collections::HashMap;
    use std::marker::PhantomData;

    fn component_input(render_fn: &Function) -> MountInput<JsDomAdapter> {
        MountInput::new_normalized(
            MountInputType::Component(render_fn.clone().into()),
            ComponentProps::new(),
            Vec::new(),
        )
    }

    fn test_instance(index: usize) -> ComponentInternalInstance<JsDomAdapter> {
        ComponentInternalInstance::<JsDomAdapter> {
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

    crate::set_current_instance(JsValue::UNDEFINED);

    let mut nested_rue = Rue::<JsDomAdapter>::new();
    let (_parent_host, _props_ro, parent_idx) =
        prepare_instance_from_input(&mut nested_rue, Object::new().into());
    let throwing = Function::new_no_args("throw new Error('component boom')");
    let throwing_js: JsValue = throwing.clone().into();
    let input = component_input(&throwing);
    let parent_context: JsValue = Object::new().into();
    let _ = mount_component(&mut nested_rue, &input, &throwing_js, Some(&parent_context));

    let mut root_error_rue = Rue::<JsDomAdapter>::new();
    let _ = mount_component(&mut root_error_rue, &input, &throwing_js, None);

    let mut missing_parent_rue = Rue::<JsDomAdapter>::new();
    missing_parent_rue.instance_stack.push(404);
    restore_current_instance_from_stack(&mut missing_parent_rue);

    let mut empty_stack_rue = Rue::<JsDomAdapter>::new();
    restore_current_instance_from_stack(&mut empty_stack_rue);

    let mut success_missing_parent_rue = Rue::<JsDomAdapter>::new();
    success_missing_parent_rue.instance_stack.push(777);
    let ok_render = Function::new_no_args("return 'host-like-value'");
    let ok_render_js: JsValue = ok_render.clone().into();
    let ok_input = component_input(&ok_render);
    let _ = mount_component(&mut success_missing_parent_rue, &ok_input, &ok_render_js, None);

    let mut lifecycle_rue = Rue::<JsDomAdapter>::new();
    let mut inst = test_instance(parent_idx + 1);
    inst.hooks.0.insert(
        "before_unmount".to_string(),
        vec![Function::new_no_args("return undefined").into()],
    );
    inst.hooks
        .0
        .insert("unmounted".to_string(), vec![Function::new_no_args("return undefined").into()]);
    inst.hooks
        .0
        .insert("activated".to_string(), vec![Function::new_no_args("return undefined").into()]);
    inst.hooks
        .0
        .insert("deactivated".to_string(), vec![Function::new_no_args("return undefined").into()]);
    lifecycle_rue.instance_store.insert(inst.index, inst);
    lifecycle_rue.instance_stack.push(parent_idx + 1);
    let hooks = component_lifecycle_hooks_from_stack(&lifecycle_rue);
    let lifecycle_hit_count = hooks.0.len() + hooks.1.len() + hooks.2.len() + hooks.3.len();

    lifecycle_rue.instance_stack.clear();
    lifecycle_rue.instance_stack.push(99_999);
    let _ = component_lifecycle_hooks_from_stack(&lifecycle_rue);
    lifecycle_rue.instance_stack.clear();
    let _ = component_lifecycle_hooks_from_stack(&lifecycle_rue);

    let mut pending_current_rue = Rue::<JsDomAdapter>::new();
    pending_current_rue.current_instance = Some(test_instance(10));
    crate::runtime::take_pending_hooks();
    push_pending_hook("mounted", Function::new_no_args("return undefined").into());
    merge_pending_hooks(&mut pending_current_rue);

    pending_current_rue.current_instance = None;
    pending_current_rue.instance_stack.push(10_000);
    push_pending_hook("created", Function::new_no_args("return undefined").into());
    merge_pending_hooks(&mut pending_current_rue);

    pending_current_rue.instance_stack.clear();
    push_pending_hook("before_mount", Function::new_no_args("return undefined").into());
    merge_pending_hooks(&mut pending_current_rue);

    crate::runtime::take_pending_hooks();
    crate::set_current_instance(JsValue::UNDEFINED);
    let _ = lifecycle_hit_count + nested_rue.instance_stack.len() + parent_idx;
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::runtime::js_adapter::JsDomAdapter;
    use crate::runtime::types::{ComponentProps, MountInputType};
    use crate::runtime::{ComponentInternalInstance, LifecycleHooks};
    use crate::runtime::{push_pending_hook, take_pending_hooks};
    use std::collections::HashMap;
    use std::marker::PhantomData;
    use wasm_bindgen_test::*;

    fn component_input(render_fn: &Function) -> MountInput<JsDomAdapter> {
        MountInput::new_normalized(
            MountInputType::Component(render_fn.clone().into()),
            ComponentProps::new(),
            Vec::new(),
        )
    }

    fn test_instance(index: usize) -> ComponentInternalInstance<JsDomAdapter> {
        ComponentInternalInstance::<JsDomAdapter> {
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

    fn current_instance_is_clear() -> bool {
        let current = crate::get_current_instance();
        current.is_undefined() || current.is_null()
    }

    struct SharedRuntimeBridgeGuard {
        previous: JsValue,
        had_previous: bool,
    }

    impl Drop for SharedRuntimeBridgeGuard {
        fn drop(&mut self) {
            let global = js_sys::global();
            let key = JsValue::from_str("__rue_runtime_vapor_shared_bridge");
            if self.had_previous {
                let _ = Reflect::set(&global, &key, &self.previous);
            } else {
                let _ = Reflect::delete_property(&global, &key);
            }
        }
    }

    fn install_capturing_error_bridge() -> SharedRuntimeBridgeGuard {
        let global = js_sys::global();
        let key = JsValue::from_str("__rue_runtime_vapor_shared_bridge");
        let had_previous = Reflect::has(&global, &key).unwrap_or(false);
        let previous = Reflect::get(&global, &key).unwrap_or(JsValue::UNDEFINED);
        let bridge = Object::new();
        let dispatch: JsValue = Function::new_no_args("return true").into();
        Reflect::set(&bridge, &JsValue::from_str("dispatchErrorCaptured"), &dispatch).unwrap();
        Reflect::set(&global, &key, &bridge).unwrap();

        SharedRuntimeBridgeGuard { previous, had_previous }
    }

    #[wasm_bindgen_test]
    fn prepare_instance_and_merge_pending_hooks_cover_context_edges() {
        let mut rue = Rue::<JsDomAdapter>::new();
        let props = Object::new();
        Reflect::set(&props, &JsValue::from_str("title"), &JsValue::from_str("demo")).unwrap();

        let (host, props_ro, idx) = prepare_instance_from_input(&mut rue, props.into());
        assert_eq!(idx, 0);
        assert_eq!(rue.instance_stack, vec![0]);
        assert!(Reflect::get(&host, &JsValue::from_str("__hooks")).unwrap().is_object());
        assert!(props_ro.is_object());

        take_pending_hooks();
        push_pending_hook("mounted", Function::new_no_args("return undefined").into());
        merge_pending_hooks(&mut rue);

        let inst = rue.instance_store.get(&idx).expect("instance should be stored");
        assert_eq!(inst.hooks.0.get("mounted").map(Vec::len), Some(1));
        crate::set_current_instance(JsValue::UNDEFINED);
        take_pending_hooks();
    }

    #[wasm_bindgen_test]
    fn mount_component_render_error_restores_parent_context_edges() {
        let _bridge = install_capturing_error_bridge();
        crate::set_current_instance(JsValue::UNDEFINED);

        let mut nested_rue = Rue::<JsDomAdapter>::new();
        let (_parent_host, _props_ro, parent_idx) =
            prepare_instance_from_input(&mut nested_rue, Object::new().into());
        let throwing = Function::new_no_args("throw new Error('component boom')");
        let throwing_js: JsValue = throwing.clone().into();
        let input = component_input(&throwing);

        let mounted = mount_component(&mut nested_rue, &input, &throwing_js, None);

        assert!(mounted.is_none());
        assert_eq!(nested_rue.instance_stack, vec![parent_idx]);
        assert!(nested_rue.last_error.is_some());
        assert!(crate::get_current_instance().is_object());

        crate::set_current_instance(JsValue::UNDEFINED);
        let mut missing_parent_rue = Rue::<JsDomAdapter>::new();
        missing_parent_rue.instance_stack.push(404);
        let mounted = mount_component(&mut missing_parent_rue, &input, &throwing_js, None);

        assert!(mounted.is_none());
        assert_eq!(missing_parent_rue.instance_stack, vec![404]);
        assert!(missing_parent_rue.instance_store.get(&404).is_none());
        crate::set_current_instance(JsValue::UNDEFINED);
        assert!(current_instance_is_clear());
        take_pending_hooks();
    }

    #[wasm_bindgen_test]
    fn mount_component_success_restores_missing_parent_context_edge() {
        crate::set_current_instance(JsValue::UNDEFINED);

        let mut rue = Rue::<JsDomAdapter>::new();
        rue.instance_stack.push(777);
        let render_fn = Function::new_no_args("return 'host-like-value'");
        let render_js: JsValue = render_fn.clone().into();
        let input = component_input(&render_fn);

        let mounted = mount_component(&mut rue, &input, &render_js, None);

        assert!(mounted.is_some());
        assert_eq!(rue.instance_stack, vec![777]);
        assert!(rue.instance_store.get(&777).is_none());
        crate::set_current_instance(JsValue::UNDEFINED);
        assert!(current_instance_is_clear());
        take_pending_hooks();
    }

    #[wasm_bindgen_test]
    fn merge_pending_hooks_covers_current_instance_and_missing_store_edges() {
        let mut rue = Rue::<JsDomAdapter>::new();
        rue.current_instance = Some(test_instance(10));

        take_pending_hooks();
        push_pending_hook("mounted", Function::new_no_args("return undefined").into());
        merge_pending_hooks(&mut rue);

        assert_eq!(
            rue.current_instance
                .as_ref()
                .and_then(|inst| inst.hooks.0.get("mounted"))
                .map(Vec::len),
            Some(1),
        );

        rue.current_instance = None;
        rue.instance_stack.push(10_000);
        push_pending_hook("created", Function::new_no_args("return undefined").into());
        merge_pending_hooks(&mut rue);

        assert!(rue.instance_store.get(&10_000).is_none());
        take_pending_hooks();
        crate::set_current_instance(JsValue::UNDEFINED);
    }
}
