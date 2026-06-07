#![cfg(feature = "compat")]

//! 同一组件在 props 更新时返回的 VaporWithSetup 子树应重建并反映新的局部值
//!
//! 复现模式：
//! - 组件函数保持不变，仅 props 变化；
//! - 组件内部先把 props 派生成一个局部变量；
//! - 再返回一个 `type: 'vapor'`、其 `setup` 闭包捕获这个局部变量。
//!
//! 若运行时在同组件更新时没有正确重跑/替换返回的 vapor 子树，
//! 第二次渲染仍会看到第一次的局部值。
use js_sys::{Array, Function, Object, Promise, Reflect};
use rue_runtime_vapor::{
    ComponentProps, JsDomAdapter, MOUNT_INPUT_REGISTRY, MountInput, MountInputType, createRue,
};
use std::cell::Cell;
use std::rc::Rc;
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use wasm_bindgen::closure::Closure;
use wasm_bindgen_futures::JsFuture;
use wasm_bindgen_test::*;

/// 通过微任务推进一次事件循环，让 renderBetween 内部副作用落地
async fn tick() {
    let p = Promise::resolve(&JsValue::UNDEFINED);
    let _ = JsFuture::from(p).await;
}

fn ensure_fake_document() {
    let global = js_sys::global();
    let document =
        Reflect::get(&global, &JsValue::from_str("document")).unwrap_or(JsValue::UNDEFINED);
    if document.is_undefined() || document.is_null() {
        let _ = Reflect::set(&global, &JsValue::from_str("document"), &Object::new().into());
    }
}

fn active_element() -> JsValue {
    let global = js_sys::global();
    let document = Reflect::get(&global, &JsValue::from_str("document")).unwrap();
    Reflect::get(&document, &JsValue::from_str("activeElement")).unwrap_or(JsValue::UNDEFINED)
}

fn manual_mount_input(r#type: MountInputType<JsDomAdapter>) -> MountInput<JsDomAdapter> {
    MountInput {
        r#type,
        props: ComponentProps::new(),
        children: Vec::new(),
        key: None,
        strict_component_returns: false,
        mount_cleanup_bucket: None,
        mount_effect_scope_id: None,
        el_hint: None,
    }
}

fn store_manual_mount_input(input: MountInput<JsDomAdapter>) -> usize {
    MOUNT_INPUT_REGISTRY.with(|registry| {
        let mut entries = registry.borrow_mut();
        entries.push(Some(input));
        entries.len() - 1
    })
}

fn mount_handle_object(id: usize) -> JsValue {
    let handle = Object::new();
    let _ =
        Reflect::set(&handle, &JsValue::from_str("__rue_mount_id"), &JsValue::from_f64(id as f64));
    handle.into()
}

/// 为父节点补全 previousSibling / nextSibling / parentNode，便于范围更新逻辑工作
fn update_siblings(parent: &JsValue) {
    let children =
        Reflect::get(parent, &JsValue::from_str("children")).unwrap_or(Array::new().into());
    let arr: Array = children.unchecked_into();
    for i in 0..arr.length() {
        let cur = arr.get(i);
        let prev = if i > 0 { arr.get(i - 1) } else { JsValue::NULL };
        let next = if i + 1 < arr.length() { arr.get(i + 1) } else { JsValue::NULL };
        let _ = Reflect::set(&cur, &JsValue::from_str("previousSibling"), &prev);
        let _ = Reflect::set(&cur, &JsValue::from_str("nextSibling"), &next);
        let _ = Reflect::set(&cur, &JsValue::from_str("parentNode"), parent);
    }
}

/// 构造一个支持 fragment 插入与 sibling 链接的轻量 JS DomAdapter
fn make_linked_adapter() -> JsValue {
    let obj = Object::new();
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("createElement"),
        &Function::new_with_args("tag", "return { tag, children: [] }").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("createTextNode"),
        &Function::new_with_args("text", "return { tag: '#text', text, children: [] }").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("createDocumentFragment"),
        &Function::new_no_args("return { tag: 'fragment', children: [] }").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("isFragment"),
        &Function::new_with_args("el", "return !!el && el.tag === 'fragment'").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("collectFragmentChildren"),
        &Function::new_with_args("el", "return Array.from(el && el.children || [])").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setTextContent"),
        &Function::new_with_args("el,text", "el.text = text").into(),
    );
    let append_impl = Function::new_with_args(
        "p,c",
        "p.children = p.children||[]; \
         if (c && c.tag === 'fragment') { \
           const list = Array.from(c.children||[]); \
           list.forEach(ch => p.children.push(ch)); \
         } else { \
           p.children.push(c); \
         } \
         return;",
    );
    let _ = Reflect::set(&obj, &JsValue::from_str("appendChild"), &append_impl.into());
    let insert_impl = Function::new_with_args(
        "p,c,b",
        "p.children = p.children||[]; \
         const idx = (p.children||[]).indexOf(b); \
         const at = idx >= 0 ? idx : p.children.length; \
         if (c && c.tag === 'fragment') { \
           const list = Array.from(c.children||[]); \
           p.children.splice(at, 0, ...list); \
         } else { \
           p.children.splice(at, 0, c); \
         } \
         return;",
    );
    let _ = Reflect::set(&obj, &JsValue::from_str("insertBefore"), &insert_impl.into());
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("removeChild"),
        &Function::new_with_args("p,c", "p.children = (p.children||[]).filter(x=>x!==c)").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("contains"),
        &Function::new_with_args("p,c", "return p===c || (p.children||[]).includes(c)").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setClassName"),
        &Function::new_with_args("el,v", "el.class = v").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("patchStyle"),
        &Function::new_with_args("el,old,newv", "return").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setInnerHTML"),
        &Function::new_with_args("el,html", "el.children=[]; el.text=html").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setValue"),
        &Function::new_with_args("el,v", "el.value = v").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setChecked"),
        &Function::new_with_args("el,b", "el.checked = !!b").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setDisabled"),
        &Function::new_with_args("el,b", "el.disabled = !!b").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("clearRef"),
        &Function::new_with_args("r", "return").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("applyRef"),
        &Function::new_with_args("el,r", "return").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("setAttribute"),
        &Function::new_with_args("el,k,v", "el.attrs = el.attrs||{}; el.attrs[k]=v").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("removeAttribute"),
        &Function::new_with_args("el,k", "if(el.attrs) delete el.attrs[k]").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("getTagName"),
        &Function::new_with_args("el", "return el.tag||''").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("addEventListener"),
        &Function::new_with_args("el,evt,h", "return").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("removeEventListener"),
        &Function::new_with_args("el,evt,h", "return").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("hasValueProperty"),
        &Function::new_with_args("el", "return 'value' in el").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("isSelectMultiple"),
        &Function::new_with_args("el", "return el.tag==='SELECT' && !!el.multiple").into(),
    );
    let _ = Reflect::set(
        &obj,
        &JsValue::from_str("querySelector"),
        &Function::new_with_args("sel", "return { tag: sel, children: [] }").into(),
    );
    obj.into()
}

#[wasm_bindgen_test(async)]
async fn render_between_same_component_props_update_rebuilds_vapor_local_capture() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let parent = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createDocumentFragment")).unwrap();
        let func = f.unchecked_ref::<Function>();
        func.call0(&adapter).unwrap()
    };
    let start = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createElement")).unwrap();
        let func = f.unchecked_ref::<Function>();
        func.call1(&adapter, &JsValue::from_str("comment_start")).unwrap()
    };
    let end = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createElement")).unwrap();
        let func = f.unchecked_ref::<Function>();
        func.call1(&adapter, &JsValue::from_str("comment_end")).unwrap()
    };
    {
        let append = Reflect::get(&adapter, &JsValue::from_str("appendChild")).unwrap();
        let func = append.unchecked_ref::<Function>();
        let _ = func.call2(&adapter, &parent, &start);
        let _ = func.call2(&adapter, &parent, &end);
        update_siblings(&parent);
    }

    let component = Function::new_with_args(
        "props",
        "const label = props.show ? 'OPEN' : ''; \
         return { \
           type: 'vapor', \
           props: { \
             setup() { \
                             return { \
                                 tag: 'fragment', \
                                 children: label ? [{ tag: '#text', text: label, children: [] }] : [] \
                             }; \
             } \
           }, \
           children: [] \
         };",
    );

    let props_closed = Object::new();
    let _ = Reflect::set(&props_closed, &JsValue::from_str("show"), &JsValue::from_bool(false));
    let vnode_closed =
        rue.create_element_wasm(component.clone().into(), props_closed.into(), JsValue::UNDEFINED);
    rue.render_between_wasm(vnode_closed, parent.clone(), start.clone(), end.clone());
    tick().await;
    update_siblings(&parent);

    let props_open = Object::new();
    let _ = Reflect::set(&props_open, &JsValue::from_str("show"), &JsValue::from_bool(true));
    let vnode_open =
        rue.create_element_wasm(component.into(), props_open.into(), JsValue::UNDEFINED);
    rue.render_between_wasm(vnode_open, parent.clone(), start.clone(), end.clone());
    tick().await;
    update_siblings(&parent);

    let arr = Reflect::get(&parent, &JsValue::from_str("children")).unwrap_or(Array::new().into());
    let arr: Array = arr.unchecked_into();
    let texts: Vec<JsValue> = arr
        .iter()
        .filter(|c| {
            Reflect::get(c, &JsValue::from_str("tag"))
                .unwrap_or(JsValue::UNDEFINED)
                .as_string()
                .unwrap_or_default()
                == "#text"
        })
        .collect();

    assert_eq!(texts.len(), 1, "same component props update should produce one OPEN text node");
    let text = Reflect::get(&texts[0], &JsValue::from_str("text"))
        .unwrap_or(JsValue::UNDEFINED)
        .as_string()
        .unwrap_or_default();
    assert_eq!(text, "OPEN");
}

#[wasm_bindgen_test(async)]
async fn render_anchor_same_component_props_update_rebuilds_vapor_local_capture() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let parent = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createDocumentFragment")).unwrap();
        let func = f.unchecked_ref::<Function>();
        func.call0(&adapter).unwrap()
    };
    let anchor = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createElement")).unwrap();
        let func = f.unchecked_ref::<Function>();
        func.call1(&adapter, &JsValue::from_str("comment_anchor")).unwrap()
    };
    {
        let append = Reflect::get(&adapter, &JsValue::from_str("appendChild")).unwrap();
        let func = append.unchecked_ref::<Function>();
        let _ = func.call2(&adapter, &parent, &anchor);
        update_siblings(&parent);
    }

    let component = Function::new_with_args(
        "props",
        "const label = props.show ? 'OPEN' : ''; \
         return { \
           type: 'vapor', \
           props: { \
             setup() { \
                             return { \
                                 tag: 'fragment', \
                                 children: label ? [{ tag: '#text', text: label, children: [] }] : [] \
                             }; \
             } \
           }, \
           children: [] \
         };",
    );

    let props_closed = Object::new();
    let _ = Reflect::set(&props_closed, &JsValue::from_str("show"), &JsValue::from_bool(false));
    let vnode_closed =
        rue.create_element_wasm(component.clone().into(), props_closed.into(), JsValue::UNDEFINED);
    rue.render_anchor_wasm(vnode_closed, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    let props_open = Object::new();
    let _ = Reflect::set(&props_open, &JsValue::from_str("show"), &JsValue::from_bool(true));
    let vnode_open =
        rue.create_element_wasm(component.into(), props_open.into(), JsValue::UNDEFINED);
    rue.render_anchor_wasm(vnode_open, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    let arr = Reflect::get(&parent, &JsValue::from_str("children")).unwrap_or(Array::new().into());
    let arr: Array = arr.unchecked_into();
    let texts: Vec<JsValue> = arr
        .iter()
        .filter(|c| {
            Reflect::get(c, &JsValue::from_str("tag"))
                .unwrap_or(JsValue::UNDEFINED)
                .as_string()
                .unwrap_or_default()
                == "#text"
        })
        .collect();

    assert_eq!(texts.len(), 1, "renderAnchor should update same component vapor local capture");
    let text = Reflect::get(&texts[0], &JsValue::from_str("text"))
        .unwrap_or(JsValue::UNDEFINED)
        .as_string()
        .unwrap_or_default();
    assert_eq!(text, "OPEN");
}

#[wasm_bindgen_test(async)]
async fn same_component_update_replaces_text_handle_subtree_with_element_handle() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let container = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createDocumentFragment")).unwrap();
        let func = f.unchecked_ref::<Function>();
        func.call0(&adapter).unwrap()
    };

    let component = Function::new_with_args("props", "return props.handle;");
    let text_id =
        store_manual_mount_input(manual_mount_input(MountInputType::Text("before".to_string())));
    let first_props = Object::new();
    let _ = Reflect::set(&first_props, &JsValue::from_str("handle"), &mount_handle_object(text_id));
    let first =
        rue.create_element_wasm(component.clone().into(), first_props.into(), JsValue::UNDEFINED);
    rue.render_wasm(first, container.clone());
    tick().await;
    update_siblings(&container);

    let first_children =
        Reflect::get(&container, &JsValue::from_str("children")).unwrap_or(Array::new().into());
    let first_children: Array = first_children.unchecked_into();
    assert_eq!(
        Reflect::get(&first_children.get(0), &JsValue::from_str("text"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .as_deref(),
        Some("before")
    );

    let element_children = Array::new();
    element_children.push(&JsValue::from_str("after"));
    let element_handle = rue.create_element_wasm(
        JsValue::from_str("strong"),
        Object::new().into(),
        element_children.into(),
    );
    let second_props = Object::new();
    let _ = Reflect::set(&second_props, &JsValue::from_str("handle"), &element_handle);
    let second = rue.create_element_wasm(component.into(), second_props.into(), JsValue::UNDEFINED);
    rue.render_wasm(second, container.clone());
    tick().await;
    update_siblings(&container);

    let children =
        Reflect::get(&container, &JsValue::from_str("children")).unwrap_or(Array::new().into());
    let children: Array = children.unchecked_into();
    assert_eq!(children.length(), 1);
    let strong = children.get(0);
    assert_eq!(
        Reflect::get(&strong, &JsValue::from_str("tag"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .as_deref(),
        Some("strong")
    );
    let strong_children =
        Reflect::get(&strong, &JsValue::from_str("children")).unwrap_or(Array::new().into());
    let strong_children: Array = strong_children.unchecked_into();
    assert_eq!(
        Reflect::get(&strong_children.get(0), &JsValue::from_str("text"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .as_deref(),
        Some("after")
    );
}

#[wasm_bindgen_test(async)]
async fn same_component_text_handle_replace_appends_when_old_text_is_missing() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let container = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createDocumentFragment")).unwrap();
        let func = f.unchecked_ref::<Function>();
        func.call0(&adapter).unwrap()
    };

    let component = Function::new_with_args("props", "return props.handle;");
    let text_id =
        store_manual_mount_input(manual_mount_input(MountInputType::Text("detached".to_string())));
    let first_props = Object::new();
    let _ = Reflect::set(&first_props, &JsValue::from_str("handle"), &mount_handle_object(text_id));
    let first =
        rue.create_element_wasm(component.clone().into(), first_props.into(), JsValue::UNDEFINED);
    rue.render_wasm(first, container.clone());
    tick().await;

    let stale = Object::new();
    let _ = Reflect::set(&stale, &JsValue::from_str("tag"), &JsValue::from_str("stale"));
    let _ = Reflect::set(&stale, &JsValue::from_str("children"), &Array::new().into());
    let stale_children = Array::new();
    stale_children.push(&stale);
    let _ = Reflect::set(&container, &JsValue::from_str("children"), &stale_children.into());

    let next_children = Array::new();
    next_children.push(&JsValue::from_str("fallback"));
    let next_handle = rue.create_element_wasm(
        JsValue::from_str("em"),
        Object::new().into(),
        next_children.into(),
    );
    let second_props = Object::new();
    let _ = Reflect::set(&second_props, &JsValue::from_str("handle"), &next_handle);
    let second = rue.create_element_wasm(component.into(), second_props.into(), JsValue::UNDEFINED);
    rue.render_wasm(second, container.clone());
    tick().await;

    let children =
        Reflect::get(&container, &JsValue::from_str("children")).unwrap_or(Array::new().into());
    let children: Array = children.unchecked_into();
    assert_eq!(children.length(), 1);
    assert_eq!(
        Reflect::get(&children.get(0), &JsValue::from_str("tag"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .as_deref(),
        Some("em")
    );
}

#[wasm_bindgen_test(async)]
async fn render_anchor_same_component_props_update_restores_active_input_focus() {
    ensure_fake_document();

    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let parent = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createDocumentFragment")).unwrap();
        let func = f.unchecked_ref::<Function>();
        func.call0(&adapter).unwrap()
    };
    let anchor = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createElement")).unwrap();
        let func = f.unchecked_ref::<Function>();
        func.call1(&adapter, &JsValue::from_str("comment_anchor")).unwrap()
    };
    {
        let append = Reflect::get(&adapter, &JsValue::from_str("appendChild")).unwrap();
        let func = append.unchecked_ref::<Function>();
        let _ = func.call2(&adapter, &parent, &anchor);
        update_siblings(&parent);
    }

    let component = Function::new_with_args(
        "props",
        "const input = { \
           nodeType: 1, \
           tag: 'INPUT', \
           type: 'text', \
           value: props.value || '', \
           selectionStart: (props.value || '').length, \
           selectionEnd: (props.value || '').length, \
           children: [], \
           focus: function() { globalThis.document.activeElement = this; } \
         }; \
         const hint = { nodeType: 1, tag: 'SPAN', children: [] }; \
         return { nodeType: 1, tag: 'LABEL', children: [hint, input] };",
    );

    let props_a = Object::new();
    let _ = Reflect::set(&props_a, &JsValue::from_str("value"), &JsValue::from_str("A"));
    let vnode_a =
        rue.create_element_wasm(component.clone().into(), props_a.into(), JsValue::UNDEFINED);
    rue.render_anchor_wasm(vnode_a, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    let parent_children = Reflect::get(&parent, &JsValue::from_str("children")).unwrap();
    let parent_children: Array = parent_children.unchecked_into();
    let old_root = parent_children.get(0);
    let old_root_children = Reflect::get(&old_root, &JsValue::from_str("children")).unwrap();
    let old_root_children: Array = old_root_children.unchecked_into();
    let old_input = old_root_children.get(1);
    let focus = Reflect::get(&old_input, &JsValue::from_str("focus")).unwrap();
    let focus = focus.unchecked_ref::<Function>();
    let _ = focus.call0(&old_input);
    let _ = Reflect::set(&old_input, &JsValue::from_str("selectionStart"), &JsValue::from_f64(1.0));
    let _ = Reflect::set(&old_input, &JsValue::from_str("selectionEnd"), &JsValue::from_f64(1.0));
    let _ = Reflect::set(
        &old_input,
        &JsValue::from_str("selectionDirection"),
        &JsValue::from_str("forward"),
    );

    let props_ab = Object::new();
    let _ = Reflect::set(&props_ab, &JsValue::from_str("value"), &JsValue::from_str("AB"));
    let vnode_ab = rue.create_element_wasm(component.into(), props_ab.into(), JsValue::UNDEFINED);
    rue.render_anchor_wasm(vnode_ab, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    let parent_children = Reflect::get(&parent, &JsValue::from_str("children")).unwrap();
    let parent_children: Array = parent_children.unchecked_into();
    let new_root = parent_children.get(0);
    let new_root_children = Reflect::get(&new_root, &JsValue::from_str("children")).unwrap();
    let new_root_children: Array = new_root_children.unchecked_into();
    let new_input = new_root_children.get(1);

    assert!(
        !Object::is(&old_input, &new_input),
        "same component props update should still replace the raw vapor input node in this path"
    );
    assert!(
        Object::is(&active_element(), &new_input),
        "focus should be restored onto the replacement input"
    );
    assert_eq!(
        Reflect::get(&new_input, &JsValue::from_str("selectionStart"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_f64(),
        Some(1.0)
    );
    assert_eq!(
        Reflect::get(&new_input, &JsValue::from_str("selectionEnd"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_f64(),
        Some(1.0)
    );
    assert_eq!(
        Reflect::get(&new_input, &JsValue::from_str("selectionDirection"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .as_deref(),
        Some("forward")
    );
}

#[wasm_bindgen_test(async)]
async fn render_anchor_same_component_focus_restore_skips_mismatched_targets() {
    ensure_fake_document();

    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let parent = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createDocumentFragment")).unwrap();
        let func = f.unchecked_ref::<Function>();
        func.call0(&adapter).unwrap()
    };
    let anchor = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createElement")).unwrap();
        let func = f.unchecked_ref::<Function>();
        func.call1(&adapter, &JsValue::from_str("comment_anchor")).unwrap()
    };
    {
        let append = Reflect::get(&adapter, &JsValue::from_str("appendChild")).unwrap();
        let func = append.unchecked_ref::<Function>();
        let _ = func.call2(&adapter, &parent, &anchor);
        update_siblings(&parent);
    }

    let component = Function::new_with_args(
        "props",
        "const field = { \
           nodeType: 1, \
           tag: props.tag || 'INPUT', \
           type: props.kind || 'text', \
           children: [], \
           focus: function() { globalThis.document.activeElement = this; } \
         }; \
         return { nodeType: 1, tag: 'LABEL', children: [field] };",
    );

    let props_input = Object::new();
    let _ = Reflect::set(&props_input, &JsValue::from_str("tag"), &JsValue::from_str("INPUT"));
    let _ = Reflect::set(&props_input, &JsValue::from_str("kind"), &JsValue::from_str("text"));
    let vnode_input =
        rue.create_element_wasm(component.clone().into(), props_input.into(), JsValue::UNDEFINED);
    rue.render_anchor_wasm(vnode_input, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    let parent_children = Reflect::get(&parent, &JsValue::from_str("children")).unwrap();
    let parent_children: Array = parent_children.unchecked_into();
    let input_root = parent_children.get(0);
    let input_children = Reflect::get(&input_root, &JsValue::from_str("children")).unwrap();
    let input_children: Array = input_children.unchecked_into();
    let old_input = input_children.get(0);
    let focus = Reflect::get(&old_input, &JsValue::from_str("focus")).unwrap();
    let focus = focus.unchecked_ref::<Function>();
    let _ = focus.call0(&old_input);

    let props_select = Object::new();
    let _ = Reflect::set(&props_select, &JsValue::from_str("tag"), &JsValue::from_str("SELECT"));
    let _ = Reflect::set(&props_select, &JsValue::from_str("kind"), &JsValue::from_str("text"));
    let vnode_select =
        rue.create_element_wasm(component.clone().into(), props_select.into(), JsValue::UNDEFINED);
    rue.render_anchor_wasm(vnode_select, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    assert!(
        Object::is(&active_element(), &old_input),
        "tag mismatch should skip focus restoration"
    );

    let parent_children = Reflect::get(&parent, &JsValue::from_str("children")).unwrap();
    let parent_children: Array = parent_children.unchecked_into();
    let select_root = parent_children.get(0);
    let select_children = Reflect::get(&select_root, &JsValue::from_str("children")).unwrap();
    let select_children: Array = select_children.unchecked_into();
    let old_select = select_children.get(0);
    let focus = Reflect::get(&old_select, &JsValue::from_str("focus")).unwrap();
    let focus = focus.unchecked_ref::<Function>();
    let _ = focus.call0(&old_select);

    let props_password = Object::new();
    let _ = Reflect::set(&props_password, &JsValue::from_str("tag"), &JsValue::from_str("SELECT"));
    let _ =
        Reflect::set(&props_password, &JsValue::from_str("kind"), &JsValue::from_str("password"));
    let vnode_password =
        rue.create_element_wasm(component.into(), props_password.into(), JsValue::UNDEFINED);
    rue.render_anchor_wasm(vnode_password, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    assert!(
        Object::is(&active_element(), &old_select),
        "type mismatch should skip focus restoration"
    );
}

#[wasm_bindgen_test(async)]
async fn render_anchor_component_element_component_toggle_keeps_single_root() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let parent = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createDocumentFragment")).unwrap();
        let func = f.unchecked_ref::<Function>();
        func.call0(&adapter).unwrap()
    };
    let anchor = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createElement")).unwrap();
        let func = f.unchecked_ref::<Function>();
        func.call1(&adapter, &JsValue::from_str("comment_anchor")).unwrap()
    };
    {
        let append = Reflect::get(&adapter, &JsValue::from_str("appendChild")).unwrap();
        let func = append.unchecked_ref::<Function>();
        let _ = func.call2(&adapter, &parent, &anchor);
        update_siblings(&parent);
    }

    let code_component = Function::new_no_args(
        "return { type: 'div', props: { className: 'code-root' }, children: ['CODE'] };",
    );
    let code_vnode1 = rue.create_element_wasm(
        code_component.clone().into(),
        JsValue::UNDEFINED,
        JsValue::UNDEFINED,
    );
    rue.render_anchor_wasm(code_vnode1, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    let preview_children = Array::new();
    preview_children.push(&JsValue::from_str("PREVIEW"));
    let preview_vnode = rue.create_element_wasm(
        JsValue::from_str("div"),
        JsValue::UNDEFINED,
        preview_children.into(),
    );
    rue.render_anchor_wasm(preview_vnode, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    let after_preview =
        Reflect::get(&parent, &JsValue::from_str("children")).unwrap_or(Array::new().into());
    let after_preview: Array = after_preview.unchecked_into();
    let preview_divs: Vec<JsValue> = after_preview
        .iter()
        .filter(|c| {
            Reflect::get(c, &JsValue::from_str("tag"))
                .unwrap_or(JsValue::UNDEFINED)
                .as_string()
                .unwrap_or_default()
                == "div"
        })
        .collect();
    assert_eq!(preview_divs.len(), 1, "component -> element should not leave stale component root");
    let preview_children = Reflect::get(&preview_divs[0], &JsValue::from_str("children"))
        .unwrap_or(Array::new().into());
    let preview_children: Array = preview_children.unchecked_into();
    let preview_text = Reflect::get(&preview_children.get(0), &JsValue::from_str("text"))
        .unwrap_or(JsValue::UNDEFINED)
        .as_string()
        .unwrap_or_default();
    assert_eq!(preview_text, "PREVIEW");

    let code_vnode2 =
        rue.create_element_wasm(code_component.into(), JsValue::UNDEFINED, JsValue::UNDEFINED);
    rue.render_anchor_wasm(code_vnode2, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    let final_children =
        Reflect::get(&parent, &JsValue::from_str("children")).unwrap_or(Array::new().into());
    let final_children: Array = final_children.unchecked_into();
    let code_divs: Vec<JsValue> = final_children
        .iter()
        .filter(|c| {
            Reflect::get(c, &JsValue::from_str("tag"))
                .unwrap_or(JsValue::UNDEFINED)
                .as_string()
                .unwrap_or_default()
                == "div"
        })
        .collect();
    assert_eq!(
        code_divs.len(),
        1,
        "element -> component should not append a second component root"
    );
    let code_children =
        Reflect::get(&code_divs[0], &JsValue::from_str("children")).unwrap_or(Array::new().into());
    let code_children: Array = code_children.unchecked_into();
    let code_text = Reflect::get(&code_children.get(0), &JsValue::from_str("text"))
        .unwrap_or(JsValue::UNDEFINED)
        .as_string()
        .unwrap_or_default();
    assert_eq!(code_text, "CODE");
}

#[wasm_bindgen_test(async)]
async fn same_component_keyed_children_reorder_insert_and_cleanup_paths() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let parent = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createDocumentFragment")).unwrap();
        let func = f.unchecked_ref::<Function>();
        func.call0(&adapter).unwrap()
    };
    let anchor = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createElement")).unwrap();
        let func = f.unchecked_ref::<Function>();
        func.call1(&adapter, &JsValue::from_str("comment_anchor")).unwrap()
    };
    {
        let append = Reflect::get(&adapter, &JsValue::from_str("appendChild")).unwrap();
        let func = append.unchecked_ref::<Function>();
        let _ = func.call2(&adapter, &parent, &anchor);
        update_siblings(&parent);
    }

    let component = Function::new_with_args(
        "props",
        "if (props.mode === 'first') { \
           return { type: 'div', props: {}, children: [ \
             { type: 'span', props: { key: 'a' }, children: ['A'] }, \
             { type: 'fragment', props: { key: 'f' }, children: [ \
               { type: 'i', props: { key: 'inner' }, children: ['I'] }, \
               'F1' \
             ] }, \
             'old-tail' \
           ] }; \
         } \
         return { type: 'div', props: {}, children: [ \
           'intro', \
           { type: 'fragment', props: { key: 'f' }, children: ['F2'] }, \
           { type: 'span', props: { key: 'a' }, children: ['A2'] }, \
           { type: 'em', props: { key: 'b' }, children: ['B'] } \
         ] };",
    );

    let first_props = Object::new();
    let _ = Reflect::set(&first_props, &JsValue::from_str("mode"), &JsValue::from_str("first"));
    let first =
        rue.create_element_wasm(component.clone().into(), first_props.into(), JsValue::UNDEFINED);
    rue.render_anchor_wasm(first, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    let second_props = Object::new();
    let _ = Reflect::set(&second_props, &JsValue::from_str("mode"), &JsValue::from_str("second"));
    let second = rue.create_element_wasm(component.into(), second_props.into(), JsValue::UNDEFINED);
    rue.render_anchor_wasm(second, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    let root_children =
        Reflect::get(&parent, &JsValue::from_str("children")).unwrap_or(Array::new().into());
    let root_children: Array = root_children.unchecked_into();
    let div = root_children.get(0);
    let nested = Reflect::get(&div, &JsValue::from_str("children")).unwrap_or(Array::new().into());
    let nested: Array = nested.unchecked_into();

    let labels: Vec<String> = nested
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
        .collect();

    assert!(labels.iter().any(|item| item == "intro"));
    assert!(labels.iter().any(|item| item == "span"));
    assert!(labels.iter().any(|item| item == "em"));
    assert!(!labels.iter().any(|item| item == "old-tail"));
}

#[wasm_bindgen_test(async)]
async fn same_component_update_holds_subtree_while_active_input_is_composing() {
    ensure_fake_document();

    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let parent = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createDocumentFragment")).unwrap();
        let func = f.unchecked_ref::<Function>();
        func.call0(&adapter).unwrap()
    };
    let anchor = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createElement")).unwrap();
        let func = f.unchecked_ref::<Function>();
        func.call1(&adapter, &JsValue::from_str("comment_anchor")).unwrap()
    };
    {
        let append = Reflect::get(&adapter, &JsValue::from_str("appendChild")).unwrap();
        let func = append.unchecked_ref::<Function>();
        let _ = func.call2(&adapter, &parent, &anchor);
        update_siblings(&parent);
    }

    let component = Function::new_with_args(
        "props",
        "const input = { \
           nodeType: 1, \
           tag: 'INPUT', \
           type: 'text', \
           value: props.value || '', \
           children: [] \
         }; \
         const root = { \
           nodeType: 1, \
           tag: 'LABEL', \
           children: [input], \
           contains(node) { return node === this || (this.children || []).includes(node); } \
         }; \
         input.parentNode = root; \
         return { __rue_host_node: root };",
    );

    let props_a = Object::new();
    let _ = Reflect::set(&props_a, &JsValue::from_str("value"), &JsValue::from_str("A"));
    let vnode_a =
        rue.create_element_wasm(component.clone().into(), props_a.into(), JsValue::UNDEFINED);
    rue.render_anchor_wasm(vnode_a, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    let children = Reflect::get(&parent, &JsValue::from_str("children")).unwrap();
    let children: Array = children.unchecked_into();
    let old_root = children.get(0);
    let old_children = Reflect::get(&old_root, &JsValue::from_str("children")).unwrap();
    let old_children: Array = old_children.unchecked_into();
    let old_input = old_children.get(0);
    let _ = Reflect::set(&old_input, &JsValue::from_str("__rue_is_composing__"), &JsValue::TRUE);
    let document = Reflect::get(&js_sys::global(), &JsValue::from_str("document")).unwrap();
    let _ = Reflect::set(&document, &JsValue::from_str("activeElement"), &old_input);

    let props_b = Object::new();
    let _ = Reflect::set(&props_b, &JsValue::from_str("value"), &JsValue::from_str("B"));
    let vnode_b = rue.create_element_wasm(component.into(), props_b.into(), JsValue::UNDEFINED);
    rue.render_anchor_wasm(vnode_b, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    let children = Reflect::get(&parent, &JsValue::from_str("children")).unwrap();
    let children: Array = children.unchecked_into();
    let new_root = children.get(0);
    assert!(Object::is(&old_root, &new_root));
    assert_eq!(
        Reflect::get(&old_input, &JsValue::from_str("value"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .as_deref(),
        Some("A")
    );
}

#[wasm_bindgen_test(async)]
async fn same_component_update_patches_when_composing_active_node_is_outside_subtree() {
    ensure_fake_document();

    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let parent = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createDocumentFragment")).unwrap();
        let func = f.unchecked_ref::<Function>();
        func.call0(&adapter).unwrap()
    };
    let anchor = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createElement")).unwrap();
        let func = f.unchecked_ref::<Function>();
        func.call1(&adapter, &JsValue::from_str("comment_anchor")).unwrap()
    };
    {
        let append = Reflect::get(&adapter, &JsValue::from_str("appendChild")).unwrap();
        let func = append.unchecked_ref::<Function>();
        let _ = func.call2(&adapter, &parent, &anchor);
        update_siblings(&parent);
    }

    let component = Function::new_with_args(
        "props",
        "const input = { \
           nodeType: 1, \
           tag: 'INPUT', \
           type: 'text', \
           value: props.value || '', \
           children: [] \
         }; \
         const root = { \
           nodeType: 1, \
           tag: 'LABEL', \
           value: props.value || '', \
           children: [input], \
           contains(node) { return node === this || (this.children || []).includes(node); } \
         }; \
         input.parentNode = root; \
         return { __rue_host_node: root };",
    );

    let props_a = Object::new();
    let _ = Reflect::set(&props_a, &JsValue::from_str("value"), &JsValue::from_str("A"));
    let vnode_a =
        rue.create_element_wasm(component.clone().into(), props_a.into(), JsValue::UNDEFINED);
    rue.render_anchor_wasm(vnode_a, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    let outside = Object::new();
    let _ = Reflect::set(&outside, &JsValue::from_str("__rue_is_composing__"), &JsValue::TRUE);
    let document = Reflect::get(&js_sys::global(), &JsValue::from_str("document")).unwrap();
    let _ = Reflect::set(&document, &JsValue::from_str("activeElement"), &outside);

    let props_b = Object::new();
    let _ = Reflect::set(&props_b, &JsValue::from_str("value"), &JsValue::from_str("B"));
    let vnode_b = rue.create_element_wasm(component.into(), props_b.into(), JsValue::UNDEFINED);
    rue.render_anchor_wasm(vnode_b, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    let children = Reflect::get(&parent, &JsValue::from_str("children")).unwrap();
    let children: Array = children.unchecked_into();
    let patched_root = children.get(0);
    assert_eq!(
        Reflect::get(&patched_root, &JsValue::from_str("value"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .as_deref(),
        Some("B")
    );
}

#[wasm_bindgen_test(async)]
async fn same_component_update_reports_unsupported_object_return_without_replacing_old_subtree() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let parent = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createDocumentFragment")).unwrap();
        let func = f.unchecked_ref::<Function>();
        func.call0(&adapter).unwrap()
    };
    let anchor = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createElement")).unwrap();
        let func = f.unchecked_ref::<Function>();
        func.call1(&adapter, &JsValue::from_str("comment_anchor")).unwrap()
    };
    {
        let append = Reflect::get(&adapter, &JsValue::from_str("appendChild")).unwrap();
        let func = append.unchecked_ref::<Function>();
        let _ = func.call2(&adapter, &parent, &anchor);
        update_siblings(&parent);
    }

    let errors = Array::new();
    let errors_for_handler = errors.clone();
    let on_error = wasm_bindgen::closure::Closure::wrap(Box::new(move |err: JsValue| {
        errors_for_handler.push(&err);
    }) as Box<dyn FnMut(JsValue)>);
    rue.on_error(on_error.as_ref().clone().into());
    on_error.forget();

    let component = Function::new_with_args(
        "props",
        "if (props.mode === 'bad') return { unsupported: true }; \
         const host = { nodeType: 1, tag: 'SPAN', children: [] }; \
         return { __rue_host_node: host };",
    );

    let props_ok = Object::new();
    let _ = Reflect::set(&props_ok, &JsValue::from_str("mode"), &JsValue::from_str("ok"));
    let vnode_ok =
        rue.create_element_wasm(component.clone().into(), props_ok.into(), JsValue::UNDEFINED);
    rue.render_anchor_wasm(vnode_ok, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    let props_bad = Object::new();
    let _ = Reflect::set(&props_bad, &JsValue::from_str("mode"), &JsValue::from_str("bad"));
    let vnode_bad = rue.create_element_wasm(component.into(), props_bad.into(), JsValue::UNDEFINED);
    rue.render_anchor_wasm(vnode_bad, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    assert_eq!(errors.length(), 1);
    let children = Reflect::get(&parent, &JsValue::from_str("children")).unwrap();
    let children: Array = children.unchecked_into();
    let kept = children.get(0);
    assert_eq!(
        Reflect::get(&kept, &JsValue::from_str("tag"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .as_deref(),
        Some("SPAN")
    );
}

#[wasm_bindgen_test(async)]
#[should_panic]
async fn same_component_update_rethrows_render_error_after_restoring_context() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let parent = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createDocumentFragment")).unwrap();
        let func = f.unchecked_ref::<Function>();
        func.call0(&adapter).unwrap()
    };
    let anchor = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createElement")).unwrap();
        let func = f.unchecked_ref::<Function>();
        func.call1(&adapter, &JsValue::from_str("comment_anchor")).unwrap()
    };
    {
        let append = Reflect::get(&adapter, &JsValue::from_str("appendChild")).unwrap();
        let func = append.unchecked_ref::<Function>();
        let _ = func.call2(&adapter, &parent, &anchor);
        update_siblings(&parent);
    }

    let errors = Array::new();
    let errors_for_handler = errors.clone();
    let on_error = wasm_bindgen::closure::Closure::wrap(Box::new(move |err: JsValue| {
        errors_for_handler.push(&err);
    }) as Box<dyn FnMut(JsValue)>);
    rue.on_error(on_error.as_ref().clone().into());
    on_error.forget();

    let component = Function::new_with_args(
        "props",
        "if (props.mode === 'throw') throw new Error('plan999 same update boom'); \
         const host = { nodeType: 1, tag: 'SPAN', children: [] }; \
         return { __rue_host_node: host };",
    );

    let props_ok = Object::new();
    let _ = Reflect::set(&props_ok, &JsValue::from_str("mode"), &JsValue::from_str("ok"));
    let vnode_ok =
        rue.create_element_wasm(component.clone().into(), props_ok.into(), JsValue::UNDEFINED);
    rue.render_anchor_wasm(vnode_ok, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    let props_throw = Object::new();
    let _ = Reflect::set(&props_throw, &JsValue::from_str("mode"), &JsValue::from_str("throw"));
    let vnode_throw =
        rue.create_element_wasm(component.into(), props_throw.into(), JsValue::UNDEFINED);
    rue.render_anchor_wasm(vnode_throw, parent.clone(), anchor.clone());
    tick().await;
}

#[wasm_bindgen_test(async)]
async fn same_component_update_accepts_primitive_return_as_vapor_host() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let parent = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createDocumentFragment")).unwrap();
        let func = f.unchecked_ref::<Function>();
        func.call0(&adapter).unwrap()
    };
    let anchor = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createElement")).unwrap();
        let func = f.unchecked_ref::<Function>();
        func.call1(&adapter, &JsValue::from_str("comment_anchor")).unwrap()
    };
    {
        let append = Reflect::get(&adapter, &JsValue::from_str("appendChild")).unwrap();
        let func = append.unchecked_ref::<Function>();
        let _ = func.call2(&adapter, &parent, &anchor);
        update_siblings(&parent);
    }

    let component = Function::new_with_args(
        "props",
        "if (props.mode === 'raw') return 'raw-host'; \
         const host = { nodeType: 1, tag: 'SPAN', children: [] }; \
         return { __rue_host_node: host };",
    );

    let props_object = Object::new();
    let _ = Reflect::set(&props_object, &JsValue::from_str("mode"), &JsValue::from_str("object"));
    let vnode_object =
        rue.create_element_wasm(component.clone().into(), props_object.into(), JsValue::UNDEFINED);
    rue.render_anchor_wasm(vnode_object, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    let props_raw = Object::new();
    let _ = Reflect::set(&props_raw, &JsValue::from_str("mode"), &JsValue::from_str("raw"));
    let vnode_raw = rue.create_element_wasm(component.into(), props_raw.into(), JsValue::UNDEFINED);
    rue.render_anchor_wasm(vnode_raw, parent.clone(), anchor);
    tick().await;

    let children = Reflect::get(&parent, &JsValue::from_str("children")).unwrap();
    let children: Array = children.unchecked_into();
    assert_eq!(children.get(0).as_string().as_deref(), Some("raw-host"));
}

#[wasm_bindgen_test(async)]
async fn nested_same_component_update_keeps_parent_instance_current_after_child_patch() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let parent = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createDocumentFragment")).unwrap();
        let func = f.unchecked_ref::<Function>();
        func.call0(&adapter).unwrap()
    };
    let anchor = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createElement")).unwrap();
        let func = f.unchecked_ref::<Function>();
        func.call1(&adapter, &JsValue::from_str("comment_anchor")).unwrap()
    };
    {
        let append = Reflect::get(&adapter, &JsValue::from_str("appendChild")).unwrap();
        let func = append.unchecked_ref::<Function>();
        let _ = func.call2(&adapter, &parent, &anchor);
        update_siblings(&parent);
    }

    let child_component = Function::new_with_args(
        "props",
        "return { \
           type: 'section', \
           props: { className: 'child-shell' }, \
           children: [props.value || ''] \
         };",
    );
    let parent_component = Function::new_with_args(
        "props",
        "return { \
           type: props.Child, \
           props: { value: props.value }, \
           children: [] \
         };",
    );
    let child_value: JsValue = child_component.into();

    let props_a = Object::new();
    let _ = Reflect::set(&props_a, &JsValue::from_str("Child"), &child_value);
    let _ = Reflect::set(&props_a, &JsValue::from_str("value"), &JsValue::from_str("A"));
    let vnode_a = rue.create_element_wasm(
        parent_component.clone().into(),
        props_a.into(),
        JsValue::UNDEFINED,
    );
    rue.render_anchor_wasm(vnode_a, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    let props_b = Object::new();
    let _ = Reflect::set(&props_b, &JsValue::from_str("Child"), &child_value);
    let _ = Reflect::set(&props_b, &JsValue::from_str("value"), &JsValue::from_str("B"));
    let vnode_b =
        rue.create_element_wasm(parent_component.into(), props_b.into(), JsValue::UNDEFINED);
    rue.render_anchor_wasm(vnode_b, parent.clone(), anchor);
    tick().await;
    update_siblings(&parent);

    let children = Reflect::get(&parent, &JsValue::from_str("children")).unwrap();
    let children: Array = children.unchecked_into();
    let section = children.get(0);
    assert_eq!(
        Reflect::get(&section, &JsValue::from_str("tag"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .as_deref(),
        Some("section")
    );
    let section_children =
        Reflect::get(&section, &JsValue::from_str("children")).unwrap_or(Array::new().into());
    let section_children: Array = section_children.unchecked_into();
    assert_eq!(
        Reflect::get(&section_children.get(0), &JsValue::from_str("text"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .as_deref(),
        Some("B")
    );
}

#[wasm_bindgen_test(async)]
async fn same_component_vapor_replace_records_sidebar_debug_metadata() {
    let global = js_sys::global();
    let _ = Reflect::set(
        &global,
        &JsValue::from_str("__rue_debug_component_patch_enabled__"),
        &JsValue::TRUE,
    );
    let _ = Reflect::set(
        &global,
        &JsValue::from_str("__rue_debug_component_patch__"),
        &Array::new().into(),
    );

    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let parent = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createDocumentFragment")).unwrap();
        let func = f.unchecked_ref::<Function>();
        func.call0(&adapter).unwrap()
    };
    let anchor = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createElement")).unwrap();
        let func = f.unchecked_ref::<Function>();
        func.call1(&adapter, &JsValue::from_str("comment_anchor")).unwrap()
    };
    {
        let append = Reflect::get(&adapter, &JsValue::from_str("appendChild")).unwrap();
        let func = append.unchecked_ref::<Function>();
        let _ = func.call2(&adapter, &parent, &anchor);
        update_siblings(&parent);
    }

    let component = Function::new_with_args(
        "props",
        "const host = { \
           nodeType: 1, \
           tag: 'DIV', \
           className: props.mode === 'old' ? 'sidebar-playground old' : 'replacement-panel', \
           children: [] \
         }; \
         return { __rue_host_node: host };",
    );

    let props_old = Object::new();
    let _ = Reflect::set(&props_old, &JsValue::from_str("mode"), &JsValue::from_str("old"));
    let vnode_old =
        rue.create_element_wasm(component.clone().into(), props_old.into(), JsValue::UNDEFINED);
    rue.render_anchor_wasm(vnode_old, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    let props_new = Object::new();
    let _ = Reflect::set(&props_new, &JsValue::from_str("mode"), &JsValue::from_str("new"));
    let vnode_new = rue.create_element_wasm(component.into(), props_new.into(), JsValue::UNDEFINED);
    rue.render_anchor_wasm(vnode_new, parent, anchor);
    tick().await;

    let records =
        Reflect::get(&global, &JsValue::from_str("__rue_debug_component_patch__")).unwrap();
    assert!(Array::is_array(&records));
    let records: Array = records.unchecked_into();
    assert!(records.length() >= 1);
    let latest = records.get(records.length() - 1);
    assert_eq!(
        Reflect::get(&latest, &JsValue::from_str("kind"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .as_deref(),
        Some("replace_vapor_like")
    );
    assert_eq!(
        Reflect::get(&latest, &JsValue::from_str("oldClass"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .as_deref(),
        Some("sidebar-playground old")
    );

    let _ = Reflect::delete_property(
        &global,
        &JsValue::from_str("__rue_debug_component_patch_enabled__"),
    );
    let _ = Reflect::delete_property(&global, &JsValue::from_str("__rue_debug_component_patch__"));
}

#[wasm_bindgen_test(async)]
async fn component_to_fragment_replace_restores_focus_to_matching_fragment_child() {
    ensure_fake_document();

    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let parent = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createDocumentFragment")).unwrap();
        let func = f.unchecked_ref::<Function>();
        func.call0(&adapter).unwrap()
    };
    let anchor = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createElement")).unwrap();
        let func = f.unchecked_ref::<Function>();
        func.call1(&adapter, &JsValue::from_str("comment_anchor")).unwrap()
    };
    {
        let append = Reflect::get(&adapter, &JsValue::from_str("appendChild")).unwrap();
        let func = append.unchecked_ref::<Function>();
        let _ = func.call2(&adapter, &parent, &anchor);
        update_siblings(&parent);
    }

    let component = Function::new_no_args(
        "const document = globalThis.document; \
         const input = { \
           nodeType: 1, \
           tag: 'INPUT', \
           tagName: 'INPUT', \
           type: 'text', \
           selectionStart: 2, \
           selectionEnd: 4, \
           selectionDirection: 'forward', \
           ownerDocument: document, \
           children: [] \
         }; \
         const label = { \
           nodeType: 1, \
           tag: 'LABEL', \
           tagName: 'LABEL', \
           children: [input], \
           contains(node) { return node === this || (this.children || []).includes(node); } \
         }; \
         input.parentNode = label; \
         return { __rue_host_node: label };",
    );

    let vnode_component =
        rue.create_element_wasm(component.into(), JsValue::UNDEFINED, JsValue::UNDEFINED);
    rue.render_anchor_wasm(vnode_component, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    let children = Reflect::get(&parent, &JsValue::from_str("children")).unwrap();
    let children: Array = children.unchecked_into();
    let label = children.get(0);
    let label_children = Reflect::get(&label, &JsValue::from_str("children")).unwrap();
    let label_children: Array = label_children.unchecked_into();
    let old_input = label_children.get(0);
    let document = Reflect::get(&js_sys::global(), &JsValue::from_str("document")).unwrap();
    let _ = Reflect::set(&document, &JsValue::from_str("activeElement"), &old_input);

    let new_input = Object::new();
    let _ = Reflect::set(&new_input, &JsValue::from_str("nodeType"), &JsValue::from_f64(1.0));
    let _ = Reflect::set(&new_input, &JsValue::from_str("tag"), &JsValue::from_str("INPUT"));
    let _ = Reflect::set(&new_input, &JsValue::from_str("tagName"), &JsValue::from_str("INPUT"));
    let _ = Reflect::set(&new_input, &JsValue::from_str("type"), &JsValue::from_str("text"));
    let _ = Reflect::set(&new_input, &JsValue::from_str("ownerDocument"), &document);
    let _ = Reflect::set(&new_input, &JsValue::from_str("children"), &Array::new().into());
    let _ = Reflect::set(
        &new_input,
        &JsValue::from_str("focus"),
        &Function::new_no_args("this.ownerDocument.activeElement = this").into(),
    );

    let fragment_vnode = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::of1(&new_input.clone().into()).into(),
    );
    rue.render_anchor_wasm(fragment_vnode, parent.clone(), anchor);
    tick().await;
    update_siblings(&parent);

    assert!(Object::is(
        &Reflect::get(&document, &JsValue::from_str("activeElement")).unwrap(),
        &new_input.clone().into()
    ));
    assert_eq!(
        Reflect::get(&new_input, &JsValue::from_str("selectionStart"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_f64(),
        Some(2.0)
    );
    assert_eq!(
        Reflect::get(&new_input, &JsValue::from_str("selectionEnd"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_f64(),
        Some(4.0)
    );
    assert_eq!(
        Reflect::get(&new_input, &JsValue::from_str("selectionDirection"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .as_deref(),
        Some("forward")
    );
}

#[wasm_bindgen_test(async)]
async fn same_component_vapor_replace_skips_sidebar_debug_when_disabled_and_active_is_null() {
    ensure_fake_document();

    let global = js_sys::global();
    let document = Reflect::get(&global, &JsValue::from_str("document")).unwrap();
    let _ = Reflect::set(&document, &JsValue::from_str("activeElement"), &JsValue::NULL);
    let _ = Reflect::set(
        &global,
        &JsValue::from_str("__rue_debug_component_patch_enabled__"),
        &JsValue::FALSE,
    );
    let _ = Reflect::delete_property(&global, &JsValue::from_str("__rue_debug_component_patch__"));

    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let parent = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createDocumentFragment")).unwrap();
        let func = f.unchecked_ref::<Function>();
        func.call0(&adapter).unwrap()
    };
    let anchor = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createElement")).unwrap();
        let func = f.unchecked_ref::<Function>();
        func.call1(&adapter, &JsValue::from_str("comment_anchor")).unwrap()
    };
    {
        let append = Reflect::get(&adapter, &JsValue::from_str("appendChild")).unwrap();
        let func = append.unchecked_ref::<Function>();
        let _ = func.call2(&adapter, &parent, &anchor);
        update_siblings(&parent);
    }

    let component = Function::new_with_args(
        "props",
        "const host = { \
           nodeType: 1, \
           tag: 'DIV', \
           className: props.mode === 'old' ? 'sidebar-playground disabled' : 'replacement-panel', \
           children: [] \
         }; \
         return { __rue_host_node: host };",
    );

    let props_old = Object::new();
    let _ = Reflect::set(&props_old, &JsValue::from_str("mode"), &JsValue::from_str("old"));
    let vnode_old =
        rue.create_element_wasm(component.clone().into(), props_old.into(), JsValue::UNDEFINED);
    rue.render_anchor_wasm(vnode_old, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    let props_new = Object::new();
    let _ = Reflect::set(&props_new, &JsValue::from_str("mode"), &JsValue::from_str("new"));
    let vnode_new = rue.create_element_wasm(component.into(), props_new.into(), JsValue::UNDEFINED);
    rue.render_anchor_wasm(vnode_new, parent, anchor);
    tick().await;

    assert!(
        Reflect::get(&global, &JsValue::from_str("__rue_debug_component_patch__"))
            .unwrap_or(JsValue::UNDEFINED)
            .is_undefined()
    );

    let _ = Reflect::delete_property(
        &global,
        &JsValue::from_str("__rue_debug_component_patch_enabled__"),
    );
}

#[wasm_bindgen_test(async)]
async fn same_component_update_reuses_identical_vapor_host_bridge() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let parent = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createDocumentFragment")).unwrap();
        f.unchecked_ref::<Function>().call0(&adapter).unwrap()
    };
    let anchor = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createElement")).unwrap();
        f.unchecked_ref::<Function>().call1(&adapter, &JsValue::from_str("comment_anchor")).unwrap()
    };
    {
        let append = Reflect::get(&adapter, &JsValue::from_str("appendChild")).unwrap();
        let func = append.unchecked_ref::<Function>();
        let _ = func.call2(&adapter, &parent, &anchor);
        update_siblings(&parent);
    }

    let host = Object::new();
    Reflect::set(&host, &JsValue::from_str("nodeType"), &JsValue::from_f64(1.0)).unwrap();
    Reflect::set(&host, &JsValue::from_str("tag"), &JsValue::from_str("DIV")).unwrap();
    Reflect::set(&host, &JsValue::from_str("children"), &Array::new().into()).unwrap();
    Reflect::set(&js_sys::global(), &JsValue::from_str("__same_component_shared_host"), &host)
        .unwrap();

    let component = Function::new_no_args(
        "return { __rue_host_node: globalThis.__same_component_shared_host };",
    );

    let first =
        rue.create_element_wasm(component.clone().into(), JsValue::UNDEFINED, JsValue::UNDEFINED);
    rue.render_anchor_wasm(first, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    let second = rue.create_element_wasm(component.into(), JsValue::UNDEFINED, JsValue::UNDEFINED);
    rue.render_anchor_wasm(second, parent.clone(), anchor);
    tick().await;
    update_siblings(&parent);

    let children = Reflect::get(&parent, &JsValue::from_str("children")).unwrap();
    let children: Array = children.unchecked_into();
    assert_eq!(children.length(), 2);
    assert!(Object::is(&children.get(0), &host.into()));
    Reflect::delete_property(&js_sys::global(), &JsValue::from_str("__same_component_shared_host"))
        .unwrap();
}

#[wasm_bindgen_test(async)]
async fn same_component_empty_snapshot_mounts_valid_subtree_after_unsupported_return() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let parent = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createDocumentFragment")).unwrap();
        f.unchecked_ref::<Function>().call0(&adapter).unwrap()
    };
    let anchor = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createElement")).unwrap();
        f.unchecked_ref::<Function>().call1(&adapter, &JsValue::from_str("comment_anchor")).unwrap()
    };
    {
        let append = Reflect::get(&adapter, &JsValue::from_str("appendChild")).unwrap();
        let func = append.unchecked_ref::<Function>();
        let _ = func.call2(&adapter, &parent, &anchor);
        update_siblings(&parent);
    }

    let errors = Array::new();
    let errors_for_handler = errors.clone();
    let on_error = Closure::wrap(Box::new(move |err: JsValue| {
        errors_for_handler.push(&err);
    }) as Box<dyn FnMut(JsValue)>);
    rue.on_error(on_error.as_ref().clone().into());
    on_error.forget();

    let component = Function::new_with_args(
        "props",
        "if (props.mode === 'bad') return { unsupported: true }; \
         const host = { nodeType: 1, tag: 'ARTICLE', className: 'recovered', children: [] }; \
         return { __rue_host_node: host };",
    );

    let bad_props = Object::new();
    Reflect::set(&bad_props, &JsValue::from_str("mode"), &JsValue::from_str("bad")).unwrap();
    let bad =
        rue.create_element_wasm(component.clone().into(), bad_props.into(), JsValue::UNDEFINED);
    rue.render_anchor_wasm(bad, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);
    assert!(errors.length() >= 1);

    let ok_props = Object::new();
    Reflect::set(&ok_props, &JsValue::from_str("mode"), &JsValue::from_str("ok")).unwrap();
    let ok = rue.create_element_wasm(component.into(), ok_props.into(), JsValue::UNDEFINED);
    rue.render_anchor_wasm(ok, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    let children = Reflect::get(&parent, &JsValue::from_str("children")).unwrap();
    let children: Array = children.unchecked_into();
    assert_eq!(
        Reflect::get(&children.get(0), &JsValue::from_str("tag"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .as_deref(),
        Some("ARTICLE")
    );
    assert!(Object::is(&children.get(1), &anchor));
}

#[wasm_bindgen_test(async)]
async fn same_component_container_empty_snapshot_appends_valid_subtree_after_bad_return() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let container = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createDocumentFragment")).unwrap();
        f.unchecked_ref::<Function>().call0(&adapter).unwrap()
    };

    let errors = Array::new();
    let errors_for_handler = errors.clone();
    let on_error = Closure::wrap(Box::new(move |err: JsValue| {
        errors_for_handler.push(&err);
    }) as Box<dyn FnMut(JsValue)>);
    rue.on_error(on_error.as_ref().clone().into());
    on_error.forget();

    let component = Function::new_with_args(
        "props",
        "if (props.mode === 'bad') return { unsupported: true }; \
         const host = { nodeType: 1, tag: 'ASIDE', children: [] }; \
         return { __rue_host_node: host };",
    );

    let bad_props = Object::new();
    Reflect::set(&bad_props, &JsValue::from_str("mode"), &JsValue::from_str("bad")).unwrap();
    let bad =
        rue.create_element_wasm(component.clone().into(), bad_props.into(), JsValue::UNDEFINED);
    rue.render_wasm(bad, container.clone());
    tick().await;
    assert!(errors.length() >= 1);

    let ok_props = Object::new();
    Reflect::set(&ok_props, &JsValue::from_str("mode"), &JsValue::from_str("ok")).unwrap();
    let ok = rue.create_element_wasm(component.into(), ok_props.into(), JsValue::UNDEFINED);
    rue.render_wasm(ok, container.clone());
    tick().await;

    let children = Reflect::get(&container, &JsValue::from_str("children")).unwrap();
    let children: Array = children.unchecked_into();
    assert_eq!(children.length(), 1);
    assert_eq!(
        Reflect::get(&children.get(0), &JsValue::from_str("tag"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .as_deref(),
        Some("ASIDE")
    );
}

#[wasm_bindgen_test(async)]
async fn same_component_empty_snapshot_stays_empty_after_repeated_unsupported_return() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let parent = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createDocumentFragment")).unwrap();
        f.unchecked_ref::<Function>().call0(&adapter).unwrap()
    };
    let anchor = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createElement")).unwrap();
        f.unchecked_ref::<Function>().call1(&adapter, &JsValue::from_str("comment_anchor")).unwrap()
    };
    {
        let append = Reflect::get(&adapter, &JsValue::from_str("appendChild")).unwrap();
        let func = append.unchecked_ref::<Function>();
        let _ = func.call2(&adapter, &parent, &anchor);
        update_siblings(&parent);
    }

    let errors = Array::new();
    let errors_for_handler = errors.clone();
    let on_error = Closure::wrap(Box::new(move |err: JsValue| {
        errors_for_handler.push(&err);
    }) as Box<dyn FnMut(JsValue)>);
    rue.on_error(on_error.as_ref().clone().into());
    on_error.forget();

    let component = Function::new_no_args("return { unsupported: true };");

    let first =
        rue.create_element_wasm(component.clone().into(), JsValue::UNDEFINED, JsValue::UNDEFINED);
    rue.render_anchor_wasm(first, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    let second = rue.create_element_wasm(component.into(), JsValue::UNDEFINED, JsValue::UNDEFINED);
    rue.render_anchor_wasm(second, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    assert!(errors.length() >= 2);
    let children = Reflect::get(&parent, &JsValue::from_str("children")).unwrap();
    let children: Array = children.unchecked_into();
    assert_eq!(children.length(), 1);
    assert!(Object::is(&children.get(0), &anchor));
}

#[wasm_bindgen_test(async)]
async fn same_component_focus_probe_handles_missing_document_and_missing_child_collections() {
    let global = js_sys::global();
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let parent = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createDocumentFragment")).unwrap();
        f.unchecked_ref::<Function>().call0(&adapter).unwrap()
    };
    let anchor = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createElement")).unwrap();
        f.unchecked_ref::<Function>().call1(&adapter, &JsValue::from_str("comment_anchor")).unwrap()
    };
    {
        let append = Reflect::get(&adapter, &JsValue::from_str("appendChild")).unwrap();
        let func = append.unchecked_ref::<Function>();
        let _ = func.call2(&adapter, &parent, &anchor);
        update_siblings(&parent);
    }

    let component = Function::new_with_args(
        "props",
        "const host = { nodeType: 1, tag: props.tag || 'LABEL' }; \
         if (props.childrenKind === 'null-child-nodes') { \
           host.children = null; \
           host.childNodes = []; \
         } \
         return { __rue_host_node: host };",
    );

    let first_props = Object::new();
    Reflect::set(&first_props, &JsValue::from_str("tag"), &JsValue::from_str("LABEL")).unwrap();
    let first =
        rue.create_element_wasm(component.clone().into(), first_props.into(), JsValue::UNDEFINED);
    rue.render_anchor_wasm(first, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    Reflect::delete_property(&global, &JsValue::from_str("document")).unwrap();
    let no_doc_props = Object::new();
    Reflect::set(&no_doc_props, &JsValue::from_str("tag"), &JsValue::from_str("SECTION")).unwrap();
    let no_doc =
        rue.create_element_wasm(component.clone().into(), no_doc_props.into(), JsValue::UNDEFINED);
    rue.render_anchor_wasm(no_doc, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    ensure_fake_document();
    let document = Reflect::get(&global, &JsValue::from_str("document")).unwrap();
    let outside = Object::new();
    Reflect::set(&document, &JsValue::from_str("activeElement"), &outside).unwrap();
    let null_children_props = Object::new();
    Reflect::set(
        &null_children_props,
        &JsValue::from_str("childrenKind"),
        &JsValue::from_str("null-child-nodes"),
    )
    .unwrap();
    Reflect::set(&null_children_props, &JsValue::from_str("tag"), &JsValue::from_str("NAV"))
        .unwrap();
    let null_children = rue.create_element_wasm(
        component.clone().into(),
        null_children_props.into(),
        JsValue::UNDEFINED,
    );
    rue.render_anchor_wasm(null_children, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    let missing_collections_props = Object::new();
    Reflect::set(&missing_collections_props, &JsValue::from_str("tag"), &JsValue::from_str("MAIN"))
        .unwrap();
    let missing_collections = rue.create_element_wasm(
        component.into(),
        missing_collections_props.into(),
        JsValue::UNDEFINED,
    );
    rue.render_anchor_wasm(missing_collections, parent.clone(), anchor);
    tick().await;
    update_siblings(&parent);

    let children = Reflect::get(&parent, &JsValue::from_str("children")).unwrap();
    let children: Array = children.unchecked_into();
    assert_eq!(
        Reflect::get(&children.get(0), &JsValue::from_str("tag"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_string()
            .as_deref(),
        Some("MAIN")
    );
}

#[wasm_bindgen_test(async)]
async fn same_component_focus_restore_skips_tag_and_type_mismatches_for_host_bridges() {
    ensure_fake_document();

    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let parent = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createDocumentFragment")).unwrap();
        f.unchecked_ref::<Function>().call0(&adapter).unwrap()
    };
    let anchor = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createElement")).unwrap();
        f.unchecked_ref::<Function>().call1(&adapter, &JsValue::from_str("comment_anchor")).unwrap()
    };
    {
        let append = Reflect::get(&adapter, &JsValue::from_str("appendChild")).unwrap();
        let func = append.unchecked_ref::<Function>();
        let _ = func.call2(&adapter, &parent, &anchor);
        update_siblings(&parent);
    }

    let component = Function::new_with_args(
        "props",
        "const field = { \
           nodeType: 1, \
           tag: props.tag || 'INPUT', \
           tagName: props.tag || 'INPUT', \
           type: props.kind || 'text', \
           ownerDocument: globalThis.document, \
           children: [], \
           focus: function() { this.ownerDocument.activeElement = this; } \
         }; \
         const root = { \
           nodeType: 1, \
           tag: 'LABEL', \
           tagName: 'LABEL', \
           children: [field], \
           contains(node) { return node === this || (this.children || []).includes(node); } \
         }; \
         field.parentNode = root; \
         return { __rue_host_node: root };",
    );

    let text_props = Object::new();
    Reflect::set(&text_props, &JsValue::from_str("tag"), &JsValue::from_str("INPUT")).unwrap();
    Reflect::set(&text_props, &JsValue::from_str("kind"), &JsValue::from_str("text")).unwrap();
    let text_vnode =
        rue.create_element_wasm(component.clone().into(), text_props.into(), JsValue::UNDEFINED);
    rue.render_anchor_wasm(text_vnode, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    let children = Reflect::get(&parent, &JsValue::from_str("children")).unwrap();
    let children: Array = children.unchecked_into();
    let root = children.get(0);
    let root_children = Reflect::get(&root, &JsValue::from_str("children")).unwrap();
    let root_children: Array = root_children.unchecked_into();
    let old_input = root_children.get(0);
    let document = Reflect::get(&js_sys::global(), &JsValue::from_str("document")).unwrap();
    Reflect::set(&document, &JsValue::from_str("activeElement"), &old_input).unwrap();

    let password_props = Object::new();
    Reflect::set(&password_props, &JsValue::from_str("tag"), &JsValue::from_str("INPUT")).unwrap();
    Reflect::set(&password_props, &JsValue::from_str("kind"), &JsValue::from_str("password"))
        .unwrap();
    let password_vnode = rue.create_element_wasm(
        component.clone().into(),
        password_props.into(),
        JsValue::UNDEFINED,
    );
    rue.render_anchor_wasm(password_vnode, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    assert!(Object::is(
        &Reflect::get(&document, &JsValue::from_str("activeElement")).unwrap(),
        &old_input
    ));

    let children = Reflect::get(&parent, &JsValue::from_str("children")).unwrap();
    let children: Array = children.unchecked_into();
    let root = children.get(0);
    let root_children = Reflect::get(&root, &JsValue::from_str("children")).unwrap();
    let root_children: Array = root_children.unchecked_into();
    let password_input = root_children.get(0);
    Reflect::set(&document, &JsValue::from_str("activeElement"), &password_input).unwrap();

    let select_props = Object::new();
    Reflect::set(&select_props, &JsValue::from_str("tag"), &JsValue::from_str("SELECT")).unwrap();
    Reflect::set(&select_props, &JsValue::from_str("kind"), &JsValue::from_str("password"))
        .unwrap();
    let select_vnode =
        rue.create_element_wasm(component.into(), select_props.into(), JsValue::UNDEFINED);
    rue.render_anchor_wasm(select_vnode, parent.clone(), anchor);
    tick().await;

    assert!(Object::is(
        &Reflect::get(&document, &JsValue::from_str("activeElement")).unwrap(),
        &password_input
    ));
}

#[wasm_bindgen_test(async)]
async fn same_component_pending_updated_hook_registered_during_patch_is_merged_and_called() {
    let adapter = make_linked_adapter();
    let rue = Rc::new(createRue(adapter.clone()));
    let parent = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createDocumentFragment")).unwrap();
        f.unchecked_ref::<Function>().call0(&adapter).unwrap()
    };
    let anchor = {
        let f = Reflect::get(&adapter, &JsValue::from_str("createElement")).unwrap();
        f.unchecked_ref::<Function>().call1(&adapter, &JsValue::from_str("comment_anchor")).unwrap()
    };
    {
        let append = Reflect::get(&adapter, &JsValue::from_str("appendChild")).unwrap();
        let func = append.unchecked_ref::<Function>();
        let _ = func.call2(&adapter, &parent, &anchor);
        update_siblings(&parent);
    }

    let calls = Array::new();
    Reflect::set(&js_sys::global(), &JsValue::from_str("__same_component_pending_calls"), &calls)
        .unwrap();

    let render_count = Rc::new(Cell::new(0));
    let rue_for_component = rue.clone();
    let render_count_for_component = render_count.clone();
    let component = Closure::wrap(Box::new(move |_props: JsValue| -> JsValue {
        render_count_for_component.set(render_count_for_component.get() + 1);
        if render_count_for_component.get() > 1 {
            rue_for_component.on_updated(
                Function::new_no_args(
                    "globalThis.__same_component_pending_calls.push('pending-updated')",
                )
                .into(),
            );
        }

        let host = Object::new();
        Reflect::set(&host, &JsValue::from_str("nodeType"), &JsValue::from_f64(1.0)).unwrap();
        Reflect::set(&host, &JsValue::from_str("tag"), &JsValue::from_str("SECTION")).unwrap();
        Reflect::set(&host, &JsValue::from_str("children"), &Array::new().into()).unwrap();
        let bridge = Object::new();
        Reflect::set(&bridge, &JsValue::from_str("__rue_host_node"), &host.into()).unwrap();
        bridge.into()
    }) as Box<dyn FnMut(JsValue) -> JsValue>);
    let component_fn: Function = component.as_ref().clone().unchecked_into();

    let first = rue.create_element_wasm(
        component_fn.clone().into(),
        JsValue::UNDEFINED,
        JsValue::UNDEFINED,
    );
    rue.render_anchor_wasm(first, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    let second =
        rue.create_element_wasm(component_fn.into(), JsValue::UNDEFINED, JsValue::UNDEFINED);
    rue.render_anchor_wasm(second, parent, anchor);
    tick().await;

    let calls: Array =
        Reflect::get(&js_sys::global(), &JsValue::from_str("__same_component_pending_calls"))
            .unwrap()
            .unchecked_into();
    assert_eq!(calls.length(), 1);
    assert_eq!(calls.get(0).as_string().as_deref(), Some("pending-updated"));

    component.forget();
    Reflect::delete_property(
        &js_sys::global(),
        &JsValue::from_str("__same_component_pending_calls"),
    )
    .unwrap();
}
