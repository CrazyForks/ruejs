//! SWC plugin pre-transform tests for async component setup boundaries.
use swc_plugin_rue::apply_pre;

mod utils;

#[test]
fn keeps_await_statements_inside_async_components() {
    let src = r##"
async function SlowContent() {
  await new Promise((resolve) => setTimeout(resolve, 500))
  return <p id="streamed-content">Streamed content loaded</p>
}
"##;
    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply_pre(program);
    let out = utils::emit(program, cm);

    let normalized = utils::normalize(&utils::strip_marker(&out));
    assert!(normalized.contains("async function SlowContent() { await new Promise"));
    assert!(!normalized.contains("useSetup(()=>{ await"));
}

#[test]
fn treats_await_variable_declarations_as_setup_boundaries() {
    let src = r##"
import { cacheLife } from "next/cache"
import { cookies } from "next/headers"

async function PrivateCookie() {
  "use cache: private"
  cacheLife({ stale: 420 })
  const cookie = (await cookies()).get("test-cookie")
  return <span>{cookie?.value ?? "<empty>"}</span>
}
"##;
    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply_pre(program);
    let out = utils::emit(program, cm);

    let normalized = utils::normalize(&utils::strip_marker(&out));
    assert!(normalized.contains("const cookie = (await cookies()).get(\"test-cookie\");"));
    assert!(!normalized.contains("useSetup(()=>{ \"use cache: private\"; cacheLife({ stale: 420 }); const cookie = (await cookies()).get"));
}
