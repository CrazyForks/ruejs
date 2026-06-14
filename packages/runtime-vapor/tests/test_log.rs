#![cfg(feature = "log")]

use js_sys::{Array, Function, Object, Reflect};
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;
use wasm_bindgen_test::*;

// 文件说明（面向 Rust 小白）：
// 这里以“黑盒方式”验证日志模块：
// - 通过注入 localStorage 配置来启用日志与设置级别
// - 重写 console.log 以捕获输出文本，并断言是否符合预期
// - 使用公开的配置函数控制包含/排除过滤

#[wasm_bindgen_test]
fn log_basic_and_context_outputs() {
    reset_public_log_state();
    install_capture_console("__capturedLogs");

    // 直接启用日志与级别，避免依赖 localStorage 注入
    rue_runtime_vapor::log::set_log_enabled(true);
    rue_runtime_vapor::log::set_log_console(true);
    rue_runtime_vapor::log::set_log_level("debug");
    rue_runtime_vapor::log::clear_log_include();
    rue_runtime_vapor::log::clear_log_exclude();
    let global = js_sys::global();

    // 调用日志入口
    rue_runtime_vapor::log::log("debug", "hello {name}");
    let ctx = Object::new();
    Reflect::set(&ctx, &JsValue::from_str("name"), &JsValue::from_str("Rue")).unwrap();
    rue_runtime_vapor::log::log_with_context("info", "hi {name}", ctx.into());

    // 验证捕获内容数量与包含插值
    let captured: Array = Reflect::get(&global, &JsValue::from_str("__capturedLogs"))
        .unwrap_or(Array::new().into())
        .unchecked_into();
    assert!(captured.length() >= 1);
    let mut has_rue = false;
    let mut has_hi = false;
    for i in 0..captured.length() {
        let s = captured.get(i).as_string().unwrap_or_default();
        if s.contains("Rue") {
            has_rue = true;
        }
        if s.contains("hi") {
            has_hi = true;
        }
    }
    assert!(has_rue);
    assert!(has_hi);
}

#[wasm_bindgen_test]
fn log_filters_include_exclude_and_level() {
    reset_public_log_state();
    install_capture_console("__capturedLogs2");

    // 启用日志，级别为 warning（info 不应输出）
    rue_runtime_vapor::log::set_log_enabled(true);
    rue_runtime_vapor::log::set_log_console(true);
    rue_runtime_vapor::log::set_log_level("warning");

    // 重置捕获容器
    let global = js_sys::global();

    // info 级别不会输出
    rue_runtime_vapor::log::log("info", "abc");
    let bucket: Array =
        Reflect::get(&global, &JsValue::from_str("__capturedLogs2")).unwrap().unchecked_into();
    assert_eq!(bucket.length(), 0);

    // 调整级别为 debug，并设置包含/排除过滤
    rue_runtime_vapor::log::set_log_level("debug");
    rue_runtime_vapor::log::clear_log_include();
    rue_runtime_vapor::log::add_log_include("abc");
    rue_runtime_vapor::log::clear_log_exclude();
    rue_runtime_vapor::log::add_log_exclude("x");

    rue_runtime_vapor::log::log("debug", "abc"); // 输出
    rue_runtime_vapor::log::log("debug", "hello"); // 不输出（不包含 abc）
    rue_runtime_vapor::log::log("debug", "abcx"); // 不输出（命中排除）

    let bucket2: Array =
        Reflect::get(&global, &JsValue::from_str("__capturedLogs2")).unwrap().unchecked_into();
    assert_eq!(bucket2.length(), 1);
    let s = bucket2.get(0).as_string().unwrap_or_default();
    assert!(s.contains("abc"));
}

#[wasm_bindgen_test]
fn noisy_runtime_vapor_debug_is_silent_unless_included() {
    reset_public_log_state();
    install_capture_console("__capturedLogs3");

    rue_runtime_vapor::log::set_log_enabled(true);
    rue_runtime_vapor::log::set_log_console(true);
    rue_runtime_vapor::log::set_log_level("debug");
    rue_runtime_vapor::log::clear_log_include();
    rue_runtime_vapor::log::clear_log_exclude();

    let global = js_sys::global();
    let local_storage = Object::new();
    let get_item = wasm_bindgen::closure::Closure::wrap(Box::new(move |key: JsValue| -> JsValue {
        if key.as_string().as_deref() == Some("rue.logs.verboseDebug") {
            return JsValue::from_str("true");
        }
        JsValue::NULL
    })
        as Box<dyn FnMut(JsValue) -> JsValue>);
    let get_item_fn: Function = get_item.as_ref().clone().into();
    Reflect::set(&local_storage, &JsValue::from_str("getItem"), &get_item_fn).ok();
    Reflect::set(&global, &JsValue::from_str("localStorage"), &local_storage).ok();
    get_item.forget();

    rue_runtime_vapor::log::log("debug", "runtime:vapor");

    let captured: Array = Reflect::get(&global, &JsValue::from_str("__capturedLogs3"))
        .unwrap_or(Array::new().into())
        .unchecked_into();
    assert_eq!(captured.length(), 0);

    rue_runtime_vapor::log::add_log_include("runtime:vapor");
    rue_runtime_vapor::log::log("debug", "runtime:vapor");

    let captured_after_include: Array =
        Reflect::get(&global, &JsValue::from_str("__capturedLogs3"))
            .unwrap_or(Array::new().into())
            .unchecked_into();
    assert_eq!(captured_after_include.length(), 1);
    let entry = captured_after_include.get(0).as_string().unwrap_or_default();
    assert!(entry.contains("runtime:vapor"));
}

fn delete_global_key(key: &str) {
    let _ = Reflect::delete_property(&js_sys::global(), &JsValue::from_str(key));
}

fn reset_public_log_state() {
    rue_runtime_vapor::log::set_log_enabled(false);
    rue_runtime_vapor::log::set_log_console(false);
    rue_runtime_vapor::log::set_log_level("debug");
    rue_runtime_vapor::log::clear_log_include();
    rue_runtime_vapor::log::clear_log_exclude();
    delete_global_key("localStorage");
}

fn install_capture_console(bucket_key: &'static str) {
    let global = js_sys::global();
    let bucket = Array::new();
    Reflect::set(&global, &JsValue::from_str(bucket_key), &bucket.into()).unwrap();

    let logger = wasm_bindgen::closure::Closure::wrap(Box::new(move |value: JsValue| {
        let bucket = Reflect::get(&js_sys::global(), &JsValue::from_str(bucket_key))
            .unwrap_or(Array::new().into())
            .unchecked_into::<Array>();
        bucket.push(&value);
    }) as Box<dyn FnMut(JsValue)>);
    let logger_fn: Function = logger.as_ref().clone().into();

    let console = Object::new();
    Reflect::set(&console, &JsValue::from_str("log"), &logger_fn).unwrap();
    Reflect::set(&console, &JsValue::from_str("error"), &logger_fn).unwrap();
    Reflect::set(&global, &JsValue::from_str("console"), &console).unwrap();
    logger.forget();
}

fn captured_logs(bucket_key: &str) -> Array {
    Reflect::get(&js_sys::global(), &JsValue::from_str(bucket_key))
        .unwrap_or(Array::new().into())
        .unchecked_into()
}

fn set_test_storage_value(name: &str, value: &str) {
    Reflect::set(&js_sys::global(), &JsValue::from_str(name), &JsValue::from_str(value)).unwrap();
}

fn test_storage_get_count() -> u32 {
    Reflect::get(&js_sys::global(), &JsValue::from_str("__public_log_get_item_calls"))
        .unwrap_or(JsValue::UNDEFINED)
        .as_f64()
        .unwrap_or(0.0) as u32
}

fn install_data_local_storage() {
    for key in [
        "__public_log_get_item_calls",
        "__public_log_enabled",
        "__public_log_level",
        "__public_log_verbose",
        "__public_log_include",
        "__public_log_exclude",
    ] {
        delete_global_key(key);
    }

    let storage = Object::new();
    let get_item = Function::new_with_args(
        "key",
        r#"
globalThis.__public_log_get_item_calls =
  (globalThis.__public_log_get_item_calls || 0) + 1;
switch (key) {
  case 'rue.logs.enabled':
    return globalThis.__public_log_enabled ?? null;
  case 'rue.logs.level':
    return globalThis.__public_log_level ?? null;
  case 'rue.logs.verboseDebug':
    return globalThis.__public_log_verbose ?? null;
  case 'rue.logs.include':
    return globalThis.__public_log_include ?? null;
  case 'rue.logs.exclude':
    return globalThis.__public_log_exclude ?? null;
  default:
    return null;
}
"#,
    );
    Reflect::set(&storage, &JsValue::from_str("getItem"), &get_item.into()).unwrap();
    Reflect::set(&js_sys::global(), &JsValue::from_str("localStorage"), &storage).unwrap();
}

fn drive_until_log_wanted(level: &str, hint: &str, expected: bool) -> bool {
    for _ in 0..=10025 {
        if rue_runtime_vapor::log::want_log(level, hint) == expected {
            return true;
        }
    }
    false
}

fn drive_until_storage_get_count_exceeds(previous: u32, level: &str, hint: &str) -> bool {
    for _ in 0..=10025 {
        let _ = rue_runtime_vapor::log::want_log(level, hint);
        if test_storage_get_count() > previous {
            return true;
        }
    }
    false
}

#[wasm_bindgen_test]
fn log_public_wrappers_context_and_js_helpers_cover_console_paths() {
    reset_public_log_state();
    install_capture_console("__capturedLogs_public_wrappers");
    rue_runtime_vapor::log::set_log_enabled(true);
    rue_runtime_vapor::log::set_log_console(true);
    rue_runtime_vapor::log::set_log_level("debug");

    rue_runtime_vapor::log::debug("debug");
    rue_runtime_vapor::log::info("info");
    rue_runtime_vapor::log::notice("notice");
    rue_runtime_vapor::log::warning("warning");
    rue_runtime_vapor::log::error("error");
    rue_runtime_vapor::log::critical("critical");
    rue_runtime_vapor::log::alert("alert");
    rue_runtime_vapor::log::emergency("emergency");
    rue_runtime_vapor::log::log("unknown", "fallback-level\u{0007}");

    let primitive_context_output = "primitive {name}";
    rue_runtime_vapor::log::log_with_context(
        "info",
        primitive_context_output,
        JsValue::from_str("not-object"),
    );

    let object_context = Object::new();
    Reflect::set(&object_context, &JsValue::from_str(""), &JsValue::from_str("ignored")).unwrap();
    Reflect::set(&object_context, &JsValue::from_str("count"), &JsValue::from_f64(42.0)).unwrap();
    let cyclic = Object::new();
    Reflect::set(&cyclic, &JsValue::from_str("self"), &cyclic).unwrap();
    Reflect::set(&object_context, &JsValue::from_str("cyclic"), &cyclic).unwrap();
    rue_runtime_vapor::log::log_with_context(
        "info",
        "count={count}; cyclic={cyclic}",
        object_context.into(),
    );

    let values = [JsValue::from_str("a"), JsValue::from_f64(2.0)];
    rue_runtime_vapor::log::log_js("values", &values);
    rue_runtime_vapor::log::log_js_value("single", &JsValue::from_str("value"));
    rue_runtime_vapor::log::log_js_label("label");

    let captured = captured_logs("__capturedLogs_public_wrappers");
    assert!(captured.length() >= 14);
    let joined = (0..captured.length())
        .map(|index| captured.get(index).as_string().unwrap_or_default())
        .collect::<Vec<_>>()
        .join("\n");
    assert!(joined.contains("emergency"));
    assert!(joined.contains("fallback-level "));
    assert!(joined.contains(primitive_context_output));
    assert!(joined.contains("count=42"));

    rue_runtime_vapor::log::set_log_console(false);
    let before = captured.length();
    rue_runtime_vapor::log::log_js_label("silent");
    assert_eq!(captured_logs("__capturedLogs_public_wrappers").length(), before);
}

#[wasm_bindgen_test]
fn log_public_localstorage_sync_parses_all_config_fields() {
    reset_public_log_state();
    install_data_local_storage();
    set_test_storage_value("__public_log_enabled", "yes");
    set_test_storage_value("__public_log_level", "error");
    set_test_storage_value("__public_log_verbose", "on");
    set_test_storage_value("__public_log_include", "sync-target, extra");
    set_test_storage_value("__public_log_exclude", "drop-target");

    assert!(drive_until_log_wanted("error", "sync-target ready", true));
    assert!(test_storage_get_count() >= 5);
    assert!(!rue_runtime_vapor::log::want_log("warning", "sync-target ready"));
    assert!(!rue_runtime_vapor::log::want_log("error", "no include match"));
    assert!(!rue_runtime_vapor::log::want_log("error", "sync-target drop-target"));

    set_test_storage_value("__public_log_enabled", "off");
    set_test_storage_value("__public_log_level", "debug");
    set_test_storage_value("__public_log_verbose", "off");
    set_test_storage_value("__public_log_include", "");
    set_test_storage_value("__public_log_exclude", "");
    assert!(drive_until_log_wanted("error", "sync-target ready", false));
}

#[wasm_bindgen_test]
fn log_public_localstorage_invalid_values_keep_previous_config() {
    reset_public_log_state();
    install_data_local_storage();
    set_test_storage_value("__public_log_enabled", "true");
    set_test_storage_value("__public_log_level", "notice");
    set_test_storage_value("__public_log_verbose", "true");
    set_test_storage_value("__public_log_include", "stable");
    set_test_storage_value("__public_log_exclude", "");
    assert!(drive_until_log_wanted("notice", "stable message", true));
    assert!(!rue_runtime_vapor::log::want_log("info", "stable message"));

    set_test_storage_value("__public_log_enabled", "not-a-bool");
    set_test_storage_value("__public_log_level", "not-a-level");
    set_test_storage_value("__public_log_verbose", "not-a-bool");
    set_test_storage_value("__public_log_include", "stable");
    set_test_storage_value("__public_log_exclude", "");
    let previous_get_count = test_storage_get_count();
    assert!(drive_until_storage_get_count_exceeds(previous_get_count, "notice", "stable message"));
    assert!(rue_runtime_vapor::log::want_log("notice", "stable message"));
    assert!(rue_runtime_vapor::log::want_log("debug", "stable message"));
}

#[wasm_bindgen_test]
fn log_public_localstorage_absent_and_malformed_shapes_are_safe() {
    reset_public_log_state();
    rue_runtime_vapor::log::set_log_enabled(true);
    rue_runtime_vapor::log::set_log_level("debug");

    let global = js_sys::global();
    let original_process =
        Reflect::get(&global, &JsValue::from_str("process")).unwrap_or(JsValue::UNDEFINED);

    let no_node_process = Object::new();
    Reflect::set(&global, &JsValue::from_str("process"), &no_node_process).unwrap();
    delete_global_key("localStorage");
    for _ in 0..=10025 {
        assert!(rue_runtime_vapor::log::want_log("error", "storage absent without node process"));
    }

    let malformed_storage = Object::new();
    Reflect::set(
        &malformed_storage,
        &JsValue::from_str("getItem"),
        &JsValue::from_str("not-a-function"),
    )
    .unwrap();
    Reflect::set(&global, &JsValue::from_str("localStorage"), &malformed_storage).unwrap();
    for _ in 0..=10025 {
        assert!(rue_runtime_vapor::log::want_log("error", "storage getItem malformed"));
    }

    Reflect::set(&global, &JsValue::from_str("process"), &original_process).unwrap();
    delete_global_key("localStorage");
    for _ in 0..=10025 {
        assert!(rue_runtime_vapor::log::want_log("error", "storage absent with node process"));
    }
}

#[wasm_bindgen_test]
fn log_public_console_missing_log_function_paths_are_noops() {
    reset_public_log_state();
    rue_runtime_vapor::log::set_log_enabled(true);
    rue_runtime_vapor::log::set_log_console(true);
    rue_runtime_vapor::log::set_log_level("debug");

    let global = js_sys::global();
    let original_console =
        Reflect::get(&global, &JsValue::from_str("console")).unwrap_or(JsValue::UNDEFINED);
    let console = Object::new();
    Reflect::set(&console, &JsValue::from_str("log"), &JsValue::from_str("not-a-function"))
        .unwrap();
    let error_noop = wasm_bindgen::closure::Closure::wrap(
        Box::new(move |_value: JsValue| {}) as Box<dyn FnMut(JsValue)>
    );
    let error_noop_fn: Function = error_noop.as_ref().clone().into();
    Reflect::set(&console, &JsValue::from_str("error"), &error_noop_fn).unwrap();
    Reflect::set(&global, &JsValue::from_str("console"), &console).unwrap();
    error_noop.forget();

    rue_runtime_vapor::log::log("error", "console without callable log");
    rue_runtime_vapor::log::log_js_label("console without callable log");

    Reflect::set(&global, &JsValue::from_str("console"), &original_console).unwrap();
}

#[wasm_bindgen_test]
fn log_public_ignores_node_localstorage_accessor() {
    reset_public_log_state();
    let global = js_sys::global();
    delete_global_key("__public_log_accessor_reads");

    let descriptor = Object::new();
    let getter = Function::new_no_args(
        "globalThis.__public_log_accessor_reads = \
         (globalThis.__public_log_accessor_reads || 0) + 1; return { getItem() { return 'true' } };",
    );
    Reflect::set(&descriptor, &JsValue::from_str("get"), &getter.into()).unwrap();
    Reflect::set(&descriptor, &JsValue::from_str("configurable"), &JsValue::TRUE).unwrap();
    let global_obj = global.dyn_ref::<Object>().expect("global should be object");
    Object::define_property(global_obj, &JsValue::from_str("localStorage"), &descriptor);

    for _ in 0..=10025 {
        assert!(!rue_runtime_vapor::log::want_log("error", "accessor ignored"));
    }
    let reads = Reflect::get(&global, &JsValue::from_str("__public_log_accessor_reads"))
        .unwrap_or(JsValue::UNDEFINED)
        .as_f64()
        .unwrap_or(0.0);
    assert_eq!(reads, 0.0);

    delete_global_key("localStorage");
    delete_global_key("__public_log_accessor_reads");
}
