/*
日志模块：提供可控的运行时日志输出

整体设计：
- 在浏览器环境中，很多时候希望动态调整日志的开关与级别，因此这里通过 `localStorage` 来进行配置，
  便于开发与调试（无需重新编译或修改代码）。
- 支持设置最低级别阈值（如只看 `warning` 及以上），并提供包含/排除关键字的过滤能力，
  让日志更聚焦到你关心的子系统或关键路径。

Rust 结构与 wasm 选择：
- 使用 `thread_local!` 存储配置，使其在 WebAssembly 单线程场景中无需锁即可安全访问。
- 通过 `js_sys` 与 `wasm_bindgen` 调用浏览器的 `localStorage` 与 `console.log`，
  既保持 Rust 侧的类型安全，也无缝融入前端运行时环境。

额外细节：
- 消息会经过简单的 `sanitize` 处理，移除不可见控制字符，避免污染输出或引发终端异常。
- 提供若干便捷函数（`debug/info/...`）与上下文插值（`log_with_context`），提升可读性与开发体验。
*/
// 通过 localStorage 键控制：
// - `rue.logs.enabled`：是否启用日志（true/false/1/0 等）
// - `rue.logs.level`：最低输出级别（debug/info/notice/warning/error/critical/alert/emergency）
// - `rue.logs.verboseDebug`：是否放开普通 debug 日志；对高频内部生命周期日志仍需配合 include 精确点名
// 支持包含/排除关键字过滤，并可选择是否输出到控制台。
use js_sys::Reflect;
use wasm_bindgen::JsCast;
use wasm_bindgen::JsValue;

thread_local! {
    // 是否启用日志（默认关闭，受 localStorage 同步影响）
    static LOG_ENABLED: std::cell::RefCell<bool> = std::cell::RefCell::new(false);
    // 是否输出到 console（默认 true）
    static LOG_CONSOLE: std::cell::RefCell<bool> = std::cell::RefCell::new(true);
    // 最低输出级别（数字越大级别越高）；默认 0=debug
    static LOG_LEVEL: std::cell::RefCell<u8> = std::cell::RefCell::new(0);
    // 是否输出普通 debug 日志；高频内部生命周期日志仍需 include 精确点名
    static LOG_VERBOSE_DEBUG: std::cell::RefCell<bool> = std::cell::RefCell::new(false);
    // 包含过滤：若非空，则仅当消息包含任一关键字时才输出
    static LOG_INCLUDE: std::cell::RefCell<Vec<String>> = std::cell::RefCell::new(Vec::new());
    // 排除过滤：若消息包含其中任意关键字，则不输出
    static LOG_EXCLUDE: std::cell::RefCell<Vec<String>> = std::cell::RefCell::new(Vec::new());
    // localStorage 配置刷新计数。日志探测可能位于极热路径，不能每次都跨 Wasm/JS 读宿主配置。
    static LOG_SYNC_PROBE_COUNT: std::cell::Cell<u32> = const { std::cell::Cell::new(0) };
}

const LOG_CONFIG_SYNC_INTERVAL: u32 = 10024;

const NOISY_DEBUG_PREFIXES: &[&str] = &[
    "reactive:scope create",
    "reactive:scope push",
    "reactive:scope pop",
    "reactive:effect create",
    "reactive:effect run start",
    "reactive:effect run end",
    "runtime:createRue adapter_is_object=",
    "runtime:createRue done",
    "runtime:setDOMAdapter is_object=",
    "runtime:use",
    "runtime:mount has_app_fn=",
    "runtime:mount pre_flush deferred_queue_len=",
    "runtime:mount app return type",
    "runtime:render has_input_value=",
    "runtime:render enter",
    "runtime:render exit",
    "runtime:createElement type_tag=",
    "runtime:createElement function_component",
    "runtime:createElement mount_input_build",
    "runtime:createElement tag_resolved",
    "runtime:createElement id=",
    "runtime:createElement id_info",
    "dom-adapter audit ok",
    "runtime:renderAnchor anchor_map hit",
    "runtime:renderAnchor anchor_map miss",
    "runtime:vapor",
    "reactive:schedule queued id=",
    "reactive:schedule default_frame id=",
    "reactive:schedule default_microtask id=",
];

fn is_noisy_debug_message(msg: &str) -> bool {
    NOISY_DEBUG_PREFIXES.iter().any(|prefix| msg.starts_with(prefix))
}

/// 级别名称映射为数值，便于比较
fn level_to_num(level: &str) -> u8 {
    match level {
        "debug" => 0,
        "info" => 1,
        "notice" => 2,
        "warning" => 3,
        "error" => 4,
        "critical" => 5,
        "alert" => 6,
        "emergency" => 7,
        _ => 0,
    }
}

fn is_node_localstorage_accessor(global: &JsValue) -> bool {
    let process = Reflect::get(global, &JsValue::from_str("process")).ok();
    let versions =
        process.as_ref().and_then(|value| Reflect::get(value, &JsValue::from_str("versions")).ok());
    let node_version =
        versions.as_ref().and_then(|value| Reflect::get(value, &JsValue::from_str("node")).ok());

    if node_version.and_then(|value| value.as_string()).is_none() {
        return false;
    }

    let Some(global_obj) = global.dyn_ref::<js_sys::Object>() else {
        return false;
    };
    let descriptor =
        js_sys::Object::get_own_property_descriptor(global_obj, &JsValue::from_str("localStorage"));
    if descriptor.is_undefined() {
        return false;
    }

    Reflect::get(&descriptor, &JsValue::from_str("get"))
        .map(|getter| getter.is_function())
        .unwrap_or(false)
}

/// 读取 localStorage 某键的字符串值
fn read_localstorage_value(key: &str) -> Option<String> {
    let global = js_sys::global();
    if is_node_localstorage_accessor(&global) {
        return None;
    }

    let ls = js_sys::Reflect::get(&global, &JsValue::from_str("localStorage")).ok()?;
    if ls.is_undefined() {
        return None;
    }
    let get_item = js_sys::Reflect::get(&ls, &JsValue::from_str("getItem")).ok()?;
    if let Some(f) = get_item.dyn_ref::<js_sys::Function>() {
        let res = f.call1(&ls, &JsValue::from_str(key)).ok()?;
        res.as_string()
    } else {
        None
    }
}

/// 宽松解析布尔值字符串
fn parse_bool(s: &str) -> Option<bool> {
    let v = s.trim().to_ascii_lowercase();
    match v.as_str() {
        "1" | "true" | "yes" | "on" => Some(true),
        "0" | "false" | "no" | "off" => Some(false),
        _ => None,
    }
}

/// 同步日志配置：从 localStorage 读取并更新启用状态与级别
fn sync_log_config_from_localstorage() {
    let should_sync = LOG_SYNC_PROBE_COUNT.with(|count| {
        let current = count.get();
        count.set(current.wrapping_add(1));
        current == 0 || current % LOG_CONFIG_SYNC_INTERVAL == 0
    });
    if !should_sync {
        return;
    }

    if let Some(enabled_str) = read_localstorage_value("rue.logs.enabled") {
        if let Some(b) = parse_bool(&enabled_str) {
            LOG_ENABLED.with(|e| *e.borrow_mut() = b);
        }
    }
    if let Some(level_str) = read_localstorage_value("rue.logs.level") {
        let num = level_to_num(&level_str.trim().to_ascii_lowercase());
        LOG_LEVEL.with(|l| *l.borrow_mut() = num);
    }
    if let Some(verbose_debug_str) = read_localstorage_value("rue.logs.verboseDebug") {
        if let Some(b) = parse_bool(&verbose_debug_str) {
            LOG_VERBOSE_DEBUG.with(|v| *v.borrow_mut() = b);
        }
    }
    if let Some(include_str) = read_localstorage_value("rue.logs.include") {
        let parts = include_str
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect::<Vec<_>>();
        LOG_INCLUDE.with(|f| {
            let mut v = f.borrow_mut();
            *v = parts;
        });
    }
    if let Some(exclude_str) = read_localstorage_value("rue.logs.exclude") {
        let parts = exclude_str
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect::<Vec<_>>();
        LOG_EXCLUDE.with(|f| {
            let mut v = f.borrow_mut();
            *v = parts;
        });
    }
}

/// 判断消息是否应被输出：考虑启用状态、级别阈值、包含/排除过滤
fn should_log(level: u8, msg: &str) -> bool {
    sync_log_config_from_localstorage();
    let enabled = LOG_ENABLED.with(|e| *e.borrow());
    if !enabled {
        return false;
    }
    let min = LOG_LEVEL.with(|l| *l.borrow());
    if level < min {
        return false;
    }
    let includes = LOG_INCLUDE.with(|f| f.borrow().clone());
    let include_match =
        if includes.is_empty() { false } else { includes.iter().any(|s| msg.contains(s)) };
    if !includes.is_empty() {
        if !include_match {
            return false;
        }
    }
    if level == level_to_num("debug") && !include_match && is_noisy_debug_message(msg) {
        return false;
    }
    let excludes = LOG_EXCLUDE.with(|f| f.borrow().clone());
    for s in &excludes {
        if msg.contains(s) {
            return false;
        }
    }
    true
}

/// 文本插值：用 `context` 对象中的键替换形如 `{key}` 的占位符
fn interpolate(mut message: String, context: JsValue) -> String {
    if !context.is_object() {
        return message;
    }
    let obj: js_sys::Object = context.unchecked_into();
    let keys = js_sys::Object::keys(&obj);
    for i in 0..keys.length() {
        let k = keys.get(i);
        let key = k.as_string().unwrap_or_default();
        if key.is_empty() {
            continue;
        }
        let val = Reflect::get(&obj, &JsValue::from_str(&key)).unwrap_or(JsValue::UNDEFINED);
        let s = if let Some(st) = val.as_string() {
            st
        } else {
            match js_sys::JSON::stringify(&val) {
                Ok(jsstr) => {
                    let v: JsValue = jsstr.into();
                    v.as_string().unwrap_or_default()
                }
                Err(_) => String::new(),
            }
        };
        let ph = format!("{{{}}}", key);
        message = message.replace(&ph, &s);
    }
    message
}

#[allow(dead_code)]
pub fn set_log_enabled(enabled: bool) {
    LOG_ENABLED.with(|e| *e.borrow_mut() = enabled);
}

#[allow(dead_code)]
pub fn set_log_console(enabled: bool) {
    LOG_CONSOLE.with(|c| *c.borrow_mut() = enabled);
}

#[allow(dead_code)]
pub fn set_log_level(level: &str) {
    let v = level_to_num(level);
    LOG_LEVEL.with(|l| *l.borrow_mut() = v);
}

#[allow(dead_code)]
pub fn add_log_include(filter: &str) {
    LOG_INCLUDE.with(|f| f.borrow_mut().push(filter.to_string()));
}

#[allow(dead_code)]
pub fn clear_log_include() {
    LOG_INCLUDE.with(|f| f.borrow_mut().clear());
}

#[allow(dead_code)]
pub fn add_log_exclude(filter: &str) {
    LOG_EXCLUDE.with(|f| f.borrow_mut().push(filter.to_string()));
}

#[allow(dead_code)]
pub fn clear_log_exclude() {
    LOG_EXCLUDE.with(|f| f.borrow_mut().clear());
}

/// 实际写入日志：按规则检查后输出到 console
fn write(level: &str, msg: &str) {
    let lv = level_to_num(level);
    if !should_log(lv, msg) {
        return;
    }
    // 规范化输出文本：移除不可见控制字符（保留换行/回车/制表）
    fn sanitize(input: &str) -> String {
        input
            .chars()
            .map(|c| if c.is_control() && c != '\n' && c != '\r' && c != '\t' { ' ' } else { c })
            .collect()
    }
    let ts = js_sys::Date::new_0().to_iso_string().as_string().unwrap_or_default();
    let entry = sanitize(&format!("{} [{}] {}", ts, level, msg));
    let global = js_sys::global();
    let to_console = LOG_CONSOLE.with(|c| *c.borrow());
    if to_console {
        let console = js_sys::Reflect::get(&global, &JsValue::from_str("console"))
            .unwrap_or(JsValue::UNDEFINED);
        let logf =
            js_sys::Reflect::get(&console, &JsValue::from_str("log")).unwrap_or(JsValue::UNDEFINED);
        if let Some(f) = logf.dyn_ref::<js_sys::Function>() {
            let _ = f.call1(&console, &JsValue::from_str(&entry));
        }
    }
}

/// 通用日志入口
#[allow(dead_code)]
pub fn log(level: &str, msg: &str) {
    write(level, msg);
}

/// 带上下文插值的日志入口
#[allow(dead_code)]
pub fn log_with_context(level: &str, msg: &str, context: JsValue) {
    let interpolated = interpolate(msg.to_string(), context);
    write(level, &interpolated);
}

/// debug 级别输出
#[allow(dead_code)]
pub fn debug(msg: &str) {
    write("debug", msg);
}

/// info 级别输出
#[allow(dead_code)]
pub fn info(msg: &str) {
    write("info", msg);
}

/// notice 级别输出
#[allow(dead_code)]
pub fn notice(msg: &str) {
    write("notice", msg);
}

/// warning 级别输出
#[allow(dead_code)]
pub fn warning(msg: &str) {
    write("warning", msg);
}

/// error 级别输出
#[allow(dead_code)]
pub fn error(msg: &str) {
    write("error", msg);
}

/// critical 级别输出
#[allow(dead_code)]
pub fn critical(msg: &str) {
    write("critical", msg);
}

/// alert 级别输出
#[allow(dead_code)]
pub fn alert(msg: &str) {
    write("alert", msg);
}

/// emergency 级别输出
#[allow(dead_code)]
pub fn emergency(msg: &str) {
    write("emergency", msg);
}

#[allow(dead_code)]
pub fn log_js(label: &str, values: &[JsValue]) {
    let global = js_sys::global();
    let to_console = LOG_CONSOLE.with(|c| *c.borrow());
    if !to_console {
        return;
    }
    let console =
        js_sys::Reflect::get(&global, &JsValue::from_str("console")).unwrap_or(JsValue::UNDEFINED);
    let logf =
        js_sys::Reflect::get(&console, &JsValue::from_str("log")).unwrap_or(JsValue::UNDEFINED);
    if let Some(f) = logf.dyn_ref::<js_sys::Function>() {
        let args = js_sys::Array::new();
        args.push(&JsValue::from_str(label));
        for v in values {
            args.push(v);
        }
        let _ = f.apply(&console, &args);
    }
}

#[allow(dead_code)]
pub fn log_js_value(label: &str, value: &JsValue) {
    log_js(label, std::slice::from_ref(value));
}

#[allow(dead_code)]
pub fn log_js_label(label: &str) {
    log_js(label, &[]);
}

#[allow(dead_code)]
pub fn want_log(level: &str, hint: &str) -> bool {
    let lv = level_to_num(level);
    should_log(lv, hint)
}

#[cfg(test)]
mod tests {
    use super::*;
    use js_sys::{Function, Object, Reflect};
    use wasm_bindgen::JsCast;
    use wasm_bindgen::JsValue;
    use wasm_bindgen_test::*;

    fn reset_log_state_for_test() {
        set_log_enabled(false);
        set_log_console(false);
        set_log_level("debug");
        clear_log_include();
        clear_log_exclude();
        LOG_VERBOSE_DEBUG.with(|value| *value.borrow_mut() = false);
        LOG_SYNC_PROBE_COUNT.with(|count| count.set(0));
    }

    fn clear_fake_local_storage() {
        let global = js_sys::global();
        let _ = Reflect::delete_property(&global, &JsValue::from_str("localStorage"));
        for key in [
            "__rue_test_log_enabled",
            "__rue_test_log_level",
            "__rue_test_log_verbose",
            "__rue_test_log_include",
            "__rue_test_log_exclude",
            "__rue_test_log_get_item_calls",
        ] {
            let _ = Reflect::delete_property(&global, &JsValue::from_str(key));
        }
    }

    fn install_fake_local_storage() {
        clear_fake_local_storage();

        let storage = Object::new();
        let get_item = Function::new_with_args(
            "key",
            r#"
globalThis.__rue_test_log_get_item_calls =
  (globalThis.__rue_test_log_get_item_calls || 0) + 1;
switch (key) {
  case 'rue.logs.enabled':
    return globalThis.__rue_test_log_enabled ?? null;
  case 'rue.logs.level':
    return globalThis.__rue_test_log_level ?? null;
  case 'rue.logs.verboseDebug':
    return globalThis.__rue_test_log_verbose ?? null;
  case 'rue.logs.include':
    return globalThis.__rue_test_log_include ?? null;
  case 'rue.logs.exclude':
    return globalThis.__rue_test_log_exclude ?? null;
  default:
    return null;
}
"#,
        );
        Reflect::set(&storage, &JsValue::from_str("getItem"), &get_item.into()).unwrap();

        let descriptor = Object::new();
        Reflect::set(&descriptor, &JsValue::from_str("value"), &storage).unwrap();
        Reflect::set(&descriptor, &JsValue::from_str("configurable"), &JsValue::TRUE).unwrap();
        let global = js_sys::global();
        let global_obj = global.dyn_ref::<Object>().expect("global should be an object");
        Object::define_property(global_obj, &JsValue::from_str("localStorage"), &descriptor);
    }

    fn set_fake_storage_value(name: &str, value: &str) {
        Reflect::set(&js_sys::global(), &JsValue::from_str(name), &JsValue::from_str(value))
            .unwrap();
    }

    fn fake_storage_get_item_calls() -> u32 {
        Reflect::get(&js_sys::global(), &JsValue::from_str("__rue_test_log_get_item_calls"))
            .unwrap_or(JsValue::UNDEFINED)
            .as_f64()
            .unwrap_or(0.0) as u32
    }

    #[wasm_bindgen_test]
    fn localstorage_sync_is_throttled_to_first_probe_and_configured_interval() {
        assert_eq!(LOG_CONFIG_SYNC_INTERVAL, 10024);
        reset_log_state_for_test();
        install_fake_local_storage();
        set_fake_storage_value("__rue_test_log_enabled", "true");
        set_fake_storage_value("__rue_test_log_level", "debug");
        set_fake_storage_value("__rue_test_log_verbose", "false");
        set_fake_storage_value("__rue_test_log_include", "throttle-target");
        set_fake_storage_value("__rue_test_log_exclude", "");

        assert!(want_log("warning", "throttle-target"));
        assert_eq!(fake_storage_get_item_calls(), 5);

        set_fake_storage_value("__rue_test_log_enabled", "false");
        for _ in 1..LOG_CONFIG_SYNC_INTERVAL {
            assert!(want_log("warning", "throttle-target"));
        }
        assert_eq!(fake_storage_get_item_calls(), 5);
        assert_eq!(LOG_SYNC_PROBE_COUNT.with(|count| count.get()), LOG_CONFIG_SYNC_INTERVAL);

        assert!(!want_log("warning", "throttle-target"));
        assert_eq!(fake_storage_get_item_calls(), 10);
        assert_eq!(LOG_SYNC_PROBE_COUNT.with(|count| count.get()), LOG_CONFIG_SYNC_INTERVAL + 1);

        clear_fake_local_storage();
    }

    #[wasm_bindgen_test]
    fn localstorage_sync_counter_wraps_then_resyncs_on_zero() {
        assert_ne!(u32::MAX % LOG_CONFIG_SYNC_INTERVAL, 0);
        reset_log_state_for_test();
        install_fake_local_storage();
        set_fake_storage_value("__rue_test_log_enabled", "true");
        set_fake_storage_value("__rue_test_log_level", "debug");
        set_fake_storage_value("__rue_test_log_verbose", "false");
        set_fake_storage_value("__rue_test_log_include", "wrap-target");
        set_fake_storage_value("__rue_test_log_exclude", "");
        LOG_SYNC_PROBE_COUNT.with(|count| count.set(u32::MAX));

        assert!(!want_log("warning", "wrap-target"));
        assert_eq!(fake_storage_get_item_calls(), 0);
        assert_eq!(LOG_SYNC_PROBE_COUNT.with(|count| count.get()), 0);

        assert!(want_log("warning", "wrap-target"));
        assert_eq!(fake_storage_get_item_calls(), 5);
        assert_eq!(LOG_SYNC_PROBE_COUNT.with(|count| count.get()), 1);

        clear_fake_local_storage();
    }
}
