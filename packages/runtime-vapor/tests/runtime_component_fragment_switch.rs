#![cfg(feature = "compat")]

//! 组件片段根在区间渲染中的切换行为测试
//!
//! 使用 JS 侧模拟 DomAdapter，验证在 renderBetween 场景下：
//! - 组件根为 fragment 时，片段子节点被正确插入到锚点之间
//! - 从组件 A 切换到组件 B 后，只保留最新一份 span 文本节点。
use js_sys::Function;
use rue_runtime_vapor::createRue;
use wasm_bindgen::JsValue;
use wasm_bindgen_test::*;
mod common;
use common::{
    count_children_with_tag, first_child_text, first_child_with_tag,
    make_consuming_linked_adapter as make_adapter_fragment_consumes_children, setup_range, tick,
    update_siblings,
};

/// 当组件根为 fragment 且在 renderBetween 范围内切换组件时：
/// - 旧片段子节点被清理
/// - 只保留新组件产生的 span 文本内容
#[wasm_bindgen_test(async)]
async fn render_between_component_switch_fragment_root_in_range() {
    let adapter = make_adapter_fragment_consumes_children();
    let rue = createRue(adapter.clone());
    let (parent, start, end) = setup_range(&adapter);

    let comp_a = Function::new_no_args(
        "return { type: 'fragment', props: {}, children: [ { type: 'span', props: {}, children: ['A'] } ] }",
    );
    let comp_b = Function::new_no_args(
        "return { type: 'fragment', props: {}, children: [ { type: 'span', props: {}, children: ['B'] } ] }",
    );

    let id_a = rue.create_element_wasm(comp_a.into(), JsValue::UNDEFINED, JsValue::UNDEFINED);
    rue.render_between_wasm(id_a, parent.clone(), start.clone(), end.clone());
    tick().await;
    update_siblings(&parent);

    assert_eq!(count_children_with_tag(&parent, "span"), 1);
    let span_after_a = first_child_with_tag(&parent, "span").unwrap();
    assert_eq!(first_child_text(&span_after_a), "A");

    let id_b = rue.create_element_wasm(comp_b.into(), JsValue::UNDEFINED, JsValue::UNDEFINED);
    rue.render_between_wasm(id_b, parent.clone(), start.clone(), end.clone());
    tick().await;
    update_siblings(&parent);

    assert_eq!(count_children_with_tag(&parent, "span"), 1);
    let last_span = first_child_with_tag(&parent, "span").unwrap();
    assert_eq!(first_child_text(&last_span), "B");
}
