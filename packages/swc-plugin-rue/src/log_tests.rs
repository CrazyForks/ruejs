use super::*;
fn reset_log_state() {
    reset_for_test();
}

#[test]
fn default_config_drives_logging() {
    reset_log_state();
    clear_log_include();
    clear_log_exclude();
    let path = "target/test_log_env.txt";
    std::fs::create_dir_all("target").ok();
    std::fs::remove_file(path).ok();
    set_log_console(false);
    set_log_file(path);
    set_log_level("info");
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
    reset_log_state();
    let path = "target/test_log_filters.txt";
    std::fs::remove_file(path).ok();
    set_log_console(false);
    set_log_file(path);
    set_log_level("debug");

    add_log_include("only");
    info("hello");
    info("only match");
    let s = std::fs::read_to_string(path).expect("file");
    assert!(s.contains("only match"));
    assert!(!s.contains("hello\n"));

    clear_log_include();
    add_log_exclude("ban");
    info("ban content");
    info("ok content");
    let s2 = std::fs::read_to_string(path).expect("file");
    assert!(s2.contains("ok content"));
    assert!(!s2.contains("ban content"));
}

#[test]
fn setters_and_level_wrappers_control_output() {
    reset_log_state();

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
    reset_log_state();

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
    reset_log_state();

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
fn api_filters_control_output() {
    reset_log_state();

    let path = "target/test_log_api_filters.txt";
    std::fs::remove_file(path).ok();
    set_log_file(path);
    set_log_level("debug");
    add_log_include("api-only");

    info("other message");
    info("api-only message");

    let s = std::fs::read_to_string(path).expect("file");
    assert!(!s.contains("other message"));
    assert!(s.contains("api-only message"));
}

#[test]
fn api_exclude_console_localstorage_and_file_fallback_paths() {
    reset_log_state();

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
