//! SWC 插件转换行为测试（spec44）
//!
//! 覆盖：此用例的转换快照对比。
use swc_plugin_rue::apply;

mod utils;

#[test]
fn transforms_spec44() {
    let src = r##"
import { type FC, ref } from '@rue-js/rue'

const OrCases: FC = () => {
  const show = ref(false)
  const a = false
  const b = false

  return <div>
    {show || <div>Alt</div>}
    {a ? <div>A</div> : b || <div>B</div>}
  </div>
}

export default OrCases
"##;
    let (program, cm) = utils::parse(src, "test.tsx");
    let program = apply(program);
    let out = utils::emit(program, cm);

    let expected_fragment = r##"
import { ref, _$vaporWithHookId, useSetup, vapor, renderAnchor, _$createElement, _$template, _$createComment, _$createDocumentFragment, _$appendChild, untrack, watchEffect } from "@rue-js/rue/vapor";
import { type FC } from '@rue-js/rue';
const _$getTemplate1 = _$template("<div>Alt</div>");
const _$getTemplate2 = _$template("<div>A</div>");
const _$getTemplate3 = _$template("<div>B</div>");
const OrCases: FC = ()=>{
    const _$useSetup = _$vaporWithHookId("useSetup:0:0", ()=>useSetup(()=>{
            const show = _$vaporWithHookId("ref:1:0", ()=>ref(false));
            const a = false;
            const b = false;
            return {
                show: show,
                a: a,
                b: b
            };
        }));
    const { show: show, a: a, b: b } = _$useSetup;
    return vapor((__rue_parent_context)=>{
        const _root = _$createElement("div", __rue_parent_context);
        const _list1 = _$createComment("rue:slot:anchor");
        _$appendChild(_root, _list1);
        watchEffect(()=>{
            const __slot = show || vapor(()=>{
                const _root = _$createDocumentFragment();
                _root.appendChild(_$getTemplate1().content.cloneNode(true));
                return _root;
            });
            untrack(()=>renderAnchor(__slot, _root, _list1));
        });
        const _list2 = _$createComment("rue:slot:anchor");
        _$appendChild(_root, _list2);
        watchEffect(()=>{
            const __slot = a ? vapor(()=>{
                const _root = _$createDocumentFragment();
                _root.appendChild(_$getTemplate2().content.cloneNode(true));
                return _root;
            }) : b || vapor(()=>{
                const _root = _$createDocumentFragment();
                _root.appendChild(_$getTemplate3().content.cloneNode(true));
                return _root;
            });
            untrack(()=>renderAnchor(__slot, _root, _list2));
        });
        return _root;
    });
};
export default OrCases;
"##;

    use utils::{normalize, strip_marker};
    std::fs::create_dir_all("target/vapor_outputs").ok();
    std::fs::write("target/vapor_outputs/spec44.out.js", strip_marker(&out)).ok();
    assert_eq!(normalize(&strip_marker(&out)), normalize(&strip_marker(expected_fragment)));
}
