#![cfg(feature = "compat")]

//! Fragment -> Fragment 的同类型 patch 必须继续使用区间 end 作为插入参照，
//! 不能把已被消费的旧 DocumentFragment 当作真实锚点。
use js_sys::Array;
use rue_runtime_vapor::createRue;
use wasm_bindgen::JsValue;
use wasm_bindgen_test::*;
mod common;

use common::{child_sequence, make_linked_adapter, setup_range, tick, update_siblings};

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
