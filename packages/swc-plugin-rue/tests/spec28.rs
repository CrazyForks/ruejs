//! SWC 插件转换行为测试（spec28）
//!
//! 覆盖：此用例的转换快照对比。
use swc_plugin_rue::apply_pre;

mod utils;

#[test]
fn transforms_spec28() {
    let src = r##"
import { type FC, ref } from '@rue-js/rue'

const Chain: FC = () => {
  const a = ref(true);
  const b = ref(false);
  const c = ref(false);
  const d = ref(false);
  return (
    <div>
      <div v-if={a}>A</div>
      <div v-else-if={b}>B</div>
      <div v-else-if={c}>C</div>
      <div v-else-if={d}>D</div>
      <div v-else>Else</div>
    </div>
  )
}

export default Chain
"##;
    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply_pre(program);
    let out = utils::emit(program, cm);

    let _expected_fragment = r##"import { ref, _$compiledWithHookId, useSetup } from "@rue-js/rue/internal";
import { type FC } from '@rue-js/rue';
const Chain: FC = ()=>{
    const _$useSetup = _$compiledWithHookId("useSetup:0:0", ()=>useSetup(()=>{
            const a = ref(true);
            const b = ref(false);
            const c = ref(false);
            const d = ref(false);
            return {
                a: a,
                b: b,
                c: c,
                d: d
            };
        }));
    const { a: a, b: b, c: c, d: d } = _$useSetup;
    return (<div>
      {a ? <div>A</div> : b ? <div>B</div> : c ? <div>C</div> : d ? <div>D</div> : <div>Else</div>}</div>);
};
export default Chain;
"##;

    use utils::{normalize, strip_marker};
    std::fs::create_dir_all("target/vapor_outputs").ok();
    std::fs::write("target/vapor_outputs/spec28.out.js", strip_marker(&out)).ok();
    let normalized = normalize(&strip_marker(&out));
    assert!(normalized.contains("_$compiledSetup(\"useSetup:0:0\""), "{normalized}");
    assert!(normalized.contains("a ? <div>A</div> : b ? <div>B</div>"), "{normalized}");
    assert!(normalized.contains(": d ? <div>D</div> : <div>Else</div>"), "{normalized}");
}
