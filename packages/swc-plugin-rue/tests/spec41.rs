//! SWC 插件转换行为测试（spec41）
//!
//! 覆盖：此用例的转换快照对比。
use swc_plugin_rue::apply;

mod utils;

#[test]
fn transforms_spec41() {
    let src = r##"
import { type FC, ref } from '@rue-js/rue'

const HelloWorld: FC = () => {
  console.log('--------start')
  const x = ref(0)
  console.log(x.value)
  x.value = 100
  console.log(x.value)

  if (true) {
    console.log(124234)
  }

  console.log('====end')

  if (x.value > 500) {
    return <div>hello</div>
  }

  return (
    <div>
      <div>x.value: {x.value}</div>
    </div>
  )
}

export default HelloWorld
"##;
    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply(program);
    let out = utils::emit(program, cm);

    let expected_fragment = r##"
import { ref, _$vaporWithHookId, _$vaporMarkComponentRenderReactive, useSetup, vapor, _$createElement, _$template, _$createTextNode, _$settextContent, _$appendChild, watchEffect, _$createTextWrapper } from "@rue-js/rue/vapor";
import { type FC } from '@rue-js/rue';
const _$getTemplate1 = _$template("<div>hello</div>");
const HelloWorld: FC = _$vaporMarkComponentRenderReactive(()=>{
    const _$useSetup = _$vaporWithHookId("useSetup:0:0", ()=>useSetup(()=>{
            console.log('--------start');
            const x = _$vaporWithHookId("ref:1:0", ()=>ref(0));
            console.log(x.value);
            x.value = 100;
            console.log(x.value);
            if (true) {
                console.log(124234);
            }
            console.log('====end');
            return {
                x: x
            };
        }));
    const { x: x } = _$useSetup;
    if (x.value > 500) {
        return (()=>{
            let _root;
            let _disposed = false;
            const _dispose = ()=>{
                if (_disposed) return;
                _disposed = true;
                if (_root && _root.parentNode) {
                    _root.parentNode.removeChild(_root);
                }
            };
            return {
                __rue_cleanup_bucket: [
                    _dispose
                ],
                __rue_vapor_setup: (__rue_parent_context)=>{
                    if (_disposed) {
                        throw new Error("Cannot mount a disposed static root");
                    }
                    if (_root) {
                        throw new Error("A static root can only be mounted once");
                    }
                    const _fragment = _$getTemplate1().content.cloneNode(true);
                    _root = _fragment.firstChild;
                    return _root;
                },
                dispose: _dispose
            };
        })();
    }
    return vapor((__rue_parent_context)=>{
        const _root = _$createElement("div", __rue_parent_context);
        const _el1 = _$createElement("div", _root);
        _$appendChild(_root, _el1);
        _$appendChild(_el1, _$createTextNode("x.value: "));
        const _el2 = _$createTextWrapper(_el1);
        _$appendChild(_el1, _el2);
        watchEffect(()=>{
            _$settextContent(_el2, x.value);
        });
        return _root;
    });
});
export default HelloWorld;
"##;

    use utils::{normalize, strip_marker};
    std::fs::create_dir_all("target/vapor_outputs").ok();
    std::fs::write("target/vapor_outputs/spec41.out.js", strip_marker(&out)).ok();
    assert_eq!(normalize(&strip_marker(&out)), normalize(&strip_marker(expected_fragment)));
}
