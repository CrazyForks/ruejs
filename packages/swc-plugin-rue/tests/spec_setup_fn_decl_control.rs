//! SWC 插件转换行为测试（spec_setup_fn_decl_control）
//!
//! 覆盖：此用例的转换快照对比。
use swc_plugin_rue::apply_pre;

mod utils;

#[test]
fn skips_vars_after_first_control_in_fn_decl() {
    let src = r##"
import { ref } from '@rue-js/rue'

function Comp(): JSX.Element {
  const a = ref(0)
  function before() { return a.value }
  if (a.value > 0) {
    const b = ref(1)
    console.log(b.value)
  }
  const c = ref(2)
  function after() { return c.value }
  return <div>{before()}-{c.value}</div>
}
"##;
    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply_pre(program);
    let out = utils::emit(program, cm);

    let expected_fragment = r##"import { ref, _$compiledWithHookId, useSetup } from "@rue-js/rue/internal";

function Comp(): JSX.Element {
    const _$useSetup = _$compiledWithHookId("useSetup:0:0", ()=>useSetup(()=>{
        const a = ref(0);
        function before() {
            return a.value;
        }
        if (a.value > 0) {
            const b = _$compiledWithHookId("ref:1.2:1", ()=>ref(1));
            console.log(b.value);
        }
        const c = ref(2);
        function after() {
            return c.value;
        }
        return {
            a: a,
            before: before,
            c: c,
            after: after
        };
    }));
    const { a: a, before: before, c: c, after: after } = _$useSetup;
    return <div>{before()}-{c.value}</div>;
}
"##;

    use utils::{normalize_setup_snapshot, strip_marker};
    std::fs::create_dir_all("target/vapor_outputs").ok();
    std::fs::write("target/vapor_outputs/spec_on_setup_fn_decl_control.out.js", strip_marker(&out))
        .ok();
    assert_eq!(
        normalize_setup_snapshot(&strip_marker(&out)),
        normalize_setup_snapshot(&strip_marker(expected_fragment))
    );
}
