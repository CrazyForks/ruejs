//! WASM 侧桥接模块（中文注释增强）
//!
//! - 暴露 WasmRue 供 JS 调用（创建、渲染、挂载、卸载等）
//! - 管理默认 MountInput 注册表与异步渲染队列（render/renderBetween/renderStatic）
//! - 通过 Promise.then 驱动批处理刷新，避免重入
//! - 提供 DOM 适配器的设置与读取，以及生命周期 hooks 注册
use crate::reactive::core::dispose_effect_scope;
use crate::reactive::effect::EffectHandle;
use crate::runtime::core::Rue;
use crate::runtime::js_adapter::JsDomAdapter;
use crate::runtime::types::{MountInput, OwnedMountToken};
use js_sys::{Function, Object, Promise, Reflect};
use std::cell::RefCell;
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use wasm_bindgen::closure::Closure;
use wasm_bindgen::prelude::*;

mod create_element;
mod create_rue;
mod emitted;
mod get_current_container;
mod input;
mod keep_alive_lifecycle;
mod mount;
mod on_activated;
mod on_before_create;
mod on_before_mount;
mod on_before_unmount;
mod on_before_update;
mod on_created;
mod on_deactivated;
mod on_error;
mod on_mounted;
mod on_render_triggered;
mod on_server_prefetch;
mod on_unmounted;
mod on_updated;
mod render;
mod render_anchor;
mod render_between;
mod render_static;
mod set_dom_adapter;
mod unmount;
mod use_plugin;
mod vapor;

pub use create_rue::createRue;

#[wasm_bindgen]
pub struct WasmRue {
    inner: RefCell<Rue<JsDomAdapter>>,
    // JS 回调可能在 inner 被可变借用期间重入查询 owned mount 状态。
    // 单独镜像 collector 栈，避免 RefCell trap，同时保持查询语义准确。
    owned_mount_collectors: RefCell<Vec<OwnedMountToken>>,
    // 最近一次渲染/挂载的容器引用（JS 值克隆）：
    // - 供 getCurrentContainer() 之类的 API 使用
    // - 也便于在某些错误/兜底路径下找到“当前容器上下文”
    last_container: RefCell<Option<JsValue>>,
    pending_anchor: RefCell<Vec<(MountInput<JsDomAdapter>, JsValue, JsValue)>>,
    pending_between: RefCell<Vec<(MountInput<JsDomAdapter>, JsValue, JsValue, JsValue)>>,
    // KeepAlive 生命周期触发可能发生在 runtime 借用期间，先按 range start anchor 入队。
    pending_activated_ranges: RefCell<Vec<JsValue>>,
    pending_deactivated_ranges: RefCell<Vec<JsValue>>,
    pending_render: RefCell<Vec<(MountInput<JsDomAdapter>, JsValue)>>,
    pending_static: RefCell<Vec<(MountInput<JsDomAdapter>, JsValue, JsValue)>>,
    // root 级别的 effect 句柄（由 mount 创建）：
    // - mount(app, container) 会用 create_effect 包裹 app 执行，从而实现依赖变化自动重渲染
    // - 需要在 unmount 或再次 mount 时释放，避免多个 root effect 并存导致重复渲染/内存泄漏
    root_effect: RefCell<Option<EffectHandle>>,
    root_effect_scope: RefCell<Option<usize>>,
    root_effect_closure: RefCell<Option<Closure<dyn FnMut()>>>,
}

impl WasmRue {
    fn owned_mount_token_to_js(token: OwnedMountToken) -> JsValue {
        let value = Object::new();
        let _ = Reflect::set(
            &value,
            &JsValue::from_str("__rue_owned_mount_slot"),
            &JsValue::from_f64(token.slot as f64),
        );
        let _ = Reflect::set(
            &value,
            &JsValue::from_str("__rue_owned_mount_generation"),
            &JsValue::from_str(&token.generation.to_string()),
        );
        value.into()
    }

    fn owned_mount_token_from_js(value: &JsValue) -> Option<OwnedMountToken> {
        if !value.is_object() {
            return None;
        }
        let slot =
            Reflect::get(value, &JsValue::from_str("__rue_owned_mount_slot")).ok()?.as_f64()?;
        let generation = Reflect::get(value, &JsValue::from_str("__rue_owned_mount_generation"))
            .ok()?
            .as_string()?
            .parse::<u64>()
            .ok()?;
        if !slot.is_finite() || slot < 0.0 || generation < 1 || slot.fract() != 0.0 {
            return None;
        }
        Some(OwnedMountToken { slot: slot as usize, generation: generation as u64 })
    }

    fn flush_component_mounted(
        &self,
        pending: Vec<crate::runtime::types::PendingComponentMounted<JsDomAdapter>>,
    ) {
        for item in pending {
            let Some((context, collectors)) =
                self.inner.try_borrow_mut().ok().and_then(|mut inner| {
                    let context = inner.begin_pending_component_mounted(&item)?;
                    Some((context, inner.current_owned_collectors.clone()))
                })
            else {
                continue;
            };
            *self.owned_mount_collectors.borrow_mut() = collectors;
            let hooks = context.hooks.clone();
            let host = context.host.clone();
            let mut hook_error = None;
            for hook in hooks {
                if let Some(func) = hook.dyn_ref::<Function>()
                    && let Err(error) = func.call0(&JsValue::UNDEFINED)
                {
                    hook_error.get_or_insert(error);
                }
                let alive = self
                    .inner
                    .try_borrow()
                    .map(|inner| inner.pending_component_mounted_is_alive(&item))
                    .unwrap_or(false);
                if !alive {
                    break;
                }
            }
            let collectors = if let Ok(mut inner) = self.inner.try_borrow_mut() {
                inner.finish_pending_component_mounted(&item, context);
                Some(inner.current_owned_collectors.clone())
            } else {
                None
            };
            if let Some(collectors) = collectors {
                *self.owned_mount_collectors.borrow_mut() = collectors;
            }
            if let Some(error) = hook_error {
                let captured = crate::runtime::shared_runtime_bridge::dispatch_error_captured(
                    &error,
                    &host,
                    "component mounted",
                );
                if let Ok(mut inner) = self.inner.try_borrow_mut() {
                    if captured {
                        inner.last_error = Some(error);
                    } else {
                        inner.handle_error(error);
                    }
                }
            }
        }
    }

    /// 处理挂起的渲染队列：render 优先，其次 renderBetween，最后 renderStatic
    ///
    /// 若借用失败（重入），将任务放回队列并终止本次处理
    fn process_queues(&self) {
        self.process_queues_inner();
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn process_queues_inner(&self) {
        loop {
            if self.process_keep_alive_lifecycle_queue() {
                continue;
            }
            let r = {
                let mut queue = self.pending_render.borrow_mut();
                if queue.is_empty() { None } else { Some(queue.remove(0)) }
            };
            if let Some((input_r, cont_r)) = r {
                match self.inner.try_borrow_mut() {
                    Ok(mut inner_r) => {
                        let mut cr = cont_r.clone();
                        inner_r.render_input(input_r, (&mut cr).into());
                    }
                    Err(_) => {
                        self.pending_render.borrow_mut().push((input_r, cont_r));
                        break;
                    }
                }
                continue;
            }
            let b = {
                let mut queue = self.pending_between.borrow_mut();
                if queue.is_empty() { None } else { Some(queue.remove(0)) }
            };
            if let Some((input_b, p_b, s_b, e_b)) = b {
                if self.process_between_item(input_b, p_b, s_b, e_b) {
                    continue;
                }
                break;
            }
            let a = {
                let mut queue = self.pending_anchor.borrow_mut();
                if queue.is_empty() { None } else { Some(queue.remove(0)) }
            };
            if let Some((input_a, p_a, anchor_a)) = a {
                if self.process_anchor_item(input_a, p_a, anchor_a) {
                    continue;
                }
                break;
            }
            let s = {
                let mut queue = self.pending_static.borrow_mut();
                if queue.is_empty() { None } else { Some(queue.remove(0)) }
            };
            if let Some((input_s, p_s, a_s)) = s {
                if self.process_static_item(input_s, p_s, a_s) {
                    continue;
                }
                break;
            }
            break;
        }
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn process_between_item(
        &self,
        input: MountInput<JsDomAdapter>,
        parent: JsValue,
        start: JsValue,
        end: JsValue,
    ) -> bool {
        match self.inner.try_borrow_mut() {
            Ok(mut inner) => {
                let mut parent_ref = parent.clone();
                inner.render_between_input(
                    input,
                    (&mut parent_ref).into(),
                    start.into(),
                    end.into(),
                );
                true
            }
            Err(_) => {
                self.pending_between.borrow_mut().push((input, parent, start, end));
                false
            }
        }
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn process_anchor_item(
        &self,
        input: MountInput<JsDomAdapter>,
        parent: JsValue,
        anchor: JsValue,
    ) -> bool {
        match self.inner.try_borrow_mut() {
            Ok(mut inner) => {
                let mut parent_ref = parent.clone();
                inner.render_anchor_input(input, (&mut parent_ref).into(), anchor.into());
                true
            }
            Err(_) => {
                self.pending_anchor.borrow_mut().push((input, parent, anchor));
                false
            }
        }
    }

    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn process_static_item(
        &self,
        input: MountInput<JsDomAdapter>,
        parent: JsValue,
        anchor: JsValue,
    ) -> bool {
        match self.inner.try_borrow_mut() {
            Ok(mut inner) => {
                let mut parent_ref = parent.clone();
                inner.render_static_input(input, (&mut parent_ref).into(), anchor.into());
                true
            }
            Err(_) => {
                self.pending_static.borrow_mut().push((input, parent, anchor));
                false
            }
        }
    }

    /// 是否存在挂起任务（render / renderBetween / renderStatic）
    fn has_pending(&self) -> bool {
        !self.pending_render.borrow().is_empty()
            || !self.pending_anchor.borrow().is_empty()
            || !self.pending_between.borrow().is_empty()
            || !self.pending_activated_ranges.borrow().is_empty()
            || !self.pending_deactivated_ranges.borrow().is_empty()
            || !self.pending_static.borrow().is_empty()
    }

    /// 创建一个闭包用于驱动队列处理；在任务未清空时递归调度
    #[cfg_attr(wasm_bindgen_unstable_test_coverage, coverage(off))]
    fn make_process_closure(this_ptr: *const WasmRue) -> Closure<dyn FnMut(JsValue)> {
        Closure::wrap(Box::new(move |_v: JsValue| {
            let this = unsafe { &*this_ptr };
            this.process_queues();
            if this.has_pending() {
                let cb2 = WasmRue::make_process_closure(this_ptr);
                let _ = Promise::resolve(&JsValue::UNDEFINED).then(&cb2);
                cb2.forget();
            }
        }) as Box<dyn FnMut(JsValue)>)
    }

    /// 安排一次异步刷新：Promise.then 调用处理闭包
    pub(super) fn schedule_flush(&self) {
        self.process_queues();
        if !self.has_pending() {
            return;
        }
        let this_ptr = self as *const WasmRue;
        let cb = WasmRue::make_process_closure(this_ptr);
        let _ = Promise::resolve(&JsValue::UNDEFINED).then(&cb);
        cb.forget();
    }

    fn dispose_root_effect(&self) {
        // 释放 mount 创建的 root effect（如果存在）。
        //
        // 设计上，一个 WasmRue 实例同一时刻只应该有一个“root effect”：
        // - 负责把 app(props) 的结果渲染到指定容器
        // - 依赖追踪会让它在响应式数据变化时自动重新运行
        //
        // 若不释放：
        // - 重复 mount 会叠加多个 effect，造成重复 render / DOM 重复插入
        // - 同时也会导致 JS Function / Closure 等资源无法回收
        if let Some(scope_id) = self.root_effect_scope.borrow_mut().take() {
            dispose_effect_scope(scope_id);
        }
        self.root_effect.borrow_mut().take();
        self.root_effect_closure.borrow_mut().take();
    }
}

#[wasm_bindgen]
impl WasmRue {
    /// 分配并激活一个 owned collector；返回值对 JS 是不透明 token。
    #[wasm_bindgen(js_name = "buildOwnedMount")]
    pub fn build_owned_mount_wasm(&self) -> JsValue {
        let Ok(mut inner) = self.inner.try_borrow_mut() else {
            return JsValue::UNDEFINED;
        };
        let token = inner.build_owned_mount();
        *self.owned_mount_collectors.borrow_mut() = inner.current_owned_collectors.clone();
        Self::owned_mount_token_to_js(token)
    }

    /// 完成 build/update collector。token 不是当前栈顶或 generation 已过期时拒绝。
    #[wasm_bindgen(js_name = "commitMounted")]
    pub fn commit_owned_mount_wasm(&self, token: JsValue, defer_mounted: Option<bool>) -> bool {
        let Some(token) = Self::owned_mount_token_from_js(&token) else {
            return false;
        };
        self.process_queues();
        let (committed, pending, collectors) = self
            .inner
            .try_borrow_mut()
            .map(|mut inner| {
                let committed = inner.commit_owned_mount(token);
                let pending = if committed && defer_mounted != Some(true) {
                    inner.take_committed_component_mounted(token)
                } else {
                    Vec::new()
                };
                (committed, pending, Some(inner.current_owned_collectors.clone()))
            })
            .unwrap_or((false, Vec::new(), None));
        if let Some(collectors) = collectors {
            *self.owned_mount_collectors.borrow_mut() = collectors;
        }
        self.flush_component_mounted(pending);
        self.process_queues();
        committed
    }

    #[wasm_bindgen(js_name = "flushMounted")]
    pub fn flush_owned_mount_mounted_wasm(&self, token: JsValue) -> bool {
        let Some(token) = Self::owned_mount_token_from_js(&token) else {
            return false;
        };
        let (alive, pending) = self
            .inner
            .try_borrow_mut()
            .map(|mut inner| {
                let alive = inner.owned_mount_slot(token).is_some();
                let pending = inner.take_committed_component_mounted(token);
                (alive, pending)
            })
            .unwrap_or((false, Vec::new()));
        self.flush_component_mounted(pending);
        alive
    }

    /// 激活既有 token 进行同 owner 更新，并先递归回收上一代 child token。
    #[wasm_bindgen(js_name = "updateOwnedMount")]
    pub fn update_owned_mount_wasm(&self, token: JsValue) -> bool {
        let Some(token) = Self::owned_mount_token_from_js(&token) else {
            return false;
        };
        self.process_queues();
        let (updated, collectors) = self
            .inner
            .try_borrow_mut()
            .map(|mut inner| {
                let updated = inner.begin_owned_mount_update_transitive(token);
                (updated, Some(inner.current_owned_collectors.clone()))
            })
            .unwrap_or((false, None));
        if let Some(collectors) = collectors {
            *self.owned_mount_collectors.borrow_mut() = collectors;
        }
        self.process_queues();
        updated
    }

    #[wasm_bindgen(js_name = "disposeOwnedMount")]
    pub fn dispose_owned_mount_wasm(&self, token: JsValue) -> bool {
        let Some(token) = Self::owned_mount_token_from_js(&token) else {
            return false;
        };
        self.process_queues();
        let (disposed, collectors) = self
            .inner
            .try_borrow_mut()
            .map(|mut inner| {
                let disposed = inner.dispose_owned_mount(token);
                (disposed, Some(inner.current_owned_collectors.clone()))
            })
            .unwrap_or((false, None));
        if let Some(collectors) = collectors {
            *self.owned_mount_collectors.borrow_mut() = collectors;
        }
        self.process_queues();
        disposed
    }

    /// abort 与 dispose 使用同一完整回滚路径，但保留独立协议阶段供调用方表达意图。
    #[wasm_bindgen(js_name = "abortOwnedMount")]
    pub fn abort_owned_mount_wasm(&self, token: JsValue) -> bool {
        self.dispose_owned_mount_wasm(token)
    }

    #[wasm_bindgen(js_name = "ownedMountCount")]
    pub fn owned_mount_count_wasm(&self) -> usize {
        self.inner.borrow().owned_mount_count()
    }

    #[wasm_bindgen(js_name = "ownedMountEntryCount")]
    pub fn owned_mount_entry_count_wasm(&self) -> usize {
        self.inner.borrow().owned_mount_entry_count()
    }

    #[wasm_bindgen(js_name = "componentInstanceCount")]
    pub fn component_instance_count_wasm(&self) -> usize {
        self.inner.borrow().component_instance_count()
    }

    #[wasm_bindgen(js_name = "componentWrapperCount")]
    pub fn component_wrapper_count_wasm(&self) -> usize {
        crate::reactive::context::component_instance_wrapper_count()
    }

    #[wasm_bindgen(js_name = "pendingComponentMountedCount")]
    pub fn pending_component_mounted_count_wasm(&self) -> usize {
        self.inner.borrow().pending_component_mounted_count()
    }

    #[wasm_bindgen(js_name = "effectScopeCount")]
    pub fn effect_scope_count_wasm(&self) -> usize {
        crate::reactive::core::active_effect_scope_count()
    }

    #[wasm_bindgen(js_name = "ownedMountCollecting")]
    pub fn owned_mount_collecting_wasm(&self) -> bool {
        !self.owned_mount_collectors.borrow().is_empty()
    }

    #[wasm_bindgen(js_name = "currentOwnedMountToken")]
    pub fn current_owned_mount_token_wasm(&self) -> JsValue {
        self.owned_mount_collectors
            .borrow()
            .last()
            .copied()
            .map(Self::owned_mount_token_to_js)
            .unwrap_or(JsValue::UNDEFINED)
    }

    #[wasm_bindgen(js_name = "globalAnchorMountCount")]
    pub fn global_anchor_mount_count_wasm(&self) -> usize {
        self.inner.borrow().anchor_mount_count()
    }

    #[wasm_bindgen(js_name = "globalRangeMountCount")]
    pub fn global_range_mount_count_wasm(&self) -> usize {
        self.inner.borrow().range_mount_count()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::reactive::context::set_current_instance;
    use crate::runtime::globals::{PENDING_HOOKS, take_pending_hooks};
    use crate::runtime::types::MountInputType;
    use js_sys::{Array, Function, Object, Reflect};
    use wasm_bindgen_futures::JsFuture;
    use wasm_bindgen_test::*;

    fn adapter_value() -> JsValue {
        let obj = Object::new();
        Reflect::set(
            &obj,
            &JsValue::from_str("createElement"),
            &Function::new_with_args("tag", "return { tag, children: [], nodeType: 1 }").into(),
        )
        .unwrap();
        Reflect::set(
            &obj,
            &JsValue::from_str("createTextNode"),
            &Function::new_with_args("text", "return { tag: '#text', text, nodeType: 3 }").into(),
        )
        .unwrap();
        Reflect::set(
            &obj,
            &JsValue::from_str("createDocumentFragment"),
            &Function::new_no_args("return { tag: 'fragment', children: [], nodeType: 11 }").into(),
        )
        .unwrap();
        Reflect::set(
            &obj,
            &JsValue::from_str("isFragment"),
            &Function::new_with_args("el", "return !!el && el.tag === 'fragment'").into(),
        )
        .unwrap();
        Reflect::set(
            &obj,
            &JsValue::from_str("collectFragmentChildren"),
            &Function::new_with_args("el", "return Array.from(el && el.children || [])").into(),
        )
        .unwrap();
        Reflect::set(
            &obj,
            &JsValue::from_str("setTextContent"),
            &Function::new_with_args("el,text", "el.text = text").into(),
        )
        .unwrap();
        Reflect::set(
            &obj,
            &JsValue::from_str("appendChild"),
            &Function::new_with_args(
                "p,c",
                "p.children = p.children||[]; p.children.push(c); c.parentNode = p",
            )
            .into(),
        )
        .unwrap();
        Reflect::set(
            &obj,
            &JsValue::from_str("insertBefore"),
            &Function::new_with_args(
                "p,c,b",
                "p.children = p.children||[]; const i = p.children.indexOf(b); \
                 i >= 0 ? p.children.splice(i, 0, c) : p.children.push(c); c.parentNode = p",
            )
            .into(),
        )
        .unwrap();
        Reflect::set(
            &obj,
            &JsValue::from_str("removeChild"),
            &Function::new_with_args("p,c", "p.children = (p.children||[]).filter(x => x !== c)")
                .into(),
        )
        .unwrap();
        Reflect::set(
            &obj,
            &JsValue::from_str("contains"),
            &Function::new_with_args("p,c", "return p === c || (p.children||[]).includes(c)")
                .into(),
        )
        .unwrap();
        for (name, f) in [
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
            (
                "setAttribute",
                Function::new_with_args("el,k,v", "el.attrs = el.attrs||{}; el.attrs[k] = v"),
            ),
            (
                "removeAttribute",
                Function::new_with_args("el,k", "if (el.attrs) delete el.attrs[k]"),
            ),
            ("getTagName", Function::new_with_args("el", "return el.tag || ''")),
            ("addEventListener", Function::new_with_args("el,evt,h", "return")),
            ("removeEventListener", Function::new_with_args("el,evt,h", "return")),
            ("hasValueProperty", Function::new_with_args("el", "return 'value' in el")),
            (
                "isSelectMultiple",
                Function::new_with_args("el", "return el.tag === 'SELECT' && !!el.multiple"),
            ),
            ("querySelector", Function::new_with_args("sel", "return { tag: sel }")),
        ] {
            Reflect::set(&obj, &JsValue::from_str(name), &f.into()).unwrap();
        }
        obj.into()
    }

    fn node(tag: &str) -> JsValue {
        let obj = Object::new();
        Reflect::set(&obj, &JsValue::from_str("tag"), &JsValue::from_str(tag)).unwrap();
        Reflect::set(&obj, &JsValue::from_str("children"), &Array::new().into()).unwrap();
        obj.into()
    }

    fn set_children(parent: &JsValue, children: &[JsValue]) {
        let arr = Array::new();
        for child in children {
            arr.push(child);
            Reflect::set(child, &JsValue::from_str("parentNode"), parent).unwrap();
        }
        Reflect::set(parent, &JsValue::from_str("children"), &arr.into()).unwrap();
        for (idx, child) in children.iter().enumerate() {
            let next = children.get(idx + 1).cloned().unwrap_or(JsValue::NULL);
            Reflect::set(child, &JsValue::from_str("nextSibling"), &next).unwrap();
        }
    }

    fn text_input(text: &str) -> MountInput<JsDomAdapter> {
        MountInput::new_normalized(
            MountInputType::<JsDomAdapter>::Text(text.to_string()),
            Default::default(),
            Vec::new(),
        )
    }

    async fn tick() {
        let _ = JsFuture::from(Promise::resolve(&JsValue::UNDEFINED)).await;
    }

    #[wasm_bindgen_test]
    fn owned_mount_collecting_is_reentrant_safe() {
        let rue = createRue(adapter_value());
        let token = rue.build_owned_mount_wasm();
        let borrow = rue.inner.borrow_mut();

        assert!(rue.owned_mount_collecting_wasm());
        assert!(!rue.current_owned_mount_token_wasm().is_undefined());

        drop(borrow);
        assert!(rue.commit_owned_mount_wasm(token, None));
        assert!(!rue.owned_mount_collecting_wasm());
    }

    fn child_count(parent: &JsValue) -> u32 {
        let children =
            Reflect::get(parent, &JsValue::from_str("children")).unwrap_or(Array::new().into());
        Array::from(&children).length()
    }

    #[wasm_bindgen_test(async)]
    async fn schedule_flush_requeues_render_until_inner_borrow_is_released() {
        let rue = createRue(adapter_value());
        let container = node("container");

        let borrow = rue.inner.borrow_mut();
        rue.pending_render.borrow_mut().push((text_input("render"), container.clone()));
        rue.schedule_flush();
        assert_eq!(rue.pending_render.borrow().len(), 1);
        drop(borrow);

        tick().await;

        assert_eq!(rue.pending_render.borrow().len(), 0);
        assert_eq!(child_count(&container), 1);
    }

    #[wasm_bindgen_test(async)]
    async fn schedule_flush_requeues_between_anchor_and_static_until_borrow_is_released() {
        let rue = createRue(adapter_value());

        let between_parent = node("between_parent");
        let start = node("start");
        let end = node("end");
        set_children(&between_parent, &[start.clone(), end.clone()]);
        let borrow = rue.inner.borrow_mut();
        rue.pending_between.borrow_mut().push((
            text_input("between"),
            between_parent.clone(),
            start.clone(),
            end.clone(),
        ));
        rue.schedule_flush();
        assert_eq!(rue.pending_between.borrow().len(), 1);
        drop(borrow);
        tick().await;
        assert_eq!(rue.pending_between.borrow().len(), 0);
        assert_eq!(child_count(&between_parent), 3);

        let anchor_parent = node("anchor_parent");
        let anchor = node("anchor");
        set_children(&anchor_parent, &[anchor.clone()]);
        let borrow = rue.inner.borrow_mut();
        rue.pending_anchor.borrow_mut().push((
            text_input("anchor"),
            anchor_parent.clone(),
            anchor.clone(),
        ));
        rue.schedule_flush();
        assert_eq!(rue.pending_anchor.borrow().len(), 1);
        drop(borrow);
        tick().await;
        assert_eq!(rue.pending_anchor.borrow().len(), 0);
        assert_eq!(child_count(&anchor_parent), 2);

        let static_parent = node("static_parent");
        let static_anchor = node("static_anchor");
        set_children(&static_parent, &[static_anchor.clone()]);
        let borrow = rue.inner.borrow_mut();
        rue.pending_static.borrow_mut().push((
            text_input("static"),
            static_parent.clone(),
            static_anchor.clone(),
        ));
        rue.schedule_flush();
        assert_eq!(rue.pending_static.borrow().len(), 1);
        drop(borrow);
        tick().await;
        assert_eq!(rue.pending_static.borrow().len(), 0);
        assert_eq!(child_count(&static_parent), 1);
    }

    #[wasm_bindgen_test]
    fn process_queues_requeues_non_render_tasks_when_runtime_is_borrowed() {
        let rue = createRue(adapter_value());

        let between_parent = node("between_parent_direct");
        let start = node("between_start_direct");
        let end = node("between_end_direct");
        set_children(&between_parent, &[start.clone(), end.clone()]);
        let borrow = rue.inner.borrow_mut();
        rue.pending_between.borrow_mut().push((
            text_input("between-direct"),
            between_parent,
            start,
            end,
        ));
        rue.process_queues();
        assert_eq!(rue.pending_between.borrow().len(), 1);
        drop(borrow);
        rue.pending_between.borrow_mut().clear();

        let anchor_parent = node("anchor_parent_direct");
        let anchor = node("anchor_direct");
        set_children(&anchor_parent, &[anchor.clone()]);
        let borrow = rue.inner.borrow_mut();
        rue.pending_anchor.borrow_mut().push((text_input("anchor-direct"), anchor_parent, anchor));
        rue.process_queues();
        assert_eq!(rue.pending_anchor.borrow().len(), 1);
        drop(borrow);
        rue.pending_anchor.borrow_mut().clear();

        let static_parent = node("static_parent_direct");
        let static_anchor = node("static_anchor_direct");
        set_children(&static_parent, &[static_anchor.clone()]);
        let borrow = rue.inner.borrow_mut();
        rue.pending_static.borrow_mut().push((
            text_input("static-direct"),
            static_parent,
            static_anchor,
        ));
        rue.process_queues();
        assert_eq!(rue.pending_static.borrow().len(), 1);
        drop(borrow);
        rue.pending_static.borrow_mut().clear();
    }

    #[wasm_bindgen_test]
    fn invalid_bridge_entrypoints_skip_cleanup_when_inner_is_already_borrowed() {
        let rue = createRue(adapter_value());
        let unsupported = JsValue::from_str("unsupported");

        let container = node("container");
        let borrow = rue.inner.borrow_mut();
        rue.render_wasm(unsupported.clone(), container);
        assert!(rue.pending_render.borrow().is_empty());
        drop(borrow);

        let anchor_parent = node("anchor_parent");
        let anchor = node("anchor");
        set_children(&anchor_parent, &[anchor.clone()]);
        let borrow = rue.inner.borrow_mut();
        rue.render_anchor_wasm(unsupported.clone(), anchor_parent, anchor);
        assert!(rue.pending_anchor.borrow().is_empty());
        drop(borrow);

        let between_parent = node("between_parent");
        let start = node("start");
        let end = node("end");
        set_children(&between_parent, &[start.clone(), end.clone()]);
        let borrow = rue.inner.borrow_mut();
        rue.render_between_wasm(unsupported.clone(), between_parent, start, end);
        assert!(rue.pending_between.borrow().is_empty());
        drop(borrow);

        let static_parent = node("static_parent");
        let static_anchor = node("static_anchor");
        set_children(&static_parent, &[static_anchor.clone()]);
        let borrow = rue.inner.borrow_mut();
        rue.render_static_wasm(unsupported, static_parent, static_anchor);
        assert!(rue.pending_static.borrow().is_empty());
        drop(borrow);
    }

    #[wasm_bindgen_test]
    fn keep_alive_hook_bridges_register_or_queue_when_runtime_is_borrowed() {
        PENDING_HOOKS.with(|queue| queue.borrow_mut().clear());
        let rue = createRue(adapter_value());

        rue.on_activated(JsValue::from_str("activated-direct"));
        rue.on_deactivated(JsValue::from_str("deactivated-direct"));
        assert!(take_pending_hooks().is_empty());

        let borrow = rue.inner.borrow_mut();
        rue.on_activated(JsValue::from_str("activated-pending"));
        rue.on_deactivated(JsValue::from_str("deactivated-pending"));
        drop(borrow);

        let pending = take_pending_hooks();
        assert_eq!(pending.len(), 2);
        assert_eq!(pending[0].0, "activated");
        assert_eq!(pending[0].1.as_string().as_deref(), Some("activated-pending"));
        assert_eq!(pending[1].0, "deactivated");
        assert_eq!(pending[1].1.as_string().as_deref(), Some("deactivated-pending"));
    }

    #[wasm_bindgen_test]
    fn keep_alive_range_bridge_queues_and_drains_lifecycle_requests() {
        let rue = createRue(adapter_value());
        let activated_start = node("activated_start");
        let deactivated_start = node("deactivated_start");

        let borrow = rue.inner.borrow_mut();
        rue.activate_range_wasm(activated_start.clone());
        rue.deactivate_range_wasm(deactivated_start.clone());
        assert_eq!(rue.pending_activated_ranges.borrow().len(), 1);
        assert_eq!(rue.pending_deactivated_ranges.borrow().len(), 1);
        drop(borrow);

        assert!(rue.process_keep_alive_lifecycle_queue());
        assert_eq!(rue.pending_deactivated_ranges.borrow().len(), 0);
        assert_eq!(rue.pending_activated_ranges.borrow().len(), 1);

        assert!(rue.process_keep_alive_lifecycle_queue());
        assert_eq!(rue.pending_activated_ranges.borrow().len(), 0);
        assert!(!rue.process_keep_alive_lifecycle_queue());

        rue.pending_activated_ranges.borrow_mut().push(activated_start);
        let borrow = rue.inner.borrow_mut();
        assert!(!rue.process_keep_alive_lifecycle_queue());
        assert_eq!(rue.pending_activated_ranges.borrow().len(), 1);
        drop(borrow);

        assert!(rue.process_keep_alive_lifecycle_queue());
    }

    #[wasm_bindgen_test]
    fn render_triggered_bridge_registers_current_instance_hooks() {
        let rue = createRue(adapter_value());
        let instance = Object::new();
        set_current_instance(instance.clone().into());

        let hook = Function::new_no_args("return undefined");
        rue.on_render_triggered(hook.into());
        rue.on_render_triggered(JsValue::from_str("not-a-hook"));

        let hooks = Reflect::get(&instance, &JsValue::from_str("__rue_render_triggered_hooks"))
            .unwrap_or(JsValue::UNDEFINED);
        assert!(Array::is_array(&hooks));
        assert_eq!(Array::from(&hooks).length(), 1);

        set_current_instance(JsValue::UNDEFINED);
        rue.on_render_triggered(Function::new_no_args("return undefined").into());
    }

    #[wasm_bindgen_test(async)]
    async fn server_prefetch_bridge_queues_and_resolves_when_runtime_is_borrowed() {
        PENDING_HOOKS.with(|queue| queue.borrow_mut().clear());
        let rue = createRue(adapter_value());

        let borrow = rue.inner.borrow_mut();
        rue.on_server_prefetch(JsValue::from_str("prefetch-pending"));
        let promise = rue.run_server_prefetch();
        drop(borrow);

        JsFuture::from(promise).await.unwrap();
        let pending = take_pending_hooks();
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].0, "server_prefetch");
        assert_eq!(pending[0].1.as_string().as_deref(), Some("prefetch-pending"));
    }
}
