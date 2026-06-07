#![cfg(feature = "compat")]

//! compat replace 边界测试：
//! - Fragment -> Element 必须清理旧片段子节点，只保留新元素根
//! - Element -> Fragment 必须移除旧元素根，并把新片段子节点留在目标挂载边界内
//! - 覆盖 renderBetween / renderAnchor / render 三种根挂载入口
use js_sys::{Array, Function, Object, Reflect};
use rue_runtime_vapor::{
    ComponentProps, JsDomAdapter, MOUNT_INPUT_REGISTRY, MountInput, MountInputType, createRue,
};
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use wasm_bindgen_test::*;
mod common;

use common::{
    child_sequence, children_of, first_child_text, make_linked_adapter, make_wasm_adapter,
    setup_anchor, setup_container, setup_range, tick, update_siblings,
};

fn key_props(key: &str) -> JsValue {
    let props = Object::new();
    Reflect::set(&props, &JsValue::from_str("key"), &JsValue::from_str(key)).unwrap();
    props.into()
}

fn type_props(kind: &str) -> JsValue {
    let props = Object::new();
    Reflect::set(&props, &JsValue::from_str("type"), &JsValue::from_str(kind)).unwrap();
    props.into()
}

fn mirror_attributes_to_node(adapter: &JsValue) {
    let adapter_obj = Object::from(adapter.clone());
    let setter =
        Function::new_with_args("el,k,v", "el.attrs = el.attrs || {}; el.attrs[k] = v; el[k] = v");
    Reflect::set(&adapter_obj, &JsValue::from_str("setAttribute"), &setter.into()).unwrap();
}

fn raw_node(tag: &str) -> JsValue {
    let node = Object::new();
    Reflect::set(&node, &JsValue::from_str("tag"), &JsValue::from_str(tag)).unwrap();
    Reflect::set(&node, &JsValue::from_str("children"), &Array::new().into()).unwrap();
    node.into()
}

fn make_parented_adapter() -> JsValue {
    let adapter = make_linked_adapter();
    let adapter_obj = Object::from(adapter.clone());
    let move_helpers = "\
        function detach(node) { \
          const old = node && node.parentNode; \
          if (old && old.children) old.children = old.children.filter(x => x !== node); \
        } \
        function link(parent) { \
          const list = Array.from(parent && parent.children || []); \
          for (let i = 0; i < list.length; i++) { \
            list[i].parentNode = parent; \
            list[i].previousSibling = i > 0 ? list[i - 1] : null; \
            list[i].nextSibling = i + 1 < list.length ? list[i + 1] : null; \
          } \
        } \
        function insertOne(parent, node, before) { \
          parent.children = parent.children || []; \
          detach(node); \
          const existing = parent.children.indexOf(node); \
          if (existing >= 0) parent.children.splice(existing, 1); \
          const idx = before ? parent.children.indexOf(before) : -1; \
          const at = idx >= 0 ? idx : parent.children.length; \
          parent.children.splice(at, 0, node); \
          link(parent); \
        }";
    Reflect::set(
        &adapter_obj,
        &JsValue::from_str("appendChild"),
        &Function::new_with_args(
            "p,c",
            &format!(
                "{} const items = c && c.tag === 'fragment' ? Array.from(c.children || []) : [c]; \
                 for (const item of items) insertOne(p, item, null);",
                move_helpers
            ),
        )
        .into(),
    )
    .unwrap();
    Reflect::set(
        &adapter_obj,
        &JsValue::from_str("insertBefore"),
        &Function::new_with_args(
            "p,c,b",
            &format!(
                "{} const items = c && c.tag === 'fragment' ? Array.from(c.children || []) : [c]; \
                 for (const item of items) insertOne(p, item, b);",
                move_helpers
            ),
        )
        .into(),
    )
    .unwrap();
    Reflect::set(
        &adapter_obj,
        &JsValue::from_str("removeChild"),
        &Function::new_with_args(
            "p,c",
            "p.children = (p.children || []).filter(x => x !== c); \
             if (c) { c.parentNode = null; c.previousSibling = null; c.nextSibling = null; } \
             const list = Array.from(p.children || []); \
             for (let i = 0; i < list.length; i++) { \
               list[i].parentNode = p; \
               list[i].previousSibling = i > 0 ? list[i - 1] : null; \
               list[i].nextSibling = i + 1 < list.length ? list[i + 1] : null; \
             }",
        )
        .into(),
    )
    .unwrap();
    Reflect::set(
        &adapter_obj,
        &JsValue::from_str("contains"),
        &Function::new_with_args(
            "p,c",
            "function has(root,node){ return root === node || Array.from(root && root.children || []).some(ch => has(ch,node)); } return has(p,c)",
        )
        .into(),
    )
    .unwrap();
    adapter
}

fn record_created_fragments(adapter: &JsValue, key: &str) {
    let global = js_sys::global();
    Reflect::set(&global, &JsValue::from_str(key), &Array::new().into()).unwrap();
    let body = format!(
        "const f = {{ tag: 'fragment', children: [] }}; globalThis.{key}.push(f); return f;",
    );
    Reflect::set(
        adapter,
        &JsValue::from_str("createDocumentFragment"),
        &Function::new_no_args(&body).into(),
    )
    .unwrap();
}

fn set_global_value(key: &str, value: &JsValue) {
    Reflect::set(&js_sys::global(), &JsValue::from_str(key), value).unwrap();
}

fn delete_global_value(key: &str) {
    Reflect::delete_property(&js_sys::global(), &JsValue::from_str(key)).unwrap();
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

fn store_manual_mount_input(input: MountInput<JsDomAdapter>) -> JsValue {
    MOUNT_INPUT_REGISTRY.with(|registry| {
        let mut entries = registry.borrow_mut();
        entries.push(Some(input));
        JsValue::from_f64((entries.len() - 1) as f64)
    })
}

#[wasm_bindgen_test(async)]
async fn render_between_fragment_replace_with_element_keeps_single_new_root() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let (parent, start, end) = setup_range(&adapter);

    let fragment_vnode = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("A")).into(),
    );
    rue.render_between_wasm(fragment_vnode, parent.clone(), start.clone(), end.clone());
    tick().await;
    update_siblings(&parent);

    let element_children = Array::of1(&JsValue::from_str("B"));
    let element_vnode = rue.create_element_wasm(
        JsValue::from_str("div"),
        JsValue::UNDEFINED,
        element_children.into(),
    );
    rue.render_between_wasm(element_vnode, parent.clone(), start.clone(), end.clone());
    tick().await;
    update_siblings(&parent);

    let sequence = child_sequence(&parent);
    assert_eq!(sequence, vec!["comment_start", "div", "comment_end"]);

    let children = Reflect::get(&parent, &JsValue::from_str("children")).unwrap();
    let arr: Array = children.unchecked_into();
    let div = arr.get(1);
    assert_eq!(first_child_text(&div), "B");
}

#[wasm_bindgen_test(async)]
async fn render_between_element_replace_with_fragment_clears_old_root() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let (parent, start, end) = setup_range(&adapter);

    let element_children = Array::of1(&JsValue::from_str("A"));
    let element_vnode = rue.create_element_wasm(
        JsValue::from_str("div"),
        JsValue::UNDEFINED,
        element_children.into(),
    );
    rue.render_between_wasm(element_vnode, parent.clone(), start.clone(), end.clone());
    tick().await;
    update_siblings(&parent);

    let fragment_vnode = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("B")).into(),
    );
    rue.render_between_wasm(fragment_vnode, parent.clone(), start.clone(), end.clone());
    tick().await;
    update_siblings(&parent);

    let sequence = child_sequence(&parent);
    assert_eq!(sequence, vec!["comment_start", "B", "comment_end"]);
}

#[wasm_bindgen_test(async)]
async fn render_between_fragment_rebuilds_to_component_before_end_anchor() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let (parent, start, end) = setup_range(&adapter);

    let fragment_vnode = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::of2(&JsValue::from_str("A"), &JsValue::from_str("B")).into(),
    );
    rue.render_between_wasm(fragment_vnode, parent.clone(), start.clone(), end.clone());
    tick().await;
    update_siblings(&parent);
    assert_eq!(child_sequence(&parent), vec!["comment_start", "A", "B", "comment_end"]);

    let component = Function::new_no_args(
        "return { type: 'article', props: {}, children: ['component-range'] }",
    );
    let component_vnode =
        rue.create_element_wasm(component.into(), JsValue::UNDEFINED, JsValue::UNDEFINED);
    rue.render_between_wasm(component_vnode, parent.clone(), start.clone(), end.clone());
    tick().await;
    update_siblings(&parent);

    let sequence = child_sequence(&parent);
    assert_eq!(sequence, vec!["comment_start", "article", "comment_end"]);
    let article = children_of(&parent).get(1);
    assert_eq!(first_child_text(&article), "component-range");
}

#[wasm_bindgen_test(async)]
async fn render_anchor_fragment_replace_with_element_keeps_single_new_root() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let (parent, anchor) = setup_anchor(&adapter);

    let fragment_vnode = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("A")).into(),
    );
    rue.render_anchor_wasm(fragment_vnode, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    let element_children = Array::of1(&JsValue::from_str("B"));
    let element_vnode = rue.create_element_wasm(
        JsValue::from_str("div"),
        JsValue::UNDEFINED,
        element_children.into(),
    );
    rue.render_anchor_wasm(element_vnode, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    let sequence = child_sequence(&parent);
    assert_eq!(sequence, vec!["div", "comment_anchor"]);

    let children = Reflect::get(&parent, &JsValue::from_str("children")).unwrap();
    let arr: Array = children.unchecked_into();
    let div = arr.get(0);
    assert_eq!(first_child_text(&div), "B");
}

#[wasm_bindgen_test(async)]
async fn render_anchor_element_replace_with_fragment_clears_old_root() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let (parent, anchor) = setup_anchor(&adapter);

    let element_children = Array::of1(&JsValue::from_str("A"));
    let element_vnode = rue.create_element_wasm(
        JsValue::from_str("div"),
        JsValue::UNDEFINED,
        element_children.into(),
    );
    rue.render_anchor_wasm(element_vnode, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    let fragment_vnode = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("B")).into(),
    );
    rue.render_anchor_wasm(fragment_vnode, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    let sequence = child_sequence(&parent);
    assert_eq!(sequence, vec!["B", "comment_anchor"]);
}

#[wasm_bindgen_test(async)]
async fn render_anchor_detached_element_replace_with_element_mounts_new_root() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let (parent, anchor) = setup_anchor(&adapter);

    let first_vnode = rue.create_element_wasm(
        JsValue::from_str("section"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("A")).into(),
    );
    rue.render_anchor_wasm(first_vnode, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);
    assert_eq!(child_sequence(&parent), vec!["section", "comment_anchor"]);

    let anchor_only = Array::of1(&anchor);
    let _ = Reflect::set(&parent, &JsValue::from_str("children"), &anchor_only.into());
    update_siblings(&parent);

    let second_vnode = rue.create_element_wasm(
        JsValue::from_str("article"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("B")).into(),
    );
    rue.render_anchor_wasm(second_vnode, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    let sequence = child_sequence(&parent);
    assert_eq!(sequence, vec!["article"]);

    let children = Reflect::get(&parent, &JsValue::from_str("children")).unwrap();
    let arr: Array = children.unchecked_into();
    let article = arr.get(0);
    assert_eq!(first_child_text(&article), "B");
}

#[wasm_bindgen_test(async)]
async fn render_between_vapor_fragment_replacement_clears_nested_anchor_and_range_mounts() {
    let adapter = make_parented_adapter();
    let rue = createRue(adapter.clone());
    let (parent, start, end) = setup_range(&adapter);

    let nested_anchor = raw_node("comment_nested_anchor");
    let nested_start = raw_node("comment_nested_start");
    let nested_end = raw_node("comment_nested_end");
    let outer_fragment = raw_node("fragment");
    Reflect::set(
        &outer_fragment,
        &JsValue::from_str("children"),
        &Array::of3(&nested_anchor, &nested_start, &nested_end).into(),
    )
    .unwrap();
    set_global_value("__rue_outer_fragment__", &outer_fragment);

    let old_vapor =
        rue.vapor_wasm(Function::new_no_args("return globalThis.__rue_outer_fragment__").into());
    rue.render_between_wasm(old_vapor, parent.clone(), start.clone(), end.clone());
    tick().await;
    update_siblings(&parent);
    assert_eq!(
        child_sequence(&parent),
        vec![
            "comment_start",
            "comment_nested_anchor",
            "comment_nested_start",
            "comment_nested_end",
            "comment_end"
        ]
    );

    let anchor_child = rue.create_element_wasm(
        JsValue::from_str("span"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("anchored")).into(),
    );
    rue.render_anchor_wasm(anchor_child, parent.clone(), nested_anchor.clone());
    tick().await;
    update_siblings(&parent);

    let range_child = rue.create_element_wasm(
        JsValue::from_str("em"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("ranged")).into(),
    );
    rue.render_between_wasm(range_child, parent.clone(), nested_start.clone(), nested_end.clone());
    tick().await;
    update_siblings(&parent);
    assert_eq!(
        child_sequence(&parent),
        vec![
            "comment_start",
            "span",
            "comment_nested_anchor",
            "comment_nested_start",
            "em",
            "comment_nested_end",
            "comment_end"
        ]
    );

    let replacement = rue.create_element_wasm(
        JsValue::from_str("article"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("fresh")).into(),
    );
    rue.render_between_wasm(replacement, parent.clone(), start.clone(), end.clone());
    tick().await;
    update_siblings(&parent);

    assert_eq!(child_sequence(&parent), vec!["comment_start", "article", "comment_end"]);
    assert_eq!(first_child_text(&children_of(&parent).get(1)), "fresh");
    delete_global_value("__rue_outer_fragment__");
}

#[wasm_bindgen_test(async)]
async fn render_between_component_replace_uses_end_anchor_when_old_host_is_detached() {
    let adapter = make_parented_adapter();
    let rue = createRue(adapter.clone());
    let (parent, start, end) = setup_range(&adapter);

    let comp_a =
        Function::new_no_args("return { type: 'section', props: {}, children: ['old-component'] }");
    let comp_b =
        Function::new_no_args("return { type: 'article', props: {}, children: ['new-component'] }");

    let id_a = rue.create_element_wasm(comp_a.into(), JsValue::UNDEFINED, JsValue::UNDEFINED);
    rue.render_between_wasm(id_a, parent.clone(), start.clone(), end.clone());
    tick().await;
    update_siblings(&parent);
    assert_eq!(child_sequence(&parent), vec!["comment_start", "section", "comment_end"]);

    let children = children_of(&parent);
    let old_section = children.get(1);
    let without_old = Array::of2(&start, &end);
    Reflect::set(&parent, &JsValue::from_str("children"), &without_old.into()).unwrap();
    Reflect::set(&old_section, &JsValue::from_str("parentNode"), &JsValue::NULL).unwrap();
    update_siblings(&parent);

    let id_b = rue.create_element_wasm(comp_b.into(), JsValue::UNDEFINED, JsValue::UNDEFINED);
    rue.render_between_wasm(id_b, parent.clone(), start.clone(), end.clone());
    tick().await;
    update_siblings(&parent);

    assert_eq!(child_sequence(&parent), vec!["comment_start", "article", "comment_end"]);
    assert_eq!(first_child_text(&children_of(&parent).get(1)), "new-component");
}

#[wasm_bindgen_test(async)]
async fn render_between_component_to_fragment_clears_named_range_and_nested_range_mount() {
    let adapter = make_parented_adapter();
    let rue = createRue(adapter.clone());
    let (parent, start, end) = setup_range(&adapter);
    Reflect::set(
        &start,
        &JsValue::from_str("nodeValue"),
        &JsValue::from_str("rue:component:start"),
    )
    .unwrap();

    let comp_a = Function::new_no_args("return { type: 'section', props: {}, children: ['old'] }");
    let comp_b = Function::new_no_args(
        "return { type: 'fragment', props: {}, children: ['left', { type: 'strong', props: {}, children: ['right'] }] }",
    );

    let id_a = rue.create_element_wasm(comp_a.into(), JsValue::UNDEFINED, JsValue::UNDEFINED);
    rue.render_between_wasm(id_a, parent.clone(), start.clone(), end.clone());
    tick().await;
    update_siblings(&parent);

    let nested_start = raw_node("comment_inner_start");
    let nested_end = raw_node("comment_inner_end");
    let section = children_of(&parent).get(1);
    Reflect::set(
        &parent,
        &JsValue::from_str("children"),
        &Array::of4(&start, &nested_start, &nested_end, &section).into(),
    )
    .unwrap();
    let with_end = children_of(&parent);
    with_end.push(&end);
    Reflect::set(&parent, &JsValue::from_str("children"), &with_end.into()).unwrap();
    update_siblings(&parent);

    let nested_child = rue.create_element_wasm(
        JsValue::from_str("em"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("inner")).into(),
    );
    rue.render_between_wasm(nested_child, parent.clone(), nested_start.clone(), nested_end.clone());
    tick().await;
    update_siblings(&parent);
    assert_eq!(
        child_sequence(&parent),
        vec![
            "comment_start",
            "comment_inner_start",
            "em",
            "comment_inner_end",
            "section",
            "comment_end"
        ]
    );

    let id_b = rue.create_element_wasm(comp_b.into(), JsValue::UNDEFINED, JsValue::UNDEFINED);
    rue.render_between_wasm(id_b, parent.clone(), start.clone(), end.clone());
    tick().await;
    update_siblings(&parent);

    assert_eq!(child_sequence(&parent), vec!["comment_start", "left", "strong", "comment_end"]);
    assert_eq!(first_child_text(&children_of(&parent).get(2)), "right");
}

#[wasm_bindgen_test(async)]
async fn render_container_fragment_replace_with_element_keeps_single_new_root() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let fragment_vnode = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("A")).into(),
    );
    rue.render_wasm(fragment_vnode, container.clone());
    tick().await;
    update_siblings(&container);

    let element_children = Array::of1(&JsValue::from_str("B"));
    let element_vnode = rue.create_element_wasm(
        JsValue::from_str("div"),
        JsValue::UNDEFINED,
        element_children.into(),
    );
    rue.render_wasm(element_vnode, container.clone());
    tick().await;
    update_siblings(&container);

    let sequence = child_sequence(&container);
    assert_eq!(sequence, vec!["div"]);

    let children = Reflect::get(&container, &JsValue::from_str("children")).unwrap();
    let arr: Array = children.unchecked_into();
    let div = arr.get(0);
    assert_eq!(first_child_text(&div), "B");
}

#[wasm_bindgen_test(async)]
async fn render_container_fragment_replace_with_element_skips_unmatched_focus_target() {
    let adapter = make_linked_adapter();
    mirror_attributes_to_node(&adapter);
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let input_a = rue.create_element_wasm(
        JsValue::from_str("input"),
        type_props("text"),
        Array::new().into(),
    );
    let fragment_vnode = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::of1(&input_a).into(),
    );
    rue.render_wasm(fragment_vnode, container.clone());
    tick().await;
    update_siblings(&container);

    let old_input = children_of(&container).get(0);
    let document = Object::new();
    Reflect::set(&document, &JsValue::from_str("activeElement"), &old_input).unwrap();
    let global = js_sys::global();
    Reflect::set(&global, &JsValue::from_str("document"), &document).unwrap();
    Reflect::set(&old_input, &JsValue::from_str("selectionStart"), &JsValue::from_f64(1.0))
        .unwrap();
    Reflect::set(&old_input, &JsValue::from_str("selectionEnd"), &JsValue::from_f64(3.0)).unwrap();
    Reflect::set(
        &old_input,
        &JsValue::from_str("selectionDirection"),
        &JsValue::from_str("backward"),
    )
    .unwrap();

    let input_b = rue.create_element_wasm(
        JsValue::from_str("input"),
        type_props("text"),
        Array::new().into(),
    );
    let element_vnode = rue.create_element_wasm(
        JsValue::from_str("div"),
        JsValue::UNDEFINED,
        Array::of1(&input_b).into(),
    );
    rue.render_wasm(element_vnode, container.clone());
    tick().await;
    update_siblings(&container);

    let div = children_of(&container).get(0);
    let new_input = children_of(&div).get(0);
    Reflect::set(&new_input, &JsValue::from_str("ownerDocument"), &document).unwrap();
    Reflect::set(
        &new_input,
        &JsValue::from_str("focus"),
        &Function::new_no_args("this.focused = true").into(),
    )
    .unwrap();
    tick().await;
    tick().await;

    assert!(
        Reflect::get(&new_input, &JsValue::from_str("selectionStart"))
            .unwrap_or(JsValue::UNDEFINED)
            .is_undefined()
    );
    assert!(
        Reflect::get(&new_input, &JsValue::from_str("focused"))
            .unwrap_or(JsValue::UNDEFINED)
            .is_undefined()
    );

    Reflect::delete_property(&global, &JsValue::from_str("document")).unwrap();
}

#[wasm_bindgen_test(async)]
async fn render_container_keyed_fragment_replace_with_fragment_inserts_new_children() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let first_fragment = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        key_props("first"),
        Array::of1(&JsValue::from_str("A")).into(),
    );
    rue.render_wasm(first_fragment, container.clone());
    tick().await;
    update_siblings(&container);
    assert_eq!(child_sequence(&container), vec!["A"]);

    let second_fragment = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        key_props("second"),
        Array::of2(&JsValue::from_str("B"), &JsValue::from_str("C")).into(),
    );
    rue.render_wasm(second_fragment, container.clone());
    tick().await;
    update_siblings(&container);

    assert_eq!(child_sequence(&container), vec!["B", "C"]);
}

#[wasm_bindgen_test(async)]
async fn render_container_fragment_host_replacement_removes_contained_fragment_host() {
    let adapter = make_wasm_adapter();
    Reflect::set(
        &adapter,
        &JsValue::from_str("isFragment"),
        &Function::new_with_args("el", "return false").into(),
    )
    .unwrap();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let fragment_vnode = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("A")).into(),
    );
    rue.render_wasm(fragment_vnode, container.clone());
    tick().await;
    update_siblings(&container);
    assert_eq!(child_sequence(&container), vec!["fragment"]);

    let element_vnode = rue.create_element_wasm(
        JsValue::from_str("div"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("B")).into(),
    );
    rue.render_wasm(element_vnode, container.clone());
    tick().await;
    update_siblings(&container);

    assert_eq!(child_sequence(&container), vec!["div"]);
    assert_eq!(first_child_text(&children_of(&container).get(0)), "B");
}

#[wasm_bindgen_test(async)]
async fn render_container_empty_fragment_replace_removes_stale_parent_children() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let empty_fragment = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::new().into(),
    );
    rue.render_wasm(empty_fragment, container.clone());
    tick().await;

    let stale = raw_node("stale");
    Reflect::set(&container, &JsValue::from_str("children"), &Array::of1(&stale).into()).unwrap();
    update_siblings(&container);
    assert_eq!(child_sequence(&container), vec!["stale"]);

    let element_vnode = rue.create_element_wasm(
        JsValue::from_str("div"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("fresh")).into(),
    );
    rue.render_wasm(element_vnode, container.clone());
    tick().await;
    update_siblings(&container);

    assert_eq!(child_sequence(&container), vec!["div"]);
    assert_eq!(first_child_text(&children_of(&container).get(0)), "fresh");
}

#[wasm_bindgen_test(async)]
async fn render_container_element_replace_with_empty_fragment_updates_hostless_state() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let element = rue.create_element_wasm(
        JsValue::from_str("section"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("old")).into(),
    );
    rue.render_wasm(element, container.clone());
    tick().await;
    update_siblings(&container);
    assert_eq!(child_sequence(&container), vec!["section"]);

    let empty_fragment = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::new().into(),
    );
    rue.render_wasm(empty_fragment, container.clone());
    tick().await;
    update_siblings(&container);

    assert!(child_sequence(&container).is_empty());
}

#[wasm_bindgen_test(async)]
async fn render_container_empty_fragment_replace_with_component_fragment_inserts_children() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let empty_fragment = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::new().into(),
    );
    rue.render_wasm(empty_fragment, container.clone());
    tick().await;
    update_siblings(&container);
    assert!(child_sequence(&container).is_empty());

    let component = Function::new_no_args(
        "return { type: 'fragment', props: {}, children: ['left', { type: 'strong', props: {}, children: ['right'] }] }",
    );
    let vnode = rue.create_element_wasm(component.into(), JsValue::UNDEFINED, JsValue::UNDEFINED);
    rue.render_wasm(vnode, container.clone());
    tick().await;
    update_siblings(&container);

    assert_eq!(child_sequence(&container), vec!["left", "strong"]);
    assert_eq!(first_child_text(&children_of(&container).get(1)), "right");
}

#[wasm_bindgen_test(async)]
async fn render_container_element_replace_with_fragment_clears_old_root() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let element_children = Array::of1(&JsValue::from_str("A"));
    let element_vnode = rue.create_element_wasm(
        JsValue::from_str("div"),
        JsValue::UNDEFINED,
        element_children.into(),
    );
    rue.render_wasm(element_vnode, container.clone());
    tick().await;
    update_siblings(&container);

    let fragment_vnode = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("B")).into(),
    );
    rue.render_wasm(fragment_vnode, container.clone());
    tick().await;
    update_siblings(&container);

    let sequence = child_sequence(&container);
    assert_eq!(sequence, vec!["B"]);
}

#[wasm_bindgen_test(async)]
async fn render_container_element_patch_updates_in_place() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let element_a_children = Array::of1(&JsValue::from_str("A"));
    let element_a = rue.create_element_wasm(
        JsValue::from_str("div"),
        JsValue::UNDEFINED,
        element_a_children.into(),
    );
    rue.render_wasm(element_a, container.clone());
    tick().await;
    update_siblings(&container);

    let element_b_children = Array::of1(&JsValue::from_str("B"));
    let element_b = rue.create_element_wasm(
        JsValue::from_str("div"),
        JsValue::UNDEFINED,
        element_b_children.into(),
    );
    rue.render_wasm(element_b, container.clone());
    tick().await;
    update_siblings(&container);

    let sequence = child_sequence(&container);
    assert_eq!(sequence, vec!["div"]);

    let children = Reflect::get(&container, &JsValue::from_str("children")).unwrap();
    let arr: Array = children.unchecked_into();
    let div = arr.get(0);
    assert_eq!(first_child_text(&div), "B");
}

#[wasm_bindgen_test(async)]
async fn render_container_element_rebuilds_to_registered_text_input() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let element = rue.create_element_wasm(
        JsValue::from_str("div"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("old")).into(),
    );
    rue.render_wasm(element, container.clone());
    tick().await;
    update_siblings(&container);
    assert_eq!(child_sequence(&container), vec!["div"]);

    let text = store_manual_mount_input(manual_mount_input(MountInputType::Text(
        "registered text".to_string(),
    )));
    rue.render_wasm(text, container.clone());
    tick().await;
    update_siblings(&container);

    assert_eq!(child_sequence(&container), vec!["registered text"]);
}

#[wasm_bindgen_test(async)]
async fn render_container_element_keeps_old_root_after_unmountable_registered_input() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let element = rue.create_element_wasm(
        JsValue::from_str("section"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("stable")).into(),
    );
    rue.render_wasm(element, container.clone());
    tick().await;
    update_siblings(&container);
    assert_eq!(child_sequence(&container), vec!["section"]);

    let phantom = store_manual_mount_input(manual_mount_input(MountInputType::_Phantom(
        std::marker::PhantomData,
    )));
    rue.render_wasm(phantom, container.clone());
    tick().await;
    update_siblings(&container);

    assert_eq!(child_sequence(&container), vec!["section"]);
    assert_eq!(first_child_text(&children_of(&container).get(0)), "stable");
}

#[wasm_bindgen_test(async)]
async fn render_container_child_fragment_patch_restores_focus_selection_to_new_child() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let input_a = rue.create_element_wasm(
        JsValue::from_str("input"),
        JsValue::UNDEFINED,
        Array::new().into(),
    );
    let fragment_a = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::of1(&input_a).into(),
    );
    let root_a = rue.create_element_wasm(
        JsValue::from_str("section"),
        JsValue::UNDEFINED,
        Array::of1(&fragment_a).into(),
    );
    rue.render_wasm(root_a, container.clone());
    tick().await;
    update_siblings(&container);

    let section = children_of(&container).get(0);
    let old_input = children_of(&section).get(0);
    let document = js_sys::Object::new();
    Reflect::set(&document, &JsValue::from_str("activeElement"), &old_input).unwrap();
    let global = js_sys::global();
    Reflect::set(&global, &JsValue::from_str("document"), &document).unwrap();
    Reflect::set(&old_input, &JsValue::from_str("selectionStart"), &JsValue::from_f64(2.0))
        .unwrap();
    Reflect::set(&old_input, &JsValue::from_str("selectionEnd"), &JsValue::from_f64(4.0)).unwrap();
    Reflect::set(
        &old_input,
        &JsValue::from_str("selectionDirection"),
        &JsValue::from_str("forward"),
    )
    .unwrap();

    let input_b = rue.create_element_wasm(
        JsValue::from_str("input"),
        JsValue::UNDEFINED,
        Array::new().into(),
    );
    let fragment_b = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::of1(&input_b).into(),
    );
    let root_b = rue.create_element_wasm(
        JsValue::from_str("section"),
        JsValue::UNDEFINED,
        Array::of1(&fragment_b).into(),
    );
    rue.render_wasm(root_b, container.clone());
    update_siblings(&container);

    let section = children_of(&container).get(0);
    let new_input = children_of(&section).get(0);
    Reflect::set(&new_input, &JsValue::from_str("ownerDocument"), &document).unwrap();
    Reflect::set(
        &new_input,
        &JsValue::from_str("focus"),
        &Function::new_no_args("this.focused = true").into(),
    )
    .unwrap();
    tick().await;
    tick().await;
    update_siblings(&container);

    let section = children_of(&container).get(0);
    let new_input = children_of(&section).get(0);
    assert_eq!(
        Reflect::get(&new_input, &JsValue::from_str("selectionStart")).unwrap().as_f64(),
        Some(2.0)
    );
    assert_eq!(
        Reflect::get(&new_input, &JsValue::from_str("selectionEnd")).unwrap().as_f64(),
        Some(4.0)
    );
    assert_eq!(
        Reflect::get(&new_input, &JsValue::from_str("selectionDirection"))
            .unwrap()
            .as_string()
            .as_deref(),
        Some("forward")
    );
    assert_eq!(
        Reflect::get(&new_input, &JsValue::from_str("focused")).unwrap().as_bool(),
        Some(true)
    );

    Reflect::delete_property(&global, &JsValue::from_str("document")).unwrap();
}

#[wasm_bindgen_test(async)]
async fn render_container_fragment_patch_reads_child_nodes_when_children_is_null() {
    let adapter = make_linked_adapter();
    let fragments_key = "__rue_plan999_child_nodes_fragments__";
    record_created_fragments(&adapter, fragments_key);
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let first_fragment = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("A")).into(),
    );
    let first = rue.create_element_wasm(
        JsValue::from_str("section"),
        JsValue::UNDEFINED,
        Array::of1(&first_fragment).into(),
    );
    rue.render_wasm(first, container.clone());
    tick().await;
    update_siblings(&container);

    let global = js_sys::global();
    let fragments = Reflect::get(&global, &JsValue::from_str(fragments_key)).unwrap();
    let fragments: Array = fragments.unchecked_into();
    let old_fragment = fragments.get(1);
    let old_children = Reflect::get(&old_fragment, &JsValue::from_str("children")).unwrap();
    let old_children = Array::from(&old_children);
    let old_text = old_children.get(0);
    Reflect::set(&old_fragment, &JsValue::from_str("children"), &JsValue::NULL).unwrap();
    Reflect::set(&old_fragment, &JsValue::from_str("childNodes"), &Array::of1(&old_text).into())
        .unwrap();

    let document = Object::new();
    Reflect::set(&document, &JsValue::from_str("activeElement"), &old_text).unwrap();
    Reflect::set(&global, &JsValue::from_str("document"), &document).unwrap();

    let second_fragment = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("B")).into(),
    );
    let second = rue.create_element_wasm(
        JsValue::from_str("section"),
        JsValue::UNDEFINED,
        Array::of1(&second_fragment).into(),
    );
    rue.render_wasm(second, container.clone());
    tick().await;
    update_siblings(&container);

    assert_eq!(child_sequence(&container), vec!["section"]);
    let section = children_of(&container).get(0);
    assert_eq!(child_sequence(&section), vec!["B"]);

    Reflect::delete_property(&global, &JsValue::from_str("document")).unwrap();
    Reflect::delete_property(&global, &JsValue::from_str(fragments_key)).unwrap();
}

#[wasm_bindgen_test(async)]
async fn render_container_fragment_patch_ignores_null_active_element() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let first_fragment = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("A")).into(),
    );
    let first = rue.create_element_wasm(
        JsValue::from_str("section"),
        JsValue::UNDEFINED,
        Array::of1(&first_fragment).into(),
    );
    rue.render_wasm(first, container.clone());
    tick().await;
    update_siblings(&container);

    let global = js_sys::global();
    let document = Object::new();
    Reflect::set(&document, &JsValue::from_str("activeElement"), &JsValue::NULL).unwrap();
    Reflect::set(&global, &JsValue::from_str("document"), &document).unwrap();

    let second_fragment = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("B")).into(),
    );
    let second = rue.create_element_wasm(
        JsValue::from_str("section"),
        JsValue::UNDEFINED,
        Array::of1(&second_fragment).into(),
    );
    rue.render_wasm(second, container.clone());
    tick().await;
    update_siblings(&container);

    let section = children_of(&container).get(0);
    assert_eq!(child_sequence(&section), vec!["B"]);

    Reflect::delete_property(&global, &JsValue::from_str("document")).unwrap();
}

#[wasm_bindgen_test(async)]
async fn render_container_child_fragment_patch_skips_focus_restore_for_input_type_mismatch() {
    let adapter = make_linked_adapter();
    mirror_attributes_to_node(&adapter);
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let input_a = rue.create_element_wasm(
        JsValue::from_str("input"),
        type_props("text"),
        Array::new().into(),
    );
    let fragment_a = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::of1(&input_a).into(),
    );
    let root_a = rue.create_element_wasm(
        JsValue::from_str("section"),
        JsValue::UNDEFINED,
        Array::of1(&fragment_a).into(),
    );
    rue.render_wasm(root_a, container.clone());
    tick().await;
    update_siblings(&container);

    let section = children_of(&container).get(0);
    let old_input = children_of(&section).get(0);
    let document = js_sys::Object::new();
    Reflect::set(&document, &JsValue::from_str("activeElement"), &old_input).unwrap();
    let global = js_sys::global();
    Reflect::set(&global, &JsValue::from_str("document"), &document).unwrap();
    Reflect::set(&old_input, &JsValue::from_str("selectionStart"), &JsValue::from_f64(7.0))
        .unwrap();

    let input_b = rue.create_element_wasm(
        JsValue::from_str("input"),
        type_props("password"),
        Array::new().into(),
    );
    let fragment_b = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::of1(&input_b).into(),
    );
    let root_b = rue.create_element_wasm(
        JsValue::from_str("section"),
        JsValue::UNDEFINED,
        Array::of1(&fragment_b).into(),
    );
    rue.render_wasm(root_b, container.clone());
    tick().await;
    update_siblings(&container);

    let section = children_of(&container).get(0);
    let new_input = children_of(&section).get(0);
    assert_eq!(
        Reflect::get(&new_input, &JsValue::from_str("type")).unwrap().as_string().as_deref(),
        Some("password")
    );
    assert!(Reflect::get(&new_input, &JsValue::from_str("selectionStart")).unwrap().is_undefined());

    Reflect::delete_property(&global, &JsValue::from_str("document")).unwrap();
}

#[wasm_bindgen_test(async)]
async fn render_container_child_fragment_patch_skips_focus_restore_for_tag_mismatch() {
    let adapter = make_linked_adapter();
    mirror_attributes_to_node(&adapter);
    let rue = createRue(adapter.clone());
    let container = setup_container(&adapter);

    let input_a = rue.create_element_wasm(
        JsValue::from_str("input"),
        type_props("text"),
        Array::new().into(),
    );
    let fragment_a = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::of1(&input_a).into(),
    );
    let root_a = rue.create_element_wasm(
        JsValue::from_str("section"),
        JsValue::UNDEFINED,
        Array::of1(&fragment_a).into(),
    );
    rue.render_wasm(root_a, container.clone());
    tick().await;
    update_siblings(&container);

    let section = children_of(&container).get(0);
    let old_input = children_of(&section).get(0);
    let document = js_sys::Object::new();
    Reflect::set(&document, &JsValue::from_str("activeElement"), &old_input).unwrap();
    let global = js_sys::global();
    Reflect::set(&global, &JsValue::from_str("document"), &document).unwrap();
    Reflect::set(&old_input, &JsValue::from_str("selectionStart"), &JsValue::from_f64(9.0))
        .unwrap();

    let select_b = rue.create_element_wasm(
        JsValue::from_str("select"),
        type_props("text"),
        Array::new().into(),
    );
    let fragment_b = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::of1(&select_b).into(),
    );
    let root_b = rue.create_element_wasm(
        JsValue::from_str("section"),
        JsValue::UNDEFINED,
        Array::of1(&fragment_b).into(),
    );
    rue.render_wasm(root_b, container.clone());
    tick().await;
    update_siblings(&container);

    let section = children_of(&container).get(0);
    let new_select = children_of(&section).get(0);
    assert_eq!(
        Reflect::get(&new_select, &JsValue::from_str("tag")).unwrap().as_string().as_deref(),
        Some("select")
    );
    assert!(
        Reflect::get(&new_select, &JsValue::from_str("selectionStart")).unwrap().is_undefined()
    );

    Reflect::delete_property(&global, &JsValue::from_str("document")).unwrap();
}
