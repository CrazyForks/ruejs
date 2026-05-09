#![cfg(feature = "compat")]

//! compat replace 边界测试：
//! - Fragment -> Element 必须清理旧片段子节点，只保留新元素根
//! - Element -> Fragment 必须移除旧元素根，并把新片段子节点留在目标挂载边界内
//! - 覆盖 renderBetween / renderAnchor / render 三种根挂载入口
use js_sys::{Array, Reflect};
use rue_runtime_vapor::createRue;
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use wasm_bindgen_test::*;
mod common;

use common::{
    child_sequence, first_child_text, make_linked_adapter, setup_anchor, setup_container,
    setup_range, tick, update_siblings,
};

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
