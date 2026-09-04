//! SWC 插件转换行为测试（spec_setup_watch_combo）
//!
//! 覆盖：此用例的转换快照对比。
use swc_plugin_rue::apply_pre;

mod utils;

#[test]
fn watch_and_unmount_calls_are_collected_while_impure_kept_outside() {
    let src = r##"
import { type FC, ref } from '@rue-js/rue'

const Comp: FC = () => {
  const a = ref(0)
  watchEffect(() => { console.log(a.value) })
  onBeforeUnmount(() => { console.log('cleanup', a.value) })
  const leak = Object.assign(window as any, { a })
  return <div>{a.value}</div>
}
"##;
    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply_pre(program);
    let out = utils::emit(program, cm);

    let expected_fragment = r##"import { onBeforeUnmount, watchEffect, ref, _$compiledWithHookId, useSetup } from "@rue-js/rue/internal";
import { type FC } from '@rue-js/rue';
const Comp: FC = ()=>{
    const _$useSetup = _$compiledWithHookId("useSetup:0:0", ()=>useSetup(()=>{
        const a = ref(0);
        watchEffect(()=>{
                console.log(a.value);
            });
        onBeforeUnmount(()=>{
            console.log('cleanup', a.value);
        });
        const leak = Object.assign(window as any, {
            a
        });
        return {
            a: a,
            leak: leak
        };
    }));
    const { a: a, leak: leak } = _$useSetup;
    return <div>{a.value}</div>;
};
"##;

    use utils::{normalize_setup_snapshot, strip_marker};
    std::fs::create_dir_all("target/vapor_outputs").ok();
    std::fs::write("target/vapor_outputs/spec_on_setup_watch_combo.out.js", strip_marker(&out))
        .ok();
    assert_eq!(
        normalize_setup_snapshot(&strip_marker(&out)),
        normalize_setup_snapshot(&strip_marker(expected_fragment))
    );
}
