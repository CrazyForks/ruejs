//! SWC 插件转换行为测试（spec_setup_keeps_props_computed_outside）
//!
//! 覆盖：依赖响应式 props 的 computed 和 watchEffect 可以安全搬进 useSetup。
use swc_plugin_rue::apply_pre;

mod utils;

#[test]
fn hoists_props_dependent_computed_into_use_setup() {
    let src = r##"
import { type FC, computed, ref, watchEffect } from '@rue-js/rue'

const Comp: FC<{ query: string }> = (props) => {
  const count = ref(0)
  const filtered = computed(() => props.query.trim().toLowerCase())
    watchEffect(() => {
        console.log(props.query, filtered.value)
    })
  return <div>{count.value}{filtered.value}</div>
}
"##;

    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply_pre(program);
    let out = utils::emit(program, cm);
    let normalized = utils::normalize(&utils::strip_marker(&out));

    assert!(normalized.contains(&utils::normalize(
        r#"const _$useSetup = _$vaporWithHookId("useSetup:0:0", ()=>useSetup(()=>{
        const count = _$vaporWithHookId("ref:1:0", ()=>ref(0));
        const filtered = _$vaporWithHookId("computed:1:1", ()=>computed(()=>props.query.trim().toLowerCase()));
        _$vaporWithHookId("watchEffect:1:2", ()=>watchEffect(()=>{
            console.log(props.query, filtered.value);
        }));
        return {
            count: count,
            filtered: filtered
        };
    }));"#,
    )));

    assert!(normalized.contains(&utils::normalize(
        r#"const { count: count, filtered: filtered } = _$useSetup;"#,
    )));
}
