use super::*;
use std::sync::{Mutex, OnceLock};

fn env_lock() -> &'static Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
}

fn clean_env() {
    for key in [
        "RUE_LOG_ENABLED",
        "RUE_LOGS_ENABLED",
        "RUE_LOG_LEVEL",
        "RUE_LOGS_LEVEL",
        "RUE_LOG_INCLUDE",
        "RUE_LOG_EXCLUDE",
        "RUE_LOG_FILE",
    ] {
        std::env::remove_var(key);
    }
    reset_for_test();
}

#[test]
fn env_config_drives_logging() {
    let _guard = env_lock().lock().expect("env lock");
    clean_env();
    std::env::set_var("RUE_LOG_ENABLED", "true");
    std::env::set_var("RUE_LOG_LEVEL", "info");
    std::env::remove_var("RUE_LOG_INCLUDE");
    std::env::remove_var("RUE_LOG_EXCLUDE");
    clear_log_include();
    clear_log_exclude();
    let path = "target/test_log_env.txt";
    std::fs::create_dir_all("target").ok();
    std::fs::remove_file(path).ok();
    set_log_console(false);
    set_log_file(path);
    info("hello env");
    let s = std::fs::read_to_string(path).expect("file");
    assert!(s.contains("[info]"));
    assert!(s.contains("hello env"));
}

#[test]
fn timestamp_helper_clamps_pre_epoch_times() {
    assert_eq!(unix_timestamp_secs(std::time::UNIX_EPOCH), "0");
    assert_eq!(unix_timestamp_secs(std::time::UNIX_EPOCH - std::time::Duration::from_secs(1)), "0");
}

#[test]
fn include_exclude_filters() {
    let _guard = env_lock().lock().expect("env lock");
    clean_env();
    std::env::set_var("RUE_LOG_ENABLED", "true");
    std::env::set_var("RUE_LOG_LEVEL", "debug");
    let path = "target/test_log_filters.txt";
    std::fs::remove_file(path).ok();
    set_log_console(false);
    set_log_file(path);

    std::env::set_var("RUE_LOG_INCLUDE", "only");
    info("hello");
    info("only match");
    let s = std::fs::read_to_string(path).expect("file");
    assert!(s.contains("only match"));
    assert!(!s.contains("hello\n"));

    std::env::set_var("RUE_LOG_INCLUDE", "");
    std::env::set_var("RUE_LOG_EXCLUDE", "ban");
    info("ban content");
    info("ok content");
    let s2 = std::fs::read_to_string(path).expect("file");
    assert!(s2.contains("ok content"));
    assert!(!s2.contains("ban content"));
}

#[test]
fn setters_and_level_wrappers_control_output() {
    let _guard = env_lock().lock().expect("env lock");
    clean_env();

    let path = "target/test_log_levels.txt";
    std::fs::remove_file(path).ok();
    set_log_file(path);
    set_log_enabled(true);
    set_log_level("warning");

    debug("debug skipped");
    info("info skipped");
    notice("notice skipped");
    warning("warning kept");
    error("error kept");
    critical("critical kept");
    alert("alert kept");
    emergency("emergency kept");
    log("unknown", "unknown level uses debug priority");

    let s = std::fs::read_to_string(path).expect("file");
    assert!(!s.contains("debug skipped"));
    assert!(!s.contains("info skipped"));
    assert!(!s.contains("notice skipped"));
    assert!(!s.contains("unknown level uses debug priority"));
    for msg in ["warning kept", "error kept", "critical kept", "alert kept", "emergency kept"] {
        assert!(s.contains(msg), "expected {msg} in {s}");
    }
}

#[test]
fn disabled_and_filter_misses_do_not_create_log_file() {
    let _guard = env_lock().lock().expect("env lock");
    clean_env();

    let disabled_path = "target/test_log_disabled.txt";
    std::fs::remove_file(disabled_path).ok();
    set_log_file(disabled_path);
    set_log_enabled(false);
    error("should not be written");
    assert!(std::fs::read_to_string(disabled_path).is_err());

    let filtered_path = "target/test_log_filtered_out.txt";
    std::fs::remove_file(filtered_path).ok();
    set_log_file(filtered_path);
    set_log_enabled(true);
    set_log_level("debug");
    add_log_include("needle");
    info("haystack only");
    assert!(std::fs::read_to_string(filtered_path).is_err());
}

#[test]
fn pair_interpolation_sanitizes_control_chars_and_preserves_unmatched_placeholders() {
    let _guard = env_lock().lock().expect("env lock");
    clean_env();

    let path = "target/test_log_pairs.txt";
    std::fs::remove_file(path).ok();
    set_log_file(path);
    set_log_enabled(true);
    set_log_level("debug");

    log_with_pairs(
        "info",
        "phase={phase} file={file} keep={missing} bad=\u{7}",
        &[("phase", "pre"), ("file", "a.tsx")],
    );

    let s = std::fs::read_to_string(path).expect("file");
    assert!(s.contains("[info] phase=pre file=a.tsx keep={missing} bad= "));
    assert!(!s.contains('\u{7}'));
}

#[test]
fn api_touched_filters_take_priority_over_env_filters() {
    let _guard = env_lock().lock().expect("env lock");
    clean_env();

    let path = "target/test_log_filter_priority.txt";
    std::fs::remove_file(path).ok();
    std::env::set_var("RUE_LOG_ENABLED", "true");
    std::env::set_var("RUE_LOG_LEVEL", "debug");
    std::env::set_var("RUE_LOG_INCLUDE", "env-only");
    set_log_file(path);
    add_log_include("api-only");

    info("env-only message");
    info("api-only message");

    let s = std::fs::read_to_string(path).expect("file");
    assert!(!s.contains("env-only message"));
    assert!(s.contains("api-only message"));
}

#[test]
fn api_exclude_console_localstorage_and_file_fallback_paths() {
    let _guard = env_lock().lock().expect("env lock");
    clean_env();

    assert_eq!(read_localstorage_value("rue-log-enabled"), None);

    let path = "target/test_log_api_exclude_console.txt";
    std::fs::create_dir_all("target").ok();
    std::fs::remove_file(path).ok();
    set_log_file(path);
    set_log_enabled(true);
    set_log_console(true);
    set_log_level("debug");
    add_log_exclude("skip");

    info("skip this api message");
    info("keep this api message");

    let s = std::fs::read_to_string(path).expect("file");
    assert!(!s.contains("skip this api message"));
    assert!(s.contains("keep this api message"));

    set_log_file("target");
    error("exercise fallback write failure path");

    set_log_file("target/test_log_invalid\0path.txt");
    error("exercise fallback write invalid path branch");
}

#[test]
fn env_aliases_and_invalid_bool_values_are_handled() {
    let _guard = env_lock().lock().expect("env lock");
    clean_env();

    for false_value in ["0", "false", "no", "off"] {
        assert_eq!(parse_bool(false_value), Some(false));
    }
    assert_eq!(parse_bool("definitely"), None);

    let path = "target/test_log_env_aliases.txt";
    std::fs::remove_file(path).ok();
    std::env::set_var("RUE_LOGS_ENABLED", "yes");
    std::env::set_var("RUE_LOGS_LEVEL", "error");
    std::env::set_var("RUE_LOG_EXCLUDE", "skip");
    set_log_file(path);

    warning("below threshold");
    error("skip this error");
    error("kept error");

    let s = std::fs::read_to_string(path).expect("file");
    assert!(!s.contains("below threshold"));
    assert!(!s.contains("skip this error"));
    assert!(s.contains("kept error"));

    clean_env();
    let invalid_path = "target/test_log_invalid_bool.txt";
    std::fs::remove_file(invalid_path).ok();
    std::env::set_var("RUE_LOG_ENABLED", "maybe");
    set_log_file(invalid_path);
    set_log_level("debug");
    info("not enabled by invalid bool");
    assert!(std::fs::read_to_string(invalid_path).is_err());
}
