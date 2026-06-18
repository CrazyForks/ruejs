//! SWC 插件转换行为测试（spec_setup_complex_deps_chain）
//!
//! 覆盖：此用例的转换快照对比。
use swc_plugin_rue::apply_pre;

mod utils;

#[test]
fn collects_dependency_chain_and_skips_after_control() {
    let src = r##"
import { type FC, ref } from '@rue-js/rue'

const Comp: FC = () => {
  const a = ref(1)
  const b = a.value + 1
  const c = b + a.value
  function log() {
    console.log(a.value, b, c)
  }
  if (a.value > 0) {
    const d = a.value + c
  }
  return <div>{c}</div>
}
"##;
    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply_pre(program);
    let out = utils::emit(program, cm);

    let expected_fragment = r##"import { ref, computed, _$vaporWithHookId, useSetup } from "@rue-js/rue/vapor";
import { type FC } from '@rue-js/rue';
const Comp: FC = ()=>{
    const _$useSetup = _$vaporWithHookId("useSetup:0:0", ()=>useSetup(()=>{
            const a = _$vaporWithHookId("ref:1:0", ()=>ref(1));
            const b = _$vaporWithHookId("computed:1:1", ()=>computed(()=>a.value + 1));
            const __rue_phase2_b = b;
            const c = _$vaporWithHookId("computed:1:2", ()=>computed(()=>__rue_phase2_b.get() + a.value));
            const __rue_phase2_c = c;
            function log() {
                console.log(a.value, __rue_phase2_b.get(), __rue_phase2_c.get());
            }
            if (a.value > 0) {
                const d = a.value + __rue_phase2_c.get();
            }
            return {
                a: a,
                b: b,
                c: c,
                log: log
            };
        }));
    const { a: a, b: b, c: c, log: log } = _$useSetup;
    return <div>{c.get()}</div>;
};
"##;

    use utils::{normalize, strip_marker};
    std::fs::create_dir_all("target/vapor_outputs").ok();
    std::fs::write(
        "target/vapor_outputs/spec_on_setup_complex_deps_chain.out.js",
        strip_marker(&out),
    )
    .ok();
    assert_eq!(normalize(&strip_marker(&out)), normalize(&strip_marker(expected_fragment)));
}
