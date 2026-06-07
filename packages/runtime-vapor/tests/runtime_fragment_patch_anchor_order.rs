#![cfg(feature = "compat")]

//! Fragment -> Fragment 的同类型 patch 必须继续使用区间 end 作为插入参照，
//! 不能把已被消费的旧 DocumentFragment 当作真实锚点。
use js_sys::{Array, Function};
use rue_runtime_vapor::createRue;
use wasm_bindgen::JsValue;
use wasm_bindgen_test::*;
mod common;

use common::{
    child_sequence, make_linked_adapter, setup_anchor, setup_range, tick, update_siblings,
};

#[wasm_bindgen_test(async)]
async fn render_between_fragment_patch_keeps_children_before_end_anchor() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let (parent, start, end) = setup_range(&adapter);

    let frag_a = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("A")).into(),
    );
    rue.render_between_wasm(frag_a, parent.clone(), start.clone(), end.clone());
    tick().await;
    update_siblings(&parent);

    let frag_b = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("B")).into(),
    );
    rue.render_between_wasm(frag_b, parent.clone(), start.clone(), end.clone());
    tick().await;
    update_siblings(&parent);

    assert_eq!(child_sequence(&parent), vec!["comment_start", "B", "comment_end"]);
}

#[wasm_bindgen_test(async)]
async fn render_between_fragment_patch_clears_to_empty_and_remounts_children() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let (parent, start, end) = setup_range(&adapter);

    let frag_a = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::of2(&JsValue::from_str("A"), &JsValue::from_str("B")).into(),
    );
    rue.render_between_wasm(frag_a, parent.clone(), start.clone(), end.clone());
    tick().await;
    update_siblings(&parent);

    assert_eq!(child_sequence(&parent), vec!["comment_start", "A", "B", "comment_end"]);

    let empty = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::new().into(),
    );
    rue.render_between_wasm(empty, parent.clone(), start.clone(), end.clone());
    tick().await;
    update_siblings(&parent);

    assert_eq!(child_sequence(&parent), vec!["comment_start", "comment_end"]);

    let frag_c = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::of1(&JsValue::from_str("C")).into(),
    );
    rue.render_between_wasm(frag_c, parent.clone(), start.clone(), end.clone());
    tick().await;
    update_siblings(&parent);

    assert_eq!(child_sequence(&parent), vec!["comment_start", "C", "comment_end"]);
}

#[wasm_bindgen_test(async)]
async fn render_anchor_fragment_inserts_multiple_children_before_anchor_and_clears_empty() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let (parent, anchor) = setup_anchor(&adapter);

    let frag = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::of2(&JsValue::from_str("left"), &JsValue::from_str("right")).into(),
    );
    rue.render_anchor_wasm(frag, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    assert_eq!(child_sequence(&parent), vec!["left", "right", "comment_anchor"]);

    let empty = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::new().into(),
    );
    rue.render_anchor_wasm(empty, parent.clone(), anchor.clone());
    tick().await;
    update_siblings(&parent);

    assert_eq!(child_sequence(&parent), vec!["comment_anchor"]);
}

#[wasm_bindgen_test(async)]
async fn render_between_fragment_skips_unmountable_input_child_and_keeps_following_text() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let (parent, start, end) = setup_range(&adapter);

    let bad_component = Function::new_no_args("return { unsupported: true }");
    let bad_child = rue.create_component_wasm(bad_component.into(), JsValue::UNDEFINED);
    let frag = rue.create_element_wasm(
        JsValue::from_str("fragment"),
        JsValue::UNDEFINED,
        Array::of2(&bad_child, &JsValue::from_str("after")).into(),
    );

    rue.render_between_wasm(frag, parent.clone(), start.clone(), end.clone());
    tick().await;
    update_siblings(&parent);

    assert_eq!(child_sequence(&parent), vec!["comment_start", "after", "comment_end"]);
}
