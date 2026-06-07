use std::env;
use std::fs;
use std::path::Path;

fn main() {
    println!("cargo:rerun-if-changed=dist/ssr-entry.js");
    println!("cargo:rerun-if-changed=dist/client.js");
    println!("cargo:rerun-if-changed=dist/client.js.gz");
    println!("cargo:rerun-if-changed=src/app.tsx");
    println!("cargo:rerun-if-changed=src/client.tsx");
    println!("cargo:rerun-if-changed=src/CounterApp.tsx");
    println!("cargo:rerun-if-changed=vite.config.mjs");

    let out_dir = env::var("OUT_DIR").expect("OUT_DIR is set by Cargo");
    copy_generated(
        Path::new("dist/ssr-entry.js"),
        &Path::new(&out_dir).join("ssr-entry.js"),
        r#"
throw new Error(
  "Missing dist/ssr-entry.js. Run `pnpm --filter @rue-js/ssr-binary-demo build:ssr` before cargo build."
);
"#,
    );
    copy_generated(
        Path::new("dist/client.js"),
        &Path::new(&out_dir).join("client.js"),
        r#"
console.warn("Missing dist/client.js. Run `pnpm --filter @rue-js/ssr-binary-demo build:client` to enable client interactivity.");
"#,
    );
    copy_generated_bytes(
        Path::new("dist/client.js.gz"),
        &Path::new(&out_dir).join("client.js.gz"),
        b"",
    );
}

fn copy_generated(source_path: &Path, generated_path: &Path, fallback: &str) {
    let source = fs::read_to_string(source_path).unwrap_or_else(|_| fallback.to_string());

    fs::write(generated_path, source).expect("write generated bundle");
}

fn copy_generated_bytes(source_path: &Path, generated_path: &Path, fallback: &[u8]) {
    let source = fs::read(source_path).unwrap_or_else(|_| fallback.to_vec());

    fs::write(generated_path, source).expect("write generated binary bundle");
}
