use std::env;
use std::fs;
use std::path::PathBuf;

fn main() {
    println!("cargo:rustc-check-cfg=cfg(wasm_bindgen_unstable_test_coverage)");
    println!("cargo:rerun-if-env-changed=CARGO_CFG_WASM_BINDGEN_UNSTABLE_TEST_COVERAGE");
    println!("cargo:rerun-if-env-changed=CARGO_ENCODED_RUSTFLAGS");

    if env::var("CARGO_CFG_TARGET_ARCH").as_deref() != Ok("wasm32") {
        return;
    }

    if env::var_os("CARGO_FEATURE_WASM_COVERAGE").is_none() {
        return;
    }

    let out_dir = PathBuf::from(env::var_os("OUT_DIR").expect("OUT_DIR is set by Cargo"));
    let source_path = out_dir.join("llvm_profile_runtime.c");
    let object_path = out_dir.join("llvm_profile_runtime.o");
    fs::write(&source_path, "__attribute__((weak)) unsigned char __llvm_profile_runtime = 0;\n")
        .expect("write llvm_profile_runtime.c");

    let compiler = cc::Build::new().get_compiler();
    let mut command = compiler.to_command();
    let status = command
        .arg("-c")
        .arg(&source_path)
        .arg("-o")
        .arg(&object_path)
        .status()
        .expect("compile llvm_profile_runtime.c");
    assert!(status.success(), "failed to compile llvm_profile_runtime.c");

    println!("cargo:rustc-link-arg={}", object_path.display());
}
