#![cfg(not(feature = "log"))]

use js_sys::{Array, Object};
use wasm_bindgen::JsValue;
use wasm_bindgen_test::*;

#[wasm_bindgen_test]
fn disabled_log_api_is_noop_and_never_wants_log() {
    rue_runtime_vapor::log::set_log_enabled(true);
    rue_runtime_vapor::log::set_log_console(true);
    rue_runtime_vapor::log::set_log_level("debug");
    rue_runtime_vapor::log::add_log_include("runtime");
    rue_runtime_vapor::log::clear_log_include();
    rue_runtime_vapor::log::add_log_exclude("skip");
    rue_runtime_vapor::log::clear_log_exclude();

    rue_runtime_vapor::log::log("debug", "message");
    rue_runtime_vapor::log::log_with_context("info", "hello {name}", Object::new().into());
    rue_runtime_vapor::log::debug("debug");
    rue_runtime_vapor::log::info("info");
    rue_runtime_vapor::log::notice("notice");
    rue_runtime_vapor::log::warning("warning");
    rue_runtime_vapor::log::error("error");
    rue_runtime_vapor::log::critical("critical");
    rue_runtime_vapor::log::alert("alert");
    rue_runtime_vapor::log::emergency("emergency");
    rue_runtime_vapor::log::log_js("values", &Array::new().to_vec());
    rue_runtime_vapor::log::log_js_value("value", &JsValue::from_str("x"));
    rue_runtime_vapor::log::log_js_label("label");

    assert!(!rue_runtime_vapor::log::want_log("debug", "runtime"));
    assert!(!rue_runtime_vapor::log::want_log("emergency", "anything"));
}
