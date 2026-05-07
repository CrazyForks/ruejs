#![cfg(feature = "compat")]

//! 组件在区间渲染中的函数切换行为测试
//!
//! 模拟 JS 侧 DomAdapter，在 renderBetween 范围内：
//! - 首先渲染组件 A（span 显示 A）
//! - 再切换为组件 B，并断言只保留 B。
use js_sys::Function;
use rue_runtime_vapor::createRue;
use wasm_bindgen::JsValue;
use wasm_bindgen_test::*;
mod common;
use common::{
    count_children_with_tag, first_child_text, first_child_with_tag, make_linked_adapter,
    setup_range, tick, update_siblings,
};

/// 在 renderBetween 范围内从组件 A 切换到组件 B：
/// - 旧组件子树被替换
/// - 最终 span 文本为 B
#[wasm_bindgen_test(async)]
async fn render_between_component_switching_function_replaces_subtree() {
    let adapter = make_linked_adapter();
    let rue = createRue(adapter.clone());
    let (parent, start, end) = setup_range(&adapter);

    let comp_a = Function::new_no_args("return { type: 'span', props: {}, children: ['A'] }");
    let comp_b = Function::new_no_args("return { type: 'span', props: {}, children: ['B'] }");

    let id_a = rue.create_element_wasm(comp_a.into(), JsValue::UNDEFINED, JsValue::UNDEFINED);
    rue.render_between_wasm(id_a, parent.clone(), start.clone(), end.clone());
    tick().await;
    update_siblings(&parent);

    let id_b = rue.create_element_wasm(comp_b.into(), JsValue::UNDEFINED, JsValue::UNDEFINED);
    rue.render_between_wasm(id_b, parent.clone(), start.clone(), end.clone());
    tick().await;
    update_siblings(&parent);

    assert_eq!(count_children_with_tag(&parent, "span"), 1);
    let span = first_child_with_tag(&parent, "span").unwrap();
    assert_eq!(first_child_text(&span), "B");
}
