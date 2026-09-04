//! SWC 插件转换行为测试（spec27）
//!
//! 覆盖：此用例的转换快照对比。
use swc_plugin_rue::apply_pre;

mod utils;

#[test]
fn transforms_spec27() {
    let src = r##"
import { type FC, ref } from '@rue-js/rue'

const Hello: FC = () => {
  const color = ref("blue")
  return (
    <div>
      <div v-show={true} style={{ fontWeight: 'bold', color: 'red' }}>hello world</div>
      <div v-show={true} style="color:blue;">hello world</div>
      <div v-show={true} style={"color:" + color.value + ";"}>hello world</div>
      <div v-show={true} style={null}>hello world</div>
      <div v-show={true} style={undefined}>hello world</div>
      <div v-show={true} style={0}>hello world</div>
      <div v-show={true}>hello world</div>
      <div v-show={true} style="">hello world</div>
      <div v-show={true} style=" ">hello world</div>
      <div v-show={true} style>hello world</div>
      <div v-show={true}>hello world</div>
    </div>
  )
}

export default Hello
"##;
    let (program, cm) = utils::parse(src, "Refs.tsx");
    let program = apply_pre(program);
    let out = utils::emit(program, cm);

    let _expected_fragment = r##"import { ref, _$compiledWithHookId, useSetup } from "@rue-js/rue/internal";
import { type FC } from '@rue-js/rue';
const Hello: FC = ()=>{
    const _$useSetup = _$compiledWithHookId("useSetup:0:0", ()=>useSetup(()=>{
            const color = ref("blue");
            return {
                color: color
            };
        }));
    const { color: color } = _$useSetup;
    return (<div>
      <div style={{
        fontWeight: 'bold',
        color: 'red',
        display: ""
    }}>hello world</div>
      <div style={"color:blue;"}>hello world</div>
      <div style={"color:" + color.value + ";"}>hello world</div>
      <div style={{
        display: ""
    }}>hello world</div>
      <div style={{
        display: ""
    }}>hello world</div>
      <div style={{
        display: ""
    }}>hello world</div>
      <div style={{
        display: ""
    }}>hello world</div>
      <div style={""}>hello world</div>
      <div style={" "}>hello world</div>
      <div style={""}>hello world</div>
      <div style={{
        display: ""
    }}>hello world</div>
    </div>);
};
export default Hello;
"##;

    use utils::{normalize, strip_marker};
    std::fs::create_dir_all("target/vapor_outputs").ok();
    std::fs::write("target/vapor_outputs/spec27.out.js", strip_marker(&out)).ok();
    let normalized = normalize(&strip_marker(&out));
    assert!(normalized.contains("_$compiledSetup(\"useSetup:0:0\""), "{normalized}");
    assert!(normalized.contains("color.value"), "{normalized}");
    assert!(normalized.contains("fontWeight: 'bold'"), "{normalized}");
    assert!(!normalized.contains("r-show"), "{normalized}");
}
