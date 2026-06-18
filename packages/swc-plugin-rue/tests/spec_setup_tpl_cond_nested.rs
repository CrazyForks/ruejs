//! SWC 插件转换行为测试（spec_setup_tpl_cond_nested）
//!
//! 覆盖：此用例的转换快照对比。
use swc_plugin_rue::apply_pre;

mod utils;

#[test]
fn collects_nested_tpl_with_nested_conditionals() {
    let src = r##"
import { type FC, ref } from '@rue-js/rue'

const Comp: FC = () => {
  const a = ref(0)
  const b = a.value + 2
  const t = `n=${a.value}-${a.value > 0 ? `b=${b}-${b > 3 ? 'hi' : 'lo'}` : 'none'}`
  return <div>{t}</div>
}
"##;
    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply_pre(program);
    let out = utils::emit(program, cm);

    let expected_fragment = r##"import { ref, computed, _$vaporWithHookId, useSetup } from "@rue-js/rue/vapor";
import { type FC } from '@rue-js/rue';
const Comp: FC = ()=>{
    const _$useSetup = _$vaporWithHookId("useSetup:0:0", ()=>useSetup(()=>{
            const a = _$vaporWithHookId("ref:1:0", ()=>ref(0));
            const b = _$vaporWithHookId("computed:1:1", ()=>computed(()=>a.value + 2));
            const __rue_phase2_b = b;
            const t = _$vaporWithHookId("computed:1:2", ()=>computed(()=>`n=${a.value}-${a.value > 0 ? `b=${__rue_phase2_b.get()}-${__rue_phase2_b.get() > 3 ? 'hi' : 'lo'}` : 'none'}`));
            const __rue_phase2_t = t;
            return {
                a: a,
                b: b,
                t: t
            };
        }));
    const { a: a, b: b, t: t } = _$useSetup;
    return <div>{t.get()}</div>;
};
"##;

    use utils::{normalize, strip_marker};
    std::fs::create_dir_all("target/vapor_outputs").ok();
    std::fs::write("target/vapor_outputs/spec_on_setup_tpl_cond_nested.out.js", strip_marker(&out))
        .ok();
    assert_eq!(normalize(&strip_marker(&out)), normalize(&strip_marker(expected_fragment)));
}
