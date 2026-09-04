//! SWC 插件转换行为测试（spec_setup_typed_arrow）
//!
//! 覆盖：此用例的转换快照对比。
use swc_plugin_rue::apply_pre;

mod utils;

#[test]
fn injects_use_setup_for_typed_arrow_return_jsx() {
    let src = r##"
import { ref } from '@rue-js/rue'

const Comp = (): JSX.Element => {
  const count = ref(0)
  const get = () => count.value
  return <div>{get()}</div>
}
"##;
    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply_pre(program);
    let out = utils::emit(program, cm);

    let expected_fragment = r##"import { ref, _$compiledWithHookId, useSetup } from "@rue-js/rue/internal";

const Comp = (): JSX.Element =>{
    const _$useSetup = _$compiledWithHookId("useSetup:0:0", ()=>useSetup(()=>{
        const count = ref(0);
        const get = ()=>count.value;
        return {
            count: count,
            get: get
        };
    }));
    const { count: count, get: get } = _$useSetup;
    return <div>{get()}</div>;
};
"##;

    use utils::{normalize_setup_snapshot, strip_marker};
    std::fs::create_dir_all("target/vapor_outputs").ok();
    std::fs::write("target/vapor_outputs/spec_on_setup_typed_arrow.out.js", strip_marker(&out))
        .ok();
    assert_eq!(
        normalize_setup_snapshot(&strip_marker(&out)),
        normalize_setup_snapshot(&strip_marker(expected_fragment))
    );
}
